'use client';
import { useCallback, useRef, useState } from 'react';
import type { ActorTransform, ActorTransformEvent, ProjectDocument, PropTransformEvent, ScenePlacement, SceneTransformEvent } from '@/contracts';
import { updateProp } from '@/features/props';
import { setActorPoseAtTime } from '@/features/blocking';
import { withPlacement } from './object-edits';

type Gesture = { document: ProjectDocument; seconds: number; start: ActorTransformEvent | SceneTransformEvent };
export function useObjectEditing(project: ProjectDocument, update: (project: ProjectDocument) => void, frame: number, fps: number, pause: () => void) {
  const [actorPreview, setActorPreview] = useState<ActorTransform | null>(null);
  const [placementPreview, setPlacementPreview] = useState<ScenePlacement | null>(null);
  const [propPreview, setPropPreview] = useState<ActorTransform | null>(null);
  const [error, setError] = useState('');
  const [undo, setUndo] = useState<{ before: ProjectDocument; after: ProjectDocument } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const current = useRef(project); current.current = project;
  const clearPreview = useCallback(() => { setActorPreview(null); setPlacementPreview(null); setPropPreview(null); gesture.current = null; }, []);
  const commit = useCallback((next: ProjectDocument) => {
    pause(); setUndo({ before: current.current, after: next }); update(next); setError('');
  }, [pause, update]);
  const begin = useCallback((start: ActorTransformEvent | SceneTransformEvent) => {
    pause(); setError(''); gesture.current = { document: current.current, seconds: (frame - 1) / fps, start };
  }, [pause, frame, fps]);
  const actorTransform = useCallback((event: ActorTransformEvent) => {
    if (event.phase === 'start') { begin(event); return; }
    if (event.phase === 'cancel') { clearPreview(); return; }
    const active = gesture.current;
    if (!active || active.start.id !== event.id) return;
    if (event.phase === 'preview') { setActorPreview(event); return; }
    try {
      if (current.current !== active.document) throw new Error('The project changed during this gesture. Try moving the object again.');
      const actor = current.current.actors.find(item => item.id === event.id);
      if (!actor) throw new Error('This actor is no longer in the project.');
      const start = active.start as ActorTransform;
      if (start.heading !== event.heading || start.position.some((v, i) => Math.abs(v - event.position[i]) > 1e-8)) {
        const nextActor = setActorPoseAtTime(actor, active.seconds, event);
        commit({ ...current.current, actors: current.current.actors.map(item => item.id === actor.id ? nextActor : item) });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The actor could not be moved.'); }
    finally { clearPreview(); }
  }, [begin, clearPreview, commit]);
  const sceneTransform = useCallback((event: SceneTransformEvent) => {
    if (event.phase === 'start') { begin(event); return; }
    if (event.phase === 'cancel') { clearPreview(); return; }
    const active = gesture.current;
    if (!active || active.start.id !== event.id) return;
    if (event.phase === 'preview') { setPlacementPreview(event); return; }
    try {
      if (current.current !== active.document) throw new Error('The project changed during this gesture. Try moving the object again.');
      const start = active.start as ScenePlacement;
      if (start.offset.some((v, i) => Math.abs(v - event.offset[i]) > 1e-8)) commit(withPlacement(current.current, event));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The object could not be moved.'); }
    finally { clearPreview(); }
  }, [begin, clearPreview, commit]);
  /** Props are placed for all frames: commit absolute base position and yaw, keeping pitch and roll. */
  const propTransform = useCallback((event: PropTransformEvent) => {
    if (event.phase === 'start') { begin(event); return; }
    if (event.phase === 'cancel') { clearPreview(); return; }
    const active = gesture.current;
    if (!active || active.start.id !== event.id) return;
    if (event.phase === 'preview') { setPropPreview(event); return; }
    try {
      if (current.current !== active.document) throw new Error('The project changed during this gesture. Try moving the prop again.');
      const prop = current.current.props?.find(item => item.id === event.id);
      if (!prop) throw new Error('This prop is no longer in the project.');
      const start = active.start as ActorTransform;
      if (start.heading !== event.heading || start.position.some((v, i) => Math.abs(v - event.position[i]) > 1e-8)) {
        const next = updateProp(prop, { position: event.position, rotation: [prop.rotation[0], event.heading, prop.rotation[2]] });
        commit({ ...current.current, props: (current.current.props ?? []).map(item => item.id === prop.id ? next : item) });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The prop could not be moved.'); }
    finally { clearPreview(); }
  }, [begin, clearPreview, commit]);
  return { actorPreview, placementPreview, propPreview, actorTransform, sceneTransform, propTransform, commit, error, setError,
    canUndo: undo?.after === project, undo: () => { if (undo?.after === current.current) { pause(); update(undo.before); setUndo(null); setError(''); clearPreview(); } } };
}
