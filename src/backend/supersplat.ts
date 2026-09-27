import type { SceneManifest, Vector3Tuple } from '@/contracts';
import { superSplatReference, type SuperSplatScene } from '@/features/scene/supersplat';
import { HttpError } from './http';

const API = 'https://playcanvas.com/api/splats/explore';
const CDN = 'https://d28zzqy0iyovbz.cloudfront.net';
const clean = (value: unknown, max = 200) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function get(url: string, signal?: AbortSignal) {
  try {
    const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(15_000), ...(signal ? [signal] : [])]) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch { throw new HttpError(502, 'SuperSplat is unavailable right now. Try again shortly or choose a built-in scene.'); }
}

export function parseSearchResults(value: unknown): SuperSplatScene[] {
  const rows = record(value).result;
  if (!Array.isArray(rows)) throw new HttpError(502, 'SuperSplat returned an unreadable search response. Try again shortly.');
  return rows.flatMap(value => {
    const row = record(value), hash = clean(row.hash), version = row.version;
    if (!/^[a-f0-9]{8}$/.test(hash) || !Number.isInteger(version) || Number(version) < 1 || Number(version) > 999999 ||
      !['sog', 'ssog', 'ply'].includes(String(row.format)) || record(row.task).status !== 'complete' || row.listed !== true) return [];
    const name = clean(row.title, 100);
    if (!name) return [];
    return [{ id: `supersplat-${hash}-v${version}`, name, description: clean(row.description, 300),
      author: clean(record(row.user).username, 100) || 'SuperSplat creator',
      thumbnailUrl: `https://s3-eu-west-1.amazonaws.com/images.playcanvas.com/splat/${hash}/v${version}/l.webp`,
      sourceUrl: `https://superspl.at/scene/${hash}`, sizeBytes: typeof row.size === 'number' && Number.isFinite(row.size) && row.size > 0 ? row.size : 0,
      license: record(row.downloads).enabled === true ? clean(record(row.downloads).license, 40) || null : null }];
  });
}

export async function searchSuperSplat(query: string, signal?: AbortSignal) {
  const q = query.trim();
  if (q.length < 2 || q.length > 160) throw new HttpError(400, 'Describe a scene in 2–160 characters.');
  const url = new URL(API);
  // Matches SuperSplat's public Explore client, including its encoded search parameter.
  url.searchParams.set('search', encodeURIComponent(q));
  url.searchParams.set('limit', '24');
  const response = await get(url.toString(), signal);
  let data: unknown;
  try { data = await response.json(); } catch { throw new HttpError(502, 'SuperSplat returned an unreadable search response. Try again shortly.'); }
  return parseSearchResults(data);
}

const vector = (value: unknown): value is Vector3Tuple => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n));
function decodeText(text: string) {
  return text.replace(/&(#\d+|#x[\da-f]+|amp|quot|apos|lt|gt);/gi, (entity, code: string) => {
    if (code[0] === '#') { const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' } as Record<string, string>)[code] ?? entity;
  });
}

/** Parse only JSON bootstrap data. Never evaluate scripts or follow caller-supplied URLs. */
export function manifestFromSuperSplat(id: string, viewerHtml: string, sceneHtml: string): SceneManifest {
  const ref = superSplatReference(id);
  if (!ref) throw new HttpError(400, 'Invalid SuperSplat scene.');
  const bootstrap = viewerHtml.match(/<script\b[^>]*id="sse-bootstrap"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  let data: Record<string, unknown>;
  try { data = record(JSON.parse(bootstrap ?? '')); } catch { throw new HttpError(502, 'This SuperSplat scene cannot be opened. Choose another scene.'); }
  const base = `${CDN}/${ref.hash}/v${ref.version}/`;
  if (typeof data.contentUrl !== 'string' || !['meta.json', 'lod-meta.json', 'scene.sog', 'scene.ply'].some(file => data.contentUrl === base + file)) {
    throw new HttpError(502, 'This scene changed or uses an unsupported format. Search again and select its latest version.');
  }
  const settings = record(data.settings);
  const camera = record(record(Array.isArray(settings.cameras) ? settings.cameras[0] : null).initial);
  if (!vector(camera.position) || !vector(camera.target) || typeof camera.fov !== 'number' || !Number.isFinite(camera.fov) || camera.fov <= 0 || camera.fov >= 180) {
    throw new HttpError(422, 'This scene has no supported opening camera. Choose another SuperSplat scene.');
  }
  const name = clean(decodeText(sceneHtml.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)?.[1] ?? ''), 130).replace(/ - SuperSplat$/, '').slice(0, 100) || `SuperSplat ${ref.hash}`;
  const author = clean(decodeText(sceneHtml.match(/href="\/user\/([^"/]+)"/)?.[1] ?? 'SuperSplat creator'), 100);
  const position = camera.position, target = camera.target;
  const fov = 2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) / (16 / 9)) * 180 / Math.PI;
  const captureId = `${id}:capture`, cameraId = `${id}:camera`;
  return { id, name, asset: { kind: 'gsplat', url: data.contentUrl, rotation: [0, 0, 180] },
    initialView: { position, target, fov }, actorOrigin: [target[0], 0, target[2]],
    attribution: { author, url: `https://superspl.at/scene/${ref.hash}` },
    fps: 30, frameStart: 1, frameEnd: 301, animationEnd: 1, activeCameraId: cameraId, aspect: 16 / 9,
    objects: [
      { id: captureId, name, sourceName: `SuperSplat ${ref.hash} · v${ref.version}`, type: 'Splat', category: 'Architecture', materials: ['Captured appearance'], position: [0, 0, 0], positionWeb: [0, 0, 0], dimensions: [0, 0, 0] },
      { id: cameraId, name: 'Published opening view', sourceName: 'SuperSplat camera', type: 'Camera', category: 'Camera', materials: [], position: [position[0], -position[2], position[1]], positionWeb: position, dimensions: [0, 0, 0], animated: false },
    ],
    simplifications: ['The capture is one environment; objects are not segmented and metadata bounds are unknown until loaded.', 'Source scale and floor height are unverified. Captured surfaces are not collision geometry.', 'The opening camera is preserved; SuperSplat animations, annotations, and post effects are not imported.'],
  };
}

export async function loadSuperSplatManifest(id: string, signal?: AbortSignal) {
  const ref = superSplatReference(id);
  if (!ref) throw new HttpError(400, 'Invalid SuperSplat scene.');
  const [viewer, scene] = await Promise.all([
    get(`https://superspl.at/s?id=${ref.hash}`, signal).then(response => response.text()),
    get(`https://superspl.at/scene/${ref.hash}`, signal).then(response => response.text()),
  ]);
  return manifestFromSuperSplat(id, viewer, scene);
}
