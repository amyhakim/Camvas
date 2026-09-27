import type { ActorTrack, AudioSource, ModelSource, ProjectDocument, PropShape, SceneEntity, SceneProp, ShotSettings, Vector3Tuple } from '../contracts';
import { createActor, evaluateActor, MAX_ACTORS, setActorPoseAtTime, updateActor, type ActorPatch } from '../features/blocking/model';
import { createProp, MAX_PROPS, PROP_SHAPES, updateProp, type PropPatch } from '../features/props/model';
import { createAudioClip, MAX_AUDIO_CLIPS, parseAudioKey, updateAudioClip, type AudioPatch } from '../features/audio/model';
import { withPlacement } from './object-edits';

export const MAX_DIRECTOR_ACTIONS = 8;
const MAX_DELTA = 10;
const DEG = Math.PI / 180;

/** Editor effects that follow a successful batch; document edits are already folded into `document`. */
export type DirectorEffect =
  | { type: 'select'; id: string; mode: 'orbit' | 'shot' }
  | { type: 'camera'; id: string }
  | { type: 'seek'; frame: number }
  | { type: 'play' | 'pause' | 'frameSelection' | 'resetCamera' }
  | { type: 'shot'; targetId: string; settings: ShotSettings };

export type DirectorContext = {
  objects: SceneEntity[]; presetIds: string[]; frameEnd: number; fps: number;
  /** Server-verified Sketchfab attribution, keyed by model UID. The model can only reference these. */
  models: Record<string, ModelSource>;
  /** Server-verified Jamendo/Freesound attribution keyed "provider:id"; audio can only reference these. */
  audio?: Record<string, AudioSource>;
  /** Current timeline length in seconds, so music can fill it by default. */
  timelineEnd?: number;
  actorOrigin: Vector3Tuple; selectedId: string | null;
  newId: (prefix: 'actor' | 'prop' | 'audio') => string;
};
export type DirectorPlan = { document: ProjectDocument; effects: DirectorEffect[]; summaries: string[] };

type Raw = Record<string, unknown>;
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const present = (value: unknown) => value !== null && value !== undefined;

function vector(value: unknown, label: string, limit = 1000): Vector3Tuple {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(v => isNumber(v) && Math.abs(v) <= limit)) throw new Error(`${label} must be three finite numbers within ±${limit}.`);
  return value as Vector3Tuple;
}
function optionalVector(value: unknown, label: string, limit?: number) { return present(value) ? vector(value, label, limit) : undefined; }
function hex(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${label} must be a six-digit hex color such as #c0392b.`);
  return value.toLowerCase();
}
function name(value: unknown, fallback: string) {
  if (!present(value)) return fallback;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error('Names must be 1–100 characters.');
  return value.trim();
}
function model(uid: unknown, context: DirectorContext): ModelSource {
  const source = typeof uid === 'string' ? context.models[uid] : undefined;
  if (!source) throw new Error('That Sketchfab model was not verified by the server. Search again and choose a listed result.');
  return source;
}
/** Let the Director name new things so later actions in the same batch can refer to them. */
function requestedId(value: unknown, prefix: 'actor' | 'prop', taken: Set<string>, context: DirectorContext) {
  if (typeof value === 'string' && new RegExp(`^${prefix}:[A-Za-z0-9_-]{1,40}$`).test(value) && !taken.has(value)) return value;
  return context.newId(prefix);
}

/** Validate and apply up to eight actions against a working copy; any failure throws and nothing is applied. */
export function planDirectorActions(project: ProjectDocument, rawActions: unknown, context: DirectorContext): DirectorPlan {
  const list = Array.isArray(rawActions) ? rawActions : [rawActions];
  if (list.length > MAX_DIRECTOR_ACTIONS) throw new Error(`The Director can make at most ${MAX_DIRECTOR_ACTIONS} changes at once.`);
  let document = project;
  const effects: DirectorEffect[] = [], summaries: string[] = [];
  const entityName = (id: string) => document.actors.find(a => a.id === id)?.name ?? document.props?.find(p => p.id === id)?.name ?? context.objects.find(o => o.id === id)?.name ?? id;
  const findActor = (id: unknown): ActorTrack => {
    const actor = document.actors.find(item => item.id === id);
    if (!actor) throw new Error('Codex chose an actor that is not in this project.');
    return actor;
  };
  const findProp = (id: unknown): SceneProp => {
    const prop = document.props?.find(item => item.id === id);
    if (!prop) throw new Error('Codex chose a prop that is not in this project.');
    return prop;
  };
  const setActor = (next: ActorTrack) => { document = { ...document, actors: document.actors.map(item => item.id === next.id ? next : item) }; };
  const setProp = (next: SceneProp) => { document = { ...document, props: (document.props ?? []).map(item => item.id === next.id ? next : item) }; };
  const resolve = (id: unknown) => {
    if (typeof id !== 'string') return null;
    if (id.startsWith('actor:')) return document.actors.some(a => a.id === id) ? { kind: 'actor' as const, id } : null;
    if (id.startsWith('prop:')) return document.props?.some(p => p.id === id) ? { kind: 'prop' as const, id } : null;
    const entity = context.objects.find(o => o.id === id);
    return entity ? { kind: entity.type === 'Camera' ? 'camera' as const : 'object' as const, id } : null;
  };

  for (const value of list) {
    if (!value || typeof value !== 'object') throw new Error('Codex returned an invalid scene action.');
    const action = value as Raw;
    switch (action.type) {
      case 'none': break;
      case 'play': case 'pause': case 'frameSelection': {
        if (action.type === 'frameSelection' && !context.selectedId && !effects.some(e => e.type === 'select')) throw new Error('Select an object before framing it.');
        effects.push({ type: action.type }); summaries.push(action.type === 'play' ? 'Playing the timeline.' : action.type === 'pause' ? 'Paused the timeline.' : 'Framed the selection.');
        break;
      }
      case 'seek': {
        if (!isNumber(action.frame) || !Number.isInteger(action.frame) || action.frame < 1 || action.frame > context.frameEnd) throw new Error('Codex chose a frame outside the timeline.');
        effects.push({ type: 'seek', frame: action.frame }); summaries.push(`Moved to frame ${action.frame}.`);
        break;
      }
      case 'discardShot': {
        if (!document.shot) throw new Error('There is no draft shot to discard.');
        document = { ...document, shot: null }; effects.push({ type: 'resetCamera' }); summaries.push('Discarded the draft camera move.');
        break;
      }
      case 'selectObject': case 'selectCamera': {
        const target = resolve(action.targetId);
        if (!target) throw new Error('Codex chose something that is not in this scene.');
        if (action.type === 'selectCamera') {
          if (target.kind !== 'camera') throw new Error('Codex chose an object instead of a camera.');
          effects.push({ type: 'camera', id: target.id }); summaries.push(`Viewing ${entityName(target.id)}.`);
        } else { effects.push({ type: 'select', id: target.id, mode: 'orbit' }); summaries.push(`Selected ${entityName(target.id)}.`); }
        break;
      }
      case 'generateShot': {
        const target = resolve(action.targetId);
        if (!target) throw new Error('Codex chose a subject that is not in this scene.');
        if (target.kind === 'camera') throw new Error('Choose scene geometry, a prop, or an actor as the camera subject.');
        if (typeof action.presetId !== 'string' || !context.presetIds.includes(action.presetId)) throw new Error('Codex chose an unknown camera move.');
        if (!isNumber(action.duration) || action.duration < 1 || action.duration > 60) throw new Error('Camera move duration must be 1–60 seconds.');
        if (!isNumber(action.focalLength) || action.focalLength < 8 || action.focalLength > 300) throw new Error('Camera lens must be 8–300 mm.');
        if (action.framing !== 'wide' && action.framing !== 'full' && action.framing !== 'detail') throw new Error('Codex chose an unknown framing.');
        effects.push({ type: 'shot', targetId: target.id, settings: { presetId: action.presetId, duration: action.duration, focalLength: action.focalLength, framing: action.framing, sensor: 'fullFrame' } });
        summaries.push(`Creating a camera move around ${entityName(target.id)}${target.kind === 'actor' ? ' that follows them' : ''}.`);
        break;
      }
      case 'moveObject': {
        const target = resolve(action.targetId);
        const delta = vector(action.delta, 'Movement', MAX_DELTA);
        if (!target || target.kind === 'camera') throw new Error('Choose scene geometry or a prop to move.');
        if (target.kind === 'actor') throw new Error('Move actors with setActorMark so their timing is kept.');
        if (target.kind === 'prop') { const prop = findProp(target.id); setProp(updateProp(prop, { position: prop.position.map((v, i) => v + delta[i]) as Vector3Tuple })); }
        else {
          const current = (document.placements ?? []).find(item => item.id === target.id)?.offset ?? [0, 0, 0];
          document = withPlacement(document, { id: target.id, offset: current.map((v, i) => v + delta[i]) as Vector3Tuple });
        }
        effects.push({ type: 'select', id: target.id, mode: 'orbit' }); summaries.push(`Moved ${entityName(target.id)} by ${delta.join(', ')} m (X, Y, Z).`);
        break;
      }
      case 'addProp': {
        if ((document.props?.length ?? 0) >= MAX_PROPS) throw new Error(`This project already has ${MAX_PROPS} props.`);
        const hasShape = present(action.shape), hasModel = present(action.modelUid);
        if (hasShape === hasModel) throw new Error('A new prop needs either a primitive shape or a Sketchfab model.');
        if (hasShape && !PROP_SHAPES.includes(action.shape as PropShape)) throw new Error('Choose a supported prop shape.');
        const source: SceneProp['source'] = hasShape ? { kind: 'primitive', shape: action.shape as PropShape } : { kind: 'model', ...model(action.modelUid, context) };
        const taken = new Set((document.props ?? []).map(p => p.id));
        const rotation = optionalVector(action.rotationDeg, 'Rotation', 720);
        const prop = createProp(requestedId(action.targetId, 'prop', taken, context), name(action.name, source.kind === 'model' ? source.name : action.shape as string),
          source, vector(action.position ?? context.actorOrigin, 'Prop position'), {
            rotation: rotation?.map(v => v * DEG) as Vector3Tuple | undefined,
            size: present(action.size) ? action.size as number : undefined,
            color: present(action.color) ? hex(action.color, 'Prop tint') : undefined,
          });
        document = { ...document, props: [...(document.props ?? []), prop] };
        effects.push({ type: 'select', id: prop.id, mode: 'orbit' }); summaries.push(`Added ${prop.name}${source.kind === 'model' ? ` by ${source.author} (${source.license})` : ''}.`);
        break;
      }
      case 'updateProp': {
        const prop = findProp(action.targetId);
        const patch: PropPatch = {};
        if (present(action.name)) patch.name = name(action.name, prop.name);
        const position = optionalVector(action.position, 'Prop position'), delta = optionalVector(action.delta, 'Movement', MAX_DELTA);
        if (position || delta) patch.position = (position ?? prop.position).map((v, i) => v + (delta?.[i] ?? 0)) as Vector3Tuple;
        const rotation = optionalVector(action.rotationDeg, 'Rotation', 720);
        if (rotation) patch.rotation = rotation.map(v => v * DEG) as Vector3Tuple;
        if (present(action.size)) patch.size = action.size as number;
        if (present(action.color)) patch.color = action.color === 'none' ? null : hex(action.color, 'Prop tint');
        if (!Object.keys(patch).length) throw new Error('Tell the Director what to change about the prop.');
        setProp(updateProp(prop, patch)); effects.push({ type: 'select', id: prop.id, mode: 'orbit' }); summaries.push(`Updated ${prop.name}.`);
        break;
      }
      case 'removeProp': {
        const prop = findProp(action.targetId);
        document = { ...document, props: (document.props ?? []).filter(item => item.id !== prop.id) }; summaries.push(`Removed ${prop.name}.`);
        break;
      }
      case 'addActor': {
        if (document.actors.length >= MAX_ACTORS) throw new Error(`This project already has ${MAX_ACTORS} actors.`);
        const taken = new Set(document.actors.map(a => a.id));
        const origin = context.actorOrigin;
        const position = present(action.position) ? vector(action.position, 'Actor position') : [origin[0] + document.actors.length * .8, origin[1], origin[2]] as Vector3Tuple;
        let actor = createActor(requestedId(action.targetId, 'actor', taken, context), name(action.name, `Actor ${document.actors.length + 1}`), position);
        const patch: ActorPatch = {};
        if (present(action.color)) patch.color = hex(action.color, 'Actor color');
        if (present(action.height)) patch.height = action.height as number;
        actor = updateActor(actor, patch);
        if (present(action.headingDeg)) { if (!isNumber(action.headingDeg)) throw new Error('Heading must be a number of degrees.'); actor = { ...actor, marks: [{ ...actor.marks[0], heading: action.headingDeg * DEG }] }; }
        if (present(action.modelUid)) actor = { ...actor, model: model(action.modelUid, context) };
        document = { ...document, actors: [...document.actors, actor] };
        effects.push({ type: 'select', id: actor.id, mode: 'orbit' }); summaries.push(`Added actor ${actor.name}${actor.model ? ` wearing “${actor.model.name}” by ${actor.model.author} (${actor.model.license})` : ''}.`);
        break;
      }
      case 'updateActor': {
        const actor = findActor(action.targetId);
        const patch: ActorPatch = {};
        if (present(action.name)) patch.name = name(action.name, actor.name);
        if (present(action.color)) patch.color = hex(action.color, 'Actor color');
        if (present(action.height)) patch.height = action.height as number;
        let next = updateActor(actor, patch);
        if (action.modelUid === 'none') { const { model: _removed, ...rest } = next; next = rest; }
        else if (present(action.modelUid)) next = { ...next, model: model(action.modelUid, context) };
        if (next === actor || JSON.stringify(next) === JSON.stringify(actor)) throw new Error('Tell the Director what to change about the actor.');
        setActor(next); effects.push({ type: 'select', id: actor.id, mode: 'orbit' }); summaries.push(`Updated ${next.name}.`);
        break;
      }
      case 'setActorMark': {
        const actor = findActor(action.targetId);
        if (!isNumber(action.time) || action.time < 0 || action.time > 60) throw new Error('Actor mark time must be 0–60 seconds.');
        // Snap to the frame grid so marks line up with scrubbing.
        const time = Math.round(action.time * context.fps) / context.fps;
        const pose = evaluateActor(actor, time);
        if (present(action.headingDeg) && !isNumber(action.headingDeg)) throw new Error('Heading must be a number of degrees.');
        const position = present(action.position) ? vector(action.position, 'Actor position') : pose.position;
        setActor(setActorPoseAtTime(actor, time, { id: actor.id, position, heading: present(action.headingDeg) ? action.headingDeg as number * DEG : pose.heading }));
        effects.push({ type: 'select', id: actor.id, mode: 'orbit' }); summaries.push(`Set ${actor.name}'s mark at ${time.toFixed(2)} s.`);
        break;
      }
      case 'addAudio': {
        if ((document.audio?.length ?? 0) >= MAX_AUDIO_CLIPS) throw new Error(`This project already has ${MAX_AUDIO_CLIPS} audio clips.`);
        const key = parseAudioKey(action.audioId);
        const source = key && context.audio && Object.hasOwn(context.audio, `${key.provider}:${key.id}`) ? context.audio[`${key.provider}:${key.id}`] : undefined;
        if (!source) throw new Error('That music or sound was not verified by the server. Search again and choose a listed result.');
        if (!isNumber(action.time) || action.time < 0 || action.time > 120) throw new Error('Audio start time must be 0–120 seconds.');
        const optional = (name: string, min: number, max: number) => {
          const value = action[name];
          if (!present(value)) return undefined;
          if (!isNumber(value) || value < min || value > max) throw new Error(`Audio ${name} must be ${min}–${max}.`);
          return value;
        };
        const clip = createAudioClip(context.newId('audio'), source, action.time, {
          timelineEnd: context.timelineEnd, offset: optional('audioOffset', 0, 3600), duration: optional('duration', .1, 120), volume: optional('volume', 0, 1), fadeIn: optional('fadeIn', 0, 10), fadeOut: optional('fadeOut', 0, 10),
        });
        document = { ...document, audio: [...(document.audio ?? []), clip] };
        summaries.push(`Added ${clip.kind === 'music' ? 'music' : 'sound'} “${source.name}” by ${source.artist} at ${clip.start.toFixed(1)} s.`);
        break;
      }
      case 'updateAudio': {
        const clip = document.audio?.find(item => item.id === action.targetId);
        if (!clip) throw new Error('Codex chose an audio clip that is not on the timeline.');
        const patch: AudioPatch = {};
        const set = (field: keyof AudioPatch, name: string, min: number, max: number) => {
          const value = action[name];
          if (!present(value)) return;
          if (!isNumber(value) || value < min || value > max) throw new Error(`Audio ${name} must be ${min}–${max}.`);
          patch[field] = value;
        };
        set('start', 'time', 0, 120); set('duration', 'duration', .1, 120); set('offset', 'audioOffset', 0, 3600); set('volume', 'volume', 0, 1); set('fadeIn', 'fadeIn', 0, 10); set('fadeOut', 'fadeOut', 0, 10);
        if (!Object.keys(patch).length) throw new Error('Tell the Director what to change about the audio.');
        const next = updateAudioClip(clip, patch);
        document = { ...document, audio: (document.audio ?? []).map(item => item.id === clip.id ? next : item) };
        summaries.push(`Updated “${clip.source.name}”.`);
        break;
      }
      case 'removeAudio': {
        const clip = document.audio?.find(item => item.id === action.targetId);
        if (!clip) throw new Error('Codex chose an audio clip that is not on the timeline.');
        document = { ...document, audio: (document.audio ?? []).filter(item => item.id !== clip.id) };
        summaries.push(`Removed “${clip.source.name}”.`);
        break;
      }
      case 'removeActor': {
        const actor = findActor(action.targetId);
        document = { ...document, actors: document.actors.filter(item => item.id !== actor.id) }; summaries.push(`Removed ${actor.name}.`);
        break;
      }
      default: throw new Error('Codex returned an unsupported scene action.');
    }
  }
  return { document, effects, summaries };
}
