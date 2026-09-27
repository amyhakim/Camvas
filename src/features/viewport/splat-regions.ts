import type { SemanticCandidate } from '../../contracts/semantics';
import type { Vector3Tuple } from '../../contracts';
import type { FittedBlock } from './blockout-fit';

/** Spatial groups of fitted surfaces, not object segmentation or free-space cells. */
export function splatRegionCandidates(blocks: FittedBlock[], sourceEntityId: string, limit = 64): SemanticCandidate[] {
  if (!blocks.length || !Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('No fitted surfaces available for labeling.');
  const extent = (group: FittedBlock[]) => ({
    min: [0, 1, 2].map(a => Math.min(...group.map(b => b.min[a]))) as Vector3Tuple,
    max: [0, 1, 2].map(a => Math.max(...group.map(b => b.max[a]))) as Vector3Tuple,
  });
  const groups = [blocks];
  while (groups.length < limit) {
    let chosen = -1, axis = 0, longest = 0;
    groups.forEach((group, i) => {
      if (group.length < 4) return;
      const b = extent(group);
      b.min.forEach((n, a) => { const size = b.max[a] - n; if (size > longest) { chosen = i; axis = a; longest = size; } });
    });
    if (chosen < 0 || longest < .5) break;
    const group = [...groups[chosen]].sort((a, b) => (a.min[axis] + a.max[axis]) - (b.min[axis] + b.max[axis]));
    const middle = Math.floor(group.length / 2);
    groups.splice(chosen, 1, group.slice(0, middle), group.slice(middle));
  }
  return groups.map((group, i) => ({ id: `${sourceEntityId}:surface-${i + 1}`, sourceEntityId, name: `Captured surface group ${i + 1}`, materials: ['Gaussian captured appearance; spatial grouping, not segmented objects'], ...extent(group) }));
}
