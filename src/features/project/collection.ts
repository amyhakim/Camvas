import type { ProjectDocument } from '@/contracts';
import { MAX_PROJECT_BYTES, namedProjectStorageKey, parseProject, serializeProject, type ProjectStorage } from './model';

/** A project owns ordered scenes. Each scene keeps the existing editor document and source asset ID. */
export type ProjectScene = { id: string; name: string; document: ProjectDocument };
export type ProjectCollection = { format: 'showcam-collection'; version: 1; name: string; scenes: ProjectScene[] };
export const MAX_COLLECTION_BYTES = 4 * MAX_PROJECT_BYTES;

export function createCollection(document: ProjectDocument, sceneId: string): ProjectCollection {
  return { format: 'showcam-collection', version: 1, name: document.name, scenes: [{ id: sceneId, name: 'Scene 1', document }] };
}

function requiredName(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) throw new Error(`${label} must be 1–100 characters.`);
  return value.trim();
}

export function parseCollection(text: string): ProjectCollection {
  if (new TextEncoder().encode(text).byteLength > MAX_COLLECTION_BYTES) throw new Error('Project exceeds the 4 MB limit.');
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error('Project is not valid JSON.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Project must be an object.');
  const value = raw as Record<string, unknown>;
  if (value.format !== 'showcam-collection' || value.version !== 1) throw new Error('Unsupported project collection format or version.');
  if (!Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 32) throw new Error('A project needs 1–32 scenes.');
  const scenes = value.scenes.map((entry: unknown, index): ProjectScene => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Scene ${index + 1} must be an object.`);
    const scene = entry as Record<string, unknown>;
    const id = requiredName(scene.id, `Scene ${index + 1} ID`);
    const name = requiredName(scene.name, `Scene ${index + 1} name`);
    if (!scene.document || typeof scene.document !== 'object' || Array.isArray(scene.document)) throw new Error(`Scene ${index + 1} has no document.`);
    const document = scene.document as Record<string, unknown>;
    if (typeof document.sceneId !== 'string') throw new Error(`Scene ${index + 1} has no source scene ID.`);
    return { id, name, document: parseProject(JSON.stringify(document), document.sceneId) };
  });
  if (new Set(scenes.map(scene => scene.id)).size !== scenes.length) throw new Error('Scene IDs must be unique.');
  return { format: 'showcam-collection', version: 1, name: requiredName(value.name, 'Project name'), scenes };
}

export function serializeCollection(collection: ProjectCollection): string {
  // Validate each nested scene with the existing project codec before writing any bytes.
  const text = JSON.stringify({ ...collection, scenes: collection.scenes.map(scene => ({ ...scene, document: JSON.parse(serializeProject(scene.document)) })) }, null, 2);
  return JSON.stringify(parseCollection(text), null, 2);
}

/** Reads older named, single-scene files without modifying them until the next save. */
export function loadCollection(storage: ProjectStorage, projectId: string): ProjectCollection {
  let text: string | null;
  try { text = storage.getItem(namedProjectStorageKey(projectId)); } catch { throw new Error('Browser storage could not be read.'); }
  if (!text) throw new Error('This project could not be found in this browser. Return home and choose an available project.');
  const raw = JSON.parse(text) as { format?: unknown; sceneId?: unknown };
  if (raw?.format === 'showcam-project' && typeof raw.sceneId === 'string') return createCollection(parseProject(text, raw.sceneId), 'scene:legacy');
  return parseCollection(text);
}

export function saveCollection(storage: ProjectStorage, projectId: string, collection: ProjectCollection): void {
  const text = serializeCollection(collection);
  try { storage.setItem(namedProjectStorageKey(projectId), text); } catch { throw new Error('Project could not be saved in this browser. Export a JSON copy or free browser storage.'); }
}
