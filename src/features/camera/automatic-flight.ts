import { CatmullRomCurve3, Quaternion, Vector3 } from 'three';
import type { CameraMark, CameraPose, CameraShot, Vector3Tuple } from '../../contracts';
import type { AutomaticFlightPlan, AutomaticFlightSnapshot } from '../../contracts/automatic-flight';
import { compileShot } from './model';
import { distanceToRouteBox } from './route-overview-model';

export type AutomaticFlightResult = { shot: CameraShot; evidence: { time: number; pose: CameraPose }[]; metrics: { clearance: number; peakSpeed: number; peakTurnRate: number; peakAcceleration: number } };
const ease = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/** Deterministic choreography and acceptance gate. No engine, network or state writes. */
export function generateAutomaticFlight(plan: AutomaticFlightPlan, snapshot: AutomaticFlightSnapshot): AutomaticFlightResult {
  const curve = new CatmullRomCurve3(plan.controls.map(c => new Vector3(...c.position)), false, 'centripetal');
  curve.arcLengthDivisions = 10000; curve.updateArcLengths();
  const length = curve.getLength(), ramp = 3;
  if (length < 1) throw Error('Route is too short.');
  const travel = Math.max(8, length / plan.cruiseSpeed + ramp), duration = travel + plan.zoomSeconds;
  if (duration > 60) throw Error('Route is too long for smooth travel within 60 seconds. Shorten the route, not the safety margin.');
  const weight = travel - ramp;
  const progress = (t: number) => t < ramp ? ramp * ((t / ramp) ** 3 - .5 * (t / ramp) ** 4) / weight
    : t > travel - ramp ? 1 - ramp * (((travel - t) / ramp) ** 3 - .5 * ((travel - t) / ramp) ** 4) / weight : (t - ramp / 2) / weight;
  const positions = Array.from({ length: 229 }, (_, i) => { const time = travel * i / 228; return { time, position: curve.getPointAt(progress(time)).toArray() }; });
  for (let i = 1; i <= 10; i++) positions.push({ time: travel + plan.zoomSeconds * i / 10, position: [...positions.at(-1)!.position] as Vector3Tuple });
  const arc = curve.getLengths(10000);
  const fractions = plan.controls.map((_, i) => arc[Math.round(i * 10000 / (plan.controls.length - 1))] / length);
  const subjects = new Map(snapshot.subjects.map(s => [s.id, s]));
  const center = (id: string) => { const s = subjects.get(id)!; return new Vector3(...s.min.map((n, a) => (n + s.max[a]) / 2)); };
  let direction: Vector3 | null = null;
  const targets = positions.map((key, i) => {
    const u = progress(Math.min(travel, key.time));
    let b = fractions.findIndex(f => f > u); if (b < 0) b = fractions.length - 1;
    const a = Math.max(0, b - 1), blend = ease(Math.max(0, Math.min(1, (u - fractions[a]) / Math.max(1e-6, fractions[b] - fractions[a]))));
    const aim = (index: number) => plan.controls[index].gazeMode === 'ahead' && u < .98 ? curve.getPointAt(Math.min(1, u + 2 / length)) : center(plan.controls[index].gazeTargetId);
    const position = new Vector3(...key.position), desired = aim(a).lerp(aim(b), blend).sub(position);
    if (desired.length() < .2) throw Error(`Gaze target too close to camera at ${key.time.toFixed(1)} s.`);
    desired.normalize();
    if (!direction) direction = desired.clone();
    else {
      const dt = key.time - positions[i - 1].time, angle = direction.angleTo(desired);
      const fraction = Math.min(1 - Math.exp(-dt / .9), 28 * Math.PI / 180 * dt / Math.max(angle, 1e-9));
      direction.applyQuaternion(new Quaternion().slerp(new Quaternion().setFromUnitVectors(direction, desired), fraction)).normalize();
    }
    return { time: key.time, position: position.addScaledVector(direction, 8).toArray() };
  });
  const mark = (time: number, focalLength: number): CameraMark => { const p = positions.find(k => k.time >= time)!.position; return { time, position: { x: p[0], y: p[1], z: p[2] }, pan: 0, tilt: 0, roll: 0, focalLength, easeIn: .5, easeOut: .5, hold: 0 }; };
  const subject = subjects.get(plan.beats[0].targetId)!;
  const shot: CameraShot = { name: plan.name, subjectId: subject.entityId, subjectName: subject.label, target: targets.at(-1)!.position,
    settings: { presetId: 'slow-push-in', duration, focalLength: plan.focalLength, sensor: 'fullFrame', framing: 'wide' },
    marks: [mark(0, plan.focalLength), mark(travel, plan.focalLength), mark(duration, plan.finalFocalLength)], trackSubject: true, cinemaTraj: { positions, targets } };
  const evaluate = compileShot(shot);
  let clearance = Infinity, peakSpeed = 0, peakTurnRate = 0, peakAcceleration = 0;
  const velocities: Vector3[] = [];
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1], b = positions[i], dt = b.time - a.time;
    const velocity = new Vector3(...b.position).sub(new Vector3(...a.position)).divideScalar(dt);
    peakSpeed = Math.max(peakSpeed, velocity.length());
    if (velocities.length) peakAcceleration = Math.max(peakAcceleration, velocity.clone().sub(velocities.at(-1)!).length() / dt);
    velocities.push(velocity);
    // Conservative Lipschitz bound: samples <=2 cm apart, require another 1 cm.
    const count = Math.max(1, Math.ceil(velocity.length() * dt / .02));
    for (let s = 0; s <= count; s++) {
      const p = a.position.map((v, axis) => v + (b.position[axis] - v) * s / count) as Vector3Tuple;
      if (snapshot.geometryKind === 'splat-proxies') {
        if (!snapshot.coverage) throw Error('Splat navigation requires reviewed coverage.');
        const boundary = Math.min(...p.flatMap((value, axis) => [value - snapshot.coverage!.min[axis], snapshot.coverage!.max[axis] - value]));
        clearance = Math.min(clearance, boundary);
        if (boundary < .31) throw Error('Route leaves the reviewed splat coverage. Keep the complete route inside the navigation area with 0.31 clearance.');
      }
      for (const box of snapshot.obstacles) {
        const distance = distanceToRouteBox(p, box); clearance = Math.min(clearance, distance);
        if (distance < .31) throw Error(`Route blocked near [${p.map(n => n.toFixed(2)).join(', ')}] at ${(a.time + dt * s / count).toFixed(1)} s. Need >=0.31 m clearance from every supplied obstacle.`);
      }
    }
  }
  for (let i = 1; i <= Math.ceil(duration * 60); i++) {
    const a = evaluate((i - 1) / 60), b = evaluate(i / 60);
    const pan = Math.atan2(Math.sin(b.pan - a.pan), Math.cos(b.pan - a.pan));
    peakTurnRate = Math.max(peakTurnRate, Math.hypot(pan, b.tilt - a.tilt) * 60 * 180 / Math.PI);
    if (Math.abs(b.focalLength - a.focalLength) * 60 > 10) throw Error('Zoom is too abrupt. Use a smaller lens change or a longer settle.');
  }
  if (peakSpeed > 2.05 || peakTurnRate > 35 || peakAcceleration > 3) throw Error(`Motion is not smooth enough: speed ${peakSpeed.toFixed(2)} m/s, turn ${peakTurnRate.toFixed(1)} deg/s, acceleration ${peakAcceleration.toFixed(1)} m/s². Widen tight turns or reduce cruiseSpeed.`);
  const beatTimes = plan.beats.map(beat => {
    const f = fractions[beat.controlIndex]; let lo = 0, hi = travel;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (progress(mid) < f) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  });
  const times = [...new Set([0, ...beatTimes, ...beatTimes.slice(1).map((t, i) => (t + beatTimes[i]) / 2), duration].map(t => Math.round(t * 1000) / 1000))].sort((a, b) => a - b);
  return { shot, evidence: times.map(time => ({ time, pose: evaluate(time) })), metrics: { clearance, peakSpeed, peakTurnRate, peakAcceleration } };
}
