'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { AudioClip } from '@/contracts';
import { AudioEngine } from './engine';

/** Keep timeline audio in step with editor playback: start on play, stop on pause, restart after a seek. */
export function useAudioPlayback(clips: AudioClip[], playing: boolean, seconds: number, onError?: (message: string) => void) {
  const engine = useRef<AudioEngine | null>(null);
  const time = useRef(seconds); time.current = seconds;
  const latest = useRef(clips); latest.current = clips;
  const signature = useMemo(() => JSON.stringify(clips), [clips]);
  useEffect(() => { engine.current = new AudioEngine(); return () => { engine.current?.destroy(); engine.current = null; }; }, []);
  useEffect(() => { if (engine.current) engine.current.onError = onError; }, [onError]);
  useEffect(() => { engine.current?.preload(latest.current); }, [signature]);
  useEffect(() => {
    if (!engine.current) return;
    if (playing) void engine.current.start(time.current, latest.current); else engine.current.stop();
  }, [playing, signature]);
  useEffect(() => {
    // Scrubbing or jumping while playing: resync when the timeline and the audio clock disagree.
    const position = engine.current?.position();
    if (playing && position !== null && position !== undefined && Math.abs(position - seconds) > .25) void engine.current!.start(seconds, latest.current);
  }, [playing, seconds]);
}
