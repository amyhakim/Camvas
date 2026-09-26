import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateShot } from '../features/camera/model';
import { parseProject, serializeProject } from '../features/project/model';
import { CAMERA_MOVE_PRESETS } from '../vendor/blockout/camera-moves';
import { projectFixture, subjectFixture } from '../contracts/fixtures';

test('all generated camera presets can be saved and restored', () => {
  for (const preset of CAMERA_MOVE_PRESETS) {
    const shot = generateShot(subjectFixture, { presetId: preset.id, duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' });
    const project = { ...projectFixture, shot };
    assert.deepEqual(parseProject(serializeProject(project), project.sceneId), JSON.parse(JSON.stringify(project)), preset.id);
  }
});
