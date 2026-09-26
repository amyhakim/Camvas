import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampMenuPosition } from './model';
test('menu stays inside phone viewport and repositions for resize', () => {
  assert.deepEqual(clampMenuPosition(300, 600, 240, 400, 320, 640), { left: 72, top: 232 });
  assert.deepEqual(clampMenuPosition(300, 600, 184, 184, 200, 200), { left: 8, top: 8 });
});
test('negative and nonfinite pointer positions remain usable', () => {
  assert.deepEqual(clampMenuPosition(-20, NaN, 240, 200, 1000, 800), { left: 8, top: 8 });
});
