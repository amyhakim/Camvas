import type { ActorPose, CameraShot, ShotSettings, TimedPoint, Vector3Tuple } from '../../contracts';

type Subject = Pick<ActorPose, 'id' | 'name' | 'height'>;

/** FlyThru's actor-following input to CinemaTraj's CPU position optimizer. */
export function cinemaTrajInput(actor: Subject, sampleActor: (seconds: number) => ActorPose, cameraPosition: Vector3Tuple, settings: ShotSettings) {
  const first = sampleActor(0);
  const firstTarget: Vector3Tuple = [first.position[0], first.position[1] + actor.height * .8, first.position[2]];
  const dx = cameraPosition[0] - firstTarget[0], dz = cameraPosition[2] - firstTarget[2];
  const length = Math.hypot(dx, dz) || 1;
  const distance = Math.min(14, Math.max(2.5, (settings.framing === 'wide' ? 8 : settings.framing === 'full' ? 5 : 3) * settings.focalLength / 35));
  const positions: TimedPoint[] = [], targets: TimedPoint[] = [];
  for (let index = 0; index <= 120; index++) {
    const time = settings.duration * index / 120;
    const pose = sampleActor(time);
    const target: Vector3Tuple = [pose.position[0], pose.position[1] + actor.height * .8, pose.position[2]];
    targets.push({ time, position: target });
    positions.push({ time, position: [target[0] + dx / length * distance, Math.max(.35, target[1] + 1), target[2] + dz / length * distance] });
  }
  return { positions, targets };
}

export function cinemaTrajShot(actor: Subject, settings: ShotSettings, positions: TimedPoint[], targets: TimedPoint[]): CameraShot {
  const mark = (point: TimedPoint) => ({ time: point.time, position: { x: point.position[0], y: point.position[1], z: point.position[2] }, pan: 0, tilt: 0, roll: 0, focalLength: settings.focalLength, easeIn: 0, easeOut: 0, hold: 0 });
  return { name: `CinemaTraj · ${actor.name}`, subjectId: actor.id, subjectName: actor.name, target: targets[0].position, settings: { ...settings, presetId: 'cinematraj-follow' }, marks: [mark(positions[0]), mark(positions.at(-1)!)], trackSubject: true, cinemaTraj: { positions, targets } };
}
