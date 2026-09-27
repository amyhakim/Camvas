export const DEFAULT_SCENE_ID = 'residence-9d09ab82';
export const SCENES = [
  { id: DEFAULT_SCENE_ID, name: 'Private Residence Interior', manifestUrl: '/scenes/residence.json' },
  { id: 'pavilion-v1', name: 'Barcelona Pavilion', manifestUrl: '/scenes/pavilion.json' },
  { id: 'studio', name: 'Studio stage', manifestUrl: '/scenes/studio.json' },
] as const;

export function sceneIdFromSearch(search: string) {
  const requested = new URLSearchParams(search).get('scene');
  return SCENES.find(scene => scene.id === requested || (requested === 'pavilion' && scene.id === 'pavilion-v1'))?.id ?? DEFAULT_SCENE_ID;
}
