import type { ProjectDocument } from '../../contracts';
import { builtinAudio, createAudioClip } from '../audio/model';

/** Repair the original silent starter. Explicitly edited or removed audio stays unchanged. */
export function withLastLightSoundtrack(document: ProjectDocument): ProjectDocument {
  if (document.sceneId !== 'last-light' || document.audio !== undefined) return document;
  return { ...document, audio: [createAudioClip('audio:last-light-score', builtinAudio('last-light')!.source, 0,
    { duration: 15, volume: 1, fadeIn: 0, fadeOut: 0 })] };
}
