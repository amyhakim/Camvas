'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { SCENES } from '@/features/scene/catalog';
import styles from './scene-actions.module.css';

export function SceneActions({ disabled, count, name, onAdd, onRemove }: {
  disabled: boolean; count: number; name: string;
  onAdd: (source: string) => void; onRemove: () => void;
}) {
  const [panel, setPanel] = useState<'add' | 'remove' | null>(null);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!panel) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setPanel(null); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setPanel(null); trigger.current?.focus(); } }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [panel]);
  function run(action: () => void) {
    try { action(); setError(''); setPanel(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update scenes.'); }
  }
  return <div className={styles.actions} ref={root}>
    <button type="button" aria-label="Add scene" title={count >= 32 ? 'A project can have up to 32 scenes' : 'Add scene'} disabled={disabled || count >= 32} aria-expanded={panel === 'add'} onClick={event => { trigger.current = event.currentTarget; setError(''); setPanel(panel === 'add' ? null : 'add'); }}><Plus size={16} /></button>
    <button type="button" aria-label="Remove scene" title={count <= 1 ? 'Keep at least one scene in the project' : 'Remove current scene'} disabled={disabled || count <= 1} aria-expanded={panel === 'remove'} onClick={event => { trigger.current = event.currentTarget; setError(''); setPanel(panel === 'remove' ? null : 'remove'); }}><Trash2 size={15} /></button>
    {panel && <div className={styles.panel} role="dialog" aria-label={panel === 'add' ? 'Add scene' : 'Remove scene'}>
      {panel === 'add' ? <><strong>Add scene</strong><p>Choose a source for the new scene.</p>{SCENES.map(scene => <button key={scene.id} type="button" onClick={() => run(() => onAdd(scene.id))}>{scene.name}</button>)}</> : <><strong>Remove {name}?</strong><p>This removes this scene and its saved edits from the project.</p><button type="button" onClick={() => run(onRemove)}>Remove scene</button><button type="button" onClick={() => { setPanel(null); trigger.current?.focus(); }}>Cancel</button></>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </div>;
}
