import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAVILION_FLIGHT_LANDMARKS } from '../../editor/pavilion-landmarks';
import { parseProject, serializeProject } from '../project/model';
import { compileShot } from './model';
import { pavilionFastShot } from './pavilion-fast-shot';

test('fast Pavilion retains every landmark and serializes continuous Blockout reveal', () => {
  const shot = pavilionFastShot(PAVILION_FLIGHT_LANDMARKS);
  parseProject(serializeProject({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Fast Pavilion', shot, actors: [], landmarks: PAVILION_FLIGHT_LANDMARKS }), 'pavilion-v1');
  assert.equal(shot.settings.duration, 32);
  const keys = shot.cinemaTraj!.positions;
  let previous = -1;
  for (const landmark of PAVILION_FLIGHT_LANDMARKS) {
    const index = keys.findIndex(key => key.position.every((v, axis) => v === landmark.position[axis]));
    assert.ok(index > previous); previous = index;
  }
  const speeds = keys.slice(1).map((key, i) => Math.hypot(...key.position.map((v, a) => v - keys[i].position[a])) / (key.time - keys[i].time));
  assert.ok(Math.max(...speeds) < 6);
  assert.equal(keys.at(-1)!.position[1], 15);
  const evaluate = compileShot(shot);
  for (const key of keys) assert.ok(evaluate(key.time).position.every((v, axis) => Math.abs(v - key.position[axis]) < 1e-10));
});
