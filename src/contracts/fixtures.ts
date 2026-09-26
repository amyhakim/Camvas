import type { ActorTrack, ActorPose, ProjectDocument, CameraShot, CameraPose, PathPreview, SceneManifest, ShotSnapshot, TimelineTrack } from './index';
export const subjectFixture: ShotSnapshot = { subjectId: 'chair', subjectName: 'Chair', min: [9,2,-6], max: [11,4,-4], cameraPosition: [10,5,7] };
export const poseFixture: CameraPose = { position: [10,5,7], pan: 0, tilt: 0, roll: 0, focalLength: 35, fov: 32 };
export const pathFixture: PathPreview = { points: [[10,5,7],[12,5,5],[14,5,3]], marks: [[10,5,7],[14,5,3]], target: [10,3,-5] };
export const tracksFixture: TimelineTrack[] = [{ id: 'camera', label: 'Source camera', kind: 'camera', selectable: true, hold: true, clip: { label: 'Camera movement', startFrame: 1, endFrame: 250, detail: 'Frames 1–250' } }, { id: 'scene', label: 'Scene', kind: 'scene', clip: { label: 'Barcelona Pavilion · Midday', startFrame: 1, endFrame: 374 } }];
export const sceneFixture: SceneManifest = { name: 'Fixture scene', fps: 24, frameStart: 1, frameEnd: 374, animationEnd: 250, activeCameraId: 'camera', aspect: 16/9, simplifications: [], objects: [{ id: 'chair', name: 'Chair', sourceName: 'Chair', type: 'Mesh', category: 'Furniture', materials: ['leather'], position: [10,5,3], positionWeb: [10,3,-5], dimensions: [2,2,2] }] };

/** Hand-authored plain data: consumers can exercise a shot without running generation. */
export const cameraShotFixture: CameraShot = {
  name: 'Fixture camera move', subjectId: 'chair', subjectName: 'Chair', target: [10, 3, -5],
  settings: { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' },
  trackSubject: false,
  marks: [
    { time: 0, position: { x: 10, y: 5, z: 7 }, pan: 0, tilt: 0, roll: 0, focalLength: 35, easeIn: 0, easeOut: 0, hold: 0 },
    { time: 6, position: { x: 14, y: 5, z: 3 }, pan: .4, tilt: -.1, roll: 0, focalLength: 50, easeIn: 0, easeOut: 0, hold: 0 },
  ],
};

export const actorFixture: ActorTrack = {
  id: 'actor:fixture', name: 'Alex', color: '#afceaf', height: 1.75,
  marks: [{ time: 0, position: [-7, 1.4, 2], heading: 0 }, { time: 6, position: [-3, 1.4, 2], heading: -Math.PI / 2 }],
};
export const actorPoseFixture: ActorPose = { id: actorFixture.id, name: actorFixture.name, color: actorFixture.color, height: actorFixture.height, ...actorFixture.marks[0] };
export const projectFixture: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Pavilion study', shot: cameraShotFixture, actors: [actorFixture] };

export const actorTransformFixture: import('./index').ActorTransform = { id: actorFixture.id, position: [-6, 1.4, 3], heading: Math.PI / 4 };
export const contextRequestFixture: import('./index').ObjectContextRequest = { id: actorFixture.id, x: 640, y: 320 };
