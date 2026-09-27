import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const browser = await chromium.launch({ executablePath: process.env.SHOWCAM_CHROME_PATH, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
const requests = [];
let failNext = false;
let nextThread = 0;
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/director', route => {
  const body = route.request().postDataJSON();
  requests.push(body);
  if (failNext) { failNext = false; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary outage' }) }); }
  const threadId = body.threadId || `thread_project_${++nextThread}`;
  return route.fulfill({ contentType: 'application/x-ndjson', body: [{ type: 'thread', threadId }, { type: 'actions', actions: [] }, { type: 'done', text: 'Conversation continued.' }].map(event => JSON.stringify(event)).join('\n') + '\n' });
});
async function open(project, entry = 'scene:one') {
  await page.goto(`${base}/?scene=pavilion-v1&project=${project}&entry=${encodeURIComponent(entry)}`);
  await expect(page.locator('#director-prompt')).toBeEnabled();
}
async function send() {
  await page.locator('#director-prompt').fill('Continue our conversation');
  await page.getByRole('button', { name: 'Send direction', exact: true }).click();
  await expect(page.locator('#director-prompt')).toBeEnabled();
}
const stored = project => page.evaluate(project => localStorage.getItem(`showcam-director:v1:project:${project}`), project);
try {
  await page.goto(base);
  await page.evaluate(() => {
    const document = { format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Session test', shot: null, actors: [] };
    for (const id of ['session-a', 'session-b']) localStorage.setItem(`showcam-project:item:v1:${id}`, JSON.stringify({ format: 'showcam-collection', version: 1, name: id, scenes: [{ id: 'scene:one', name: 'First scene', document }, { id: 'scene:two', name: 'Second scene', document }] }));
  });
  await open('session-a'); await send();
  assert.equal(requests.at(-1).threadId, null);
  const a = await stored('session-a');
  assert.ok(a);
  await page.reload(); await expect(page.locator('#director-prompt')).toBeEnabled(); await send();
  assert.equal(requests.at(-1).threadId, a, 'refresh resumes saved project thread');
  failNext = true; await send();
  await expect(page.getByRole('alert').filter({ hasText: 'Temporary outage' })).toBeVisible();
  await send(); assert.equal(requests.at(-1).threadId, a, 'retry keeps the same thread');
  await open('session-a', 'scene:two'); await send();
  assert.equal(requests.at(-1).threadId, a, 'scenes in one project share a conversation');
  await open('session-b'); await send();
  assert.equal(requests.at(-1).threadId, null, 'another project starts independently');
  const b = await stored('session-b'); assert.notEqual(a, b);
  await open('session-a'); await send(); assert.equal(requests.at(-1).threadId, a);
  await page.getByRole('button', { name: 'New Director conversation', exact: true }).click();
  assert.equal(await stored('session-a'), null);
  assert.equal(await stored('session-b'), b, 'reset only affects the current project');
  await send(); assert.equal(requests.at(-1).threadId, null);
  assert.notEqual(await stored('session-a'), a);
  assert.deepEqual(errors, []);
  console.log('Project session persistence, refresh, retry, scene sharing, isolation, and explicit reset passed (mocked Director responses).');
} finally { await browser.close(); }
