'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { createPortal } from 'react-dom';
import { Ellipsis, MousePointer2, Move, RotateCw, Undo2 } from 'lucide-react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import { clampMenuPosition } from './model';
import type { ObjectContextMenuProps, ObjectToolStripProps, ObjectTool } from './types';
import styles from './object-actions.module.css';

export function ObjectContextMenu({ title, x, y, actions, onClose }: ObjectContextMenuProps) {
  const reducedMotion = useReducedMotion();
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const restore = useRef(true);
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState(() => actions.find(action => !action.disabled)?.id);
  const [position, setPosition] = useState(() => typeof window === 'undefined' ? { left: x, top: y } : clampMenuPosition(x, y, Math.min(240, window.innerWidth - 16), 0, window.innerWidth, window.innerHeight));
  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!mounted || !container.current) return;
    const menu = container.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restore.current = true;
    menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    if (!menu.querySelector('button:not(:disabled)')) menu.focus();
    const outside = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node)) {
        restore.current = false;
        close.current();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      const hadMenuFocus = menu.contains(document.activeElement);
      // Wait for an action's dialog/input to claim focus before restoring the opener.
      requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (restore.current && trigger?.isConnected && (focused === document.body || focused === null || (hadMenuFocus && menu.contains(focused)))) trigger.focus({ preventScroll: true });
      });
    };
  }, [mounted]);

  useLayoutEffect(() => {
    if (!mounted || !container.current) return;
    const menu = container.current;
    const update = () => {
      const rect = menu.getBoundingClientRect();
      setPosition(clampMenuPosition(x, y, rect.width, rect.height, window.innerWidth, window.innerHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(menu);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, [mounted, x, y]);

  useEffect(() => {
    if (actions.some(action => action.id === activeId && !action.disabled)) return;
    setActiveId(actions.find(action => !action.disabled)?.id);
  }, [actions, activeId]);

  if (!mounted) return null;
  return createPortal(<div ref={container} className={styles.menuPosition} style={position} role="menu" aria-labelledby={id} tabIndex={-1} onKeyDown={event => {
    if (event.key === 'Tab') { restore.current = false; close.current(); return; }
    const enabled = actions.filter(action => !action.disabled);
    if (!enabled.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = enabled.findIndex(action => action.id === activeId);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
    const target = enabled[next];
    setActiveId(target.id);
    container.current?.querySelectorAll<HTMLButtonElement>('button')[actions.findIndex(action => action.id === target.id)]?.focus();
  }}>
    <motion.div initial={{ opacity: 0, scale: reducedMotion ? 1 : .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: reducedMotion ? 0 : .12 }}><GlassPanel density="dense" className={styles.menu}>
      <div id={id} className={styles.menuTitle}>{title}</div>
      {actions.map(action => <button key={action.id} type="button" role="menuitem" className={`${styles.menuItem} ${action.danger ? styles.danger : ''}`} disabled={action.disabled} tabIndex={action.id === activeId ? 0 : -1} onFocus={() => setActiveId(action.id)} onClick={() => { close.current(); action.onSelect(); }}>{action.label}</button>)}
      {!actions.length && <p className={styles.empty}>No actions available</p>}
    </GlassPanel></motion.div>
  </div>, document.body);
}

const tools = [
  { value: 'select', label: 'Select', icon: MousePointer2 },
  { value: 'move', label: 'Move', icon: Move },
  { value: 'rotate', label: 'Rotate', icon: RotateCw },
] satisfies { value: ObjectTool; label: string; icon: typeof Move }[];

export function ObjectToolStrip({ name, tool, onToolChange, allowRotate, disabled, onActions, onUndo, canUndo, hint }: ObjectToolStripProps) {
  const id = useId();
  return <GlassPanel density="dense" className={styles.strip}>
    <div className={styles.stripTop}>
      <span className="sr-only" title={name}>{name}</span>
      <div role="toolbar" aria-label={`Tools for ${name}`} aria-describedby={`${id}-hint`} className={styles.toolbar}>
        <fieldset className={styles.tools} disabled={disabled}><legend className="sr-only">Object tool</legend>
          {tools.filter(option => allowRotate || option.value !== 'rotate').map(({ value, label, icon: Icon }) => <label key={value} title={label} className={`${styles.tool} ${tool === value ? styles.selected : ''}`}>
            <input type="radio" name={id} value={value} checked={tool === value} onChange={() => onToolChange(value)} /><Icon size={16} aria-hidden="true" /><span className="sr-only">{label}</span>
          </label>)}
        </fieldset>
        <Button size="sm" variant="ghost" iconOnly title="More actions" aria-label="More actions" onClick={onActions} aria-haspopup="menu"><Ellipsis size={18} aria-hidden="true" /></Button>
        {onUndo && <Button size="sm" variant="ghost" iconOnly title="Undo" aria-label="Undo" onClick={onUndo} disabled={!canUndo}><Undo2 size={18} aria-hidden="true" /></Button>}
      </div>
    </div>
    <p id={`${id}-hint`} className="sr-only">{hint}</p>
  </GlassPanel>;
}
