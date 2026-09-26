import * as THREE from 'three';
import type { ScenePlacement, Vector3Tuple } from '../../contracts';

export function boundedPosition(values: readonly number[]): Vector3Tuple {
  return [0, 1, 2].map(i => Number.isFinite(values[i]) ? Math.max(-1000, Math.min(1000, values[i])) : 0) as Vector3Tuple;
}

/** Offsets are world translations; restore before evaluating source animation. */
export function placementAdapter(index: Map<string, THREE.Object3D[]>) {
  const applied = new Map<THREE.Object3D, THREE.Vector3>();
  function restore() {
    for (const [object, base] of applied) object.position.copy(base);
    applied.clear();
  }
  function apply(placements: ScenePlacement[]) {
    restore();
    for (const placement of placements) {
      const objects = index.get(placement.id) ?? [];
      const members = new Set(objects);
      for (const object of objects) {
        let ancestor = object.parent;
        let nested = false;
        while (ancestor) { if (members.has(ancestor)) { nested = true; break; } ancestor = ancestor.parent; }
        if (nested || object instanceof THREE.Camera) continue;
        applied.set(object, object.position.clone());
        object.updateWorldMatrix(true, false);
        const destination = object.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(...boundedPosition(placement.offset)));
        if (object.parent) object.parent.worldToLocal(destination);
        object.position.copy(destination);
        object.updateMatrixWorld(true);
      }
    }
  }
  return { restore, apply };
}
