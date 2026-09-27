'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowLeftToLine, ArrowRightToLine, AudioWaveform, Copy, Minus, Music, Pause, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { Button, GlassPanel, SegmentedControl } from '@/components/ui/primitives';
import type { AudioClip, AudioOption } from '@/contracts';
import { retimeClip, slipClip, updateAudioClip, type AudioPatch } from './model';
import styles from './audio.module.css';

export type AudioPanelProps = {
  clips: AudioClip[]; selectedId: string | null; seconds: number; fps: number;
  onSelect: (id: string | null) => void; onClose: () => void;
  /** Verifies the source with the server and places it at the playhead; rejects with a readable message. */
  onAdd: (option: AudioOption) => Promise<void>;
  onChange: (clip: AudioClip) => void; onRemove: (id: string) => void; onDuplicate: (clip: AudioClip) => void;
};

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** Search Jamendo music or Freesound effects, preview, add at the playhead, and edit placed clips. */
export function AudioPanel(props: AudioPanelProps) {
  const selected = props.clips.find(clip => clip.id === props.selectedId);
  return <GlassPanel className={`${styles.panel} audio-panel`} density="dense" role="dialog" aria-label="Timeline audio">
    <div className={styles.header}>
      {selected ? <Button size="sm" variant="ghost" iconOnly aria-label="Back to audio search" onClick={() => props.onSelect(null)}><ArrowLeft size={16} /></Button> : <Music size={16} />}
      <h2>{selected ? selected.source.name : 'Add audio'}</h2>
      <Button size="sm" variant="ghost" iconOnly aria-label="Close audio panel" onClick={props.onClose}><X size={16} /></Button>
    </div>
    {selected ? <ClipEditor key={selected.id} clip={selected} {...props} /> : <AudioSearch {...props} />}
  </GlassPanel>;
}

/** Seconds field that commits on blur/Enter, with one-frame nudges either side. */
function TimeStepper({ label, value, fps, min = 0, onCommit }: { label: string; value: number; fps: number; min?: number; onCommit: (value: number) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(value.toFixed(2));
  useEffect(() => setDraft(value.toFixed(2)), [value]);
  const commit = (next: number) => { if (Number.isFinite(next) && Math.abs(next - value) > 1e-6) onCommit(Math.max(min, next)); else setDraft(value.toFixed(2)); };
  return <div className={styles.stepper}>
    <label htmlFor={id}>{label}</label>
    <div>
      <Button size="sm" variant="ghost" iconOnly aria-label={`${label}: one frame earlier`} onClick={() => commit(value - 1 / fps)}><Minus size={13} /></Button>
      <input id={id} className="text-input" inputMode="decimal" value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => commit(Number(draft))} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value.toFixed(2)); event.currentTarget.blur(); } }} />
      <span className={styles.unit}>s</span>
      <Button size="sm" variant="ghost" iconOnly aria-label={`${label}: one frame later`} onClick={() => commit(value + 1 / fps)}><Plus size={13} /></Button>
    </div>
  </div>;
}

function ClipEditor({ clip, seconds, fps, onChange, onRemove, onDuplicate }: AudioPanelProps & { clip: AudioClip }) {
  const [error, setError] = useState('');
  const ids = { slip: useId(), volume: useId(), fadeIn: useId(), fadeOut: useId() };
  const end = clip.start + clip.duration;
  const spare = clip.source.duration - clip.duration;
  const run = (build: () => AudioClip) => { try { onChange(build()); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The clip could not be changed.'); } };
  const apply = (patch: AudioPatch) => run(() => updateAudioClip(clip, patch));
  const maxFade = Math.min(10, clip.duration);
  return <div className={styles.body}>
    <p className={styles.meta}><span className={clip.kind === 'music' ? styles.chipMusic : styles.chipSfx}>{clip.kind === 'music' ? 'Music' : 'Sound FX'}</span> <a href={clip.source.pageUrl} target="_blank" rel="noreferrer noopener">{clip.source.artist}</a> · <a href={clip.source.licenseUrl} target="_blank" rel="noreferrer noopener">{clip.source.license}</a></p>

    <section className={styles.group} aria-label="Position on the timeline">
      <h3>On the timeline</h3>
      <TimeStepper label="Starts at" value={clip.start} fps={fps} onCommit={value => run(() => retimeClip(clip, { mode: 'move', start: value }))} />
      <TimeStepper label="Plays for" value={clip.duration} fps={fps} min={.1} onCommit={value => run(() => retimeClip(clip, { mode: 'end', end: clip.start + value }))} />
      <p className={styles.meta}>Ends at {end.toFixed(2)} s</p>
      <div className={styles.row}>
        <Button size="sm" onClick={() => run(() => retimeClip(clip, { mode: 'move', start: seconds }))}><ArrowRightToLine size={14} />Start at playhead</Button>
        <Button size="sm" disabled={seconds <= clip.start} onClick={() => run(() => retimeClip(clip, { mode: 'end', end: seconds }))}><ArrowLeftToLine size={14} />End at playhead</Button>
      </div>
    </section>

    {spare > .05 && <section className={styles.group} aria-label="Part of the file">
      <h3>Part of the {clip.kind === 'music' ? 'song' : 'sound'}</h3>
      <div className={styles.window} aria-hidden="true"><span style={{ left: `${clip.offset / clip.source.duration * 100}%`, width: `${clip.duration / clip.source.duration * 100}%` }} /></div>
      <label className={styles.slider} htmlFor={ids.slip}>Plays {time(clip.offset)} – {time(clip.offset + clip.duration)} of {time(clip.source.duration)}
        <input id={ids.slip} type="range" min={0} max={spare} step={1 / fps} value={clip.offset} onChange={event => run(() => slipClip(clip, Number(event.target.value)))} /></label>
      <p className={styles.meta}>Slide to choose which part plays; the clip stays where it is.</p>
    </section>}

    <section className={styles.group} aria-label="Level">
      <h3>Level</h3>
      <label className={styles.slider} htmlFor={ids.volume}>Volume <output>{Math.round(clip.volume * 100)}%</output>
        <input id={ids.volume} type="range" min={0} max={100} value={Math.round(clip.volume * 100)} onChange={event => apply({ volume: Number(event.target.value) / 100 })} /></label>
      <div className={styles.pair}>
        <label className={styles.slider} htmlFor={ids.fadeIn}>Fade in <output>{clip.fadeIn.toFixed(1)} s</output>
          <input id={ids.fadeIn} type="range" min={0} max={maxFade} step={.1} value={clip.fadeIn} onChange={event => apply({ fadeIn: Math.min(Number(event.target.value), clip.duration - clip.fadeOut) })} /></label>
        <label className={styles.slider} htmlFor={ids.fadeOut}>Fade out <output>{clip.fadeOut.toFixed(1)} s</output>
          <input id={ids.fadeOut} type="range" min={0} max={maxFade} step={.1} value={clip.fadeOut} onChange={event => apply({ fadeOut: Math.min(Number(event.target.value), clip.duration - clip.fadeIn) })} /></label>
      </div>
    </section>

    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.row}>
      <Button size="sm" onClick={() => onDuplicate(clip)}><Copy size={14} />Duplicate</Button>
      <Button size="sm" variant="danger" onClick={() => onRemove(clip.id)}><Trash2 size={14} />Remove</Button>
    </div>
    <p className={styles.meta}>Tip: drag the clip on the timeline to move it, or drag its edges to trim.</p>
  </div>;
}

function AudioSearch({ clips, seconds, onAdd, onSelect }: AudioPanelProps) {
  const [kind, setKind] = useState<'music' | 'sfx'>('music');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AudioOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [previewing, setPreviewing] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const inputId = useId();
  useEffect(() => () => { player.current?.pause(); }, []);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy('search'); setError('');
    try {
      const response = await fetch(`/api/audio/search?kind=${kind}&q=${encodeURIComponent(query.trim())}`);
      const body = await response.json().catch(() => ({})) as { results?: AudioOption[]; configured?: boolean; error?: string };
      if (!response.ok || body.configured === false) throw new Error(body.error || `Search failed (${response.status}).`);
      setResults(body.results ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search failed.'); setResults(null); }
    finally { setBusy(null); }
  }
  function preview(option: AudioOption) {
    player.current?.pause();
    if (previewing === option.key) { setPreviewing(null); return; }
    const audio = new Audio(`/api/audio/${option.provider}/${option.id}/file`);
    audio.volume = .8; audio.onended = () => setPreviewing(null);
    audio.onerror = () => { setPreviewing(null); setError(`Couldn’t load a preview of “${option.name}”.`); };
    player.current = audio; setPreviewing(option.key);
    void audio.play().catch(() => setPreviewing(null));
  }
  async function add(option: AudioOption) {
    setBusy(option.key); setError('');
    try { player.current?.pause(); setPreviewing(null); await onAdd(option); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The audio could not be added.'); }
    finally { setBusy(null); }
  }
  return <div className={styles.body}>
    <SegmentedControl label="Audio type" value={kind} onChange={value => { setKind(value); setResults(null); setError(''); }} options={[{ value: 'music', label: 'Music', icon: <Music size={14} /> }, { value: 'sfx', label: 'Sound effects', icon: <AudioWaveform size={14} /> }]} />
    <form className={styles.searchRow} onSubmit={search} role="search">
      <label className="sr-only" htmlFor={inputId}>{kind === 'music' ? 'Search music' : 'Search sound effects'}</label>
      <input id={inputId} className="text-input" type="search" maxLength={80} value={query} onChange={event => setQuery(event.target.value)} placeholder={kind === 'music' ? 'e.g. epic cinematic, lo-fi, upbeat' : 'e.g. whoosh, snap, impact, rain'} />
      <Button type="submit" iconOnly aria-label="Search" loading={busy === 'search'} disabled={!query.trim()}><Search size={16} /></Button>
    </form>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {results && (results.length ? <ul className={styles.results}>{results.map(option => <li key={option.key}>
      <Button size="sm" variant="ghost" iconOnly aria-label={previewing === option.key ? `Stop preview of ${option.name}` : `Preview ${option.name}`} onClick={() => preview(option)}>{previewing === option.key ? <Pause size={15} /> : <Play size={15} />}</Button>
      <span><strong>{option.name}</strong><small>{option.artist} · {time(option.duration)} · {option.license}</small></span>
      <Button size="sm" disabled={!!busy} loading={busy === option.key} onClick={() => void add(option)} aria-label={`Add ${option.name} at the playhead`}><Plus size={14} />Add</Button>
    </li>)}</ul> : <p className={styles.meta}>No matches with a licence that allows use in a video. Try a simpler word.</p>)}
    {clips.length > 0 && <div className={styles.placed}><h3>On the timeline</h3><ul>{clips.map(clip => <li key={clip.id}><button type="button" onClick={() => onSelect(clip.id)}>{clip.kind === 'music' ? <Music size={13} /> : <AudioWaveform size={13} />}<span>{clip.source.name}</span><small>{clip.start.toFixed(1)}–{(clip.start + clip.duration).toFixed(1)} s</small></button></li>)}</ul></div>}
    <p className={styles.meta}>Adds at the playhead ({seconds.toFixed(1)} s). Music from Jamendo, effects from Freesound: free for non-commercial use, credited automatically.</p>
  </div>;
}
