import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GraphNode, Vec3 } from 'playcanvas';
import { boundedPosition, placementAdapter } from './transforms';

const xyz = (v: Vec3) => [v.x, v.y, v.z];
test('world offsets preserve source orientation/scale under a transformed parent and restore on cancel', () => {
  const parent = new GraphNode(); parent.setLocalEulerAngles(0, .8 * 180 / Math.PI, 0); parent.setLocalScale(2, 3, 4);
  const object = new GraphNode(); object.setLocalPosition(1, 2, 3); object.setLocalEulerAngles(0, 0, .4 * 180 / Math.PI); object.setLocalScale(3, 2, 1); parent.addChild(object);
  const original = object.getPosition().clone(), rotation = object.getLocalRotation().clone(), scale = object.getLocalScale().clone();
  const adapter = placementAdapter(new Map([['furniture', [object]]]));
  adapter.apply([{ id: 'furniture', offset: [4, -2, 7] }]);
  assert.ok(object.getPosition().distance(original.clone().add(new Vec3(4, -2, 7))) < 1e-5);
  assert.ok(object.getLocalRotation().equals(rotation)); assert.ok(object.getLocalScale().equals(scale));
  adapter.apply([{ id: 'furniture', offset: [4, -2, 7] }]);
  assert.ok(object.getPosition().distance(original.clone().add(new Vec3(4, -2, 7))) < 1e-5);
  adapter.restore(); assert.ok(object.getPosition().distance(original) < 1e-5);
});
test('disconnected meshes move once, nested nodes do not move twice, unrelated cameras stay unchanged', () => {
  const root = new GraphNode(), child = new GraphNode(); root.addChild(child);
  const separate = new GraphNode(), camera = new GraphNode();
  const adapter = placementAdapter(new Map([['entity', [root, child, separate]]]));
  adapter.apply([{ id: 'entity', offset: [2, 3, 4] }]);
  for (const object of [root, child, separate]) assert.deepEqual(xyz(object.getPosition()), [2, 3, 4]);
  assert.deepEqual(xyz(camera.getPosition()), [0, 0, 0]);
  adapter.restore(); assert.deepEqual(xyz(root.getPosition()), [0, 0, 0]);
});
test('position inputs are finite and bounded', () => { assert.deepEqual(boundedPosition([Infinity, -1200, 1200]), [0, -1000, 1000]); });
