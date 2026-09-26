'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import type { WebrtcProvider } from 'y-webrtc';
import { createRoomId, defaultCollaborator, normalizeCollaboratorName, normalizeRoomId, readCollaborators, readSharedSceneState, SCENE_STATE_KEYS, type CollaborationSceneState, type Collaborator } from './model';

const LOCAL_ORIGIN = Symbol('showcam-local-collaboration');
const identityKey = 'showcam-collaborator';

function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }

function roomFromBrowser() {
  const url = new URL(window.location.href);
  let roomId = normalizeRoomId(url.searchParams.get('room'));
  if (!roomId) {
    roomId = createRoomId();
    url.searchParams.set('room', roomId);
    window.history.replaceState({}, '', url);
  }
  return roomId;
}

function identityFromBrowser() {
  try {
    const saved = JSON.parse(localStorage.getItem(identityKey) || 'null') as { id?: string; name?: string; color?: string } | null;
    if (saved?.id && saved.name && saved.color) return { id: saved.id, name: normalizeCollaboratorName(saved.name), color: saved.color };
  } catch {}
  const identity = defaultCollaborator(createRoomId());
  localStorage.setItem(identityKey, JSON.stringify(identity));
  return identity;
}

export function useSceneCollaboration(localState: CollaborationSceneState, applyRemoteState: (state: Partial<CollaborationSceneState>) => void, sceneId: string | null) {
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState<'connecting' | 'ready' | 'offline'>('connecting');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [identity, setIdentity] = useState({ id: '', name: 'Builder', color: '#edc58c' });
  const providerRef = useRef<WebrtcProvider | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const sharedRef = useRef<Y.Map<unknown> | null>(null);
  const latestState = useRef(localState);
  const applyRemote = useRef(applyRemoteState);
  const initialized = useRef(false);
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorFrame = useRef<number | null>(null);
  const pendingCursor = useRef<{ x: number; y: number } | null>(null);
  latestState.current = localState;
  applyRemote.current = applyRemoteState;

  const publish = useCallback((state: CollaborationSceneState) => {
    const doc = docRef.current, shared = sharedRef.current;
    if (!doc || !shared || !initialized.current) return;
    doc.transact(() => {
      SCENE_STATE_KEYS.forEach(key => { if (!same(shared.get(key), state[key])) shared.set(key, state[key]); });
    }, LOCAL_ORIGIN);
  }, []);

  useEffect(() => {
    if (!roomId || !initialized.current) return;
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = setTimeout(() => publish(latestState.current), localState.playing ? 100 : 0);
    return () => { if (publishTimer.current) clearTimeout(publishTimer.current); };
  }, [localState, publish, roomId]);

  useEffect(() => {
    if (!sceneId) return;
    const nextRoom = roomFromBrowser();
    const nextIdentity = identityFromBrowser();
    setRoomId(nextRoom); setIdentity(nextIdentity);
    const doc = new Y.Doc();
    docRef.current = doc;
    const shared = doc.getMap<unknown>('scene');
    sharedRef.current = shared;
    let provider: WebrtcProvider | null = null;
    let cancelled = false;
    let initTimer: ReturnType<typeof setTimeout> | null = null;

    function refreshPeople() {
      if (!provider) return;
      setCollaborators(readCollaborators(provider.awareness.getStates() as Map<number, Record<string, unknown>>, doc.clientID));
    }
    function observeScene(transaction: Y.YMapEvent<unknown>, tx: Y.Transaction) {
      if (tx.origin === LOCAL_ORIGIN) return;
      const changed = new Map<string, unknown>();
      transaction.keysChanged.forEach(key => changed.set(key, shared.get(key)));
      applyRemote.current(readSharedSceneState(changed));
    }
    shared.observe(observeScene);

    void import('y-webrtc').then(({ WebrtcProvider }) => {
      if (cancelled) return;
      const configured = process.env.NEXT_PUBLIC_COLLAB_SIGNALING_URLS?.split(',').map(value => value.trim()).filter(Boolean);
      provider = new WebrtcProvider(`showcam-${sceneId}-${nextRoom}`, doc, { password: nextRoom, ...(configured?.length ? { signaling: configured } : {}) });
      providerRef.current = provider;
      provider.awareness.setLocalState({ user: nextIdentity, selectedId: latestState.current.selectedId, cursor: null });
      provider.awareness.on('change', refreshPeople);
      provider.on('status', ({ connected }: { connected: boolean }) => setStatus(connected ? 'ready' : 'offline'));
      refreshPeople();
      initTimer = setTimeout(() => {
        initialized.current = true;
        if (shared.size) applyRemote.current(readSharedSceneState(new Map(shared.entries())));
        else publish(latestState.current);
      }, 700);
    }).catch(error => { console.error('Collaboration could not start', error); setStatus('offline'); });

    return () => {
      cancelled = true; initialized.current = false;
      if (initTimer) clearTimeout(initTimer);
      if (cursorFrame.current) cancelAnimationFrame(cursorFrame.current);
      shared.unobserve(observeScene);
      provider?.awareness.off('change', refreshPeople);
      provider?.destroy(); doc.destroy();
      providerRef.current = null; docRef.current = null; sharedRef.current = null;
    };
  }, [publish, sceneId]);

  useEffect(() => { providerRef.current?.awareness.setLocalStateField('selectedId', localState.selectedId); }, [localState.selectedId]);

  const updateCursor = useCallback((cursor: { x: number; y: number } | null) => {
    pendingCursor.current = cursor;
    if (cursorFrame.current !== null) return;
    cursorFrame.current = requestAnimationFrame(() => {
      providerRef.current?.awareness.setLocalStateField('cursor', pendingCursor.current);
      cursorFrame.current = null;
    });
  }, []);

  const updateName = useCallback((name: string) => {
    const next = { ...identity, name: normalizeCollaboratorName(name) };
    setIdentity(next); localStorage.setItem(identityKey, JSON.stringify(next));
    providerRef.current?.awareness.setLocalStateField('user', next);
  }, [identity]);

  const share = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
  }, []);

  return { roomId, status, collaborators, identity, updateCursor, updateName, share };
}
