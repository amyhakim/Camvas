'use client';

import { useRef, useState } from 'react';
import { Camera, Play, Route, RotateCcw, X } from 'lucide-react';
import { Button, TextField } from '@/components/ui/primitives';
import { CAMERA_MOVE_PRESETS } from '@/vendor/blockout/camera-moves';
import { SENSORS } from '@/vendor/blockout/camera';
import type { SensorId } from '@/contracts';
import { generateShot } from './model';
import type { ActorTrack, CameraShot, ShotSettings, ShotSnapshot } from '@/contracts';
import styles from './camera.module.css';
import type { SceneEntity } from '@/contracts';

const categories = [...new Set(CAMERA_MOVE_PRESETS.map(move => move.category))];
export function ShotAuthoring({ objects, actors, canCinemaTraj, selectedId, onSelect, captureSubject, shot, onShot, onGenerate, onCinemaTraj, onPreview, onPath, showPath, onSeek, onRemove }: {
  objects: SceneEntity[]; selectedId: string | null; onSelect: (id: string) => void;
  actors: ActorTrack[]; canCinemaTraj: boolean;
  captureSubject: (id: string) => ShotSnapshot | null;
  shot: CameraShot | null; onShot: (shot: CameraShot) => void; onGenerate: (shot: CameraShot) => void; onCinemaTraj: (actorId: string, settings: ShotSettings) => Promise<void>; onPreview: () => void;
  onPath: () => void; showPath: boolean; onSeek: (seconds: number) => void; onRemove: () => void;
}) {
  const [settings, setSettings] = useState<ShotSettings>(shot?.settings || { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' });
  const [error, setError] = useState('');
  const [markIndex, setMarkIndex] = useState(0);
  const [actorId, setActorId] = useState(actors[0]?.id ?? '');
  const [running, setRunning] = useState(false);
  const popup = useRef<HTMLDialogElement>(null);
  const subject = objects.find(object => object.id === selectedId && object.type !== 'Camera');
  const preset = CAMERA_MOVE_PRESETS.find(move => move.id === settings.presetId);
  const mark = shot?.marks[Math.min(markIndex, shot.marks.length - 1)];
  const path = shot ? (shot.cinemaTraj?.positions.map(point => point.position) ?? shot.marks.map(mark => [mark.position.x, mark.position.y, mark.position.z])) : [];
  const minX = Math.min(...path.map(point => point[0]), 0), maxX = Math.max(...path.map(point => point[0]), 1);
  const minZ = Math.min(...path.map(point => point[2]), 0), maxZ = Math.max(...path.map(point => point[2]), 1);
  const map = (point: number[]) => `${20 + (point[0] - minX) / (maxX - minX || 1) * 280},${170 - (point[2] - minZ) / (maxZ - minZ || 1) * 140}`;
  function generate() {
    if (!subject) return;
    const snapshot = captureSubject(subject.id);
    if (!snapshot) { setError('Wait for the scene to load, then try again.'); return; }
    try { onGenerate(generateShot(snapshot, settings)); setMarkIndex(0); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'The move could not be generated.'); }
  }
  async function generateCinema() {
    const id = actors.some(actor => actor.id === actorId) ? actorId : actors[0]?.id;
    if (!id) return;
    setRunning(true); setError('');
    try { await onCinemaTraj(id, settings); setMarkIndex(0); popup.current?.showModal(); }
    catch (error) { setError(error instanceof Error ? error.message : 'CinemaTraj could not create a path.'); }
    finally { setRunning(false); }
  }
  function editMark(field: 'x' | 'y' | 'z' | 'pan' | 'tilt' | 'roll' | 'focalLength', value: number) {
    if (!shot || !mark || !Number.isFinite(value)) return;
    const marks = shot.marks.map((item, i) => i !== markIndex ? item : ['x','y','z'].includes(field)
      ? { ...item, position: { ...item.position, [field]: value } }
      : { ...item, [field]: field === 'focalLength' ? Math.min(300, Math.max(8, value)) : value * Math.PI / 180 });
    onShot({ ...shot, marks }); onSeek(mark.time);
  }
  return <div className={`${styles.root} shot-authoring`}>
    <label className="shot-field">Subject<select value={subject?.id || ''} onChange={event => onSelect(event.target.value)}><option value="" disabled>Select an object</option>{objects.filter(object => object.type !== 'Camera').map(object => <option key={object.id} value={object.id}>{object.name}</option>)}</select></label>
    <label className="shot-field">Camera move<select value={settings.presetId} onChange={event => setSettings({ ...settings, presetId: event.target.value })}>{categories.map(category => <optgroup label={category} key={category}>{CAMERA_MOVE_PRESETS.filter(move => move.category === category).map(move => <option key={move.id} value={move.id}>{move.name}</option>)}</optgroup>)}</select></label>
    <div className="shot-field-pair">
      <TextField id="shot-duration" label="Duration · s" type="number" min={1} max={60} step={.5} value={Number.isNaN(settings.duration) ? '' : settings.duration} onChange={event => setSettings({ ...settings, duration: event.target.valueAsNumber })} />
      <TextField id="shot-lens" label="Lens · mm" type="number" min={8} max={300} value={Number.isNaN(settings.focalLength) ? '' : settings.focalLength} onChange={event => setSettings({ ...settings, focalLength: event.target.valueAsNumber })} />
    </div>
    <details className="shot-options"><summary>Framing &amp; sensor</summary><p className="shot-description">{preset?.description}</p><div className="shot-field-pair">
      <label className="shot-field">Sensor<select value={settings.sensor} onChange={event => setSettings({ ...settings, sensor: event.target.value as SensorId })}>{Object.values(SENSORS).map(sensor => <option key={sensor.id} value={sensor.id}>{sensor.name}</option>)}</select></label>
      <label className="shot-field">Framing<select value={settings.framing} onChange={event => setSettings({ ...settings, framing: event.target.value as ShotSettings['framing'] })}><option value="wide">Wide</option><option value="full">Full</option><option value="detail">Detail</option></select></label>
    </div></details>
    {error && <p className="shot-error" role="alert">{error}</p>}
    <Button variant="primary" className="shot-generate" onClick={generate} disabled={!subject}><Camera size={15} />{shot ? 'Regenerate move' : 'Generate move'}</Button>
    <p className="shot-description">{shot ? 'Regenerating replaces the draft and its mark edits.' : 'Start angle follows your current view.'} Paths can pass through geometry.</p>
    {shot && <section className="shot-draft" aria-label="Generated camera track">
      <h3>{shot.name}</h3><p>{shot.subjectName} · {shot.settings.duration} s · {shot.marks.length} marks</p>
      <div className="shot-actions"><Button size="sm" onClick={onPreview}><Play size={14} />Preview</Button><Button size="sm" onClick={() => popup.current?.showModal()}><Route size={14} />Path</Button></div>
      {!shot.cinemaTraj && <details><summary>Edit camera marks</summary>
        <label className="shot-field">Camera mark<select value={Math.min(markIndex, shot.marks.length - 1)} onChange={event => { const i = Number(event.target.value); setMarkIndex(i); onSeek(shot.marks[i].time); }}>{shot.marks.map((mark, i) => <option key={i} value={i}>Mark {i + 1} · {mark.time.toFixed(2)} s</option>)}</select></label>
        <label className="shot-tracking"><input type="checkbox" checked={shot.trackSubject} onChange={event => onShot({ ...shot, trackSubject: event.target.checked })} />Keep subject centered</label>
        {mark && <><div className="shot-vector">{(['x','y','z'] as const).map(axis => <TextField key={axis} id={`mark-${axis}`} label={`${axis.toUpperCase()} · m`} type="number" step={.1} value={Number(mark.position[axis].toFixed(3))} onChange={event => editMark(axis, event.target.valueAsNumber)} />)}</div>
        <div className="shot-vector">{(['pan','tilt','roll'] as const).map(axis => <TextField key={axis} id={`mark-${axis}`} label={`${axis} · °`} type="number" step={1} disabled={shot.trackSubject && axis !== 'roll'} value={Number((mark[axis] * 180 / Math.PI).toFixed(1))} onChange={event => editMark(axis, event.target.valueAsNumber)} />)}</div>
        <TextField id="mark-lens" label="Mark lens · mm" type="number" min={8} max={300} value={Number(mark.focalLength.toFixed(1))} onChange={event => editMark('focalLength', event.target.valueAsNumber)} /></>}
      </details>}
      <Button variant="ghost" size="sm" onClick={onRemove}><RotateCcw size={13} />Discard draft</Button>
    </section>}
    <details className="cinematraj-option">
      <summary>CinemaTraj · actor path</summary>
      <p>{canCinemaTraj ? 'Generate a smooth CPU camera path following a blocked actor.' : 'Use the pavilion scene: this splat has no separate object bounds for collision checks.'}</p>
      <label className="shot-field">Blocked actor<select value={actors.some(actor => actor.id === actorId) ? actorId : actors[0]?.id ?? ''} onChange={event => setActorId(event.target.value)} disabled={!actors.length}>{actors.length ? actors.map(actor => <option key={actor.id} value={actor.id}>{actor.name}</option>) : <option value="">Add an actor in Blocking first</option>}</select></label>
      <Button size="sm" onClick={generateCinema} disabled={!canCinemaTraj || !actors.length || running}>{running ? 'Generating path…' : 'Generate with CinemaTraj'}</Button>
    </details>
    <dialog ref={popup} className="flight-path-popup" aria-label="Flight path" onClick={event => { if (event.target === popup.current) popup.current?.close(); }}>
      <div className="flight-path-content"><div className="flight-path-heading"><div><h2>Flight path</h2><p>{shot?.name ?? 'Camera path'} · {shot?.settings.duration ?? 0} s</p></div><button type="button" aria-label="Close flight path" onClick={() => popup.current?.close()}><X size={18} /></button></div>
      <svg viewBox="0 0 320 190" role="img" aria-label="Top-down camera route"><rect width="320" height="190" rx="12" fill="#17231d" />{path.length > 1 && <><polyline points={path.map(map).join(' ')} fill="none" stroke="#edc58c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx={map(path[0]).split(',')[0]} cy={map(path[0]).split(',')[1]} r="6" fill="#edc58c" /><circle cx={map(path.at(-1)!).split(',')[0]} cy={map(path.at(-1)!).split(',')[1]} r="6" fill="#f5f1e7" /></>}</svg>
      <p>{shot?.cinemaTraj ? 'CinemaTraj CPU path follows the blocked actor. Start and finish are shown above.' : 'Generated camera route. Start and finish are shown above.'}</p>
      <div className="flight-path-actions"><Button size="sm" onClick={() => { popup.current?.close(); onPath(); }} aria-pressed={showPath}><Route size={14} />{showPath ? 'Hide in scene' : 'Show in scene'}</Button><Button size="sm" onClick={() => { popup.current?.close(); onPreview(); }}><Play size={14} />Play path</Button></div></div>
    </dialog>
    <p className="shot-credit">Project draft · Manage saves in Project.<br />Camera tools adapted from <a href="https://wassermanproductions.com" target="_blank" rel="noreferrer">Sam Wasserman (wassermanproductions.com)</a> · <a href="/licenses/blockout/NOTICE" target="_blank" rel="noreferrer">Blockout credits</a></p>
  </div>;
}
