import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGeometry } from 'three';
import { fitBlockoutBounds, fitBlockoutPoints } from './blockout-fit';
import { buildAsset } from '../../vendor/blockout/upstream/renderer/viewport/builders';

test('seam welding preserves a cuboid as one block, with Blockout ground origin', () => {
  const asset = buildAsset('prim.cube');
  assert.equal(asset.group.name, 'prim.cube');
  const cube = asset.group.children[0] as import('three').Mesh;
  assert.equal(cube.position.y, .5);
  const blocks = fitBlockoutBounds(cube.geometry.attributes.position.array, cube.geometry.index!.array);
  assert.deepEqual(blocks, [{ min: [-.5, -.5, -.5], max: [.5, .5, .5] }]);
  cube.geometry.dispose();
});

test('disconnected components preserve an opening instead of boxing across it', () => {
  const cube = new BoxGeometry(1, 2, .2);
  const p = Array.from(cube.attributes.position.array), ix = Array.from(cube.index!.array);
  const shifted = p.map((v, i) => i % 3 === 0 ? v + 3 : v);
  const blocks = fitBlockoutBounds([...p, ...shifted], [...ix, ...ix.map(v => v + p.length / 3)]);
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every(b => b.max[0] < 1 || b.min[0] > 2));
  cube.dispose();
});

test('thin surfaces receive symmetric thickness measured in world units', () => {
  const blocks = fitBlockoutBounds([0, 0, 0, 2, 0, 0, 0, 0, 2], [0, 1, 2], [1, 2, 1]);
  assert.equal(blocks[0].min[1], -.0025);
  assert.equal(blocks[0].max[1], .0025);
});

test('complex geometry is subdivided deterministically and encloses every vertex', () => {
  const cube = new BoxGeometry(4, 4, 4, 6, 6, 6);
  const p = cube.attributes.position.array, ix = cube.index!.array;
  const blocks = fitBlockoutBounds(p, ix);
  assert.ok(blocks.length > 1);
  assert.deepEqual(blocks, fitBlockoutBounds(p, ix));
  for (let i = 0; i < p.length; i += 3) assert.ok(blocks.some(b => b.min.every((v, a) => p[i + a] >= v - 1e-6 && p[i + a] <= b.max[a] + 1e-6)));
  cube.dispose();
});

test('direct splat fitting preserves a doorway gap and ignores isolated floaters', () => {
  const points = [-1, 0, 0, -1, .1, 0, -1, .2, 0, 1, 0, 0, 1, .1, 0, 1, .2, 0, 100, 100, 100];
  const blocks = fitBlockoutPoints(points);
  assert.ok(blocks.length > 0);
  assert.ok(blocks.every(b => b.max[0] < 0 || b.min[0] > 0));
  assert.ok(blocks.every(b => b.max[0] < 2));
  assert.deepEqual(blocks, fitBlockoutPoints(points));
  assert.throws(() => fitBlockoutPoints([NaN, 0, 0]));
  assert.throws(() => fitBlockoutPoints(points, .5, 0), /Too many/);
});
