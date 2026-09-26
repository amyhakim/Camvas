import assert from 'node:assert/strict';
import test from 'node:test';
import type { SceneEntity } from '../contracts';
import { validateDirectorAction } from './director-action';

const objects = [
  { id: 'chair', name: 'Chair', type: 'Mesh' },
  { id: 'camera', name: 'Camera', type: 'Camera' },
] as SceneEntity[];

test('accepts a bounded world-space object move', () => {
  assert.deepEqual(validateDirectorAction({ type: 'moveObject', targetId: 'chair', delta: [1, 0, -2] }, objects, [], 100), { type: 'moveObject', targetId: 'chair', delta: [1, 0, -2] });
  assert.throws(() => validateDirectorAction({ type: 'moveObject', targetId: 'chair', delta: [Infinity, 0, 0] }, objects, [], 100));
  assert.throws(() => validateDirectorAction({ type: 'moveObject', targetId: 'camera', delta: [1, 0, 0] }, objects, [], 100));
});

test('only known subjects and presets can generate a draft camera', () => {
  const action = { type: 'generateShot', targetId: 'chair', presetId: 'orbit-90-left', duration: 6, focalLength: 35, framing: 'wide' };
  assert.deepEqual(validateDirectorAction(action, objects, ['orbit-90-left'], 100), action);
  assert.throws(() => validateDirectorAction({ ...action, presetId: 'unknown' }, objects, ['orbit-90-left'], 100));
  assert.throws(() => validateDirectorAction({ ...action, targetId: 'camera' }, objects, ['orbit-90-left'], 100));
});
