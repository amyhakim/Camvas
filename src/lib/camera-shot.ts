import { Box3, CatmullRomCurve3, Vector3 } from 'three';
import { CAMERA_MOVE_PRESETS, type CameraMarkSpec } from './blockout/camera-moves';
import { frameSubject, verticalFov } from './blockout/camera';
import { easedProgress, lerp, lerpAngle } from './blockout/easing';
import type { SensorId } from './blockout/types';

export const AUTHORED_CAMERA_ID = 'showcam:authored';
export type ShotSnapshot = {
  subjectId: string;
  subjectName: string;
  min: [number, number, number];
  max: [number, number, number];
  cameraPosition: [number, number, number];
};
export type ShotSettings = { presetId: string; duration: number; focalLength: number; sensor: SensorId; framing: 'wide' | 'full' | 'detail' };
export type CameraShot = {
  name: string;
  subjectId: string;
  subjectName: string;
  target: [number, number, number];
  settings: ShotSettings;
  marks: CameraMarkSpec[];
  trackSubject: boolean;
};

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

export function shotEndFrame(shot: CameraShot, fps: number) { return Math.ceil(shot.settings.duration * fps) + 1; }

/** Compile once per edit, then evaluate at any time without accumulating playback state. */
export function compileShot(shot: CameraShot) {
  const marks = shot.marks;
  const curve = new CatmullRomCurve3(marks.map(mark => new Vector3(mark.position.x, mark.position.y, mark.position.z)), false, 'centripetal');
  return (seconds: number) => {
    const t = Math.max(0, Math.min(shot.settings.duration, seconds));
    let i = marks.findIndex((mark, index) => index < marks.length - 1 && t < marks[index + 1].time);
    if (i < 0) i = marks.length - 2;
    const a = marks[i], b = marks[i + 1];
    const departure = Math.min(b.time, a.time + a.hold);
    const u = easedProgress((t - departure) / Math.max(.0001, b.time - departure), a.easeOut, b.easeIn);
    const p = curve.getPoint((i + u) / (marks.length - 1));
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

/** Frame the complete path inside the unobstructed part of the viewport (normalized 0..1). */
export function framePath(points: [number, number, number][], subject: [number, number, number], aspect: number, region: { left: number; right: number; top: number; bottom: number }) {
  const bounds = new Box3().setFromPoints(points.map(point => new Vector3(...point))).expandByPoint(new Vector3(...subject));
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(1, bounds.getSize(new Vector3()).length() / 2);
  const fov = 52;
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * aspect;
  const fitV = Math.atan(tanV * Math.max(.1, region.bottom - region.top));
  const fitH = Math.atan(tanH * Math.max(.1, region.right - region.left));
  const distance = radius * 1.15 / Math.sin(Math.min(fitV, fitH));
  const direction = new Vector3(.6, .3, 1).normalize();
  const right = new Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  // Move camera and orbit target together so the path lands in the clear rectangle.
  const shift = right.multiplyScalar((1 - region.left - region.right) * distance * tanH)
    .addScaledVector(up, (region.top + region.bottom - 1) * distance * tanV);
  return { position: center.clone().addScaledVector(direction, distance).add(shift).toArray(), target: center.add(shift).toArray(), fov };
}
