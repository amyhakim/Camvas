import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3, Euler } from 'three';
import { actorBounds, actorForward } from './actors';
import { actorPoseFixture } from './fixtures';

test('actor bounds keep feet at world Y and enclose rotated proxy geometry', () => {
  for (const heading of [0, Math.PI / 2, Math.PI / 4, -Math.PI]) {
    const actor = { ...actorPoseFixture, heading };
    const bounds = actorBounds(actor);
    assert.equal(bounds.min[1], actor.position[1]);
    assert.equal(bounds.max[1], actor.position[1] + actor.height);
    for (const x of [-.18, .18]) for (const z of [-.16, .16]) {
      const corner = new Vector3(x * actor.height, 0, z * actor.height).applyEuler(new Euler(0, heading, 0)).add(new Vector3(...actor.position));
      for (const axis of [0, 2]) assert.ok(corner.getComponent(axis) >= bounds.min[axis] - 1e-9 && corner.getComponent(axis) <= bounds.max[axis] + 1e-9);
    }
  }
});
test('heading zero faces -Z and positive quarter turn faces -X', () => {
  assert.deepEqual(actorForward(0), [-0, 0, -1]);
  const forward = actorForward(Math.PI / 2);
  assert.ok(Math.abs(forward[0] + 1) < 1e-9 && Math.abs(forward[2]) < 1e-9);
});
