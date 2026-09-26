import type { SceneEntity, Vector3Tuple } from '../../contracts';

/** Manifest samples use Blender's one-based frame offset; hold the end samples. */
export function entityPosition(entity: SceneEntity, frame: number): Vector3Tuple {
  if (!entity.samples?.length) return entity.position;
  return entity.samples[Math.min(entity.samples.length - 1, Math.max(0, frame - 1))].position;
}

export function filterSceneObjects(objects: SceneEntity[], query: string): SceneEntity[] {
  const search = query.toLowerCase();
  return objects.filter(object => `${object.name} ${object.sourceName} ${object.type} ${object.category} ${object.materials.join(' ')}`.toLowerCase().includes(search));
}
