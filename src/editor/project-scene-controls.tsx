'use client';

import { useEffect, useState } from 'react';
import type { ProjectDocument } from '@/contracts';
import { SCENES, isSupportedScene } from '@/features/scene/catalog';
import { MAX_COLLECTION_BYTES, parseCollection, serializeCollection, type ProjectCollection, type ProjectScene } from '@/features/project/collection';

export function ProjectSceneControls({ scenes, selectedId, document, onOpen, onAdd, onRename, onImport }: {
  scenes: ProjectScene[]; selectedId: string | null; document: ProjectDocument;
  onOpen: (scene: ProjectScene) => void; onAdd: (assetSceneId: string) => void; onRename: (id: string, name: string) => void;
  onImport: (project: ProjectCollection) => void;
}) {
  const [assetSceneId, setAssetSceneId] = useState<string>(SCENES[0].id);
  const [error, setError] = useState('');
  const current = scenes.find(scene => scene.id === selectedId);
  const [sceneName, setSceneName] = useState(current?.name ?? '');
  useEffect(() => { setSceneName(current?.name ?? ''); }, [current?.id, current?.name]);
  function commitName() {
    if (!current || sceneName === current.name) return;
    try { onRename(current.id, sceneName); setError(''); }
    catch (cause) { setSceneName(current.name); setError(cause instanceof Error ? cause.message : 'Could not rename scene.'); }
  }
  function exportProject() {
    try {
      const snapshot: ProjectCollection = { format: 'showcam-collection', version: 1, name: document.name, scenes: scenes.map(scene => scene.id === selectedId ? { ...scene, document } : scene) };
      const blob = new Blob([serializeCollection(snapshot)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = window.document.createElement('a');
      link.href = url; link.download = `${document.name.trim().replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'showcam-project'}.showcam.json`;
      window.document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not export project.'); }
  }
  async function importProject(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > MAX_COLLECTION_BYTES) throw new Error('Project exceeds the 4 MB limit.');
      const next = parseCollection(await file.text());
      if (next.scenes.some(scene => !isSupportedScene(scene.document.sceneId))) throw new Error('This project uses a scene asset that Camvas cannot open.');
      onImport(next);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not import project.'); }
  }
  return <section className="project-scene-controls" aria-label="Project scenes">
    <h3>Scenes</h3>
    <p>Each scene keeps its own actors, landmarks, and camera move.</p>
    <label>Current scene<select value={selectedId ?? ''} onChange={event => { const scene = scenes.find(item => item.id === event.target.value); if (scene) onOpen(scene); }}>{scenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
    {current && <label>Scene name<input value={sceneName} maxLength={100} onChange={event => setSceneName(event.target.value)} onBlur={commitName} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitName(); } }} /></label>}
    <label>New scene source<select value={assetSceneId} onChange={event => setAssetSceneId(event.target.value)}>{SCENES.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>
    <button type="button" onClick={() => { try { onAdd(assetSceneId); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add scene.'); } }}>Add scene</button>
    <button type="button" onClick={exportProject}>Export whole project</button>
    <label>Import whole project<input type="file" accept=".json,application/json" onChange={event => { void importProject(event.target.files?.[0]); event.target.value = ''; }} /></label>
    {error && <p role="alert">{error}</p>}
  </section>;
}
