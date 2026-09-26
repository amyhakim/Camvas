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
