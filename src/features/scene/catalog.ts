import { superSplatReference } from './supersplat';

export const DEFAULT_SCENE_ID = 'pavilion-v1';
export const SCENES = [
  { id: DEFAULT_SCENE_ID, name: 'Barcelona Pavilion', manifestUrl: '/scenes/pavilion.json' },
  { id: 'residence-9d09ab82', name: 'Private Residence Interior', manifestUrl: '/scenes/residence.json' },
  { id: 'studio', name: 'Studio stage', manifestUrl: '/scenes/studio.json' },
] as const;

export function isSupportedScene(id: string) {
  return SCENES.some(scene => scene.id === id) || !!superSplatReference(id);
}

export function sceneManifestUrl(id: string) {
  return SCENES.find(scene => scene.id === id)?.manifestUrl ?? (superSplatReference(id) ? `/api/scenes/manifest?id=${encodeURIComponent(id)}` : null);
}

export function sceneIdFromSearch(search: string) {
  const requested = new URLSearchParams(search).get('scene');
  return requested && isSupportedScene(requested) ? requested : DEFAULT_SCENE_ID;
}
