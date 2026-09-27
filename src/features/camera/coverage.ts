import type { CameraShot, ShotSettings, ShotSnapshot, Vector3Tuple } from '../../contracts';
import { frameSubject } from '../../vendor/blockout/camera';
import type { SubjectMotion } from './model';

/** Stationary coverage at subject height. All angles share the scene's blocking. */
export function generateCoverage(snapshot: ShotSnapshot, motion?: SubjectMotion, duration = 3): CameraShot[] {
  if (!Number.isFinite(duration) || duration < 1 || duration > 60) throw new Error('Shot duration must be 1–60 seconds.');
  if (![...snapshot.min, ...snapshot.max, ...snapshot.cameraPosition].every(Number.isFinite)) throw new Error('The subject bounds are not ready.');
  const specs = [
    { name: 'Wide', framing: 'wide', size: 'WS', lens: 35, angle: 0 },
    { name: 'Medium', framing: 'medium', size: 'MS', lens: 50, angle: .25 },
    { name: 'Close-up', framing: 'close', size: 'CU', lens: 85, angle: .25 },
  ] as const;
  return specs.map(spec => ({ ...generateStaticShot(snapshot, { presetId: 'static-coverage', duration, focalLength: spec.lens, sensor: 'fullFrame', framing: spec.framing }, motion, spec.angle), name: `${spec.name} · ${snapshot.subjectName}`.slice(0, 100) }));
}

export function generateStaticShot(snapshot: ShotSnapshot, settings: ShotSettings, motion?: SubjectMotion, angleOffset = 0): CameraShot {
  const center = snapshot.min.map((value, axis) => (value + snapshot.max[axis]) / 2) as Vector3Tuple;
  const height = motion?.height ?? Math.max(.2, snapshot.max[1] - snapshot.min[1]);
  const feet = motion?.at(0).position ?? [center[0], snapshot.min[1], center[2]];
  const bearing = Math.atan2(snapshot.cameraPosition[0] - center[0], snapshot.cameraPosition[2] - center[2]);
  const size = settings.framing === 'wide' ? 'WS' : settings.framing === 'full' ? 'FS' : settings.framing === 'close' ? 'CU' : 'MS';
  const framing = frameSubject(size, height, settings.sensor, settings.focalLength, '16:9');
  const target: Vector3Tuple = [feet[0], motion ? feet[1] + framing.targetHeight : center[1], feet[2]];
  const distance = Math.max(.3, framing.distance, size === 'WS' ? Math.hypot(snapshot.max[0] - snapshot.min[0], snapshot.max[2] - snapshot.min[2]) : 0);
  const angle = bearing + angleOffset;
  const position = { x: target[0] + Math.sin(angle) * distance, y: target[1], z: target[2] + Math.cos(angle) * distance };
  const mark = { position, pan: Math.atan2(position.x - target[0], position.z - target[2]), tilt: 0, roll: 0, focalLength: settings.focalLength, easeIn: 0, easeOut: 0, hold: 0 };
  return { name: `Static ${settings.framing} · ${snapshot.subjectName}`.slice(0, 100), subjectId: snapshot.subjectId, subjectName: snapshot.subjectName, target,
    settings: { ...settings }, marks: [{ ...structuredClone(mark), time: 0 }, { ...structuredClone(mark), time: settings.duration }], trackSubject: false,
    ...(motion?.signature ? { subjectSignature: motion.signature } : {}) };
}
