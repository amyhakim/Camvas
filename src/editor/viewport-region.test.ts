import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avoidFloatingOverlay, measureClearRegion } from './viewport-region';

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
test('reopening a phone inspector reserves space above the sheet without inverting horizontal bounds', () => {
  const region = measureClearRegion(rect(0, 0, 390, 844), null, rect(12, 300, 366, 220), rect(12, 600, 366, 232), rect(12, 90, 300, 44));
  assert.ok(region.left < region.right);
  assert.ok(region.top < region.bottom);
  assert.equal(region.bottom, (300 - 24) / 844);
  assert.equal(region.right, (390 - 20) / 390);
});


test('a floating assistant reserves the largest clear rectangle on its current side', () => {
  const rect = { left: 0, top: 0, right: 1000, bottom: 800, width: 1000, height: 800 };
  const base = { left: .1, right: .9, top: .1, bottom: .8 };
  const result = avoidFloatingOverlay(base, rect, { left: 600, right: 900, top: 200, bottom: 600, width: 300, height: 400 });
  assert.deepEqual(result, { ...base, right: .584 });
  assert.deepEqual(avoidFloatingOverlay(base, rect, { left: 950, right: 990, top: 200, bottom: 300, width: 40, height: 100 }), base);
});
