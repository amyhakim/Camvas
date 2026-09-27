import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActorMotion, ActorTrack } from '../../contracts';
import { jointPositions, sanitizePose } from '../../lib/humanoid';
import { evaluateActorBody, MOTION_PRESETS, placeMotion, removeMotionAt, validateMotion } from './motions';

const still: ActorTrack = { id: 'actor:a', name: 'A', color: '#aaaaaa', height: 1.75, marks: [{ time: 0, position: [0, 0, 0], heading: 0 }] };
const withMotion = (preset: string, loop = false): ActorTrack => ({ ...still, motions: [{ start: 0, duration: 20, loop, source: { kind: 'preset', preset } }] });
const at = (actor: ActorTrack, t: number) => jointPositions(evaluateActorBody(actor, t).pose);

test('the neutral pose stands upright with arms at the sides and feet on the floor', () => {
  const p = jointPositions({});
  assert.ok(p.leftHandTip[1] < p.hips[1] && p.leftHandTip[0] > 0 && p.rightHandTip[0] < 0, 'left hand on +X, right on -X, both below the hips');
  assert.ok(Math.abs(p.leftFootTip[1]) < .02 && p.leftFootTip[2] > 0, 'toes on the floor pointing forward (+Z)');
  assert.ok(p.headTip[1] > .95 && p.headTip[1] < 1.02);
});

test('arm and leg controls mirror between sides', () => {
  const p = jointPositions({ leftArm: { raise: 90 }, rightArm: { raise: 90 }, leftLeg: { forward: 45 }, rightLeg: { forward: 45 } });
  assert.ok(Math.abs(p.leftHandTip[0] + p.rightHandTip[0]) < 1e-9 && Math.abs(p.leftHandTip[1] - p.rightHandTip[1]) < 1e-9);
  assert.ok(Math.abs(p.leftLowerLeg[2] - p.rightLowerLeg[2]) < 1e-9 && p.leftLowerLeg[2] > 0, 'hip flexion swings both knees forward');
});

test('key presets land in anatomically sensible places', () => {
  const wave = at(withMotion('wave'), 1);
  assert.ok(wave.rightHandTip[1] > wave.headTip[1] - .08 && wave.rightHandTip[0] < -.2, 'wave: right hand up by the head on the right');
  const point = at(withMotion('point'), 1);
  assert.ok(point.rightHandTip[2] > .3 && Math.abs(point.rightHandTip[1] - point.rightUpperArm[1]) < .12, 'point: arm straight forward at shoulder height');
  const sit = at(withMotion('sit'), 1.5);
  assert.ok(sit.hips[1] < .35 && sit.leftLowerLeg[2] > .15 && Math.abs(sit.leftFoot[1] - .04) < .05, 'sit: hips at seat height, knees forward, feet on the floor');
  const up = at(withMotion('hands-up'), 1);
  assert.ok(up.leftHandTip[1] > up.leftLowerArm[1] + .1 && up.rightHandTip[1] > up.rightLowerArm[1] + .1, 'hands-up: forearms point up');
  const lie = at(withMotion('lie-down'), 2);
  assert.ok(lie.headTip[1] < .15 && lie.leftFootTip[1] < .2, 'lie-down: flat on the floor');
});

test('actors walk automatically between marks, with the step phase tied to distance', () => {
  const walker: ActorTrack = { ...still, marks: [{ time: 0, position: [0, 0, 0], heading: 0 }, { time: 4, position: [0, 0, -5.6], heading: 0 }] };
  const swings = [1, 1.25, 1.5, 1.75, 2].map(t => evaluateActorBody(walker, t).pose.leftLeg?.forward ?? 0);
  assert.ok(Math.max(...swings) - Math.min(...swings) > 20, `legs swing while travelling (${swings.map(v => v.toFixed(1))})`);
  assert.ok(Math.abs(evaluateActorBody(walker, 5).pose.leftLeg?.forward ?? 0) < 1e-9, 'standing still after the last mark');
  const sprinter: ActorTrack = { ...walker, marks: [walker.marks[0], { time: 1, position: [0, 0, -5], heading: 0 }] };
  assert.ok((evaluateActorBody(sprinter, .5).pose.rightElbow?.bend ?? 0) > 60, 'fast moves switch to a run');
  // Same time → same pose, in any order.
  assert.deepEqual(evaluateActorBody(walker, 1.3), evaluateActorBody(walker, 1.3));
});

test('upper-body motions layer over walking; clips pass through to the viewport', () => {
  const walker: ActorTrack = { ...still, marks: [{ time: 0, position: [0, 0, 0], heading: 0 }, { time: 4, position: [0, 0, -5.6], heading: 0 }], motions: [{ start: 0, duration: 4, loop: true, source: { kind: 'preset', preset: 'wave' } }] };
  const pose = evaluateActorBody(walker, 2).pose;
  assert.ok((pose.rightArm?.raise ?? 0) > 90 && Math.abs(pose.leftLeg?.forward ?? 0) + Math.abs(evaluateActorBody(walker, 2.3).pose.leftLeg?.forward ?? 0) > 5, 'waving while the legs keep walking');
  const clip = evaluateActorBody({ ...still, motions: [{ start: 1, duration: 3, loop: true, source: { kind: 'clip', clip: 'Dance' } }] }, 2.5);
  assert.deepEqual(clip.clip, { name: 'Dance', time: 1.5, loop: true });
});

test('motions validate, replace overlaps on the same layer, and custom poses are clamped', () => {
  for (const preset of MOTION_PRESETS) validateMotion({ start: 0, duration: 2, loop: preset.loop, source: { kind: 'preset', preset: preset.id } });
  assert.throws(() => validateMotion({ start: 0, duration: 2, loop: false, source: { kind: 'preset', preset: 'moonwalk' } }));
  assert.throws(() => validateMotion({ start: 0, duration: 2, loop: false, source: { kind: 'custom', name: 'x', layer: 'full', keys: [{ time: 0, pose: { leftArm: { flap: 3 } } }] } }), /no "flap"/);
  assert.deepEqual(sanitizePose({ leftElbow: { bend: 400 }, nose: { wiggle: 1 } }), { leftElbow: { bend: 150 } });
  let actor = placeMotion(still, { start: 1, duration: 2, loop: false, source: { kind: 'preset', preset: 'sit' } });
  actor = placeMotion(actor, { start: 1.5, duration: 2, loop: true, source: { kind: 'preset', preset: 'wave' } });
  actor = placeMotion(actor, { start: 2, duration: 2, loop: false, source: { kind: 'preset', preset: 'bow' } });
  assert.deepEqual(actor.motions?.map((m: ActorMotion) => m.source.kind === 'preset' && m.source.preset), ['wave', 'bow'], 'bow replaced the overlapping sit; wave is on the upper layer');
  assert.equal(removeMotionAt(actor, null).motions, undefined);
});

test('motions survive a project save and load; hostile pose data is rejected', async () => {
  const { parseProject, serializeProject } = await import('../project/model');
  const actor: ActorTrack = { ...still, motions: [
    { start: 0, duration: 4, loop: true, source: { kind: 'preset', preset: 'wave' } },
    { start: 4, duration: 3, loop: true, source: { kind: 'clip', clip: 'Samba Dancing' } },
    { start: 8, duration: 2, loop: false, source: { kind: 'custom', name: 'Shade eyes', layer: 'upper', keys: [{ time: 0, pose: { rightArm: { forward: 120 } } }, { time: 1, pose: { head: { turn: 30 } } }] } },
  ] };
  const project = { format: 'showcam-project' as const, version: 1 as const, sceneId: 's', name: 'Motion', shot: null, actors: [actor] };
  assert.deepEqual(parseProject(serializeProject(project), 's'), project);
  const hostile = JSON.parse(serializeProject(project));
  hostile.actors[0].motions[2].source.keys[0].pose = { rightArm: { forward: 'lots' } };
  assert.throws(() => parseProject(JSON.stringify(hostile), 's'), /must be a number/);
  hostile.actors[0].motions[2].source.keys[0].pose = { rightArm: { forward: 120, __proto__: { polluted: 1 } } };
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('prototype-member names are rejected as joints and controls', () => {
  assert.throws(() => sanitizePose({ constructor: { bend: 1 } }, true), /Unknown pose joint/);
  assert.throws(() => sanitizePose({ leftElbow: { toString: 1 } }, true), /no "toString" control/);
  assert.deepEqual(sanitizePose({ constructor: { bend: 1 }, leftElbow: { toString: 1, bend: 20 } }), { leftElbow: { bend: 20 } });
});
