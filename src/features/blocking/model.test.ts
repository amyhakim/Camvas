import test from 'node:test';
import assert from 'node:assert/strict';
import { WALKING_ACTOR } from './fixtures';
import { actorEndFrame, actorPath, addActorMark, createActor, evaluateActor, removeActorMark, updateActorMark, validateActor } from './model';

test('arbitrary seeks interpolate positions and the shortest heading arc', () => {
  for (const time of [2, 3, 1, 2]) {
    const pose = evaluateActor(WALKING_ACTOR, time);
    assert.deepEqual(pose.position, [time * 2, 1, -time]);
    assert.ok(Math.abs(pose.heading - (170 + time * 5) * Math.PI / 180) < 1e-10);
  }
  assert.deepEqual(evaluateActor(WALKING_ACTOR, -1).position, [0, 1, 0]);
  assert.deepEqual(evaluateActor(WALKING_ACTOR, 99).position, [8, 1, -4]);
  assert.equal(evaluateActor(WALKING_ACTOR, 4).heading, WALKING_ACTOR.marks[1].heading);
});
test('static actors, endpoint frames, and detached path data', () => {
  const input: [number, number, number] = [1, 2, 3];
  const actor = createActor('actor:one', 'One', input); input[0] = 999;
  assert.deepEqual(evaluateActor(actor, 30).position, [1, 2, 3]);
  assert.equal(actorEndFrame(actor, 24), 1);
  assert.equal(actorEndFrame({ ...WALKING_ACTOR, marks: [{ ...WALKING_ACTOR.marks[0], time: 1.01 }] }, 24), 26);
  const path = actorPath(actor); path.points[0][0] = 99;
  assert.equal(actor.marks[0].position[0], 1);
});
test('mark authoring preserves source, selects existing times, and validates mutations', () => {
  const before = JSON.stringify(WALKING_ACTOR);
  const next = addActorMark(WALKING_ACTOR, 2);
  assert.deepEqual(next.marks.map(mark => mark.time), [0, 2, 4]);
  assert.deepEqual(next.marks[1].position, [4, 1, -2]);
  assert.equal(addActorMark(next, 2), next);
  assert.equal(JSON.stringify(WALKING_ACTOR), before);
  assert.throws(() => updateActorMark(next, 1, { time: 4 }), /unique/);
  assert.throws(() => updateActorMark(next, 1, { position: [Infinity, 0, 0] }), /position/);
  assert.throws(() => addActorMark(next, 61), /60/);
  assert.throws(() => removeActorMark(createActor('actor:a', 'A', [0, 0, 0]), 0), /between 1/);
  assert.deepEqual(removeActorMark(next, 1).marks.map(mark => mark.time), [0, 4]);
  assert.throws(() => validateActor({ ...next, height: .1 }), /Height/);
  assert.throws(() => createActor('a', 'A', [0, 0, 0]), /ID/);
  assert.throws(() => evaluateActor(next, NaN), /finite/);
  assert.throws(() => actorEndFrame(next, 0), /positive/);
});

test('opposite headings choose a deterministic half turn and exact authored marks hold', () => {
  const actor = { ...WALKING_ACTOR, marks: [
    { time: 0, position: [0, 0, 0] as [number, number, number], heading: 0 },
    { time: 2, position: [2, 0, 0] as [number, number, number], heading: Math.PI },
    { time: 4, position: [4, 0, 0] as [number, number, number], heading: 0 },
  ] };
  assert.equal(evaluateActor(actor, 1).heading, -Math.PI / 2);
  assert.equal(evaluateActor(actor, 2).heading, Math.PI);
  assert.deepEqual(evaluateActor(actor, 2).position, [2, 0, 0]);
});
test('mark capacity and finite world/time bounds apply to every mutation', () => {
  const actor = { ...WALKING_ACTOR, marks: Array.from({ length: 64 }, (_, time) => ({ time: time / 2, position: [0, 0, 0] as [number, number, number], heading: 0 })) };
  assert.equal(addActorMark(actor, 3), actor);
  assert.throws(() => addActorMark(actor, 32), /64/);
  assert.throws(() => updateActorMark(WALKING_ACTOR, 0, { time: -1 }), /60/);
  assert.throws(() => updateActorMark(WALKING_ACTOR, 0, { position: [1001, 0, 0] }), /1000/);
  assert.throws(() => updateActorMark(WALKING_ACTOR, 0, { heading: Infinity }), /finite/);
  const boundary = createActor('actor:boundary', 'Boundary', [-1000, 1000, 0]);
  assert.equal(addActorMark(boundary, 60).marks[1].time, 60);
});
