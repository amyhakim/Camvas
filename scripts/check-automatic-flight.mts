import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import type { ProjectDocument } from '../src/contracts';
import { semanticRevision } from '../src/features/semantics/model';

// Real viewport capture + mocked model. No scene data leaves the local test browser.
const document: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Automation fixture', actors: [], shot: null };
document.semantics = { version: 1, sceneId: document.sceneId, revision: semanticRevision(document), regions: [{
  id: 'semantic:pool', label: 'Reflecting pool', category: 'water', entityIds: ['water_plane_still'], min: [-25.28, 1.29, 1.29], max: [-4.27, 1.30, 11.20], confidence: 1, reviewed: true, evidence: 'Local fixture', viewIds: ['fixture-view'],
}] };
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let calls = 0, reviews = 0, reject = false, delayed = false;
  const frames: { time: number; image: string }[] = [];
  await page.addInitScript(d => { if (!localStorage.getItem('automation-seeded')) { localStorage.setItem('showcam-project:v1:pavilion-v1', JSON.stringify(d)); localStorage.setItem('automation-seeded', 'yes'); } }, document);
  await page.route('**/api/flight-plan', async route => {
    const body = route.request().postDataJSON(); calls++;
    const envelope = { sceneId: body.snapshot.sceneId, revision: body.snapshot.revision };
    if (delayed) await new Promise(resolve => setTimeout(resolve, 1200));
    if (body.stage === 'plan') await route.fulfill({ json: { ...envelope, plan: {
      name: 'Automated pool pass', narrative: 'Show the reflecting pool, then settle and zoom.',
      controls: [[-12, 3.5, 9], [-9, 3.5, 9], [-6, 3.5, 9]].map(position => ({ position, gazeTargetId: 'semantic:pool', gazeMode: 'subject' })),
      beats: [{ label: 'Pool approach', controlIndex: 0, targetId: 'semantic:pool' }, { label: 'Settle', controlIndex: 2, targetId: 'semantic:pool' }],
      cruiseSpeed: .8, focalLength: 22, finalFocalLength: 35, zoomSeconds: 6, uncertainties: [],
    } } });
    else { reviews++; frames.push(...body.frames); await route.fulfill({ json: { ...envelope, review: { approved: !reject, notes: [reject ? 'Framing rejected by mocked reviewer.' : 'Mocked visual approval.'] } } }); }
  });
  await page.goto('http://localhost:3000/editor?scene=pavilion-v1');
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.locator('#shot-camera').selectOption('Camera');
  await page.getByRole('button', { name: 'Camera move', exact: true }).click();
  await expect(page.getByText('Saved automatically after geometry, motion and visual checks.', { exact: true })).toBeVisible({ timeout: 60000 });
  assert.equal(calls, 2); assert.equal(reviews, 1); assert.ok(frames.length >= 3);
  assert.ok(frames.every(f => f.image.length > 10000));
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('showcam-project:v1:pavilion-v1')!));
  await expect.poll(async () => (await stored()).shot?.name).toBe('Automated pool pass');
  assert.equal((await stored()).semantics.regions.length, 1);
  const savedDocument = await stored();
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('showcam-flight-backup:v1:') && JSON.parse(localStorage.getItem(k)!).shot === null)));
  // Reopening an existing shot must not issue a new model request or replace it.
  const reopened = await browser.newPage();
  let unexpected = 0;
  await reopened.addInitScript(d => localStorage.setItem('showcam-project:v1:pavilion-v1', JSON.stringify(d)), savedDocument);
  await reopened.route('**/api/flight-plan', route => { unexpected++; return route.fulfill({ status: 503, json: { error: 'Unexpected automatic request' } }); });
  await reopened.goto('http://localhost:3000/editor?scene=pavilion-v1');
  await reopened.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await reopened.waitForTimeout(1500); assert.equal(unexpected, 0);
  await reopened.close();
  await mkdir('/private/tmp/flythru-automatic-flight', { recursive: true });
  await writeFile('/private/tmp/flythru-automatic-flight/evidence.jpg', Buffer.from(frames[0].image.split(',')[1], 'base64'));
  await page.screenshot({ path: '/private/tmp/flythru-automatic-flight/saved.png' });
  await page.getByRole('button', { name: 'Undo generated shot' }).click();
  await expect.poll(async () => (await stored()).shot).toBeNull();
  await page.waitForTimeout(1500); assert.equal(calls, 2, 'Undo must not auto-generate again');
  reject = true;
  await page.getByRole('button', { name: 'Generate smooth shot' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '3 attempts' })).toBeVisible({ timeout: 90000 });
  assert.equal(reviews, 4); assert.equal((await stored()).shot, null);
  reject = false; delayed = true;
  await page.getByRole('button', { name: 'Generate smooth shot' }).click();
  await page.getByRole('button', { name: 'Cancel generation' }).click();
  await page.waitForTimeout(1600); assert.equal((await stored()).shot, null);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ calls, reviews, evidenceFrames: frames.length, automaticSave: true, undo: true, rejectedReviewPreservedShot: true, cancelled: true, errors }));
} finally { await browser.close(); }
