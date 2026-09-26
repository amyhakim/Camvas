import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as THREE from 'three';
const dir = `${process.env.SHOWCAM_ARTIFACT_DIR || '.impeccable/review'}/object-controls`;
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage(); page.setDefaultTimeout(30000);
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
const key = 'showcam-project:v1:pavilion-v1';
const data = name => page.locator('canvas').getAttribute(`data-${name}`);
const saved = () => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);
const poses = async () => JSON.parse(await data('actor-poses'));
const point = async id => JSON.parse(await data('object-screen-positions')).find(p => p.id === id);
const ready = () => page.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 });
async function seek(frame) { await page.getByLabel('Timeline frame', { exact: true }).fill(String(frame)); await page.waitForFunction(f => document.querySelector('canvas').dataset.frame === String(f), frame); }
async function drag(p, dx, dy, cancel = false) { await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + dx, p.y + dy, { steps: 8 }); if (cancel) await page.keyboard.press('Escape'); await page.mouse.up(); }
async function capture(name) { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => { const menu = document.querySelector('[role=menu]')?.getBoundingClientRect(); return !menu || (menu.left >= 0 && menu.right <= innerWidth && menu.top >= 0 && menu.bottom <= innerHeight); }); await page.screenshot({ path: `${dir}/${name}.png` }); }
async function menuAction(name) { await page.getByRole('menuitem', { name, exact: true }).click(); }
async function more() { await page.getByRole('button', { name: 'More actions', exact: true }).click(); }
const audits = [];
try {
  await page.goto(process.env.SHOWCAM_URL || 'http://localhost:3000'); await ready();
  await page.getByRole('button', { name: 'Actors', exact: true }).click();
  await page.getByRole('button', { name: 'Add actor', exact: true }).click();
  const id = (await poses())[0].id;
  await page.getByRole('button', { name: 'Frame actor', exact: true }).click();
  await more(); await menuAction('Move object');
  await seek(49);
  const before = await saved(); const camera = await data('camera-position'); const p = await point(id);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 55, p.y + 8, { steps: 8 });
  await page.waitForFunction(initial => JSON.stringify(JSON.parse(document.querySelector('canvas').dataset.actorPoses)[0].position) !== JSON.stringify(initial), before.actors[0].marks[0].position);
  assert.deepEqual(await saved(), before, 'drag preview is not saved');
  await page.mouse.up();
  await page.waitForFunction(k => JSON.parse(localStorage.getItem(k)).actors[0].marks.length === 2, key);
  const moved = await saved(); assert.equal(moved.actors[0].marks[1].time, 2);
  assert.equal(await data('camera-position'), camera, 'drag does not orbit');
  await drag(await point(id), -40, 10, true);
  assert.deepEqual(await saved(), moved, 'Escape cancels without saving');
  assert.deepEqual((await poses())[0].position, moved.actors[0].marks[1].position, 'Escape restores the rendered pose');
  console.log('Actor body drag, playhead insertion and cancellation passed');
  // Rotate on the visible Y ring, using the same camera projection as the control.
  await page.getByRole('radio', { name: 'Rotate', exact: true }).check();
  const a = (await poses())[0];
  const cam = new THREE.PerspectiveCamera(Number(await data('camera-fov')), 1440 / 900, .05, 400);
  cam.position.fromArray((await data('camera-position')).split(',').map(Number)); cam.quaternion.fromArray((await data('camera-rotation')).split(',').map(Number)); cam.updateMatrixWorld();
  const origin = new THREE.Vector3(...a.position), scale = origin.distanceTo(cam.position) * Math.min(1.9 * Math.tan(Math.PI * cam.fov / 360), 7) / 7;
  let rotated = false;
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const screen = origin.clone().add(new THREE.Vector3(Math.cos(angle) * scale, 0, Math.sin(angle) * scale)).project(cam);
    await drag({ x: (screen.x + 1) * 720, y: (1 - screen.y) * 450 }, 28, -24);
    if (Math.abs((await saved()).actors[0].marks[1].heading - a.heading) > .01) { rotated = true; break; }
  }
  assert.ok(rotated, 'mouse rotation changes heading');
  console.log('Actor ring rotation passed');
  await more(); await capture('desktop-context');
  await page.keyboard.press('End'); await expect(page.getByRole('menuitem', { name: 'Delete actor', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0);
  await more(); await menuAction('Duplicate actor'); await expect.poll(async () => (await saved()).actors.length).toBe(2);
  const duplicate = (await saved()).actors[1]; await drag(await point(duplicate.id), 30, 5);
  assert.notDeepEqual((await saved()).actors[1].marks, duplicate.marks, 'coincident selected duplicate can be dragged');
  await more(); await menuAction('Delete actor'); await expect.poll(async () => (await saved()).actors.length).toBe(1);
  await page.getByRole('button', { name: 'Undo object edit', exact: true }).click(); await expect.poll(async () => (await saved()).actors.length).toBe(2);
  // Imported chair placement supports body drag, keyboard fields, save/reload, and reset.
  await page.getByRole('searchbox', { name: 'Find an object', exact: true }).fill('Group');
  const row = page.locator('.object-row').filter({ has: page.locator('strong', { hasText: /^Lounge chair · Group$/ }) });
  await row.click(); await row.click({ button: 'right' });
  await menuAction('Frame object'); await more(); await menuAction('Move object');
  const imported = await point('Group'); await drag(imported, 40, -15);
  await expect.poll(async () => (await saved()).placements?.find(p => p.id === 'Group')?.offset.some(v => Math.abs(v) > .01)).toBe(true);
  await capture('desktop-placement');
  const placed = await saved();
  await page.reload(); await ready(); assert.deepEqual((await saved()).placements, placed.placements);
  await page.getByRole('searchbox', { name: 'Find an object', exact: true }).fill('Group'); await row.click();
  await page.getByLabel('X offset', { exact: true }).fill('2'); await page.getByLabel('X offset', { exact: true }).press('Enter');
  await expect.poll(async () => (await saved()).placements.find(p => p.id === 'Group').offset[0]).toBe(2);
  await page.getByRole('button', { name: 'Reset transform', exact: true }).click();
  assert.equal((await saved()).placements.length, 0);
  console.log('Imported placement drag, reload, numeric editing and reset passed');
  // Right-drag remains pan and does not invoke an object action menu.
  await page.getByRole('radio', { name: 'Select', exact: true }).check();
  const beforePan = await data('camera-position');
  await page.mouse.move(740, 430); await page.mouse.down({ button: 'right' }); await page.mouse.move(800, 450, { steps: 6 }); await page.mouse.up({ button: 'right' });
  await expect(page.getByRole('menu')).toHaveCount(0);
  assert.notEqual(await data('camera-position'), beforePan, 'right drag pans the camera');
  await more(); audits.push({ name: 'desktop-menu', violations: (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Object actions', exact: true }).click(); await menuAction('Move object');
  await capture('mobile-tools');
  await more(); await capture('mobile-context');
  audits.push({ name: 'mobile-menu', violations: (await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await writeFile(`${dir}/audit.json`, JSON.stringify({ errors, audits }, null, 2));
  assert.deepEqual(errors, []); assert.ok(audits.every(a => !a.violations.length));
  console.log('Object actions: transforms, cancellation, undo, persistence, context keyboard and accessibility passed.');
} finally { await browser.close(); }
