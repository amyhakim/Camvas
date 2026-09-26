import type { CameraShot, SceneManifest, TimelineTrack } from '../contracts';
import { AUTHORED_CAMERA_ID, shotEndFrame } from '../features/camera';

/** Translate domain objects here; the timeline only sees track descriptions. */
export function describeTracks(manifest: SceneManifest | null, shot: CameraShot | null, frameEnd: number): TimelineTrack[] {
  const startFrame = manifest?.frameStart || 1;
  const animationEnd = manifest?.animationEnd || 250;
  return [
    { id: 'Camera.002', label: 'Camera.002', kind: 'camera', selectable: true, hold: true,
      clip: { label: 'Camera movement', startFrame, endFrame: animationEnd, detail: `Frames ${startFrame}–${animationEnd}` } },
    shot ? { id: AUTHORED_CAMERA_ID, label: 'Draft camera', kind: 'camera', selectable: true,
      clip: { label: shot.name, startFrame: 1, endFrame: shotEndFrame(shot, manifest?.fps || 24), detail: `${shot.settings.duration} s`, draft: true } }
    : { id: 'scene', label: 'Scene', kind: 'scene', clip: { label: 'Barcelona Pavilion · Midday', startFrame, endFrame: frameEnd } },
  ];
}
