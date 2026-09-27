'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import type { CameraShot } from '@/contracts';
import { compileShot, type TargetSampler } from './model';
import { fitRouteView, optimizeCameraRoute, routePoint, sampleCameraRoute, type RouteBox } from './route-overview-model';
import styles from './route-overview.module.css';

const WIDTH = 480, HEIGHT = 320;
const pair = (point: [number, number]) => point.join(',');

/** Blockout's flight overview adapted to FlyThru's saved camera draft and Y-up scene bounds. */
export function RouteOverview({ shot, boxes, optimizationBoxes, captureMap, targetAt, time, playing, onSeek, onPlay, onPause, onShot }: {
  shot: CameraShot; boxes: RouteBox[]; optimizationBoxes: RouteBox[]; targetAt?: TargetSampler;
  captureMap: (view: { centerX: number; centerZ: number; halfHeight: number; cutHeight: number }) => Promise<string | null>;
  time: number; playing: boolean; onSeek: (seconds: number) => void; onPlay: () => void; onPause: () => void; onShot: (shot: CameraShot) => void;
}) {
  const [cutHeight, setCutHeight] = useState(3);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [background, setBackground] = useState<string | null>(null);
  const [undoShot, setUndoShot] = useState<CameraShot | null>(null);
  const samples = useMemo(() => sampleCameraRoute(shot, targetAt), [shot, targetAt]);
  const view = useMemo(() => fitRouteView(samples, boxes, WIDTH, HEIGHT), [samples, boxes]);
  const at = Math.max(0, Math.min(shot.settings.duration, time));
  const current = useMemo(() => compileShot(shot, targetAt)(at), [shot, targetAt, at]);
  const route = samples.map(sample => pair(routePoint(view, sample.pose.position))).join(' ');
  const flown = samples.filter(sample => sample.time <= at).map(sample => pair(routePoint(view, sample.pose.position)));
  flown.push(pair(routePoint(view, current.position)));
  const [cx, cy] = routePoint(view, current.position);
  const start = routePoint(view, samples[0].pose.position);
  const area = (box: RouteBox) => Math.max(0, box.max[0] - box.min[0]) * Math.max(0, box.max[2] - box.min[2]);
  const visibleBoxes = boxes.filter(box => box.min[1] <= cutHeight).sort((a, b) => area(b) - area(a));
  const viewArea = 4 * view.halfWidth * view.halfHeight;
  const captureMapRef = useRef(captureMap); captureMapRef.current = captureMap;
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => { void captureMapRef.current({ centerX: view.centerX, centerZ: view.centerZ, halfHeight: view.halfHeight, cutHeight }).then(image => { if (active) setBackground(image); }); }, 120);
    return () => { active = false; window.clearTimeout(timer); };
  }, [view.centerX, view.centerZ, view.halfHeight, cutHeight]);

  function seekOnMap(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) * WIDTH / rect.width, y = (event.clientY - rect.top) * HEIGHT / rect.height;
    let closest = samples[0], distance = Infinity;
    for (const sample of samples) {
      const point = routePoint(view, sample.pose.position);
      const next = (point[0] - x) ** 2 + (point[1] - y) ** 2;
      if (next < distance) { closest = sample; distance = next; }
    }
    onPause(); onSeek(closest.time);
  }
  function optimize() {
    if (busy) return;
    setBusy(true); setMessage(''); onPause();
    window.setTimeout(() => {
      try {
        const result = optimizeCameraRoute(shot, optimizationBoxes, targetAt);
        if (!result) { setMessage(optimizationBoxes.length ? 'No safer local route found. Adjust the camera marks and try again.' : 'This scene has no separate mesh bounds for clearance checks.'); return; }
        setUndoShot(shot); onShot(result.shot);
        setMessage(`Route refined. Clearance conflicts: ${result.before} → ${result.after} samples.`);
      } catch { setMessage('Could not refine this route.'); }
      finally { setBusy(false); }
    }, 40);
  }
  return <section className={styles.root} aria-label="Drone path overview">
    <div className={styles.heading}><span>TOP VIEW</span><strong>Flight path</strong></div>
    <div className={styles.map}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Top view of scene bounds, proposed camera route, and playback position" onClick={seekOnMap}>
        <defs><pattern id="flight-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#344047" strokeWidth=".5" /></pattern></defs>
        <rect width={WIDTH} height={HEIGHT} fill="#171c24" />
        {background ? <image href={background} width={WIDTH} height={HEIGHT} /> : <rect width={WIDTH} height={HEIGHT} fill="url(#flight-grid)" />}
        {!background && visibleBoxes.map((box, index) => {
          const [left, top] = routePoint(view, box.min), [right, bottom] = routePoint(view, box.max);
          const coverage = area(box) / viewArea;
          return <rect key={index} x={Math.min(left, right)} y={Math.min(top, bottom)} width={Math.max(1, Math.abs(right - left))} height={Math.max(1, Math.abs(bottom - top))} fill={box.color ?? '#a7b5b6'} fillOpacity={coverage > .3 ? .18 : box.max[1] <= cutHeight ? .7 : .28} stroke="#d7ded9" strokeOpacity={coverage > .3 ? .18 : .42} strokeWidth=".8" />;
        })}
        <polyline points={route} fill="none" stroke="#f04452" strokeWidth="3" strokeOpacity=".55" strokeLinejoin="round" />
        <polyline points={flown.join(' ')} fill="none" stroke="#ff334b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={start[0]} cy={start[1]} r="4" fill="white" />
        <g transform={`translate(${cx},${cy}) rotate(${-current.pan * 180 / Math.PI})`}><circle r="9" fill="#fc334b" stroke="white" strokeWidth="2" /><path d="M 0,-17 L -5,-8 L 5,-8 Z" fill="white" /></g>
      </svg>
      <span className={styles.legend}>RED · PROPOSED ROUTE<br />BRIGHT RED · FLOWN</span>
      {!boxes.length && <span className={styles.empty}>No separate scene mesh bounds are available; the route is still shown to scale.</span>}
    </div>
    <div className={styles.controls}>
      <button type="button" onClick={playing ? onPause : onPlay}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" aria-label="Rewind flight" onClick={() => { onPause(); onSeek(0); }}>↤</button>
      <input aria-label="Flight progress" type="range" min={0} max={shot.settings.duration} step={.01} value={at} onChange={event => { onPause(); onSeek(Number(event.target.value)); }} />
      <output>{at.toFixed(1)} / {shot.settings.duration.toFixed(1)}s</output>
    </div>
    <div className={styles.optimize}>
      <button type="button" disabled={busy || !optimizationBoxes.length} onClick={optimize}>{busy ? 'Refining…' : 'Optimize path'}</button>
      <span>Static mesh boxes · 0.3 m clearance<br />Bakes camera motion · Undo available</span>
      {undoShot && <button type="button" onClick={() => { onPause(); onShot(undoShot); setUndoShot(null); setMessage('Previous route restored.'); }}>Undo</button>}
    </div>
    <label className={styles.cut}>Cutaway height <input aria-label="Cutaway height" type="range" min={.5} max={15} step={.5} value={cutHeight} disabled={!boxes.length} onChange={event => setCutHeight(Number(event.target.value))} /><span>{cutHeight.toFixed(1)} m</span></label>
    {message && <p className={styles.message} role="status">{message}</p>}
  </section>;
}
