import type { SceneEntity, Vector3Tuple } from '../../contracts';

/** Interpolate the manifest sample grid, holding its endpoints. */
export function entityPosition(entity: SceneEntity, frame: number): Vector3Tuple {
  if (!entity.samples?.length) return entity.position;
  const samples = entity.samples;
  if (frame <= samples[0].frame) return samples[0].position;
  if (frame >= samples.at(-1)!.frame) return samples.at(-1)!.position;
  let low = 0, high = samples.length - 1;
  while (high - low > 1) { const middle = (low + high) >>> 1; if (samples[middle].frame <= frame) low = middle; else high = middle; }
  const a = samples[low], b = samples[high], t = (frame - a.frame) / (b.frame - a.frame);
  return a.position.map((value, axis) => value + (b.position[axis] - value) * t) as Vector3Tuple;
}

export function filterSceneObjects(objects: SceneEntity[], query: string): SceneEntity[] {
  const search = query.toLowerCase();
  return objects.filter(object => `${object.name} ${object.sourceName} ${object.type} ${object.category} ${object.materials.join(' ')}`.toLowerCase().includes(search));
}
