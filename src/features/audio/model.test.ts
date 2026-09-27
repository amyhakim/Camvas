import assert from 'node:assert/strict';
import test from 'node:test';
import type { AudioSource, ProjectDocument } from '../../contracts';
import { parseProject, serializeProject } from '../project/model';
import { audioEnd, clipGain, createAudioClip, parseAudioKey, updateAudioClip, validateAudioSource } from './model';

const song: AudioSource = { provider: 'jamendo', id: '1886257', name: 'Epic Rise', artist: 'Someone', artistUrl: 'https://www.jamendo.com/artist/42', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', pageUrl: 'https://www.jamendo.com/track/1886257', duration: 180 };
const whoosh: AudioSource = { provider: 'freesound', id: '60013', name: 'Whoosh', artist: 'user', artistUrl: 'https://freesound.org/people/user/', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', pageUrl: 'https://freesound.org/s/60013/', duration: 1.4 };

test('music fills the remaining timeline with fades; effects play once', () => {
  const music = createAudioClip('audio:bed', song, 2, { timelineEnd: 15 });
  assert.equal(music.kind, 'music');
  assert.equal(music.duration, 13);
  assert.ok(music.fadeIn > 0 && music.fadeOut > 0 && music.volume < 1);
  const sfx = createAudioClip('audio:hit', whoosh, 6);
  assert.equal(sfx.kind, 'sfx');
  assert.equal(sfx.duration, 1.4);
  assert.equal(audioEnd([music, sfx]), 15);
});

test('clips stay inside their file and the timeline, and fades shape the gain', () => {
  assert.throws(() => createAudioClip('bad-id', song, 0));
  const clip = createAudioClip('audio:bed', song, 0, { duration: 10, fadeIn: 2, fadeOut: 2, volume: .8 });
  assert.equal(clipGain(clip, 1), .4);
  assert.equal(clipGain(clip, 5), .8);
  assert.equal(clipGain(clip, 11), 0);
  assert.throws(() => updateAudioClip(clip, { offset: 175, duration: 10 }), /longer than its file/);
  assert.equal(updateAudioClip(clip, { duration: 3 }).fadeOut, 1, 'fades shrink with the clip');
  assert.deepEqual(parseAudioKey('freesound:60013'), { provider: 'freesound', id: '60013' });
  assert.equal(parseAudioKey('youtube:1'), null);
});

test('attribution links are restricted to the provider and Creative Commons', () => {
  assert.throws(() => validateAudioSource({ ...song, pageUrl: 'https://evil.example/track' }));
  assert.throws(() => validateAudioSource({ ...whoosh, artistUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateAudioSource({ ...song, licenseUrl: 'https://example.com/license' }));
});

test('audio round-trips through project files and hostile entries are rejected', () => {
  const project: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 's', name: 'Audio', shot: null, actors: [], audio: [createAudioClip('audio:bed', song, 0, { timelineEnd: 12 }), createAudioClip('audio:hit', whoosh, 4)] };
  assert.deepEqual(parseProject(serializeProject(project), 's'), project);
  const hostile = JSON.parse(serializeProject(project));
  hostile.audio[1].kind = 'music';
  assert.throws(() => parseProject(JSON.stringify(hostile), 's'), /sound effects/);
  hostile.audio[1].kind = 'sfx';
  hostile.audio[1].source.pageUrl = 'https://evil.example/';
  assert.throws(() => parseProject(JSON.stringify(hostile), 's'));
});

test('timeline gestures clamp to the file and the timeline instead of failing', async () => {
  const { retimeClip, slipClip, clipBounds } = await import('./model');
  const clip = createAudioClip('audio:bed', song, 5, { duration: 20, offset: 10 });
  const moved = retimeClip(clip, { mode: 'move', start: -3 });
  assert.equal(moved.start, 0, 'cannot move before 0');
  const headTrim = retimeClip(clip, { mode: 'start', start: 8 });
  assert.deepEqual([headTrim.start, headTrim.offset, headTrim.duration], [8, 13, 17], 'trimming the head keeps the audio in place');
  const pastFileStart = retimeClip(clip, { mode: 'start', start: 0 });
  assert.deepEqual([pastFileStart.start, pastFileStart.offset, pastFileStart.duration], [0, 5, 25], 'the head stops at timeline 0');
  const tail = retimeClip(clip, { mode: 'end', end: 500 });
  assert.equal(tail.start + tail.duration, 120, 'tail stops at the 120 s limit');
  const tiny = retimeClip(clip, { mode: 'end', end: 0 });
  assert.equal(tiny.duration, .1, 'never shorter than 0.1 s');
  assert.equal(slipClip(clip, 999).offset, 160, 'slip stays inside the file');
  assert.deepEqual(clipBounds(clip, 24), { minStart: 1, maxEnd: 2881, minLength: 3, latestEnd: 2881 });
});
