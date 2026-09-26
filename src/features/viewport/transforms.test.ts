import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { boundedPosition, placementAdapter } from './transforms';

test('world offsets preserve source orientation/scale under a transformed parent and restore on cancel', () => {
  const parent = new THREE.Group(); parent.rotation.y = .8; parent.scale.set(2, 3, 4);
  const object = new THREE.Mesh(new THREE.BoxGeometry()); object.position.set(1, 2, 3); object.rotation.z = .4; object.scale.set(3, 2, 1); parent.add(object);
  parent.updateMatrixWorld(true);
  const original = object.getWorldPosition(new THREE.Vector3()); const rotation = object.quaternion.clone(); const scale = object.scale.clone();
  const adapter = placementAdapter(new Map([['furniture', [object]]]));
  adapter.apply([{ id: 'furniture', offset: [4, -2, 7] }]);
  assert.ok(object.getWorldPosition(new THREE.Vector3()).distanceTo(original.clone().add(new THREE.Vector3(4, -2, 7))) < 1e-9);
  assert.ok(object.quaternion.equals(rotation)); assert.ok(object.scale.equals(scale));
  adapter.apply([{ id: 'furniture', offset: [4, -2, 7] }]);
  assert.ok(object.getWorldPosition(new THREE.Vector3()).distanceTo(original.clone().add(new THREE.Vector3(4, -2, 7))) < 1e-9);
  adapter.restore(); parent.updateMatrixWorld(true); assert.ok(object.getWorldPosition(new THREE.Vector3()).distanceTo(original) < 1e-9);
});
test('all disconnected entity meshes move once, nested entity meshes do not move twice, cameras stay unchanged', () => {
  const root = new THREE.Group(); const child = new THREE.Mesh(new THREE.BoxGeometry()); root.add(child);
  const separate = new THREE.Mesh(new THREE.BoxGeometry()); const camera = new THREE.PerspectiveCamera();
  const adapter = placementAdapter(new Map([['entity', [root, child, separate, camera]]]));
  adapter.apply([{ id: 'entity', offset: [2, 3, 4] }]);
  for (const object of [root, child, separate]) assert.deepEqual(object.getWorldPosition(new THREE.Vector3()).toArray(), [2, 3, 4]);
  assert.deepEqual(camera.position.toArray(), [0, 0, 0]);
  adapter.restore(); assert.deepEqual(root.position.toArray(), [0, 0, 0]);
});
test('position inputs are finite and bounded', () => { assert.deepEqual(boundedPosition([Infinity, -1200, 1200]), [0, -1000, 1000]); });
