import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pavilionInteriorShot } from './pavilion-interior-shot';
import { compileShot } from './model';
import { parseProject, serializeProject } from '../project/model';

test('interior-first tour has no landmark locks and ends with a real optical zoom', () => {
  const shot = pavilionInteriorShot();
  parseProject(serializeProject({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Tour', actors: [], shot }), 'pavilion-v1');
  assert.equal(shot.anchorIds, undefined);
  const at = compileShot(shot);
  assert.deepEqual(at(0).position, [2.5, 3, -1.6]);
  assert.ok(at(6.5).position[0] > 0);
  assert.ok(at(15).position[0] < -10);
  assert.deepEqual(at(18).position, at(22).position);
  assert.equal(at(18).focalLength, 35);
  assert.equal(at(22).focalLength, 85);
});
