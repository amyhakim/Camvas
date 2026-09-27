import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { POST } from '../app/api/director/route';

test('Director creates or resumes a thread and pins every turn to Astra Medium', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'director-session-'));
  const executable = path.join(directory, 'codex-fixture.mjs');
  const log = path.join(directory, 'requests.jsonl');
  const before = process.env.CODEX_BIN;
  await writeFile(executable, `#!/usr/bin/env node
import readline from 'node:readline';
import { appendFileSync } from 'node:fs';
const send = value => process.stdout.write(JSON.stringify(value) + '\\n');
readline.createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  appendFileSync(${JSON.stringify(log)}, line + '\\n');
  if (message.method === 'initialize') send({ id: message.id, result: {} });
  if (message.method === 'thread/start' || message.method === 'thread/resume') send({ id: message.id, result: { thread: { id: message.params.threadId || 'thread_project_fixture' } } });
  if (message.method === 'turn/start') {
    send({ id: message.id, result: {} });
    send({ method: 'item/completed', params: { item: { type: 'agentMessage', text: JSON.stringify({ message: 'Ready', searchQuery: null, actions: [] }) } } });
    send({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
  }
});
`, { mode: 0o755 });
  process.env.CODEX_BIN = executable;
  try {
    for (const threadId of [null, 'thread_project_fixture']) {
      const response = await POST(new Request('http://localhost:3000/api/director', { method: 'POST', headers: { host: 'localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Continue', threadId }) }));
      assert.equal(response.status, 200);
      const events = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
      assert.equal(events.find(event => event.type === 'thread')?.threadId, 'thread_project_fixture');
      assert.equal(events.at(-1).type, 'done');
    }
    const calls = (await readFile(log, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(calls.filter(call => call.method === 'thread/start').length, 1);
    assert.equal(calls.find(call => call.method === 'thread/resume').params.threadId, 'thread_project_fixture');
    const turns = calls.filter(call => call.method === 'turn/start');
    assert.equal(turns.length, 2);
    for (const turn of turns) {
      assert.equal(turn.params.model, 'gpt-6-astra');
      assert.equal(turn.params.effort, 'medium');
      assert.equal(turn.params.threadId, 'thread_project_fixture');
    }
  } finally {
    if (before === undefined) delete process.env.CODEX_BIN; else process.env.CODEX_BIN = before;
    await rm(directory, { recursive: true, force: true });
  }
});
