'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button, TextField } from '@/components/ui/primitives';
import type { ProjectDocument, ProjectStatus } from '../../contracts';
import { MAX_PROJECT_BYTES, parseProject, serializeProject } from './model';
import styles from './project.module.css';

export type ProjectControlsProps = {
  document: ProjectDocument; status: ProjectStatus; error: string | null;
  onNameChange: (name: string) => void; onImport: (document: ProjectDocument) => void; onRetrySave: () => void;
  onGraphExport?: () => void;
  sceneOnly?: boolean;
};
const statusLabels: Record<ProjectStatus, string> = { loading: 'Restoring browser project…', saved: 'Saved in this browser', saving: 'Saving in this browser…', error: 'Browser save needs attention' };

export function ProjectControls({ document: project, status, error, onNameChange, onImport, onRetrySave, onGraphExport, sceneOnly = true }: ProjectControlsProps) {
  const id = useId(), chooser = useRef<HTMLInputElement>(null), request = useRef(0);
  const [name, setName] = useState(project.name);
  useEffect(() => { setName(project.name); }, [project.name]);
  const [fileError, setFileError] = useState<string | null>(null), [reading, setReading] = useState(false);
  useEffect(() => { request.current++; setReading(false); setFileError(null); return () => { request.current++; }; }, [project.sceneId]);
  async function importFile(file: File | undefined) {
    if (!file) return;
    const token = ++request.current;
    setReading(true); setFileError(null);
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 1 MB limit. Choose a smaller Camvas JSON export.');
      const document = parseProject(await file.text(), project.sceneId);
      if (token === request.current) onImport(document);
    } catch (error) { if (token === request.current) setFileError(error instanceof Error ? error.message : 'The file could not be read. Choose another Camvas JSON export.'); }
    finally { if (token === request.current) setReading(false); }
  }
  function download() {
    setFileError(null);
    try {
      const blob = new Blob([serializeProject(project)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = window.document.createElement('a');
      link.href = url; link.download = `${project.name.trim().replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80) || 'showcam-project'}.showcam.json`;
      window.document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Export failed. Correct the project and try again.'); }
  }
  return <div className={`${styles.root} project-controls`} aria-busy={reading || status === 'loading'}>
    <TextField id={`${id}-name`} label="Project name" value={name} maxLength={100} onChange={event => { const next = event.target.value; setName(next); if (next.trim() && next.trim().length <= 100) onNameChange(next.trim()); }} error={!name.trim() ? 'Enter a project name to save or export.' : undefined} />
    <p className="project-status" role="status" aria-live="polite" data-status={status}>{statusLabels[status]}</p>
    {error && <p className="project-error" role="alert">{error}</p>}
    {status === 'error' && <Button size="sm" onClick={onRetrySave}>Retry browser save</Button>}
    <div className="project-actions">
      <Button size="sm" onClick={download} disabled={status === 'loading' || !name.trim()}><Download size={16} aria-hidden="true" />{sceneOnly ? 'Export scene' : 'Export JSON'}</Button>
      <Button size="sm" onClick={() => chooser.current?.click()} loading={reading} disabled={status === 'loading'}><Upload size={16} aria-hidden="true" />{sceneOnly ? 'Import scene' : 'Import JSON'}</Button>
      {onGraphExport && <Button size="sm" onClick={onGraphExport} disabled={status === 'loading'}><Download size={16} aria-hidden="true" />Export scene graph</Button>}
      <input ref={chooser} className="sr-only" type="file" accept=".json,application/json" aria-label="Choose Camvas project JSON" tabIndex={-1} onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
    <p className="project-hint">{sceneOnly ? 'These buttons exchange the current scene only. For a named project, use the controls below to exchange all scenes.' : 'Browser saves stay on this device. Export a copy to keep or share. Import replaces this project’s camera move, actors, props, and collision boxes.'}</p>
    {fileError && <p className="project-error" role="alert">{fileError}</p>}
  </div>;
}
