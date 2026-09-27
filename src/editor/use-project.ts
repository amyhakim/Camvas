'use client';

import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import type { ProjectDocument, ProjectStatus, SceneManifest } from '@/contracts';
import { loadProject, saveProject } from '@/features/project';
import { createCollection, loadCollection, saveCollection, type ProjectCollection, type ProjectScene } from '@/features/project/collection';
import { pavilionAstraShot } from '@/features/camera/pavilion-astra-shot';
import { PAVILION_FLIGHT_LANDMARKS } from './pavilion-landmarks';

const emptyProject = (sceneId = 'residence-9d09ab82', name = 'Residence study'): ProjectDocument => ({ format: 'showcam-project', version: 1, sceneId, name, shot: null, actors: [] });
// Changing this value lets Fast Refresh rehydrate a revised built-in Pavilion plan.
const PAVILION_PLAN_REVISION = 'house-passage-29';

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
  const initialized = useRef<string | null>(null);
  const lastSaved = useRef('');

  const verifyScene = useCallback((next: ProjectDocument) => {
    if (next.sceneId !== (manifest?.id ?? 'pavilion-v1')) throw new Error('This project uses a different scene. Switch to the matching scene before importing this project.');
    if (next.removedCameraIds?.some(id => !manifest?.objects.some(object => object.id === id && object.type === 'Camera'))) throw new Error('A removed camera is missing from this scene. Import a project made with this scene.');
    if (next.semantics?.regions.some(region => region.entityIds.some(id => !manifest?.objects.some(object => object.id === id && object.type !== 'Camera')))) throw new Error('A labeled object is missing from this scene.');
    if (next.placements?.some(placement => !manifest?.objects.some(object => object.id === placement.id && object.type !== 'Camera'))) throw new Error('A moved object is missing or is a source camera. Import a project made with this scene.');
    if (next.collision && (manifest?.asset?.kind !== 'gsplat' || next.collision.sourceUrl !== manifest.asset.url || !manifest.objects.some(object => object.id === next.collision!.entityId && object.type === 'Splat'))) throw new Error('Collision boxes belong to a different capture. Import a project made with this scene.');
    // Actor and prop subjects may have been deleted since; the draft then keeps its stored static target.
    if (next.shot && !/^(actor|prop):/.test(next.shot.subjectId) && !manifest?.objects.some(object => object.id === next.shot!.subjectId && object.type !== 'Camera')) {
      throw new Error('The saved camera subject is missing from this scene. Import a project made with this scene.');
    }
  }, [manifest]);

  useEffect(() => {
    if (!manifest || !queryReady || initialized.current === PAVILION_PLAN_REVISION) return;
    initialized.current = PAVILION_PLAN_REVISION;
    setDocument(emptyProject(manifest.id ?? 'pavilion-v1', `${manifest.name} study`));
    try {
      if (projectId) {
        let restoredCollection = loadCollection(window.localStorage, projectId);
        const seeded = restoredCollection.scenes.find(scene => scene.id === 'scene:pavilion-graph');
        const existingShot = seeded?.document.shot;
        const earlierDraft = (existingShot?.name === 'Astra · Pool approach and Pavilion lounge orbit'
          || existingShot?.name === 'Astra · Pool approach and Pavilion lounge reveal')
          && existingShot.subjectId === 'Group' && !existingShot.anchorIds
          && (existingShot.marks.length === 2 || existingShot.marks.length === 3)
          && existingShot.marks[0].focalLength === 24
          && existingShot.cinemaTraj?.positions.length === 181
          && Math.abs(existingShot.cinemaTraj.positions[0].position[0] + 14) < .001;
        const seededLandmarks = seeded?.document.landmarks;
        const authoredLandmarks = seededLandmarks?.length === PAVILION_FLIGHT_LANDMARKS.length
          && PAVILION_FLIGHT_LANDMARKS.every((mark, index) => seededLandmarks[index].id === mark.id
            && seededLandmarks[index].position.every((value, axis) => Math.abs(value - mark.position[axis]) < 1e-6));
        const damagedAnchoredRoute = existingShot?.name === 'Astra · Landmark-guided Pavilion flight'
          && authoredLandmarks && existingShot.anchorIds?.length === PAVILION_FLIGHT_LANDMARKS.length
          && PAVILION_FLIGHT_LANDMARKS.some(mark => !existingShot.cinemaTraj?.positions.some(key =>
            key.position.every((value, axis) => Math.abs(value - mark.position[axis]) < 1e-5)));
        const priorLandmarkPlan = ((existingShot?.name === 'Astra · Landmark-guided Pavilion flight'
          && seededLandmarks?.length === 10 && existingShot.anchorIds?.length === 10
          && existingShot.cinemaTraj?.positions.length === 181)
          || (existingShot?.name === 'Astra · Pavilion interior and exterior flight'
            && seededLandmarks?.length === 16 && existingShot.anchorIds?.length === 16
            && existingShot.cinemaTraj?.positions.length === 239));
        // Earlier built-in revisions used 10 or 16 flight-only anchors under
        // several route names. Upgrade that starter data, but never replace a
        // scene where someone has started blocking or placing their own work.
        const staleFlightOnlyPlan = !!seededLandmarks?.length
          && seededLandmarks.length !== PAVILION_FLIGHT_LANDMARKS.length
          && seededLandmarks.every(mark => mark.kind === 'flight' && mark.id.startsWith('flight:'));
        if (projectId === 'pavilion-scene-graph' && seeded?.document.sceneId === 'pavilion-v1'
          && (((!existingShot || earlierDraft) && !seeded.document.landmarks?.length) || damagedAnchoredRoute || priorLandmarkPlan || staleFlightOnlyPlan)) {
          restoredCollection = { ...restoredCollection, scenes: restoredCollection.scenes.map(scene => scene.id === seeded.id
            ? { ...scene, name: scene.name === 'Scene 1' ? 'Barcelona Pavilion' : scene.name,
              document: { ...scene.document, landmarks: PAVILION_FLIGHT_LANDMARKS, shot: pavilionAstraShot(PAVILION_FLIGHT_LANDMARKS) } } : scene) };
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
      const staleLocalFlightPlan = restored?.sceneId === 'pavilion-v1'
        && !!restored.landmarks?.length
        && restored.landmarks.length !== PAVILION_FLIGHT_LANDMARKS.length
        && restored.landmarks.every(mark => mark.kind === 'flight' && mark.id.startsWith('flight:'));
      if (restored) {
        verifyScene(restored);
        const document = staleLocalFlightPlan
          ? { ...restored, landmarks: PAVILION_FLIGHT_LANDMARKS, shot: pavilionAstraShot(PAVILION_FLIGHT_LANDMARKS) }
          : restored;
        if (staleLocalFlightPlan) saveProject(window.localStorage, document);
        setDocument(document); lastSaved.current = JSON.stringify(document);
      }
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
  const addProjectScene = (assetSceneId: string): ProjectScene & { projectId: string } => {
    if (!hydrated) throw new Error('Wait for the project to load.');
    if (projectId && !collection.current) throw new Error('Project could not be loaded.');
    const id = projectId ?? crypto.randomUUID();
    const current = collection.current ?? createCollection(document, `scene:${crypto.randomUUID()}`);
    if (current.scenes.length >= 32) throw new Error('A project can have up to 32 scenes.');
    let number = current.scenes.length + 1;
    while (current.scenes.some(scene => scene.name === `Scene ${number}`)) number++;
    const entry: ProjectScene = { id: `scene:${crypto.randomUUID()}`, name: `Scene ${number}`, document: emptyProject(assetSceneId, document.name) };
    const updated = { ...current, name: document.name, scenes: [...current.scenes.map(scene => ({ ...scene, document: scene.id === activeId.current ? document : { ...scene.document, name: document.name } })), entry] };
    saveCollection(window.localStorage, id, updated);
    collection.current = updated;
    setProjectScenes(updated.scenes);
    return { ...entry, projectId: id };
  };
  const removeProjectScene = (id: string): ProjectScene => {
    if (!projectId || !collection.current) throw new Error('Open a project to remove scenes.');
    const current = collection.current;
    const index = current.scenes.findIndex(scene => scene.id === id);
    if (index < 0) throw new Error('Scene could not be found.');
    if (current.scenes.length <= 1) throw new Error('Keep at least one scene in the project.');
    const scenes = current.scenes.filter(scene => scene.id !== id).map(scene => ({ ...scene, document: scene.id === activeId.current ? document : scene.document }));
    const updated = { ...current, scenes };
    saveCollection(window.localStorage, projectId, updated);
    collection.current = updated;
    // Stop the outgoing document's autosave until navigation completes.
    blocked.current = true;
    setProjectScenes(scenes);
    return scenes[Math.min(index, scenes.length - 1)];
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
  return { document, updateDocument, importDocument, status, error, hydrated, retrySave: () => persist(document), projectScenes, activeSceneId, projectId, addProjectScene, removeProjectScene, renameProjectScene, replaceCollection };
}
