import type { AudioClip, AudioSource } from '../../contracts';

export const MAX_AUDIO_CLIPS = 24;
export const MAX_AUDIO_END = 120;
const ID = /^\d{1,12}$/;
const CLIP_ID = /^audio:[A-Za-z0-9_-]{1,64}$/;

/** `jamendo:123` / `freesound:456`: the key the Director and the search panel use for a source. */
export const audioKey = (source: Pick<AudioSource, 'provider' | 'id'>) => `${source.provider}:${source.id}`;
export function parseAudioKey(key: unknown): { provider: AudioSource['provider']; id: string } | null {
  if (typeof key !== 'string') return null;
  const match = /^(jamendo|freesound):(\d{1,12})$/.exec(key);
  return match ? { provider: match[1] as AudioSource['provider'], id: match[2] } : null;
}
export const kindFor = (provider: AudioSource['provider']): AudioClip['kind'] => provider === 'jamendo' ? 'music' : 'sfx';

function httpsOn(value: string, hosts: string[]) {
  try { const url = new URL(value); return (url.protocol === 'https:' || (url.protocol === 'http:' && hosts.includes('creativecommons.org'))) && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)); } catch { return false; }
}

/** Attribution is shown to users, so links may only point back to the provider or the licence. */
export function validateAudioSource(source: AudioSource): void {
  if ((source.provider !== 'jamendo' && source.provider !== 'freesound') || !ID.test(source.id)) throw new Error('Audio must reference a Jamendo track or Freesound sound ID.');
  for (const [field, value] of [['name', source.name], ['artist', source.artist], ['license', source.license]] as const) {
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error(`Audio ${field} must be 1–200 characters.`);
  }
  const home = source.provider === 'jamendo' ? ['jamendo.com'] : ['freesound.org'];
  if (!httpsOn(source.pageUrl, home) || !httpsOn(source.artistUrl, home)) throw new Error(`Audio links must point to ${home[0]}.`);
  if (!httpsOn(source.licenseUrl, ['creativecommons.org'])) throw new Error('Audio licence links must point to Creative Commons.');
  if (!Number.isFinite(source.duration) || source.duration <= 0 || source.duration > 3600) throw new Error('Audio duration must be positive.');
}

export function validateAudioClip(clip: AudioClip): void {
  if (!CLIP_ID.test(clip.id)) throw new Error('Audio clip IDs look like audio:name.');
  if (clip.kind !== 'music' && clip.kind !== 'sfx') throw new Error('Audio clips are music or sound effects.');
  validateAudioSource(clip.source);
  if (clip.kind !== kindFor(clip.source.provider)) throw new Error('Jamendo clips are music; Freesound clips are sound effects.');
  if (!Number.isFinite(clip.start) || clip.start < 0 || clip.start > MAX_AUDIO_END) throw new Error(`Audio must start within 0–${MAX_AUDIO_END} s.`);
  if (!Number.isFinite(clip.offset) || clip.offset < 0 || clip.offset >= clip.source.duration) throw new Error('Audio trim must be inside the file.');
  if (!Number.isFinite(clip.duration) || clip.duration < .1 || clip.start + clip.duration > MAX_AUDIO_END + 1e-9) throw new Error(`Audio must be at least 0.1 s and end by ${MAX_AUDIO_END} s.`);
  if (clip.offset + clip.duration > clip.source.duration + .05) throw new Error('Audio clip is longer than its file.');
  if (!Number.isFinite(clip.volume) || clip.volume < 0 || clip.volume > 1) throw new Error('Volume must be 0–100%.');
  for (const fade of [clip.fadeIn, clip.fadeOut]) if (!Number.isFinite(fade) || fade < 0 || fade > 10) throw new Error('Fades must be 0–10 s.');
  if (clip.fadeIn + clip.fadeOut > clip.duration + 1e-9) throw new Error('Fades cannot be longer than the clip.');
}

export function validateAudioClips(clips: AudioClip[]): void {
  if (clips.length > MAX_AUDIO_CLIPS) throw new Error(`Keep at most ${MAX_AUDIO_CLIPS} audio clips.`);
  clips.forEach(validateAudioClip);
  if (new Set(clips.map(clip => clip.id)).size !== clips.length) throw new Error('Audio clip IDs must be unique.');
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Default placement: music fills the rest of the timeline (fading in and out); effects play once at full length. */
export function createAudioClip(id: string, source: AudioSource, start: number, options: { duration?: number; timelineEnd?: number; volume?: number; fadeIn?: number; fadeOut?: number; offset?: number } = {}): AudioClip {
  const kind = kindFor(source.provider);
  const offset = Math.min(Math.max(0, options.offset ?? 0), Math.max(0, source.duration - .1));
  const available = source.duration - offset;
  const room = MAX_AUDIO_END - start;
  const wanted = options.duration ?? (kind === 'music' ? Math.max(4, (options.timelineEnd ?? start + 8) - start) : available);
  const duration = round(Math.max(.1, Math.min(wanted, available, room)));
  const fadeIn = round(Math.min(options.fadeIn ?? (kind === 'music' ? 1.5 : 0), duration / 2));
  const fadeOut = round(Math.min(options.fadeOut ?? (kind === 'music' ? 2 : .1), duration - fadeIn));
  const clip: AudioClip = { id, kind, source, start: round(start), offset: round(offset), duration, volume: options.volume ?? (kind === 'music' ? .6 : .9), fadeIn, fadeOut };
  validateAudioClip(clip);
  return clip;
}

export type AudioPatch = Partial<Pick<AudioClip, 'start' | 'duration' | 'offset' | 'volume' | 'fadeIn' | 'fadeOut'>>;
export function updateAudioClip(clip: AudioClip, patch: AudioPatch): AudioClip {
  const next = { ...clip, ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)) } as AudioClip;
  // Keep fades legal when the clip is shortened.
  next.fadeIn = Math.min(next.fadeIn, next.duration);
  next.fadeOut = Math.min(next.fadeOut, next.duration - next.fadeIn);
  validateAudioClip(next);
  return next;
}

export function audioEnd(clips: AudioClip[] = []) { return Math.max(0, ...clips.map(clip => clip.start + clip.duration)); }

/** Gain at `t` seconds into the clip: volume shaped by linear fades. */
export function clipGain(clip: AudioClip, t: number) {
  if (t < 0 || t > clip.duration) return 0;
  const into = clip.fadeIn > 0 ? Math.min(1, t / clip.fadeIn) : 1;
  const out = clip.fadeOut > 0 ? Math.min(1, (clip.duration - t) / clip.fadeOut) : 1;
  return clip.volume * Math.min(into, out);
}

export function audioCredit(source: AudioSource) { return `“${source.name}” by ${source.artist} · ${source.license}`; }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const MIN_LENGTH = .1;
/**
 * Timeline gestures, clamped rather than rejected so dragging never errors. `move` keeps the length, `start`
 * trims the head (the audio under the clip stays put, so the file offset moves with it), `end` trims the tail.
 */
export function retimeClip(clip: AudioClip, change: { mode: 'move' | 'start' | 'end'; start?: number; end?: number }): AudioClip {
  let { start, offset, duration } = clip;
  if (change.mode === 'move') start = clamp(change.start ?? start, 0, MAX_AUDIO_END - duration);
  else if (change.mode === 'start') {
    const earliest = Math.max(0, clip.start - clip.offset);
    const next = clamp(change.start ?? start, earliest, clip.start + clip.duration - MIN_LENGTH);
    offset = clip.offset + (next - clip.start); duration = clip.duration - (next - clip.start); start = next;
  } else {
    const latest = Math.min(MAX_AUDIO_END, clip.start + clip.source.duration - clip.offset);
    duration = clamp(change.end ?? start + duration, clip.start + MIN_LENGTH, latest) - clip.start;
  }
  return updateAudioClip(clip, { start: round(start), offset: round(Math.max(0, offset)), duration: round(duration) });
}

/** Slip: play a different part of the file without moving or resizing the clip. */
export function slipClip(clip: AudioClip, offset: number): AudioClip {
  return updateAudioClip(clip, { offset: round(clamp(offset, 0, Math.max(0, clip.source.duration - clip.duration))) });
}

/** Frame bounds for timeline dragging (authored frames: seconds × fps + 1). */
export function clipBounds(clip: AudioClip, fps: number) {
  const frame = (seconds: number) => Math.round(seconds * fps) + 1;
  return {
    minStart: frame(Math.max(0, clip.start - clip.offset)),
    maxEnd: frame(Math.min(MAX_AUDIO_END, clip.start + clip.source.duration - clip.offset)),
    minLength: Math.max(1, Math.ceil(MIN_LENGTH * fps)),
    latestEnd: frame(MAX_AUDIO_END),
  };
}
