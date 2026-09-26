'use client';

import { useId, useState } from 'react';
import { Button, TextField } from '@/components/ui/primitives';
import type { ActorTrack, Vector3Tuple } from '@/contracts';
import { addActorMark, MAX_ACTORS, MAX_ACTOR_MARKS, removeActorMark, updateActorMark, validateActor } from './model';
import styles from './blocking.module.css';

export type BlockingControlsProps = {
  actors: ActorTrack[]; selectedId: string | null; frame: number; fps: number;
  onSelect: (id: string) => void; onAdd: () => void; onChange: (actor: ActorTrack) => void;
  onRemove: (id: string) => void; onSeek: (seconds: number) => void;
  onPreview: () => void; onFrameSelected: () => void;
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

function ActorEditor({ actor, frame, fps, onChange, onRemove, onSeek, onPreview, onFrameSelected }: BlockingControlsProps & { actor: ActorTrack }) {
  const [markTime, setMarkTime] = useState(actor.marks[0].time);
  const [error, setError] = useState('');
  const index = Math.max(0, actor.marks.findIndex(mark => mark.time === markTime));
  const mark = actor.marks[index];
  const selectorId = useId();
  const errorId = useId();
  const seconds = (frame - 1) / fps;
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
    <Button className={styles.remove} size="sm" variant="danger" onClick={() => onRemove(actor.id)}>Remove actor</Button>
  </div>;
}
