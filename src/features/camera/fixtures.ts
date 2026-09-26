import { subjectFixture } from '../../contracts/fixtures';
import type { ShotSettings } from '../../contracts';
import { generateShot } from './model';

export { subjectFixture };
export const settingsFixture: ShotSettings = { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' };
export const shotFixture = generateShot(subjectFixture, settingsFixture);
