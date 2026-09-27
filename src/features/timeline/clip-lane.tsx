'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { TimelineClip, TimelineClipChange, TimelineTrack } from '@/contracts';
import { clipLayout, laneRows } from './model';

type Drag = { id: string; mode: TimelineClipChange['mode']; x: number; clip: TimelineClip; moved: boolean; preview: { startFrame: number; endFrame: number } };
export type ClipLaneProps = {
  track: TimelineTrack; frameStart: number; frameEnd: number; fps: number;
  onClipChange?: (trackId: string, clipId: string, change: TimelineClipChange) => void;
  onClipSelect?: (trackId: string, clipId: string) => void;
  onClipDelete?: (trackId: string, clipId: string) => void;
};

/** Clamp a gesture to the clip's source bounds and the minimum length. */
export function applyGesture(clip: TimelineClip, mode: TimelineClipChange['mode'], delta: number, frameStart: number) {
  const { minStart, maxEnd, minLength, latestEnd } = clip.bounds;
  const length = clip.endFrame - clip.startFrame;
  if (mode === 'move') {
    const start = Math.min(Math.max(frameStart, clip.startFrame + delta), latestEnd - length);
    return { startFrame: start, endFrame: start + length };
  }
  if (mode === 'start') return { startFrame: Math.min(Math.max(minStart, frameStart, clip.startFrame + delta), clip.endFrame - minLength), endFrame: clip.endFrame };
  return { startFrame: clip.startFrame, endFrame: Math.max(Math.min(maxEnd, clip.endFrame + delta), clip.startFrame + minLength) };
}

/**
 * A lane of editable clips: drag the body to move, the edges to trim. Overlapping clips stack as thinner rows
 * inside the lane so it never grows. Keyboard: ←/→ nudge a frame (Shift: a second), Delete removes.
 */
export function ClipLane({ track, frameStart, frameEnd, fps, onClipChange, onClipSelect, onClipDelete }: ClipLaneProps) {
  const lane = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const clips = track.clips ?? [];
  const shown = clips.map(clip => drag?.id === clip.id ? { ...clip, ...drag.preview } : clip);
  const { rows, count } = laneRows(shown);
  const framesPerPixel = () => (frameEnd - frameStart) / Math.max(1, lane.current?.getBoundingClientRect().width ?? 1);

  function down(event: PointerEvent<HTMLElement>, clip: TimelineClip, mode: Drag['mode']) {
    if (event.button !== 0 || !onClipChange) return;
    event.stopPropagation(); event.preventDefault();
    (event.currentTarget.closest('[data-clip]') as HTMLElement | null)?.setPointerCapture(event.pointerId);
    setDrag({ id: clip.id, mode, x: event.clientX, clip, moved: false, preview: { startFrame: clip.startFrame, endFrame: clip.endFrame } });
  }
  function move(event: PointerEvent<HTMLElement>) {
    if (!drag) return;
    const delta = Math.round((event.clientX - drag.x) * framesPerPixel());
    if (!drag.moved && Math.abs(event.clientX - drag.x) < 3) return;
    setDrag({ ...drag, moved: true, preview: applyGesture(drag.clip, drag.mode, delta, frameStart) });
  }
  function up() {
    if (!drag) return;
    const { id, mode, moved, preview, clip } = drag;
    setDrag(null);
    if (moved && (preview.startFrame !== clip.startFrame || preview.endFrame !== clip.endFrame)) onClipChange?.(track.id, id, { mode, ...preview });
    else onClipSelect?.(track.id, id);
  }
  function key(event: KeyboardEvent<HTMLElement>, clip: TimelineClip) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClipSelect?.(track.id, clip.id); return; }
    if ((event.key === 'Delete' || event.key === 'Backspace') && onClipDelete) { event.preventDefault(); onClipDelete(track.id, clip.id); return; }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (!onClipChange) return;
    event.preventDefault();
    const step = (event.shiftKey ? fps : 1) * (event.key === 'ArrowLeft' ? -1 : 1);
    onClipChange(track.id, clip.id, { mode: 'move', ...applyGesture(clip, 'move', step, frameStart) });
  }

  const height = count > 1 ? `${(28 - (count - 1) * 2) / count}px` : '28px';
  return <div ref={lane} className="track-lane clip-lane" data-rows={count}>
    {shown.map((clip, index) => {
      const layout = clipLayout(clip, frameStart, frameEnd);
      const original = clips[index];
      const seconds = (clip.endFrame - clip.startFrame) / fps;
      return <div key={clip.id} data-clip={clip.id} role="button" tabIndex={0}
        className={`track-clip audio-clip${track.kind === 'sfx' ? ' sfx-clip' : ''}${clip.selected ? ' is-selected' : ''}${drag?.id === clip.id ? ' is-dragging' : ''}`}
        style={{ position: 'absolute', left: layout.marginLeft, width: layout.width, height, top: `calc(50% - 14px + ${rows[index] * (parseFloat(height) + 2)}px)` }}
        aria-label={`${clip.label}, ${((clip.startFrame - 1) / fps).toFixed(2)} to ${((clip.endFrame - 1) / fps).toFixed(2)} seconds. Drag to move, drag edges to trim, arrow keys nudge, Delete removes.`}
        title={`${clip.label} · ${seconds.toFixed(2)} s`}
        onPointerDown={event => down(event, original, 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
        onKeyDown={event => key(event, original)}>
        <span className="clip-handle clip-handle--start" onPointerDown={event => down(event, original, 'start')} aria-hidden="true" />
        <span className="clip-name">{clip.label}</span>
        {count === 1 && clip.detail && <span className="clip-duration">{clip.detail}</span>}
        <span className="clip-handle clip-handle--end" onPointerDown={event => down(event, original, 'end')} aria-hidden="true" />
      </div>;
    })}
  </div>;
}
