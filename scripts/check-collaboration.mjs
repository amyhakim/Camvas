import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
const room = `collabtest${Date.now()}`;
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
const first = await context.newPage(), second = await context.newPage();
for (const page of [first, second]) page.setDefaultTimeout(30000);

try {
  await Promise.all([first.goto(`${base}/?scene=pavilion-v1&room=${room}`), second.goto(`${base}/?scene=pavilion-v1&room=${room}`)]);
  await Promise.all([first.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 }), second.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 })]);
  await Promise.all([first.getByLabel(/collaborators online/).waitFor(), second.getByLabel(/collaborators online/).waitFor()]);
  await first.locator('.object-row').filter({ hasText: 'Camera.001' }).click();
  await second.waitForFunction(() => document.querySelector('.object-row.is-selected')?.textContent?.includes('Camera.001'));
  await first.getByLabel('Timeline frame', { exact: true }).fill('64');
  await second.waitForFunction(() => document.querySelector('[aria-label="Timeline frame"]')?.value === '64');
  const canvas = first.locator('canvas');
  const box = await canvas.boundingBox();
  assert.ok(box);
  await first.mouse.move(box.x + box.width * .55, box.y + box.height * .45);
  await second.waitForSelector('[data-collaborator-cursor]', { timeout: 10000 });
  assert.equal(await second.locator('.object-row.is-selected').filter({ hasText: 'Camera.001' }).count(), 1);
  console.log(JSON.stringify({ room, peers: 2, sharedSelection: 'passed', sharedTimeline: 'passed', liveCursor: 'passed' }, null, 2));
} finally { await browser.close(); }
