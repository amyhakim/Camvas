import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureGreenhouseProject, GREENHOUSE_PROJECT_ID, greenhouseShot } from './greenhouse-project';
import { createCollection, loadCollection, saveCollection } from './collection';
import type { ProjectDocument } from '../../contracts';
import { compileShot } from '../camera/model';
const storage = () => { const entries = new Map<string, string>(); return { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } }; };
const old: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'hozy-greenhouse', name: 'My garden edit', shot: null, actors: [], placements: [{ id: 'greenhouse:capture', offset: [.2, 0, 0] }] };
test('repairs the incomplete greenhouse starter while retaining other scenes and edits', () => {
  const store = storage(), collection = createCollection(old, 'scene:greenhouse');
  collection.scenes.push({ id: 'other', name: 'Other', document: { ...old, sceneId: 'studio' } });
  saveCollection(store, GREENHOUSE_PROJECT_ID, collection); ensureGreenhouseProject(store);
  const repaired = loadCollection(store, GREENHOUSE_PROJECT_ID);
  assert.equal(repaired.name, old.name); assert.deepEqual(repaired.scenes[0].document.placements, old.placements);
  assert.deepEqual(repaired.scenes[1], collection.scenes[1]);
  assert.equal(repaired.scenes[0].document.shot?.settings.duration, 15);
  assert.equal(repaired.scenes[0].document.audio?.[0].source.id, 'greenhouse');
  // A deliberate removal after the migration must remain removed on the next visit.
  repaired.scenes[0].document.shot = null; repaired.scenes[0].document.audio = [];
  saveCollection(store, GREENHOUSE_PROJECT_ID, repaired); ensureGreenhouseProject(store);
  assert.deepEqual(loadCollection(store, GREENHOUSE_PROJECT_ID), repaired);
});
test('preserves a custom camera and explicit audio removal during migration', () => {
  const store = storage(), custom = { ...old, shot: { ...greenhouseShot(), name: 'My custom camera' }, audio: [] };
  saveCollection(store, GREENHOUSE_PROJECT_ID, createCollection(custom, 'scene:greenhouse'));
  ensureGreenhouseProject(store); assert.deepEqual(loadCollection(store, GREENHOUSE_PROJECT_ID).scenes[0].document, custom);
});
test('flight holds while watering and retains the original lens', () => {
  const at = compileShot(greenhouseShot());
  assert.deepEqual(at(0).position, [15.3, 8.4, 19.9]);
  assert.deepEqual(at(7).position, at(11).position);
  assert.ok(Math.abs(at(9).fov - 36) < 1e-10);
  assert.ok(at(15).position[2] > at(11).position[2]);
});
