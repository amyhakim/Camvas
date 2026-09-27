import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectFixture } from '@/contracts/fixtures';
import { createCollection, loadCollection, parseCollection, saveCollection, serializeCollection } from './collection';
import { namedProjectStorageKey, serializeProject } from './model';

test('project scenes keep independent blocking, shots and landmarks through save and load', () => {
  const first = structuredClone(projectFixture);
  first.landmarks = [{ id: 'stairs', label: 'Top of stairs', entityId: null, kind: 'floor', frame: 1, position: [1, 2, 3] }];
  const second = { ...structuredClone(first), sceneId: 'residence-9d09ab82', shot: null, actors: [], landmarks: [] };
  const collection = createCollection(first, 'scene:first');
  collection.scenes.push({ id: 'scene:second', name: 'Scene 2', document: second });
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  saveCollection(storage, 'project-1', collection);
  assert.deepEqual(loadCollection(storage, 'project-1'), collection);
  assert.equal(loadCollection(storage, 'project-1').scenes[1].document.actors.length, 0);
  assert.equal(loadCollection(storage, 'project-1').scenes[0].document.landmarks?.[0].label, 'Top of stairs');
});

test('older named projects open as a single scene, and malformed collections cannot save', () => {
  const data = new Map([[namedProjectStorageKey('old'), serializeProject(projectFixture)]]);
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const restored = loadCollection(storage, 'old');
  assert.equal(restored.scenes.length, 1);
  assert.deepEqual(restored.scenes[0].document, projectFixture);
  assert.equal(JSON.parse(data.get(namedProjectStorageKey('old'))!).format, 'showcam-project');
  assert.throws(() => parseCollection(JSON.stringify({ ...restored, scenes: [restored.scenes[0], restored.scenes[0]] })), /unique/);
  assert.throws(() => serializeCollection({ ...restored, scenes: [] }), /1–32/);
});
