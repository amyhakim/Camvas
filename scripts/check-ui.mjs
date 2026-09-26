import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
const dir = (process.env.SHOWCAM_ARTIFACT_DIR || '.impeccable/review');
await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const audits = [];
const overflows = [];

async function settled() {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function capture(name, fullPage = true) {
  await settled();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) overflows.push(name);
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}
async function audit(name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  audits.push({ name, violations: result.violations.map(v => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
}

try {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/design-system`);
  await capture('system-mobile');
  await audit('system-mobile');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/design-system`);
  await capture('system-desktop');
  await capture('system-first-viewport', false);
  await page.locator('#controls').screenshot({ path: `${dir}/controls-desktop.png` });
  await audit('system-desktop');
  await page.getByLabel('Focal length (mm)').fill('0');
  assert.equal(await page.getByText('Use a focal length between 1 and 300 mm.').count(), 1);
  await page.getByLabel('Focal length (mm)').fill('50');
  assert.equal(await page.getByLabel('Focal length (mm)').getAttribute('aria-invalid'), 'false');
  await page.getByRole('switch', { name: 'Reduce transparency', exact: false }).check();
  assert.equal(await page.locator('html').getAttribute('data-transparency'), 'reduced');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.transparency === 'reduced');
  await page.getByRole('switch', { name: 'Reduce transparency', exact: false }).uncheck();
  await page.getByRole('radio', { name: 'Inspect', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('radio', { name: 'Camera', exact: true }).isChecked(), true);
  await page.getByRole('button', { name: 'Toggle example selection' }).click();
  assert.equal(await page.getByRole('heading', { name: 'Find your focus.' }).count(), 1);
  await page.getByRole('button', { name: 'Select camera', exact: true }).click();
  await page.getByRole('switch', { name: 'Frame guides', exact: true }).uncheck();
  assert.equal(await page.locator('.frame-guides').count(), 0);
  assert.deepEqual(errors, [], 'No browser runtime errors');
  await writeFile(`${dir}/audit.json`, JSON.stringify({ errors, overflows, audits }, null, 2));
  const violations = audits.flatMap(a => a.violations.map(v => `${a.name}: ${v.id} (${v.impact})`));
  console.log(JSON.stringify({ interactions: 'passed', runtimeErrors: errors, overflows, accessibilityViolations: violations, screenshots: dir }, null, 2));
  if (violations.length || overflows.length) process.exitCode = 1;
} finally { await browser.close(); }
