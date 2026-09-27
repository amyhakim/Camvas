'use client';

import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { ViewportRuntime } from './runtime';
import type { LiveViewportProps } from './types';
import styles from './viewport.module.css';
export type { LiveViewportProps } from './types';

export default function LiveViewport(props: LiveViewportProps) {
  const surface = useRef<HTMLDivElement>(null);
  const runtime = useRef<ViewportRuntime | null>(null);
  const latest = useRef(props); latest.current = props;
  const [message, setMessage] = useState('Preparing the scene…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [compatible, setCompatible] = useState(false);
  useImperativeHandle(props.handle, () => ({
    retryModel: uid => runtime.current?.retryModel(uid),
    captureSubject: id => runtime.current?.captureSubject(id) ?? null,
    captureObstacles: id => runtime.current?.captureObstacles(id) ?? [],
    captureRouteMapGeometry: () => runtime.current?.captureRouteMapGeometry() ?? [],
    captureRouteMap: view => runtime.current?.captureRouteMap(view) ?? Promise.resolve(null),
    frameSelection: () => runtime.current?.frameSelection(),
    resetView: () => runtime.current?.resetView(),
    framePath: () => runtime.current?.framePath(),
    setMovement: (code, pressed) => runtime.current?.setMovement(code, pressed),
    viewState: () => runtime.current?.viewState() ?? null,
  }), []);
  useEffect(() => { runtime.current?.setProps(props); }, [props]);
  useEffect(() => {
    const abort = new AbortController();
    // Each lifecycle gets a new canvas. A cancelled WebGPU request must never unconfigure
    // the canvas of a subsequent mount (including React Strict Mode's effect replay).
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', `Interactive 3D ${latest.current.manifest.name}. Drag to orbit, Alt-drag to look, right drag to pan, scroll to zoom. Use arrow keys to fly, Space to move up, and Control to move down.`);
    surface.current!.appendChild(canvas);
    let instance: ViewportRuntime | null = null;
    setReady(false); setError('');
    const fail = (cause: unknown) => {
      if (abort.signal.aborted) return;
      instance?.destroy(); instance = null; runtime.current = null;
      setError(cause instanceof Error ? cause.message : 'The scene could not load. Check your connection and retry.');
    };
    ViewportRuntime.create(canvas, latest.current, abort.signal, compatible).then(async created => {
      instance = created;
      if (abort.signal.aborted) { created.destroy(); return; }
      runtime.current = created;
      await created.load(text => { if (!abort.signal.aborted) setMessage(text); }, () => {
        if (!abort.signal.aborted) { setReady(true); setError(''); latest.current.onReady(); }
      }, fail);
    }).catch(fail);
    return () => { abort.abort(); instance?.destroy(); canvas.remove(); runtime.current = null; };
  }, [props.manifest, attempt, compatible]);
  return <div className={styles.canvas}>
    <div ref={surface} className={styles.surface} />
    {(!ready || error) && <div className={`${styles.message} viewport-message`} role={error ? 'alert' : 'status'}>
      {error ? <AlertTriangle size={24} /> : <LoaderCircle className="loading-icon" size={24} />}
      <h2>{error ? 'The scene couldn’t load' : `Opening ${props.manifest.name}`}</h2>
      <p>{error || message}</p>
      {error && <><Button onClick={() => { instanceReset(); }}>Retry scene</Button>{!compatible && <Button onClick={() => setCompatible(true)}>Try compatibility mode</Button>}<a href="?scene=pavilion-v1">Open the pavilion</a></>}
    </div>}
  </div>;
  function instanceReset() { setMessage('Preparing the scene…'); setAttempt(value => value + 1); }
}
