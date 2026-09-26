import { useEffect, useState } from 'react';
import { MapPin, Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import type { SceneLandmark } from '@/contracts';
import { MAX_LANDMARKS } from './landmarks';
import styles from './editor.module.css';

type Props = { landmarks: SceneLandmark[]; activeId: string | null; placing: boolean; hint: string; canUndo: boolean; onSelect: (id: string) => void; onPlace: (id: string | null) => void; onStop: () => void; onLabel: (id: string, label: string) => void; onRemove: (id: string) => void; onUndo: () => void; onAsk: () => void };
export function LandmarkControls({ landmarks, activeId, placing, hint, canUndo, onSelect, onPlace, onStop, onLabel, onRemove, onUndo, onAsk }: Props) {
  const active = landmarks.find(mark => mark.id === activeId);
  const [label, setLabel] = useState(active?.label ?? '');
  const [error, setError] = useState('');
  useEffect(() => { setLabel(active?.label ?? ''); setError(''); }, [active?.id, active?.label]);
  function save() {
    if (!active) return;
    try { onLabel(active.id, label); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Choose another label.'); }
  }
  return <section className={styles.landmarkTools} aria-label="Scene landmarks">
    <div className={styles.landmarkHeading}><strong>Landmarks · {landmarks.length}/{MAX_LANDMARKS}</strong><Button size="sm" variant="ghost" disabled={landmarks.length >= MAX_LANDMARKS} onClick={() => onPlace(null)}><MapPin size={14} />Add</Button></div>
    <p role="status">{placing ? hint : 'Drag a pin to move it. Refer to its label when directing the agent.'}</p>
    {!placing && (landmarks.length > 1 || (landmarks.length > 0 && !active)) && <label className={styles.landmarkField}>Landmark<select value={activeId ?? ''} onChange={event => onSelect(event.target.value)}><option value="" disabled>Select a landmark</option>{landmarks.map(mark => <option key={mark.id} value={mark.id}>{mark.label}</option>)}</select></label>}
    {active && !placing && <><label className={styles.landmarkField}>Landmark label<input value={label} maxLength={48} aria-invalid={!!error} aria-describedby={error ? 'landmark-label-error' : undefined} onChange={event => setLabel(event.target.value)} onBlur={save} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); save(); } if (event.key === 'Escape') { event.stopPropagation(); setLabel(active.label); setError(''); } }} /></label>
      {error && <p id="landmark-label-error" role="alert" className={styles.directorError}>{error}</p>}
      <p className={styles.landmarkCoordinates}>{active.position.map(value => value.toFixed(2)).join(', ')} m · {active.kind === 'floor' ? 'Estimated floor' : 'Mesh surface'}</p>
      <div className={styles.landmarkActions}><Button size="sm" onClick={() => onPlace(active.id)}>Reposition</Button><Button size="sm" variant="ghost" onClick={() => onRemove(active.id)}><Trash2 size={14} />Remove</Button></div>
    </>}
    <div className={styles.landmarkActions}><Button size="sm" variant="ghost" disabled={!canUndo} onClick={onUndo}><Undo2 size={14} />Undo</Button>{placing ? <Button size="sm" onClick={onStop}>Cancel placement</Button> : <Button size="sm" disabled={!active} onClick={onAsk}>Ask agent</Button>}</div>
  </section>;
}
