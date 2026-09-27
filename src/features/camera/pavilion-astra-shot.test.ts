import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TimedPoint } from '../../contracts';
import { parseProject, serializeProject } from '../project/model';
import { compileShot } from './model';
import { pavilionAstraShot } from './pavilion-astra-shot';

test('Astra Pavilion tour survives project storage and plays its timed camera and gaze', () => {
  const shot = pavilionAstraShot();
  const document = parseProject(serializeProject({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Pavilion Scene Graph', shot, actors: [] }), 'pavilion-v1');
  assert.equal(document.shot?.subjectId, 'Group');
  assert.equal(document.shot?.cinemaTraj?.positions.length, 181);
  assert.equal(document.shot?.cinemaTraj?.positions[0].time, 0);
  assert.equal(document.shot?.cinemaTraj?.positions.at(-1)?.time, 40);
  assert.deepEqual(document.shot?.cinemaTraj?.positions.at(-1)?.position, [-2.8, 3.05, 2.8]);
  assert.deepEqual(document.shot?.target, [1.3, 2.3, .5]);
  assert.equal(document.shot?.marks.length, 3);
  const pose = compileShot(document.shot!);
  for (const index of [0, 45, 90, 135, 180]) {
    const sample: TimedPoint = document.shot!.cinemaTraj!.positions[index];
    assert.deepEqual(pose(sample.time).position, sample.position);
  }
  assert.deepEqual(pose(40).position, document.shot!.cinemaTraj!.positions.at(-1)?.position);
});
