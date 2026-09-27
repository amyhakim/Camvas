'use client';

import { useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Armchair, Box, Camera, ChevronDown, Layers3, Plus, Search, UserRound } from 'lucide-react';
import type { ObjectContextRequest, SceneEntity } from '@/contracts';
import { Button, GlassPanel, cx } from '@/components/ui/primitives';
import { filterSceneObjects } from './data';
import styles from './scene.module.css';

export type ObjectBrowserProps = {
  objects: SceneEntity[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSearchModels: () => void;
  onContextRequest?: (request: ObjectContextRequest) => void;
};

export function ObjectBrowser({ objects, loading, selectedId, onSelect, onSearchModels, onContextRequest }: ObjectBrowserProps) {
  const reduceMotion = useReducedMotion();
  const drawerRef = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState('');
  const filtered = filterSceneObjects(objects, query);

  return <GlassPanel className={cx(styles.browserRoot, 'object-browser side-panel live-object-browser')} density="default" role="region" aria-label="Scene objects">
    <details ref={drawerRef} className={styles.objectDrawer}>
    <summary className="panel-heading"><h2><Layers3 size={16} />Scene objects</h2><span className="count">{loading ? '…' : objects.length}</span><ChevronDown size={15} className={styles.drawerChevron} /></summary>
    <label className="search-field"><Search size={15} /><span className="sr-only">Find an object</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an object…" /></label>
    <div className="object-list live-object-list"><AnimatePresence initial={false}>{filtered.length ? filtered.map(object => <motion.button layout="position" initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0, scale: selectedId === object.id ? 1 : .99 }} exit={{ opacity: 0, x: -4 }} whileTap={{ scale: .97 }} transition={{ duration: reduceMotion ? 0 : .16 }} key={object.id} type="button" className={cx('object-row', selectedId === object.id && 'is-selected')} aria-pressed={selectedId === object.id} onClick={() => { onSelect(object.id); if (window.matchMedia('(max-width: 800px)').matches) drawerRef.current?.removeAttribute('open'); }} onContextMenu={event => { if (onContextRequest) { event.preventDefault(); onContextRequest({ id: object.id, x: event.clientX, y: event.clientY }); } }} onKeyDown={event => { if (onContextRequest && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) { event.preventDefault(); const rect = event.currentTarget.getBoundingClientRect(); onContextRequest({ id: object.id, x: rect.right, y: rect.top }); } }}>
      {object.type === 'Actor' ? <UserRound size={16} /> : object.type === 'Camera' ? <Camera size={16} /> : object.type === 'Collection' ? <Armchair size={16} /> : <Box size={16} />}
      <span><strong>{object.name}</strong><small>{object.type === 'Camera' ? `${object.lens} mm · ${object.animated ? 'animated' : 'perspective'}` : object.category}</small></span>
    </motion.button>) : <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="empty-inline">{loading ? 'Loading scene objects…' : 'No matching objects. Try “chair”, “water”, or “camera”.'}</motion.p>}</AnimatePresence></div>
    </details>
    <div className="object-browser-footer"><Button size="sm" variant="ghost" onClick={onSearchModels}><Plus size={14} />Add models</Button></div>
  </GlassPanel>;
}
