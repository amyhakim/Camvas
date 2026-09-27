'use client';
import { useEffect, useRef, useState } from 'react';
import type { ProjectDocument, ViewportHandle } from '@/contracts';
import type { SemanticLayer } from '@/contracts/semantics';
import { semanticRevision, validateSemanticLayer } from './model';
import type { BackgroundLabels } from './use-background-labels';
import styles from './semantics.module.css';

export function SemanticControls({ project, ready, viewport, job, onCommit, onClose, canUndo, onUndo, onReviewCollision }: {
  project: ProjectDocument; ready: boolean; viewport: React.RefObject<ViewportHandle | null>;
  onReviewCollision?: () => void; job: BackgroundLabels; onCommit: (project: ProjectDocument) => void; onClose: () => void; canUndo: boolean; onUndo: () => void;
}) {
  const scrollArea = useRef<HTMLDivElement>(null);
  const { status, busy, error, views, generate, cancel } = job;
  const [selected, setSelected] = useState('');
  const layer = project.semantics;
  const stale = !!layer && layer.revision !== semanticRevision(project);
  useEffect(() => () => { viewport.current?.highlightSemantic([]); }, [viewport]);
  useEffect(() => { setSelected(layer?.regions[0]?.id ?? ''); }, [layer?.revision, !!layer]);
  useEffect(() => { const region = stale ? undefined : layer?.regions.find(r => r.id === selected); viewport.current?.highlightSemantic(region?.entityIds ?? [], region); }, [layer, selected, stale, viewport]);
  const commit = (next: SemanticLayer) => onCommit({ ...project, semantics: validateSemanticLayer(next) });
  return <aside className={styles.panel} aria-label="Semantic labels">
    <div className={styles.toolbar}>
    <header><div><span>BLOCKOUT MAP</span><h2>Semantic labels</h2></div><button aria-label="Close semantic labels" onClick={onClose}>×</button></header>
    {layer && <p>{layer.regions.length} labels · {layer.regions.filter(r => r.reviewed).length} reviewed</p>}
    <div className={styles.actions}>{!busy && (layer || job.attempted) && <button disabled={!ready} onClick={() => void generate()}>{layer ? 'Regenerate labels' : 'Retry labeling'}</button>}{layer && <button onClick={() => scrollArea.current?.scrollTo({ top: 0, behavior: 'smooth' })}>Show labels</button>}{canUndo && <button disabled={busy} onClick={() => { onUndo(); setSelected(''); scrollArea.current?.scrollTo({ top: 0 }); }}>Undo</button>}{busy && <button onClick={cancel}>Cancel labeling</button>}</div>
    </div>
    <div ref={scrollArea} className={styles.scrollArea} aria-label="Label list and evidence">
    <p>Select a label to highlight its measured extent. Confidence is an AI estimate, not collision clearance.</p>
    <p>Labels are generated in the background from scene images and object bounds sent to AI. Closing this panel does not stop labeling.</p>
    {onReviewCollision && <><p>{project.collision ? `${project.collision.boxes.length} navigation boxes · ${project.collision.reviewed ? 'reviewed' : 'review required'}` : 'Navigation boxes are prepared separately from visual blocks.'}</p><button onClick={onReviewCollision}>Review navigation boxes</button></>}
    {status && <p role="status">{status}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {stale && <p role="status">Scene placement changed. Regenerate labels before using these regions.</p>}
    <div className={styles.regions}>{layer?.regions.map(region => <section key={region.id} className={selected === region.id ? styles.selected : ''}>
      <button className={styles.region} aria-pressed={selected === region.id} disabled={busy || stale} onClick={() => setSelected(selected === region.id ? '' : region.id)}><strong>{region.label}</strong><span>{Math.round(region.confidence * 100)}% · {region.entityIds.length} source objects</span></button>
      {selected === region.id && <div className={styles.edit}>
        <label>Name<input aria-label="Region name" maxLength={80} key={region.id + region.label} defaultValue={region.label} disabled={busy} onBlur={event => { const label = event.target.value.trim(); if (label && label !== region.label) commit({ ...layer, regions: layer.regions.map(r => r.id === region.id ? { ...r, label, reviewed: false } : r) }); }} /></label>
        <p>{region.evidence}</p><small>{region.category} · Evidence: {region.viewIds.join(', ')}</small>
        <label><input type="checkbox" checked={region.reviewed} disabled={busy || stale} onChange={event => commit({ ...layer, regions: layer.regions.map(r => r.id === region.id ? { ...r, reviewed: event.target.checked } : r) })} />Reviewed label and extent</label>
        <button disabled={busy} onClick={() => commit({ ...layer, regions: layer.regions.filter(r => r.id !== region.id) })}>Remove label</button>
      </div>}
    </section>)}</div>
    {views.length > 0 && <details><summary>Captured evidence</summary>{views.map(view => <figure key={view.id}><img src={view.image} alt={`Scene evidence ${view.id}`} /><figcaption>{view.id}</figcaption></figure>)}</details>}
    </div>
  </aside>;
}
