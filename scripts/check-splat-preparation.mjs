import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
const scene = process.env.SHOWCAM_SPLAT_SCENE || 'supersplat-592480a3-v1';
const dir = process.env.SHOWCAM_ARTIFACT_DIR || '.agent-local/artifacts/splat-preparation';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ ...(process.env.SHOWCAM_CHROME ? { executablePath: process.env.SHOWCAM_CHROME } : {}), args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const key = `showcam-project:v1:${scene}`;
const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
const ready = () => page.waitForSelector('canvas[data-ready="true"]', { timeout: 600000 });
let snapshot, flightSnapshot, requests = 0;
await page.route('**/api/flight-plan', async route => {
  flightSnapshot = route.request().postDataJSON().snapshot;
  await route.fulfill({ status: 503, json: { error: 'Test flight provider unavailable' } });
});
// Fixture labels exercise grounding/persistence without making semantic claims or spending AI usage.
await page.route('**/api/semantic-labels', async route => {
  requests++;
  if (requests > 1) return route.fulfill({ status: 503, json: { error: 'Test labeling failure' } });
  snapshot = route.request().postDataJSON();
  const view = snapshot.views[0];
  await route.fulfill({ json: { proposal: { regions: view.objects.slice(0, 3).map((object, i) => ({
    label: `Measured test area ${i + 1}`, category: 'area', entityIds: [object.id], confidence: .7,
    evidence: 'Test fixture; not an AI semantic claim.', viewIds: [view.id],
  })) } } });
});
async function imageColors(image) {
  return page.evaluate(async image => {
    const img = new Image(); img.src = image; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0);
    const pixels = ctx.getImageData(0, 0, img.width, img.height).data, colors = new Set();
    for (let i = 0; i < pixels.length; i += 32) colors.add(`${pixels[i] >> 4},${pixels[i + 1] >> 4},${pixels[i + 2] >> 4}`);
    return colors.size;
  }, image);
}
try {
  await page.goto(`${base}/editor?scene=${encodeURIComponent(scene)}`); await ready();
  const labels = page.getByRole('complementary', { name: 'Semantic labels' });
  await expect(labels.getByRole('button', { name: /Measured test area 1/ })).toBeVisible({ timeout: 240000 });
  assert.ok(snapshot.candidates.length > 1 && snapshot.candidates.length <= 64);
  const evidenceColors = [];
  for (const view of snapshot.views) {
    assert.ok(view.objects.length > 0);
    const colors = await imageColors(view.image); evidenceColors.push(colors);
    assert.ok(colors > 100, `${view.id} must contain scene appearance, not a blank background and numbered markers (${colors} colors)`);
    await writeFile(`${dir}/${view.id}.jpg`, Buffer.from(view.image.split(',')[1], 'base64'));
  }
  await writeFile(`${dir}/snapshot.json`, JSON.stringify(snapshot));
  const initial = await saved();
  assert.equal(initial.semantics.regions.length, 3);
  assert.ok(initial.semantics.regions.every(r => r.entityIds.every(id => snapshot.candidates.some(c => c.sourceEntityId === id))));
  assert.ok(initial.collision.boxes.length > 0); assert.equal(initial.collision.reviewed, false);
  await expect(page.locator('.semantic-map-label').first()).toBeVisible();
  await labels.getByRole('checkbox', { name: 'Reviewed label and extent' }).check();
  await labels.getByRole('button', { name: 'Review navigation boxes' }).click();
  await page.getByRole('button', { name: 'Use reviewed boxes', exact: true }).click();
  const reviewed = await saved(); assert.equal(reviewed.collision.reviewed, true);
  await expect.poll(() => flightSnapshot?.geometryKind, { timeout: 10000 }).toBe('splat-proxies');
  assert.deepEqual(flightSnapshot.coverage, reviewed.collision.region);
  const toolbar = page.getByRole('toolbar', { name: 'Viewport controls' });
  await toolbar.getByRole('button', { name: 'Scene layers', exact: true }).click();
  for (const mode of ['Blocks', 'Overlay', 'Original']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    // Allow the original splat camera to sort again after Blocks mode disabled it.
    if (mode !== 'Blocks') await expect.poll(() => page.locator('canvas[data-engine]').getAttribute('data-splats'), { timeout: 60000 }).not.toBe('0');
    await page.screenshot({ path: `${dir}/${mode}.png` });
  }
  const original = await page.locator('canvas[data-engine]').screenshot();
  assert.ok(await imageColors(`data:image/png;base64,${original.toString('base64')}`) > 100, 'Sampling must preserve the rendered source textures');
  await page.reload(); await ready();
  await expect(labels.getByRole('button', { name: /Measured test area 1/ })).toBeVisible();
  assert.equal(requests, 1, 'Saved semantics do not trigger another AI call');
  assert.deepEqual((await saved()).collision, reviewed.collision);
  await toolbar.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'Blocks', exact: true }).click();
  await page.getByRole('button', { name: 'Close scene layers', exact: true }).click();
  await labels.getByRole('button', { name: 'Regenerate labels' }).click();
  await expect(labels.getByRole('alert')).toHaveText('Test labeling failure', { timeout: 240000 });
  await expect(page.locator('canvas[data-engine]')).toHaveAttribute('data-blockout-view', 'blocks');
  assert.deepEqual((await saved()).semantics, reviewed.semantics, 'Failed replacement preserves reviewed labels');
  assert.deepEqual((await saved()).collision, reviewed.collision, 'Failed replacement preserves reviewed navigation');
  assert.deepEqual(errors, []);
  await writeFile(`${dir}/result.json`, JSON.stringify({ scene, candidates: snapshot.candidates.length, evidenceColors, boxes: initial.collision.boxes.length, checks: ['original evidence images', 'source textures preserved', 'map labels', 'grounded source identity', 'review', 'save/reload', 'failed replacement preserves prior work'] }, null, 2));
  console.log('Splat preparation passed: fitted blocks, original evidence, grounded labels, reviewed navigation and persistence.');
} finally { await browser.close(); }
