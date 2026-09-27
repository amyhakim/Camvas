import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDestinationAnchorId, parseOptimizationJob, parsePlanShotRequest, parseShotSettings } from './contracts';

test('planning request preserves the project revision', () => {
  const value = parsePlanShotRequest({ projectId: 'demo', revision: 'rev-7', prompt: 'slow push in', sceneDescription: 'A pavilion', subject: { subjectId: 'chair', subjectName: 'Chair', min: [0, 0, 0], max: [1, 1, 1], cameraPosition: [2, 2, 2] }, semanticAnchors: [{ id: 'lounge', label: 'Main lounge', spaceId: 'interior', tags: ['chairs'] }] });
  assert.equal(value.revision, 'rev-7');
  assert.equal(value.semanticAnchors?.[0].id, 'lounge');
});

test('semantic destinations are constrained to the supplied scene graph', () => {
  assert.equal(parseDestinationAnchorId('lounge', new Set(['lounge'])), 'lounge');
  assert.throws(() => parseDestinationAnchorId('roof', new Set(['lounge'])), /unknown semantic destination/);
  assert.throws(() => parsePlanShotRequest({ projectId: 'demo', revision: 'rev-7', prompt: 'move', sceneDescription: 'scene', subject: { subjectId: 'chair', subjectName: 'Chair', min: [0, 0, 0], max: [1, 1, 1], cameraPosition: [2, 2, 2] }, semanticAnchors: [{ id: 'same', label: 'A', spaceId: 'room', tags: [] }, { id: 'same', label: 'B', spaceId: 'room', tags: [] }] }), /unique ids/);
});

test('shot settings reject presets outside the deterministic engine', () => {
  assert.throws(() => parseShotSettings({ presetId: 'invented', duration: 4, focalLength: 35, sensor: 'fullFrame', framing: 'full' }, new Set(['dolly-in'])), /unknown camera preset/);
});

test('worker results require the source project revision', () => {
  assert.throws(() => parseOptimizationJob({ id: 'job-1', projectId: 'demo', status: 'succeeded' }), /revision/);
  assert.equal(parseOptimizationJob({ id: 'job-1', projectId: 'demo', revision: 'rev-7', status: 'running', progress: 2 }).progress, 1);
});
