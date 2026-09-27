import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TimedPoint } from '../../contracts';
import { PAVILION_FLIGHT_LANDMARKS } from '../../editor/pavilion-landmarks';
import { parseProject, serializeProject } from '../project/model';
import { compileShot, createPathPreview } from './model';
import { pavilionAstraShot } from './pavilion-astra-shot';
import { sampleCameraRoute } from './route-overview-model';

test('Astra Pavilion tour survives project storage and plays its timed camera and gaze', () => {
  const shot = pavilionAstraShot(PAVILION_FLIGHT_LANDMARKS);
  const document = parseProject(serializeProject({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Pavilion Scene Graph', shot, actors: [], landmarks: PAVILION_FLIGHT_LANDMARKS }), 'pavilion-v1');
  assert.equal(document.shot?.subjectId, 'Group');
  assert.equal(document.shot?.cinemaTraj?.positions.length, 240);
  assert.equal(document.shot?.cinemaTraj?.positions[0].time, 0);
  assert.equal(document.shot?.cinemaTraj?.positions.at(-1)?.time, 60);
  assert.deepEqual(document.shot?.cinemaTraj?.positions.at(-1)?.position, [-16.5, 5.5, 11.5]);
  assert.deepEqual(document.shot?.target, [0, 2.8, 3]);
  assert.equal(document.shot?.marks.length, 5);
  assert.deepEqual(document.shot?.anchorIds, PAVILION_FLIGHT_LANDMARKS.map(mark => mark.id));
  const positionKeys = document.shot!.cinemaTraj!.positions;
  const preview = createPathPreview(document.shot!);
  const overview = sampleCameraRoute(document.shot!);
  const arrivals = PAVILION_FLIGHT_LANDMARKS.map(mark => positionKeys.findIndex(key => key.position.every((value, axis) => Math.abs(value - mark.position[axis]) < 1e-6)));
  assert.ok(arrivals.every((index, order) => index >= 0 && (!order || index > arrivals[order - 1])));
  assert.ok(arrivals[PAVILION_FLIGHT_LANDMARKS.findIndex(mark => mark.id === 'flight:lounge-crossing')] < arrivals[PAVILION_FLIGHT_LANDMARKS.findIndex(mark => mark.id === 'flight:courtyard-exit')]);
  assert.ok(arrivals[PAVILION_FLIGHT_LANDMARKS.findIndex(mark => mark.id === 'flight:courtyard-exit')] < arrivals[PAVILION_FLIGHT_LANDMARKS.findIndex(mark => mark.id === 'flight:exterior-final')]);
  const peakSpeed = Math.max(...positionKeys.slice(1).map((key, index) => Math.hypot(...key.position.map((value, axis) => value - positionKeys[index].position[axis])) / (key.time - positionKeys[index].time)));
  assert.ok(peakSpeed < 1.7, `peak speed is ${peakSpeed} m/s`);
  for (const index of arrivals) {
    assert.deepEqual(preview.points[index], positionKeys[index].position);
    assert.ok(overview.some(sample => sample.time === positionKeys[index].time && sample.pose.position.every((value, axis) => Math.abs(value - positionKeys[index].position[axis]) < 1e-9)));
  }
  const pose = compileShot(document.shot!);
  for (const index of [0, 60, 120, 180, 239]) {
    const sample: TimedPoint = document.shot!.cinemaTraj!.positions[index];
    assert.deepEqual(pose(sample.time).position, sample.position);
  }
  assert.deepEqual(pose(60).position, document.shot!.cinemaTraj!.positions.at(-1)?.position);
  assert.throws(() => parseProject(JSON.stringify({ ...document, landmarks: document.landmarks!.slice(1) }), 'pavilion-v1'), /flight landmark is missing/);
});
