'use client';

import { useEffect, useId, useState } from 'react';
import { Button, TextField } from '@/components/ui/primitives';
import type { ActorMotion, ActorRigInfo, ActorTrack, MotionSource, Vector3Tuple } from '@/contracts';
import { addActorMark, MAX_ACTORS, MAX_ACTOR_MARKS, removeActorMark, updateActorMark, validateActor } from './model';
import { defaultMotionDuration, MOTION_PRESETS, motionLabel, placeMotion } from './motions';
import styles from './blocking.module.css';

export type BlockingControlsProps = {
  actors: ActorTrack[]; selectedId: string | null; frame: number; fps: number;
  onSelect: (id: string) => void; onAdd: () => void; onChange: (actor: ActorTrack) => void;
  onRemove: (id: string) => void; onSeek: (seconds: number) => void;
  onPreview: () => void; onFrameSelected: () => void;
  /** Body status reported by the viewport, keyed by actor ID. */
  rigs?: Record<string, ActorRigInfo>;
  onUseMannequin?: (id: string) => void;
};

/** Fields commit on blur or Enter so partial numeric input never changes scene data. */
function EditField({ label, value, numeric = false, min, max, step, onCommit }: {
  label: string; value: string | number; numeric?: boolean; min?: number; max?: number; step?: number;
  onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  return <TextField id={id} label={label} type={numeric ? 'number' : 'text'} min={min} max={max} step={step} value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={() => { if (draft !== String(value)) onCommit(draft); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

export function BlockingControls(props: BlockingControlsProps) {
  const actor = props.actors.find(item => item.id === props.selectedId);
  const selectorId = useId();
  return <div className={styles.root}>
    <div className={styles.actorRow}>
      <label className={styles.selectField} htmlFor={selectorId}>Actor<select id={selectorId} value={actor?.id ?? ''} onChange={event => props.onSelect(event.target.value)}>
        <option value="" disabled>{props.actors.length ? 'Choose an actor' : 'No actors yet'}</option>
        {props.actors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <Button onClick={props.onAdd} disabled={props.actors.length >= MAX_ACTORS}>Add actor</Button>
    </div>
    {props.actors.length >= MAX_ACTORS && <p className={styles.help}>Eight actors maximum. Remove an actor to add another.</p>}
    {actor ? <ActorEditor key={actor.id} {...props} actor={actor} /> : <p className={styles.help}>Add a proxy actor, then mark where they stand and when they move.</p>}
  </div>;
}

function ActorEditor({ actor, frame, fps, onChange, onRemove, onSeek, onPreview, onFrameSelected, rigs, onUseMannequin }: BlockingControlsProps & { actor: ActorTrack }) {
  const [markTime, setMarkTime] = useState(actor.marks[0].time);
  const [error, setError] = useState('');
  const index = Math.max(0, actor.marks.findIndex(mark => mark.time === markTime));
  const mark = actor.marks[index];
  const selectorId = useId();
  const errorId = useId();
  const seconds = (frame - 1) / fps;
  useEffect(() => {
    const current = actor.marks.find(item => Math.abs(item.time - (frame - 1) / fps) <= 1e-9);
    if (current) setMarkTime(current.time);
  }, [actor.marks, frame, fps]);
  const existing = actor.marks.some(item => item.time === seconds);
  function apply(operation: () => ActorTrack, seek?: number) {
    try {
      const next = operation(); validateActor(next); onChange(next); setError('');
      if (seek !== undefined) { setMarkTime(seek); onSeek(seek); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The actor could not be updated.'); }
  }
  function number(value: string): number {
    if (!value.trim() || !Number.isFinite(Number(value))) throw new Error('Enter a finite number, then press Enter or leave the field.');
    return Number(value);
  }
  function edit(patch: Parameters<typeof updateActorMark>[2]) {
    apply(() => updateActorMark(actor, index, patch), patch.time ?? mark.time);
  }
  return <div className={styles.editor} aria-describedby={error ? errorId : undefined}>
    <div className={styles.pair}>
      <EditField key={`name:${actor.name}`} label="Name" value={actor.name} onCommit={value => apply(() => ({ ...actor, name: value.trim() }))} />
      <EditField key={`height:${actor.height}`} label="Height · m" numeric min={.5} max={3} step={.05} value={actor.height} onCommit={value => apply(() => ({ ...actor, height: number(value) }))} />
    </div>
    <div className={styles.actions}><Button size="sm" onClick={onPreview}>Preview</Button><Button size="sm" onClick={onFrameSelected}>Frame actor</Button></div>
    {actor.model && <p className={styles.help}>Character: “<a href={actor.model.viewerUrl} target="_blank" rel="noreferrer noopener">{actor.model.name}</a>” by <a href={actor.model.authorUrl} target="_blank" rel="noreferrer noopener">{actor.model.author}</a> · <a href={actor.model.licenseUrl} target="_blank" rel="noreferrer noopener">{actor.model.license}</a>{' '}<Button size="sm" variant="ghost" onClick={() => apply(() => { const { model: _model, ...proxy } = actor; return proxy; })}>Use proxy body</Button></p>}
    <div className={styles.markHeader}><h3>Movement marks</h3><span>{actor.marks.length} / {MAX_ACTOR_MARKS}</span></div>
    <label className={styles.selectField} htmlFor={selectorId}>Mark<select id={selectorId} value={index} onChange={event => { const next = actor.marks[Number(event.target.value)]; setMarkTime(next.time); setError(''); onSeek(next.time); }}>
      {actor.marks.map((item, i) => <option key={item.time} value={i}>Mark {i + 1} · {Number(item.time.toFixed(3))} s</option>)}
    </select></label>
    <div className={styles.pair}>
      <EditField key={`time:${mark.time}`} label="Time · s" numeric min={0} max={60} step={.01} value={mark.time} onCommit={value => { try { edit({ time: number(value) }); } catch (cause) { setError((cause as Error).message); } }} />
      <EditField key={`heading:${mark.time}:${mark.heading}`} label="Heading · °" numeric step={1} value={Number((mark.heading * 180 / Math.PI).toFixed(3))} onCommit={value => { try { edit({ heading: number(value) * Math.PI / 180 }); } catch (cause) { setError((cause as Error).message); } }} />
    </div>
    <div className={styles.vector}>{(['X', 'Y', 'Z'] as const).map((axis, axisIndex) => <EditField key={`${mark.time}:${axis}:${mark.position[axisIndex]}`} label={`${axis} · m`} numeric min={-1000} max={1000} step={.1} value={mark.position[axisIndex]} onCommit={value => {
      try { const position: Vector3Tuple = [...mark.position]; position[axisIndex] = number(value); edit({ position }); }
      catch (cause) { setError((cause as Error).message); }
    }} />)}</div>
    <p className={styles.help}>Feet position · Y is up. Heading 0° faces −Z.<br />Times must stay in order and be unique.</p>
    {error && <p id={errorId} role="alert" className={styles.error}>{error}</p>}
    <div className={styles.actions}>
      <Button size="sm" disabled={!existing && actor.marks.length >= MAX_ACTOR_MARKS} onClick={() => {
        if (existing) { setMarkTime(seconds); setError(''); onSeek(seconds); }
        else apply(() => addActorMark(actor, seconds), seconds);
      }}>{existing ? 'Edit playhead mark' : 'Add mark at playhead'}</Button>
      <Button size="sm" variant="ghost" disabled={actor.marks.length <= 1} onClick={() => {
        const nextTime = actor.marks[index === 0 ? 1 : index - 1]?.time;
        apply(() => removeActorMark(actor, index), nextTime);
      }}>Remove mark</Button>
    </div>
    <MotionEditor actor={actor} seconds={seconds} rig={rigs?.[actor.id]} onChange={onChange} onSeek={onSeek} onUseMannequin={onUseMannequin} />
    <Button className={styles.remove} size="sm" variant="danger" onClick={() => onRemove(actor.id)}>Remove actor</Button>
  </div>;
}

/** Body status plus motions placed on this actor's timeline. */
function MotionEditor({ actor, seconds, rig, onChange, onSeek, onUseMannequin }: { actor: ActorTrack; seconds: number; rig?: ActorRigInfo; onChange: (actor: ActorTrack) => void; onSeek: (seconds: number) => void; onUseMannequin?: (id: string) => void }) {
  const [choice, setChoice] = useState('preset:wave');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState('');
  const selectId = useId(), durationId = useId();
  const clips = rig?.clips ?? [];
  const canPose = !rig || rig.status === 'animatable' || rig.status === 'loading';
  const source: MotionSource = choice.startsWith('clip:') ? { kind: 'clip', clip: choice.slice(5) } : { kind: 'preset', preset: choice.slice(7) };
  const natural = source.kind === 'clip' ? clips.find(clip => clip.name === source.clip)?.duration ?? 3 : defaultMotionDuration(source);
  const status = !rig ? 'Mannequin · performs every motion'
    : rig.status === 'loading' ? 'Loading character…'
    : rig.status === 'animatable' ? rig.body === 'mannequin' ? 'Mannequin · performs every motion' : `Rigged character · library motions${clips.length ? ` + ${clips.length} own clip${clips.length === 1 ? '' : 's'}` : ''}${rig.note ? `. ${rig.note}` : ''}`
    : rig.message ?? 'This character can’t be animated.';
  function add() {
    try {
      const length = duration.trim() ? Number(duration) : natural;
      if (!Number.isFinite(length)) throw new Error('Enter a duration in seconds.');
      const preset = source.kind === 'preset' ? MOTION_PRESETS.find(item => item.id === source.preset) : undefined;
      const motion: ActorMotion = { start: Math.max(0, Math.round(seconds * 1000) / 1000), duration: length, loop: source.kind === 'clip' ? true : !!preset?.loop, source };
      onChange(placeMotion(actor, motion)); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The motion could not be added.'); }
  }
  return <section className={styles.editor} aria-label="Body and motion">
    <div className={styles.markHeader}><h3>Body &amp; motion</h3><span>{(actor.motions ?? []).length} motions</span></div>
    <p className={rig && (rig.status === 'static' || rig.status === 'error') ? styles.error : styles.help} role={rig && rig.status !== 'animatable' && rig.status !== 'loading' ? 'alert' : undefined}>{status}</p>
    {rig && (rig.status === 'static' || rig.status === 'error') && actor.model && <Button size="sm" onClick={() => onUseMannequin?.(actor.id)}>Use mannequin body</Button>}
    <div className={styles.pair}>
      <label className={styles.selectField} htmlFor={selectId}>Motion<select id={selectId} value={choice} onChange={event => { setChoice(event.target.value); setDuration(''); }}>
        {canPose && (['full', 'upper'] as const).map(layer => <optgroup key={layer} label={layer === 'full' ? 'Full body' : 'Upper body (layers over walking)'}>{MOTION_PRESETS.filter(item => item.layer === layer).map(item => <option key={item.id} value={`preset:${item.id}`}>{item.label}</option>)}</optgroup>)}
        {clips.length > 0 && <optgroup label="Model’s own clips">{clips.map(clip => <option key={clip.name} value={`clip:${clip.name}`}>{clip.name} · {clip.duration.toFixed(1)} s</option>)}</optgroup>}
      </select></label>
      <TextField id={durationId} label="Duration · s" type="number" min={.2} max={60} step={.5} placeholder={natural.toFixed(1)} value={duration} onChange={event => setDuration(event.target.value)} />
    </div>
    <Button size="sm" disabled={!canPose && source.kind !== 'clip'} onClick={add}>Add motion at playhead</Button>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {(actor.motions ?? []).length > 0 && <ul className={styles.motionList}>{(actor.motions ?? []).map((motion, i) => <li key={`${motion.start}:${i}`}>
      <button type="button" onClick={() => onSeek(motion.start)}>{motionLabel(motion.source)}<small>{motion.start.toFixed(1)}–{(motion.start + motion.duration).toFixed(1)} s{motion.loop ? ' · loop' : ''}</small></button>
      <Button size="sm" variant="ghost" aria-label={`Remove ${motionLabel(motion.source)}`} onClick={() => { const motions = (actor.motions ?? []).filter((_, index) => index !== i); const { motions: _old, ...rest } = actor; onChange(motions.length ? { ...rest, motions } : rest); }}>Remove</Button>
    </li>)}</ul>}
    <p className={styles.help}>Walking and running play automatically between marks.</p>
  </section>;
}
