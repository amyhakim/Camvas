import type { ProjectDocument, SceneEntity, ScenePlacement, Vector3Tuple } from '../contracts';

/** Imported object placements are static world offsets, independent of the playhead. */
export function withPlacement(project: ProjectDocument, placement: ScenePlacement): ProjectDocument {
  if (placement.offset.length !== 3 || placement.offset.some(value => !Number.isFinite(value) || Math.abs(value) > 1000)) throw new Error('Object offsets must be finite and between −1000 and 1000 m.');
  const others = (project.placements ?? []).filter(item => item.id !== placement.id);
  return { ...project, placements: placement.offset.every(value => value === 0) ? others : [...others, { id: placement.id, offset: [...placement.offset] }] };
}

export function placedEntity(entity: SceneEntity, placements: ScenePlacement[]): SceneEntity {
  const placement = placements.find(item => item.id === entity.id);
  if (!placement || entity.type === 'Camera') return entity;
  const [x, y, z] = placement.offset;
  return { ...entity, positionWeb: entity.positionWeb.map((value, i) => value + placement.offset[i]) as Vector3Tuple,
    position: [entity.position[0] + x, entity.position[1] - z, entity.position[2] + y] };
}
