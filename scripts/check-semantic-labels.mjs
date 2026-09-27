import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Stub the AI response: never sends scene data to an external model.
const dir = '/private/tmp/flythru-semantic-labels';
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let captured = null;
  let requests = 0;
  let delay = 0;
  await page.route('**/api/semantic-labels', async route => {
    requests++;
    captured = route.request().postDataJSON();
    const object = captured.views[0].objects[0];
    const region = { label: 'Test architectural section', category: 'wall', entityIds: [object.id], confidence: .8, evidence: 'Simulated response for local integration testing.', viewIds: [captured.views[0].id] };
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    await route.fulfill({ json: { regions: [region] } });
  });
  await page.route('**/api/flight-plan', route => route.fulfill({ status: 503, json: { error: 'Disabled for local semantic UI test.' } }));
  await page.goto('http://localhost:3000/editor?scene=pavilion-v1');
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  // Background labeling must start and save without ever opening the panel.
  await page.waitForFunction(() => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes('Test architectural section')), undefined, { timeout: 45000 });
  await page.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'AI labels', exact: true }).click();
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
  await page.waitForTimeout(1500);
  assert.equal(requests, 1, 'Saved labels must not be regenerated on reload.');
  assert.equal(await page.getByRole('checkbox', { name: 'Reviewed label and extent' }).isChecked(), false);
  await page.screenshot({ path: `${dir}/labels.png` });
  await page.waitForFunction(() => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes('Reviewed section')));
  await page.reload(); await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'AI labels', exact: true }).click();
  await page.getByRole('button', { name: /Reviewed section/ }).waitFor();
  await page.waitForTimeout(1500);
  assert.equal(requests, 1, 'Reload preserves existing labels.');
  delay = 1500;
  await page.getByRole('button', { name: 'Regenerate labels', exact: true }).click();
  await page.getByRole('button', { name: 'Close semantic labels', exact: true }).click();
  await page.waitForFunction(() => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes('Test architectural section')), undefined, { timeout: 45000 });
  await page.getByRole('button', { name: 'Scene layers', exact: true }).click();
  await page.getByRole('button', { name: 'AI labels', exact: true }).click();
  await page.getByRole('button', { name: /Test architectural section/ }).waitFor();
  const panel = page.getByRole('complementary', { name: 'Semantic labels', exact: true });
  await panel.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: /Reviewed section/ }).waitFor();
  await page.waitForTimeout(1500);
  assert.equal(requests, 2, 'Closing does not abort, and undo does not regenerate.');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ candidates: captured.candidates.length, views: captured.views.length, saved: true, highlighted: selected, artifacts: dir, errors }));
} finally { await browser.close(); }
