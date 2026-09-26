import type { CollisionBox, CollisionLayer, ScenePlacement, Vector3Tuple } from '../../contracts';

export const MAX_COLLISION_BOXES = 400;
export type Bounds = { min: Vector3Tuple; max: Vector3Tuple };
export function containsPoint(bounds: Bounds, point: readonly number[], margin = 0) {
  return point.every((v, axis) => v >= bounds.min[axis] + margin && v <= bounds.max[axis] - margin);
}
export function validateCollisionLayer(value: unknown): CollisionLayer {
  const fail = (): never => { throw new Error('Invalid collision boxes. Regenerate them or import a valid project.'); };
  if (!value || typeof value !== 'object') return fail();
  const v = value as CollisionLayer;
  const vector = (p: unknown): p is Vector3Tuple => Array.isArray(p) && p.length === 3 && p.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000);
  const bounds = (b: Bounds) => b && vector(b.min) && vector(b.max) && b.min.every((n, i) => n < b.max[i]);
  if (v.version !== 1 || typeof v.sourceUrl !== 'string' || !v.sourceUrl || v.sourceUrl.length > 2000 || typeof v.entityId !== 'string' || !v.entityId || v.entityId.length > 500 || typeof v.reviewed !== 'boolean' || !vector(v.offset) || !bounds(v.region) || !Number.isFinite(v.cellSize) || v.cellSize < .1 || v.cellSize > 2 || !Number.isSafeInteger(v.sampleCount) || v.sampleCount < 1 || v.sampleCount > 5000000 || !Array.isArray(v.boxes) || v.boxes.length > MAX_COLLISION_BOXES) return fail();
  if (v.boxes.some(b => !bounds(b) || typeof b.id !== 'string' || !b.id || b.id.length > 80 || !containsPoint(v.region, b.min) || !containsPoint(v.region, b.max)) || new Set(v.boxes.map(b => b.id)).size !== v.boxes.length || (v.reviewed && !v.boxes.length)) return fail();
  return { version: 1, sourceUrl: v.sourceUrl, entityId: v.entityId, reviewed: v.reviewed, cellSize: v.cellSize, sampleCount: v.sampleCount, offset: [...v.offset], region: { min: [...v.region.min], max: [...v.region.max] }, boxes: v.boxes.map(b => ({ id: b.id, min: [...b.min], max: [...b.max] })) };
}
/** Boxes and coverage follow an environment translation, just like its splats. */
export function placedCollision(layer: CollisionLayer, placements: ScenePlacement[]) {
  const offset = placements.find(p => p.id === layer.entityId)?.offset ?? [0, 0, 0];
  const move = (p: Vector3Tuple): Vector3Tuple => p.map((v, i) => v + offset[i] - layer.offset[i]) as Vector3Tuple;
  return { region: { min: move(layer.region.min), max: move(layer.region.max) }, boxes: layer.boxes.map(b => ({ ...b, min: move(b.min), max: move(b.max) })) };
}

/** Merge only fully occupied adjacent cells. Never bridge an empty doorway to meet a box budget. */
export class OccupancyBoxes {
  private cells = new Map<string, number>();
  sampleCount = 0;
  constructor(readonly region: Bounds, readonly cellSize: number) {
    if (!Number.isFinite(cellSize) || cellSize < .1 || cellSize > 2 || region.min.some((v, i) => !Number.isFinite(v) || !Number.isFinite(region.max[i]) || v >= region.max[i] || region.max[i] - v > 24)) throw new Error('Choose a cell size of 0.1–2 and a review area no wider than 24 scene units.');
  }
  add(point: readonly number[]) {
    if (point.length !== 3 || point.some(v => !Number.isFinite(v)) || !containsPoint(this.region, point)) return;
    this.sampleCount++;
    const key = point.map((v, i) => Math.floor((v - this.region.min[i]) / this.cellSize)).join(',');
    this.cells.set(key, (this.cells.get(key) ?? 0) + 1);
    if (this.cells.size > 150000) throw new Error('Too many occupied cells. Increase cell size or reduce the review radius.');
  }
  finish(minSamples = 3): CollisionBox[] {
    const occupied = new Set([...this.cells].filter(([, count]) => count >= minSamples).map(([key]) => key));
    const keys = [...occupied].map(key => key.split(',').map(Number)).sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
    const boxes: CollisionBox[] = [];
    for (const [x, y, z] of keys) {
      if (!occupied.has(`${x},${y},${z}`)) continue;
      let nx = x + 1, ny = y + 1, nz = z + 1;
      while (occupied.has(`${nx},${y},${z}`)) nx++;
      const row = (yy: number, zz: number) => { for (let xx = x; xx < nx; xx++) if (!occupied.has(`${xx},${yy},${zz}`)) return false; return true; };
      while (row(ny, z)) ny++;
      const plane = (zz: number) => { for (let yy = y; yy < ny; yy++) if (!row(yy, zz)) return false; return true; };
      while (plane(nz)) nz++;
      for (let zz = z; zz < nz; zz++) for (let yy = y; yy < ny; yy++) for (let xx = x; xx < nx; xx++) occupied.delete(`${xx},${yy},${zz}`);
      const corner = (values: number[]): Vector3Tuple => values.map((v, i) => Math.min(this.region.max[i], this.region.min[i] + v * this.cellSize)) as Vector3Tuple;
      const min = corner([x, y, z]), max = corner([nx, ny, nz]);
      if (min.every((v, i) => v < max[i])) boxes.push({ id: `box-${boxes.length + 1}`, min, max });
      if (boxes.length > MAX_COLLISION_BOXES) throw new Error('This area needs more than 400 boxes. Reduce the review radius or increase cell size, then generate again. No boxes were dropped.');
    }
    if (!boxes.length) throw new Error('No occupied cells found. Move closer to the room or increase cell size, then try again.');
    return boxes;
  }
}
