'use client';

import { Fragment } from 'react';
import { Camera, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Film, Pause, Play } from 'lucide-react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import type { TimelineTrack } from '@/contracts';
import { clampFrame, clipLayout, formatTimecode, framePosition, playbackFrame, rulerLabels } from './model';
import styles from './timeline.module.css';

export type TimelineProps = {
  tracks: TimelineTrack[];
  frame: number;
  frameStart: number;
  frameEnd: number;
  fps: number;
  playing: boolean;
  onFrameChange: (frame: number) => void;
  onPlayChange: (playing: boolean) => void;
  onTrackSelect: (id: string) => void;
  subtitle?: string;
  footerText?: string;
};

export function Timeline({ tracks, frame, frameStart, frameEnd, fps, playing, onFrameChange, onPlayChange, onTrackSelect, subtitle, footerText }: TimelineProps) {
  function seek(next: number) {
    onPlayChange(false);
    onFrameChange(clampFrame(next, frameStart, frameEnd));
  }

  function togglePlayback() {
    const next = playbackFrame(frame, frameStart, frameEnd, playing);
    if (next !== frame) onFrameChange(next);
    onPlayChange(!playing);
  }

  return <GlassPanel density="dense" className={`${styles.root} timeline`} role="region" aria-label="Scene timeline">
    <div className="timeline-toolbar">
      <div className="timeline-title"><Film size={16} /><h2>Timeline</h2>{subtitle && <span className="subtle">{subtitle}</span>}</div>
      <div className="transport">
        <Button variant="ghost" size="sm" iconOnly aria-label="Go to first frame" onClick={() => seek(frameStart)}><ChevronFirst size={17} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Previous frame" onClick={() => seek(frame - 1)} disabled={frame === frameStart}><ChevronLeft size={17} /></Button>
        <Button variant="primary" size="sm" iconOnly aria-label={playing ? 'Pause timeline' : 'Play timeline'} onClick={togglePlayback}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Next frame" onClick={() => seek(frame + 1)} disabled={frame === frameEnd}><ChevronRight size={17} /></Button>
        <Button variant="ghost" size="sm" iconOnly aria-label="Go to last frame" onClick={() => seek(frameEnd)}><ChevronLast size={17} /></Button>
      </div>
      <div className="timeline-readout"><output aria-label="Current timecode">{formatTimecode(frame, frameStart, fps)}</output><span>{fps} fps</span></div>
    </div>
    <div className="timeline-grid">
      <div className="track-labels">
        <span className="track-heading">TRACKS</span>
        {tracks.map(track => {
          const Icon = track.kind === 'camera' ? Camera : Film;
          const label = <><Icon size={15} /><span>{track.label}</span></>;
          return track.selectable
            ? <button key={track.id} type="button" onClick={() => onTrackSelect(track.id)}>{label}</button>
            : <div key={track.id}>{label}</div>;
        })}
      </div>
      <div className="track-area">
        <div className="time-ruler" aria-hidden="true">{rulerLabels(frameStart, frameEnd, fps).map((label, index) => <span key={index}>{label}</span>)}</div>
        {tracks.map(track => {
          const className = track.kind === 'scene' ? 'track-scene' : `track-clip${track.clip.draft ? ' draft-clip' : ''}`;
          const content = track.kind === 'scene'
            ? track.clip.label.split(' · ').map((part, index) => <Fragment key={index}>{index > 0 && <span>·</span>}{part}</Fragment>)
            : <>{!track.clip.draft && <Camera size={13} />}<span>{track.clip.label}</span>{track.clip.detail && <span className="clip-duration">{track.clip.detail}</span>}</>;
          return <div className="track-lane" key={track.id}>
            {track.selectable
              ? <button type="button" className={className} style={clipLayout(track.clip, frameStart, frameEnd)} onClick={() => onTrackSelect(track.id)}>{content}</button>
              : <div className={className} style={clipLayout(track.clip, frameStart, frameEnd)}>{content}</div>}
            {track.hold && <span className="track-hold">Hold</span>}
          </div>;
        })}
        <div className="playhead" style={{ left: `${framePosition(frame, frameStart, frameEnd)}%` }} aria-hidden="true"><span /></div>
        <input aria-label="Timeline frame" aria-valuetext={`Frame ${frame}, ${formatTimecode(frame, frameStart, fps)}`} className="timeline-scrubber" type="range" min={frameStart} max={frameEnd} step={1} value={frame} onChange={event => seek(Number(event.target.value))} />
      </div>
    </div>
    <div className="timeline-footer"><span>{footerText}</span><span>Frame <output aria-label="Current frame">{frame}</output> / {frameEnd}</span></div>
  </GlassPanel>;
}
