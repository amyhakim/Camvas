import assert from 'node:assert/strict';
import test from 'node:test';
import { draftTracksFixture, timelineFixture, timelineTracksFixture } from './fixtures';
import { clampFrame, clipLayout, formatTimecode, framePosition, playbackFrame, rulerLabels } from './model';

test('source and draft clips keep endpoint-based widths on a longer timeline', () => {
  const { frameStart, frameEnd } = timelineFixture;
  assert.deepEqual(clipLayout(timelineTracksFixture[0].clip, frameStart, frameEnd), { marginLeft: '0%', width: `${249 / 373 * 100}%` });
  assert.deepEqual(clipLayout(draftTracksFixture[1].clip, frameStart, frameEnd), { marginLeft: '0%', width: `${192 / 373 * 100}%` });
  assert.equal(timelineTracksFixture[0].hold, true);
  assert.equal(draftTracksFixture[1].hold, undefined);
});

test('clip positions support arbitrary starts and crop to the visible frame range', () => {
  const clip = { label: 'Generic clip', startFrame: 125, endFrame: 175 };
  assert.deepEqual(clipLayout(clip, 100, 200), { marginLeft: '25%', width: '50%' });
  assert.deepEqual(clipLayout({ ...clip, startFrame: 50, endFrame: 150 }, 100, 200), { marginLeft: '0%', width: '50%' });
  assert.deepEqual(clipLayout({ ...clip, startFrame: 150, endFrame: 250 }, 100, 200), { marginLeft: '50%', width: '50%' });
});

test('seeking and playhead positions stay within the supplied frame range', () => {
  assert.equal(clampFrame(99, 100, 200), 100);
  assert.equal(clampFrame(201, 100, 200), 200);
  assert.equal(clampFrame(150, 100, 200), 150);
  assert.equal(framePosition(100, 100, 200), 0);
  assert.equal(framePosition(150, 100, 200), 50);
  assert.equal(framePosition(250, 100, 200), 100);
  assert.equal(framePosition(100, 100, 100), 0);
});

test('timecode uses the supplied frame origin and fps, including minute rollover', () => {
  assert.equal(formatTimecode(100, 100, 24), '00:00:00');
  assert.equal(formatTimecode(123, 100, 24), '00:00:23');
  assert.equal(formatTimecode(124, 100, 24), '00:01:00');
  assert.equal(formatTimecode(1905, 100, 30), '01:00:05');
  assert.equal(formatTimecode(90, 100, 24), '00:00:00');
  assert.deepEqual(rulerLabels(100, 460, 24), ['00:00', '00:03', '00:06', '00:09', '00:12', '00:15']);
});

test('starting playback at the end rewinds while pausing and resuming preserve position', () => {
  assert.equal(playbackFrame(200, 100, 200, false), 100);
  assert.equal(playbackFrame(200, 100, 200, true), 200);
  assert.equal(playbackFrame(150, 100, 200, false), 150);
  assert.equal(playbackFrame(150, 100, 200, true), 150);
});
