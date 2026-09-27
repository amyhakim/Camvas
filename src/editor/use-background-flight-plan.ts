import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectDocument, SceneManifest, ViewportHandle } from '@/contracts';
import { DEFAULT_FLIGHT_INTENT } from '@/contracts/automatic-flight';
import { parseProject, serializeProject } from '@/features/project/model';
import { automaticFlightSnapshot, automaticSceneRevision } from './automatic-flight-snapshot';
import { runAutomaticFlight, type FlightStage } from './automatic-flight-workflow';
type Result = Awaited<ReturnType<typeof runAutomaticFlight>>;
type State = { status: 'idle' | 'saved' | 'error' | 'stale' | 'cancelled' | FlightStage; message: string; result: Result | null };
export function useBackgroundFlightPlan(options: {
  project: ProjectDocument; manifest: SceneManifest | null; ready: boolean; scope: string;
  viewport: { current: ViewportHandle | null }; commit: (next: ProjectDocument) => void; canUndo: boolean; undo: () => void;
}) {
  const [intent, setIntentState] = useState(DEFAULT_FLIGHT_INTENT), [enabled, setEnabledState] = useState(true);
  const [state, setState] = useState<State>({ status: 'idle', message: 'Waiting for reviewed labels and geometry. Existing shots are preserved until Generate is requested.', result: null });
  const current = useRef(options); current.current = options;
  const intentRef = useRef(intent); intentRef.current = intent;
  const active = useRef<AbortController | null>(null), attempted = useRef<string | null>(null), lastSaved = useRef<ProjectDocument | null>(null);
  const revision = automaticSceneRevision(options.project);
  const stop = useCallback(() => { active.current?.abort(); active.current = null; setState(s => ({ ...s, status: 'cancelled', message: 'Cancelled. Existing shot unchanged.' })); }, []);
  const start = useCallback(() => {
    const before = current.current;
    if (!before.ready || !before.manifest || !before.viewport.current) return;
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    const document = before.project, scope = before.scope, requestedIntent = intentRef.current;
    attempted.current = `${scope}:${automaticSceneRevision(document)}:${requestedIntent}`;
    const isCurrent = () => current.current.project === document && current.current.scope === scope && intentRef.current === requestedIntent;
    const guard = () => { controller.signal.throwIfAborted(); if (!isCurrent()) throw Error('Project changed. Discarded stale flight.'); };
    setState({ status: 'planning', message: 'Grounding intent in reviewed subjects…', result: null });
    void (async () => {
      try {
        const snapshot = automaticFlightSnapshot(document, before.manifest!, before.viewport.current!, requestedIntent);
        const result = await runAutomaticFlight(snapshot, { signal: controller.signal, isCurrent,
          onStage: (status, attempt) => { guard(); setState({ status, message: `${status[0].toUpperCase()}${status.slice(1)} · attempt ${attempt}/3`, result: null }); },
          request: async (body, signal) => { const response = await fetch('/api/flight-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal }); const data = await response.json(); if (!response.ok) throw Error(data.error || 'Flight request failed.'); return data; },
          render: (samples, signal) => before.viewport.current!.captureFlightViews(samples, signal),
        });
        guard(); const next = parseProject(serializeProject({ ...document, shot: result.shot }), document.sceneId);
        // Back up before committing; storage failures must leave the current shot untouched.
        localStorage.setItem(`showcam-flight-backup:v1:${encodeURIComponent(scope)}`, serializeProject(document));
        localStorage.setItem(`showcam-flight-review:v1:${encodeURIComponent(scope)}`, JSON.stringify({ revision: snapshot.revision, intent: requestedIntent, plan: result.plan, metrics: result.metrics, notes: result.notes, evidenceTimes: result.frames.map(f => f.time) }));
        lastSaved.current = next; current.current.commit(next);
        setState({ status: 'saved', message: 'Saved automatically after geometry, motion and visual checks.', result });
      } catch (error) {
        if (!controller.signal.aborted) setState({ status: isCurrent() ? 'error' : 'stale', message: error instanceof Error ? error.message : 'Could not generate flight.', result: null });
      } finally { if (active.current === controller) active.current = null; }
    })();
  }, []);
  const setIntent = (value: string) => { stop(); intentRef.current = value; setIntentState(value); };
  const setEnabled = (value: boolean) => { setEnabledState(value); if (!value) stop(); };
  useEffect(() => {
    if (active.current) { active.current.abort(); active.current = null; setState({ status: 'stale', message: 'Project changed; discarded the pending route.', result: null }); }
    if (lastSaved.current !== options.project) setState(s => s.status === 'saved' ? { status: 'stale', message: 'Project changed since validation. Generate again to recheck.', result: null } : s);
  }, [options.project, options.scope]);
  useEffect(() => {
    const key = `${options.scope}:${revision}:${intent}`;
    if (!enabled || !options.ready || attempted.current === key || active.current || options.project.shot || !options.project.semantics?.regions.some(r => r.reviewed)) return;
    const timer = setTimeout(() => { if (!active.current && attempted.current !== key) start(); }, 1000);
    return () => clearTimeout(timer);
  }, [enabled, options.ready, options.scope, options.project.shot, options.project.semantics, revision, intent, start]);
  useEffect(() => () => { active.current?.abort(); }, []);
  return { ...state, intent, setIntent, enabled, setEnabled, busy: ['planning', 'validating', 'rendering', 'reviewing', 'refining'].includes(state.status), start, stop,
    canUndo: options.canUndo && lastSaved.current === options.project, undo: () => { stop(); options.undo(); lastSaved.current = null; } };
}
export type BackgroundFlightPlan = ReturnType<typeof useBackgroundFlightPlan>;
