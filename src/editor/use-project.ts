'use client';

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { ProjectDocument, ProjectStatus, SceneManifest } from '@/contracts';
import { loadProject, saveProject } from '@/features/project';

export const SCENE_ID = 'pavilion-v1';
const emptyProject = (): ProjectDocument => ({ format: 'showcam-project', version: 1, sceneId: SCENE_ID, name: 'Pavilion study', shot: null, actors: [] });

export function useProject(manifest: SceneManifest | null) {
  const [document, setDocument] = useState<ProjectDocument>(emptyProject);
  const [status, setStatus] = useState<ProjectStatus>('loading');
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const blocked = useRef(false);
  const initialized = useRef(false);
  const lastSaved = useRef('');

  const verifyScene = useCallback((next: ProjectDocument) => {
    if (next.sceneId !== SCENE_ID) throw new Error('This project uses a different scene. Open a pavilion project instead.');
    if (next.shot && !manifest?.objects.some(object => object.id === next.shot!.subjectId && object.type !== 'Camera')) {
      throw new Error('The saved camera subject is missing from this scene. Import a project made with this pavilion.');
    }
  }, [manifest]);

  useEffect(() => {
    if (!manifest || initialized.current) return;
    initialized.current = true;
    try {
      const restored = loadProject(window.localStorage, SCENE_ID);
      if (restored) { verifyScene(restored); setDocument(restored); lastSaved.current = JSON.stringify(restored); }
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
