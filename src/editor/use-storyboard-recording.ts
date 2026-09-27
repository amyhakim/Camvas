'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@/features/storyboard';

/** Real-time, silent browser recording. The render callback copies only the clean camera rectangle. */
export function useStoryboardRecording({ fps, name, onStart, onFinish, onError }: {
  fps: number; name: string; onStart: () => void; onFinish: () => void; onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const output = useRef<HTMLCanvasElement | null>(null);
  const cancelled = useRef(false);
  const callbacks = useRef({ onStart, onFinish, onError }); callbacks.current = { onStart, onFinish, onError };
  const draw = useCallback((source: HTMLCanvasElement) => {
    const canvas = output.current, context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const width = Math.min(source.width, source.height * 16 / 9), height = width * 9 / 16;
    context.drawImage(source, (source.width - width) / 2, (source.height - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
    const track = recorder.current?.stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
    track?.requestFrame?.();
  }, []);
  function start() {
    if (recorder.current) return;
    if (typeof MediaRecorder === 'undefined') { callbacks.current.onError('This browser cannot record video. Export a contact sheet instead.'); return; }
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { callbacks.current.onError('This browser cannot record video.'); return; }
    let stream: MediaStream | undefined;
    try {
      const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720;
      output.current = canvas;
      stream = canvas.captureStream(fps);
      const instance = new MediaRecorder(stream, { mimeType }); recorder.current = instance;
      const chunks: BlobPart[] = []; cancelled.current = false;
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onerror = () => { cancelled.current = true; callbacks.current.onError('Video recording failed.'); if (instance.state !== 'inactive') instance.stop(); };
      instance.onstop = () => {
        instance.stream.getTracks().forEach(track => track.stop()); recorder.current = null; output.current = null; setRecording(false);
        if (!cancelled.current && chunks.length) downloadBlob(new Blob(chunks, { type: mimeType }), `${name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}-storyboard.${mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`);
        callbacks.current.onFinish();
      };
      setRecording(true); callbacks.current.onStart();
      // The caller starts playback after the clean first frame is mounted.
      instance.start();
    } catch { stream?.getTracks().forEach(track => track.stop()); recorder.current = null; output.current = null; setRecording(false); callbacks.current.onError('Could not start video recording.'); }
  }
  const stop = useCallback((cancel = false) => { cancelled.current = cancel; if (recorder.current?.state === 'recording') recorder.current.stop(); }, []);
  useEffect(() => () => { const active = recorder.current; if (active) { active.onstop = null; active.stream.getTracks().forEach(track => track.stop()); if (active.state !== 'inactive') active.stop(); } }, []);
  return { recording, start, stop, draw };
}
