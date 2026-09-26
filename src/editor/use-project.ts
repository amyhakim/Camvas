'use client';

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { ProjectDocument, ProjectStatus, SceneManifest } from '@/contracts';
import { loadProject, saveProject } from '@/features/project';

const emptyProject = (sceneId = 'residence-9d09ab82', name = 'Residence study'): ProjectDocument => ({ format: 'showcam-project', version: 1, sceneId, name, shot: null, actors: [] });

export function useProject(manifest: SceneManifest | null) {
  const [document, setDocument] = useState<ProjectDocument>(() => emptyProject());
  const [status, setStatus] = useState<ProjectStatus>('loading');
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const blocked = useRef(false);
  const initialized = useRef(false);
  const lastSaved = useRef('');

  const verifyScene = useCallback((next: ProjectDocument) => {
    if (next.sceneId !== (manifest?.id ?? 'pavilion-v1')) throw new Error('This project uses a different scene. Switch to the matching scene before importing this project.');
    if (next.placements?.some(placement => !manifest?.objects.some(object => object.id === placement.id && object.type !== 'Camera'))) throw new Error('A moved object is missing or is a source camera. Import a project made with this scene.');
    if (next.collision && (manifest?.asset?.kind !== 'gsplat' || next.collision.sourceUrl !== manifest.asset.url || !manifest.objects.some(object => object.id === next.collision!.entityId && object.type === 'Splat'))) throw new Error('Collision boxes belong to a different capture. Import a project made with this scene.');
    // Actor and prop subjects may have been deleted since; the draft then keeps its stored static target.
    if (next.shot && !/^(actor|prop):/.test(next.shot.subjectId) && !manifest?.objects.some(object => object.id === next.shot!.subjectId && object.type !== 'Camera')) {
      throw new Error('The saved camera subject is missing from this scene. Import a project made with this scene.');
    }
  }, [manifest]);

  useEffect(() => {
    if (!manifest || initialized.current) return;
    initialized.current = true;
    setDocument(emptyProject(manifest.id ?? 'pavilion-v1', `${manifest.name} study`));
    try {
      const restored = loadProject(window.localStorage, manifest.id ?? 'pavilion-v1');
      if (restored) { verifyScene(restored); setDocument(restored); lastSaved.current = JSON.stringify(restored); }
      if (!restored) setDocument(emptyProject(manifest.id ?? 'pavilion-v1', `${manifest.name} study`));
      setStatus('saved');
    } catch (cause) {
      blocked.current = true;
      setError(cause instanceof Error ? cause.message : 'This browser could not restore your project. Import a backup or save again.');
      setStatus('error');
    }
    setHydrated(true);
  }, [manifest, verifyScene]);

  const persist = useCallback((next: ProjectDocument) => {
    try {
      saveProject(window.localStorage, next);
      lastSaved.current = JSON.stringify(next);
      blocked.current = false;
      setError(''); setStatus('saved');
    } catch (cause) {
      blocked.current = true;
      setError(cause instanceof Error ? cause.message : 'This browser could not save your project. Export a backup and try saving again.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!hydrated || blocked.current) return;
    if (JSON.stringify(document) === lastSaved.current) { setStatus('saved'); return; }
    persist(document);
  }, [document, hydrated, persist]);

  const updateDocument = useCallback((next: SetStateAction<ProjectDocument>) => {
    setDocument(next);
    if (!blocked.current) setStatus('saving');
  }, []);
  const importDocument = (next: ProjectDocument) => {
    verifyScene(next);
    setDocument(next);
    persist(next);
  };
  return { document, updateDocument, importDocument, status, error, hydrated, retrySave: () => persist(document) };
}
