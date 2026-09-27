import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureFuseProject, fuseDocument, FUSE_PROJECT_ID } from './fuse-project';
import { loadCollection } from './collection';
import { parseProject } from './model';

test('FUSE native project saves one instructor performance, camera and original soundtrack', () => {
  const document = parseProject(JSON.stringify(fuseDocument()), 'fuse-gym');
  assert.equal(document.actors.length, 1);
  assert.deepEqual(document.actors[0].motions, [{ start: 0, duration: 15, loop: false, source: { kind: 'clip', clip: 'Warm welcome' } }]);
  assert.equal(document.shot!.marks[0].time, 0);
  assert.equal(document.shot!.marks.at(-1)!.time, 15);
  assert.equal(document.audio![0].source.provider, 'builtin');
  assert.equal(document.audio![0].duration, 15);
});

test('FUSE starter never overwrites an existing project', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  ensureFuseProject(storage);
  assert.equal(loadCollection(storage, FUSE_PROJECT_ID).scenes[0].document.sceneId, 'fuse-gym');
  const key = [...values.keys()][0];
  values.set(key, 'user-owned saved bytes');
  ensureFuseProject(storage);
  assert.equal(values.get(key), 'user-owned saved bytes');
});
