import assert from 'node:assert/strict';
import test from 'node:test';
import { OccupancyBoxes, placedCollision, validateCollisionLayer, containsPoint } from './model';
import { parseProject, serializeProject } from '../project/model';
import type { CollisionLayer, ProjectDocument } from '../../contracts';

const layer: CollisionLayer = { version: 1, entityId: 'capture', sourceUrl: '/capture.sog', offset: [0, 0, 0], cellSize: .5, sampleCount: 100, reviewed: false, region: { min: [-4, -4, -4], max: [4, 4, 4] }, boxes: [{ id: 'wall', min: [0, 0, 0], max: [.5, 3, 3] }] };
test('occupied cells merge without closing an empty doorway; outside and nonfinite samples are excluded', () => {
  const builder = new OccupancyBoxes({ min: [0, 0, 0], max: [5, 3, 1] }, 1);
  for (let x = 0; x < 5; x++) for (let y = 0; y < 3; y++) {
    if (x === 2 && y < 2) continue;
    for (let n = 0; n < 3; n++) builder.add([x + .2, y + .2, .2]);
  }
  builder.add([20, 1, 1]); builder.add([NaN, 0, 0]);
  const boxes = builder.finish();
  assert.equal(builder.sampleCount, 39);
  assert.ok(boxes.length < 13);
  assert.ok(!boxes.some(box => containsPoint(box, [2.5, 1, .5])));
  assert.ok(boxes.some(box => containsPoint(box, [2.5, 2.5, .5])));
});
test('noise threshold and box limits fail explicitly rather than silently dropping obstacles', () => {
  const empty = new OccupancyBoxes({ min: [0, 0, 0], max: [2, 2, 2] }, .5);
  empty.add([.1, .1, .1]); assert.throws(() => empty.finish(), /No occupied/);
  const dense = new OccupancyBoxes({ min: [0, 0, 0], max: [24, 24, 24] }, 1);
  for (let x = 0; x < 24; x += 2) for (let y = 0; y < 24; y += 2) for (let z = 0; z < 24; z += 2) for (let n = 0; n < 3; n++) dense.add([x + .1, y + .1, z + .1]);
  assert.throws(() => dense.finish(), /400 boxes/);
  assert.throws(() => new OccupancyBoxes(layer.region, NaN), /cell size/);
});
test('project exports preserve collision review and bounds while rejecting invalid coverage', () => {
  const project: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'room', name: 'Test', actors: [], shot: null, collision: layer };
  assert.deepEqual(parseProject(serializeProject(project), 'room').collision, layer);
  assert.equal(parseProject(serializeProject({ ...project, collision: undefined }), 'room').collision, undefined);
  assert.throws(() => validateCollisionLayer({ ...layer, reviewed: true, boxes: [] }), /Invalid collision/);
  assert.throws(() => validateCollisionLayer({ ...layer, boxes: [{ ...layer.boxes[0], min: [-5, 0, 0] }] }), /Invalid collision/);
  assert.throws(() => validateCollisionLayer({ ...layer, boxes: [layer.boxes[0], layer.boxes[0]] }), /Invalid collision/);
  assert.throws(() => validateCollisionLayer({ ...layer, boxes: [{ ...layer.boxes[0], max: [0, 0, 0] }] }), /Invalid collision/);
  assert.throws(() => validateCollisionLayer({ ...layer, offset: [NaN, 0, 0] }), /Invalid collision/);
});
test('boxes and reviewed coverage follow capture placements without modifying stored data', () => {
  const moved = placedCollision(layer, [{ id: 'capture', offset: [10, 2, -4] }]);
  assert.deepEqual(moved.boxes[0].min, [10, 2, -4]);
  assert.deepEqual(moved.region.min, [6, -2, -8]);
  assert.deepEqual(layer.boxes[0].min, [0, 0, 0]);
  assert.equal(containsPoint(moved.region, [6.1, 0, 0], .25), false);
});
