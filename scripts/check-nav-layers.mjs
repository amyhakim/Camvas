import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
 const errors = []; page.on('pageerror', e => { errors.push(e.message); console.log('PAGE ERROR', e.message); });
 await page.addInitScript(() => { localStorage.setItem('showcam-project:v1:pavilion-v1', JSON.stringify({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Navigation check', shot: null, actors: [], landmarks: [{ id: 'test:landmark', label: 'Existing landmark', entityId: null, kind: 'floor', frame: 1, position: [-7, 1.4, 2] }] })); });
 await page.goto('http://localhost:3000/editor?scene=pavilion-v1');
 await page.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 });
 await expect(page.getByRole('button', { name: 'Show details', exact: true })).toHaveCount(0);
 await expect(page.getByRole('region', { name: 'Details', exact: true })).toHaveCount(0);
 const canvas = page.locator('canvas');
 const rect = await canvas.boundingBox();
 for (const [x,y] of [[.5,.4],[.45,.45],[.55,.5]]) {
  await canvas.click({ position: { x: rect.width*x, y: rect.height*y } });
  if (await page.getByRole('region', { name: 'Details', exact: true }).count()) break;
 }
 await expect(page.getByRole('region', { name: 'Details', exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Close details', exact: true }).click();
 await expect(page.getByRole('region', { name: 'Details', exact: true })).toHaveCount(0);
 const toolbar = page.getByRole('toolbar', { name: 'Viewport controls' });
 const landmarks = page.getByRole('region', { name: 'Scene landmarks' });
 await expect(landmarks).toHaveCount(0);
 await page.locator('.landmark-pin').first().evaluate(pin => pin.click());
 await expect(landmarks).toHaveCount(0);
 await expect(page.getByRole('group', { name: 'Blockout comparison' })).toHaveCount(0);
 await toolbar.getByRole('button', { name: 'Landmarks', exact: true }).click();
 await expect(landmarks).toBeVisible();
 await toolbar.getByRole('button', { name: 'Landmarks', exact: true }).click();
 await expect(landmarks).toHaveCount(0);
 await mkdir('/private/tmp/flythru-nav-layers', { recursive: true });
 for (const width of [1440,390]) {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  await toolbar.getByRole('button', { name: 'Scene layers', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Scene layers' });
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Original', exact: true }).click();
  assert.equal(await page.locator('canvas').getAttribute('data-blockout-view'), 'source');
  await popup.getByRole('button', { name: 'Blocks', exact: true }).click();
  await page.screenshot({ path: `/private/tmp/flythru-nav-layers/layers-${width}.png` });
  const box = await popup.boundingBox(); assert.ok(box.x >= 0 && box.x+box.width <= width);
  await page.keyboard.press('Escape'); await expect(popup).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: 'Scene layers', exact: true })).toBeFocused();
  await toolbar.getByRole('button', { name: 'Landmarks', exact: true }).click();
  await expect(landmarks).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/private/tmp/flythru-nav-layers/landmarks-${width}.png` });
  await toolbar.getByRole('button', { name: 'Landmarks', exact: true }).click();
  await expect(landmarks).toHaveCount(0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
 }
 assert.deepEqual(errors, []);
 console.log('Landmark toggle, layer menu, display modes, Escape focus, desktop and mobile checks passed.');
} finally { await browser.close(); }
