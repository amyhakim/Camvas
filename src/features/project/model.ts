import type { ActorMotion, ActorTrack, AudioClip, AudioSource, CameraShot, ModelSource, MotionSource, ProjectDocument, SceneLandmark, SceneProp, ScenePlacement, Vector3Tuple } from '../../contracts';
import { MAX_AUDIO_CLIPS, validateAudioClip } from '../audio/model';
import { MAX_ACTOR_MOTIONS, MAX_POSE_KEYS, validateMotion } from '../blocking/motions';
import { sanitizePose } from '../../lib/humanoid';
import { MAX_PROPS, PROP_SHAPES, validateModelSource, validateProp } from '../props/model';
import { normalizeLook, normalizeTitles } from '../look/model';

export const MAX_PROJECT_BYTES = 1024 * 1024;
export type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;
export const projectStorageKey = (sceneId: string) => `showcam-project:v1:${encodeURIComponent(sceneId)}`;
export const namedProjectStorageKey = (id: string) => `showcam-project:item:v1:${encodeURIComponent(id)}`;

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
function modelSource(value: unknown, path: string): ModelSource {
  const m = object(value, path);
  if (m.provider === 'local') {
    const link = (key: string) => { if (m[key] !== '') fail(`${path}.${key}`, 'local models have no links'); return ''; };
    const local: ModelSource = { provider: 'local', uid: string(m.uid, `${path}.uid`, 32), name: string(m.name, `${path}.name`, 200), author: string(m.author, `${path}.author`, 200), authorUrl: link('authorUrl'), license: string(m.license, `${path}.license`, 200), licenseUrl: link('licenseUrl'), viewerUrl: link('viewerUrl') };
    try { validateModelSource(local); } catch (error) { fail(path, error instanceof Error ? error.message.replace(/\.$/, '').toLowerCase() : 'invalid model'); }
    return local;
  }
  if (m.provider !== 'sketchfab') fail(`${path}.provider`, 'expected sketchfab or local');
  const source: ModelSource = { provider: 'sketchfab', uid: string(m.uid, `${path}.uid`, 32), name: string(m.name, `${path}.name`, 200), author: string(m.author, `${path}.author`, 200), authorUrl: string(m.authorUrl, `${path}.authorUrl`, 500), license: string(m.license, `${path}.license`, 200), licenseUrl: string(m.licenseUrl, `${path}.licenseUrl`, 500), viewerUrl: string(m.viewerUrl, `${path}.viewerUrl`, 500) };
  try { validateModelSource(source); } catch (error) { fail(path, error instanceof Error ? error.message.replace(/\.$/, '').toLowerCase() : 'invalid model'); }
  return source;
}
function prop(value: unknown, index: number): SceneProp {
  const path = `props[${index}]`, p = object(value, path), source = object(p.source, `${path}.source`);
  const kind = choice(source.kind, `${path}.source.kind`, ['primitive', 'model']);
  const result: SceneProp = {
    id: string(p.id, `${path}.id`, 80), name: string(p.name, `${path}.name`),
    source: kind === 'primitive' ? { kind, shape: choice(source.shape, `${path}.source.shape`, PROP_SHAPES) } : { kind, ...modelSource(source, `${path}.source`) },
    position: vector(p.position, `${path}.position`),
    rotation: array(p.rotation, `${path}.rotation`, 3, 3).map((v, i) => number(v, `${path}.rotation[${i}]`, -Math.PI * 4, Math.PI * 4)) as Vector3Tuple,
    size: number(p.size, `${path}.size`, .02, 50),
  };
  if (p.color !== undefined) {
    if (typeof p.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(p.color)) fail(`${path}.color`, 'use a six-digit hex color such as #afceaf');
    result.color = p.color;
  }
  if (p.attachment !== undefined) {
    const link = object(p.attachment, `${path}.attachment`);
    result.attachment = { actorId: string(link.actorId, `${path}.attachment.actorId`, 200), offset: vector(link.offset, `${path}.attachment.offset`), yaw: number(link.yaw, `${path}.attachment.yaw`, -Math.PI * 4, Math.PI * 4) };
  }
  if (p.motion !== undefined) {
    const m = object(p.motion, `${path}.motion`);
    result.motion = { spin: number(m.spin, `${path}.motion.spin`, -720, 720), float: number(m.float, `${path}.motion.float`, 0, 2), start: number(m.start, `${path}.motion.start`, 0, 120), end: number(m.end, `${path}.motion.end`, 0, 120), ...(m.pivot === undefined ? {} : { pivot: number(m.pivot, `${path}.motion.pivot`, 0, 50) }) };
  }
  try { validateProp(result); } catch (error) { fail(path, error instanceof Error ? error.message.replace(/\.$/, '').toLowerCase() : 'invalid prop'); }
  return result;
}
function audioClip(value: unknown, index: number): AudioClip {
  const path = `audio[${index}]`, a = object(value, path), src = object(a.source, `${path}.source`);
  const source: AudioSource = {
    provider: choice(src.provider, `${path}.source.provider`, ['jamendo', 'freesound']), id: string(src.id, `${path}.source.id`, 12),
    name: string(src.name, `${path}.source.name`, 200), artist: string(src.artist, `${path}.source.artist`, 200), artistUrl: string(src.artistUrl, `${path}.source.artistUrl`, 500),
    license: string(src.license, `${path}.source.license`, 200), licenseUrl: string(src.licenseUrl, `${path}.source.licenseUrl`, 500), pageUrl: string(src.pageUrl, `${path}.source.pageUrl`, 500),
    duration: number(src.duration, `${path}.source.duration`, 0, 3600),
  };
  const clip: AudioClip = {
    id: string(a.id, `${path}.id`, 80), kind: choice(a.kind, `${path}.kind`, ['music', 'sfx']), source,
    start: number(a.start, `${path}.start`, 0, 120), offset: number(a.offset, `${path}.offset`, 0, 3600), duration: number(a.duration, `${path}.duration`, 0, 120),
    volume: number(a.volume, `${path}.volume`, 0, 1), fadeIn: number(a.fadeIn, `${path}.fadeIn`, 0, 10), fadeOut: number(a.fadeOut, `${path}.fadeOut`, 0, 10),
  };
  try { validateAudioClip(clip); } catch (error) { fail(path, error instanceof Error ? error.message.replace(/\.$/, '').toLowerCase() : 'invalid audio clip'); }
  return clip;
}
function motion(value: unknown, path: string): ActorMotion {
  const m = object(value, path), src = object(m.source, `${path}.source`);
  const kind = choice(src.kind, `${path}.source.kind`, ['preset', 'clip', 'custom']);
  const guard = <T>(label: string, build: () => T): T => { try { return build(); } catch (error) { fail(label, error instanceof Error ? error.message.replace(/\.$/, '').toLowerCase() : 'invalid value'); } };
  const source: MotionSource = kind === 'preset' ? { kind, preset: string(src.preset, `${path}.source.preset`, 60) }
    : kind === 'clip' ? { kind, clip: string(src.clip, `${path}.source.clip`, 100) }
    : { kind, name: string(src.name, `${path}.source.name`, 60), layer: choice(src.layer, `${path}.source.layer`, ['full', 'upper']), keys: array(src.keys, `${path}.source.keys`, 1, MAX_POSE_KEYS).map((key, i) => {
      const k = object(key, `${path}.source.keys[${i}]`);
      return { time: number(k.time, `${path}.source.keys[${i}].time`, 0, 60), pose: guard(`${path}.source.keys[${i}].pose`, () => sanitizePose(k.pose, true)) };
    }) };
  if (typeof m.loop !== 'boolean') fail(`${path}.loop`, 'expected true or false');
  const result: ActorMotion = { start: number(m.start, `${path}.start`, 0, 60), duration: number(m.duration, `${path}.duration`, .2, 60), loop: m.loop, source };
  guard(path, () => validateMotion(result));
  return result;
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
  return { id, name: string(a.name, `${path}.name`), color, height: number(a.height, `${path}.height`, .5, 3), marks, ...(a.model === undefined ? {} : { model: modelSource(a.model, `${path}.model`) }), ...(a.motions === undefined ? {} : { motions: array(a.motions, `${path}.motions`, 0, MAX_ACTOR_MOTIONS).map((item, i) => motion(item, `${path}.motions[${i}]`)) }) };
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
    return { time, position: { x: number(position.x, `${p}.position.x`, -1000, 1000), y: number(position.y, `${p}.position.y`, -1000, 1000), z: number(position.z, `${p}.position.z`, -1000, 1000) }, pan: number(m.pan, `${p}.pan`), tilt: number(m.tilt, `${p}.tilt`), roll: number(m.roll, `${p}.roll`), focalLength: number(m.focalLength, `${p}.focalLength`, 8, 300), easeIn: number(m.easeIn, `${p}.easeIn`, 0, 1), easeOut: number(m.easeOut, `${p}.easeOut`, 0, 1), hold: number(m.hold, `${p}.hold`, 0, duration - time),
      ...(m.cut === undefined ? {} : { cut: (() => { if (typeof m.cut !== 'boolean') fail(`${p}.cut`, 'expected true or false'); return m.cut; })() }),
      ...(m.aim === undefined ? {} : { aim: vector(m.aim, `${p}.aim`) }) };
  });
  if (marks[0].cut) fail('shot.marks[0].cut', 'the first mark cannot be a cut');
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
    ...(s.subjectSignature === undefined ? {} : { subjectSignature: string(s.subjectSignature, 'shot.subjectSignature', 64) }),
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
  if (placements?.some(p => p.id.startsWith('prop:'))) fail('placements', 'prop positions belong in props');
  const audio = d.audio === undefined ? undefined : array(d.audio, 'audio', 0, MAX_AUDIO_CLIPS).map(audioClip);
  if (audio && new Set(audio.map(clip => clip.id)).size !== audio.length) fail('audio', 'audio clip IDs must be unique');
  const props = d.props === undefined ? undefined : array(d.props, 'props', 0, MAX_PROPS).map(prop);
  if (props && new Set(props.map(p => p.id)).size !== props.length) fail('props', 'prop IDs must be unique');
  for (const [index, item] of (props ?? []).entries()) if (item.attachment && !actors.some(actor => actor.id === item.attachment!.actorId)) fail(`props[${index}].attachment`, 'the followed actor is missing');
  const landmarks: SceneLandmark[] | undefined = d.landmarks === undefined ? undefined : array(d.landmarks, 'landmarks', 0, 8).map((value, index) => {
    const path = `landmarks[${index}]`, mark = object(value, path);
    return { id: string(mark.id, `${path}.id`, 100), label: string(mark.label, `${path}.label`, 48), entityId: mark.entityId === null ? null : string(mark.entityId, `${path}.entityId`, 500), kind: choice(mark.kind, `${path}.kind`, ['mesh', 'floor']), frame: number(mark.frame, `${path}.frame`, 1, 100000), position: vector(mark.position, `${path}.position`) };
  });
  if (landmarks && new Set(landmarks.map(mark => mark.id)).size !== landmarks.length) fail('landmarks', 'IDs must be unique');
  const guard = <T>(build: () => T): T => { try { return build(); } catch (error) { throw new Error(`${error instanceof Error ? error.message.replace(/\.$/, '') : 'Invalid value'}. Import a valid Showcam project or correct this value.`); } };
  const look = d.look === undefined ? undefined : guard(() => normalizeLook(d.look));
  const titles = d.titles === undefined ? undefined : guard(() => normalizeTitles(d.titles));
  return { format: 'showcam-project', version: 1, sceneId: storedSceneId, name: string(d.name, 'Project name'), shot: shot(d.shot), actors, ...(placements === undefined ? {} : { placements }), ...(props === undefined ? {} : { props }), ...(landmarks === undefined ? {} : { landmarks }), ...(audio === undefined ? {} : { audio }), ...(look === undefined ? {} : { look }), ...(titles === undefined ? {} : { titles }) };
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
export function loadProject(storage: ProjectStorage, sceneId: string, projectId?: string): ProjectDocument | null {
  let text: string | null;
  try { text = storage.getItem(projectId ? namedProjectStorageKey(projectId) : projectStorageKey(sceneId)); } catch { throw new Error('Browser storage could not be read. Keep editing, then retry saving or export a JSON copy.'); }
  if (text === null && projectId) throw new Error('This project could not be found in this browser. Return home and choose an available project.');
  return text === null ? null : parseProject(text, sceneId);
}
export function saveProject(storage: ProjectStorage, document: ProjectDocument, projectId?: string): void {
  const text = serializeProject(document);
  try { storage.setItem(projectId ? namedProjectStorageKey(projectId) : projectStorageKey(document.sceneId), text); } catch { throw new Error('Project could not be saved in this browser. Retry saving, free browser storage, or export a JSON copy.'); }
}
