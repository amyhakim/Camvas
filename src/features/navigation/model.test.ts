import assert from 'node:assert/strict';
import test from 'node:test';
import type { SemanticSceneGraph, Vector3Tuple } from '../../contracts';
import { planSemanticRoute, simplifyRoute } from './model';

const graph: SemanticSceneGraph = {
  id: 'fixture', label: 'Fixture', spaces: [{ id: 'room', label: 'Room', bounds: { min: [0, 0, 0], max: [10, 10, 10] } }],
  anchors: [{ id: 'goal', label: 'Goal', spaceId: 'room', nodeId: 'c', position: [4, 0, 0], lookAt: [5, 0, 0], tags: ['goal'] }],
  nodes: [
    { id: 'a', spaceId: 'room', position: [0, 0, 0] },
    { id: 'b', spaceId: 'room', position: [2, 2, 0] },
    { id: 'c', spaceId: 'room', position: [4, 0, 0] },
  ],
  edges: [{ from: 'a', to: 'b', clearance: .25 }, { from: 'b', to: 'c', clearance: .25 }, { from: 'a', to: 'c', clearance: .25 }],
};

function blocksDirect(from: Vector3Tuple, to: Vector3Tuple) {
  const isStartConnection = from[0] === -1 || to[0] === -1;
  if (isStartConnection) {
    const other = from[0] === -1 ? to : from;
    return other[0] === 0 && other[1] === 0;
  }
  return !((from[0] === 0 && from[1] === 0 && to[0] === 4 && to[1] === 0) || (to[0] === 0 && to[1] === 0 && from[0] === 4 && from[1] === 0));
}

test('A* routes around a blocked direct edge using semantic graph nodes', () => {
  const route = planSemanticRoute(graph, [-1, 0, 0], 'goal', .25, blocksDirect);
  assert.ok(route);
  assert.deepEqual(route.nodeIds, ['a', 'b', 'c']);
  assert.deepEqual(route.points, [[-1, 0, 0], [0, 0, 0], [2, 2, 0], [4, 0, 0]]);
  assert.equal(route.interpolation, 'linear');
});

test('route simplification keeps an obstacle-avoiding waypoint', () => {
  const points: Vector3Tuple[] = [[0, 0, 0], [2, 2, 0], [4, 0, 0]];
  assert.deepEqual(simplifyRoute(points, .25, blocksDirect), points);
});

test('unknown anchors and disconnected graphs fail closed', () => {
  assert.equal(planSemanticRoute(graph, [-1, 0, 0], 'missing', .25, () => true), null);
  assert.equal(planSemanticRoute(graph, [-1, 0, 0], 'goal', .25, () => false), null);
});
