import assert from 'node:assert/strict';
import test from 'node:test';
import { landmarkContext, landmarkLabel, nextLandmarkLabel, withLandmarkEdit } from './landmarks';
import type { ProjectDocument, SceneLandmark } from '../contracts';
import { cameraShotFixture } from '../contracts/fixtures';
const doorway: SceneLandmark = { id: 'landmark:door', label: 'Doorway', entityId: 'wall', kind: 'mesh', frame: 24, position: [2, 1.25, 5] };

test('landmarks give the agent their label, Y-up location, surface identity and frame', () => {
  assert.deepEqual(landmarkContext([doorway]), [doorway]);
  assert.deepEqual(landmarkContext([{ ...doorway, kind: 'floor', entityId: null }])[0].position, [2, 1.25, 5]);
});
test('labels are trimmed and unambiguous, and defaults avoid existing labels', () => {
  assert.equal(landmarkLabel('  Back   door ', [doorway], doorway.id), 'Back door');
  assert.equal(landmarkLabel('Doorway', [doorway], doorway.id), 'Doorway');
  assert.throws(() => landmarkLabel('doorway', [doorway], 'new'), /different label/);
  assert.throws(() => landmarkLabel(' ', [], 'new'), /1 and 48/);
  assert.equal(nextLandmarkLabel([{ ...doorway, label: 'Landmark 1' }]), 'Landmark 2');
});
test('moving a flight anchor withdraws the shot anchor claim while renaming keeps it', () => {
  const flight: SceneLandmark = { ...doorway, id: 'flight:entry', kind: 'flight', entityId: null };
  const project: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Tour', actors: [], landmarks: [flight], shot: { ...cameraShotFixture, anchorIds: [flight.id] } };
  assert.deepEqual(withLandmarkEdit(project, [{ ...flight, label: 'New entry' }]).shot?.anchorIds, [flight.id]);
  const changed = withLandmarkEdit(project, [{ ...flight, position: [3, 1.25, 5] }]);
  assert.equal(changed.shot?.anchorIds, undefined);
  assert.match(changed.shot!.name, /replan$/);
  assert.equal(withLandmarkEdit(project, []).shot?.anchorIds, undefined);
});
