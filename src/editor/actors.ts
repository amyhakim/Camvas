import type { ActorPose, SceneEntity } from '../contracts';

/** Browser metadata uses Blender coordinates, even for authored Y-up proxies. */
export function actorEntity(pose: ActorPose): SceneEntity {
  const [x, y, z] = pose.position;
  return {
    id: pose.id, name: pose.name, sourceName: pose.id, type: 'Actor', category: 'Actor', materials: [],
    position: [x, -z, y], positionWeb: pose.position,
    dimensions: [.5, .5, pose.height],
  };
}
