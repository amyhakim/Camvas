import instructorAsset from '../../../public/films/fuse-warmup/instructor.json';
import type { ModelSource, ProjectDocument } from '../../contracts';
import { builtinAudio, createAudioClip } from '../audio/model';
import { manualShot, markFromView } from '../camera/marks';
import { createCollection, saveCollection } from './collection';
import { namedProjectStorageKey, type ProjectStorage } from './model';

export const FUSE_PROJECT_ID = 'fuse-warmup';
export const FUSE_EDITOR_URL = '/editor?scene=fuse-gym&project=fuse-warmup&entry=scene%3Afuse';
const UID = instructorAsset.uid;
const model: ModelSource = { provider: 'local', uid: UID, name: 'FUSE instructor', author: 'You', authorUrl: '', license: 'Imported file', licenseUrl: '', viewerUrl: '' };

export function fuseDocument(): ProjectDocument {
  const view = { position: [.35, .13, 3.7] as [number, number, number], target: [-.6, -.35, -.8] as [number, number, number], fov: 47 };
  const shot = manualShot(view, { id: 'actor:fuse-instructor', name: 'Instructor' }, 15);
  shot.name = 'Warm Welcome · central aisle push';
  shot.marks = Array.from({ length: 31 }, (_, i) => {
    const t = i / 2, u = t / 15, ease = u * u * (3 - 2 * u);
    return { ...markFromView({ position: [.35, .13, 3.7 - .65 * ease], target: [-.6 - .19 * ease, -.35, -.8], fov: 47 }, t, 'fullFrame'), easeIn: 0, easeOut: 0 };
  });
  return { format: 'showcam-project', version: 1, sceneId: 'fuse-gym', name: 'FUSE · Warm Welcome', shot,
    actors: [{ id: 'actor:fuse-instructor', name: 'Instructor', color: '#168e90', height: instructorAsset.height,
      model, marks: [{ time: 0, position: [instructorAsset.center[0], -1.2 + instructorAsset.min[1], -.8 + instructorAsset.center[2]], heading: Math.PI }],
      motions: [{ start: 0, duration: 15, loop: false, source: { kind: 'clip', clip: 'Warm welcome' } }] }],
    audio: [createAudioClip('audio:fuse-score', builtinAudio('fuse-warmup')!.source, 0, { duration: 15, volume: 1, fadeIn: 0, fadeOut: 0 })],
  };
}

/** Seed once; every subsequent open preserves the user's saved camera, actors and audio. */
export function ensureFuseProject(storage: ProjectStorage) {
  if (storage.getItem(namedProjectStorageKey(FUSE_PROJECT_ID))) return;
  const collection = createCollection(fuseDocument(), 'scene:fuse');
  collection.scenes[0].name = 'FUSE gym warm-up';
  saveCollection(storage, FUSE_PROJECT_ID, collection);
}

/** The instructor resolves from shipped assets independently of project hydration. */
export async function prepareFuseProject(storage: ProjectStorage): Promise<void> {
  ensureFuseProject(storage);
}
