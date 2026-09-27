import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_VERY_HIGH, WebMOutputFormat, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import type { AudioClip, ViewportHandle } from '@/contracts';
import { clipGain } from '../audio/model';
import { drawFinish, type FinishState } from '../look/finish';

/** `motionBlur` is the shutter angle in degrees (0 = off, 180 = film); each frame averages sub-frames across the open shutter. */
export type RenderOptions = { width: number; height: number; fps: number; supersample: number; start: number; duration: number; audio: boolean; motionBlur: number };
export const MOTION_BLUR_SAMPLES = 8;
export type RenderProgress = { frame: number; frames: number; stage: 'audio' | 'frames' | 'finishing' };
export type RenderResult = { blob: Blob; extension: 'mp4' | 'webm'; seconds: number; codec: string };
export const RENDER_SIZES = [
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1440p', width: 2560, height: 1440 },
  { label: '4K', width: 3840, height: 2160 },
] as const;
const SAMPLE_RATE = 48000;

/** Mixes timeline audio for [start, start + duration) offline, with each clip's volume and fades. */
export async function mixAudio(clips: AudioClip[], start: number, duration: number, signal?: AbortSignal): Promise<AudioBuffer | null> {
  const active = clips.filter(clip => clip.start < start + duration && clip.start + clip.duration > start);
  if (!active.length) return null;
  const context = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const decoded = new Map<string, Promise<AudioBuffer>>();
  await Promise.all(active.map(async clip => {
    const key = `${clip.source.provider}:${clip.source.id}`;
    let pending = decoded.get(key);
    if (!pending) {
      pending = fetch(`/api/audio/${clip.source.provider}/${clip.source.id}/file`, { signal }).then(async response => {
        if (!response.ok) throw new Error(`“${clip.source.name}” could not be downloaded for the render (${response.status}).`);
        return context.decodeAudioData(await response.arrayBuffer());
      });
      decoded.set(key, pending);
    }
    const buffer = await pending;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.connect(gain).connect(context.destination);
    // Timeline seconds → render seconds; a clip that began before the range starts part-way in.
    const into = Math.max(0, start - clip.start), at = Math.max(0, clip.start - start);
    gain.gain.setValueAtTime(clipGain(clip, into), at);
    for (const t of [clip.fadeIn, clip.duration - clip.fadeOut, clip.duration].filter(t => t > into)) gain.gain.linearRampToValueAtTime(clipGain(clip, Math.min(t, clip.duration - 1e-4)), at + (t - into));
    source.start(at, clip.offset + into, clip.duration - into);
  }));
  if (signal?.aborted) throw new DOMException('Render cancelled', 'AbortError');
  return context.startRendering();
}

/**
 * Renders the shot frame by frame at a fixed rate: for each output frame the editor moves the timeline, the viewport
 * renders it at `supersample` × the output size, and the image is downscaled with the finishing pass (grain, fades,
 * letterbox, titles) into the encoder. H.264/AAC MP4 when the browser can encode it, otherwise VP9/Opus WebM.
 */
export async function renderVideo({ options, viewport, seek, sceneFps, finish, clips, cuts = [], onProgress, signal }: {
  options: RenderOptions; viewport: ViewportHandle; sceneFps: number;
  /** Timeline seconds where hard cuts land; motion blur never mixes two shots. */
  cuts?: number[];
  /** Move the editor to a scene frame (fractional frames are fine); the viewport waits until it is applied. */
  seek: (frame: number) => void;
  finish: Omit<FinishState, 'time' | 'frame'>;
  clips: AudioClip[]; onProgress: (progress: RenderProgress) => void; signal: AbortSignal;
}): Promise<RenderResult> {
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot encode video. Use a current Chrome, Edge or Safari.');
  if (!viewport.beginRender || !viewport.renderFrame || !viewport.endRender) throw new Error('The scene is still loading.');
  const { width, height, fps } = options;
  const frames = Math.max(1, Math.round(options.duration * fps));
  const avc = await canEncodeVideo('avc', { width, height, frameRate: fps, quality: QUALITY_VERY_HIGH });
  const videoCodec = avc ? 'avc' : 'vp9';
  if (!avc && !await canEncodeVideo('vp9', { width, height, frameRate: fps })) throw new Error(`This browser cannot encode ${width}×${height} video. Choose a smaller size.`);
  let audio: AudioBuffer | null = null;
  if (options.audio && clips.length) { onProgress({ frame: 0, frames, stage: 'audio' }); audio = await mixAudio(clips, options.start, options.duration, signal); }
  // Probe the exact settings: platform AAC encoders accept only some bitrates (Windows tops out at 192 kbps).
  let audioCodec: 'aac' | 'opus' | null = null, audioBitrate = 192_000;
  if (audio) {
    for (const [codec, bitrate] of [...(avc ? [['aac', 192_000], ['aac', 128_000]] as const : []), ['opus', 192_000], ['opus', 128_000]] as const) {
      if (await canEncodeAudio(codec, { numberOfChannels: 2, sampleRate: SAMPLE_RATE, bitrate })) { audioCodec = codec; audioBitrate = bitrate; break; }
    }
    if (!audioCodec) throw new Error('This browser cannot encode audio. Untick the audio option to render picture only.');
  }
  const webm = !avc || audioCodec === 'opus';
  const target = new BufferTarget();
  const output = new Output({ format: webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const composite = document.createElement('canvas'); composite.width = width; composite.height = height;
  const g = composite.getContext('2d', { alpha: false })!;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const video = new CanvasSource(composite, { codec: webm ? 'vp9' : videoCodec, bitrate: QUALITY_VERY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: fps });
  const sound = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: audioBitrate }) : null;
  if (sound) output.addAudioTrack(sound);
  await output.start();
  const renderWidth = Math.round(width * options.supersample), renderHeight = Math.round(height * options.supersample);
  viewport.beginRender(renderWidth, renderHeight, options.motionBlur > 0);
  const samples = options.motionBlur > 0 ? MOTION_BLUR_SAMPLES : 1;
  const shutter = Math.min(360, options.motionBlur) / 360 / fps;
  const accumulated = samples > 1 ? new Float32Array(width * height * 4) : null;
  const end = options.start + options.duration;
  try {
    for (let i = 0; i < frames; i++) {
      const time = options.start + i / fps;
      // The shutter stays inside the current shot: sub-frames are clamped between the surrounding cuts.
      const shotStart = Math.max(options.start, ...cuts.filter(cut => cut <= time + 1e-6));
      const shotEnd = Math.min(end, ...cuts.filter(cut => cut > time + 1e-6));
      accumulated?.fill(0);
      for (let k = 0; k < samples; k++) {
        if (signal.aborted) throw new DOMException('Render cancelled', 'AbortError');
        const at = samples > 1 ? Math.min(shotEnd - 1e-4, Math.max(shotStart, time + ((k + .5) / samples - .5) * shutter)) : time;
        const frame = 1 + at * sceneFps;
        seek(frame);
        await viewport.renderFrame(frame, canvas => {
          g.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
          if (accumulated) { const pixels = g.getImageData(0, 0, width, height).data; for (let p = 0; p < pixels.length; p++) accumulated[p] += pixels[p]; }
        }, signal);
      }
      if (accumulated) {
        const image = g.createImageData(width, height);
        for (let p = 0; p < accumulated.length; p++) image.data[p] = accumulated[p] / samples + .5;
        g.putImageData(image, 0, 0);
      }
      drawFinish(g, width, height, { ...finish, time, frame: i });
      await video.add(i / fps, 1 / fps);
      onProgress({ frame: i + 1, frames, stage: 'frames' });
    }
  } finally { viewport.endRender(); }
  onProgress({ frame: frames, frames, stage: 'finishing' });
  if (sound && audio) await sound.add(audio);
  await output.finalize();
  const bytes = target.buffer;
  if (!bytes) throw new Error('The encoder produced no file.');
  return { blob: new Blob([bytes], { type: webm ? 'video/webm' : 'video/mp4' }), extension: webm ? 'webm' : 'mp4', seconds: frames / fps, codec: webm ? `VP9${audioCodec ? ' + Opus' : ''}` : `H.264${audioCodec ? ' + AAC' : ''}` };
}
