import type { CameraMark, CameraShot, SensorId, Vector3Tuple } from '../../contracts';
import { focalForFov } from './model';

/** The explore camera as the viewport reports it: position, orbit target and vertical fov (degrees). */
export type ViewCapture = { position: Vector3Tuple; target: Vector3Tuple; fov: number };
export const MANUAL_PRESET_ID = 'manual';
/** Marks closer than this (one frame at 240 fps) are treated as the same instant. */
const MIN_GAP = 1 / 240;
const round = (value: number) => Math.round(value * 10000) / 10000;

/** A mark that reproduces the current view: the camera sits where you are and aims at your orbit point. */
export function markFromView(view: ViewCapture, time: number, sensor: SensorId): CameraMark {
  const [x, y, z] = view.position, dx = view.target[0] - x, dy = view.target[1] - y, dz = view.target[2] - z;
  return { time: round(time), position: { x, y, z }, pan: Math.atan2(-dx, -dz), tilt: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0,
    focalLength: Math.round(focalForFov(sensor, view.fov) * 10) / 10, easeIn: .5, easeOut: .5, hold: 0, aim: [...view.target] };
}

/** A hand-built shot: two identical marks `seconds` apart, aimed at the current orbit point. Edit or add marks from there. */
export function manualShot(view: ViewCapture, subject: { id: string; name: string } | null, seconds = 2, sensor: SensorId = 'fullFrame'): CameraShot {
  const first = markFromView(view, 0, sensor);
  return { name: 'Hand-built shot', subjectId: subject?.id ?? 'view', subjectName: subject?.name ?? 'Current view', target: [...view.target], trackSubject: true,
    settings: { presetId: MANUAL_PRESET_ID, duration: seconds, focalLength: first.focalLength, sensor, framing: 'full' }, marks: [first, { ...first, time: seconds }] };
}

function withMarks(shot: CameraShot, marks: CameraMark[]): CameraShot {
  if (marks.length < 2) throw new Error('A camera move needs at least two marks.');
  const duration = marks[marks.length - 1].time;
  if (duration < 1 || duration > 60) throw new Error('Keep the camera move between 1 and 60 seconds.');
  // Holds may not outlast the gap to the next mark.
  const fitted = marks.map((mark, i) => i < marks.length - 1 ? { ...mark, hold: Math.min(mark.hold, round(marks[i + 1].time - mark.time)) } : { ...mark, hold: 0 });
  const { cinemaTraj: _path, ...rest } = shot;
  return { ...rest, settings: { ...shot.settings, duration }, marks: fitted };
}

/** Insert (or replace, at the same time) a mark. A mark past the end extends the move. */
export function addMark(shot: CameraShot, mark: CameraMark): CameraShot {
  if (!Number.isFinite(mark.time) || mark.time < 0) throw new Error('Place the mark at a time of 0 s or later.');
  const existing = shot.marks.findIndex(item => Math.abs(item.time - mark.time) < MIN_GAP);
  if (existing >= 0) return withMarks(shot, shot.marks.map((item, i) => i === existing ? { ...mark, time: item.time, ...(i === 0 ? { cut: undefined } : {}) } : item));
  return withMarks(shot, [...shot.marks, mark].sort((a, b) => a.time - b.time));
}

export function removeMark(shot: CameraShot, index: number): CameraShot {
  if (index <= 0 || index >= shot.marks.length) throw new Error('The first mark starts the move and cannot be removed.');
  return withMarks(shot, shot.marks.filter((_, i) => i !== index));
}

/** Move a mark in time between its neighbours. The first mark stays at 0; moving the last changes the duration. */
export function retimeMark(shot: CameraShot, index: number, time: number): CameraShot {
  if (index <= 0 || index >= shot.marks.length) throw new Error('The first mark always starts at 0 s.');
  const before = shot.marks[index - 1].time, after = shot.marks[index + 1]?.time ?? Infinity;
  if (!Number.isFinite(time) || time <= before + MIN_GAP / 2 || time >= after - MIN_GAP / 2) throw new Error('Keep the mark between its neighbours.');
  return withMarks(shot, shot.marks.map((mark, i) => i === index ? { ...mark, time: round(time) } : mark));
}

/** A cut makes this mark the first frame of a new shot. */
export function setCut(shot: CameraShot, index: number, cut: boolean): CameraShot {
  if (index <= 0 || index >= shot.marks.length) throw new Error('The first mark cannot be a cut.');
  return withMarks(shot, shot.marks.map((mark, i) => {
    if (i !== index) return mark;
    const { cut: _cut, ...rest } = mark;
    return cut ? { ...rest, cut: true } : rest;
  }));
}

/** Seconds at which each shot (run between cuts) starts. */
export function shotStarts(shot: CameraShot): number[] {
  return shot.marks.filter((mark, i) => i === 0 || mark.cut).map(mark => mark.time);
}
