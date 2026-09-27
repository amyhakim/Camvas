'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Clapperboard, FolderOpen, Plus } from 'lucide-react';
import type { ProjectDocument } from '@/contracts';
import { SCENES, DEFAULT_SCENE_ID } from '@/features/scene/catalog';
import { namedProjectStorageKey, parseProject, projectStorageKey } from './model';
import { createCollection, parseCollection, saveCollection, type ProjectCollection } from './collection';
import styles from './project-home.module.css';
import { ensureFuseProject } from './fuse-project';
import { ensureGreenhouseProject } from './greenhouse-project';
import { withLastLightSoundtrack } from './last-light-project';
import { WorkspaceNav } from './workspace-nav';

type ListedProject = { id: string | null; collection: ProjectCollection };
const pavilionGraphProjectId = 'pavilion-scene-graph';
const sceneName = (id: string) => SCENES.find(scene => scene.id === id)?.name ?? id;
const editorHref = (project: ListedProject) => {
  const first = project.collection.scenes[0];
  return project.id
    ? `/editor?scene=${encodeURIComponent(first.document.sceneId)}&project=${encodeURIComponent(project.id)}&entry=${encodeURIComponent(first.id)}`
    : `/editor?scene=${encodeURIComponent(first.document.sceneId)}`;
};

function readProjects(storage: Storage): { projects: ListedProject[]; skipped: number } {
  const projects: ListedProject[] = [];
  let skipped = 0;
  for (const scene of SCENES) {
    const bytes = storage.getItem(projectStorageKey(scene.id));
    if (bytes) try { projects.push({ id: null, collection: createCollection(parseProject(bytes, scene.id), 'scene:legacy') }); } catch { skipped++; }
  }
  const prefix = namedProjectStorageKey('');
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const bytes = storage.getItem(key);
    if (!bytes) continue;
    try {
      const raw = JSON.parse(bytes) as { format?: unknown; sceneId?: unknown };
      const collection = raw.format === 'showcam-collection' ? parseCollection(bytes)
        : typeof raw.sceneId === 'string' ? createCollection(parseProject(bytes, raw.sceneId), 'scene:legacy') : null;
      if (!collection || !SCENES.some(scene => scene.id === collection.scenes[0].document.sceneId)) { skipped++; continue; }
      projects.push({ id: decodeURIComponent(key.slice(prefix.length)), collection });
    } catch { skipped++; }
  }
  return { projects, skipped };
}

function ensurePavilionGraphProject(storage: Storage) {
  if (storage.getItem(namedProjectStorageKey(pavilionGraphProjectId))) return;
  const document: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Pavilion Scene Graph', shot: null, actors: [] };
  const collection = createCollection(document, 'scene:pavilion-graph');
  collection.scenes[0].name = 'Barcelona Pavilion';
  saveCollection(storage, pavilionGraphProjectId, collection);
}

function ensureLastLightProject(storage: Storage) {
  const id = 'last-light-cinematic';
  if (storage.getItem(namedProjectStorageKey(id))) return;
  const document = withLastLightSoundtrack({ format: 'showcam-project', version: 1, sceneId: 'last-light', name: 'Last Light', shot: null, actors: [] });
  const collection = createCollection(document, 'scene:last-light');
  collection.scenes[0].name = 'Beach departure';
  saveCollection(storage, id, collection);
}

export function ProjectHome() {
  const [projects, setProjects] = useState<ListedProject[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sceneId, setSceneId] = useState<string>(DEFAULT_SCENE_ID);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    try { ensureFuseProject(window.localStorage); ensurePavilionGraphProject(window.localStorage); ensureLastLightProject(window.localStorage); ensureGreenhouseProject(window.localStorage); const result = readProjects(window.localStorage); setProjects(result.projects); if (result.skipped) setError(`${result.skipped} saved ${result.skipped === 1 ? 'project could' : 'projects could'} not be read. The other projects are available.`); }
    catch (cause) { setProjects([]); setError(cause instanceof Error ? cause.message : 'Projects could not be read from this browser.'); }
  }, []);

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) { setError('Enter a project name of up to 100 characters.'); return; }
    const id = crypto.randomUUID();
    const document: ProjectDocument = { format: 'showcam-project', version: 1, sceneId, name: trimmed, shot: null, actors: [] };
    const collection = createCollection(document, `scene:${crypto.randomUUID()}`);
    try {
      saveCollection(window.localStorage, id, collection);
      window.location.assign(editorHref({ id, collection }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Project could not be created.'); }
  }

  return <main id="main" className={styles.shell}>
    <WorkspaceNav active="projects" />
    <div className={styles.content}>
      <section className={styles.library} aria-labelledby="projects-title"><div className={styles.intro}><div><span className={styles.eyebrow}>YOUR WORKSPACE</span><h1 id="projects-title">Your projects<span>.</span> <small>{projects?.length ?? 0}</small></h1><p>Pick up where you left off, or start something new. Your work is saved in this browser.</p></div><button type="button" className={styles.primary} onClick={() => setAdding(true)}><Plus size={18} /> New project <ArrowRight size={17} /></button></div>
        {projects === null ? <p className={styles.message} role="status">Loading your projects…</p> : projects.length === 0 ? <div className={styles.empty}><FolderOpen size={32} /><h3>No projects yet</h3><p>Start with a scene and make your first camera move.</p><button type="button" className={styles.emptyAction} onClick={() => setAdding(true)}>Create a project <ArrowRight size={16} /></button></div> : <div className={styles.grid}>{projects.map(project => <Link className={styles.card} href={editorHref(project)} key={project.id ?? `legacy:${project.collection.scenes[0].document.sceneId}`}><div className={styles.cardVisual} style={project.id === 'fuse-warmup' ? { backgroundImage: 'url(/fuse-warmup/output/preview-frame.png)', backgroundSize: 'cover', backgroundPosition: 'center 42%' } : project.id === 'a-little-tending' ? { backgroundImage: 'url(/greenhouse/output/preview.png)', backgroundSize: 'cover', backgroundPosition: 'center 62%' } : project.id === 'last-light-cinematic' ? { backgroundImage: 'url(/films/last-light/preview.png)', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span className={styles.sceneBadge}>{sceneName(project.collection.scenes[0].document.sceneId)}</span>{project.id !== 'fuse-warmup' && project.id !== 'last-light-cinematic' && project.id !== 'a-little-tending' && <Clapperboard size={41} strokeWidth={1.2} />}</div><div className={styles.cardBody}><div><h3>{project.collection.name}</h3>{project.id === 'last-light-cinematic' ? <p>15 seconds · 1 character · 4 shots</p> : project.id === 'a-little-tending' ? <p>15 seconds · Garden sprite · Camera flight</p> : <p>{project.collection.scenes.length} {project.collection.scenes.length === 1 ? 'scene' : 'scenes'} · {project.collection.scenes.reduce((count, scene) => count + scene.document.actors.length, 0)} actors</p>}</div><span className={styles.openIcon}><ArrowRight size={18} /></span></div></Link>)}</div>}
      </section>
      {error && !adding && <p className={styles.error} role="alert">{error}</p>}
    </div>
    {adding && <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setAdding(false); }}>
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="add-title">
        <div className={styles.modalHeading}><div><span className={styles.eyebrow}>NEW PROJECT</span><h2 id="add-title">Start something new</h2></div><button type="button" onClick={() => setAdding(false)} aria-label="Close" className={styles.close}>×</button></div>
        <form onSubmit={addProject}>
          <label htmlFor="project-name">Project name</label><input id="project-name" autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="My scene study" />
          <span className={styles.fieldLabel}>Start with</span>
          <div className={styles.startChoices}>
            <button type="button" className={styles.startChoice} aria-pressed={sceneId !== 'studio'} onClick={() => setSceneId(DEFAULT_SCENE_ID)}><strong>Scene project</strong><span>Build a shot in a ready-made scene.</span></button>
            <button type="button" className={styles.startChoice} aria-pressed={sceneId === 'studio'} onClick={() => setSceneId('studio')}><strong>Product Studio</strong><span>Light and film your own .glb.</span></button>
          </div>
          {sceneId !== 'studio' && <><label htmlFor="project-scene">Starting scene</label><select id="project-scene" value={sceneId} onChange={event => setSceneId(event.target.value)}>{SCENES.filter(scene => scene.id !== 'studio').map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></>}
          <p>Each project keeps its own camera move, actors, props, and scene edits.</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.modalActions}><button type="button" className={styles.cancel} onClick={() => setAdding(false)}>Cancel</button><button type="submit" className={styles.primary}>Create project <ArrowRight size={16} /></button></div>
        </form>
      </section>
    </div>}
  </main>;
}
