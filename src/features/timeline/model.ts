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
export function clipLayout(clip: TimelineTrack['clip'], frameStart: number, frameEnd: number) {
  const left = framePosition(clip.startFrame, frameStart, frameEnd);
  const right = framePosition(clip.endFrame, frameStart, frameEnd);
  return { marginLeft: `${left}%`, width: `${Math.max(0, right - left)}%` };
}

export function playbackFrame(frame: number, frameStart: number, frameEnd: number, playing: boolean) {
  return !playing && frame === frameEnd ? frameStart : frame;
}
