import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AudioOption, AudioSource } from '@/contracts';
import { audioKey, builtinAudio, validateAudioSource } from '@/features/audio/model';
import { HttpError } from './http';

const TIMEOUT_MS = 15_000;
const ID = /^\d{1,12}$/;
/** Music beds can be long; effects are short. Both are fetched as compressed previews/streams. */
const MAX_BYTES = { jamendo: 25 * 1024 * 1024, freesound: 8 * 1024 * 1024 } as const;
/** Downloads are only ever made from these hosts, using URLs the provider's own API returned. */
const FILE_HOSTS = { jamendo: ['jamendo.com'], freesound: ['freesound.org'] } as const;

export const audioConfigured = () => ({ music: Boolean(process.env.JAMENDO_CLIENT_ID), sfx: Boolean(process.env.FREESOUND_API_KEY) });
const clean = (text: unknown, max = 200) => typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';

async function getJson(url: string, label: string): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) }); }
  catch { throw new HttpError(502, `${label} did not respond. Try again shortly.`); }
  if (response.status === 401 || response.status === 403) throw new HttpError(502, `${label} rejected the server API key.`);
  if (response.status === 404) throw new HttpError(404, `That ${label} item no longer exists.`);
  if (!response.ok) throw new HttpError(502, `${label} request failed (${response.status}).`);
  return response.json().catch(() => { throw new HttpError(502, `${label} returned an unreadable response.`); });
}

// ── Jamendo (music) ─────────────────────────────────────────────────────────────────────────────────
type JamendoTrack = { id?: string | number; name?: string; duration?: number; artist_id?: string | number; artist_name?: string; shareurl?: string; audio?: string; license_ccurl?: string; musicinfo?: { tags?: { genres?: string[]; vartags?: string[]; instruments?: string[] } } };
function jamendoLicense(url: string | undefined) {
  const match = /creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i.exec(url ?? '');
  if (!match) return null;
  const slug = match[1].toLowerCase();
  // Scoring a video is a derivative use, so NoDerivs tracks are excluded.
  if (slug.includes('nd')) return null;
  return { label: `CC ${slug.toUpperCase()} ${match[2]}`, url: `https://creativecommons.org/licenses/${slug}/${match[2]}/` };
}
function jamendoSource(track: JamendoTrack): { source: AudioSource; file: string; tags: string[] } | null {
  const id = String(track.id ?? '');
  const license = jamendoLicense(track.license_ccurl);
  if (!ID.test(id) || !license || typeof track.audio !== 'string' || !track.audio) return null;
  const source: AudioSource = {
    provider: 'jamendo', id, name: clean(track.name) || 'Untitled track', artist: clean(track.artist_name) || 'Unknown artist',
    artistUrl: `https://www.jamendo.com/artist/${encodeURIComponent(String(track.artist_id ?? ''))}`, license: license.label, licenseUrl: license.url,
    pageUrl: `https://www.jamendo.com/track/${id}`, duration: Number(track.duration) || 0,
  };
  try { validateAudioSource(source); } catch { return null; }
  const tags = [...(track.musicinfo?.tags?.genres ?? []), ...(track.musicinfo?.tags?.vartags ?? [])].map(tag => clean(tag, 30)).filter(Boolean).slice(0, 8);
  return { source, file: track.audio, tags };
}
async function jamendoRequest(params: Record<string, string>) {
  const key = process.env.JAMENDO_CLIENT_ID;
  if (!key) throw new HttpError(503, 'Music search is not configured on this server (JAMENDO_CLIENT_ID).');
  const query = new URLSearchParams({ client_id: key, format: 'json', audioformat: 'mp32', include: 'musicinfo licenses', ccnd: 'false', ...params });
  const body = await getJson(`https://api.jamendo.com/v3.0/tracks/?${query}`, 'Jamendo') as { headers?: { status?: string; error_message?: string }; results?: JamendoTrack[] };
  // Jamendo reports errors inside a 200 response.
  if (body.headers?.status && body.headers.status !== 'success') throw new HttpError(502, `Jamendo: ${clean(body.headers.error_message) || 'request failed'}.`);
  const raw = body.results ?? [];
  return { raw: raw.length, items: raw.map(jamendoSource).filter((item): item is NonNullable<typeof item> => !!item) };
}

const searchCache = new Map<string, { at: number; items: NonNullable<ReturnType<typeof jamendoSource>>[] }>();
const known = new Map<string, { at: number; source: AudioSource; file: string }>();
function remember(item: { source: AudioSource; file: string }) {
  known.set(audioKey(item.source), { at: Date.now(), source: item.source, file: item.file });
  if (known.size > 500) known.delete(known.keys().next().value!);
}
const SEARCH_TTL_MS = 10 * 60_000;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/**
 * Jamendo's search intermittently answers "success" with zero results for a query that works a moment later,
 * so empty answers are retried, then broadened (popularity order, then tag search). Good results are cached.
 */
async function jamendoSearch(q: string) {
  const key = q.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached.items;
  const tags = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).slice(0, 4).join(' ');
  const attempts: Record<string, string>[] = [
    { search: q, order: 'relevance' }, { search: q, order: 'relevance' }, { search: q, order: 'popularity_total' },
    ...(tags ? [{ fuzzytags: tags, order: 'popularity_total' }] : []),
  ];
  let items: NonNullable<ReturnType<typeof jamendoSource>>[] = [];
  for (const [index, attempt] of attempts.entries()) {
    const result = await jamendoRequest({ ...attempt, limit: '20' });
    items = result.items;
    // Stop once Jamendo returns tracks at all; an all-filtered page (e.g. every track NoDerivs) still counts as an answer.
    if (result.raw > 0 && (items.length > 0 || index >= 2)) break;
    await pause(200 + index * 150);
  }
  if (items.length) {
    items.forEach(remember);
    searchCache.set(key, { at: Date.now(), items });
    if (searchCache.size > 200) searchCache.delete(searchCache.keys().next().value!);
  }
  return items;
}

// ── Freesound (sound effects) ───────────────────────────────────────────────────────────────────────
type FreesoundSound = { id?: number; name?: string; username?: string; license?: string; duration?: number; url?: string; tags?: string[]; previews?: Record<string, string> };
const FREESOUND_LICENSES: Record<string, { label: string; url: string }> = {
  'creative commons 0': { label: 'CC0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  attribution: { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  'attribution noncommercial': { label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
};
function freesoundLicense(raw: string | undefined) {
  const value = (raw ?? '').toLowerCase();
  if (value.includes('publicdomain/zero') || value === 'creative commons 0') return FREESOUND_LICENSES['creative commons 0'];
  const match = /creativecommons\.org\/licenses\/(by(?:-nc)?)\/([\d.]+)/.exec(value);
  if (match) return { label: `CC ${match[1].toUpperCase()} ${match[2]}`, url: `https://creativecommons.org/licenses/${match[1]}/${match[2]}/` };
  return FREESOUND_LICENSES[value] ?? null; // Sampling+ and unknown licences are excluded
}
function freesoundSource(sound: FreesoundSound): { source: AudioSource; file: string; tags: string[] } | null {
  const id = String(sound.id ?? '');
  const license = freesoundLicense(sound.license);
  const file = sound.previews?.['preview-hq-mp3'] ?? sound.previews?.['preview-lq-mp3'];
  if (!ID.test(id) || !license || !file) return null;
  const artist = clean(sound.username, 100) || 'Unknown';
  const source: AudioSource = {
    provider: 'freesound', id, name: clean(sound.name) || 'Untitled sound', artist, artistUrl: `https://freesound.org/people/${encodeURIComponent(artist)}/`,
    license: license.label, licenseUrl: license.url, pageUrl: sound.url?.startsWith('https://freesound.org/') ? sound.url : `https://freesound.org/s/${id}/`, duration: Number(sound.duration) || 0,
  };
  try { validateAudioSource(source); } catch { return null; }
  return { source, file, tags: (sound.tags ?? []).map(tag => clean(tag, 30)).filter(Boolean).slice(0, 8) };
}
const FREESOUND_FIELDS = 'id,name,username,license,duration,url,tags,previews';
async function freesoundGet(pathname: string, params: Record<string, string>) {
  const key = process.env.FREESOUND_API_KEY;
  if (!key) throw new HttpError(503, 'Sound effect search is not configured on this server (FREESOUND_API_KEY).');
  return getJson(`https://freesound.org/apiv2/${pathname}?${new URLSearchParams({ token: key, fields: FREESOUND_FIELDS, ...params })}`, 'Freesound');
}

// ── Public API ──────────────────────────────────────────────────────────────────────────────────────
export async function searchAudio(kind: 'music' | 'sfx', query: string, count = 8): Promise<AudioOption[]> {
  const q = clean(query, 80);
  if (!q) throw new HttpError(400, 'Enter something to search for.');
  const found = kind === 'music'
    ? (await jamendoSearch(q)).map(item => (remember(item), item))
    : ((await freesoundGet('search/', { query: q, page_size: '20', filter: 'duration:[0.1 TO 30]' }).catch(async error => {
        if (error instanceof HttpError && error.status === 404) return freesoundGet('search/text/', { query: q, page_size: '20', filter: 'duration:[0.1 TO 30]' });
        throw error;
      })) as { results?: FreesoundSound[] }).results?.map(freesoundSource).filter((item): item is NonNullable<typeof item> => !!item).map(item => (remember(item), item)) ?? [];
  return found.slice(0, Math.min(12, count)).map(({ source, tags }) => ({ ...source, key: audioKey(source), tags }));
}

/** Re-fetch a source by ID so attribution and the file URL always come from the provider. */
export async function lookupAudio(provider: AudioSource['provider'], id: string): Promise<{ source: AudioSource; file: string }> {
  if (provider === 'builtin') {
    const entry = builtinAudio(id);
    if (!entry) throw new HttpError(404, 'Unknown built-in soundtrack.');
    return entry;
  }
  if (!ID.test(id)) throw new HttpError(400, 'Invalid audio ID.');
  const cached = known.get(`${provider}:${id}`);
  if (cached && Date.now() - cached.at < SEARCH_TTL_MS) return cached;
  let found: { source: AudioSource; file: string } | null | undefined;
  if (provider === 'jamendo') {
    // Jamendo's ID lookup is as flaky as its search: an empty answer is retried before giving up.
    for (let attempt = 0; attempt < 3 && !found; attempt++) {
      const result = await jamendoRequest({ id });
      found = result.items[0];
      if (!found && result.raw > 0) break; // the track exists but its licence is excluded
      if (!found) await pause(250 + attempt * 250);
    }
  } else found = freesoundSource(await freesoundGet(`sounds/${id}/`, {}) as FreesoundSound);
  if (!found) throw new HttpError(422, 'That audio is unavailable or its licence does not allow use in a video.');
  remember(found);
  return found;
}
export async function verifiedAudio(provider: AudioSource['provider'], id: string) { return (await lookupAudio(provider, id)).source; }

// ── File cache ──────────────────────────────────────────────────────────────────────────────────────
const root = () => path.resolve(/* turbopackIgnore: true */ process.env.AUDIO_CACHE_DIR || path.join(os.tmpdir(), 'showcam-audio'));
const inflight = new Map<string, Promise<Buffer>>();

async function download(provider: Exclude<AudioSource['provider'], 'builtin'>, id: string): Promise<Buffer> {
  const { file } = await lookupAudio(provider, id);
  let url: URL;
  try { url = new URL(file); } catch { throw new HttpError(502, 'The provider returned an invalid audio link.'); }
  if (url.protocol !== 'https:' || !FILE_HOSTS[provider].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) throw new HttpError(502, 'The provider returned an unexpected audio host.');
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(60_000) }); }
  catch { throw new HttpError(502, 'The audio download did not complete.'); }
  if (!response.ok || !response.body) throw new HttpError(502, `The audio download failed (${response.status}).`);
  const type = response.headers.get('content-type') ?? '';
  if (type && !/^audio\/|application\/octet-stream/.test(type)) throw new HttpError(502, 'The provider did not return audio.');
  const limit = MAX_BYTES[provider];
  if (Number(response.headers.get('content-length') ?? 0) > limit) throw new HttpError(413, 'This audio file is larger than the limit.');
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new HttpError(413, 'This audio file is larger than the limit.'); }
    chunks.push(value);
  }
  const data = Buffer.concat(chunks);
  const dir = root(), final = path.join(/* turbopackIgnore: true */ dir, `${provider}-${id}.mp3`), staging = `${final}.partial-${process.pid}-${Date.now()}`;
  await mkdir(dir, { recursive: true });
  try { await writeFile(staging, data); await rename(staging, final); } catch { await rm(staging, { force: true }); }
  return data;
}

export async function cachedAudio(provider: AudioSource['provider'], id: string): Promise<Buffer> {
  if (provider === 'builtin') {
    const { file } = await lookupAudio(provider, id);
    return readFile(path.join(/* turbopackIgnore: true */ process.cwd(), 'public', file));
  }
  if (!ID.test(id)) throw new HttpError(400, 'Invalid audio ID.');
  try { return await readFile(path.join(/* turbopackIgnore: true */ root(), `${provider}-${id}.mp3`)); } catch { /* not cached */ }
  const key = `${provider}:${id}`;
  let pending = inflight.get(key);
  if (!pending) { pending = download(provider, id).finally(() => inflight.delete(key)); inflight.set(key, pending); }
  return pending;
}
