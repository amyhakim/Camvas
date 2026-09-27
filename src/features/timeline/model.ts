import type { TimelineTrack } from '../../contracts';

export function clampFrame(frame: number, frameStart: number, frameEnd: number) {
  return Math.max(frameStart, Math.min(frameEnd, frame));
}

export function framePosition(frame: number, frameStart: number, frameEnd: number) {
  if (frameEnd <= frameStart) return 0;
  return (clampFrame(frame, frameStart, frameEnd) - frameStart) / (frameEnd - frameStart) * 100;
}

export function formatTimecode(frame: number, frameStart: number, fps: number) {
  const elapsed = Math.max(0, frame - frameStart);
  return `${String(Math.floor(elapsed / fps / 60)).padStart(2, '0')}:${String(Math.floor(elapsed / fps) % 60).padStart(2, '0')}:${String(elapsed % fps).padStart(2, '0')}`;
}

export function rulerLabels(frameStart: number, frameEnd: number, fps: number) {
  return Array.from({ length: 6 }, (_, index) => {
    const seconds = Math.floor(Math.max(0, frameEnd - frameStart) / fps * index / 5);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  });
}

/** Frame coordinates measure the distance between endpoints, not an inclusive count. */
export function clipLayout(clip: { startFrame: number; endFrame: number }, frameStart: number, frameEnd: number) {
  const left = framePosition(clip.startFrame, frameStart, frameEnd);
  const right = framePosition(clip.endFrame, frameStart, frameEnd);
  return { marginLeft: `${left}%`, width: `${Math.max(0, right - left)}%` };
}

export function playbackFrame(frame: number, frameStart: number, frameEnd: number, playing: boolean) {
  return !playing && frame === frameEnd ? frameStart : frame;
}

/** Greedy row assignment so overlapping clips share a lane without covering each other (max 3 rows). */
export function laneRows(clips: { startFrame: number; endFrame: number }[]) {
  const order = clips.map((clip, index) => ({ clip, index })).sort((a, b) => a.clip.startFrame - b.clip.startFrame);
  const ends: number[] = [];
  const rows = new Array<number>(clips.length).fill(0);
  for (const { clip, index } of order) {
    let row = ends.findIndex(end => end <= clip.startFrame);
    if (row < 0) row = ends.length < 3 ? ends.length : ends.indexOf(Math.min(...ends));
    ends[row] = clip.endFrame; rows[index] = row;
  }
  return { rows, count: Math.max(1, ends.length) };
}
