import test from 'node:test';
import assert from 'node:assert/strict';
import instructorAsset from '../../../public/films/fuse-warmup/instructor.json';
import { builtinModelUrl } from './builtin-models';
import { localModelUrl } from './local-models';

test('current and earlier FUSE references load without browser-local model storage', async () => {
  // Node has no IndexedDB: this also catches accidentally depending on an import.
  for (const uid of [instructorAsset.uid, 'local-2d752d0c9fb75931e67afad7']) {
    assert.equal(await localModelUrl(uid), '/films/fuse-warmup/instructor.glb');
  }
});

test('bundled fallback never substitutes unrelated user models', async () => {
  assert.equal(builtinModelUrl('local-000000000000000000000000'), null);
  assert.equal(builtinModelUrl('FUSE instructor'), null);
  assert.equal(builtinModelUrl('/films/fuse-warmup/instructor.glb'), null);
  await assert.rejects(localModelUrl('invalid-model-id'), /Unknown local model/);
});
