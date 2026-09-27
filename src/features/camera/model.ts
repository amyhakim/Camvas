import { CatmullRomCurve3, Vector3 } from 'three';
import { CAMERA_MOVE_PRESETS } from '../../vendor/blockout/camera-moves';
import { frameSubject, verticalFov } from '../../vendor/blockout/camera';
import { easedProgress, lerp, lerpAngle } from '../../vendor/blockout/easing';
import type { CameraShot, ShotSnapshot, ShotSettings, CameraPose, PathPreview, Vector3Tuple } from '../../contracts';

/** Feet position and heading of a moving subject at authored time t (seconds, t0 = frame 1). */
export type SubjectMotion = { height: number; at: (seconds: number) => { position: Vector3Tuple; heading: number }; signature?: string };
/** Aim point of a moving subject at authored time t; overrides the stored static target while tracking. */
export type TargetSampler = (seconds: number) => Vector3Tuple;
export function motionTarget(motion: SubjectMotion): TargetSampler {
  return seconds => { const { position } = motion.at(seconds); return [position[0], position[1] + motion.height * .8, position[2]]; };
}

export const AUTHORED_CAMERA_ID = 'showcam:authored';
/** Adapts arbitrary imported mesh origins to Blockout's subject-at-ground convention. */
export function generateShot(snapshot: ShotSnapshot, settings: ShotSettings, motion?: SubjectMotion): CameraShot {
  if (!Number.isFinite(settings.duration) || settings.duration < 1 || settings.duration > 60) throw new Error('Duration must be between 1 and 60 seconds.');
  if (!Number.isFinite(settings.focalLength) || settings.focalLength < 8 || settings.focalLength > 300) throw new Error('Lens must be between 8 and 300 mm.');
  const preset = CAMERA_MOVE_PRESETS.find(move => move.id === settings.presetId);
  if (!preset) throw new Error('Choose a camera move.');
  if (![...snapshot.min, ...snapshot.max, ...snapshot.cameraPosition].every(Number.isFinite)) throw new Error('The subject bounds are unavailable. Select another object.');
  const extent = snapshot.max.map((v, i) => v - snapshot.min[i]);
  const height = Math.max(.2, extent[1], Math.hypot(extent[0], extent[2]) / (16 / 9));
  // A moving subject aims at 0.8× its height above the feet, matching Blockout's convention and live tracking.
  const target = (motion ? motionTarget(motion)(0) : snapshot.min.map((v, i) => (v + snapshot.max[i]) / 2)) as Vector3Tuple;
  const distance = frameSubject(settings.framing === 'wide' ? 'WS' : settings.framing === 'full' ? 'FS' : 'MS', height, settings.sensor, settings.focalLength, '16:9').distance;
  const aim = new Vector3(...target);
  const direction = new Vector3(...snapshot.cameraPosition).sub(aim);
  if (direction.lengthSq() < .01) direction.set(0, .2, 1);
  const start = direction.normalize().multiplyScalar(distance).add(aim);
  const still = { x: target[0], y: target[1] - height * .8, z: target[2], heading: 0 };
  const subjectAt = motion ? (t: number) => { const pose = motion.at(t); return { x: pose.position[0], y: pose.position[1], z: pose.position[2], heading: pose.heading }; } : () => still;
  const marks = preset.generate({ subjectAt, subjectHeight: motion ? motion.height : height, duration: settings.duration,
    camera: { x: start.x, y: start.y, z: start.z, pan: 0, tilt: 0, focalLength: settings.focalLength } });
  return { name: preset.name, subjectId: snapshot.subjectId, subjectName: snapshot.subjectName, target, settings: { ...settings }, marks,
    // Following a moving subject only works when the aim is locked to it.
    trackSubject: preset.track || !!motion, ...(motion?.signature ? { subjectSignature: motion.signature } : {}) };
}

export function shotEndFrame(shot: CameraShot, fps: number) { return Math.ceil(shot.settings.duration * fps) + 1; }

/**
 * Compile once per edit, then evaluate at any time without accumulating playback state. Marks flagged `cut` start a
 * new shot: the camera holds the previous mark until the cut's time, then jumps. Each run between cuts gets its own
 * spline so the path never bends toward the next shot. Per-mark `aim` points blend between marks while tracking.
 */
export function compileShot(shot: CameraShot, targetAt?: TargetSampler): (seconds: number) => CameraPose {
  const marks = shot.marks;
  const runs: number[][] = [];
  marks.forEach((mark, index) => { if (index === 0 || mark.cut) runs.push([index]); else runs[runs.length - 1].push(index); });
  const runOf = new Map<number, { curve: CatmullRomCurve3 | null; start: number; length: number }>();
  for (const run of runs) {
    const curve = run.length > 1 ? new CatmullRomCurve3(run.map(i => new Vector3(marks[i].position.x, marks[i].position.y, marks[i].position.z)), false, 'centripetal') : null;
    for (const i of run) runOf.set(i, { curve, start: run[0], length: run.length });
  }
  const aimed = marks.some(mark => mark.aim);
  const sample = (points: { time: number; position: [number, number, number] }[], t: number) => {
    if (t <= points[0].time) return points[0].position;
    const end = points.findIndex(point => point.time >= t);
    if (end < 0) return points[points.length - 1].position;
    const a = points[end - 1], b = points[end], u = (t - a.time) / (b.time - a.time);
    return a.position.map((value, axis) => lerp(value, b.position[axis], u)) as [number, number, number];
  };
  return (seconds: number) => {
    const t = Math.max(0, Math.min(shot.settings.duration, seconds));
    let i = marks.findIndex((mark, index) => index < marks.length - 1 && t < marks[index + 1].time);
    if (i < 0) i = marks.length - 2;
    const a = marks[i], b = marks[i + 1];
    const departure = Math.min(b.time, a.time + a.hold);
    // Across a cut the camera does not travel: it holds `a` until the cut lands.
    const u = b.cut ? 0 : easedProgress((t - departure) / Math.max(.0001, b.time - departure), a.easeOut, b.easeIn);
    const run = runOf.get(i)!;
    const p = shot.cinemaTraj ? new Vector3(...sample(shot.cinemaTraj.positions, t))
      : run.curve ? run.curve.getPoint((i - run.start + u) / (run.length - 1)) : new Vector3(a.position.x, a.position.y, a.position.z);
    let pan = lerpAngle(a.pan, b.pan, u), tilt = lerpAngle(a.tilt, b.tilt, u);
    let focus: number | undefined;
    if (shot.trackSubject) {
      const aim = aimed ? (a.aim ?? shot.target).map((value, axis) => lerp(value, (b.aim ?? shot.target)[axis], u))
        : targetAt ? targetAt(t) : shot.cinemaTraj ? sample(shot.cinemaTraj.targets, t) : shot.target;
      const dx = aim[0] - p.x, dy = aim[1] - p.y, dz = aim[2] - p.z;
      pan = Math.atan2(-dx, -dz); tilt = Math.atan2(dy, Math.hypot(dx, dz));
      focus = Math.hypot(dx, dy, dz);
    }
    const focalLength = lerp(a.focalLength, b.focalLength, u);
    return { position: p.toArray(), pan, tilt, roll: lerpAngle(a.roll, b.roll, u), focalLength,
      fov: verticalFov(shot.settings.sensor, focalLength, '16:9') * 180 / Math.PI, ...(focus === undefined ? {} : { focus }) };
  };
}

/** Lens for a vertical field of view (degrees) on the shot's sensor at 16:9, clamped to 8–300 mm. */
export function focalForFov(sensor: CameraShot['settings']['sensor'], fov: number) {
  const reference = verticalFov(sensor, 50, '16:9');
  const focal = 50 * Math.tan(reference / 2) / Math.tan(fov * Math.PI / 360);
  return Math.min(300, Math.max(8, focal));
}

export function createPathPreview(shot: CameraShot, targetAt?: TargetSampler): PathPreview {
  const evaluate = compileShot(shot, targetAt);
  return { points: Array.from({ length: 121 }, (_, i) => evaluate(shot.settings.duration * i / 120).position), marks: shot.marks.map(mark => [mark.position.x, mark.position.y, mark.position.z]), target: [...shot.target] };
}
