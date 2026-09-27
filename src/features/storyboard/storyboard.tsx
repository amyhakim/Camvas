'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Copy, Download, Film, Play, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import type { CameraShot, StoryboardShot } from '@/contracts';
import { MAX_STORYBOARD_SHOTS, moveShot, panelKey, saveShot } from './model';
import { contactSheet, downloadBlob } from './export';
import styles from './storyboard.module.css';

export function Storyboard({ open, onClose, shots, draft, editingId, draftSceneStart, problem, panelLens, ready, sceneKey, name, subjects, selectedId, onChange, onEdit, onPreview, onGenerate, onCapture, onRecord }: {
  open: boolean; onClose: () => void; shots: StoryboardShot[]; draft: CameraShot | null; editingId: string | null;
  draftSceneStart: number; problem: string; panelLens: (shot: StoryboardShot) => number;
  ready: boolean; sceneKey: string; name: string; subjects: { id: string; name: string }[]; selectedId: string | null;
  onChange: (shots: StoryboardShot[]) => void; onEdit: (shot: StoryboardShot) => void;
  onPreview: (id?: string) => void; onGenerate: (id: string) => void; onRecord: () => void;
  onCapture: (shot: StoryboardShot, signal: AbortSignal) => Promise<string>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [subjectId, setSubjectId] = useState('');
  const [images, setImages] = useState<Record<string, { key: string; image: string }>>({});
  const imagesRef = useRef(images); imagesRef.current = images;
  const capture = useRef(onCapture); capture.current = onCapture;
  const shotsRef = useRef(shots); shotsRef.current = shots;
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [retry, setRetry] = useState(0);
  const renderKey = useMemo(() => JSON.stringify(shots.map(shot => [shot.id, panelKey(shot, sceneKey)])), [shots, sceneKey]);
  const effectiveSubject = subjects.find(item => item.id === subjectId)?.id ?? subjects.find(item => item.id === selectedId)?.id ?? subjects[0]?.id ?? '';
  useEffect(() => { if (open && !dialog.current?.open) dialog.current?.showModal(); else if (!open) dialog.current?.close(); }, [open]);
  useEffect(() => {
    if (!open || !ready) return;
    const controller = new AbortController();
    const pending = shotsRef.current.filter(shot => imagesRef.current[shot.id]?.key !== panelKey(shot, sceneKey));
    if (!pending.length) { setCapturing(false); return; }
    setCapturing(true); setError('');
    void (async () => {
      try {
        for (const shot of pending) {
          const image = await capture.current(shot, controller.signal);
          if (controller.signal.aborted) return;
          setImages(previous => ({ ...previous, [shot.id]: { key: panelKey(shot, sceneKey), image } }));
        }
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not capture panels.'); }
      finally { if (!controller.signal.aborted) setCapturing(false); }
    })();
    return () => controller.abort();
  }, [open, ready, renderKey, sceneKey, retry]);
  const complete = shots.length > 0 && shots.every(shot => images[shot.id]?.key === panelKey(shot, sceneKey));
  function update(id: string, patch: Partial<StoryboardShot>) { onChange(shots.map(shot => shot.id === id ? { ...shot, ...patch } : shot)); }
  async function exportSheet() {
    setExporting(true); setError('');
    try { downloadBlob(await contactSheet(name, shots, shots.map(shot => images[shot.id].image), shots.map(panelLens)), 'storyboard.png'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Export failed.'); }
    finally { setExporting(false); }
  }
  return <dialog className={styles.dialog} ref={dialog} aria-label="Storyboard" onClose={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <header className={styles.header}><div><span className={styles.eyebrow}>Scene coverage</span><h2>Storyboard</h2><p>{shots.length} / {MAX_STORYBOARD_SHOTS} shots · Shared actors and blocking</p></div><Button variant="ghost" iconOnly aria-label="Close storyboard" onClick={onClose}><X size={20} /></Button></header>
    <div className={styles.toolbar}>
      <label>Subject<select aria-label="Storyboard subject" value={effectiveSubject} onChange={event => setSubjectId(event.target.value)}>{!subjects.length && <option value="">Select a subject</option>}{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
      <Button onClick={() => onGenerate(effectiveSubject)} disabled={!ready || !effectiveSubject || shots.length > MAX_STORYBOARD_SHOTS - 3}><Camera size={16} />Generate coverage</Button>
      <Button onClick={() => draft && onChange(saveShot(shots, draft, `shot:${crypto.randomUUID()}`, draftSceneStart))} disabled={!draft || shots.length >= MAX_STORYBOARD_SHOTS}>Save draft as shot</Button>
      {editingId && shots.some(shot => shot.id === editingId) && <Button disabled={!draft} onClick={() => { if (draft) update(editingId, { camera: structuredClone(draft), sceneStart: draftSceneStart, panelTime: Math.min(shots.find(shot => shot.id === editingId)!.panelTime, draft.settings.duration) }); }}>Update edited shot</Button>}
    </div>
    <p className={styles.help}>Generate wide, medium, and close-up angles, or save your camera draft. Edit a saved camera in the viewer, then use Update edited shot to keep those changes. Scene start chooses when the shared action begins; panel time chooses a still within the shot.</p>
    <div className={styles.actions}><Button disabled={!shots.length} onClick={() => onPreview()}><Play size={16} />Play sequence</Button><Button disabled={!complete || exporting} onClick={exportSheet}><Download size={16} />{exporting ? 'Exporting…' : 'Export contact sheet'}</Button><Button disabled={!shots.length || !ready || capturing} onClick={onRecord}><Film size={16} />Record silent video</Button><span role="status">{capturing ? 'Rendering panels…' : ''}</span></div>
    {problem && <p role="alert" className={styles.error}>{problem}</p>}
    {error && <div role="alert" className={styles.error}>{error}<Button size="sm" onClick={() => setRetry(value => value + 1)}>Retry panels</Button></div>}
    {!shots.length ? <div className={styles.empty}><Film size={36} /><h3>Build the scene one shot at a time</h3><p>Choose an actor or object and generate three camera angles. Your saved shots appear here in cut order.</p></div> : <ol className={styles.grid}>{shots.map((shot, index) => {
      const image = images[shot.id]?.key === panelKey(shot, sceneKey) ? images[shot.id].image : null;
      return <li key={shot.id} className={styles.card}>
        <button className={styles.preview} aria-label={`Preview ${shot.name}`} onClick={() => onPreview(shot.id)}>{image ? <img src={image} width={640} height={360} alt={`${shot.name}: ${shot.camera.subjectName}`} /> : <span>{ready ? 'Rendering panel…' : 'Waiting for scene…'}</span>}<b>{index + 1}</b></button>
        <div className={styles.details}><label className={styles.name}>Shot name<input aria-label={`Shot ${index + 1} name`} maxLength={100} value={shot.name} onChange={event => update(shot.id, { name: event.target.value || `Shot ${index + 1}` })} /></label>
          <p>{shot.camera.subjectName} · {Math.round(panelLens(shot) * 10) / 10} mm at panel · {shot.camera.settings.duration} s</p>
          <div className={styles.timing}><label>Scene start · s<input aria-label={`Shot ${index + 1} scene start`} type="number" min={0} max={120} step={.1} value={shot.sceneStart} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) update(shot.id, { sceneStart: Math.max(0, Math.min(120, value)) }); }} /></label><label>Panel time · s<input aria-label={`Shot ${index + 1} panel time`} type="number" min={0} max={shot.camera.settings.duration} step={.1} value={shot.panelTime} onChange={event => { const value = event.target.valueAsNumber; if (Number.isFinite(value)) update(shot.id, { panelTime: Math.max(0, Math.min(shot.camera.settings.duration, value)) }); }} /></label></div>
          <label>Action / dialogue<textarea aria-label={`Shot ${index + 1} notes`} maxLength={2000} rows={2} value={shot.notes} placeholder="What happens in this shot?" onChange={event => update(shot.id, { notes: event.target.value })} /></label>
          <div className={styles.cardActions}><Button size="sm" onClick={() => onEdit(shot)}>Edit camera</Button><Button size="sm" iconOnly aria-label={`Move ${shot.name} earlier`} disabled={index === 0} onClick={() => onChange(moveShot(shots, shot.id, -1))}><ArrowUp size={15} /></Button><Button size="sm" iconOnly aria-label={`Move ${shot.name} later`} disabled={index === shots.length - 1} onClick={() => onChange(moveShot(shots, shot.id, 1))}><ArrowDown size={15} /></Button><Button size="sm" iconOnly aria-label={`Duplicate ${shot.name}`} disabled={shots.length >= MAX_STORYBOARD_SHOTS} onClick={() => onChange([...shots.slice(0, index + 1), { ...structuredClone(shot), id: `shot:${crypto.randomUUID()}`, name: `${shot.name.slice(0, 95)} copy` }, ...shots.slice(index + 1)])}><Copy size={15} /></Button><Button size="sm" iconOnly aria-label={`Delete ${shot.name}`} onClick={() => onChange(shots.filter(item => item.id !== shot.id))}><Trash2 size={15} /></Button></div>
        </div>
      </li>;
    })}</ol>}
  </dialog>;
}
