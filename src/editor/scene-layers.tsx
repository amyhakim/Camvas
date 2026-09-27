'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Layers3, Plus, Trash2 } from 'lucide-react';
import type { SceneEntity } from '@/contracts';
import styles from './scene-layers.module.css';

type Layer = { id: string; name: string };

export function SceneLayers({ objects, selectedId, onSelect }: {
  objects: SceneEntity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingId) nameInput.current?.focus(); }, [editingId]);
  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const defaultLayer = (object: SceneEntity) => object.type === 'Actor' || object.type === 'Prop' ? 'blocking' : 'background';
  const layerFor = (object: SceneEntity) => assignments[object.id] ?? defaultLayer(object);
  const groups = [{ id: 'background', name: 'Background' }, { id: 'blocking', name: 'Blocking' }, ...layers];

  function addLayer() {
    const id = crypto.randomUUID();
    setLayers(previous => [...previous, { id, name: `Layer ${previous.length + 1}` }]);
    setEditingId(id);
  }

  function removeLayer(id: string) {
    setLayers(previous => previous.filter(layer => layer.id !== id));
    setAssignments(previous => Object.fromEntries(Object.entries(previous).filter(([, layerId]) => layerId !== id)));
  }

  return <div ref={root} className={styles.root} onKeyDown={event => { if (event.key === 'Escape' && !(event.target instanceof HTMLInputElement)) { setOpen(false); event.stopPropagation(); } }}>
    <button type="button" className={styles.trigger} aria-label="Layers" title="Layers" aria-expanded={open} aria-controls="scene-layers" onClick={() => setOpen(value => !value)}><Layers3 size={19} /></button>
    {open && <section id="scene-layers" className={styles.panel} aria-label="Scene layers">
      <header className={styles.heading}><strong>Layers</strong><span>{groups.length}</span></header>
      <div className={styles.list}>{groups.map(layer => {
        const members = objects.filter(object => layerFor(object) === layer.id);
        const custom = layer.id !== 'background' && layer.id !== 'blocking';
        return <details key={layer.id} className={styles.group}>
          <summary><ChevronDown size={14} className={styles.chevron} />{editingId === layer.id ? <input ref={nameInput} aria-label="Layer name" value={layer.name} maxLength={40} onClick={event => event.preventDefault()} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setEditingId(null); } }} onChange={event => setLayers(previous => previous.map(item => item.id === layer.id ? { ...item, name: event.target.value } : item))} onBlur={() => setEditingId(null)} /> : <span>{layer.name}</span>}<small>{members.length}</small></summary>
          <div className={styles.members}>
            {members.map(object => <button key={object.id} type="button" className={styles.object} data-selected={selectedId === object.id} onClick={() => onSelect(object.id)}>{object.name}</button>)}
            {!members.length && <p>Empty layer</p>}
            {selectedId && objects.some(object => object.id === selectedId && layerFor(object) !== layer.id) && <button type="button" className={styles.action} onClick={() => setAssignments(previous => ({ ...previous, [selectedId]: layer.id }))}>Move selected here</button>}
            {custom && <div className={styles.manage}><button type="button" onClick={() => setEditingId(layer.id)}>Rename</button><button type="button" aria-label={`Delete ${layer.name}`} onClick={() => removeLayer(layer.id)}><Trash2 size={13} />Delete</button></div>}
          </div>
        </details>;
      })}</div>
      <button type="button" className={styles.add} onClick={addLayer}><Plus size={15} />More layers</button>
    </section>}
  </div>;
}
