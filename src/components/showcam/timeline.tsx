'use client';

import { Camera, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Film, Pause, Play } from 'lucide-react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import { FRAME_END, FRAME_START } from '@/lib/preview-data';
import { shotEndFrame, type CameraShot } from '@/lib/camera-shot';

export function Timeline({ frame, playing, onFrameChange, onPlayChange, onCameraSelect, shot = null, frameEnd = FRAME_END, fps = 24, onShotSelect }: {
  shot?: CameraShot | null; frameEnd?: number; fps?: number; onShotSelect?: () => void;
  frame: number; playing: boolean; onFrameChange: (frame: number) => void;
  onPlayChange: (playing: boolean) => void; onCameraSelect: () => void;
}) {
  function formatTimecode(frame: number) { const elapsed = Math.max(0, frame - FRAME_START); return `${String(Math.floor(elapsed / fps / 60)).padStart(2, '0')}:${String(Math.floor(elapsed / fps) % 60).padStart(2, '0')}:${String(elapsed % fps).padStart(2, '0')}`; }
  const position = ((frame - FRAME_START) / (frameEnd - FRAME_START)) * 100;
  function seek(next: number) { onPlayChange(false); onFrameChange(Math.max(FRAME_START, Math.min(frameEnd, next))); }
  return <GlassPanel density="dense" className="timeline" role="region" aria-label="Scene timeline">
    <div className="timeline-toolbar">
      <div className="timeline-title"><Film size={16} /><h2>Timeline</h2><span className="subtle">{shot ? 'Camera authoring' : 'Camera animation'}</span></div>
      <div className="transport">
        <Button variant="ghost" size="sm" iconOnly aria-label="Go to first frame" onClick={() => seek(FRAME_START)}><ChevronFirst size={17} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Previous frame" onClick={() => seek(frame - 1)} disabled={frame === FRAME_START}><ChevronLeft size={17} /></Button>
        <Button variant="primary" size="sm" iconOnly aria-label={playing ? 'Pause timeline' : 'Play timeline'} onClick={() => { if (!playing && frame === frameEnd) onFrameChange(FRAME_START); onPlayChange(!playing); }}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Next frame" onClick={() => seek(frame + 1)} disabled={frame === frameEnd}><ChevronRight size={17} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Go to last frame" onClick={() => seek(frameEnd)}><ChevronLast size={17} /></Button>
      </div>
      <div className="timeline-readout"><output aria-label="Current timecode">{formatTimecode(frame)}</output><span>{fps} fps</span></div>
    </div>
    <div className="timeline-grid">
      <div className="track-labels"><span className="track-heading">TRACKS</span><button type="button" onClick={onCameraSelect}><Camera size={15} /><span>Camera.002</span></button><div>{shot ? <button type="button" onClick={onShotSelect}><Camera size={15} /><span>Draft camera</span></button> : <><Film size={15} /><span>Scene</span></>}</div></div>
      <div className="track-area">
        <div className="time-ruler" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => Math.floor((frameEnd - 1) / fps * i / 5)).map((seconds, i) => <span key={i}>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span>)}</div>
        <div className="track-lane"><button type="button" className="track-clip" style={{ width: `${249 / (frameEnd - 1) * 100}%` }} onClick={onCameraSelect}><Camera size={13} /><span>Camera movement</span><span className="clip-duration">Frames 1–250</span></button><span className="track-hold">Hold</span></div>
        <div className="track-lane">{shot ? <button type="button" className="track-clip draft-clip" style={{ width: `${(shotEndFrame(shot, fps) - 1) / (frameEnd - 1) * 100}%` }} onClick={onShotSelect}><span>{shot.name}</span><span className="clip-duration">{shot.settings.duration} s</span></button> : <div className="track-scene">Barcelona Pavilion <span>·</span> Midday</div>}</div>
        <div className="playhead" style={{ left: `${position}%` }} aria-hidden="true"><span /></div>
        <input aria-label="Timeline frame" aria-valuetext={`Frame ${frame}, ${formatTimecode(frame)}`} className="timeline-scrubber" type="range" min={FRAME_START} max={frameEnd} step={1} value={frame} onChange={event => seek(Number(event.target.value))} />
      </div>
    </div>
    <div className="timeline-footer"><span>{shot ? `Draft: ${shot.subjectName} · ${shot.marks.length} editable marks` : 'Camera animation · frames 1–250'}</span><span>Frame <output aria-label="Current frame">{frame}</output> / {frameEnd}</span></div>
  </GlassPanel>;
}
