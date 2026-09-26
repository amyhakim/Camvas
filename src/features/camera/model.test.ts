import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shotFixture } from './fixtures';
import { compileShot, createPathPreview, shotEndFrame } from './model';

test('a draft starts at time zero and exposes a plain serializable path', () => {
  const evaluate = compileShot(shotFixture);
  const path = createPathPreview(shotFixture);
  assert.deepEqual(path.points[0], evaluate(0).position);
  assert.deepEqual(path.points.at(-1), evaluate(shotFixture.settings.duration).position);
  assert.equal(shotEndFrame(shotFixture, 24), 145);
  assert.deepEqual(JSON.parse(JSON.stringify(path)), path);
});
