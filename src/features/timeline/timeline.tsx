'use client';

import { Fragment } from 'react';
import { AudioWaveform, Camera, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Film, Music, Pause, Play, UserRound } from 'lucide-react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import type { TimelineClipChange, TimelineTrack } from '@/contracts';
import { ClipLane } from './clip-lane';
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
  /** Opens the audio panel; omitted when audio is unavailable. */
  onAddAudio?: () => void;
  audioOpen?: boolean;
  /** Multi-clip lanes (audio): drag to move/trim, click to select, Delete to remove. */
  onClipChange?: (trackId: string, clipId: string, change: TimelineClipChange) => void;
  onClipSelect?: (trackId: string, clipId: string) => void;
  onClipDelete?: (trackId: string, clipId: string) => void;
};

const ICONS = { camera: Camera, actor: UserRound, music: Music, sfx: AudioWaveform, scene: Film } as const;

export function Timeline({ tracks, frame, frameStart, frameEnd, fps, playing, onFrameChange, onPlayChange, onTrackSelect, subtitle, footerText, onAddAudio, audioOpen, onClipChange, onClipSelect, onClipDelete }: TimelineProps) {
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
      <div className="timeline-readout">{onAddAudio && <Button size="sm" variant="ghost" aria-pressed={!!audioOpen} aria-label="Music and sound effects" title="Add music and sound effects" onClick={onAddAudio}><Music size={15} />Audio</Button>}<output aria-label="Current timecode">{formatTimecode(frame, frameStart, fps)}</output><span>{fps} fps</span></div>
    </div>
    <div className="timeline-grid">
      <div className="track-labels">
        <span className="track-heading">TRACKS</span>
        {tracks.map(track => {
          const Icon = ICONS[track.kind];
          const label = <><Icon size={15} /><span>{track.label}</span></>;
          return track.selectable
            ? <button key={track.id} type="button" onClick={() => onTrackSelect(track.id)}>{label}</button>
            : <div key={track.id}>{label}</div>;
        })}
      </div>
      <div className="track-area">
        <div className="time-ruler" aria-hidden="true">{rulerLabels(frameStart, frameEnd, fps).map((label, index) => <span key={index}>{label}</span>)}</div>
        {tracks.map(track => {
          if (track.clips) return <ClipLane key={track.id} track={track} frameStart={frameStart} frameEnd={frameEnd} fps={fps} onClipChange={onClipChange} onClipSelect={onClipSelect} onClipDelete={onClipDelete} />;
          const className = track.kind === 'scene' ? 'track-scene' : `track-clip${track.clip.draft ? ' draft-clip' : ''}${track.kind === 'actor' ? ' actor-clip' : ''}${track.kind === 'music' ? ' audio-clip' : ''}${track.kind === 'sfx' ? ' audio-clip sfx-clip' : ''}`;
          const ClipIcon = ICONS[track.kind];
          const content = track.kind === 'scene'
            ? track.clip.label.split(' · ').map((part, index) => <Fragment key={index}>{index > 0 && <span>·</span>}{part}</Fragment>)
            : <>{!track.clip.draft && <ClipIcon size={13} />}<span>{track.clip.label}</span>{track.clip.detail && <span className="clip-duration">{track.clip.detail}</span>}</>;
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
