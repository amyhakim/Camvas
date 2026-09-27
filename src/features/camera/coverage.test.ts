import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCoverage } from './coverage';
import { compileShot, generateShot, type SubjectMotion } from './model';
import type { ShotSnapshot } from '../../contracts';

const snapshot: ShotSnapshot = { subjectId: 'actor:hero', subjectName: 'Hero', min: [-.3, 2, -.3], max: [.3, 3.8, .3], cameraPosition: [10, 15, 10] };
const motion: SubjectMotion = { height: 1.8, at: time => ({ position: [time, 2, 0], heading: 0 }), signature: 'hero' };

test('coverage produces stable stationary wide, medium and close shots at subject height', () => {
  const shots = generateCoverage(snapshot, motion);
  assert.deepEqual(shots.map(shot => shot.settings.framing), ['wide', 'medium', 'close']);
  for (const shot of shots) {
    const evaluate = compileShot(shot);
    assert.deepEqual(evaluate(0), evaluate(shot.settings.duration));
    assert.ok(evaluate(1.5).position.every(Number.isFinite));
    assert.equal(evaluate(0).tilt, 0);
    assert.ok(evaluate(0).position[1] >= 2 && evaluate(0).position[1] <= 3.8);
    assert.equal(shot.trackSubject, false);
  }
  assert.ok(shots[2].target[1] > shots[1].target[1]);
  assert.throws(() => generateCoverage(snapshot, motion, NaN), /duration/);
});

test('static compositions can be regenerated with the chosen lens, duration and sensor', () => {
  const settings = { presetId: 'static-coverage', framing: 'close' as const, duration: 4, focalLength: 65, sensor: 'super35' as const };
  const shot = generateShot(snapshot, settings, motion);
  assert.deepEqual(shot.settings, settings);
  assert.deepEqual(compileShot(shot)(0), compileShot(shot)(4));
  assert.equal(shot.marks.at(-1)?.time, 4);
});
