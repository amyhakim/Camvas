import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base = `${(process.env.SHOWCAM_URL || 'http://localhost:3000').split('?')[0]}/?scene=pavilion-v1`;
const dir = `${process.env.SHOWCAM_ARTIFACT_DIR || '.impeccable/review'}/projects-blocking`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const key = 'showcam-project:v1:pavilion-v1';
const actorPoses = () => page.locator('canvas').getAttribute('data-actor-poses').then(JSON.parse);
async function ready() { await page.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 }); await page.evaluate(() => document.fonts.ready); }
async function seek(frame) { await page.getByLabel('Timeline frame', { exact: true }).fill(String(frame)); await page.waitForFunction(value => document.querySelector('canvas')?.dataset.frame === String(value), frame); }
async function edit(label, value) { const field = page.getByLabel(label, { exact: true }); await field.fill(String(value)); await field.press('Enter'); }
async function saved() { await page.waitForFunction(k => !!localStorage.getItem(k), key); }
async function capture(name) {
  await page.locator('.inspector').evaluate(el => el.scrollTop = 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.waitForFunction(() => document.documentElement.scrollHeight <= innerHeight);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}
const audits = [];
try {
  await page.goto(base); await ready();
  await page.getByRole('button', { name: 'Actors', exact: true }).click();
  await page.getByRole('button', { name: 'Add actor', exact: true }).click();
  await edit('Name', 'Hero');
  await expect(page.getByRole('combobox', { name: 'Actor', exact: true })).toContainText('Hero');
  const id = await page.getByRole('combobox', { name: 'Actor', exact: true }).inputValue();
  await seek(145);
  await page.getByRole('button', { name: 'Add mark at playhead', exact: true }).click();
  await edit('X · m', -3); await edit('Heading · °', 90);
  await seek(73);
  await page.waitForFunction(() => Math.abs(JSON.parse(document.querySelector('canvas').dataset.actorPoses)[0].position[0] + 5) < .001);
  const midpoint = (await actorPoses())[0];
  assert.ok(Math.abs(midpoint.heading - Math.PI / 4) < 1e-6);
  await seek(374); assert.equal((await actorPoses())[0].position[0], -3);
  await seek(1); assert.equal((await actorPoses())[0].position[0], -7);
  await seek(73); assert.deepEqual((await actorPoses())[0], midpoint);
  await page.locator('.timeline').getByRole('button', { name: 'Hero', exact: true }).click();
  await page.getByRole('button', { name: 'Frame actor', exact: true }).click();
  await capture('desktop-actors');
  audits.push({ name: 'desktop-actors', violations: (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations });
  // Picking the centered proxy opens its controls, even from another inspector section.
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const clearCenter = await page.evaluate(() => {
    const objects = document.querySelector('.object-browser').getBoundingClientRect();
    const inspector = document.querySelector('.inspector').getBoundingClientRect();
    const tools = document.querySelector('.viewport-tools').getBoundingClientRect();
    const timeline = document.querySelector('.timeline-position').getBoundingClientRect();
    return { x: (objects.right + inspector.left) / 2, y: (tools.bottom + timeline.top - 4) / 2 };
  });
  await page.mouse.click(clearCenter.x, clearCenter.y);
  await expect(page.getByRole('combobox', { name: 'Actor', exact: true })).toHaveValue(id);
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.frame) > 6);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  // Make a camera draft in the same saved project.
  await page.getByRole('radio', { name: 'Camera move', exact: true }).check();
  await page.getByRole('combobox', { name: 'Subject', exact: true }).selectOption('Group');
  await page.getByRole('button', { name: 'Generate move', exact: true }).click();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByLabel('Project name', { exact: true }).fill('Pavilion rehearsal');
  await expect(page.locator('.project-status')).toHaveAttribute('data-status', 'saved');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
  const download = await downloadPromise; const exportPath = `${dir}/roundtrip.showcam.json`; await download.saveAs(exportPath);
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  assert.equal(exported.name, 'Pavilion rehearsal'); assert.equal(exported.actors[0].name, 'Hero'); assert.ok(exported.shot);
  await page.reload(); await ready();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Pavilion rehearsal');
  assert.equal((await actorPoses()).length, 1);
  await expect(page.locator('.draft-clip')).toHaveCount(1);
  await page.getByLabel('Choose Showcam project JSON', { exact: true }).setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{') });
  await expect(page.locator('.project-error')).toContainText('not valid JSON');
  assert.equal((await actorPoses()).length, 1);
  await page.getByLabel('Choose Showcam project JSON', { exact: true }).setInputFiles(exportPath);
  await expect(page.locator('.project-error')).toHaveCount(0);
  await capture('desktop-project');
  audits.push({ name: 'desktop-project', violations: (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations });
  // Damaged stored data is never overwritten until explicit recovery.
  await page.evaluate(k => localStorage.setItem(k, '{'), key); await page.reload(); await ready();
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await expect(page.locator('.project-status')).toHaveAttribute('data-status', 'error');
  assert.equal(await page.evaluate(k => localStorage.getItem(k), key), '{');
  await page.getByLabel('Choose Showcam project JSON', { exact: true }).setInputFiles(exportPath);
  await expect(page.locator('.project-status')).toHaveAttribute('data-status', 'saved');
  // Storage write failure preserves edited in-memory work and enables recovery.
  await page.evaluate(() => { window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.getByLabel('Project name', { exact: true }).fill('Unsaved rehearsal');
  await expect(page.locator('.project-status')).toHaveAttribute('data-status', 'error');
  await expect(page.getByLabel('Project name', { exact: true })).toHaveValue('Unsaved rehearsal');
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await page.getByRole('button', { name: 'Retry browser save', exact: true }).click();
  await expect(page.locator('.project-status')).toHaveAttribute('data-status', 'saved');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture('mobile-project');
  audits.push({ name: 'mobile-project', violations: (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations });
  await page.getByRole('button', { name: 'Actors', exact: true }).click();
  await page.getByRole('combobox', { name: 'Actor', exact: true }).selectOption(id);
  await capture('mobile-actors');
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.inspector')).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Actors', exact: true }).click();
  await page.getByRole('combobox', { name: 'Mark', exact: true }).selectOption('1');
  await edit('Time · s', 60); await seek(1441);
  await page.getByRole('button', { name: 'Remove actor', exact: true }).click();
  await expect(page.getByLabel('Timeline frame', { exact: true })).toHaveValue('374');
  await page.reload(); await ready(); assert.equal((await actorPoses()).length, 0);
  await page.getByRole('button', { name: 'Show inspector', exact: true }).click();
  await page.getByRole('radio', { name: 'Camera move', exact: true }).check();
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await page.reload(); await ready(); await expect(page.locator('.draft-clip')).toHaveCount(0);
  await writeFile(`${dir}/audit.json`, JSON.stringify({ errors, audits, checks: ['actor marks and deterministic seeks', 'actor raycast and framing', 'playback', 'camera and actors roundtrip', 'reload', 'malformed import', 'damaged storage recovery', 'storage failure recovery', 'phone preview', 'deletion persists'] }, null, 2));
  assert.deepEqual(errors, []);
  assert.ok(audits.every(audit => audit.violations.length === 0), 'Accessibility checks pass');
  console.log('Saved projects and actor blocking: interaction, roundtrip, recovery and accessibility passed.');
} finally { await browser.close(); }
