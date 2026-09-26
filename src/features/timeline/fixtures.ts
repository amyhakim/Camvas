import type { TimelineTrack } from '../../contracts';
import { tracksFixture } from '../../contracts/fixtures';

export const timelineTracksFixture: TimelineTrack[] = tracksFixture.map(track => ({
  ...track,
  clip: { ...track.clip },
}));

export const draftTracksFixture: TimelineTrack[] = [
  timelineTracksFixture[0],
  {
    id: 'draft',
    label: 'Draft camera',
    kind: 'camera',
    selectable: true,
    clip: { label: 'Chair orbit', startFrame: 1, endFrame: 193, detail: '8 s', draft: true },
  },
];

export const timelineFixture = {
  tracks: timelineTracksFixture,
  frame: 1,
  frameStart: 1,
  frameEnd: 374,
  fps: 24,
  playing: false,
  subtitle: 'Camera animation',
  footerText: 'Camera animation · frames 1–250',
};

/** An independent edit range whose source clips extend beyond both visible edges. */
export const offsetTimelineFixture = {
  frame: 1121,
  frameStart: 1001,
  frameEnd: 1241,
  fps: 24,
  tracks: [
    {
      id: 'incoming', label: 'Incoming camera', kind: 'camera', selectable: true,
      clip: { label: 'Approach', startFrame: 953, endFrame: 1121 },
    },
    {
      id: 'outgoing', label: 'Outgoing camera', kind: 'camera', selectable: true,
      clip: { label: 'Departure', startFrame: 1181, endFrame: 1289 },
    },
  ] satisfies TimelineTrack[],
};
