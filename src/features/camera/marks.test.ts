import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileShot } from './model';
import { addMark, manualShot, markFromView, removeMark, retimeMark, setCut, shotStarts } from './marks';

const view = { position: [0, 1, 3] as [number, number, number], target: [0, 1, 0] as [number, number, number], fov: 30 };

test('a hand-built shot reproduces the current view and focuses on the orbit point', () => {
  const shot = manualShot(view, null, 2);
  const pose = compileShot(shot)(1);
  pose.position.forEach((value, i) => assert.ok(Math.abs(value - view.position[i]) < 1e-9));
  assert.ok(Math.abs(pose.pan) < 1e-9 && Math.abs(pose.tilt) < 1e-9);
  assert.ok(Math.abs(pose.fov - 30) < .2, `fov ${pose.fov}`);
  assert.ok(Math.abs(pose.focus! - 3) < 1e-9);
});

test('a cut holds the previous shot, then jumps without travelling', () => {
  let shot = manualShot(view, null, 2);
  shot = addMark(shot, { ...markFromView({ ...view, position: [0, 1, 5] }, 2, 'fullFrame') });
  shot = addMark(shot, { ...markFromView({ position: [4, 1, 0], target: [0, .5, 0], fov: 20 }, 2.5, 'fullFrame'), cut: true });
  shot = addMark(shot, markFromView({ position: [4, 2, 0], target: [0, .5, 0], fov: 20 }, 4, 'fullFrame'));
  const evaluate = compileShot(shot);
  // Just before the cut the camera is still at the end of shot one (z = 5), not drifting toward x = 4.
  const before = evaluate(2.49);
  assert.deepEqual(before.position.map(v => Math.round(v * 1000) / 1000), [0, 1, 5]);
  const after = evaluate(2.5);
  assert.deepEqual(after.position.map(v => Math.round(v * 1000) / 1000), [4, 1, 0]);
  // The second shot aims at its own point and focuses on it.
  assert.ok(Math.abs(after.focus! - Math.hypot(4, .5)) < 1e-6);
  assert.deepEqual(shotStarts(shot), [0, 2.5]);
});

test('mark editing keeps times ordered and the duration on the last mark', () => {
  let shot = manualShot(view, null, 2);
  shot = addMark(shot, markFromView(view, 3, 'fullFrame'));
  assert.equal(shot.settings.duration, 3);
  shot = retimeMark(shot, 2, 3.5);
  assert.equal(shot.settings.duration, 3.5);
  assert.throws(() => retimeMark(shot, 1, 4));
  shot = setCut(shot, 2, true);
  assert.equal(shot.marks[2].cut, true);
  assert.equal(setCut(shot, 2, false).marks[2].cut, undefined);
  assert.throws(() => setCut(shot, 0, true));
  shot = removeMark(shot, 2);
  assert.equal(shot.settings.duration, 2);
  assert.throws(() => removeMark(shot, 1), /two marks/);
});
