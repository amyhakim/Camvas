'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ExternalLink, Search, X } from 'lucide-react';
import { SCENES, sceneManifestUrl } from '@/features/scene/catalog';
import type { SuperSplatScene } from '@/features/scene/supersplat';
import styles from './project-home.module.css';

type Props = { initialName: string; initialSceneId: string; onClose: () => void; onCreate: (name: string, sceneId: string, sceneName: string) => void };

export function NewProjectDialog({ initialName, initialSceneId, onClose, onCreate }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [name, setName] = useState(initialName);
  const [mode, setMode] = useState<'search' | 'built-in'>(initialSceneId === 'studio' ? 'built-in' : 'search');
  const [sceneId, setSceneId] = useState(initialSceneId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SuperSplatScene[] | null>(null);
  const [selected, setSelected] = useState<SuperSplatScene | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current;
    element?.showModal();
    nameInput.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { request.current?.abort(); element?.close(); document.body.style.overflow = overflow; opener?.focus(); };
  }, []);

  function changeQuery(value: string) {
    request.current?.abort();
    setQuery(value); setResults(null); setSelected(null); setSearching(false); setSearchError(''); setError('');
  }

  async function search(value = query) {
    const q = value.trim();
    if (q.length < 2) { setSearchError('Enter at least two characters to find a scene.'); return; }
    request.current?.abort();
    const abort = new AbortController(); request.current = abort;
    setQuery(value); setSearching(true); setSearchError(''); setError(''); setSelected(null); setResults(null);
    try {
      const response = await fetch(`/api/scenes/search?q=${encodeURIComponent(q)}`, { signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search could not finish. Try again.');
      if (!abort.signal.aborted) setResults(data.results);
    } catch (cause) {
      if (!abort.signal.aborted) setSearchError(cause instanceof Error ? cause.message : 'Search could not finish. Try again.');
    } finally { if (!abort.signal.aborted) setSearching(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating || (mode === 'search' && !selected)) return;
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a project name.'); return; }
    setError(''); setCreating(true);
    const abort = new AbortController(); request.current?.abort(); request.current = abort;
    try {
      if (mode === 'search' && selected) {
        const response = await fetch(sceneManifestUrl(selected.id)!, { signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'This scene could not be opened. Choose another scene.');
      }
      if (!abort.signal.aborted) onCreate(trimmed, mode === 'search' ? selected!.id : sceneId, mode === 'search' ? selected!.name : SCENES.find(scene => scene.id === sceneId)!.name);
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Project could not be created. Try again.');
    } finally { if (!abort.signal.aborted) setCreating(false); }
  }

  return <dialog ref={dialog} className={`${styles.modal} ${styles.discoveryDialog}`} aria-labelledby="add-title" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className={styles.modalHeading}><div><h2 id="add-title">Start something new</h2><p>Find a setting for your next camera move.</p></div><button type="button" onClick={onClose} aria-label="Close" className={styles.close}><X size={18} /></button></div>
    <form onSubmit={create}>
      <label htmlFor="project-name">Project name</label>
      <input id="project-name" ref={nameInput} required maxLength={100} value={name} disabled={creating} onChange={event => setName(event.target.value)} placeholder="My scene study" />
      <div className={styles.sceneModes} aria-label="Scene source">
        <button type="button" aria-pressed={mode === 'search'} disabled={creating} onClick={() => { setMode('search'); setError(''); }}>Find on SuperSplat</button>
        <button type="button" aria-pressed={mode === 'built-in'} disabled={creating} onClick={() => { request.current?.abort(); setSearching(false); setMode('built-in'); setError(''); }}>Built-in scenes</button>
      </div>
      {mode === 'built-in' ? <><label htmlFor="project-scene">Starting scene</label><select id="project-scene" value={sceneId} disabled={creating} onChange={event => setSceneId(event.target.value)}>{SCENES.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></> : <div className={styles.sceneDiscovery}>
        <label htmlFor="scene-query">What kind of scene are you looking for?</label>
        <div className={styles.sceneSearch}><input id="scene-query" value={query} maxLength={160} disabled={creating} placeholder="e.g. greenhouse, library, Japanese house" aria-describedby="scene-search-hint" onChange={event => changeQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!searching) void search(); } }} /><button type="button" className={styles.searchButton} disabled={searching || creating || query.trim().length < 2} onClick={() => void search()}><Search size={16} />{searching ? 'Searching…' : 'Find scenes'}</button></div>
        <p id="scene-search-hint" className={styles.searchHint}>Search public scene titles and descriptions on SuperSplat.</p>
        {results === null && !searching && !searchError && <div className={styles.searchExamples}><span>Try</span>{['Greenhouse', 'Library', 'Japanese house'].map(example => <button type="button" key={example} disabled={creating} onClick={() => void search(example)}>{example}</button>)}</div>}
        <div role="status" aria-live="polite" className={styles.searchStatus}>{searching ? 'Looking for scenes on SuperSplat…' : results ? results.length ? `${results.length} scenes found. Choose a starting scene.` : 'No scenes found. Try a place or a simpler description, such as “garden”.' : ''}</div>
        {searchError && <p className={styles.error} role="alert">{searchError}</p>}
        {!!results?.length && <div className={styles.sceneResults} role="group" aria-label="SuperSplat scenes">
          {results.map(scene => <article className={styles.sceneResult} data-selected={selected?.id === scene.id} key={scene.id}>
            <button className={styles.sceneChoice} type="button" aria-pressed={selected?.id === scene.id} aria-label={`Choose ${scene.name}`} disabled={creating} onClick={() => { setSelected(scene); setError(''); }}>
              {/* Remote creator thumbnails are displayed directly, without downloading or rehosting. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={scene.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <span className={styles.sceneResultCopy}><strong>{scene.name}</strong><span>by {scene.author}</span><span>{scene.sizeBytes ? `${Math.round(scene.sizeBytes / 1_000_000)} MB` : 'Size unavailable'}{scene.license ? ` · ${scene.license === 'cc0' ? 'CC0' : `CC ${scene.license.toUpperCase()}`}` : ''}</span></span>
              <span className={styles.sceneCheck} aria-hidden="true">{selected?.id === scene.id && <Check size={16} />}</span>
            </button>
            <a className={styles.scenePreview} href={scene.sourceUrl} target="_blank" rel="noreferrer">Preview on SuperSplat <ExternalLink size={12} /><span className="sr-only">: {scene.name} (opens in a new tab)</span></a>
          </article>)}
        </div>}
        {selected && <p className={styles.selectedScene}><Check size={15} />Starting with <strong>{selected.name}</strong></p>}
      </div>}
      <p className={styles.projectNote}>{mode === 'search' ? 'Scenes stream from SuperSplat. Each capture’s scale and detail vary; check the creator’s terms before reuse.' : 'Each project keeps its own camera move, actors, props, and scene edits.'}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.modalActions}><button type="button" className={styles.cancel} onClick={onClose}>Cancel</button><button type="submit" className={styles.primary} disabled={creating || (mode === 'search' && !selected)}>{creating ? 'Opening scene…' : 'Create project'}<ArrowRight size={16} /></button></div>
    </form>
  </dialog>;
}
