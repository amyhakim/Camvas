'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Aperture, ArrowRight, Clapperboard, FolderOpen, Lightbulb, Plus, Scan, Sparkles } from 'lucide-react';
import type { ProjectDocument } from '@/contracts';
import { SCENES, DEFAULT_SCENE_ID } from '@/features/scene/catalog';
import { namedProjectStorageKey, parseProject, projectStorageKey } from './model';
import { createCollection, parseCollection, saveCollection, type ProjectCollection } from './collection';
import styles from './project-home.module.css';

type ListedProject = { id: string | null; collection: ProjectCollection };
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

export function ProjectHome() {
  const [projects, setProjects] = useState<ListedProject[] | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [sceneId, setSceneId] = useState<string>(DEFAULT_SCENE_ID);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    try { const result = readProjects(window.localStorage); setProjects(result.projects); if (result.skipped) setError(`${result.skipped} saved ${result.skipped === 1 ? 'project could' : 'projects could'} not be read. The other projects are available.`); }
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
        {projects === null ? <p className={styles.message} role="status">Loading your projects…</p> : projects.length === 0 ? <div className={styles.empty}><FolderOpen size={32} /><h3>No projects yet</h3><p>Start with a scene and make your first camera move.</p><button type="button" className={styles.emptyAction} onClick={() => setAdding(true)}>Create a project <ArrowRight size={16} /></button></div> : <div className={styles.grid}>{projects.map(project => <Link className={styles.card} href={editorHref(project)} key={project.id ?? `legacy:${project.collection.scenes[0].document.sceneId}`}><div className={styles.cardVisual}><span className={styles.sceneBadge}>{sceneName(project.collection.scenes[0].document.sceneId)}</span><Clapperboard size={41} strokeWidth={1.2} /></div><div className={styles.cardBody}><div><h3>{project.collection.name}</h3><p>{project.collection.scenes.length} {project.collection.scenes.length === 1 ? 'scene' : 'scenes'} · {project.collection.scenes.reduce((count, scene) => count + scene.document.actors.length, 0)} actors</p></div><span className={styles.openIcon}><ArrowRight size={18} /></span></div></Link>)}</div>}
      </section>
      {error && !adding && <p className={styles.error} role="alert">{error}</p>}
    </div>
    {adding && <div className={styles.modalBackdrop} onMouseDown={event => { if (event.target === event.currentTarget) setAdding(false); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="add-title"><div className={styles.modalHeading}><div><span className={styles.eyebrow}>NEW PROJECT</span><h2 id="add-title">Start something new</h2></div><button type="button" onClick={() => setAdding(false)} aria-label="Close" className={styles.close}>×</button></div><form onSubmit={addProject}><label htmlFor="project-name">Project name</label><input id="project-name" autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="My scene study" /><label htmlFor="project-scene">Starting scene</label><select id="project-scene" value={sceneId} onChange={event => setSceneId(event.target.value)}>{SCENES.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select><p>Each project keeps its own camera move, actors, props, and scene edits.</p>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.modalActions}><button type="button" className={styles.cancel} onClick={() => setAdding(false)}>Cancel</button><button type="submit" className={styles.primary}>Create project <ArrowRight size={16} /></button></div></form></section></div>}
  </main>;
}
