import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Stub the AI response: never sends scene data to an external model.
const dir = '/private/tmp/flythru-semantic-persistence';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let captured = null;
  await page.route('**/api/semantic-labels', async route => {
    captured = route.request().postDataJSON();
    const object = captured.views[0].objects[0];
    const region = { label: 'Test architectural section', category: 'wall', entityIds: [object.id], confidence: .8, evidence: 'Simulated response for local integration testing.', viewIds: [captured.views[0].id] };
    await route.fulfill({ json: { regions: [region] } });
  });
  await page.route('**/api/flight-plan', route => route.fulfill({ status: 503, json: { error: 'Disabled for local semantic UI test.' } }));
  const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
  const projectId = 'semantic-persistence-check';
  const projectKey = `showcam-project:item:v1:${projectId}`;
  await page.goto(base);
  await page.evaluate(key => {
    const document = { format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Label persistence', actors: [], shot: null };
    localStorage.setItem(key, JSON.stringify({ format: 'showcam-collection', version: 1, name: 'Label persistence', scenes: ['first', 'second'].map(id => ({ id, name: id, document })) }));
  }, projectKey);
  const url = `${base}/editor?scene=pavilion-v1&project=${projectId}&entry=first`;
  await page.goto(url);
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'AI labels', exact: true }).click();
  await page.getByRole('button', { name: 'Auto-label scene', exact: true }).click();
  await page.getByRole('button', { name: /Test architectural section/ }).waitFor({ timeout: 45000 });
  assert.equal(captured.views.length, 4);
  assert.ok(captured.candidates.length > 100);
  assert.ok(captured.views.every(v => v.image.startsWith('data:image/jpeg;base64,') && v.objects.length > 0));
  await writeFile(`${dir}/view-1.jpg`, Buffer.from(captured.views[0].image.split(',')[1], 'base64'));
  const selected = captured.views[0].objects[0].id;
  await page.waitForFunction(id => document.querySelector('canvas')?.dataset.semanticSelection === id, selected);
  await page.getByRole('checkbox', { name: 'Reviewed label and extent' }).check();
  await page.getByRole('textbox', { name: 'Region name' }).fill('Reviewed section');
  await page.getByRole('textbox', { name: 'Region name' }).blur();
  await page.getByRole('button', { name: /Reviewed section/ }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Reviewed label and extent' }).isChecked(), false);
  await page.getByRole('checkbox', { name: 'Reviewed label and extent' }).check();
  await page.screenshot({ path: `${dir}/labels.png` });
  await page.waitForFunction(() => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes('Reviewed section')));
  await page.reload(); await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'AI labels', exact: true }).click();
  await page.getByRole('button', { name: /Reviewed section/ }).waitFor();
  await page.getByRole('button', { name: /Reviewed section/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Reviewed label and extent' })).toBeChecked();
  await page.goto(url.replace('entry=first', 'entry=second'));
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'AI labels', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Auto-label scene', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Reviewed section/ })).toHaveCount(0);
  await page.goto(url);
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  let directorState;
  await page.route('**/api/director', route => {
    directorState = JSON.parse(route.request().postDataJSON().context);
    return route.fulfill({ contentType: 'application/x-ndjson', body: '{"type":"actions","actions":[]}\n{"type":"done","text":"Labels received."}\n' });
  });
  await page.locator('#director-prompt').fill('Describe the saved labels');
  await page.getByRole('button', { name: 'Send direction', exact: true }).click();
  await expect(page.locator('#director-prompt')).toBeEnabled();
  assert.equal(directorState.semanticRegions[0].label, 'Reviewed section');
  assert.equal(directorState.semanticRegions[0].reviewed, true);
  const collection = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), projectKey);
  assert.equal(collection.scenes[0].document.semantics.regions[0].label, 'Reviewed section');
  assert.equal(collection.scenes[1].document.semantics, undefined);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ candidates: captured.candidates.length, views: captured.views.length, saved: true, highlighted: selected, artifacts: dir, errors }));
} finally { await browser.close(); }
