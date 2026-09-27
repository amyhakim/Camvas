import type { CameraShot, ProjectDocument, Vector3Tuple } from '@/contracts';
import { builtinAudio, createAudioClip } from '../audio/model';
import { createCollection, loadCollection, saveCollection } from './collection';
import { namedProjectStorageKey, type ProjectStorage } from './model';

export const GREENHOUSE_PROJECT_ID = 'a-little-tending';
export const GREENHOUSE_EDITOR_URL = '/editor?scene=hozy-greenhouse&project=a-little-tending&entry=scene%3Agreenhouse';
const MIGRATION_KEY = 'showcam-greenhouse-production:v1';
const smooth = (value: number) => { const x = Math.max(0, Math.min(1, value)); return x * x * (3 - 2 * x); };

/** The conservative continuous flight from the finished film, in renderer Y-up metres. */
export function greenhouseShot(): CameraShot {
  const at = (time: number) => {
    const u = (.25 * smooth(time / 4) + .75 * smooth((time - 4) / 3)) * (1 - .83 * smooth((time - 11) / 4));
    const blend = (a: Vector3Tuple, b: Vector3Tuple) => a.map((v, i) => v + (b[i] - v) * u) as Vector3Tuple;
    return { position: blend([15.3, 8.4, 19.9], [11.5, 6.7, 15.9]), target: blend([.3, 3.2, .7], [2, 2.9, 4.7]) };
  };
  const focalLength = (36 / (16 / 9)) / (2 * Math.tan(36 * Math.PI / 360));
  const samples = Array.from({ length: 241 }, (_, i) => ({ time: i / 16, ...at(i / 16) }));
  return {
    name: 'Garden flight · establish, water, widen', subjectId: 'greenhouse:sprite', subjectName: 'Garden sprite',
    target: at(0).target, settings: { presetId: 'manual', duration: 15, focalLength, sensor: 'fullFrame', framing: 'wide' }, trackSubject: true,
    marks: [0, 4, 7, 11, 15].map(time => {
      const { position: [x, y, z], target: [tx, ty, tz] } = at(time);
      return { time, position: { x, y, z }, pan: Math.atan2(x - tx, z - tz), tilt: Math.atan2(ty - y, Math.hypot(tx - x, tz - z)), roll: 0, focalLength, easeIn: .5, easeOut: .5, hold: time === 7 ? 4 : 0 };
    }),
    cinemaTraj: { positions: samples.map(({ time, position }) => ({ time, position })), targets: samples.map(({ time, target }) => ({ time, position: target })) },
  };
}

/** Upgrade the incomplete starter once. Preserve user shots, audio, placements and all other scenes. */
export function ensureGreenhouseProject(storage: ProjectStorage) {
  const exists = storage.getItem(namedProjectStorageKey(GREENHOUSE_PROJECT_ID));
  if (exists && storage.getItem(MIGRATION_KEY)) return;
  const initial: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'hozy-greenhouse', name: 'A Little Tending', shot: null, actors: [] };
  const collection = exists ? loadCollection(storage, GREENHOUSE_PROJECT_ID) : createCollection(initial, 'scene:greenhouse');
  if (!exists) collection.scenes[0].name = 'Hozy Greenhouse';
  collection.scenes = collection.scenes.map(scene => scene.document.sceneId !== 'hozy-greenhouse' ? scene : {
    ...scene, document: { ...scene.document, shot: scene.document.shot ?? greenhouseShot(),
      audio: scene.document.audio ?? [createAudioClip('audio:greenhouse-mix', builtinAudio('greenhouse')!.source, 0, { duration: 15, volume: 1, fadeIn: 0, fadeOut: 0 })] },
  });
  saveCollection(storage, GREENHOUSE_PROJECT_ID, collection);
  storage.setItem(MIGRATION_KEY, '1');
}
