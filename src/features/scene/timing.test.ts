import assert from 'node:assert/strict';
import test from 'node:test';
import { playbackManifest, sourceTime } from './timing';
import { manifestFixture, animatedCameraFixture } from './fixtures';
import { entityPosition } from './data';

test('30 FPS retains imported time origin, sample times, and duration within one output frame', () => {
  const original = { ...manifestFixture, fps: 24, objects: [animatedCameraFixture] };
  const result = playbackManifest(original);
  assert.equal(result.fps, 30);
  assert.equal(sourceTime(1, result), 1 / 24);
  assert.equal(sourceTime(31, result), 1 + 1 / 24);
  assert.ok(Math.abs((result.frameEnd - 1) / 30 - (original.frameEnd - 1) / 24) < 1 / 30);
  original.objects[0].samples!.forEach((sample, i) => {
    const converted = result.objects[0].samples![i];
    assert.ok(Math.abs(sourceTime(converted.frame, result) - sample.frame / 24) < 1e-10);
    assert.deepEqual(entityPosition(result.objects[0], converted.frame), sample.position);
  });
  assert.equal(original.fps, 24);
  assert.deepEqual(playbackManifest(result), result);
});
