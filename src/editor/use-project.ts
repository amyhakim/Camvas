'use client';

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { ProjectDocument, ProjectStatus, SceneManifest } from '@/contracts';
import { loadProject, saveProject } from '@/features/project';
import { loadCollection, saveCollection, type ProjectCollection, type ProjectScene } from '@/features/project/collection';
import { pavilionAstraShot } from '@/features/camera/pavilion-astra-shot';

const emptyProject = (sceneId = 'residence-9d09ab82', name = 'Residence study'): ProjectDocument => ({ format: 'showcam-project', version: 1, sceneId, name, shot: null, actors: [] });

export function useProject(manifest: SceneManifest | null) {
  const [projectId, setProjectId] = useState<string | undefined>();
  const [requestedSceneId, setRequestedSceneId] = useState<string | undefined>();
  const [queryReady, setQueryReady] = useState(false);
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setProjectId(search.get('project') || undefined);
    setRequestedSceneId(search.get('entry') || undefined);
    setQueryReady(true);
  }, []);
  const [document, setDocument] = useState<ProjectDocument>(() => emptyProject());
  const [projectScenes, setProjectScenes] = useState<ProjectScene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const collection = useRef<ProjectCollection | null>(null);
  const activeId = useRef<string | null>(null);
  const [status, setStatus] = useState<ProjectStatus>('loading');
  const [error, setError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const blocked = useRef(false);
  const initialized = useRef(false);
  const lastSaved = useRef('');

  const verifyScene = useCallback((next: ProjectDocument) => {
    if (next.sceneId !== (manifest?.id ?? 'pavilion-v1')) throw new Error('This project uses a different scene. Switch to the matching scene before importing this project.');
    if (next.placements?.some(placement => !manifest?.objects.some(object => object.id === placement.id && object.type !== 'Camera'))) throw new Error('A moved object is missing or is a source camera. Import a project made with this scene.');
    // Actor and prop subjects may have been deleted since; the draft then keeps its stored static target.
    if (next.shot && !/^(actor|prop):/.test(next.shot.subjectId) && !manifest?.objects.some(object => object.id === next.shot!.subjectId && object.type !== 'Camera')) {
      throw new Error('The saved camera subject is missing from this scene. Import a project made with this scene.');
    }
  }, [manifest]);

  useEffect(() => {
    if (!manifest || !queryReady || initialized.current) return;
    initialized.current = true;
    setDocument(emptyProject(manifest.id ?? 'pavilion-v1', `${manifest.name} study`));
    try {
      if (projectId) {
        let restoredCollection = loadCollection(window.localStorage, projectId);
        const seeded = restoredCollection.scenes.find(scene => scene.id === 'scene:pavilion-graph');
        const existingShot = seeded?.document.shot;
        const earlierDraft = existingShot?.name === 'Astra · Pool approach and Pavilion lounge orbit'
          && existingShot.subjectId === 'Group' && existingShot.marks.length === 2
          && existingShot.marks[0].focalLength === 24 && existingShot.marks[1].focalLength === 28
          && existingShot.cinemaTraj?.positions.length === 181
          && Math.abs(existingShot.cinemaTraj.positions.at(-1)!.position[0] - 3.5) < .001;
        if (projectId === 'pavilion-scene-graph' && restoredCollection.name === 'Pavilion Scene Graph' && seeded?.document.name === 'Pavilion Scene Graph'
          && (!existingShot || earlierDraft) && seeded.document.actors.length === 0 && !seeded.document.placements?.length && !seeded.document.props?.length) {
          restoredCollection = { ...restoredCollection, scenes: restoredCollection.scenes.map(scene => scene.id === seeded.id
            ? { ...scene, name: scene.name === 'Scene 1' ? 'Barcelona Pavilion' : scene.name, document: { ...scene.document, shot: pavilionAstraShot() } } : scene) };
          saveCollection(window.localStorage, projectId, restoredCollection);
        }
        const entry = requestedSceneId ? restoredCollection.scenes.find(scene => scene.id === requestedSceneId) : restoredCollection.scenes.find(scene => scene.document.sceneId === manifest.id);
        if (!entry || entry.document.sceneId !== manifest.id) throw new Error('This project scene does not match the selected asset. Return home and open the scene again.');
        verifyScene(entry.document);
        collection.current = restoredCollection;
        activeId.current = entry.id;
        setProjectScenes(restoredCollection.scenes);
        setActiveSceneId(entry.id);
        setDocument(entry.document);
        lastSaved.current = JSON.stringify(entry.document);
        setStatus('saved'); setHydrated(true);
        return;
      }
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
  }, [manifest, verifyScene, projectId, requestedSceneId, queryReady]);

  const persist = useCallback((next: ProjectDocument) => {
    try {
      if (projectId) {
        if (!collection.current || !activeId.current) throw new Error('This project has not loaded. Return home or import a saved project.');
        const updated: ProjectCollection = {
          ...collection.current, name: next.name,
          scenes: collection.current.scenes.map(scene => ({ ...scene, document: scene.id === activeId.current ? next : { ...scene.document, name: next.name } })),
        };
        saveCollection(window.localStorage, projectId, updated);
        collection.current = updated;
        setProjectScenes(updated.scenes);
      } else saveProject(window.localStorage, next);
      lastSaved.current = JSON.stringify(next);
      blocked.current = false;
      setError(''); setStatus('saved');
    } catch (cause) {
      blocked.current = true;
      setError(cause instanceof Error ? cause.message : 'This browser could not save your project. Export a backup and try saving again.');
      setStatus('error');
    }
  }, [projectId]);

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
  const addProjectScene = (assetSceneId: string): ProjectScene => {
    if (!projectId || !collection.current) throw new Error('Open a named project to add scenes.');
    persist(document);
    const current = collection.current;
    const entry: ProjectScene = { id: `scene:${crypto.randomUUID()}`, name: `Scene ${current.scenes.length + 1}`, document: emptyProject(assetSceneId, current.name) };
    const updated = { ...current, scenes: [...current.scenes, entry] };
    saveCollection(window.localStorage, projectId, updated);
    collection.current = updated;
    setProjectScenes(updated.scenes);
    return entry;
  };
  const renameProjectScene = (id: string, name: string) => {
    if (!projectId || !collection.current) return;
    const clean = name.trim();
    if (!clean || clean.length > 100) throw new Error('Scene name must be 1–100 characters.');
    const updated = { ...collection.current, scenes: collection.current.scenes.map(scene => scene.id === id ? { ...scene, name: clean } : scene) };
    saveCollection(window.localStorage, projectId, updated);
    collection.current = updated;
    setProjectScenes(updated.scenes);
  };
  const replaceCollection = (next: ProjectCollection) => {
    if (!projectId) throw new Error('Open a named project to import scenes.');
    saveCollection(window.localStorage, projectId, next);
    collection.current = next;
    setProjectScenes(next.scenes);
  };
  return { document, updateDocument, importDocument, status, error, hydrated, retrySave: () => persist(document), projectScenes, activeSceneId, projectId, addProjectScene, renameProjectScene, replaceCollection };
}
