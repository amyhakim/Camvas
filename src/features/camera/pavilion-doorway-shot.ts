import { CatmullRomCurve3, Quaternion, Vector3 } from 'three';
import type { CameraMark, CameraShot, TimedPoint, Vector3Tuple } from '../../contracts';

/** Passage between the two angled glazed panels; glass itself is never treated as a door. */
export const PAVILION_DOORWAY_CONTROLS: Vector3Tuple[] = [
  [4, 3, 9], [4, 3, 6], [4.3, 3, 5.2], [5.2, 3, 5.2], [6.2, 3, 5.2],
  [8, 3, 5.2], [9.8, 3, 5.2], [10.2, 3, 3], [10, 3, .4],
  [8.5, 3, .2], [7.2, 3, .7], [8, 3, 1.4], [9.8, 3, 2],
  [10.2, 3, 4.8], [9, 3, 5.3], [7, 3, 5.2], [6.2, 3, 5.2],
  [5.2, 3, 5.2], [4.3, 3, 5.2], [2, 3, 5.7], [-1, 3.1, 6.2],
  [-5, 3.2, 7], [-10, 3.6, 8], [-14, 4.2, 9],
];
const ease = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

export function pavilionDoorwayShot(): CameraShot {
  const curve = new CatmullRomCurve3(PAVILION_DOORWAY_CONTROLS.map(p => new Vector3(...p)), false, 'centripetal');
  curve.arcLengthDivisions = 10000; curve.updateArcLengths();
  const length = curve.getLength();
  // Arc-length pacing removes the speed jumps caused by unevenly spaced control points.
  // The velocity envelope eases in/out over 3 seconds, with a steady middle section.
  const travel = 38, ramp = 3, totalWeight = travel - ramp;
  const integral = (t: number) => t < ramp ? ramp * (Math.pow(t / ramp, 3) - .5 * Math.pow(t / ramp, 4))
    : t > travel - ramp ? totalWeight - ramp * (Math.pow((travel - t) / ramp, 3) - .5 * Math.pow((travel - t) / ramp, 4))
      : t - ramp / 2;
  const positions: TimedPoint[] = Array.from({ length: 229 }, (_, i) => {
    const time = travel * i / 228;
    return { time, position: curve.getPointAt(integral(time) / totalWeight).toArray() };
  });
  for (let time = 39; time <= 44; time++) positions.push({ time, position: [...positions.at(-1)!.position] });
  // Aim follows the entrance, marble end, chair, exit and pool; blend targets over distance.
  const lengths = curve.getLengths(10000);
  const keys = [
    { index: 0, point: [5.5, 2.9, 5.2] }, { index: 4, point: [9.6, 2.8, 4.8] },
    { index: 7, point: [8, 2.5, .8] }, { index: 9, point: [7.25, 1.95, 2.46] },
    { index: 11, point: [7.25, 1.95, 2.46] }, { index: 13, point: [7, 2.9, 5.2] },
    { index: 16, point: [4.1, 2.9, 5.2] }, { index: 19, point: [-8, 1.5, 6] },
    { index: 21, point: [-12, 1.4, 6] }, { index: 23, point: [2, 2.8, 3] },
  ].map(key => ({ ...key, fraction: lengths[Math.round(key.index * 10000 / (PAVILION_DOORWAY_CONTROLS.length - 1))] / length }));
  const targets = positions.map(key => {
    const fraction = integral(Math.min(travel, key.time)) / totalWeight;
    const end = keys.findIndex(k => k.fraction > fraction);
    if (end < 0) return { time: key.time, position: [2, 2.8, 3] as Vector3Tuple };
    const a = keys[Math.max(0, end - 1)], b = keys[end];
    const u = ease(Math.max(0, (fraction - a.fraction) / (b.fraction - a.fraction)));
    return { time: key.time, position: a.point.map((v, axis) => v + (b.point[axis] - v) * u) as Vector3Tuple };
  });
  // Smooth directions rather than target coordinates: a target crossing close to
  // the camera can otherwise cause a whip-pan even along a gentle flight path.
  let direction = new Vector3(...targets[0].position).sub(new Vector3(...positions[0].position)).normalize();
  for (let i = 0; i < targets.length; i++) {
    const position = new Vector3(...positions[i].position);
    const desired = new Vector3(...targets[i].position).sub(position).normalize();
    if (i) {
      const dt = positions[i].time - positions[i - 1].time;
      const angle = direction.angleTo(desired);
      const fraction = Math.min(1 - Math.exp(-dt / .9), (28 * Math.PI / 180) * dt / Math.max(angle, 1e-9));
      const turn = new Quaternion().setFromUnitVectors(direction, desired);
      direction.applyQuaternion(new Quaternion().slerp(turn, fraction)).normalize();
    }
    targets[i].position = position.addScaledVector(direction, 8).toArray();
  }
  const mark = (time: number, focalLength: number): CameraMark => {
    const p = positions.find(key => key.time >= time)!.position;
    return { time, position: { x: p[0], y: p[1], z: p[2] }, pan: 0, tilt: 0, roll: 0, focalLength, easeIn: .5, easeOut: .5, hold: 0 };
  };
  return { name: 'Smooth doorway · interior, chairs, pool & gentle zoom', subjectId: 'Group.002', subjectName: 'Pavilion doorway and interior lounge',
    settings: { presetId: 'slow-push-in', duration: 44, focalLength: 22, sensor: 'fullFrame', framing: 'wide' },
    target: [2, 2.8, 3], trackSubject: true, marks: [mark(0, 22), mark(38, 22), mark(44, 45)],
    cinemaTraj: { positions, targets } };
}
