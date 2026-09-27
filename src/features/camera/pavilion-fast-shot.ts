import type { CameraShot, SceneLandmark, TimedPoint, Vector3Tuple } from '../../contracts';
import { CAMERA_MOVE_PRESETS } from '../../vendor/blockout/camera-moves';
import { pavilionAstraShot } from './pavilion-astra-shot';

/** Landmark-constrained interior, followed by two original Blockout exterior moves. */
export function pavilionFastShot(landmarks: readonly SceneLandmark[]): CameraShot {
  const shot = pavilionAstraShot(landmarks);
  const keep = (key: TimedPoint, index: number) => index % 2 === 0 || landmarks.some(mark => mark.position.every((v, axis) => v === key.position[axis]));
  const positions = shot.cinemaTraj!.positions.filter(keep).map(key => ({ ...key, time: key.time * .4 }));
  const targets = shot.cinemaTraj!.targets.filter((_, index) => keep(shot.cinemaTraj!.positions[index], index)).map(key => ({ ...key, time: key.time * .4 }));
  const marks = shot.marks.map(mark => ({ ...mark, time: mark.time * .4, focalLength: 22 }));
  let start = 24;
  for (const [id, duration] of [['pull-back-reveal', 3], ['drone-rise-pullback', 5]] as const) {
    const last = positions.at(-1)!.position;
    // Ground-level sampler keeps the upstream aerial move's initial height continuous.
    const generated = CAMERA_MOVE_PRESETS.find(preset => preset.id === id)!.generate({
      subjectAt: () => ({ x: 0, y: 0, z: 3, heading: 0 }), subjectHeight: 0, duration,
      camera: { x: last[0], y: last[1], z: last[2], pan: 0, tilt: 0, focalLength: 22 },
    });
    for (const mark of generated.slice(1)) {
      const position: Vector3Tuple = [mark.position.x, mark.position.y, mark.position.z];
      positions.push({ time: start + mark.time, position });
      targets.push({ time: start + mark.time, position: [...shot.target] });
      marks.push({ ...mark, time: start + mark.time });
    }
    start += duration;
  }
  return { ...shot, name: 'Fast Pavilion · Interior passage + Blockout aerial reveal',
    settings: { ...shot.settings, presetId: 'drone-rise-pullback', duration: start, focalLength: 22 },
    marks, cinemaTraj: { positions: positions as TimedPoint[], targets } };
}
