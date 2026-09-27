'use client';

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { drawFinish } from '@/features/look/finish';
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
    frameSelection: () => runtime.current?.frameSelection(),
    resetView: () => runtime.current?.resetView(),
    framePath: () => runtime.current?.framePath(),
    setMovement: (code, pressed) => runtime.current?.setMovement(code, pressed),
    viewState: () => runtime.current?.viewState() ?? null,
    beginRender: (width, height, jitter) => runtime.current?.beginRender(width, height, jitter),
    renderFrame: (frame, draw, signal) => runtime.current ? runtime.current.renderFrame(frame, draw, signal) : Promise.reject(new Error('The scene is not ready.')),
    endRender: () => runtime.current?.endRender(),
  }), []);
  // Finishing (grain, letterbox, fades, titles) previews over the shot camera exactly as it renders.
  const finish = useRef<HTMLCanvasElement>(null);
  const finishing = props.mode === 'shot' && !!(props.look || props.titles?.length);
  useLayoutEffect(() => {
    const canvas = finish.current;
    if (!canvas || !finishing) return;
    const draw = () => {
      const width = canvas.clientWidth, height = canvas.clientHeight, ratio = Math.min(window.devicePixelRatio, 2);
      if (!width || !height) return;
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
      const g = canvas.getContext('2d')!;
      g.clearRect(0, 0, canvas.width, canvas.height);
      const fps = props.manifest.fps || 24;
      drawFinish(g, canvas.width, canvas.height, { look: props.look ?? null, titles: props.titles ?? [], time: (props.frame - 1) / fps, end: props.timelineSeconds ?? 0, frame: Math.round(props.frame) });
    };
    draw();
    const observer = new ResizeObserver(draw); observer.observe(canvas);
    return () => observer.disconnect();
  }, [finishing, props.look, props.titles, props.frame, props.manifest.fps, props.timelineSeconds]);
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
    {finishing && <canvas ref={finish} className={styles.finish} aria-hidden="true" />}
    {(!ready || error) && <div className={`${styles.message} viewport-message`} role={error ? 'alert' : 'status'}>
      {error ? <AlertTriangle size={24} /> : <LoaderCircle className="loading-icon" size={24} />}
      <h2>{error ? 'The scene couldn’t load' : `Opening ${props.manifest.name}`}</h2>
      <p>{error || message}</p>
      {error && <><Button onClick={() => { instanceReset(); }}>Retry scene</Button>{!compatible && <Button onClick={() => setCompatible(true)}>Try compatibility mode</Button>}<a href="?scene=pavilion-v1">Open the pavilion</a></>}
    </div>}
  </div>;
  function instanceReset() { setMessage('Preparing the scene…'); setAttempt(value => value + 1); }
}
