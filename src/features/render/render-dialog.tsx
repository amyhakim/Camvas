'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Clapperboard, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { RENDER_SIZES, type RenderOptions, type RenderProgress, type RenderResult } from './render';
import styles from './render.module.css';

type Props = {
  open: boolean; onClose: () => void; name: string;
  shotSeconds: number | null; timelineSeconds: number; hasAudio: boolean; sceneFps: number;
  onRender: (options: RenderOptions, progress: (progress: RenderProgress) => void, signal: AbortSignal) => Promise<RenderResult>;
  /** The look's shutter angle, used as the default motion blur. */
  defaultMotionBlur?: number;
};

/** Render settings, progress and the finished file. The editor is covered while frames render. */
export function RenderDialog({ open, onClose, name, shotSeconds, timelineSeconds, hasAudio, sceneFps, onRender, defaultMotionBlur = 180 }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = { size: useId(), fps: useId(), quality: useId(), range: useId(), blur: useId() };
  const [motionBlur, setMotionBlur] = useState(defaultMotionBlur);
  const [size, setSize] = useState(1);
  const [fps, setFps] = useState(sceneFps);
  const [supersample, setSupersample] = useState(2);
  const [range, setRange] = useState<'shot' | 'timeline'>(shotSeconds ? 'shot' : 'timeline');
  const [audio, setAudio] = useState(true);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string; file: string; detail: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const started = useRef(0);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);
  const busy = !!progress;
  const duration = range === 'shot' && shotSeconds ? shotSeconds : timelineSeconds;
  const chosen = RENDER_SIZES[size];
  async function start() {
    setError(''); if (result) { URL.revokeObjectURL(result.url); setResult(null); }
    const controller = new AbortController(); abort.current = controller; started.current = performance.now();
    setProgress({ frame: 0, frames: Math.round(duration * fps), stage: 'frames' });
    try {
      const rendered = await onRender({ width: chosen.width, height: chosen.height, fps, supersample, start: 0, duration, audio: audio && hasAudio, motionBlur }, setProgress, controller.signal);
      const file = `${name.trim().replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'camvas-render'}-${chosen.label}.${rendered.extension}`;
      setResult({ url: URL.createObjectURL(rendered.blob), file, detail: `${chosen.width}×${chosen.height} · ${fps} fps · ${rendered.seconds.toFixed(1)} s · ${rendered.codec} · ${(rendered.blob.size / 1048576).toFixed(1)} MB` });
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(cause instanceof Error ? cause.message : 'The render failed.');
    } finally { setProgress(null); abort.current = null; }
  }
  const elapsed = progress ? (performance.now() - started.current) / 1000 : 0;
  const eta = progress && progress.frame > 2 ? elapsed / progress.frame * (progress.frames - progress.frame) : null;
  return <dialog ref={dialog} className={styles.dialog} aria-label="Render video" onCancel={event => { if (busy) event.preventDefault(); else onClose(); }} onClose={() => { if (!busy) onClose(); }}>
    <div className={styles.heading}><div><h2><Clapperboard size={18} />Render video</h2><p>Frame-exact render of the shot camera with the look, titles and audio.</p></div>
      <Button size="sm" variant="ghost" iconOnly aria-label="Close render" disabled={busy} onClick={onClose}><X size={18} /></Button></div>
    <div className={styles.grid}>
      <label htmlFor={ids.range}>Range<select id={ids.range} value={range} disabled={busy} onChange={event => setRange(event.target.value as 'shot' | 'timeline')}>
        {shotSeconds && <option value="shot">Camera move · {shotSeconds.toFixed(1)} s</option>}<option value="timeline">Whole timeline · {timelineSeconds.toFixed(1)} s</option></select></label>
      <label htmlFor={ids.size}>Size<select id={ids.size} value={size} disabled={busy} onChange={event => setSize(Number(event.target.value))}>{RENDER_SIZES.map((option, i) => <option key={option.label} value={i}>{option.label} · {option.width}×{option.height}</option>)}</select></label>
      <label htmlFor={ids.fps}>Frame rate<select id={ids.fps} value={fps} disabled={busy} onChange={event => setFps(Number(event.target.value))}>{[24, 25, 30, 60].map(rate => <option key={rate} value={rate}>{rate} fps</option>)}</select></label>
      <label htmlFor={ids.blur}>Motion blur<select id={ids.blur} value={motionBlur} disabled={busy} onChange={event => setMotionBlur(Number(event.target.value))}><option value={0}>Off · crisp</option><option value={180}>180° shutter · like real film</option><option value={270}>270° shutter · dreamy</option></select></label>
      <label htmlFor={ids.quality}>Anti-aliasing<select id={ids.quality} value={supersample} disabled={busy} onChange={event => setSupersample(Number(event.target.value))}><option value={1}>Standard · fastest</option><option value={1.5}>High · 1.5× supersampled</option><option value={2}>Best · 2× supersampled</option></select></label>
    </div>
    <p className={styles.note}>Real footage is 24 fps with a 180° shutter: motion blur is what makes movement read as filmed and feel smooth. Motion blur renders {8}× the frames.</p>
    <label className={styles.check}><input type="checkbox" checked={audio && hasAudio} disabled={!hasAudio || busy} onChange={event => setAudio(event.target.checked)} />{hasAudio ? 'Include timeline music and sound effects' : 'No timeline audio to include'}</label>
    {progress && <div className={styles.progress} role="status" aria-live="polite">
      <progress value={progress.frame} max={progress.frames} />
      <p>{progress.stage === 'audio' ? 'Mixing audio…' : progress.stage === 'finishing' ? 'Writing the file…' : `Frame ${progress.frame} of ${progress.frames}${eta !== null ? ` · about ${Math.ceil(eta)} s left` : ''}`}</p>
    </div>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {result && <div className={styles.result}>
      <video src={result.url} controls playsInline aria-label="Rendered video preview" />
      <p>{result.detail}</p>
      <a className={styles.download} href={result.url} download={result.file}><Download size={15} />Download {result.file}</a>
    </div>}
    <div className={styles.actions}>
      {busy ? <Button onClick={() => abort.current?.abort()}>Cancel render</Button> : <Button variant="primary" onClick={start}><Clapperboard size={15} />{result ? 'Render again' : `Render ${Math.round(duration * fps)} frames`}</Button>}
    </div>
  </dialog>;
}
