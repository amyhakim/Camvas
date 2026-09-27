import type { SceneManifest } from './index';

/** Imported source frame 1 retains its original nonzero time. */
export function sourceTime(frame: number, manifest: Pick<SceneManifest, 'fps' | 'sourceFps'>): number {
  return manifest.sourceFps ? (frame - 1) / manifest.fps + 1 / manifest.sourceFps : frame / manifest.fps;
}
