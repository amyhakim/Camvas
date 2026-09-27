import type { ActorPose, SceneProp, Vector3Tuple } from '../../contracts';

const normalizedYaw = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Keep the current world pose when attaching; offsets use the actor's heading frame. */
export function attachProp(prop: SceneProp, actor: ActorPose): SceneProp {
  const dx = prop.position[0] - actor.position[0], dz = prop.position[2] - actor.position[2];
  const c = Math.cos(actor.heading), s = Math.sin(actor.heading);
  return { ...prop, attachment: { actorId: actor.id, offset: [dx * c - dz * s, prop.position[1] - actor.position[1], dx * s + dz * c], yaw: normalizedYaw(prop.rotation[1] - actor.heading) } };
}

/** A missing actor leaves the last independent pose visible; project validation rejects dangling links. */
export function resolveProp(prop: SceneProp, actor: ActorPose | undefined): SceneProp {
  if (!prop.attachment || !actor || actor.id !== prop.attachment.actorId) return prop;
  const [x, y, z] = prop.attachment.offset, c = Math.cos(actor.heading), s = Math.sin(actor.heading);
  const position: Vector3Tuple = [actor.position[0] + x * c + z * s, actor.position[1] + y, actor.position[2] - x * s + z * c];
  return { ...prop, position, rotation: [prop.rotation[0], actor.heading + prop.attachment.yaw, prop.rotation[2]] };
}

export function detachProp(prop: SceneProp, actor: ActorPose | undefined): SceneProp {
  const { attachment: _attachment, ...rest } = resolveProp(prop, actor);
  return { ...rest, rotation: [rest.rotation[0], normalizedYaw(rest.rotation[1]), rest.rotation[2]] };
}
