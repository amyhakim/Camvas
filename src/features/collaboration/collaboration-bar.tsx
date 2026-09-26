'use client';

import { useState } from 'react';
import { Check, Copy, Users, WifiOff } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Button, GlassPanel } from '@/components/ui/primitives';
import type { Collaborator } from './model';
import styles from './collaboration.module.css';

export function CollaborationBar({ status, roomId, collaborators, identity, onName, onShare }: {
  status: 'connecting' | 'ready' | 'offline'; roomId: string; collaborators: Collaborator[];
  identity: { id: string; name: string; color: string }; onName: (name: string) => void; onShare: () => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  async function share() { await onShare(); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  return <GlassPanel className={styles.bar} density="default" role="region" aria-label="Scene collaboration">
    <span className={styles.status} data-state={status} title={status === 'ready' ? 'Connected to collaboration room' : status === 'connecting' ? 'Connecting to collaborators' : 'Collaboration offline'}>{status === 'offline' ? <WifiOff size={13} /> : <span />}</span>
    <div className={styles.avatars} aria-label={`${collaborators.length} collaborator${collaborators.length === 1 ? '' : 's'} online`}>
      <Users size={14} />
      {collaborators.slice(0, 4).map(person => <motion.span layout key={person.clientId} className={styles.avatar} data-collaborator-id={person.id} style={{ '--avatar': person.color } as React.CSSProperties} title={`${person.name}${person.local ? ' (you)' : ''}`}>{person.name.slice(0, 1).toUpperCase()}</motion.span>)}
      {collaborators.length > 4 && <span className={styles.more}>+{collaborators.length - 4}</span>}
    </div>
    <label className={styles.name}><span className="sr-only">Your collaborator name</span><input value={identity.name} onChange={event => onName(event.target.value)} onBlur={event => onName(event.target.value)} maxLength={32} /></label>
    <span className={styles.room}>Room {roomId.slice(0, 6)}</span>
    <Button size="sm" variant="ghost" onClick={share} aria-label="Copy collaboration link"><AnimatePresence mode="wait" initial={false}>{copied ? <motion.span key="done" initial={{ scale: .7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}><Check size={14} />Copied</motion.span> : <motion.span key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Copy size={14} />Share</motion.span>}</AnimatePresence></Button>
  </GlassPanel>;
}

export function CollaborationCursors({ collaborators }: { collaborators: Collaborator[] }) {
  return <div className={styles.cursorLayer} aria-hidden="true">{collaborators.filter(person => !person.local && person.cursor).map(person => <motion.div key={person.clientId} className={styles.cursor} data-collaborator-cursor={person.id} style={{ left: `${person.cursor!.x * 100}%`, top: `${person.cursor!.y * 100}%`, '--cursor': person.color } as React.CSSProperties} animate={{ left: `${person.cursor!.x * 100}%`, top: `${person.cursor!.y * 100}%` }} transition={{ type: 'spring', stiffness: 500, damping: 40, mass: .35 }}><svg viewBox="0 0 20 24"><path d="M2 1.5 17 13l-7 .8-4 7.1z" /></svg><span>{person.name}</span></motion.div>)}</div>;
}
