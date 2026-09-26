import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actorFixture } from '../../contracts/fixtures';
import { actorSignature, evaluateActor, setActorPoseAtTime } from '../blocking/model';
import { compileShot, generateShot, motionTarget, type SubjectMotion } from './model';

const motion: SubjectMotion = { height: actorFixture.height, at: seconds => evaluateActor(actorFixture, seconds), signature: actorSignature(actorFixture) };
const snapshot = { subjectId: actorFixture.id, subjectName: actorFixture.name, min: [-7.3, 1.4, 1.7] as [number, number, number], max: [-6.7, 3.15, 2.3] as [number, number, number], cameraPosition: [-7, 3, 8] as [number, number, number] };

test('an actor-linked move rides the actor and locks aim to where they are at playback time', () => {
  const shot = generateShot(snapshot, { presetId: 'follow-behind', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'full' }, motion);
  assert.equal(shot.trackSubject, true);
  assert.equal(shot.subjectSignature, actorSignature(actorFixture));
  // The camera keeps a steady offset from the walking actor, so it travels with them.
  const gaps = shot.marks.map(mark => { const [x, , z] = evaluateActor(actorFixture, mark.time).position; return Math.hypot(mark.position.x - x, mark.position.z - z); });
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < .5, `follow distance ${gaps.map(g => g.toFixed(2)).join(', ')}`);
  const travelled = shot.marks.slice(1).reduce((sum, mark, i) => sum + Math.hypot(mark.position.x - shot.marks[i].position.x, mark.position.z - shot.marks[i].position.z), 0);
  assert.ok(travelled > 2, `camera travelled ${travelled} m`);
  const evaluate = compileShot(shot, motionTarget(motion));
  for (const t of [0, 1.5, 3, 6]) {
    const pose = evaluate(t), aim = motionTarget(motion)(t);
    const pan = Math.atan2(-(aim[0] - pose.position[0]), -(aim[2] - pose.position[2]));
    assert.ok(Math.abs(Math.atan2(Math.sin(pose.pan - pan), Math.cos(pose.pan - pan))) < 1e-9, `aim at ${t}s`);
  }
});

test('the signature changes when the actor is re-blocked, flagging a stale camera path', () => {
  const moved = setActorPoseAtTime(actorFixture, 3, { id: actorFixture.id, position: [-5, 1.4, 5], heading: 0 });
  assert.notEqual(actorSignature(moved), actorSignature(actorFixture));
  assert.equal(actorSignature({ ...actorFixture, name: 'Renamed' }), actorSignature(actorFixture));
});

test('static subjects are unchanged by the new optional parameters', () => {
  const shot = generateShot({ ...snapshot, subjectId: 'chair' }, { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' });
  assert.equal(shot.subjectSignature, undefined);
  assert.deepEqual(shot.target, [-7, 2.275, 2]);
});
