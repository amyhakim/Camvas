import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pavilionDoorwayShot } from './pavilion-doorway-shot';
import { compileShot } from './model';
import { parseProject, serializeProject } from '../project/model';

test('smooth doorway tour preserves storage, gentle pace and gradual zoom', () => {
  const shot = pavilionDoorwayShot();
  parseProject(serializeProject({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Doorway', actors: [], shot }), 'pavilion-v1');
  const at = compileShot(shot);
  assert.equal(shot.anchorIds, undefined);
  assert.equal(shot.settings.duration, 44);
  assert.deepEqual(at(38).position, at(44).position);
  assert.equal(at(38).focalLength, 22);
  assert.equal(at(44).focalLength, 45);
  for (let i = 1; i <= 4400; i++) {
    const a = at((i - 1) / 100), b = at(i / 100);
    assert.ok(Math.hypot(...b.position.map((v, axis) => v - a.position[axis])) * 100 < 1.4);
    assert.ok(Math.abs(b.focalLength - a.focalLength) < .1);
    const pan = Math.atan2(Math.sin(b.pan - a.pan), Math.cos(b.pan - a.pan));
    assert.ok(Math.hypot(pan, b.tilt - a.tilt) * 100 * 180 / Math.PI < 35);
  }
  const passage = shot.cinemaTraj!.positions.filter(p => p.position[0] > 5 && p.position[0] < 5.9 && p.position[2] > 4.8 && p.position[2] < 5.5);
  assert.ok(passage.some(p => p.time < 15));
  assert.ok(passage.some(p => p.time > 20));
});
