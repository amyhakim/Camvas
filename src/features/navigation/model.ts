import type { NavigationRoute, SemanticSceneGraph, Vector3Tuple } from '../../contracts';

export type EdgeClearanceTest = (from: Vector3Tuple, to: Vector3Tuple, clearance: number) => boolean;

function distance(a: Vector3Tuple, b: Vector3Tuple) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function routeDistance(points: Vector3Tuple[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

export function simplifyRoute(points: Vector3Tuple[], clearance: number, edgeClear: EdgeClearanceTest) {
  if (points.length < 3) return [...points];
  const simplified: Vector3Tuple[] = [points[0]];
  let index = 0;
  while (index < points.length - 1) {
    let next = points.length - 1;
    while (next > index + 1 && !edgeClear(points[index], points[next], clearance)) next--;
    simplified.push(points[next]);
    index = next;
  }
  return simplified;
}

export function planSemanticRoute(
  graph: SemanticSceneGraph,
  start: Vector3Tuple,
  anchorId: string,
  clearance: number,
  edgeClear: EdgeClearanceTest,
): NavigationRoute | null {
  if (!Number.isFinite(clearance) || clearance < 0) return null;
  const anchor = graph.anchors.find(item => item.id === anchorId);
  if (!anchor) return null;
  const nodes = new Map(graph.nodes.map(node => [node.id, node]));
  const goal = nodes.get(anchor.nodeId);
  if (!goal) return null;

  const startId = '__camera__';
  const positions = new Map<string, Vector3Tuple>([[startId, start], ...graph.nodes.map(node => [node.id, node.position] as const)]);
  const adjacency = new Map<string, { id: string; cost: number }[]>();
  function connect(from: string, to: string, cost: number) {
    adjacency.set(from, [...(adjacency.get(from) || []), { id: to, cost }]);
  }

  for (const edge of graph.edges) {
    const from = nodes.get(edge.from), to = nodes.get(edge.to);
    const required = Math.max(clearance, edge.clearance);
    if (!from || !to || !edgeClear(from.position, to.position, required)) continue;
    const cost = distance(from.position, to.position);
    connect(from.id, to.id, cost); connect(to.id, from.id, cost);
  }
  for (const node of nodes.values()) {
    if (!edgeClear(start, node.position, clearance)) continue;
    const cost = distance(start, node.position);
    connect(startId, node.id, cost); connect(node.id, startId, cost);
  }

  const open = new Set([startId]);
  const previous = new Map<string, string>();
  const g = new Map<string, number>([[startId, 0]]);
  const score = new Map<string, number>([[startId, distance(start, goal.position)]]);
  while (open.size) {
    let current = '';
    for (const id of open) if (!current || (score.get(id) ?? Infinity) < (score.get(current) ?? Infinity)) current = id;
    if (current === goal.id) {
      const ids = [current];
      while (previous.has(ids[0])) ids.unshift(previous.get(ids[0])!);
      const raw = ids.map(id => positions.get(id)!).filter(Boolean);
      const points = simplifyRoute(raw, clearance, edgeClear);
      return { graphId: graph.id, anchorId, points, nodeIds: ids.filter(id => id !== startId), distance: routeDistance(points), clearance, interpolation: 'linear' };
    }
    open.delete(current);
    for (const neighbor of adjacency.get(current) || []) {
      const tentative = (g.get(current) ?? Infinity) + neighbor.cost;
      if (tentative >= (g.get(neighbor.id) ?? Infinity)) continue;
      previous.set(neighbor.id, current);
      g.set(neighbor.id, tentative);
      score.set(neighbor.id, tentative + distance(positions.get(neighbor.id)!, goal.position));
      open.add(neighbor.id);
    }
  }
  return null;
}
