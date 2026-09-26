import type { ModelOption, ModelSource } from '@/contracts';
import { MODEL_LICENSES, validateModelSource } from '@/features/props/model';
import { HttpError } from './http';

const API = 'https://api.sketchfab.com/v3';
const TIMEOUT_MS = 15_000;
export const UID = /^[a-f0-9]{32}$/;

/** Sketchfab licence IDs for the free Creative Commons licences (stable; see GET /v3/licenses). */
const LICENSE_SLUGS: Record<string, (typeof MODEL_LICENSES)[number]> = {
  '7c23a1ba438d4306920229c12afcb5f9': 'cc0',
  '322a749bcfa841b29dff1e8a1bb74b0b': 'by',
  'b9ddc40b93e34cdca1fc152f39b9f375': 'by-sa',
  '72360ff1740d419791934298b8b6d270': 'by-nd',
  'bbfe3f7dbcdd4122b966b85b9786a989': 'by-nc',
  '2628dbe5140a4e9592126c8df566c0b7': 'by-nc-sa',
  '34b725081a6a4184957efaec2cb84ed3': 'by-nc-nd',
};
const LICENSE_URLS: Record<string, string> = {
  cc0: 'https://creativecommons.org/publicdomain/zero/1.0/', by: 'https://creativecommons.org/licenses/by/4.0/', 'by-sa': 'https://creativecommons.org/licenses/by-sa/4.0/',
  'by-nd': 'https://creativecommons.org/licenses/by-nd/4.0/', 'by-nc': 'https://creativecommons.org/licenses/by-nc/4.0/', 'by-nc-sa': 'https://creativecommons.org/licenses/by-nc-sa/4.0/', 'by-nc-nd': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
};

export const maxModelBytes = () => Math.max(1, Math.min(200, Number(process.env.SKETCHFAB_MAX_MB) || 40)) * 1024 * 1024;
const MAX_FACES = 150_000;
export const sketchfabConfigured = () => Boolean(process.env.SKETCHFAB_API_TOKEN);

export type ModelSummary = ModelOption;

type ApiLicense = { uid?: string; label?: string; slug?: string; url?: string; uri?: string };
type ApiModel = {
  uid?: string; name?: string; viewerUrl?: string; isDownloadable?: boolean; faceCount?: number; isAgeRestricted?: boolean;
  user?: { displayName?: string; username?: string; profileUrl?: string }; license?: ApiLicense | null;
  archives?: Record<string, { size?: number } | undefined>; tags?: { name?: string }[];
  thumbnails?: { images?: { width?: number; url?: string }[] };
};

async function api(path: string, init?: RequestInit): Promise<Response> {
  try { return await fetch(`${API}${path}`, { ...init, cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) }); }
  catch { throw new HttpError(502, 'Sketchfab did not respond. Try again shortly.'); }
}

function licenseSlug(license: ApiLicense | null | undefined): string | null {
  if (!license) return null;
  const uid = license.uid ?? license.uri?.split('/').filter(Boolean).at(-1);
  const slug = (uid && LICENSE_SLUGS[uid]) || license.slug;
  return slug && (MODEL_LICENSES as readonly string[]).includes(slug) ? slug : null;
}

function archiveBytes(model: ApiModel): number | null {
  const size = model.archives?.glb?.size ?? model.archives?.gltf?.size;
  return typeof size === 'number' && Number.isFinite(size) ? size : null;
}

function clean(text: unknown, max = 200) { return typeof text === 'string' ? text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : ''; }

/** Build an attribution record only from fields Sketchfab returned; never from model output. */
function toSource(model: ApiModel): ModelSource | null {
  const slug = licenseSlug(model.license);
  if (!slug || !model.uid || !UID.test(model.uid) || model.isAgeRestricted) return null;
  const author = clean(model.user?.displayName) || clean(model.user?.username);
  const source: ModelSource = {
    provider: 'sketchfab', uid: model.uid, name: clean(model.name) || 'Untitled model', author: author || 'Unknown author',
    authorUrl: model.user?.profileUrl?.startsWith('https://sketchfab.com/') ? model.user.profileUrl : `https://sketchfab.com/${encodeURIComponent(clean(model.user?.username, 60) || 'sketchfab')}`,
    license: clean(model.license?.label) || slug.toUpperCase(), licenseUrl: LICENSE_URLS[slug], viewerUrl: `https://sketchfab.com/3d-models/${model.uid}`,
  };
  try { validateModelSource(source); return source; } catch { return null; }
}

export async function searchModels(query: string, count = 6): Promise<ModelSummary[]> {
  const q = clean(query, 80);
  if (!q) throw new HttpError(400, 'Enter something to search for.');
  const params = new URLSearchParams({ type: 'models', q, downloadable: 'true', count: '24', max_face_count: String(MAX_FACES), archives_flavours: 'false' });
  const response = await api(`/search?${params}`);
  if (!response.ok) throw new HttpError(502, `Sketchfab search failed (${response.status}).`);
  const body = await response.json().catch(() => null) as { results?: ApiModel[] } | null;
  const limit = maxModelBytes();
  const results: ModelSummary[] = [];
  for (const model of body?.results ?? []) {
    const source = toSource(model), bytes = archiveBytes(model);
    if (!source || !model.isDownloadable || bytes === null || bytes > limit) continue;
    results.push({
      uid: source.uid, name: source.name, author: source.author, license: source.license, licenseSlug: licenseSlug(model.license)!,
      faces: Math.round(model.faceCount ?? 0), megabytes: Math.round(bytes / 1e5) / 10,
      tags: (model.tags ?? []).map(tag => clean(tag.name, 30)).filter(Boolean).slice(0, 6),
      thumbnail: model.thumbnails?.images?.filter(image => (image.width ?? 0) >= 200).sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url,
      viewerUrl: source.viewerUrl,
    });
    if (results.length >= Math.min(12, count)) break;
  }
  return results;
}

/** Re-verify a model chosen by the Director or the user: public, downloadable, free CC licence. */
export async function verifiedModel(uid: string): Promise<ModelSource> {
  if (!UID.test(uid)) throw new HttpError(400, 'Invalid Sketchfab model ID.');
  const response = await api(`/models/${uid}`);
  if (response.status === 404) throw new HttpError(404, 'That Sketchfab model no longer exists.');
  if (!response.ok) throw new HttpError(502, `Sketchfab model lookup failed (${response.status}).`);
  const model = await response.json().catch(() => null) as ApiModel | null;
  if (!model?.isDownloadable) throw new HttpError(422, 'That Sketchfab model is not downloadable.');
  const source = model && toSource(model);
  if (!source) throw new HttpError(422, 'That Sketchfab model does not use a free Creative Commons licence.');
  return source;
}

/** Temporary signed archive URLs (≈5 minutes). Requires the server-only API token. */
export async function downloadLinks(uid: string): Promise<{ kind: 'glb' | 'gltf'; url: string; size: number }> {
  const token = process.env.SKETCHFAB_API_TOKEN;
  if (!token) throw new HttpError(503, 'Sketchfab downloads are not configured on this server (SKETCHFAB_API_TOKEN).');
  if (!UID.test(uid)) throw new HttpError(400, 'Invalid Sketchfab model ID.');
  const response = await api(`/models/${uid}/download`, { headers: { Authorization: `Token ${token}` } });
  if (response.status === 401 || response.status === 403) throw new HttpError(502, 'Sketchfab rejected the server API token.');
  if (!response.ok) throw new HttpError(502, `Sketchfab download request failed (${response.status}).`);
  const body = await response.json().catch(() => null) as Record<string, { url?: string; size?: number } | undefined> | null;
  for (const kind of ['glb', 'gltf'] as const) {
    const entry = body?.[kind];
    if (typeof entry?.url !== 'string') continue;
    let url: URL;
    try { url = new URL(entry.url); } catch { continue; }
    if (url.protocol !== 'https:') continue;
    return { kind, url: url.href, size: typeof entry.size === 'number' ? entry.size : 0 };
  }
  throw new HttpError(422, 'Sketchfab did not offer a glTF download for this model.');
}
