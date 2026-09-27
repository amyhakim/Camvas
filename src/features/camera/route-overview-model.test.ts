import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editedDraftFixture } from './fixtures';
import { compileShot } from './model';
import { distanceToRouteBox, fitRouteView, optimizeCameraRoute, routePoint, sampleCameraRoute } from './route-overview-model';

test('top view follows the evaluated camera path with world -Z toward the top', () => {
  const samples = sampleCameraRoute(editedDraftFixture);
  const view = fitRouteView(samples, []);
  assert.deepEqual(samples[0].pose.position, compileShot(editedDraftFixture)(0).position);
  assert.deepEqual(samples.at(-1)?.pose.position, compileShot(editedDraftFixture)(6).position);
  assert.ok(routePoint(view, [0, 2, -1])[1] < routePoint(view, [0, 2, 1])[1]);
});

test('local route refinement reduces box conflicts and keeps endpoints fixed', () => {
  const box = { min: [3.5, 1.5, 7.5] as [number, number, number], max: [4.5, 2.5, 8.4] as [number, number, number] };
  assert.ok(distanceToRouteBox([4, 2, 8], box) < 0);
  const original = structuredClone(editedDraftFixture);
  const result = optimizeCameraRoute(editedDraftFixture, [box]);
  assert.ok(result);
  assert.ok(result.after <= result.before);
  for (const time of [0, 6]) {
    const actual: [number, number, number] = compileShot(result.shot)(time).position;
    const expected: [number, number, number] = compileShot(original)(time).position;
    assert.ok(actual.every((value, axis) => Math.abs(value - expected[axis]) < 1e-9));
  }
  assert.deepEqual(editedDraftFixture, original);
});
