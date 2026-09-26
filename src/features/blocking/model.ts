import type { ActorMark, ActorPath, ActorPose, ActorTrack, ActorTransform, Vector3Tuple } from '../../contracts';

export const MAX_ACTORS = 8;
export const MAX_ACTOR_MARKS = 64;
export const MAX_ACTOR_TIME = 60;
const TAU = Math.PI * 2;
// Absorb arithmetic drift in playhead seconds without merging distinct authored frames.
const MARK_TIME_TOLERANCE = 1e-9;

export function validateActor(actor: ActorTrack): void {
  if (!actor.id.startsWith('actor:') || !actor.id.slice(6).trim()) throw new Error('Actor ID must start with actor: and include a unique name.');
  if (!actor.name.trim() || actor.name.length > 100) throw new Error('Use an actor name between 1 and 100 characters.');
  if (!/^#[0-9a-f]{6}$/i.test(actor.color)) throw new Error('Actor color must be a six-digit hex color.');
  if (!Number.isFinite(actor.height) || actor.height < .5 || actor.height > 3) throw new Error('Height must be between 0.5 and 3 m.');
  if (!actor.marks.length || actor.marks.length > MAX_ACTOR_MARKS) throw new Error('Keep between 1 and 64 actor marks.');
  actor.marks.forEach((mark, i) => {
    if (!Number.isFinite(mark.time) || mark.time < 0 || mark.time > MAX_ACTOR_TIME) throw new Error('Mark time must be between 0 and 60 s.');
    if (i && mark.time <= actor.marks[i - 1].time) throw new Error('Mark times must be unique and in increasing order.');
    if (mark.position.length !== 3 || mark.position.some(value => !Number.isFinite(value) || Math.abs(value) > 1000)) throw new Error('Each position must be between −1000 and 1000 m.');
    if (!Number.isFinite(mark.heading)) throw new Error('Heading must be a finite angle.');
  });
}

export function createActor(id: string, name: string, position: Vector3Tuple): ActorTrack {
  const actor: ActorTrack = { id, name, color: '#edc58c', height: 1.75, marks: [{ time: 0, position: [...position], heading: 0 }] };
  validateActor(actor);
  return actor;
}

/** Commit a viewport transform at the playhead, preserving existing authored times. */
export function setActorPoseAtTime(actor: ActorTrack, seconds: number, transform: ActorTransform): ActorTrack {
  validateActor(actor);
  if (transform.id !== actor.id) throw new Error('Actor transform must match the actor ID.');
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > MAX_ACTOR_TIME) throw new Error('Mark time must be between 0 and 60 s.');
  const index = actor.marks.findIndex(mark => Math.abs(mark.time - seconds) <= MARK_TIME_TOLERANCE);
  const mark: ActorMark = { time: index < 0 ? seconds : actor.marks[index].time, position: [...transform.position], heading: transform.heading };
  const marks = index < 0 ? [...actor.marks, mark].sort((a, b) => a.time - b.time) : actor.marks.map((previous, i) => i === index ? mark : previous);
  const next = { ...actor, marks };
  validateActor(next);
  return next;
}

/** Independent copy of the full animation; placement remains the caller's choice. */
export function duplicateActor(actor: ActorTrack, id: string, name: string): ActorTrack {
  validateActor(actor);
  if (id === actor.id) throw new Error('A duplicate actor must have a new ID.');
  const next: ActorTrack = { ...actor, id, name, marks: actor.marks.map(mark => ({ ...mark, position: [...mark.position] })) };
  validateActor(next);
  return next;
}

/** Stateless interpolation: arbitrary forward/backward seeks share the same result. */
export function evaluateActor(actor: ActorTrack, seconds: number): ActorPose {
  validateActor(actor);
  if (!Number.isFinite(seconds)) throw new Error('Actor playback time must be finite.');
  const first = actor.marks[0], last = actor.marks[actor.marks.length - 1];
  let position: Vector3Tuple, heading: number;
  if (seconds <= first.time || seconds >= last.time) {
    const mark = seconds <= first.time ? first : last;
    position = [...mark.position]; heading = mark.heading;
  } else {
    const end = actor.marks.findIndex(mark => mark.time > seconds);
    const a = actor.marks[end - 1], b = actor.marks[end];
    const t = (seconds - a.time) / (b.time - a.time);
    position = a.position.map((value, axis) => value + (b.position[axis] - value) * t) as Vector3Tuple;
    // Antipodal headings choose the negative half turn consistently.
    const delta = (((b.heading % TAU) - (a.heading % TAU)) % TAU + TAU + Math.PI) % TAU - Math.PI;
    heading = a.heading + delta * t;
  }
  return { id: actor.id, name: actor.name, color: actor.color, height: actor.height, position, heading };
}

export function actorEndFrame(actor: ActorTrack, fps: number): number {
  validateActor(actor);
  if (!Number.isFinite(fps) || fps <= 0) throw new Error('Frame rate must be positive.');
  return Math.ceil(actor.marks[actor.marks.length - 1].time * fps) + 1;
}

export function actorPath(actor: ActorTrack): ActorPath {
  validateActor(actor);
  return { id: actor.id, points: actor.marks.map(mark => [...mark.position]) };
}

export function updateActorMark(actor: ActorTrack, index: number, patch: Partial<ActorMark>): ActorTrack {
  if (!Number.isInteger(index) || !actor.marks[index]) throw new Error('Choose an existing actor mark.');
  const next = { ...actor, marks: actor.marks.map((mark, i) => i === index ? { ...mark, ...patch, position: [...(patch.position ?? mark.position)] as Vector3Tuple } : mark) };
  validateActor(next);
  return next;
}

export function addActorMark(actor: ActorTrack, seconds: number): ActorTrack {
  const pose = evaluateActor(actor, seconds);
  if (seconds < 0 || seconds > MAX_ACTOR_TIME) throw new Error('Move the playhead between 0 and 60 s to add a mark.');
  if (actor.marks.some(mark => mark.time === seconds)) return actor;
  const next = { ...actor, marks: [...actor.marks, { time: seconds, position: pose.position, heading: pose.heading }].sort((a, b) => a.time - b.time) };
  validateActor(next);
  return next;
}

export function removeActorMark(actor: ActorTrack, index: number): ActorTrack {
  if (!Number.isInteger(index) || !actor.marks[index]) throw new Error('Choose an existing actor mark.');
  const next = { ...actor, marks: actor.marks.filter((_, i) => i !== index) };
  validateActor(next);
  return next;
}
