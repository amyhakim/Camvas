import assert from 'node:assert/strict';
import test from 'node:test';
import type { TimelineClip } from '../../contracts';
import { applyGesture } from './clip-lane';
import { laneRows } from './model';

const clip: TimelineClip = { id: 'audio:a', label: 'A', startFrame: 49, endFrame: 97, bounds: { minStart: 25, maxEnd: 121, minLength: 3, latestEnd: 2881 } };

test('gestures move and trim within the source bounds', () => {
  assert.deepEqual(applyGesture(clip, 'move', -100, 1), { startFrame: 1, endFrame: 49 }, 'moves keep length and stop at the first frame');
  assert.deepEqual(applyGesture(clip, 'start', -40, 1), { startFrame: 25, endFrame: 97 }, 'head trim stops at the start of the file');
  assert.deepEqual(applyGesture(clip, 'start', 100, 1), { startFrame: 94, endFrame: 97 }, 'never shorter than the minimum length');
  assert.deepEqual(applyGesture(clip, 'end', 100, 1), { startFrame: 49, endFrame: 121 }, 'tail trim stops at the end of the file');
});

test('overlapping clips stack into at most three rows', () => {
  assert.deepEqual(laneRows([{ startFrame: 1, endFrame: 10 }, { startFrame: 20, endFrame: 30 }]), { rows: [0, 0], count: 1 });
  assert.deepEqual(laneRows([{ startFrame: 1, endFrame: 10 }, { startFrame: 5, endFrame: 12 }, { startFrame: 11, endFrame: 20 }]), { rows: [0, 1, 0], count: 2 });
});
