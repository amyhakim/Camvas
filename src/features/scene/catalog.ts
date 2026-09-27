export const DEFAULT_SCENE_ID = 'pavilion-v1';
export const SCENES = [
  { id: DEFAULT_SCENE_ID, name: 'Barcelona Pavilion', manifestUrl: '/scenes/pavilion.json' },
  { id: 'residence-9d09ab82', name: 'Private Residence Interior', manifestUrl: '/scenes/residence.json' },
  { id: 'studio', name: 'Studio stage', manifestUrl: '/scenes/studio.json' },
] as const;

export function sceneIdFromSearch(search: string) {
  const requested = new URLSearchParams(search).get('scene');
  return SCENES.find(scene => scene.id === requested || (requested === 'pavilion' && scene.id === 'pavilion-v1'))?.id ?? DEFAULT_SCENE_ID;
}
