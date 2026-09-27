import type { CameraPose, CameraShot, Vector3Tuple } from '../../contracts';
import { compileShot, type TargetSampler } from './model';

export type RouteBox = { min: Vector3Tuple; max: Vector3Tuple; color?: string };
export type RouteSample = { time: number; pose: CameraPose };
export type RouteView = { width: number; height: number; centerX: number; centerZ: number; halfWidth: number; halfHeight: number };

/** Sample the same evaluator used by shot playback, including CinemaTraj and actor tracking. */
export function sampleCameraRoute(shot: CameraShot, targetAt?: TargetSampler): RouteSample[] {
  const evaluate = compileShot(shot, targetAt);
  const count = Math.min(720, Math.max(120, Math.ceil(shot.settings.duration * 24)));
  return Array.from({ length: count + 1 }, (_, index) => {
    const time = shot.settings.duration * index / count;
    return { time, pose: evaluate(time) };
  });
}

/** Match Blockout's top camera: world -Z points up, and route and scene both fit. */
export function fitRouteView(samples: readonly RouteSample[], boxes: readonly RouteBox[], width = 480, height = 320): RouteView {
  const xs = samples.map(sample => sample.pose.position[0]);
  const zs = samples.map(sample => sample.pose.position[2]);
  for (const box of boxes) { xs.push(box.min[0], box.max[0]); zs.push(box.min[2], box.max[2]); }
  const minX = Math.min(...xs, -4), maxX = Math.max(...xs, 4);
  const minZ = Math.min(...zs, -4), maxZ = Math.max(...zs, 4);
  const halfWidth = Math.max((maxX - minX) / 2, (maxZ - minZ) * width / height / 2, 4) * 1.12;
  return { width, height, centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, halfWidth, halfHeight: halfWidth * height / width };
}
export function routePoint(view: RouteView, position: Vector3Tuple): [number, number] {
  return [view.width / 2 + (position[0] - view.centerX) * view.width / (2 * view.halfWidth),
    view.height / 2 + (position[2] - view.centerZ) * view.height / (2 * view.halfHeight)];
}

/** Signed distance to a world-aligned mesh bound, in metres. */
export function distanceToRouteBox(position: Vector3Tuple, box: RouteBox): number {
  const dx = Math.max(box.min[0] - position[0], position[0] - box.max[0]);
  const dy = Math.max(box.min[1] - position[1], position[1] - box.max[1]);
  const dz = Math.max(box.min[2] - position[2], position[2] - box.max[2]);
  return Math.hypot(Math.max(0, dx), Math.max(0, dy), Math.max(0, dz)) + Math.min(0, Math.max(dx, dy, dz));
}
const nearestDistance = (position: Vector3Tuple, boxes: readonly RouteBox[]) => Math.min(...boxes.map(box => distanceToRouteBox(position, box)));
const violations = (positions: readonly Vector3Tuple[], boxes: readonly RouteBox[]) => positions.filter(position => nearestDistance(position, boxes) < .3).length;

/**
 * Local CPU refinement adapted to FlyThru's camera marks from Blockout's
 * camera-optimizer: clearance, smoothness, and a 0.75 m displacement limit.
 * It never claims to find a globally clear route.
 */
export function optimizeCameraRoute(shot: CameraShot, boxes: readonly RouteBox[], targetAt?: TargetSampler): { shot: CameraShot; before: number; after: number } | null {
  if (!boxes.length) return null;
  const evaluate = compileShot(shot, targetAt);
  const count = Math.min(120, Math.max(40, Math.ceil(shot.settings.duration * 8)));
  const original = Array.from({ length: count + 1 }, (_, index) => evaluate(shot.settings.duration * index / count).position);
  const positions = original.map(point => [...point] as Vector3Tuple);
  const localCost = (point: Vector3Tuple) => {
    const gap = Math.max(0, .3 - nearestDistance(point, boxes));
    return 20 * (gap + gap * gap);
  };
  const energy = (points: readonly Vector3Tuple[]) => {
    let cost = 0;
    for (let i = 0; i < points.length; i++) {
      cost += localCost(points[i]);
      for (let axis = 0; axis < 3; axis++) cost += .2 * (points[i][axis] - original[i][axis]) ** 2;
    }
    for (let i = 0; i + 3 < points.length; i++) for (let axis = 0; axis < 3; axis++) {
      const jerk = -points[i][axis] + 3 * points[i + 1][axis] - 3 * points[i + 2][axis] + points[i + 3][axis];
      cost += jerk * jerk;
    }
    return cost;
  };
  const beforeCost = energy(positions);
  let cost = beforeCost;
  for (let iteration = 0; iteration < 40; iteration++) {
    const gradient = positions.map(() => [0, 0, 0] as Vector3Tuple);
    for (let i = 1; i < count; i++) for (let axis = 0; axis < 3; axis++) {
      const plus = [...positions[i]] as Vector3Tuple, minus = [...positions[i]] as Vector3Tuple;
      plus[axis] += .001; minus[axis] -= .001;
      gradient[i][axis] = (localCost(plus) - localCost(minus)) / .002 + .4 * (positions[i][axis] - original[i][axis]);
    }
    for (let i = 0; i + 3 < positions.length; i++) for (let axis = 0; axis < 3; axis++) {
      const jerk = -positions[i][axis] + 3 * positions[i + 1][axis] - 3 * positions[i + 2][axis] + positions[i + 3][axis];
      for (let k = 0; k < 4; k++) gradient[i + k][axis] += 2 * [-1, 3, -3, 1][k] * jerk;
    }
    let accepted = false;
    for (let step = .025; step >= .00001; step /= 2) {
      const candidate = positions.map((point, index) => {
        if (index === 0 || index === count) return [...point] as Vector3Tuple;
        const norm = Math.hypot(...gradient[index]);
        const scale = Math.min(step, .08 / Math.max(norm, 1e-9));
        const next = point.map((value, axis) => value - gradient[index][axis] * scale) as Vector3Tuple;
        const displacement = Math.hypot(...next.map((value, axis) => value - original[index][axis]));
        if (displacement > .75) for (let axis = 0; axis < 3; axis++) next[axis] = original[index][axis] + (next[axis] - original[index][axis]) * .75 / displacement;
        return next;
      });
      const nextCost = energy(candidate);
      if (nextCost < cost - 1e-9) { positions.splice(0, positions.length, ...candidate); cost = nextCost; accepted = true; break; }
    }
    if (!accepted) break;
  }
  if (cost >= beforeCost - 1e-8) return null;
  const times = positions.map((_, index) => shot.settings.duration * index / count);
  const nextShot: CameraShot = shot.cinemaTraj
    ? { ...shot, cinemaTraj: { ...shot.cinemaTraj, positions: positions.map((position, index) => ({ time: times[index], position })) } }
    : { ...shot, marks: positions.map((position, index) => {
      const pose = evaluate(times[index]);
      return { time: times[index], position: { x: position[0], y: position[1], z: position[2] }, pan: pose.pan, tilt: pose.tilt, roll: pose.roll,
        focalLength: pose.focalLength, easeIn: 0, easeOut: 0, hold: 0 };
    }) };
  const denseBefore = violations(original.flatMap((point, index) => index === count ? [point] : [point, ...[.25, .5, .75].map(fraction => evaluate(times[index] + (times[index + 1] - times[index]) * fraction).position)]), boxes);
  const nextEvaluate = compileShot(nextShot, targetAt);
  const denseAfter = violations(Array.from({ length: count * 4 + 1 }, (_, index) => nextEvaluate(shot.settings.duration * index / (count * 4)).position), boxes);
  if (denseAfter > denseBefore) return null;
  return { shot: nextShot, before: denseBefore, after: denseAfter };
}
