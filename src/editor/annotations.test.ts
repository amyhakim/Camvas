import assert from 'node:assert/strict';
import test from 'node:test';
import { annotationContext } from './annotations';

test('marks retain Y-up surface height, entity and frame while bounding a region', () => {
  const context = annotationContext([{ id: 'mark:desk', entityId: 'desk', kind: 'mesh', frame: 24, points: [[-2, 1.25, 3], [2, 1.25, 5], [0, 1.25, 4]] }]);
  assert.deepEqual(context[0], { id: 'mark:desk', entityId: 'desk', kind: 'mesh', frame: 24, center: [0, 1.25, 4], min: [-2, 1.25, 3], max: [2, 1.25, 5], pointCount: 3 });
});

test('a single floor pin is a valid region, and empty cancelled strokes are omitted', () => {
  assert.deepEqual(annotationContext([{ id: 'mark:floor', entityId: null, kind: 'floor', frame: 1, points: [[3, .25, -2]] }, { id: 'empty', entityId: null, kind: 'floor', frame: 1, points: [] }]).map(mark => [mark.kind, mark.center]), [['floor', [3, .25, -2]]]);
});
