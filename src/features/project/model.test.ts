import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actorFixture, projectFixture } from './fixtures';
import { MAX_PROJECT_BYTES, loadProject, parseProject, projectStorageKey, saveProject, serializeProject, type ProjectStorage } from './model';
import type { ProjectDocument } from '../../contracts';
const copy = (): ProjectDocument => structuredClone(projectFixture);
function rejected(edit: (doc: ProjectDocument) => void, message: RegExp) { const doc = copy(); edit(doc); assert.throws(() => parseProject(JSON.stringify(doc), doc.sceneId), message); }

test('full and empty projects round trip independently with trimmed name', () => {
  const doc = copy(); doc.name = '  Study  ';
  const result = parseProject(serializeProject(doc), doc.sceneId);
  assert.deepEqual(result, { ...doc, name: 'Study' }); assert.notEqual(result.actors, doc.actors);
  doc.shot = null; doc.actors = []; assert.deepEqual(parseProject(serializeProject(doc), doc.sceneId), { ...doc, name: 'Study' });
});
test('malformed, unsupported and wrong-scene documents fail clearly', () => {
  assert.throws(() => parseProject('{', 'scene'), /valid JSON/);
  for (const value of [null, [], 1, 'project']) assert.throws(() => parseProject(JSON.stringify(value), 'scene'), /object/);
  assert.throws(() => parseProject(JSON.stringify({ ...copy(), version: 2 }), projectFixture.sceneId), /version 1/);
  assert.throws(() => parseProject(JSON.stringify({ ...copy(), format: 'other' }), projectFixture.sceneId), /format/);
  assert.throws(() => parseProject(serializeProject(copy()), 'other'), /another scene/);
  rejected(d => { d.name = ' '; }, /Project name/);
  rejected(d => { d.name = 'a'.repeat(101); }, /100/);
});
test('size limit measures UTF-8 bytes both importing and exporting', () => {
  assert.throws(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1), 'scene'), /1 MB/);
  assert.throws(() => parseProject('é'.repeat(MAX_PROJECT_BYTES / 2 + 1), 'scene'), /1 MB/);
});
test('extensions and prototype keys are discarded recursively', () => {
  const text = JSON.stringify(copy()).replace('"version":1', '"version":1,"__proto__":{"polluted":true},"extra":1').replace('"height":1.75', '"height":1.75,"constructor":{"prototype":{"polluted":true}}');
  const result = parseProject(text, projectFixture.sceneId);
  assert.deepEqual(result, copy()); assert.equal(Object.hasOwn(result, '__proto__'), false); assert.equal(Object.hasOwn(result.actors[0], 'constructor'), false);
});
test('actors enforce IDs, names, color, count, height and position', () => {
  rejected(d => { d.actors = Array.from({ length: 9 }, (_, i) => ({ ...actorFixture, id: `actor:${i}` })); }, /0–8/);
  rejected(d => { d.actors.push(structuredClone(actorFixture)); }, /unique/);
  for (const id of ['', 'chair', 'actor:', 'actor: ']) rejected(d => { d.actors[0].id = id; }, /id/);
  for (const color of ['red', '#abc', '#gggggg']) rejected(d => { d.actors[0].color = color; }, /color/);
  for (const height of [.49, 3.01, Infinity]) rejected(d => { d.actors[0].height = height; }, /height/);
  rejected(d => { d.actors[0].name = ''; }, /name/);
  rejected(d => { d.actors[0].marks[0].position[0] = 1001; }, /position/);
  rejected(d => { d.actors[0].marks[0].heading = Infinity; }, /heading/);
});
test('actor times and mark counts reject unordered or duplicate tracks', () => {
  for (const time of [-1, 61, 0]) rejected(d => { d.actors[0].marks[1].time = time; }, /time/);
  rejected(d => { d.actors[0].marks.reverse(); }, /time/);
  rejected(d => { d.actors[0].marks = []; }, /1–64/);
  rejected(d => { d.actors[0].marks = Array.from({ length: 65 }, (_, time) => ({ ...actorFixture.marks[0], time })); }, /1–64/);
});
test('camera settings, endpoints and every numeric mark field are validated', () => {
  for (const duration of [0, 61, Infinity]) rejected(d => { d.shot!.settings.duration = duration; }, /duration/);
  rejected(d => { d.shot!.settings.sensor = 'invalid' as never; }, /sensor/);
  rejected(d => { d.shot!.settings.framing = 'invalid' as never; }, /framing/);
  rejected(d => { d.shot!.settings.focalLength = 301; }, /focalLength/);
  rejected(d => { d.shot!.marks = []; }, /2–4096/);
  rejected(d => { d.shot!.marks[0].time = 1; }, /start at 0/);
  rejected(d => { d.shot!.marks[1].time = 5; }, /end at/);
  rejected(d => { d.shot!.marks[1].time = 0; }, /increase/);
  for (const field of ['pan', 'tilt', 'roll', 'focalLength', 'easeIn', 'easeOut', 'hold'] as const) rejected(d => { d.shot!.marks[0][field] = Infinity; }, new RegExp(field));
  rejected(d => { d.shot!.marks[0].position.x = -1001; }, /position.x/);
  rejected(d => { d.shot!.target[0] = Infinity; }, /target/);
  rejected(d => { d.shot!.marks[0].easeIn = 1.1; }, /easeIn/);
  rejected(d => { d.shot!.marks[1].hold = .1; }, /hold/);
  rejected(d => { d.shot!.trackSubject = 'yes' as never; }, /true or false/);
});
test('serialize validates non-JSON runtime values before they can become null', () => {
  const d = copy(); d.actors[0].marks[0].heading = NaN; assert.throws(() => serializeProject(d), /heading/);
});
test('storage is scene-scoped and read never writes damaged data', () => {
  const data = new Map<string, string>(); let writes = 0;
  const storage: ProjectStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { writes++; data.set(key, value); } };
  assert.equal(loadProject(storage, projectFixture.sceneId), null);
  saveProject(storage, copy()); assert.deepEqual(loadProject(storage, projectFixture.sceneId), copy());
  assert.equal(loadProject(storage, 'another'), null); assert.equal(writes, 1);
  data.set(projectStorageKey(projectFixture.sceneId), '{'); assert.throws(() => loadProject(storage, projectFixture.sceneId), /valid JSON/);
  assert.equal(data.get(projectStorageKey(projectFixture.sceneId)), '{'); assert.equal(writes, 1);
  saveProject(storage, copy()); assert.equal(writes, 2);
});
test('storage failures are actionable and validation occurs before writing', () => {
  const storage: ProjectStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
  assert.throws(() => loadProject(storage, 'scene'), /could not be read/);
  assert.throws(() => saveProject(storage, copy()), /export a JSON copy/);
  const d = copy(); d.name = ''; assert.throws(() => saveProject(storage, d), /Project name/);
});

test('scene placements preserve old files and validate bounded unique offsets', () => {
  const old = copy(); assert.equal(parseProject(serializeProject(old), old.sceneId).placements, undefined);
  const doc = { ...copy(), placements: [{ id: 'chair', offset: [1, 2, -3] as [number, number, number] }] };
  assert.deepEqual(parseProject(serializeProject(doc), doc.sceneId), doc);
  rejected(d => { d.placements = [{ id: 'actor:bad', offset: [0, 0, 0] }]; }, /actor motion/);
  rejected(d => { d.placements = [{ id: 'chair', offset: [Infinity, 0, 0] }]; }, /offset/);
  rejected(d => { d.placements = [{ id: 'chair', offset: [1001, 0, 0] }]; }, /offset/);
  rejected(d => { d.placements = [{ id: 'chair', offset: [0, 0, 0] }, { id: 'chair', offset: [0, 0, 0] }]; }, /unique/);
});

test('removed source cameras round trip and malformed deletion lists are rejected', () => {
  const doc = { ...copy(), removedCameraIds: ['Camera.002', 'Camera'] };
  assert.deepEqual(parseProject(serializeProject(doc), doc.sceneId), doc);
  rejected(doc => { doc.removedCameraIds = ['Camera', 'Camera']; }, /unique/);
  rejected(doc => { doc.removedCameraIds = ['']; }, /nonempty/);
  assert.throws(() => parseProject(JSON.stringify({ ...copy(), removedCameraIds: 'Camera' }), projectFixture.sceneId), /items/);
});
