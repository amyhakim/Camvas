import { CatmullRomCurve3, Vector3 } from 'three';
import type { CameraMark, CameraShot, TimedPoint, Vector3Tuple } from '../../contracts';
import { CAMERA_MOVE_PRESETS } from '../../vendor/blockout/camera-moves';

/** A fresh interior-first tour; deliberately has no dependency on saved landmarks. */
export function pavilionInteriorShot(): CameraShot {
  const controls: Vector3Tuple[] = [
    [2.5, 3, -1.6], [3.25, 3, -1.55], [4.05, 3.05, .15],
    [3.3, 3.05, 1.3], [1.45, 3.05, 2.1], [.3, 3, 1.65],
    [-.35, 3, 1.1], [-1.25, 3, 2.2], [-1.75, 3.1, 3.35],
    [-2.4, 3.2, 4.6], [-4.4, 3.35, 5.9], [-7, 3.2, 7],
    [-11, 3.1, 8], [-15, 3.4, 8.5], [-17, 3.8, 8],
  ];
  const times = [0, 2, 3.5, 5, 6.5, 7.3, 8, 9, 10, 11, 12, 13.5, 15, 17, 18];
  const curve = new CatmullRomCurve3(controls.map(p => new Vector3(...p)), false, 'centripetal');
  const positions: TimedPoint[] = [];
  for (let i = 0; i < controls.length - 1; i++) for (let s = 0; s < 10; s++) {
    const u = s / 10;
    positions.push({ time: times[i] + (times[i + 1] - times[i]) * u,
      position: curve.getPoint((i + u) / (controls.length - 1)).toArray() });
  }
  positions.push({ time: 18, position: controls.at(-1)! }, { time: 22, position: controls.at(-1)! });
  const gazes: TimedPoint[] = [
    { time: 0, position: [4.2, 2.6, 3.8] },
    { time: 3.5, position: [.965, 1.955, 1.1] },
    { time: 6.5, position: [.965, 1.955, 1.1] },
    { time: 9, position: [-2.4, 2.7, 4.6] },
    { time: 12, position: [-10, 1.3, 6] },
    { time: 15, position: [-18, 1.3, 5] },
    { time: 18, position: [-11, 1.4, 6.7] },
    { time: 22, position: [-11, 1.4, 6.7] },
  ];
  const targetAt = (time: number): Vector3Tuple => {
    const end = gazes.findIndex(g => g.time > time);
    if (end < 0) return gazes.at(-1)!.position;
    const a = gazes[Math.max(0, end - 1)], b = gazes[end];
    const u = Math.max(0, (time - a.time) / (b.time - a.time));
    const eased = u * u * (3 - 2 * u);
    return a.position.map((v, axis) => v + (b.position[axis] - v) * eased) as Vector3Tuple;
  };
  const mark = (key: TimedPoint, focalLength: number): CameraMark => ({ time: key.time,
    position: { x: key.position[0], y: key.position[1], z: key.position[2] },
    pan: 0, tilt: 0, roll: 0, focalLength, easeIn: .25, easeOut: .25, hold: 0 });
  const zoom = CAMERA_MOVE_PRESETS.find(p => p.id === 'snap-zoom-punch')!.generate({
    duration: 4, subjectHeight: 0, subjectAt: () => ({ x: -11, y: 1.4, z: 6.7, heading: 0 }),
    camera: { x: -17, y: 3.8, z: 8, pan: 0, tilt: 0, focalLength: 35 },
  });
  const marks = [mark(positions[0], 22), mark(positions.find(p => p.time === 12)!, 24),
    ...zoom.map(m => ({ ...m, time: m.time + 18 }))];
  return { name: 'Inside → chairs → pool sweep → zoom', subjectId: 'Group', subjectName: 'Pavilion interior, lounge chairs and reflecting pool',
    target: [-11, 1.4, 6.7], settings: { presetId: 'snap-zoom-punch', duration: 22, focalLength: 22, sensor: 'fullFrame', framing: 'wide' },
    marks, trackSubject: true, cinemaTraj: { positions, targets: positions.map(p => ({ time: p.time, position: targetAt(p.time) })) } };
}
