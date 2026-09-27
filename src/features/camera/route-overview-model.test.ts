import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editedDraftFixture } from './fixtures';
import { compileShot } from './model';
import { distanceToRouteBox, fitRouteView, optimizeCameraRoute, routePoint, sampleCameraRoute } from './route-overview-model';
import { PAVILION_FLIGHT_LANDMARKS } from '../../editor/pavilion-landmarks';
import { pavilionAstraShot } from './pavilion-astra-shot';

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

test('local route refinement keeps every authored flight landmark fixed', () => {
  const shot = pavilionAstraShot(PAVILION_FLIGHT_LANDMARKS);
  const box = { min: [-7.1, 3, 7.4] as [number, number, number], max: [-6.9, 3.3, 7.6] as [number, number, number] };
  const result = optimizeCameraRoute(shot, [box], undefined, PAVILION_FLIGHT_LANDMARKS);
  assert.ok(result);
  assert.ok(result.after < result.before);
  assert.deepEqual(result.shot.anchorIds, shot.anchorIds);
  for (const landmark of PAVILION_FLIGHT_LANDMARKS) {
    assert.ok(result.shot.cinemaTraj!.positions.some(key => key.position.every((value, axis) => Math.abs(value - landmark.position[axis]) < 1e-9)));
  }
});
