import { subjectFixture } from '../../contracts/fixtures';
import type { CameraShot, ShotSettings } from '../../contracts';
import { generateShot } from './model';

export { subjectFixture };
export const settingsFixture: ShotSettings = { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' };
export const shotFixture = generateShot(subjectFixture, settingsFixture);

/** A manually edited draft with a middle-mark hold and authored orientation. */
export const editedDraftFixture: CameraShot = {
  name: 'Edited lateral move', subjectId: 'chair', subjectName: 'Chair', target: [10, 3, -5],
  settings: { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' },
  trackSubject: false,
  marks: [
    { time: 0, position: { x: 0, y: 2, z: 8 }, pan: -.4, tilt: .4, roll: .1, focalLength: 24, easeIn: 0, easeOut: 0, hold: 0 },
    { time: 3, position: { x: 4, y: 2, z: 8 }, pan: .8, tilt: -.2, roll: .3, focalLength: 50, easeIn: 0, easeOut: 0, hold: 1.5 },
    { time: 6, position: { x: 8, y: 2, z: 8 }, pan: 1.2, tilt: .2, roll: .5, focalLength: 80, easeIn: 0, easeOut: 0, hold: 0 },
  ],
};
