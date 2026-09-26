import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entityPosition, filterSceneObjects } from './data';
import { animatedCameraFixture, manifestFixture, meshFixture } from './fixtures';

test('static objects return Blender position, not the converted web position', () => {
  assert.deepEqual(entityPosition(meshFixture, 1), [10, 5, 3]);
  assert.deepEqual(entityPosition({ ...meshFixture, samples: [] }, 250), [10, 5, 3]);
});

test('animated positions use the exact one-based Blender frame offset', () => {
  assert.deepEqual(entityPosition(animatedCameraFixture, 1), [10, 20, 30]);
  assert.deepEqual(entityPosition(animatedCameraFixture, 2), [11, 22, 33]);
  assert.deepEqual(entityPosition(animatedCameraFixture, 3), [12, 24, 36]);
});

test('animated positions hold the first and last sample outside the animation', () => {
  assert.deepEqual(entityPosition(animatedCameraFixture, -20), [10, 20, 30]);
  assert.deepEqual(entityPosition(animatedCameraFixture, 0), [10, 20, 30]);
  assert.deepEqual(entityPosition(animatedCameraFixture, 374), [12, 24, 36]);
});

test('search matches visible name, source name, type, category, and material without case sensitivity', () => {
  for (const query of ['CHAIR', 'BarcelonaChair.001', 'mesh', 'furniture', 'CHROME']) {
    assert.deepEqual(filterSceneObjects(manifestFixture.objects, query), [meshFixture]);
  }
  assert.deepEqual(filterSceneObjects(manifestFixture.objects, 'camera'), [animatedCameraFixture]);
});

test('empty search preserves order and missing search returns no objects', () => {
  assert.deepEqual(filterSceneObjects(manifestFixture.objects, ''), manifestFixture.objects);
  assert.deepEqual(filterSceneObjects(manifestFixture.objects, 'water'), []);
  assert.deepEqual(filterSceneObjects([], ''), []);
});
