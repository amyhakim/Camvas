'use client';

import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import styles from './movement-controls.module.css';

const HINT_KEY = 'showcam-movement-hint-seen';

export function MovementControls() {
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(HINT_KEY)) return;
      window.localStorage.setItem(HINT_KEY, '1');
    } catch { /* The controls still work when storage is unavailable. */ }
    setShowHint(true);
    const timeout = window.setTimeout(() => setShowHint(false), 7000);
    return () => window.clearTimeout(timeout);
  }, []);

  return <div className={styles.root} onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); event.stopPropagation(); } }}>
    {showHint && !open && <div className={styles.firstHint} role="status">Arrow keys to move · Space / Ctrl for altitude</div>}
    <button type="button" className={styles.trigger} aria-expanded={open} aria-controls="movement-controls-panel" onClick={() => { setOpen(value => !value); setShowHint(false); }}>
      <Keyboard size={16} aria-hidden="true" /><span>Controls</span>
    </button>
    {open && <aside id="movement-controls-panel" className={styles.panel} aria-label="Movement keyboard shortcuts">
      <div className={styles.heading}><strong>Move</strong><button type="button" aria-label="Close controls" onClick={() => setOpen(false)}><X size={15} /></button></div>
      <div><kbd>↑</kbd><span>Forward</span></div>
      <div><kbd>↓</kbd><span>Back</span></div>
      <div><kbd>←</kbd><span>Left</span></div>
      <div><kbd>→</kbd><span>Right</span></div>
      <div><kbd>Space</kbd><span>Up</span></div>
      <div><kbd>Ctrl</kbd><span>Down</span></div>
    </aside>}
  </div>;
}
