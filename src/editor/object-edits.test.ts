import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectFixture, sceneFixture } from '../contracts/fixtures';
import { placedEntity, withPlacement } from './object-edits';

test('static scene offsets replace without accumulation and reset only their own object', () => {
  const moved = withPlacement(projectFixture, { id: 'chair', offset: [1, 2, 3] });
  const other = withPlacement(moved, { id: 'wall', offset: [0, 3, 0] });
  const changed = withPlacement(other, { id: 'chair', offset: [4, 0, 0] });
  assert.deepEqual(changed.placements?.find(p => p.id === 'chair')?.offset, [4, 0, 0]);
  assert.equal(withPlacement(changed, { id: 'chair', offset: [0, 0, 0] }).placements?.length, 1);
  assert.equal(projectFixture.placements, undefined);
  assert.throws(() => withPlacement(moved, { id: 'chair', offset: [NaN, 0, 0] }), /finite/);
});
test('inspector metadata converts moved world Y-up offsets to Blender Z-up', () => {
  const entity = sceneFixture.objects[0];
  const placed = placedEntity(entity, [{ id: entity.id, offset: [1, 2, 3] }]);
  assert.deepEqual(placed.positionWeb, [11, 5, -2]);
  assert.deepEqual(placed.position, [11, 2, 5]);
  assert.deepEqual(entity.position, [10, 5, 3]);
});
