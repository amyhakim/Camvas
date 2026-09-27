'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { ProjectDocument, ViewportHandle } from '@/contracts';
import type { SemanticView } from '@/contracts/semantics';
import { groundSemanticProposal, semanticRevision } from './model';

type Options = {
  project: ProjectDocument; splat?: boolean; ready: boolean; supported: boolean; scope: string;
  viewport: RefObject<ViewportHandle | null>; onCommit: (project: ProjectDocument) => void; onPause: () => void;
};

/** Scene-owned work: opening or closing the labels panel never starts or cancels it. */
export function useBackgroundLabels(options: Options) {
  const latest = useRef(options); latest.current = options;
  const request = useRef<AbortController | null>(null);
  const attempted = useRef(new Set<string>());
  const [status, setStatus] = useState('Labels will be generated automatically when the scene is ready.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [views, setViews] = useState<SemanticView[]>([]);
  const key = `${options.scope}:${semanticRevision(options.project)}`;

  function cancel() {
    request.current?.abort(); request.current = null;
    setBusy(false); setStatus('Labeling cancelled. Retry whenever you are ready.');
  }
  async function generate() {
    const current = latest.current;
    if (request.current || !current.ready || !current.supported || !current.viewport.current) return;
    const before = current.project, scope = current.scope;
    attempted.current.add(`${scope}:${semanticRevision(before)}`);
    const controller = new AbortController(); request.current = controller;
    const isCurrent = () => !controller.signal.aborted && latest.current.project === before && latest.current.scope === scope;
    setBusy(true); setError(''); setViews([]); setStatus('Capturing four views of the original scene…'); current.onPause();
    let collision = before.collision;
    let preparationNote = '';
    try {
      if (current.splat) {
        if (!current.viewport.current.prepareSplat) throw Error('Splat preparation is unavailable. Reload the editor.');
        setStatus('Fitting blocks to the captured surfaces…');
        await current.viewport.current.prepareSplat(controller.signal, message => { if (isCurrent()) setStatus(message); });
        if (!isCurrent()) return;
        if (!collision) {
          setStatus('Preparing separate navigation boxes around the view…');
          try { collision = await current.viewport.current.generateCollision({ radius: 12, cellSize: 1 }, message => { if (isCurrent()) setStatus(message); }, controller.signal); }
          catch (cause) { preparationNote = ` Navigation boxes need attention: ${cause instanceof Error ? cause.message : 'Generate them in Project.'}`; }
          if (!isCurrent()) return;
        }
      }
      setStatus('Capturing four views of the original scene…');
      const snapshot = await current.viewport.current.captureSemantics(semanticRevision(before), controller.signal);
      if (!isCurrent()) return;
      setViews(snapshot.views); setStatus('AI is identifying sections in the background…');
      const response = await fetch('/api/semantic-labels', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(snapshot), signal: controller.signal });
      const body = await response.json();
      if (!isCurrent()) return;
      if (!response.ok) throw new Error(body.error || 'Labeling failed.');
      const next = groundSemanticProposal(body.proposal ?? body, snapshot);
      if (!next.regions.length) throw new Error('AI could not identify sections confidently. Try another viewing angle.');
      latest.current.onCommit({ ...before, ...(collision ? { collision } : {}), semantics: next });
      setStatus(`${next.regions.length} suggested labels saved. Review their labels and extents before camera planning.${preparationNote}`);
    } catch (cause) {
      if (isCurrent()) { if (collision && collision !== before.collision) latest.current.onCommit({ ...before, collision }); setError((cause instanceof Error ? cause.message : 'Labeling failed.') + preparationNote); }
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }

  useEffect(() => {
    // Any document edit invalidates the captured snapshot; never overwrite newer work.
    return () => {
      if (request.current) {
        request.current.abort(); request.current = null;
        setStatus('The project changed during labeling. Existing work was kept; retry labeling.');
      }
    };
  }, [options.project, options.scope]);
  useEffect(() => {
    setBusy(false);
    setViews([]);
    setError('');
    setStatus('Labels will be generated automatically when the scene is ready.');
  }, [options.scope]);
  useEffect(() => {
    if (!request.current) setBusy(false);
    if (!options.ready || !options.supported || options.project.semantics || attempted.current.has(key)) return;
    const timer = window.setTimeout(() => {
      if (!request.current && !attempted.current.has(key)) void generate();
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [options.ready, options.supported, options.project, key]);

  return { busy, error, views, generate, cancel, attempted: attempted.current.has(key), status: !options.supported ? 'Wait for a supported scene to finish loading.' : status };
}
export type BackgroundLabels = ReturnType<typeof useBackgroundLabels>;
