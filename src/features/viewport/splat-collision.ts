import { readSplatSamples } from './splat-samples';
import * as pc from 'playcanvas';
import { OccupancyBoxes } from '../collision/model';
import type { CollisionLayer, CollisionOptions, Vector3Tuple } from '../../contracts';

/** Read a complete coarse LOD, independently of view-dependent rendering and resident tiles. */
export async function generateSplatCollision(app: pc.Application, root: pc.Entity, options: CollisionOptions, view: Vector3Tuple, source: { entityId: string; sourceUrl: string; offset: Vector3Tuple }, signal: AbortSignal, progress: (message: string) => void): Promise<CollisionLayer> {
  if (!Number.isFinite(options.radius) || options.radius < 1 || options.radius > 12) throw new Error('Choose a review radius of 1–12 scene units.');
  const region = { min: view.map(v => v - options.radius) as Vector3Tuple, max: view.map(v => v + options.radius) as Vector3Tuple };
  const occupancy = new OccupancyBoxes(region, options.cellSize);
  await readSplatSamples(app, root, source, signal, progress, (x, y, z) => occupancy.add([x, y, z]));
  progress('Merging occupied cells…');
  return { version: 1, ...source, region, cellSize: options.cellSize, sampleCount: occupancy.sampleCount, reviewed: false, boxes: occupancy.finish() };
}
