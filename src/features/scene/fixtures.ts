import type { SceneEntity, SceneManifest } from '../../contracts';
import { sceneFixture } from '../../contracts/fixtures';

export const meshFixture: SceneEntity = { ...sceneFixture.objects[0], sourceName: 'BarcelonaChair.001', materials: ['Leather', 'Chrome'] };
export const animatedCameraFixture: SceneEntity = {
  id: 'camera', name: 'Pavilion camera', sourceName: 'Camera.002', type: 'Camera', category: 'Camera',
  materials: [], position: [100, 200, 300], positionWeb: [100, 300, -200], dimensions: [0, 0, 0],
  lens: 35, sensorWidth: 36, animated: true,
  samples: [
    { frame: 1, position: [10, 20, 30], quaternion: [0, 0, 0, 1] },
    { frame: 2, position: [11, 22, 33], quaternion: [0, 0, 0, 1] },
    { frame: 3, position: [12, 24, 36], quaternion: [0, 0, 0, 1] },
  ],
};
export const manifestFixture: SceneManifest = { ...sceneFixture, objects: [meshFixture, animatedCameraFixture] };
