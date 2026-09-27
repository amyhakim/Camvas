import type { LightCue, LookSettings, TitleCard } from '../../contracts';

export const MAX_TITLES = 12;
export const MAX_LIGHT_CUES = 12;
const HEX = /^#[0-9a-f]{6}$/i;
const TITLE_ID = /^title:[A-Za-z0-9_-]{1,64}$/;

/** A dark tabletop product look: coloured rims, a top beam through haze, dust in the light, glossy floor. */
export const STUDIO_DARK: LookSettings = {
  lighting: { rig: 'studio', subjectId: null, angle: 0, key: 1, fill: .22, rim: 1.6, beam: .9, environment: .8, keyColor: '#fff3e6', rimColor: '#ff2d2d', rimColor2: '#cfe2ff', sweep: null },
  camera: { exposure: 0, bloom: .25, dof: .5, vignette: .35, grain: .12, fringing: 0, contrast: 1.06, saturation: 1, tint: '#ffffff', toneMapping: 'aces' },
  atmosphere: { haze: .2, dust: .25 },
  finish: { letterbox: null, fadeIn: 0, fadeOut: 0 },
};
/** Soft, even, high-key product light. */
export const STUDIO_BRIGHT: LookSettings = {
  lighting: { rig: 'studio', subjectId: null, angle: 0, key: 1.2, fill: .8, rim: .7, beam: 0, environment: 1.4, keyColor: '#ffffff', rimColor: '#ffffff', rimColor2: '#e8f0ff', sweep: null },
  camera: { exposure: .4, bloom: .12, dof: .25, vignette: .15, grain: .08, fringing: 0, contrast: 1, saturation: 1, tint: '#ffffff', toneMapping: 'neutral' },
  atmosphere: { haze: 0, dust: 0 },
  finish: { letterbox: null, fadeIn: 0, fadeOut: 0 },
};
/** Keeps the scene's own light and adds a filmic finish. */
export const SCENE_FILMIC: LookSettings = {
  lighting: { rig: 'scene', subjectId: null, angle: 0, key: 1, fill: .3, rim: 1, beam: 0, environment: 0, keyColor: '#ffffff', rimColor: '#ffffff', rimColor2: '#ffffff', sweep: null },
  camera: { exposure: 0, bloom: .15, dof: .3, vignette: .3, grain: .12, fringing: 0, contrast: 1.05, saturation: 1, tint: '#ffffff', toneMapping: 'aces' },
  atmosphere: { haze: 0, dust: 0 },
  finish: { letterbox: 2.39, fadeIn: 0, fadeOut: 0 },
};
/** Captured light and real optics: HDRI reflections, soft contact shadows, f/4 depth of field, micro detail, film motion blur. */
export const PHOTOREAL: LookSettings = {
  lighting: { rig: 'studio', subjectId: null, angle: 0, key: .8, fill: .2, rim: 1, beam: .3, environment: 1, keyColor: '#fff4ea', rimColor: '#ff2a2a', rimColor2: '#dbe8ff', sweep: null, environmentMap: 'studio', shadowSoftness: .6, floor: .25 },
  camera: { exposure: 0, bloom: .18, dof: .5, vignette: .28, grain: .12, fringing: .02, contrast: 1.04, saturation: 1, tint: '#ffffff', toneMapping: 'aces2', aperture: 4, ao: .6, detail: .5, sharpen: .3, shake: .25 },
  atmosphere: { haze: .1, dust: .15 },
  finish: { letterbox: null, fadeIn: 0, fadeOut: 0, motionBlur: 180 },
};
export const ENVIRONMENT_MAPS = [
  { value: 'softboxes', label: 'Softboxes · procedural' },
  { value: 'studio', label: 'Photo studio · HDRI' },
  { value: 'warm-studio', label: 'Warm studio · HDRI' },
] as const;
export const LOOK_PRESETS = [
  { id: 'photoreal', name: 'Photoreal · studio', look: PHOTOREAL },
  { id: 'studio-dark', name: 'Studio · dark', look: STUDIO_DARK },
  { id: 'studio-bright', name: 'Studio · bright', look: STUDIO_BRIGHT },
  { id: 'scene-filmic', name: 'Scene light · filmic', look: SCENE_FILMIC },
] as const;
export const LETTERBOXES = [{ value: null, label: 'Full frame' }, { value: 1.85, label: '1.85 : 1' }, { value: 2, label: '2 : 1' }, { value: 2.39, label: '2.39 : 1 scope' }] as const;

function fail(path: string, requirement: string): never { throw new Error(`${path}: ${requirement}.`); }
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'expected an object');
  return value as Record<string, unknown>;
}
function number(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(path, `expected a number between ${min} and ${max}`);
  return value;
}
function color(value: unknown, path: string): string {
  if (typeof value !== 'string' || !HEX.test(value)) fail(path, 'use a six-digit hex color such as #ff2d2d');
  return value.toLowerCase();
}
function choice<T extends string>(value: unknown, path: string, choices: readonly T[]): T {
  if (!choices.includes(value as T)) fail(path, `choose ${choices.join(', ')}`);
  return value as T;
}
function text(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(path, `expected 1–${max} characters`);
  return value.trim();
}

/** Rebuilds recognised look fields only; throws with the offending path. */
export function normalizeLook(value: unknown, path = 'look'): LookSettings {
  const look = object(value, path);
  const l = object(look.lighting, `${path}.lighting`), c = object(look.camera, `${path}.camera`), a = object(look.atmosphere, `${path}.atmosphere`), f = object(look.finish, `${path}.finish`);
  const lp = `${path}.lighting`, cp = `${path}.camera`;
  let sweep: LookSettings['lighting']['sweep'] = null;
  if (l.sweep !== null && l.sweep !== undefined) {
    const s = object(l.sweep, `${lp}.sweep`);
    sweep = { start: number(s.start, `${lp}.sweep.start`, 0, 120), duration: number(s.duration, `${lp}.sweep.duration`, .1, 20), intensity: number(s.intensity, `${lp}.sweep.intensity`, 0, 4) };
  }
  let cues: LightCue[] | undefined;
  if (l.cues !== undefined) {
    if (!Array.isArray(l.cues) || l.cues.length > MAX_LIGHT_CUES) fail(`${lp}.cues`, `expected at most ${MAX_LIGHT_CUES} cues`);
    cues = l.cues.map((value, i) => {
      const q = object(value, `${lp}.cues[${i}]`), qp = `${lp}.cues[${i}]`;
      const cue: LightCue = { start: number(q.start, `${qp}.start`, 0, 120), angle: number(q.angle, `${qp}.angle`, -Math.PI * 2, Math.PI * 2), key: number(q.key, `${qp}.key`, 0, 4), rim: number(q.rim, `${qp}.rim`, 0, 4), beam: number(q.beam, `${qp}.beam`, 0, 4), rimColor: color(q.rimColor, `${qp}.rimColor`), rimColor2: color(q.rimColor2, `${qp}.rimColor2`) };
      if (q.subjectId !== undefined && q.subjectId !== null) cue.subjectId = text(q.subjectId, `${qp}.subjectId`, 500);
      return cue;
    }).sort((a, b) => a.start - b.start);
    if (new Set(cues.map(cue => cue.start)).size !== cues.length) fail(`${lp}.cues`, 'cue times must be unique');
  }
  let subjectId: string | null = null;
  if (l.subjectId !== null && l.subjectId !== undefined) subjectId = text(l.subjectId, `${lp}.subjectId`, 500);
  const letterbox = f.letterbox === null || f.letterbox === undefined ? null : number(f.letterbox, `${path}.finish.letterbox`, 1.2, 2.8);
  const optional = (source: Record<string, unknown>, key: string, prefix: string, min: number, max: number) => source[key] === undefined ? {} : { [key]: number(source[key], `${prefix}.${key}`, min, max) };
  return {
    lighting: {
      rig: choice(l.rig, `${lp}.rig`, ['scene', 'studio']), subjectId, angle: number(l.angle, `${lp}.angle`, -Math.PI * 2, Math.PI * 2),
      key: number(l.key, `${lp}.key`, 0, 4), fill: number(l.fill, `${lp}.fill`, 0, 4), rim: number(l.rim, `${lp}.rim`, 0, 4), beam: number(l.beam, `${lp}.beam`, 0, 4), environment: number(l.environment, `${lp}.environment`, 0, 3),
      keyColor: color(l.keyColor, `${lp}.keyColor`), rimColor: color(l.rimColor, `${lp}.rimColor`), rimColor2: color(l.rimColor2, `${lp}.rimColor2`), sweep, ...(cues?.length ? { cues } : {}),
      ...(l.environmentMap === undefined ? {} : { environmentMap: choice(l.environmentMap, `${lp}.environmentMap`, ['softboxes', 'studio', 'warm-studio'] as const) }),
      ...optional(l, 'shadowSoftness', lp, 0, 1), ...optional(l, 'floor', lp, 0, 1),
    },
    camera: {
      exposure: number(c.exposure, `${cp}.exposure`, -3, 3), bloom: number(c.bloom, `${cp}.bloom`, 0, 1), dof: number(c.dof, `${cp}.dof`, 0, 1), vignette: number(c.vignette, `${cp}.vignette`, 0, 1),
      grain: number(c.grain, `${cp}.grain`, 0, 1), fringing: number(c.fringing, `${cp}.fringing`, 0, 1), contrast: number(c.contrast, `${cp}.contrast`, .5, 1.5), saturation: number(c.saturation, `${cp}.saturation`, 0, 2),
      tint: color(c.tint, `${cp}.tint`), toneMapping: choice(c.toneMapping, `${cp}.toneMapping`, ['aces', 'aces2', 'neutral', 'filmic']),
      ...optional(c, 'aperture', cp, 1, 32), ...optional(c, 'ao', cp, 0, 1), ...optional(c, 'detail', cp, 0, 1), ...optional(c, 'sharpen', cp, 0, 1), ...optional(c, 'shake', cp, 0, 1),
    },
    atmosphere: { haze: number(a.haze, `${path}.atmosphere.haze`, 0, 1), dust: number(a.dust, `${path}.atmosphere.dust`, 0, 1) },
    finish: { letterbox, fadeIn: number(f.fadeIn, `${path}.finish.fadeIn`, 0, 5), fadeOut: number(f.fadeOut, `${path}.finish.fadeOut`, 0, 5), ...optional(f, 'motionBlur', `${path}.finish`, 0, 360) },
  };
}

/** Title text keeps its spaces (so it can be typed word by word) but must contain something visible. */
function words(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) fail(path, `expected 1–${max} characters`);
  return value;
}
export function normalizeTitle(value: unknown, path: string): TitleCard {
  const t = object(value, path);
  const id = text(t.id, `${path}.id`, 80);
  if (!TITLE_ID.test(id)) fail(`${path}.id`, 'use an ID like title:name');
  const card: TitleCard = { id, text: words(t.text, `${path}.text`, 80), start: number(t.start, `${path}.start`, 0, 120), duration: number(t.duration, `${path}.duration`, .1, 60), align: choice(t.align, `${path}.align`, ['upper', 'center', 'lower']) };
  if (t.subtitle !== undefined) card.subtitle = words(t.subtitle, `${path}.subtitle`, 120);
  return card;
}
export function normalizeTitles(value: unknown, path = 'titles'): TitleCard[] {
  if (!Array.isArray(value) || value.length > MAX_TITLES) fail(path, `expected at most ${MAX_TITLES} titles`);
  const titles = value.map((item, i) => normalizeTitle(item, `${path}[${i}]`));
  if (new Set(titles.map(title => title.id)).size !== titles.length) fail(path, 'title IDs must be unique');
  return titles;
}

/** The look at `seconds`: the latest light cue that has started replaces the rig's angle, levels and rim colours. */
export function lightingAt(look: LookSettings, seconds: number): LookSettings {
  const cue = look.lighting.cues?.filter(item => item.start <= seconds + 1e-6).at(-1);
  if (!cue) return look;
  // A cue without its own subject keeps lighting the look's subject.
  const { start: _start, subjectId, ...values } = cue;
  return { ...look, lighting: { ...look.lighting, ...values, ...(subjectId ? { subjectId } : {}) } };
}
/** The look that applies: the project's, or the dark studio look on a studio stage (so an empty stage is never black). */
export function effectiveLook(look: LookSettings | undefined, sceneKind: string | undefined): LookSettings | null {
  return look ?? (sceneKind === 'studio' ? STUDIO_DARK : null);
}

/**
 * Handheld micro-movement at `seconds`: small pan/tilt/roll offsets in degrees from layered slow sines (no randomness,
 * so every render of a frame is identical). `amount` 1 is a steady operator; real hands never hold perfectly still.
 */
export function handheld(seconds: number, amount: number) {
  const wave = (a: number, b: number, c: number, p: number) => Math.sin(seconds * a + p) * .6 + Math.sin(seconds * b + p * 1.7) * .3 + Math.sin(seconds * c + p * 2.3) * .1;
  return { pan: amount * .32 * wave(1.3, 3.1, 7.7, .4), tilt: amount * .26 * wave(1.1, 2.7, 8.3, 1.9), roll: amount * .18 * wave(.8, 2.2, 6.1, 3.1) };
}

/** Opacity of black over the picture for fades at `t` seconds in a timeline of `end` seconds. */
export function fadeAt(look: LookSettings | null, t: number, end: number): number {
  if (!look) return 0;
  const { fadeIn, fadeOut } = look.finish;
  const a = fadeIn > 0 ? Math.max(0, 1 - t / fadeIn) : 0;
  const b = fadeOut > 0 ? Math.max(0, 1 - (end - t) / fadeOut) : 0;
  return Math.min(1, Math.max(a, b));
}
/** Title opacity with 0.35 s fades at each end (never longer than a third of the card). */
export function titleOpacity(title: TitleCard, t: number): number {
  const local = t - title.start;
  if (local < 0 || local > title.duration) return 0;
  const edge = Math.min(.35, title.duration / 3);
  return Math.min(1, local / edge, (title.duration - local) / edge);
}
