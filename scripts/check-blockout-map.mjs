import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const dir = '/private/tmp/flythru-blockout-map';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:3000/editor?scene=pavilion-v1');
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  const canvas = page.locator('canvas');
  assert.equal(await canvas.getAttribute('data-blockout-view'), 'source', 'Original is the initial layer');
  const count = Number(await canvas.getAttribute('data-blockout-blocks'));
  assert.ok(count > 195, 'Fitted blocks subdivide source objects');
  await page.locator('canvas').click({ position: { x: 700, y: 420 } });
  assert.equal(await canvas.getAttribute('data-blockout-view'), 'source', 'Object selection preserves Original');
  await page.getByRole('toolbar', { name: 'Viewport controls' }).getByRole('button', { name: 'Scene layers', exact: true }).click();
  const group = page.getByRole('group', { name: 'Blockout comparison' });
  for (const [label, mode] of [['Blocks', 'blocks'], ['Overlay', 'overlay'], ['Original', 'source']]) {
    await group.getByRole('button', { name: label, exact: true }).click();
    assert.equal(await canvas.getAttribute('data-blockout-view'), mode);
    await page.screenshot({ path: `${dir}/${mode}.png` });
  }
  await group.getByRole('button', { name: 'Blocks', exact: true }).click();
  await page.getByLabel('Timeline frame', { exact: true }).fill('125');
  assert.equal(await canvas.getAttribute('data-blockout-view'), 'blocks', 'Scrubbing preserves the chosen layer');
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  assert.equal(await canvas.getAttribute('data-blockout-view'), 'blocks', 'Reset view preserves the chosen layer');
  await page.reload();
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  assert.equal(Number(await canvas.getAttribute('data-blockout-blocks')), count, 'Reload recreates the same blocks');
  assert.equal(await canvas.getAttribute('data-blockout-view'), 'source', 'Reload starts in Original');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ blocks: count, sources: await canvas.getAttribute('data-blockout-sources'), screenshots: dir, errors }));
} finally { await browser.close(); }
