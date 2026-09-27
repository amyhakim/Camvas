import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SceneProp, Vector3Tuple } from '../../contracts';
import { movedProp, validateModelSource, validateProp } from './model';

const shoe: SceneProp = { id: 'prop:shoe', name: 'Shoe', source: { kind: 'primitive', shape: 'box' }, position: [2, .3, -1], rotation: [0, .35, -Math.PI / 2], size: .4,
  motion: { spin: 90, float: 0, start: 1, end: 5, pivot: .11 } };

/** World position of (0, h, 0) in the prop's frame, using the renderer's Euler YXZ order. */
function point(prop: SceneProp, h: number): Vector3Tuple {
  const [x, y, z] = prop.rotation;
  const a = -h * Math.sin(z), b = h * Math.cos(z), c = b * Math.cos(x), d = b * Math.sin(x);
  return [prop.position[0] + a * Math.cos(y) + d * Math.sin(y), prop.position[1] + c, prop.position[2] - a * Math.sin(y) + d * Math.cos(y)];
}

test('a tipped prop spins about its pivot, so it turns in place', () => {
  const centre = point(shoe, .11);
  for (const t of [0, 1.5, 3, 5, 8]) {
    const moved = movedProp(shoe, t);
    point(moved, .11).forEach((value, i) => assert.ok(Math.abs(value - centre[i]) < 1e-9, `t=${t} axis ${i}`));
  }
  assert.ok(Math.abs(movedProp(shoe, 3).rotation[1] - (.35 + Math.PI)) < 1e-9, '90°/s for 2 s is half a turn');
  // The turn holds after the window instead of snapping back.
  assert.deepEqual(movedProp(shoe, 9).rotation, movedProp(shoe, 5).rotation);
});

test('float lifts the prop inside its window and lands it after', () => {
  const floating = { ...shoe, rotation: [0, 0, 0] as Vector3Tuple, motion: { spin: 0, float: .1, start: 1, end: 3 } };
  assert.equal(movedProp(floating, 0).position[1], .3);
  assert.ok(movedProp(floating, 2).position[1] > .38);
  assert.equal(movedProp(floating, 4).position[1], .3);
  assert.throws(() => validateProp({ ...shoe, motion: { spin: 90, float: 0, start: 3, end: 2 } }), /window/);
});

test('local models are referenced by hash with no links', () => {
  const local = { provider: 'local' as const, uid: 'local-0123456789abcdef01234567', name: 'My shoe', author: 'You', authorUrl: '', license: 'Imported file', licenseUrl: '', viewerUrl: '' };
  validateModelSource(local);
  assert.throws(() => validateModelSource({ ...local, uid: 'local-nothex' }), /local model ID/);
  assert.throws(() => validateModelSource({ ...local, viewerUrl: 'https://evil.example' }), /no links/);
});
