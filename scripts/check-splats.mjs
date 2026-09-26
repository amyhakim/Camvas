import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = (process.env.SHOWCAM_URL || 'http://localhost:3000').split('?')[0];
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const residenceKey = 'showcam-project:v1:residence-9d09ab82';
const pavilionKey = 'showcam-project:v1:pavilion-v1';
const ready = () => page.waitForSelector('canvas[data-ready="true"]', { timeout: 120000 });
try {
  await page.goto(base); await ready();
  await expect(page.getByRole('heading', { name: 'Private Residence Interior', exact: true })).toBeVisible();
  const canvas = page.locator('canvas');
  assert.match(await canvas.getAttribute('data-renderer'), /^playcanvas-/);
  assert.ok(Number(await canvas.getAttribute('data-splats')) > 0);
  const size = await canvas.evaluate(el => ({ width: el.width, clientWidth: el.clientWidth }));
  assert.ok(size.width >= size.clientWidth, 'render at display resolution');
  await page.getByRole('button', { name: 'Actors', exact: true }).click();
  await page.getByRole('button', { name: 'Add actor', exact: true }).click();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key))?.actors.length === 1, residenceKey);
  await page.getByRole('radio', { name: 'Fly', exact: true }).check();
  await canvas.focus();
  const initial = await canvas.getAttribute('data-camera-position');
  await page.keyboard.down('w');
  await page.waitForFunction(p => document.querySelector('canvas').dataset.cameraPosition !== p, initial);
  await page.keyboard.up('w');
  await page.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('pavilion-v1'); await ready();
  assert.equal(await canvas.getAttribute('data-splats'), '0');
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).actors.length, pavilionKey), 0);
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).actors.length, residenceKey), 1);
  await page.getByRole('combobox', { name: 'Scene', exact: true }).selectOption('residence-9d09ab82'); await ready();
  assert.equal(JSON.parse(await canvas.getAttribute('data-actor-poses')).length, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const scene = await page.getByRole('combobox', { name: 'Scene', exact: true }).boundingBox();
  const tools = await page.getByRole('toolbar', { name: 'Viewport controls', exact: true }).boundingBox();
  assert.ok(scene.y + scene.height <= tools.y, 'phone scene picker remains unobstructed');
  assert.deepEqual(errors, []);
  // A broken external scene must leave a concrete route back to working local content.
  await page.route('https://d28zzqy0iyovbz.cloudfront.net/**', route => route.abort());
  await page.reload();
  await expect(page.getByRole('heading', { name: 'The scene couldn’t load', exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Retry scene', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open the pavilion', exact: true }).click(); await ready();
  console.log('Streamed residence, display resolution, fly navigation, scene-scoped persistence, phone picker and loading recovery passed.');
} finally { await browser.close(); }
