import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Unzip, UnzipInflate } from 'fflate';
import { HttpError } from './http';
import { downloadLinks, maxModelBytes, UID } from './sketchfab';

/** Served content types. Anything else in an archive is dropped, so HTML/JS can never be served from the cache. */
export const MODEL_TYPES: Record<string, string> = {
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2',
};
const MAX_EXTRACTED_BYTES = 400 * 1024 * 1024;
const MAX_FILES = 400;
export type CachedModel = { entry: string; files: string[] };

const root = () => path.resolve(/* turbopackIgnore: true */ process.env.SKETCHFAB_CACHE_DIR || path.join(os.tmpdir(), 'showcam-sketchfab'));
export type ModelProgress = { message: string; progress?: number };
const listeners = new Map<string, Set<(progress: ModelProgress) => void>>();
const report = (uid: string, progress: ModelProgress) => listeners.get(uid)?.forEach(listener => listener(progress));
const inflight = new Map<string, Promise<CachedModel>>();

/** Normalise an archive or URL path to a safe relative POSIX path, or null (zip-slip, absolute, hidden, unknown type). */
export function safeRelativePath(raw: string): string | null {
  const parts = raw.replace(/\\/g, '/').split('/').filter(part => part && part !== '.');
  if (!parts.length || parts.some(part => part === '..' || part.startsWith('.') || part.length > 120 || /[\u0000-\u001f:*?"<>|]/.test(part))) return null;
  const joined = parts.join('/');
  return MODEL_TYPES[path.posix.extname(joined).toLowerCase()] ? joined : null;
}

async function fetchArchive(url: string, limit: number, progress: (value: ModelProgress) => void): Promise<Uint8Array> {
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(120_000) }); }
  catch { throw new HttpError(502, 'The Sketchfab download did not complete.'); }
  if (!response.ok || !response.body) throw new HttpError(502, `The Sketchfab download failed (${response.status}).`);
  if (Number(response.headers.get('content-length') ?? 0) > limit) throw new HttpError(413, 'This model is larger than the configured download limit.');
  const expected = Number(response.headers.get('content-length') ?? 0);
  let lastReported = -1;
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) { await reader.cancel(); throw new HttpError(413, 'This model is larger than the configured download limit.'); }
    chunks.push(value);
    const percent = expected > 0 ? Math.min(100, Math.round(total / expected * 100)) : undefined;
    const step = percent ?? Math.floor(total / (1024 * 1024));
    if (step !== lastReported) { lastReported = step; progress({ message: `Downloading archive${percent !== undefined ? ` · ${percent}%` : ` · ${(total / 1024 / 1024).toFixed(1)} MB`}`, progress: percent }); }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Streaming extraction with a real decompressed-byte budget (zip-bomb safe even when headers lie). */
export function extractGltfZip(archive: Uint8Array, maxBytes = MAX_EXTRACTED_BYTES): Map<string, Uint8Array> {
  const files = new Map<string, Uint8Array>();
  let total = 0, count = 0, failure: Error | null = null;
  const unzip = new Unzip(file => {
    const name = safeRelativePath(file.name);
    if (!name || failure) return;
    if (++count > MAX_FILES) { failure = new HttpError(422, 'The model archive has too many files.'); return; }
    const parts: Uint8Array[] = [];
    let size = 0;
    file.ondata = (error, chunk, final) => {
      if (failure) return;
      if (error) { failure = new HttpError(422, 'The model archive is corrupt.'); return; }
      size += chunk.byteLength; total += chunk.byteLength;
      if (total > maxBytes) { failure = new HttpError(413, 'The model archive expands beyond the size limit.'); file.terminate(); return; }
      parts.push(chunk);
      if (final) {
        const data = new Uint8Array(size);
        let offset = 0;
        for (const part of parts) { data.set(part, offset); offset += part.byteLength; }
        files.set(name, data);
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  unzip.push(archive, true);
  if (failure) throw failure;
  return files;
}

async function download(uid: string): Promise<CachedModel> {
  report(uid, { message: 'Requesting Sketchfab download…' });
  const link = await downloadLinks(uid);
  const limit = maxModelBytes();
  if (link.size > limit) throw new HttpError(413, 'This model is larger than the configured download limit.');
  const bytes = await fetchArchive(link.url, limit, progress => report(uid, progress));
  report(uid, { message: 'Preparing model files…' });
  const staging = path.join(/* turbopackIgnore: true */ root(), `${uid}.partial-${process.pid}-${Date.now()}`);
  await mkdir(staging, { recursive: true });
  try {
    let model: CachedModel;
    if (link.kind === 'glb' || (bytes[0] === 0x67 && bytes[1] === 0x6c && bytes[2] === 0x54 && bytes[3] === 0x46)) {
      await writeFile(path.join(/* turbopackIgnore: true */ staging, 'scene.glb'), bytes);
      model = { entry: 'scene.glb', files: ['scene.glb'] };
    } else {
      const extracted = extractGltfZip(bytes);
      const entries = [...extracted.keys()].filter(name => name.toLowerCase().endsWith('.gltf') || name.toLowerCase().endsWith('.glb')).sort((a, b) => a.split('/').length - b.split('/').length);
      if (!entries.length) throw new HttpError(422, 'The model archive has no glTF scene.');
      // Serve relative to the scene file's folder so its relative texture/buffer URIs resolve.
      const base = path.posix.dirname(entries[0]);
      const files: string[] = [];
      for (const [name, data] of extracted) {
        if (base !== '.' && !name.startsWith(`${base}/`)) continue;
        const relative = base === '.' ? name : name.slice(base.length + 1);
        const target = path.join(/* turbopackIgnore: true */ staging, ...relative.split('/'));
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, data);
        files.push(relative);
      }
      model = { entry: base === '.' ? entries[0] : entries[0].slice(base.length + 1), files };
    }
    await writeFile(path.join(/* turbopackIgnore: true */ staging, 'showcam-model.json'), JSON.stringify(model));
    const final = path.join(/* turbopackIgnore: true */ root(), uid);
    await rm(final, { recursive: true, force: true });
    await rename(staging, final);
    return model;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function cachedModel(uid: string, onProgress?: (progress: ModelProgress) => void): Promise<CachedModel> {
  if (!onProgress) return getCachedModel(uid);
  let subscribers = listeners.get(uid);
  if (!subscribers) { subscribers = new Set(); listeners.set(uid, subscribers); }
  subscribers.add(onProgress);
  onProgress({ message: 'Checking model cache…' });
  try { return await getCachedModel(uid); }
  finally { subscribers.delete(onProgress); if (!subscribers.size) listeners.delete(uid); }
}

async function getCachedModel(uid: string): Promise<CachedModel> {
  if (!UID.test(uid)) throw new HttpError(400, 'Invalid Sketchfab model ID.');
  try {
    const manifest = JSON.parse(await readFile(path.join(/* turbopackIgnore: true */ root(), uid, 'showcam-model.json'), 'utf8')) as CachedModel;
    if (typeof manifest.entry === 'string' && Array.isArray(manifest.files)) return manifest;
  } catch { /* not cached yet */ }
  let pending = inflight.get(uid);
  if (!pending) {
    pending = download(uid).finally(() => inflight.delete(uid));
    inflight.set(uid, pending);
  }
  return pending;
}

export async function readCachedFile(uid: string, relative: string): Promise<{ data: Buffer; type: string }> {
  const model = await cachedModel(uid);
  const safe = safeRelativePath(relative);
  if (!safe || !model.files.includes(safe)) throw new HttpError(404, 'Model file not found.');
  const data = await readFile(path.join(/* turbopackIgnore: true */ root(), uid, ...safe.split('/')));
  return { data, type: MODEL_TYPES[path.posix.extname(safe).toLowerCase()] };
}
