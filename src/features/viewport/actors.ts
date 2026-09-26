import type { ActorPose, Vector3Tuple } from '../../contracts';

/** Bounds enclosing the rotated body and the forward-facing nose, feet anchored at Y. */
export function actorBounds(actor: ActorPose): { min: Vector3Tuple; max: Vector3Tuple } {
  const halfWidth = actor.height * .18;
  const halfDepth = actor.height * .16;
  const c = Math.abs(Math.cos(actor.heading)), s = Math.abs(Math.sin(actor.heading));
  const x = c * halfWidth + s * halfDepth, z = s * halfWidth + c * halfDepth;
  return { min: [actor.position[0] - x, actor.position[1], actor.position[2] - z], max: [actor.position[0] + x, actor.position[1] + actor.height, actor.position[2] + z] };
}

export function actorForward(heading: number): Vector3Tuple {
  return [-Math.sin(heading), 0, -Math.cos(heading)];
}
