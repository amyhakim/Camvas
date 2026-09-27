import type { ModelSource } from '../../contracts';
import { LOCAL_MODEL_UID } from './model';
import { builtinModelUrl } from './builtin-models';

/**
 * GLB files imported from this computer. They stay in this browser (IndexedDB), keyed by a SHA-256 content hash,
 * and are never uploaded; projects store only the reference. Other browsers and collaborators cannot load them.
 */
export const MAX_LOCAL_MODEL_BYTES = 300 * 1024 * 1024;
const DB = 'camvas-local-models', STORE = 'models';
const urls = new Map<string, Promise<string>>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser blocked local model storage. Allow site storage, then import again.'));
  });
}
async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(mode === 'readwrite' ? 'The model could not be saved in this browser. Free some storage and retry.' : 'The local model could not be read.'));
    });
  } finally { db.close(); }
}

/** Accepts binary glTF (.glb) only: a single self-contained file with its textures inside. */
export async function importLocalModel(file: File): Promise<ModelSource> {
  if (!/\.glb$/i.test(file.name)) throw new Error('Import a .glb file (binary glTF with textures inside).');
  if (file.size > MAX_LOCAL_MODEL_BYTES) throw new Error('Keep local models under 300 MB.');
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  // "glTF" magic, version 2.
  if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2) throw new Error('This file is not a glTF 2.0 binary (.glb).');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const uid = `local-${[...digest.slice(0, 12)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const name = (file.name.replace(/\.glb$/i, '').replace(/[\u0000-\u001f]/g, '').trim() || 'Imported model').slice(0, 200);
  await run('readwrite', store => store.put({ name, bytes: new Blob([bytes], { type: 'model/gltf-binary' }), added: Date.now() }, uid));
  return { provider: 'local', uid, name, author: 'You', authorUrl: '', license: 'Imported file', licenseUrl: '', viewerUrl: '' };
}

/** Shipped asset URL, or an object URL for an imported model created once per page. */
export function localModelUrl(uid: string): Promise<string> {
  const bundled = builtinModelUrl(uid);
  if (bundled) return Promise.resolve(bundled);
  if (!LOCAL_MODEL_UID.test(uid)) return Promise.reject(new Error('Unknown local model.'));
  let pending = urls.get(uid);
  if (!pending) {
    pending = run<{ bytes: Blob } | undefined>('readonly', store => store.get(uid) as IDBRequest<{ bytes: Blob } | undefined>).then(record => {
      if (!record?.bytes) throw new Error('This model was imported on another computer or browser. Import the .glb here to show it.');
      return URL.createObjectURL(record.bytes);
    });
    pending.catch(() => urls.delete(uid));
    urls.set(uid, pending);
  }
  return pending;
}
