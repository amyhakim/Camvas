'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Aperture, ArrowRight, Clapperboard, FolderOpen, Lightbulb, Plus, Scan, Sparkles } from 'lucide-react';
import type { ProjectDocument } from '@/contracts';
import { SCENES, DEFAULT_SCENE_ID, isSupportedScene } from '@/features/scene/catalog';
import { namedProjectStorageKey, parseProject, projectStorageKey } from './model';
import { createCollection, parseCollection, saveCollection, type ProjectCollection } from './collection';
import { NewProjectDialog } from './new-project-dialog';
import styles from './project-home.module.css';

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

export function ProjectHome() {
  const [projects, setProjects] = useState<ListedProject[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sceneId, setSceneId] = useState<string>(DEFAULT_SCENE_ID);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    try { ensurePavilionGraphProject(window.localStorage); const result = readProjects(window.localStorage); setProjects(result.projects); if (result.skipped) setError(`${result.skipped} saved ${result.skipped === 1 ? 'project could' : 'projects could'} not be read. The other projects are available.`); }
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
    <header className={styles.header}><Link className={styles.brand} href="/" aria-label="Showcam home"><Scan size={25} strokeWidth={1.7} />showcam<span>.</span></Link><span className={styles.headerNote}>Your workspace</span></header>
    <div className={styles.content}>
      <section className={styles.hero} aria-labelledby="home-title"><div className={styles.heroCopy}><span className={styles.eyebrow}><Sparkles size={14} /> THE CREATIVE WORKSPACE</span><h1 id="home-title">Every scene starts<br />somewhere<span>.</span></h1><p>Pick up where you left off, or start a new project. Your work is saved in this browser as you create.</p><button className={styles.primary} type="button" onClick={() => setAdding(true)}><Plus size={18} /> Add project <ArrowRight size={17} /></button></div><div className={styles.heroArt} aria-hidden="true"><div className={styles.orbitOne} /><div className={styles.orbitTwo} /><div className={styles.artCore}><Clapperboard size={58} strokeWidth={1.1} /></div><span className={styles.artLabel}>MAKE THE SCENE YOURS</span></div></section>
      <section className={styles.studio} aria-labelledby="studio-title">
        <div className={styles.studioCopy}>
          <span className={styles.eyebrow}><Aperture size={14} /> PRODUCT STUDIO</span>
          <h2 id="studio-title">Shoot your product like a commercial.</h2>
          <p>Drop in a .glb, light it with a studio rig and captured HDRI reflections, move a real-lens camera around it, and render a film-grade MP4, all in the browser.</p>
          <div className={styles.studioActions}>
            <Link className={styles.primary} href="/editor?scene=studio">Open the studio <ArrowRight size={16} /></Link>
            <button type="button" className={styles.studioSecondary} onClick={() => { setSceneId('studio'); setName('Product film'); setAdding(true); }}><Plus size={16} /> New studio project</button>
          </div>
          <ul className={styles.studioChips}><li><Lightbulb size={13} /> Studio lighting</li><li><Aperture size={13} /> Real lens optics</li><li><Clapperboard size={13} /> Up to 4K render</li></ul>
        </div>
        <div className={styles.studioArt} aria-hidden="true"><span className={styles.studioBeam} /><span className={styles.studioFloor} /></div>
      </section>
      <section className={styles.library} aria-labelledby="projects-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>PROJECT LIBRARY</span><h2 id="projects-title">Your projects <span>{projects?.length ?? 0}</span></h2></div><button type="button" className={styles.addSmall} onClick={() => setAdding(true)}><Plus size={16} /> New project</button></div>
        {projects === null ? <p className={styles.message} role="status">Loading your projects…</p> : projects.length === 0 ? <div className={styles.empty}><FolderOpen size={32} /><h3>No projects yet</h3><p>Start with a scene and make your first camera move.</p><button type="button" className={styles.emptyAction} onClick={() => setAdding(true)}>Create a project <ArrowRight size={16} /></button></div> : <div className={styles.grid}>{projects.map(project => <Link className={styles.card} href={editorHref(project)} key={project.id ?? `legacy:${project.collection.scenes[0].document.sceneId}`}><div className={styles.cardVisual}><span className={styles.sceneBadge}>{sceneName(project)}</span><Clapperboard size={41} strokeWidth={1.2} /></div><div className={styles.cardBody}><div><h3>{project.collection.name}</h3><p>{project.collection.scenes.length} {project.collection.scenes.length === 1 ? 'scene' : 'scenes'} · {project.collection.scenes.reduce((count, scene) => count + scene.document.actors.length, 0)} actors</p></div><span className={styles.openIcon}><ArrowRight size={18} /></span></div></Link>)}</div>}
      </section>
      {error && !adding && <p className={styles.error} role="alert">{error}</p>}
    </div>
    {adding && <NewProjectDialog initialName={name} initialSceneId={sceneId} onClose={() => setAdding(false)} onCreate={addProject} />}
  </main>;
}
