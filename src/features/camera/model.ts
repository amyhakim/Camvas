import { CatmullRomCurve3, Vector3 } from 'three';
import { CAMERA_MOVE_PRESETS } from '../../vendor/blockout/camera-moves';
import { frameSubject, verticalFov } from '../../vendor/blockout/camera';
import { easedProgress, lerp, lerpAngle } from '../../vendor/blockout/easing';
import type { CameraShot, ShotSnapshot, ShotSettings, CameraPose, NavigationRoute, PathPreview, SemanticAnchor } from '../../contracts';

export const AUTHORED_CAMERA_ID = 'showcam:authored';
/** Adapts arbitrary imported mesh origins to Blockout's subject-at-ground convention. */
export function generateShot(snapshot: ShotSnapshot, settings: ShotSettings): CameraShot {
  if (!Number.isFinite(settings.duration) || settings.duration < 1 || settings.duration > 60) throw new Error('Duration must be between 1 and 60 seconds.');
  if (!Number.isFinite(settings.focalLength) || settings.focalLength < 8 || settings.focalLength > 300) throw new Error('Lens must be between 8 and 300 mm.');
  const preset = CAMERA_MOVE_PRESETS.find(move => move.id === settings.presetId);
  if (!preset) throw new Error('Choose a camera move.');
  if (![...snapshot.min, ...snapshot.max, ...snapshot.cameraPosition].every(Number.isFinite)) throw new Error('The subject bounds are unavailable. Select another object.');
  const target = snapshot.min.map((v, i) => (v + snapshot.max[i]) / 2) as [number, number, number];
  const extent = snapshot.max.map((v, i) => v - snapshot.min[i]);
  const height = Math.max(.2, extent[1], Math.hypot(extent[0], extent[2]) / (16 / 9));
  const distance = frameSubject(settings.framing === 'wide' ? 'WS' : settings.framing === 'full' ? 'FS' : 'MS', height, settings.sensor, settings.focalLength, '16:9').distance;
  const aim = new Vector3(...target);
  const direction = new Vector3(...snapshot.cameraPosition).sub(aim);
  if (direction.lengthSq() < .01) direction.set(0, .2, 1);
  const start = direction.normalize().multiplyScalar(distance).add(aim);
  const subject = { x: target[0], y: target[1] - height * .8, z: target[2], heading: 0 };
  const marks = preset.generate({ subjectAt: () => subject, subjectHeight: height, duration: settings.duration,
    camera: { x: start.x, y: start.y, z: start.z, pan: 0, tilt: 0, focalLength: settings.focalLength } });
  return { name: preset.name, subjectId: snapshot.subjectId, subjectName: snapshot.subjectName, target, settings: { ...settings }, marks, trackSubject: preset.track };
}

export function generateRouteShot(route: NavigationRoute, anchor: SemanticAnchor, settings: ShotSettings): CameraShot {
  if (route.points.length < 2) throw new Error('The safe route needs at least two positions.');
  const total = Math.max(.001, route.distance);
  let travelled = 0;
  const marks = route.points.map((point, index) => {
    if (index) travelled += new Vector3(...point).distanceTo(new Vector3(...route.points[index - 1]));
    const next = route.points[Math.min(route.points.length - 1, index + 1)];
    const aim = index === route.points.length - 1 ? anchor.lookAt : next;
    const dx = aim[0] - point[0], dy = aim[1] - point[1], dz = aim[2] - point[2];
    return {
      time: settings.duration * travelled / total,
      position: { x: point[0], y: point[1], z: point[2] },
      pan: Math.atan2(-dx, -dz), tilt: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0,
      focalLength: settings.focalLength, easeIn: .25, easeOut: .25, hold: 0,
    };
  });
  return {
    name: `Safe flight · ${anchor.label}`,
    subjectId: anchor.id,
    subjectName: anchor.label,
    target: [...anchor.lookAt],
    settings: { ...settings }, marks, trackSubject: false,
    pathInterpolation: route.interpolation,
  };
}

export function shotEndFrame(shot: CameraShot, fps: number) { return Math.ceil(shot.settings.duration * fps) + 1; }

/** Compile once per edit, then evaluate at any time without accumulating playback state. */
export function compileShot(shot: CameraShot): (seconds: number) => CameraPose {
  const marks = shot.marks;
  const curve = shot.pathInterpolation === 'linear' ? null : new CatmullRomCurve3(marks.map(mark => new Vector3(mark.position.x, mark.position.y, mark.position.z)), false, 'centripetal');
  return (seconds: number) => {
    const t = Math.max(0, Math.min(shot.settings.duration, seconds));
    let i = marks.findIndex((mark, index) => index < marks.length - 1 && t < marks[index + 1].time);
    if (i < 0) i = marks.length - 2;
    const a = marks[i], b = marks[i + 1];
    const departure = Math.min(b.time, a.time + a.hold);
    const u = easedProgress((t - departure) / Math.max(.0001, b.time - departure), a.easeOut, b.easeIn);
    const p = curve ? curve.getPoint((i + u) / (marks.length - 1)) : new Vector3().lerpVectors(
      new Vector3(a.position.x, a.position.y, a.position.z), new Vector3(b.position.x, b.position.y, b.position.z), u,
    );
    let pan = lerpAngle(a.pan, b.pan, u), tilt = lerpAngle(a.tilt, b.tilt, u);
    if (shot.trackSubject) {
      const dx = shot.target[0] - p.x, dy = shot.target[1] - p.y, dz = shot.target[2] - p.z;
      pan = Math.atan2(-dx, -dz); tilt = Math.atan2(dy, Math.hypot(dx, dz));
    }
    const focalLength = lerp(a.focalLength, b.focalLength, u);
    return { position: p.toArray(), pan, tilt, roll: lerpAngle(a.roll, b.roll, u), focalLength,
      fov: verticalFov(shot.settings.sensor, focalLength, '16:9') * 180 / Math.PI };
  };
}


export function createPathPreview(shot: CameraShot): PathPreview {
  const evaluate = compileShot(shot);
  return { points: Array.from({ length: 121 }, (_, i) => evaluate(shot.settings.duration * i / 120).position), marks: shot.marks.map(mark => [mark.position.x, mark.position.y, mark.position.z]), target: [...shot.target] };
}
