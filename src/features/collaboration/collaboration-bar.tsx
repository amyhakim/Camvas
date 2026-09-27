'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Users, WifiOff, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import type { Collaborator } from './model';
import styles from './collaboration.module.css';

export function CollaborationBar({ status, roomId, collaborators, identity, onName, onShare, inline = false }: {
  status: 'connecting' | 'ready' | 'offline'; roomId: string; collaborators: Collaborator[];
  identity: { id: string; name: string; color: string }; onName: (name: string) => void; onShare: () => Promise<void>; inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  const [copied, setCopied] = useState(false);
  async function share() { try { setError(''); await onShare(); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { setError('Could not copy the link. Try sharing again.'); } }
  return <div className={`${styles.roomControl} ${inline ? styles.roomControlInline : ''}`}>
    <button type="button" ref={trigger} className={`button button--secondary ${inline ? styles.roomTriggerInline : `button--icon ${styles.roomTrigger}`}`} aria-label="Share room" title="Share room" aria-expanded={open} aria-controls="room-details" onClick={() => setOpen(value => !value)}><Users size={18} />{inline && <span>Share room</span>}</button>
    <dialog ref={dialog} id="room-details" className={styles.modal} aria-label="Scene collaboration" onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <GlassPanel className={styles.bar} density="default">
    <div className={styles.heading}><h2>Share room</h2><Button size="sm" iconOnly variant="ghost" aria-label="Close room details" onClick={() => dialog.current?.close()}><X size={16} /></Button></div>
    <span className={styles.status} data-state={status} title={status === 'ready' ? 'Connected to collaboration room' : status === 'connecting' ? 'Connecting to collaborators' : 'Collaboration offline'}>{status === 'offline' ? <WifiOff size={13} /> : <span />}</span>
    <div className={styles.avatars} role="group" aria-label={`${collaborators.length} collaborator${collaborators.length === 1 ? '' : 's'} online`}>
      <Users size={14} />
      {collaborators.slice(0, 4).map(person => <motion.span layout key={person.clientId} className={styles.avatar} data-collaborator-id={person.id} style={{ '--avatar': person.color } as React.CSSProperties} title={`${person.name}${person.local ? ' (you)' : ''}`}>{person.name.slice(0, 1).toUpperCase()}</motion.span>)}
      {collaborators.length > 4 && <span className={styles.more}>+{collaborators.length - 4}</span>}
    </div>
    <label className={styles.name}><span className="sr-only">Your collaborator name</span><input value={identity.name} onChange={event => onName(event.target.value)} onBlur={event => onName(event.target.value)} maxLength={32} /></label>
    <span className={styles.room}>Room {roomId.slice(0, 6)}</span>
    <Button size="sm" variant="ghost" onClick={share} aria-label="Copy collaboration link"><AnimatePresence mode="wait" initial={false}>{copied ? <motion.span key="done" initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}><Check size={14} />Copied</motion.span> : <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Copy size={14} />Share</motion.span>}</AnimatePresence></Button>
    {error && <p role="alert">{error}</p>}
    </GlassPanel>
    </dialog>
  </div>;
}

export function CollaborationCursors({ collaborators }: { collaborators: Collaborator[] }) {
  return <div className={styles.cursorLayer} aria-hidden="true">{collaborators.filter(person => !person.local && person.cursor).map(person => <motion.div key={person.clientId} className={styles.cursor} data-collaborator-cursor={person.id} style={{ left: `${person.cursor!.x * 100}%`, top: `${person.cursor!.y * 100}%`, '--cursor': person.color } as React.CSSProperties} animate={{ left: `${person.cursor!.x * 100}%`, top: `${person.cursor!.y * 100}%` }} transition={{ type: 'spring', stiffness: 500, damping: 40, mass: .35 }}><svg viewBox="0 0 20 24"><path d="M2 1.5 17 13l-7 .8-4 7.1z" /></svg><span>{person.name}</span></motion.div>)}</div>;
}
