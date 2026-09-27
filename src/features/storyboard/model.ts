import type { CameraShot, StoryboardShot, TimelineTrack } from '../../contracts';

export const MAX_STORYBOARD_SHOTS = 24;
export const STORYBOARD_CAMERA_ID = 'showcam:storyboard';

export function saveShot(shots: StoryboardShot[], camera: CameraShot, id: string, sceneStart = 0): StoryboardShot[] {
  if (shots.length >= MAX_STORYBOARD_SHOTS) throw new Error('A scene can hold up to 24 storyboard shots.');
  if (shots.some(shot => shot.id === id)) throw new Error('That shot ID already exists.');
  return [...shots, { id, name: `Shot ${shots.length + 1}`, notes: '', camera: structuredClone(camera), sceneStart, panelTime: 0 }];
}

export function moveShot(shots: StoryboardShot[], id: string, delta: -1 | 1): StoryboardShot[] {
  const index = shots.findIndex(shot => shot.id === id), next = index + delta;
  if (index < 0 || next < 0 || next >= shots.length) return shots;
  const result = [...shots];
  [result[index], result[next]] = [result[next], result[index]];
  return result;
}

/** Half-open frame intervals: the first frame at a cut belongs to the next shot. */
export function sequenceClips(shots: StoryboardShot[], fps: number) {
  let startFrame = 1;
  return shots.map(shot => {
    const frames = Math.max(1, Math.ceil(shot.camera.settings.duration * fps));
    const clip = { shot, startFrame, endFrame: startFrame + frames };
    startFrame += frames;
    return clip;
  });
}

export function sequenceFrame(shots: StoryboardShot[], frame: number, fps: number) {
  const clips = sequenceClips(shots, fps);
  const clip = clips.find(item => frame < item.endFrame) ?? clips.at(-1);
  if (!clip) return null;
  const localTime = Math.max(0, Math.min(clip.shot.camera.settings.duration, (frame - clip.startFrame) / fps));
  return { ...clip, localTime, sceneTime: clip.shot.sceneStart + localTime };
}

export function sequenceTracks(shots: StoryboardShot[], fps: number): TimelineTrack[] {
  return sequenceClips(shots, fps).map(({ shot, startFrame, endFrame }, index) => ({
    id: shot.id, label: `${index + 1}. ${shot.name}`, kind: 'camera', selectable: true,
    clip: { label: shot.name, startFrame, endFrame, detail: `${shot.camera.settings.duration} s` },
  }));
}

/** Thumbnails are derived and kept out of saved project JSON/storage. */
export function panelKey(shot: StoryboardShot, sceneKey: string): string {
  return JSON.stringify([sceneKey, shot.camera, shot.sceneStart, shot.panelTime]);
}
