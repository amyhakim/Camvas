'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Focus, Trash2, Undo2 } from 'lucide-react';
import { Button, TextField } from '@/components/ui/primitives';
import type { CollisionBox, CollisionLayer, CollisionOptions } from '@/contracts';
import { containsPoint, validateCollisionLayer } from './model';
import styles from './collision.module.css';

type Props = { layer?: CollisionLayer; show: boolean; isolate: boolean; onIsolate: (isolate: boolean) => void; selectedId: string; canUndo: boolean; onShow: (show: boolean) => void; onSelect: (id: string) => void; onFrame: (id: string) => void; onChange: (layer: CollisionLayer) => void; onUndo: () => void; onGenerate: (options: CollisionOptions, progress: (message: string) => void) => Promise<void> };
export function CollisionControls({ layer, show, isolate, onIsolate, selectedId, canUndo, onShow, onSelect, onFrame, onChange, onUndo, onGenerate }: Props) {
  const [radius, setRadius] = useState('4'), [cellSize, setCellSize] = useState('0.5');
  const [running, setRunning] = useState(false), [progress, setProgress] = useState(''), [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const selected = layer?.boxes.find(b => b.id === selectedId) ?? layer?.boxes[0];
  async function generate() {
    setRunning(true); setError(''); setProgress('Preparing splat data…');
    try { await onGenerate({ radius: Number(radius), cellSize: Number(cellSize) }, message => { if (alive.current) setProgress(message); }); }
    catch (error) { if (alive.current) setError(error instanceof Error ? error.message : 'Could not generate boxes. Try again.'); }
    finally { if (alive.current) { setRunning(false); setProgress(''); } }
  }
  const generation = <div className={styles.editor}>
    <p>Generate boxes around your current view, then check them against the room. Amber boxes mark estimated occupied space; green outlines the review area.</p>
    <div className={styles.pair}>
      <TextField id="collision-radius" label="Review radius" type="number" min={1} max={12} step={1} value={radius} onChange={e => setRadius(e.target.value)} />
      <TextField id="collision-cell" label="Cell size" type="number" min={.1} max={2} step={.1} value={cellSize} onChange={e => setCellSize(e.target.value)} />
    </div>
    <p>Distances use scene units. Smaller cells preserve more detail. Generating again replaces these boxes; Undo restores them.</p>
    <Button size="sm" onClick={() => void generate()} disabled={running}>{running ? 'Generating boxes…' : layer ? 'Regenerate around view' : 'Generate around view'}</Button>
  </div>;
  return <section className={styles.root} aria-label="Splat collision boxes" aria-busy={running}>
    <h3><Box size={16} aria-hidden="true" />Collision boxes</h3>
    {!layer && generation}
    {running && <p role="status">{progress}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {layer && <>
      <p role="status">{layer.boxes.length} boxes · {layer.reviewed ? 'Reviewed for this area' : 'Needs review'} · {layer.sampleCount.toLocaleString()} splat samples</p>
      <label className={styles.toggle}><input type="checkbox" checked={show} onChange={e => onShow(e.target.checked)} />Show collision boxes</label>
      <label className={styles.toggle}><input type="checkbox" checked={isolate} onChange={e => onIsolate(e.target.checked)} />Show only selected box</label>
      {selected && <>
        <label className={styles.field}>Review box<select value={selected.id} onChange={e => { onSelect(e.target.value); onShow(true); }}>{layer.boxes.map((b, i) => <option value={b.id} key={b.id}>Box {i + 1}</option>)}</select></label>
        <div className={styles.actions}><Button size="sm" onClick={() => { onSelect(selected.id); onShow(true); onFrame(selected.id); }}><Focus size={14} />Frame box</Button><Button size="sm" variant="ghost" onClick={() => onChange({ ...layer, reviewed: false, boxes: layer.boxes.filter(b => b.id !== selected.id) })}><Trash2 size={14} />Remove box</Button></div>
        <details><summary>Adjust box bounds</summary><BoxEditor key={`${selected.id}:${JSON.stringify(selected)}`} box={selected} layer={layer} onChange={onChange} /></details>
      </>}
      <p>Check walls and open passages. Coarse samples can miss surfaces or fill doorways; unboxed space is not proof of clearance.</p>
      <Button size="sm" variant={layer.reviewed ? 'ghost' : 'primary'} disabled={!layer.boxes.length || running} onClick={() => onChange({ ...layer, reviewed: !layer.reviewed })}>{layer.reviewed ? 'Return to review' : 'Use reviewed boxes'}</Button>
      <details><summary>Generation settings</summary>{generation}</details>
      <p>Saved with this project, not shared in the room. CinemaTraj stays inside the green review area.</p>
    </>}
    <Button size="sm" variant="ghost" disabled={!canUndo || running} onClick={onUndo}><Undo2 size={14} />Undo change</Button>
  </section>;
}
function BoxEditor({ box, layer, onChange }: { box: CollisionBox; layer: CollisionLayer; onChange: (layer: CollisionLayer) => void }) {
  const [min, setMin] = useState(box.min.map(String)), [max, setMax] = useState(box.max.map(String)), [error, setError] = useState('');
  function save() {
    try {
      const next = { ...box, min: min.map(Number), max: max.map(Number) } as CollisionBox;
      if ([...min, ...max].some(v => !v.trim()) || !containsPoint(layer.region, next.min) || !containsPoint(layer.region, next.max)) throw new Error('Keep the box inside the green review area.');
      const edited = validateCollisionLayer({ ...layer, reviewed: false, boxes: layer.boxes.map(b => b.id === box.id ? next : b) });
      onChange(edited); setError('');
    } catch (error) { setError(error instanceof Error ? error.message : 'Use valid bounds.'); }
  }
  return <div className={styles.editor}>{['X', 'Y', 'Z'].map((axis, i) => <div className={styles.pair} key={axis}><TextField id={`collision-min-${axis}`} label={`${axis} min`} type="number" step={.1} value={min[i]} onChange={e => setMin(min.map((v, j) => i === j ? e.target.value : v))} /><TextField id={`collision-max-${axis}`} label={`${axis} max`} type="number" step={.1} value={max[i]} onChange={e => setMax(max.map((v, j) => i === j ? e.target.value : v))} /></div>)}<Button size="sm" onClick={save}>Apply bounds</Button>{error && <p role="alert" className={styles.error}>{error}</p>}</div>;
}
