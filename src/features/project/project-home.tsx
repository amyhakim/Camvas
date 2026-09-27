'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Aperture, ArrowRight, Clapperboard, FolderOpen, Plus, Sparkles } from 'lucide-react';
import type { ProjectDocument } from '@/contracts';
import { SCENES, DEFAULT_SCENE_ID, isSupportedScene } from '@/features/scene/catalog';
import { namedProjectStorageKey, parseProject, projectStorageKey } from './model';
import { createCollection, parseCollection, saveCollection, type ProjectCollection } from './collection';
import { NewProjectDialog } from './new-project-dialog';
import styles from './project-home.module.css';
import { ensureFuseProject } from './fuse-project';
import { ensureGreenhouseProject } from './greenhouse-project';
import { withLastLightSoundtrack } from './last-light-project';
import { WorkspaceNav } from './workspace-nav';

type ListedProject = { id: string | null; collection: ProjectCollection };
const pavilionGraphProjectId = 'pavilion-scene-graph';
const sceneName = (project: ListedProject) => {
  const scene = project.collection.scenes[0];
  return SCENES.find(source => source.id === scene.document.sceneId)?.name ?? scene.name;
};
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
      if (!collection || !isSupportedScene(collection.scenes[0].document.sceneId)) { skipped++; continue; }
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

  function addProject(projectName: string, sourceId: string, sourceName: string) {
    const id = crypto.randomUUID();
    const document: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: sourceId, name: projectName, shot: null, actors: [] };
    const collection = createCollection(document, `scene:${crypto.randomUUID()}`);
    collection.scenes[0].name = sourceName;
    saveCollection(window.localStorage, id, collection);
    window.location.assign(editorHref({ id, collection }));
  }

  return <main id="main" className={styles.shell}>
    <WorkspaceNav active="projects" />
    <div className={styles.content}>
      <h1 className="sr-only">Your workspace</h1>
      <section className={styles.quickStart} aria-label="Start a project">
        <article className={`${styles.quickCard} ${styles.workspaceCard}`}>
          <Clapperboard className={styles.quickArt} size={96} strokeWidth={1} aria-hidden="true" />
          <span className={styles.eyebrow}><Sparkles size={14} /> THE CREATIVE WORKSPACE</span>
          <h2>Every scene starts somewhere<span>.</span></h2>
          <p>Pick a scene and create your next camera move.</p>
          <button className={styles.primary} type="button" onClick={() => { setSceneId(DEFAULT_SCENE_ID); setName(''); setAdding(true); }}><Plus size={17} /> Add project <ArrowRight size={16} /></button>
        </article>
        <article className={`${styles.quickCard} ${styles.studioCard}`}>
          <Aperture className={styles.quickArt} size={96} strokeWidth={1} aria-hidden="true" />
          <span className={styles.eyebrow}><Aperture size={14} /> PRODUCT STUDIO</span>
          <h2>Shoot your product like a commercial.</h2>
          <p>Bring in a .glb, light it, and render your film.</p>
          <div className={styles.quickActions}><button className={styles.primary} type="button" onClick={() => { setSceneId('studio'); setName('Product film'); setAdding(true); }}><Plus size={17} /> New studio project <ArrowRight size={16} /></button><Link href="/editor?scene=studio">Open studio</Link></div>
        </article>
      </section>
      <section className={styles.library} aria-labelledby="projects-title"><div className={styles.libraryHeading}><div><span className={styles.eyebrow}>PROJECT LIBRARY</span><h2 id="projects-title">Your projects<span>.</span> <small>{projects?.length ?? 0}</small></h2></div><p>Your work is saved in this browser.</p></div>
        {projects === null ? <p className={styles.message} role="status">Loading your projects…</p> : projects.length === 0 ? <div className={styles.empty}><FolderOpen size={32} /><h3>No projects yet</h3><p>Start with a scene and make your first camera move.</p><button type="button" className={styles.emptyAction} onClick={() => setAdding(true)}>Create a project <ArrowRight size={16} /></button></div> : <div className={styles.grid}>{projects.map(project => <Link className={styles.card} href={editorHref(project)} key={project.id ?? `legacy:${project.collection.scenes[0].document.sceneId}`}><div className={styles.cardVisual} style={project.id === 'fuse-warmup' ? { backgroundImage: 'url(/fuse-warmup/output/preview-frame.png)', backgroundSize: 'cover', backgroundPosition: 'center 42%' } : project.id === 'a-little-tending' ? { backgroundImage: 'url(/greenhouse/output/preview.png)', backgroundSize: 'cover', backgroundPosition: 'center 62%' } : project.id === 'last-light-cinematic' ? { backgroundImage: 'url(/films/last-light/preview.png)', backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><span className={styles.sceneBadge}>{sceneName(project)}</span>{project.id !== 'fuse-warmup' && project.id !== 'last-light-cinematic' && project.id !== 'a-little-tending' && <Clapperboard size={41} strokeWidth={1.2} />}</div><div className={styles.cardBody}><div><h3>{project.collection.name}</h3>{project.id === 'last-light-cinematic' ? <p>15 seconds · 1 character · 4 shots</p> : project.id === 'a-little-tending' ? <p>15 seconds · Garden sprite · Camera flight</p> : <p>{project.collection.scenes.length} {project.collection.scenes.length === 1 ? 'scene' : 'scenes'} · {project.collection.scenes.reduce((count, scene) => count + scene.document.actors.length, 0)} actors</p>}</div><span className={styles.openIcon}><ArrowRight size={18} /></span></div></Link>)}</div>}
      </section>
      {error && !adding && <p className={styles.error} role="alert">{error}</p>}
    </div>
    {adding && <NewProjectDialog initialName={name} initialSceneId={sceneId} onClose={() => setAdding(false)} onCreate={addProject} />}
  </main>;
}
