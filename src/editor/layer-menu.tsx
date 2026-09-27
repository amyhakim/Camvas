import { useEffect, useRef, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import styles from './editor.module.css';

export function LayerMenu({ disabled, onContainer }: { disabled: boolean; onContainer: (node: HTMLDivElement | null) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div className={styles.layerMenu} ref={root}>
    <button ref={trigger} type="button" className="button button--ghost button--sm button--icon" aria-label="Scene layers" title="Scene layers" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? 'scene-layer-settings' : undefined} disabled={disabled} onClick={() => setOpen(value => !value)}><Layers size={16} /></button>
    {open && <GlassPanel className={styles.layerPopover} id="scene-layer-settings" role="dialog" aria-label="Scene layers">
      <div className={styles.layerHeading}><strong>Scene layers</strong><Button iconOnly size="sm" variant="ghost" aria-label="Close scene layers" onClick={() => { setOpen(false); trigger.current?.focus(); }}><X size={14} /></Button></div>
      <div ref={onContainer} />
    </GlassPanel>}
  </div>;
}
