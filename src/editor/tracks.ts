import type { ActorTrack, AudioClip, CameraShot, SceneManifest, TimelineTrack } from '../contracts';
import { clipBounds } from '../features/audio/model';
import { AUTHORED_CAMERA_ID, shotEndFrame } from '../features/camera';

/** Translate domain objects here; the timeline only sees track descriptions. */
export function describeTracks(manifest: SceneManifest | null, shot: CameraShot | null, frameEnd: number, actors: ActorTrack[] = [], audio: AudioClip[] = [], selectedAudioId: string | null = null): TimelineTrack[] {
  const fps = manifest?.fps || 24;
  const startFrame = manifest?.frameStart || 1;
  const animationEnd = manifest?.animationEnd || 250;
  return [
    { id: manifest?.activeCameraId ?? 'Camera.002', label: manifest?.objects.find(object => object.id === manifest.activeCameraId)?.name ?? 'Camera.002', kind: 'camera', selectable: true, hold: true,
      clip: { label: animationEnd > startFrame ? 'Camera movement' : 'Opening view', startFrame, endFrame: animationEnd > startFrame ? animationEnd : frameEnd, detail: animationEnd > startFrame ? `Frames ${startFrame}–${animationEnd}` : 'Static camera' } },
    shot ? { id: AUTHORED_CAMERA_ID, label: 'Draft camera', kind: 'camera', selectable: true,
      clip: { label: shot.name, startFrame: 1, endFrame: shotEndFrame(shot, manifest?.fps || 24), detail: `${shot.settings.duration} s`, draft: true } }
    : { id: 'scene', label: 'Scene', kind: 'scene', clip: { label: manifest?.name ?? 'Scene', startFrame, endFrame: frameEnd } },
    ...actors.map((actor): TimelineTrack => ({ id: actor.id, label: actor.name, kind: 'actor', selectable: true, hold: true, clip: { label: actor.marks.length > 1 ? 'Actor movement' : 'Standing', startFrame: Math.round(actor.marks[0].time * (manifest?.fps || 24)) + 1, endFrame: actor.marks.length > 1 ? Math.ceil(actor.marks.at(-1)!.time * (manifest?.fps || 24)) + 1 : frameEnd, detail: `${actor.marks.length} marks` } })),
    // One lane per audio kind, holding all its clips (authored time: frame = seconds × fps + 1).
    ...(['music', 'sfx'] as const).flatMap((kind): TimelineTrack[] => {
      const clips = audio.filter(clip => clip.kind === kind);
      if (!clips.length) return [];
      return [{ id: `lane:${kind}`, label: kind === 'music' ? 'Music' : `Sound FX${clips.length > 1 ? ` · ${clips.length}` : ''}`, kind, selectable: true,
        clip: { label: '', startFrame, endFrame: frameEnd },
        clips: clips.map(clip => ({ id: clip.id, label: clip.source.name, detail: clip.source.artist, selected: clip.id === selectedAudioId, startFrame: Math.round(clip.start * fps) + 1, endFrame: Math.round((clip.start + clip.duration) * fps) + 1, bounds: clipBounds(clip, fps) })) }];
    }),
  ];
}
