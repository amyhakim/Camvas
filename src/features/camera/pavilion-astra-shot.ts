import { CatmullRomCurve3, Vector3 } from 'three';
import type { CameraMark, CameraShot, TimedPoint, Vector3Tuple } from '../../contracts';

/** Astra's measured Pavilion tour. Camera samples are Y-up metres and play linearly between keys. */
export function pavilionAstraShot(): CameraShot {
  const duration = 40;
  const controls: Vector3Tuple[] = [
    [-14, 3.6, 8], [-10, 3.3, 8], [-5, 3.1, 7], [-2, 3, 6], [-1.4, 3, 3],
    [-1.6, 3, 0], [-0.3, 3, -1.8], [3.4, 3, -1.7], [4.2, 3, 0.3], [3.5, 2.85, 2.2],
  ];
  const curve = new CatmullRomCurve3(controls.map(point => new Vector3(...point)), false, 'centripetal');
  curve.arcLengthDivisions = 4000;
  curve.updateArcLengths();
  const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
  const startTarget: Vector3Tuple = [1, 2.6, 3];
  const chairTarget: Vector3Tuple = [0.965, 1.955, 1.1];
  const finalTarget: Vector3Tuple = [1.3, 2.3, .5];
  const positions: TimedPoint[] = [];
  const targets: TimedPoint[] = [];
  for (let i = 0; i <= 180; i++) {
    const time = duration * i / 180;
    const progress = smooth(i / 180);
    const blend = smooth(Math.min(1, progress / .45));
    positions.push({ time, position: curve.getPointAt(progress).toArray() });
    targets.push({ time, position: startTarget.map((value, axis) => value + (chairTarget[axis] - value) * blend) as Vector3Tuple });
  }
  // The last eight seconds return to the lounge's open side for a wider chair reveal.
  const revealControls: Vector3Tuple[] = [
    [4.155479750468216, 2.980103082664245, .6728576980072523],
    [3.949628625868953, 2.923632916728147, 1.532337257621348],
    [3.5, 3.35, 3.5], [0, 3.35, 3.3], [-2.8, 3.05, 2.8], [-2.8, 3.05, 2.8],
  ];
  const bezier = (u: number): Vector3Tuple => {
    const points = revealControls.map(point => [...point] as Vector3Tuple);
    for (let count = 5; count > 0; count--) for (let i = 0; i < count; i++) {
      points[i] = points[i].map((value, axis) => value + (points[i + 1][axis] - value) * u) as Vector3Tuple;
    }
    return points[0];
  };
  for (let i = 0; i < positions.length; i++) {
    const time = positions[i].time;
    if (time <= 32) continue;
    const blend = smooth((time - 32) / 8);
    positions[i].position = bezier((time - 32) / 8);
    targets[i].position = chairTarget.map((value, axis) => value + (finalTarget[axis] - value) * blend) as Vector3Tuple;
  }
  const mark = (point: TimedPoint, target: Vector3Tuple, focalLength: number): CameraMark => {
    const [x, y, z] = point.position;
    const dx = target[0] - x, dy = target[1] - y, dz = target[2] - z;
    return { time: point.time, position: { x, y, z }, pan: Math.atan2(-dx, -dz), tilt: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0,
      focalLength, easeIn: .5, easeOut: .5, hold: 0 };
  };
  return {
    name: 'Astra · Pool approach and Pavilion lounge reveal', subjectId: 'Group', subjectName: 'White leather lounge chair', target: finalTarget,
    settings: { presetId: 'drone-orbit-high', duration, focalLength: 24, sensor: 'fullFrame', framing: 'wide' },
    marks: [mark(positions[0], targets[0].position, 24), mark(positions[144], targets[144].position, 27.5), mark(positions.at(-1)!, targets.at(-1)!.position, 20)],
    trackSubject: true, cinemaTraj: { positions, targets },
  };
}
