/** Fitting only: mesh construction is delegated to Blockout's original buildAsset. */
export type FittedBlock = { min: [number, number, number]; max: [number, number, number] };

/** Weld seams, separate disconnected pieces, then split complex pieces spatially.
 * Bounds stay in the source mesh's local frame so its full transform is preserved.
 * This is a surface approximation, not a claim of reconstructed solid/free space.
 */
export function fitBlockoutBounds(positions: ArrayLike<number>, indices: ArrayLike<number>, scale: readonly number[] = [1, 1, 1]): FittedBlock[] {
  const count = positions.length / 3;
  if (!Number.isInteger(count) || indices.length % 3) throw new Error('Invalid triangle geometry.');
  const parent = new Int32Array(count);
  const welded = new Map<string, number>();
  const find = (v: number): number => {
    while (parent[v] !== v) { parent[v] = parent[parent[v]]; v = parent[v]; }
    return v;
  };
  for (let v = 0; v < count; v++) {
    const xyz = [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
    if (!xyz.every(Number.isFinite)) throw new Error('Non-finite source vertex.');
    const key = xyz.map((n, a) => Math.round(n * Math.abs(scale[a]) * 100000)).join(',');
    const previous = welded.get(key);
    parent[v] = previous ?? v;
    if (previous === undefined) welded.set(key, v);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    if (![a, b, c].every(v => Number.isInteger(v) && v >= 0 && v < count)) throw new Error('Invalid triangle index.');
    parent[find(b)] = find(a); parent[find(c)] = find(a);
  }
  const pieces = new Map<number, number[]>();
  for (let i = 0; i < indices.length; i += 3) {
    const key = find(indices[i]);
    const triangles = pieces.get(key) ?? [];
    triangles.push(i); pieces.set(key, triangles);
  }
  const result: FittedBlock[] = [];
  const fit = (triangles: number[], depth: number) => {
    const min: FittedBlock['min'] = [Infinity, Infinity, Infinity];
    const max: FittedBlock['max'] = [-Infinity, -Infinity, -Infinity];
    for (const t of triangles) for (let k = 0; k < 3; k++) for (let a = 0; a < 3; a++) {
      const n = positions[indices[t + k] * 3 + a];
      min[a] = Math.min(min[a], n); max[a] = Math.max(max[a], n);
    }
    const extents = min.map((n, a) => (max[a] - n) * Math.abs(scale[a]));
    const axis = extents.indexOf(Math.max(...extents));
    if (triangles.length > 48 && extents[axis] > .35 && depth < 12) {
      const centroid = (t: number) => (positions[indices[t] * 3 + axis] + positions[indices[t + 1] * 3 + axis] + positions[indices[t + 2] * 3 + axis]) / 3;
      triangles.sort((a, b) => centroid(a) - centroid(b) || a - b);
      const middle = Math.floor(triangles.length / 2);
      fit(triangles.slice(0, middle), depth + 1); fit(triangles.slice(middle), depth + 1);
    } else {
      // Give paper-thin surfaces a visible 1 cm thickness, symmetrically.
      for (let a = 0; a < 3; a++) {
        const padding = Math.max(0, .01 / Math.max(Math.abs(scale[a]), 1e-8) - (max[a] - min[a])) / 2;
        min[a] -= padding; max[a] += padding;
      }
      result.push({ min, max });
    }
  };
  for (const triangles of pieces.values()) fit(triangles, 0);
  // Aggregate only sub-25 cm details sharing a spatial cell. This bounds the
  // approximation error and prevents individual foliage triangles becoming
  // hundreds of thousands of separate cubes. Large architectural pieces and
  // their openings never enter this merge.
  const merged = new Map<string, FittedBlock>();
  const substantial: FittedBlock[] = [];
  for (const block of result) {
    const worldSize = block.min.map((n, a) => (block.max[a] - n) * Math.abs(scale[a]));
    if (worldSize.some(n => n > .25)) { substantial.push(block); continue; }
    const key = block.min.map((n, a) => Math.floor((n + block.max[a]) * .5 * Math.abs(scale[a]) / .25)).join(',');
    const previous = merged.get(key);
    if (previous) for (let a = 0; a < 3; a++) {
      previous.min[a] = Math.min(previous.min[a], block.min[a]);
      previous.max[a] = Math.max(previous.max[a], block.max[a]);
    } else merged.set(key, block);
  }
  return [...substantial, ...merged.values()];
}

/** Direct point-cloud fitting: recursively split samples, never voxelize or reconstruct a mesh.
 * Small sparse leaves are discarded; a leaf cannot bridge a gap larger than maxExtent.
 * These are visual estimates, not reviewed collision geometry.
 */
export function fitBlockoutPoints(positions: ArrayLike<number>, maxExtent = .5, maxBlocks = 50000): FittedBlock[] {
  if (positions.length % 3 || !Number.isFinite(maxExtent) || maxExtent <= 0) throw new Error('Invalid point fitting input.');
  const ids: number[] = [];
  for (let i = 0; i < positions.length / 3; i++) {
    if (![positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]].every(Number.isFinite)) throw new Error('Non-finite splat position.');
    ids.push(i);
  }
  const blocks: FittedBlock[] = [];
  const fit = (points: number[]) => {
    if (points.length < 3) return;
    const min: FittedBlock['min'] = [Infinity, Infinity, Infinity], max: FittedBlock['max'] = [-Infinity, -Infinity, -Infinity];
    for (const i of points) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], positions[i * 3 + a]); max[a] = Math.max(max[a], positions[i * 3 + a]); }
    const extents = max.map((v, a) => v - min[a]);
    const axis = extents.indexOf(Math.max(...extents));
    if (extents[axis] > maxExtent) {
      points.sort((a, b) => positions[a * 3 + axis] - positions[b * 3 + axis] || a - b);
      const middle = Math.floor(points.length / 2);
      fit(points.slice(0, middle)); fit(points.slice(middle));
    } else {
      for (let a = 0; a < 3; a++) { const pad = Math.max(0, .02 - extents[a]) / 2; min[a] -= pad; max[a] += pad; }
      blocks.push({ min, max });
      if (blocks.length > maxBlocks) throw new Error('Too many fitted blocks. Try a larger block size.');
    }
  };
  fit(ids);
  return blocks;
}
