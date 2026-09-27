import type { SceneManifest } from '../../contracts';

export const PLAYBACK_FPS = 30;

/** Keep source animation seconds and draft t=0 while changing the editor's frame grid. */
export function playbackManifest(source: SceneManifest, fps = PLAYBACK_FPS): SceneManifest {
  if (source.fps === fps) return source;
  const ratio = fps / source.fps;
  const frame = (value: number) => 1 + (value - 1) * ratio;
  return { ...source, fps, sourceFps: source.sourceFps ?? source.fps,
    frameStart: Math.round(frame(source.frameStart)), frameEnd: Math.ceil(frame(source.frameEnd)), animationEnd: Math.ceil(frame(source.animationEnd)),
    objects: source.objects.map(object => ({ ...object,
      ...(object.samples ? { samples: object.samples.map(sample => ({ ...sample, frame: frame(sample.frame) })) } : {}),
    })),
  };
}

export { sourceTime } from '../../contracts/time';
