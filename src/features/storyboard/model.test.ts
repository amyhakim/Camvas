import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraShotFixture, projectFixture } from '../../contracts/fixtures';
import { parseProject, serializeProject } from '../project/model';
import { parseCollection, serializeCollection } from '../project/collection';
import { moveShot, panelKey, saveShot, sequenceClips, sequenceFrame } from './model';
import type { StoryboardShot } from '../../contracts';

const shots = () => saveShot(saveShot([], cameraShotFixture, 'shot:first'), { ...cameraShotFixture, settings: { ...cameraShotFixture.settings, duration: 3 }, marks: cameraShotFixture.marks.map(mark => ({ ...mark, time: mark.time / 2 })) }, 'shot:second');

test('saving, duplicating and reordering cameras preserves independent data and the draft', () => {
  const source = structuredClone(cameraShotFixture), saved = saveShot([], source, 'shot:first');
  source.marks[0].position.x = 999;
  assert.notEqual(saved[0].camera.marks[0].position.x, 999);
  const pair = shots(), reversed = moveShot(pair, 'shot:first', 1);
  assert.deepEqual(reversed.map(shot => shot.id), ['shot:second', 'shot:first']);
  assert.equal(pair[0].id, 'shot:first');
  assert.equal(moveShot(pair, 'shot:first', -1), pair);
  assert.throws(() => saveShot(pair, source, 'shot:first'), /already exists/);
  assert.throws(() => saveShot(Array.from({ length: 24 }, (_, i) => ({ ...saved[0], id: `shot:${i}` })), source, 'shot:new'), /24/);
});

test('cuts use half-open intervals and scene starts offset blocking without changing camera time', () => {
  const saved = shots(); saved[1].sceneStart = 12;
  assert.deepEqual(sequenceClips(saved, 24).map(({ startFrame, endFrame }) => [startFrame, endFrame]), [[1, 145], [145, 217]]);
  assert.equal(sequenceFrame(saved, 144, 24)?.shot.id, 'shot:first');
  assert.equal(sequenceFrame(saved, 145, 24)?.shot.id, 'shot:second');
  assert.equal(sequenceFrame(saved, 145, 24)?.localTime, 0);
  assert.equal(sequenceFrame(saved, 145, 24)?.sceneTime, 12);
  assert.equal(sequenceFrame(saved, 169, 24)?.sceneTime, 13);
  assert.equal(sequenceFrame(saved, 10000, 24)?.localTime, 3);
  assert.equal(sequenceFrame(saved, -4, 24)?.localTime, 0);
  assert.equal(sequenceFrame([], 1, 24), null);
  assert.equal(sequenceFrame(moveShot(saved, 'shot:first', 1), 73, 24)?.shot.id, 'shot:first');
});

test('legacy projects and nested scene collections round trip with ordered cameras and notes', () => {
  const legacy = structuredClone(projectFixture);
  assert.deepEqual(parseProject(serializeProject(legacy), legacy.sceneId), legacy);
  const document = { ...legacy, shots: shots(), draftSceneStart: 4 };
  document.shots[0].notes = 'Alice turns.\n"Who is there?"'; document.shots[0].panelTime = 2; document.shots[0].sceneStart = 4;
  assert.deepEqual(parseProject(serializeProject(document), document.sceneId), document);
  const collection = { format: 'showcam-collection' as const, version: 1 as const, name: 'Film', scenes: [{ id: 'scene:one', name: 'Scene 1', document }, { id: 'scene:two', name: 'Scene 2', document: legacy }] };
  assert.deepEqual(parseCollection(serializeCollection(collection)), collection);
});

test('invalid nested cameras, duplicate IDs, panel times and excessive boards cannot enter storage', () => {
  const reject = (change: (saved: StoryboardShot[]) => void) => { const saved = shots(); change(saved); assert.throws(() => serializeProject({ ...projectFixture, shots: saved })); };
  reject(saved => { saved[1].id = saved[0].id; });
  reject(saved => { saved[0].id = 'Camera'; });
  reject(saved => { saved[0].camera.marks[0].time = 1; });
  reject(saved => { saved[0].panelTime = 61; });
  reject(saved => { saved[0].sceneStart = NaN; });
  reject(saved => { saved[0].notes = 'a'.repeat(2001); });
  reject(saved => { while (saved.length < 25) saved.push({ ...saved[0], id: `shot:${saved.length}` }); });
});

test('panel cache follows scene and camera changes but survives renames and reordered shots', () => {
  const shot = shots()[0], key = panelKey(shot, 'scene-v1');
  assert.equal(panelKey({ ...shot, name: 'New name', notes: 'New note' }, 'scene-v1'), key);
  assert.notEqual(panelKey({ ...shot, panelTime: 1 }, 'scene-v1'), key);
  assert.notEqual(panelKey({ ...shot, sceneStart: 1 }, 'scene-v1'), key);
  assert.notEqual(panelKey(shot, 'scene-v2'), key);
});
