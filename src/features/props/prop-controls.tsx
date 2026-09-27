'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { ExternalLink, Search, UserRound, Package } from 'lucide-react';
import { Button, TextField } from '@/components/ui/primitives';
import type { PropShape, SceneProp, Vector3Tuple } from '@/contracts';
import { MAX_PROPS, MAX_PROP_SIZE, MIN_PROP_SIZE, PROP_SHAPES, propLabel, updateProp, type PropPatch } from './model';
import styles from './props.module.css';

type SearchResult = { uid: string; name: string; author: string; license: string; faces: number; megabytes: number; thumbnail?: string; viewerUrl: string; rigged?: boolean; animations?: number };
export type PropControlsProps = {
  props: SceneProp[]; selectedId: string | null; canAddActor: boolean; actorNames?: Record<string, string>;
  onSelect: (id: string) => void; onAddPrimitive: (shape: PropShape) => void;
  /** Resolves once the model is verified and added; rejects with a readable message. */
  onAddModel: (uid: string, as: 'prop' | 'actor' | 'replace') => Promise<void>;
  /** The selected character, if any: search results can replace its model instead of adding a new actor. */
  characterTarget?: { id: string; name: string } | null;
  onChange: (prop: SceneProp) => void; onRemove: (id: string) => void; onDetach?: (id: string) => void; onFrameSelected: () => void;
};

const DEG = 180 / Math.PI;

/** Fields commit on blur or Enter so partial numeric input never changes scene data. */
function EditField({ label, value, numeric = false, min, max, step, onCommit }: { label: string; value: string | number; numeric?: boolean; min?: number; max?: number; step?: number; onCommit: (value: string) => void }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));
  return <TextField id={id} label={label} type={numeric ? 'number' : 'text'} min={min} max={max} step={step} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== String(value)) onCommit(draft); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />;
}

export function PropControls(props: PropControlsProps) {
  const selected = props.props.find(item => item.id === props.selectedId);
  const selectorId = useId(), shapeId = useId();
  const [shape, setShape] = useState<PropShape>('box');
  return <div className={styles.root}>
    <div className={styles.row}>
      <label className={styles.selectField} htmlFor={selectorId}>Prop<select id={selectorId} value={selected?.id ?? ''} onChange={event => props.onSelect(event.target.value)}>
        <option value="" disabled>{props.props.length ? 'Choose a prop' : 'No props yet'}</option>
        {props.props.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
    </div>
    <div className={styles.row}>
      <label className={styles.selectField} htmlFor={shapeId}>Stand-in shape<select id={shapeId} value={shape} onChange={event => setShape(event.target.value as PropShape)}>{PROP_SHAPES.map(item => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
      <Button onClick={() => props.onAddPrimitive(shape)} disabled={props.props.length >= MAX_PROPS}>Add shape</Button>
    </div>
    {selected ? <PropEditor key={selected.id} prop={selected} {...props} /> : <p className={styles.help}>Add a stand-in shape here, or open Sketchfab model search from Scene objects.</p>}
  </div>;
}

function PropEditor({ prop, onChange, onRemove, onDetach, onFrameSelected, actorNames }: PropControlsProps & { prop: SceneProp }) {
  const [error, setError] = useState('');
  const colorId = useId();
  function apply(patch: PropPatch) {
    try { onChange(updateProp(prop, patch)); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The prop could not be updated.'); }
  }
  function number(value: string) {
    if (!value.trim() || !Number.isFinite(Number(value))) { setError('Enter a finite number, then press Enter or leave the field.'); return null; }
    return Number(value);
  }
  function vector(current: Vector3Tuple, index: number, value: string, scale = 1) {
    const parsed = number(value); if (parsed === null) return null;
    const next: Vector3Tuple = [...current]; next[index] = parsed * scale; return next;
  }
  return <div className={styles.editor}>
    <div className={styles.pair}>
      <EditField key={`name:${prop.name}`} label="Name" value={prop.name} onCommit={value => apply({ name: value })} />
      <EditField key={`size:${prop.size}`} label="Size · m" numeric min={MIN_PROP_SIZE} max={MAX_PROP_SIZE} step={.05} value={Number(prop.size.toFixed(3))} onCommit={value => { const size = number(value); if (size !== null) apply({ size }); }} />
    </div>
    <p className={styles.help}>{propLabel(prop)} · Size is the largest dimension; the base sits on the position.</p>
    {prop.attachment ? <div className={styles.row}><p className={styles.help}>Follows {actorNames?.[prop.attachment.actorId] ?? prop.attachment.actorId} during playback.</p><Button size="sm" variant="ghost" onClick={() => onDetach?.(prop.id)}>Stop following</Button></div> : <>
      <div className={styles.vector}>{(['X', 'Y', 'Z'] as const).map((axis, i) => <EditField key={`p${axis}:${prop.position[i]}`} label={`${axis} · m`} numeric step={.1} min={-1000} max={1000} value={Number(prop.position[i].toFixed(3))} onCommit={value => { const position = vector(prop.position, i, value); if (position) apply({ position }); }} />)}</div>
      <div className={styles.vector}>{(['Pitch', 'Yaw', 'Roll'] as const).map((axis, i) => <EditField key={`r${axis}:${prop.rotation[i]}`} label={`${axis} · °`} numeric step={5} value={Number((prop.rotation[i] * DEG).toFixed(1))} onCommit={value => { const rotation = vector(prop.rotation, i, value, 1 / DEG); if (rotation) apply({ rotation }); }} />)}</div>
    </>}
    <div className={styles.row}>
      <label className={styles.colorField} htmlFor={colorId}>Tint<input id={colorId} type="color" value={prop.color ?? '#ffffff'} onChange={event => apply({ color: event.target.value })} /></label>
      <Button size="sm" variant="ghost" disabled={!prop.color} onClick={() => apply({ color: null })}>Clear tint</Button>
      <Button size="sm" onClick={onFrameSelected}>Frame prop</Button>
    </div>
    {prop.source.kind === 'model' && <p className={styles.credit}>“<a href={prop.source.viewerUrl} target="_blank" rel="noreferrer noopener">{prop.source.name}</a>” by <a href={prop.source.authorUrl} target="_blank" rel="noreferrer noopener">{prop.source.author}</a> · <a href={prop.source.licenseUrl} target="_blank" rel="noreferrer noopener">{prop.source.license}</a></p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <Button className={styles.remove} size="sm" variant="danger" onClick={() => onRemove(prop.id)}>Remove prop</Button>
  </div>;
}

export function ModelSearch({ onAddModel, canAddActor, props: existing, characterTarget }: Pick<PropControlsProps, 'onAddModel' | 'canAddActor' | 'props' | 'characterTarget'>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [downloads, setDownloads] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [characters, setCharacters] = useState(!!characterTarget);
  const inputId = useId(), characterId = useId();
  // Picking a character switches the search to rigged characters, ready to replace its model.
  useEffect(() => { if (characterTarget) { setCharacters(true); setResults(null); } }, [characterTarget?.id]);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy('search'); setError('');
    try {
      const response = await fetch(`/api/models/search?q=${encodeURIComponent(query.trim())}${characters ? '&rigged=1' : ''}`);
      const body = await response.json().catch(() => ({})) as { results?: SearchResult[]; downloads?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || `Search failed (${response.status}).`);
      setResults(body.results ?? []); setDownloads(body.downloads !== false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Search failed.'); }
    finally { setBusy(null); }
  }
  async function add(uid: string, as: 'prop' | 'actor' | 'replace') {
    setBusy(`${uid}:${as}`); setError('');
    try { await onAddModel(uid, as); } catch (cause) { setError(cause instanceof Error ? cause.message : 'The model could not be added.'); }
    finally { setBusy(null); }
  }
  return <section className={styles.search} aria-label="Sketchfab models">
    <div className={styles.header}><h3>Sketchfab models</h3><span>Free Creative Commons</span></div>
    <form className={styles.row} onSubmit={search} role="search">
      <label className="sr-only" htmlFor={inputId}>Search Sketchfab</label>
      <input id={inputId} className="text-input" type="search" value={query} maxLength={80} placeholder="e.g. sneakers, office chair" onChange={event => setQuery(event.target.value)} />
      <Button type="submit" iconOnly aria-label="Search Sketchfab" loading={busy === 'search'} disabled={!query.trim()}><Search size={16} /></Button>
    </form>
    <label className={styles.checkRow} htmlFor={characterId}><input id={characterId} type="checkbox" checked={characters} onChange={event => { setCharacters(event.target.checked); setResults(null); }} />Characters (rigged only, so they can be animated)</label>
    {characters && characterTarget && <p className={styles.help}>Choose a model for <strong>{characterTarget.name}</strong>. Its marks and motions stay the same.</p>}
    {!downloads && <p className={styles.help}>Search works, but this server has no Sketchfab token, so models cannot be downloaded yet.</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {results && (results.length ? <ul className={styles.results}>{results.map(result => <li key={result.uid}>
      {result.thumbnail ? <img src={result.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={styles.thumb} />}
      <div><strong>{result.name}</strong><small>{result.author} · {result.license} · {result.megabytes} MB{result.rigged ? ` · rigged${result.animations ? ` · ${result.animations} clip${result.animations === 1 ? '' : 's'}` : ''}` : ''}</small>
        <span className={styles.resultActions}>
          <Button size="sm" disabled={!!busy || existing.length >= MAX_PROPS || !downloads} loading={busy === `${result.uid}:prop`} onClick={() => add(result.uid, 'prop')}><Package size={13} />Prop</Button>
          {characters && characterTarget && <Button size="sm" variant="primary" disabled={!!busy || !downloads} loading={busy === `${result.uid}:replace`} onClick={() => add(result.uid, 'replace')} title={`Replace ${characterTarget.name}'s model with this one`}><UserRound size={13} />Use for {characterTarget.name.length > 14 ? `${characterTarget.name.slice(0, 13)}…` : characterTarget.name}</Button>}
          {characters && <Button size="sm" variant="ghost" disabled={!!busy || !canAddActor || !downloads} loading={busy === `${result.uid}:actor`} onClick={() => add(result.uid, 'actor')} title="Add as a new actor you can block, animate and follow"><UserRound size={13} />{characterTarget ? 'New' : 'Character'}</Button>}
          <a href={result.viewerUrl} target="_blank" rel="noreferrer noopener" aria-label={`View ${result.name} on Sketchfab`}><ExternalLink size={13} /></a>
        </span></div>
    </li>)}</ul> : <p className={styles.help}>No free, downloadable matches under the size limit. Try a simpler word.</p>)}
  </section>;
}
