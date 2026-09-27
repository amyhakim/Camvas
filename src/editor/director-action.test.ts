import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelSource, ProjectDocument, SceneEntity } from '../contracts';
import { planDirectorActions, type DirectorContext } from './director-action';

const objects = [
  { id: 'chair', name: 'Chair', type: 'Mesh' },
  { id: 'camera', name: 'Camera', type: 'Camera' },
] as SceneEntity[];
const shoe: ModelSource = { provider: 'sketchfab', uid: 'a'.repeat(32), name: 'Brown Sneakers', author: 'Someone', authorUrl: 'https://sketchfab.com/someone', license: 'CC Attribution', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', viewerUrl: `https://sketchfab.com/3d-models/${'a'.repeat(32)}` };
const project: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'test', name: 'Test', shot: null, actors: [] };
let counter = 0;
const context = (extra: Partial<DirectorContext> = {}): DirectorContext => ({ objects, presetIds: ['orbit-90-left'], frameEnd: 1441, fps: 24, models: { [shoe.uid]: shoe }, actorOrigin: [0, 0, 0], selectedId: null, newId: prefix => `${prefix}:gen${++counter}`, ...extra });

test('accepts a bounded world-space object move', () => {
  const plan = planDirectorActions(project, { type: 'moveObject', targetId: 'chair', delta: [1, 0, -2] }, context());
  assert.deepEqual(plan.document.placements, [{ id: 'chair', offset: [1, 0, -2] }]);
  assert.throws(() => planDirectorActions(project, { type: 'moveObject', targetId: 'chair', delta: [Infinity, 0, 0] }, context()));
  assert.throws(() => planDirectorActions(project, { type: 'moveObject', targetId: 'camera', delta: [1, 0, 0] }, context()));
});

test('only known subjects and presets can generate a draft camera, including actors', () => {
  const action = { type: 'generateShot', targetId: 'chair', presetId: 'orbit-90-left', duration: 6, focalLength: 35, framing: 'wide' };
  assert.equal(planDirectorActions(project, action, context()).effects[0].type, 'shot');
  assert.throws(() => planDirectorActions(project, { ...action, presetId: 'unknown' }, context()));
  assert.throws(() => planDirectorActions(project, { ...action, targetId: 'camera' }, context()));
  const plan = planDirectorActions(project, [{ type: 'addActor', targetId: 'actor:alice', name: 'Alice' }, { ...action, targetId: 'actor:alice' }], context());
  assert.deepEqual(plan.effects.at(-1), { type: 'shot', targetId: 'actor:alice', settings: { presetId: 'orbit-90-left', duration: 6, focalLength: 35, framing: 'wide', sensor: 'fullFrame' } });
});

test('a batch can create an actor and block it by its requested ID', () => {
  const plan = planDirectorActions(project, [
    { type: 'addActor', targetId: 'actor:alice', name: 'Alice', position: [1, 0, 2], color: '#C0392B', height: 1.7, modelUid: shoe.uid },
    { type: 'setActorMark', targetId: 'actor:alice', time: 3, position: [4, 0, 2], headingDeg: 90 },
  ], context({ riggedModels: [shoe.uid] }));
  const alice = plan.document.actors[0];
  assert.equal(alice.id, 'actor:alice');
  assert.equal(alice.color, '#c0392b');
  assert.equal(alice.model?.uid, shoe.uid);
  assert.deepEqual(alice.marks.map(mark => mark.time), [0, 3]);
  assert.ok(Math.abs(alice.marks[1].heading - Math.PI / 2) < 1e-9);
});

test('props are added from verified models or primitives and edited in place', () => {
  const added = planDirectorActions(project, [
    { type: 'addProp', targetId: 'prop:shoes', modelUid: shoe.uid, position: [1, 0, 1], size: .3, rotationDeg: [0, 90, 0] },
    { type: 'addProp', shape: 'box', name: 'Crate', position: [0, 0, 0] },
  ], context()).document;
  assert.equal(added.props?.length, 2);
  assert.equal(added.props?.[0].source.kind, 'model');
  const edited = planDirectorActions(added, [{ type: 'updateProp', targetId: 'prop:shoes', color: '#ff0000', delta: [0, 0, 1] }, { type: 'moveObject', targetId: 'prop:shoes', delta: [1, 0, 0] }], context()).document;
  assert.deepEqual(edited.props?.[0].position, [2, 0, 2]);
  assert.equal(edited.props?.[0].color, '#ff0000');
  const cleared = planDirectorActions(edited, { type: 'updateProp', targetId: 'prop:shoes', color: 'none' }, context()).document;
  assert.equal(cleared.props?.[0].color, undefined);
});

test('Director attaches a prop to an actor and can release it at the current time', () => {
  const first = planDirectorActions(project, [
    { type: 'addActor', targetId: 'actor:alice', name: 'Alice', position: [0, 0, 0] },
    { type: 'setActorMark', targetId: 'actor:alice', time: 2, position: [2, 0, 0] },
    { type: 'addProp', targetId: 'prop:case', shape: 'box', name: 'Case', position: [0, 1, 0] },
    { type: 'attachProp', targetId: 'prop:case', parentId: 'actor:alice' },
  ], context());
  assert.equal(first.document.props?.[0].attachment?.actorId, 'actor:alice');
  assert.match(first.summaries.at(-1) ?? '', /follows Alice/);
  const now = context({ seconds: 2 });
  const released = planDirectorActions(first.document, { type: 'detachProp', targetId: 'prop:case' }, now).document;
  assert.equal(released.props?.[0].attachment, undefined);
  assert.deepEqual(released.props?.[0].position, [2, 1, 0]);
  assert.throws(() => planDirectorActions(first.document, { type: 'moveObject', targetId: 'prop:case', delta: [1, 0, 0] }, now), /Detach/);
  const removed = planDirectorActions(first.document, { type: 'removeActor', targetId: 'actor:alice' }, now).document;
  assert.equal(removed.props?.[0].attachment, undefined);
  assert.deepEqual(removed.props?.[0].position, [2, 1, 0]);
});

test('unverified model IDs are rejected and failures apply nothing', () => {
  assert.throws(() => planDirectorActions(project, { type: 'addProp', modelUid: 'b'.repeat(32), position: [0, 0, 0] }, context()), /verified/);
  assert.throws(() => planDirectorActions(project, [{ type: 'addActor', name: 'Bob' }, { type: 'setActorMark', targetId: 'actor:missing', time: 1 }], context()));
  assert.equal(project.actors.length, 0);
  assert.throws(() => planDirectorActions(project, Array.from({ length: 9 }, () => ({ type: 'play' })), context()), /at most 8/);
});

test('Director audio: verified sources only, music fills the timeline, edits and removal', () => {
  const song = { provider: 'jamendo' as const, id: '1886257', name: 'Epic Rise', artist: 'Someone', artistUrl: 'https://www.jamendo.com/artist/42', license: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', pageUrl: 'https://www.jamendo.com/track/1886257', duration: 180 };
  const hit = { provider: 'freesound' as const, id: '60013', name: 'Impact', artist: 'user', artistUrl: 'https://freesound.org/people/user/', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', pageUrl: 'https://freesound.org/s/60013/', duration: 1.2 };
  const audio = { 'jamendo:1886257': song, 'freesound:60013': hit };
  assert.throws(() => planDirectorActions(project, { type: 'addAudio', audioId: 'jamendo:999', time: 0 }, context({ audio })), /not verified/);
  assert.throws(() => planDirectorActions(project, { type: 'addAudio', audioId: '__proto__', time: 0 }, context({ audio })), /not verified/);
  const scored = planDirectorActions(project, [
    { type: 'addAudio', audioId: 'jamendo:1886257', time: 0, volume: .55, audioOffset: 45 },
    { type: 'addAudio', audioId: 'freesound:60013', time: 6.5 },
  ], context({ audio, timelineEnd: 12 })).document;
  const [bed, impact] = scored.audio!;
  assert.equal(bed.kind, 'music'); assert.equal(bed.duration, 12); assert.equal(bed.volume, .55); assert.equal(bed.offset, 45);
  assert.equal(impact.kind, 'sfx'); assert.equal(impact.start, 6.5); assert.equal(impact.duration, 1.2);
  const quieter = planDirectorActions(scored, { type: 'updateAudio', targetId: bed.id, volume: .3, fadeOut: 3 }, context()).document;
  assert.equal(quieter.audio![0].volume, .3);
  assert.equal(planDirectorActions(quieter, { type: 'removeAudio', targetId: impact.id }, context()).document.audio!.length, 1);
  assert.throws(() => planDirectorActions(quieter, { type: 'updateAudio', targetId: bed.id, volume: 3 }, context()), /volume must be 0–1/);
});

test('characters must be rigged models; unrigged ones are refused with a reason', () => {
  assert.throws(() => planDirectorActions(project, { type: 'addActor', name: 'Knight', modelUid: shoe.uid }, context()), /not a rigged model/);
  const alice = planDirectorActions(project, { type: 'addActor', targetId: 'actor:alice', name: 'Alice' }, context()).document;
  const rigs = { 'actor:alice': { status: 'static' as const, body: 'model' as const, clips: [], message: '“Knight” isn’t rigged, so it can’t be animated.' } };
  assert.throws(() => planDirectorActions(alice, { type: 'setActorMotion', targetId: 'actor:alice', motion: 'wave', time: 1 }, context({ rigs })), /isn’t rigged/);
  assert.throws(() => planDirectorActions(alice, { type: 'poseActor', targetId: 'actor:alice', time: 0, poseKeys: '[{"time":0,"pose":{"head":{"nod":10}}}]' }, context({ rigs })), /isn’t rigged/);
});

test('motions, model clips and custom poses are placed on the actor timeline', () => {
  const alice = planDirectorActions(project, { type: 'addActor', targetId: 'actor:alice', name: 'Alice' }, context()).document;
  const rigs = { 'actor:alice': { status: 'animatable' as const, body: 'model' as const, clips: [{ name: 'Samba', duration: 3 }] } };
  const plan = planDirectorActions(alice, [
    { type: 'setActorMotion', targetId: 'actor:alice', motion: 'sit', time: 2, duration: 4 },
    { type: 'setActorMotion', targetId: 'actor:alice', motion: 'wave', time: 3 },
    { type: 'setActorMotion', targetId: 'actor:alice', clip: 'Samba', time: 8 },
    { type: 'poseActor', targetId: 'actor:alice', name: 'Shade eyes', layer: 'upper', time: 12, duration: 2, poseKeys: JSON.stringify([{ time: 0, pose: { rightArm: { forward: 120, raise: 20 }, rightElbow: { bend: 130 } } }, { time: 1, pose: { rightArm: { forward: 125 }, head: { turn: 30 } } }]) },
  ], context({ rigs }));
  const motions = plan.document.actors[0].motions!;
  assert.deepEqual(motions.map(m => m.source.kind === 'preset' ? m.source.preset : m.source.kind === 'clip' ? m.source.clip : m.source.name), ['sit', 'wave', 'Samba', 'Shade eyes']);
  assert.equal(motions[2].duration, 3, 'clip defaults to its own length');
  assert.throws(() => planDirectorActions(alice, { type: 'setActorMotion', targetId: 'actor:alice', clip: 'Tango', time: 0 }, context({ rigs })), /Available: Samba/);
  assert.throws(() => planDirectorActions(alice, { type: 'poseActor', targetId: 'actor:alice', time: 0, poseKeys: '[{"time":0,"pose":{"tail":{"wag":1}}}]' }, context({ rigs })), /Unknown pose joint/);
  assert.throws(() => planDirectorActions(alice, { type: 'setActorMotion', targetId: 'actor:alice', motion: 'moonwalk', time: 0 }, context({ rigs })), /Unknown motion/);
  const cleared = planDirectorActions(plan.document, { type: 'clearActorMotion', targetId: 'actor:alice', time: null }, context({ rigs })).document;
  assert.equal(cleared.actors[0].motions, undefined);
});
