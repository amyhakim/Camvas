import assert from 'node:assert/strict';
import { test } from 'node:test';
import { measureClearRegion } from './viewport-region';

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
test('reopening a phone inspector reserves space above the sheet without inverting horizontal bounds', () => {
  const region = measureClearRegion(rect(0, 0, 390, 844), null, rect(12, 300, 366, 220), rect(12, 600, 366, 232), rect(12, 90, 300, 44));
  assert.ok(region.left < region.right);
  assert.ok(region.top < region.bottom);
  assert.equal(region.bottom, (300 - 24) / 844);
  assert.equal(region.right, (390 - 20) / 390);
});
