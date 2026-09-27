import assert from 'node:assert/strict';
import test from 'node:test';
import type { ProjectDocument } from '../../contracts';
import { parseProject, serializeProject } from './model';
import { withLastLightSoundtrack } from './last-light-project';
import { parseAudioKey, validateAudioSource } from '../audio/model';

const silent: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'last-light', name: 'My edited film', actors: [], shot: null, placements: [{ id: 'last-light:car', offset: [1, 0, 0] }] };
test('older silent Last Light projects gain the soundtrack without losing edits', () => {
  const repaired = withLastLightSoundtrack(silent);
  assert.deepEqual(repaired.placements, silent.placements);
  assert.equal(repaired.name, silent.name);
  assert.equal(repaired.audio?.[0].duration, 15);
  assert.equal(repaired.audio?.[0].volume, 1);
  assert.deepEqual(parseProject(serializeProject(repaired), 'last-light'), repaired);
  assert.equal(withLastLightSoundtrack(repaired), repaired);
});
test('explicit audio removals, custom edits and other scenes are preserved', () => {
  for (const document of [{ ...silent, audio: [] }, { ...silent, sceneId: 'studio' }, withLastLightSoundtrack(silent)]) {
    assert.equal(withLastLightSoundtrack(document), document);
  }
});
test('built-in audio accepts only the registered ID and attribution', () => {
  const source = withLastLightSoundtrack(silent).audio![0].source;
  assert.deepEqual(parseAudioKey('builtin:last-light'), { provider: 'builtin', id: 'last-light' });
  assert.equal(parseAudioKey('builtin:../../secrets'), null);
  assert.throws(() => validateAudioSource({ ...source, id: 'unknown' }));
  assert.throws(() => validateAudioSource({ ...source, pageUrl: 'https://example.org/' }));
});
