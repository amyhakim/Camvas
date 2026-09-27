import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.SHOWCAM_CHROME_PATH, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const key = 'showcam-project:v1:pavilion-v1';
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
let actions = [];
let sentContext;
await page.route('**/api/director', route => {
  sentContext = JSON.parse(route.request().postDataJSON().context);
  return route.fulfill({ contentType: 'application/x-ndjson', body: [{ type: 'actions', actions }, { type: 'done', text: 'Applying requested removal.' }].map(event => JSON.stringify(event)).join('\n') + '\n' });
});
async function direct(next, prompt) {
  actions = next;
  await page.locator('#director-prompt').fill(prompt);
  await page.getByRole('button', { name: 'Send direction', exact: true }).click();
  await expect(page.locator('#director-prompt')).toBeEnabled();
}
try {
  await page.goto(`${process.env.SHOWCAM_URL || 'http://localhost:3001'}/?scene=pavilion-v1`);
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 120000 });
  await page.getByLabel('Shot camera', { exact: true }).selectOption('Camera.002');
  await page.getByRole('button', { name: 'Delete camera', exact: true }).click();
  await expect.poll(async () => (await saved()).removedCameraIds).toEqual(['Camera.002']);
  await expect(page.locator('#shot-camera option[value="Camera.002"]')).toHaveCount(0);
  assert.notEqual(await page.locator('#shot-camera').inputValue(), 'Camera.002');
  await page.getByRole('button', { name: 'Undo object edit', exact: true }).click();
  await expect(page.locator('#shot-camera option[value="Camera.002"]')).toHaveCount(1);
  await direct([{ type: 'removeCamera', targetId: 'Camera.002' }], 'Delete Camera.002');
  await expect.poll(async () => (await saved()).removedCameraIds).toEqual(['Camera.002']);
  const before = await saved();
  before.landmarks = Array.from({ length: 12 }, (_, i) => ({ id: `landmark:${i}`, label: `Point ${i}`, kind: 'flight', entityId: null, frame: 1, position: [i, 1, 0] }));
  await page.evaluate(({ key, document }) => localStorage.setItem(key, JSON.stringify(document)), { key, document: before });
  await page.reload();
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 120000 });
  await expect(page.locator('#shot-camera option[value="Camera.002"]')).toHaveCount(0);
  await direct([{ type: 'clearLandmarks' }], 'Delete all landmarks');
  assert.ok(!sentContext.objects.some(object => object[0] === 'Camera.002'));
  await expect.poll(async () => (await saved()).landmarks).toEqual([]);
  await page.getByRole('button', { name: 'Undo object edit', exact: true }).click();
  await expect.poll(async () => (await saved()).landmarks.length).toEqual(12);
  await direct([{ type: 'removeLandmark', targetId: 'landmark:4' }], 'Delete Point 4');
  await expect.poll(async () => (await saved()).landmarks.length).toEqual(11);
  assert.ok(!(await saved()).landmarks.some(mark => mark.id === 'landmark:4'));
  // Removing every remaining camera leaves an explicit empty selector and Orbit view.
  const ids = await page.locator('#shot-camera option').evaluateAll(options => options.map(option => option.value));
  for (const id of ids) {
    await direct([{ type: 'removeCamera', targetId: id }], `Delete ${id}`);
    await expect(page.locator(`#shot-camera option[value="${id}"]`)).toHaveCount(0);
  }
  await expect(page.locator('#shot-camera')).toBeDisabled();
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-source', 'orbit');
  assert.deepEqual(errors, []);
  console.log('Camera UI/Director removal, fallback, reload, landmark bulk/individual removal, and undo passed. Director responses were mocked.');
} finally { await browser.close(); }
