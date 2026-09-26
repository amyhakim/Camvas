import { GraphNode, Vec3 } from 'playcanvas';
import type { ScenePlacement, Vector3Tuple } from '../../contracts';

export function boundedPosition(values: readonly number[]): Vector3Tuple {
  return [0, 1, 2].map(i => Number.isFinite(values[i]) ? Math.max(-1000, Math.min(1000, values[i])) : 0) as Vector3Tuple;
}

/** Apply a world translation once per topmost entity node, preserving its rotation and scale. */
export function placementAdapter(index: Map<string, GraphNode[]>) {
  const applied = new Map<GraphNode, Vec3>();
  function restore() {
    for (const [node, local] of applied) node.setLocalPosition(local);
    applied.clear();
  }
  function apply(placements: ScenePlacement[]) {
    restore();
    for (const placement of placements) {
      const members = new Set(index.get(placement.id) ?? []);
      for (const node of members) {
        let parent = node.parent;
        while (parent && !members.has(parent)) parent = parent.parent;
        if (parent) continue;
        applied.set(node, node.getLocalPosition().clone());
        node.setPosition(node.getPosition().clone().add(new Vec3(...boundedPosition(placement.offset))));
      }
    }
  }
  return { restore, apply };
}
