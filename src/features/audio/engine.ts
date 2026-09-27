import type { AudioClip } from '../../contracts';
import { audioKey, clipGain } from './model';

/**
 * Plays timeline audio with Web Audio, locked to the editor's timeline: `start(seconds)` schedules every clip
 * relative to that timeline time, `stop()` silences everything. Buffers are decoded once per source.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers = new Map<string, Promise<AudioBuffer>>();
  private voices: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private master: GainNode | null = null;
  /** Timeline seconds at context time `anchor`, while playing. */
  private anchor: { context: number; timeline: number } | null = null;
  errors = new Map<string, string>();
  onError?: (message: string) => void;

  private ensure() {
    if (!this.context) {
      const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      this.context = new Context();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  load(clip: AudioClip): Promise<AudioBuffer> {
    const key = audioKey(clip.source);
    let pending = this.buffers.get(key);
    if (!pending) {
      const context = this.ensure();
      pending = fetch(`/api/audio/${clip.source.provider}/${clip.source.id}/file`)
        .then(async response => {
          if (!response.ok) { const body = await response.json().catch(() => ({})) as { error?: string }; throw new Error(body.error || `Audio unavailable (${response.status}).`); }
          return context.decodeAudioData(await response.arrayBuffer());
        });
      pending.catch(error => { this.buffers.delete(key); const message = error instanceof Error ? error.message : 'Audio unavailable.'; this.errors.set(key, message); this.onError?.(`“${clip.source.name}”: ${message}`); });
      this.buffers.set(key, pending);
    }
    return pending;
  }
  preload(clips: AudioClip[]) { if (typeof window !== 'undefined') for (const clip of clips) void this.load(clip).catch(() => {}); }

  /** Current timeline time according to the audio clock, or null when stopped. */
  position() { return this.anchor && this.context ? this.anchor.timeline + (this.context.currentTime - this.anchor.context) : null; }

  async start(seconds: number, clips: AudioClip[]) {
    this.stop();
    const context = this.ensure();
    if (context.state === 'suspended') await context.resume().catch(() => {});
    const now = context.currentTime + .03;
    this.anchor = { context: now, timeline: seconds };
    const token = this.anchor;
    await Promise.all(clips.filter(clip => clip.start + clip.duration > seconds).map(async clip => {
      let buffer: AudioBuffer;
      try { buffer = await this.load(clip); } catch { return; }
      if (this.anchor !== token) return; // stopped or restarted while loading
      const elapsed = (context.currentTime - token.context) + seconds; // timeline time now
      const into = Math.max(0, elapsed - clip.start); // seconds into the clip
      if (into >= clip.duration) return;
      const when = context.currentTime + Math.max(0, clip.start - elapsed);
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      source.connect(gain).connect(this.master!);
      // Envelope: sample the fade shape at a few points so mid-clip starts pick up the right level.
      gain.gain.setValueAtTime(clipGain(clip, into), when);
      const points = [clip.fadeIn, clip.duration - clip.fadeOut, clip.duration].filter(t => t > into);
      for (const t of points) gain.gain.linearRampToValueAtTime(clipGain(clip, Math.min(t, clip.duration - 1e-4)), when + (t - into));
      source.start(when, clip.offset + into, clip.duration - into);
      this.voices.push({ source, gain });
      source.onended = () => { this.voices = this.voices.filter(voice => voice.source !== source); };
    }));
  }

  stop() {
    this.anchor = null;
    for (const voice of this.voices) { try { voice.source.stop(); } catch { /* already stopped */ } voice.source.disconnect(); voice.gain.disconnect(); }
    this.voices = [];
  }

  destroy() { this.stop(); void this.context?.close().catch(() => {}); this.context = null; this.buffers.clear(); }
}
