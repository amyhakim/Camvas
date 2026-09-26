import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cameraShotFixture } from '../../contracts/fixtures';
import { editedDraftFixture, shotFixture } from './fixtures';
import { compileShot, createPathPreview, shotEndFrame } from './model';

test('a draft starts at time zero and exposes a plain serializable path', () => {
  const evaluate = compileShot(shotFixture);
  const path = createPathPreview(shotFixture);
  assert.deepEqual(path.points[0], evaluate(0).position);
  assert.deepEqual(path.points.at(-1), evaluate(shotFixture.settings.duration).position);
  assert.equal(shotEndFrame(shotFixture, 24), 145);
  assert.deepEqual(JSON.parse(JSON.stringify(path)), path);
  assert.deepEqual(compileShot(cameraShotFixture)(0).position, [10, 5, 7]);
  assert.deepEqual(compileShot(cameraShotFixture)(6).position, [14, 5, 3]);
});

test('an edited draft holds its authored pose and supports random seeking without subject tracking', () => {
  const original = structuredClone(editedDraftFixture);
  const evaluate = compileShot(editedDraftFixture);
  const held = evaluate(3);
  assert.deepEqual(held.position, [4, 2, 8]);
  assert.equal(held.pan, .8);
  assert.equal(held.tilt, -.2);
  assert.equal(held.roll, .3);
  assert.equal(held.focalLength, 50);
  assert.ok(Number.isFinite(held.fov) && held.fov > 0);
  for (const time of [3.2, 4.49, 4.5]) assert.deepEqual(evaluate(time), held);

  // Halfway through travel after the hold, all authored values resume together.
  const moving = evaluate(5.25);
  assert.deepEqual(moving.position, [6, 2, 8]);
  assert.equal(moving.pan, 1);
  assert.equal(moving.tilt, 0);
  assert.equal(moving.roll, .4);
  assert.equal(moving.focalLength, 65);
  assert.ok(moving.fov < held.fov);

  const times = [0, 1.5, 3, 4.49, 4.5, 5.25, 6];
  const poses = new Map(times.map(time => [time, evaluate(time)]));
  for (const time of [6, 3, 5.25, 0, 4.49, 1.5, 4.5, 6, 5.25, 3]) {
    assert.deepEqual(evaluate(time), poses.get(time), `Pose changed after seeking to ${time}s`);
  }
  assert.deepEqual(evaluate(-10), poses.get(0));
  assert.deepEqual(evaluate(100), poses.get(6));
  assert.deepEqual(editedDraftFixture, original);
});
