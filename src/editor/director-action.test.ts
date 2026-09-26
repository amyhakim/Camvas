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
  ], context());
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

test('unverified model IDs are rejected and failures apply nothing', () => {
  assert.throws(() => planDirectorActions(project, { type: 'addProp', modelUid: 'b'.repeat(32), position: [0, 0, 0] }, context()), /verified/);
  assert.throws(() => planDirectorActions(project, [{ type: 'addActor', name: 'Bob' }, { type: 'setActorMark', targetId: 'actor:missing', time: 1 }], context()));
  assert.equal(project.actors.length, 0);
  assert.throws(() => planDirectorActions(project, Array.from({ length: 9 }, () => ({ type: 'play' })), context()), /at most 8/);
});
