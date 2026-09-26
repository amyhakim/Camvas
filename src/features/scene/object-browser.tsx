'use client';

import { useState } from 'react';
import { Armchair, Box, Camera, Layers3, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { SceneEntity } from '@/contracts';
import { Button, GlassPanel, cx } from '@/components/ui/primitives';
import { filterSceneObjects } from './data';
import styles from './scene.module.css';

export type ObjectBrowserProps = {
  objects: SceneEntity[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showCameras: boolean;
  onToggleCameras: () => void;
};

export function ObjectBrowser({ objects, loading, selectedId, onSelect, showCameras, onToggleCameras }: ObjectBrowserProps) {
  const [query, setQuery] = useState('');
  const filtered = filterSceneObjects(objects, query);

  return <GlassPanel className={cx(styles.browserRoot, 'object-browser side-panel live-object-browser')} density="default" role="region" aria-label="Scene objects">
    <div className="panel-heading"><h2><Layers3 size={16} />Scene objects</h2><span className="count">{objects.length || '…'}</span></div>
    <label className="search-field"><Search size={15} /><span className="sr-only">Find an object</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an object…" /></label>
    <div className="object-list live-object-list"><AnimatePresence initial={false}>{filtered.length ? filtered.map(object => <motion.button layout="position" key={object.id} type="button" className={cx('object-row', selectedId === object.id && 'is-selected')} aria-pressed={selectedId === object.id} onClick={() => onSelect(object.id)} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0, scale: selectedId === object.id ? 1 : .99 }} exit={{ opacity: 0, x: -4 }} whileTap={{ scale: .97 }} transition={{ duration: .16 }}>
      {object.type === 'Camera' ? <Camera size={16} /> : object.type === 'Collection' ? <Armchair size={16} /> : <Box size={16} />}
      <span><strong>{object.name}</strong><small>{object.type === 'Camera' ? `${object.lens} mm · ${object.animated ? 'animated' : 'perspective'}` : object.category}</small></span>
    </motion.button>) : <motion.p key="empty" className="empty-inline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{loading ? 'Loading scene objects…' : 'No matching objects. Try “chair”, “water”, or “camera”.'}</motion.p>}</AnimatePresence></div>
    <div className="object-browser-footer"><Button size="sm" variant="ghost" aria-pressed={showCameras} onClick={onToggleCameras}><Camera size={14} />Camera helpers</Button></div>
  </GlassPanel>;
}
