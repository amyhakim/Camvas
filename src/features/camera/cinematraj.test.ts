import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateActor } from '../blocking/model';
import { parseProject, serializeProject } from '../project/model';
import { projectFixture } from '../project/fixtures';
import type { ActorTrack } from '../../contracts';
import { compileShot, createPathPreview } from './model';
import { cinemaTrajInput, cinemaTrajShot } from './cinematraj';

test('CinemaTraj camera input and playback follow timed actor blocking and survive a project round trip', () => {
  const actor: ActorTrack = { id: 'actor:test', name: 'Runner', color: '#edc58c', height: 1.8, marks: [
    { time: 0, position: [0, 0, 0], heading: 0 },
    { time: 6, position: [6, 0, 0], heading: 0 },
  ] };
  const settings = { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame' as const, framing: 'wide' as const };
  const input = cinemaTrajInput(actor, time => evaluateActor(actor, time), [0, 3, 8], settings);
  assert.equal(input.positions.length, 121);
  assert.equal(input.targets[60].position[0], 3);
  const optimized = input.positions.map(point => ({ ...point, position: [point.position[0], point.position[1] + .5, point.position[2]] as [number, number, number] }));
  const shot = cinemaTrajShot(actor, settings, optimized, input.targets);
  const pose = compileShot(shot)(3);
  assert.deepEqual(pose.position, optimized[60].position);
  assert.equal(createPathPreview(shot).points[60][0], pose.position[0]);
  const stored = parseProject(serializeProject({ ...projectFixture, shot, actors: [actor] }), projectFixture.sceneId);
  assert.deepEqual(stored.shot, shot);
  assert.deepEqual(compileShot(stored.shot!)(3), pose);
  const broken = structuredClone({ ...projectFixture, shot, actors: [actor] });
  broken.shot!.cinemaTraj!.positions[60].time = broken.shot!.cinemaTraj!.positions[59].time;
  assert.throws(() => serializeProject(broken), /sample times must increase/);
});
