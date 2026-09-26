import type { ActorTrack, CameraShot, ProjectDocument, ScenePlacement, Vector3Tuple } from '../../contracts';

export const MAX_PROJECT_BYTES = 1024 * 1024;
export type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const projectStorageKey = (sceneId: string) => `showcam-project:v1:${encodeURIComponent(sceneId)}`;

function fail(path: string, requirement: string): never { throw new Error(`${path}: ${requirement}. Import a valid Showcam project or correct this value.`); }
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  return value as Record<string, unknown>;
}
function string(value: unknown, path: string, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(path, `expected a nonempty name of at most ${max} characters`);
  return value.trim();
}
function number(value: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, `expected a finite number between ${min} and ${max}`);
  return value;
}
function vector(value: unknown, path: string): Vector3Tuple {
  if (!Array.isArray(value) || value.length !== 3) fail(path, 'expected three coordinates');
  return value.map((v, i) => number(v, `${path}[${i}]`, -1000, 1000)) as Vector3Tuple;
}
function array(value: unknown, path: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail(path, `expected ${min}–${max} items`);
  return value;
}
function choice<T extends string>(value: unknown, path: string, choices: readonly T[]): T {
  if (!choices.includes(value as T)) fail(path, `choose ${choices.join(', ')}`);
  return value as T;
}
function actor(value: unknown, index: number): ActorTrack {
  const path = `actors[${index}]`, a = object(value, path);
  const id = string(a.id, `${path}.id`, 200);
  if (!id.startsWith('actor:') || !id.slice(6).trim()) fail(`${path}.id`, 'use a nonempty actor: ID');
  const color = a.color;
  if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) fail(`${path}.color`, 'use a six-digit hex color such as #afceaf');
  let previous = -1;
  const marks = array(a.marks, `${path}.marks`, 1, 64).map((value, i) => {
    const p = `${path}.marks[${i}]`, m = object(value, p), time = number(m.time, `${p}.time`, 0, 60);
    if (time <= previous) fail(`${p}.time`, 'mark times must increase without duplicates');
    previous = time;
    return { time, position: vector(m.position, `${p}.position`), heading: number(m.heading, `${p}.heading`) };
  });
  return { id, name: string(a.name, `${path}.name`), color, height: number(a.height, `${path}.height`, .5, 3), marks };
}
function shot(value: unknown): CameraShot | null {
  if (value === null) return null;
  const s = object(value, 'shot'), settings = object(s.settings, 'shot.settings');
  const duration = number(settings.duration, 'shot.settings.duration', 1, 60);
  let previous = -1;
  const marks = array(s.marks, 'shot.marks', 2, 4096).map((value, i) => {
    const p = `shot.marks[${i}]`, m = object(value, p), position = object(m.position, `${p}.position`);
    const time = number(m.time, `${p}.time`, 0, duration);
    if (time <= previous) fail(`${p}.time`, 'camera mark times must increase without duplicates');
    previous = time;
    return { time, position: { x: number(position.x, `${p}.position.x`, -1000, 1000), y: number(position.y, `${p}.position.y`, -1000, 1000), z: number(position.z, `${p}.position.z`, -1000, 1000) }, pan: number(m.pan, `${p}.pan`), tilt: number(m.tilt, `${p}.tilt`), roll: number(m.roll, `${p}.roll`), focalLength: number(m.focalLength, `${p}.focalLength`, 8, 300), easeIn: number(m.easeIn, `${p}.easeIn`, 0, 1), easeOut: number(m.easeOut, `${p}.easeOut`, 0, 1), hold: number(m.hold, `${p}.hold`, 0, duration - time) };
  });
  if (marks[0].time !== 0 || marks.at(-1)!.time !== duration) fail('shot.marks', 'camera marks must start at 0 and end at the shot duration');
  marks.forEach((m, i) => { if (i < marks.length - 1 && m.hold > marks[i + 1].time - m.time) fail(`shot.marks[${i}].hold`, 'hold must end by the next mark'); });
  if (typeof s.trackSubject !== 'boolean') fail('shot.trackSubject', 'expected true or false');
  const cinemaTraj = s.cinemaTraj === undefined ? undefined : (() => {
    const data = object(s.cinemaTraj, 'shot.cinemaTraj');
    const points = (key: 'positions' | 'targets') => {
      let prior = -1;
      const samples = array(data[key], `shot.cinemaTraj.${key}`, 2, 241).map((value, i) => {
        const point = object(value, `shot.cinemaTraj.${key}[${i}]`);
        const time = number(point.time, `shot.cinemaTraj.${key}[${i}].time`, 0, duration);
        if (time <= prior) fail(`shot.cinemaTraj.${key}[${i}].time`, 'sample times must increase');
        prior = time;
        return { time, position: vector(point.position, `shot.cinemaTraj.${key}[${i}].position`) };
      });
      if (samples[0].time !== 0 || samples.at(-1)!.time !== duration) fail(`shot.cinemaTraj.${key}`, 'samples must span the shot duration');
      return samples;
    };
    return { positions: points('positions'), targets: points('targets') };
  })();
  return { name: string(s.name, 'shot.name'), subjectId: string(s.subjectId, 'shot.subjectId', 500), subjectName: string(s.subjectName, 'shot.subjectName', 500), target: vector(s.target, 'shot.target'), trackSubject: s.trackSubject,
    settings: { presetId: string(settings.presetId, 'shot.settings.presetId', 200), duration, focalLength: number(settings.focalLength, 'shot.settings.focalLength', 8, 300), sensor: choice(settings.sensor, 'shot.settings.sensor', ['super16', 'super35', 'fullFrame', 'imax65']), framing: choice(settings.framing, 'shot.settings.framing', ['wide', 'full', 'detail']) }, marks, ...(cinemaTraj ? { cinemaTraj } : {}) };
}
/** Rebuild recognized data only, so JSON extensions and prototype keys never enter editor state. */
function validate(value: unknown, sceneId: string): ProjectDocument {
  const d = object(value, 'Project');
  if (d.format !== 'showcam-project') fail('Project format', 'expected showcam-project');
  if (d.version !== 1) fail('Project version', 'this app supports version 1');
  const storedSceneId = string(d.sceneId, 'Scene ID', 500);
  if (storedSceneId !== sceneId) fail('Scene ID', `this project belongs to another scene; open ${storedSceneId}`);
  const actors = array(d.actors, 'actors', 0, 8).map(actor);
  if (new Set(actors.map(a => a.id)).size !== actors.length) fail('actors', 'actor IDs must be unique');
  const placements: ScenePlacement[] | undefined = d.placements === undefined ? undefined : array(d.placements, 'placements', 0, 2000).map((value, i) => {
    const p = `placements[${i}]`, placement = object(value, p);
    const id = string(placement.id, `${p}.id`, 500);
    if (id.startsWith('actor:')) fail(`${p}.id`, 'actor motion belongs in actor marks');
    return { id, offset: vector(placement.offset, `${p}.offset`) };
  });
  if (placements && new Set(placements.map(p => p.id)).size !== placements.length) fail('placements', 'object IDs must be unique');
  return { format: 'showcam-project', version: 1, sceneId: storedSceneId, name: string(d.name, 'Project name'), shot: shot(d.shot), actors, ...(placements === undefined ? {} : { placements }) };
}
function checkSize(text: string) { if (new TextEncoder().encode(text).byteLength > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 1 MB limit. Import a smaller project.'); }
export function parseProject(text: string, sceneId: string): ProjectDocument {
  checkSize(text);
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error('Project is not valid JSON. Choose a Showcam JSON export.'); }
  return validate(value, sceneId);
}
export function serializeProject(document: ProjectDocument): string {
  const text = JSON.stringify(validate(document, document.sceneId), null, 2);
  checkSize(text);
  return text;
}
export function loadProject(storage: ProjectStorage, sceneId: string): ProjectDocument | null {
  let text: string | null;
  try { text = storage.getItem(projectStorageKey(sceneId)); } catch { throw new Error('Browser storage could not be read. Keep editing, then retry saving or export a JSON copy.'); }
  return text === null ? null : parseProject(text, sceneId);
}
export function saveProject(storage: ProjectStorage, document: ProjectDocument): void {
  const text = serializeProject(document);
  try { storage.setItem(projectStorageKey(document.sceneId), text); } catch { throw new Error('Project could not be saved in this browser. Retry saving, free browser storage, or export a JSON copy.'); }
}
