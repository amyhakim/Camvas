import { CatmullRomCurve3, Vector3 } from 'three';
import type { CameraMark, CameraShot, SceneLandmark, TimedPoint, Vector3Tuple } from '../../contracts';

const duration = 60;
const smooth = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);
const interpolate = (from: Vector3Tuple, to: Vector3Tuple, u: number): Vector3Tuple => from.map((value, axis) => value + (to[axis] - value) * u) as Vector3Tuple;

/** Astra's Pavilion plan is generated from ordered, named camera-eye landmarks. */
export function pavilionAstraShot(landmarks: readonly SceneLandmark[]): CameraShot {
  if (landmarks.length !== 29 || landmarks.some(mark => mark.kind !== 'flight')) throw new Error('The Pavilion flight needs its 29 ordered camera landmarks.');
  const anchors = landmarks.map(mark => mark.position);
  // Each landmark is a spline control point. The camera enters, crosses the
  // lounge, then retraces the safe courtyard opening before leaving outside.
  const curve = new CatmullRomCurve3(anchors.map(point => new Vector3(...point)), false, 'centripetal');
  curve.arcLengthDivisions = 56000;
  curve.updateArcLengths();
  const lengths = curve.getLengths(56000);
  const totalLength = lengths.at(-1)!;
  const inverseSmooth = (fraction: number) => {
    let low = 0, high = 1;
    for (let i = 0; i < 60; i++) {
      const middle = (low + high) / 2;
      if (smooth(middle) < fraction) low = middle; else high = middle;
    }
    return (low + high) / 2;
  };
  const anchorTimes = anchors.map((_, index) => duration * inverseSmooth(lengths[Math.round(index * 56000 / (anchors.length - 1))] / totalLength));
  anchorTimes[0] = 0;
  anchorTimes[anchors.length - 1] = duration;

  // Include every interior landmark as an exact key, then sample the curve between them.
  const regularSamples = 213;
  const positions: TimedPoint[] = Array.from({ length: regularSamples }, (_, index) => ({ time: duration * index / (regularSamples - 1), position: curve.getPointAt(smooth(index / (regularSamples - 1))).toArray() }));
  for (let index = 1; index < anchors.length - 1; index++) positions.push({ time: anchorTimes[index], position: [...anchors[index]] });
  positions[0].position = [...anchors[0]];
  positions[regularSamples - 1].position = [...anchors.at(-1)!];
  positions.sort((a, b) => a.time - b.time);

  const startTarget: Vector3Tuple = [0, 2.6, 3];
  const loungeTarget: Vector3Tuple = [1.1, 2.05, .6];
  const chairTarget: Vector3Tuple = [.965, 1.955, 1.1];
  const exitTarget: Vector3Tuple = [-3.5, 2.4, 4.8];
  const finalTarget: Vector3Tuple = [0, 2.8, 3];
  const targets: TimedPoint[] = positions.map(point => {
    const time = point.time;
    const position = time <= anchorTimes[8]
      ? interpolate(startTarget, loungeTarget, smooth(time / anchorTimes[8]))
      : time <= anchorTimes[16] ? interpolate(loungeTarget, chairTarget, smooth((time - anchorTimes[8]) / (anchorTimes[16] - anchorTimes[8])))
        : time <= anchorTimes[22] ? interpolate(chairTarget, exitTarget, smooth((time - anchorTimes[16]) / (anchorTimes[22] - anchorTimes[16])))
          : interpolate(exitTarget, finalTarget, smooth((time - anchorTimes[22]) / (duration - anchorTimes[22])));
    return { time, position };
  });
  const mark = (point: TimedPoint, target: Vector3Tuple, focalLength: number): CameraMark => {
    const [x, y, z] = point.position;
    const dx = target[0] - x, dy = target[1] - y, dz = target[2] - z;
    return { time: point.time, position: { x, y, z }, pan: Math.atan2(-dx, -dz), tilt: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0,
      focalLength, easeIn: .5, easeOut: .5, hold: 0 };
  };
  const markAt = (anchorIndex: number) => positions.findIndex(point => point.time === anchorTimes[anchorIndex]);
  return {
    name: 'Astra · Pavilion house passage and exterior flight', subjectId: 'Group', subjectName: 'White leather lounge chair', target: finalTarget,
    settings: { presetId: 'drone-orbit-high', duration, focalLength: 24, sensor: 'fullFrame', framing: 'wide' },
    marks: [mark(positions[0], targets[0].position, 24), mark(positions[markAt(8)], targets[markAt(8)].position, 28), mark(positions[markAt(16)], targets[markAt(16)].position, 32), mark(positions[markAt(22)], targets[markAt(22)].position, 24), mark(positions.at(-1)!, targets.at(-1)!.position, 20)],
    trackSubject: true, anchorIds: landmarks.map(mark => mark.id), cinemaTraj: { positions, targets },
  };
}
