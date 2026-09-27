import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { FlightPlanningSnapshot } from '@/contracts/flight-plan';
import { POST } from './route';

const snapshot: FlightPlanningSnapshot = {
  sceneId: 'test', revision: 'v1', collisionCoverage: 'uncomputed',
  landmarks: [{ id: 'flight:a', label: 'Start', position: [0, 2, 0] }, { id: 'flight:b', label: 'Reveal', position: [2, 2, 0] }],
  nodes: [{ id: 'chair', label: 'Chair', kind: 'mesh', position: [2, 1, 1] }], edges: [], actors: [], currentShot: null,
};

test('background flight route sends a read-only structured turn and returns a proposal', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'showcam-flight-plan-'));
  const executable = join(directory, 'fake-codex');
  writeFileSync(executable, `#!/usr/bin/env node
let buffer = '';
process.stdin.on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\\n')) >= 0) {
    const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
    const call = JSON.parse(line);
    if (call.method === 'initialize') process.stdout.write(JSON.stringify({ id: 0, result: {} }) + '\\n');
    if (call.method === 'thread/start') process.stdout.write(JSON.stringify({ id: 1, result: { thread: { id: 'thread-test' } } }) + '\\n');
    if (call.method === 'turn/start') {
      if (call.params.sandboxPolicy.type !== 'readOnly') process.exit(2);
      const plan = { arc: 'Approach and reveal', waypoints: [
        { landmarkId: 'flight:a', beat: 'Establish', arrivalTime: 0, gazeTargetId: 'chair', gazeNote: 'Wide', blocking: '', uncertainty: 'Clearance unknown' },
        { landmarkId: 'flight:b', beat: 'Reveal', arrivalTime: 4, gazeTargetId: 'chair', gazeNote: 'Show chair', blocking: '', uncertainty: 'Clearance unknown' }
      ], reviewNotes: ['Preview the passage'] };
      process.stdout.write(JSON.stringify({ method: 'item/completed', params: { item: { type: 'agentMessage', text: JSON.stringify(plan) } } }) + '\\n');
      process.stdout.write(JSON.stringify({ method: 'turn/completed', params: { turn: { status: 'completed' } } }) + '\\n');
    }
  }
});
`, { mode: 0o755 });
  const previous = process.env.CODEX_BIN;
  process.env.CODEX_BIN = executable;
  try {
    const request = new Request('http://localhost:3000/api/flight-plan', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, body: JSON.stringify(snapshot) });
    const response = await POST(request);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.revision, 'v1');
    assert.deepEqual(body.waypoints.map((point: { landmarkId: string }) => point.landmarkId), ['flight:a', 'flight:b']);
  } finally {
    if (previous === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = previous;
  }
});
