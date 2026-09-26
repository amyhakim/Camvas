import assert from 'node:assert/strict';
import test from 'node:test';
import { LoadQueue } from './load-queue';

test('model work is bounded and a failed download releases its slot', async () => {
  const queue = new LoadQueue(2), started: number[] = [];
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = queue.run(async () => { started.push(1); await gate; throw new Error('download failed'); });
  const second = queue.run(async () => { started.push(2); await gate; return 2; });
  const third = queue.run(async () => { started.push(3); return 3; });
  await Promise.resolve(); assert.deepEqual(started, [1, 2]);
  release(); await assert.rejects(first, /download failed/);
  assert.deepEqual(await Promise.all([second, third]), [2, 3]);
  assert.deepEqual(started, [1, 2, 3]);
});

test('viewport teardown rejects queued work without starting it', async () => {
  const queue = new LoadQueue(1);
  let release!: () => void, ran = false;
  const active = queue.run(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = queue.run(async () => { ran = true; });
  const rejection = assert.rejects(pending, { name: 'AbortError' });
  await Promise.resolve(); queue.close(); release(); await active; await rejection;
  assert.equal(ran, false);
  await assert.rejects(queue.run(async () => 1), { name: 'AbortError' });
});
