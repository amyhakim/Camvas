import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STUDIO_DARK, effectiveLook, fadeAt, lightingAt, normalizeLook, normalizeTitles, titleOpacity } from './model';
import { letterboxRect } from './finish';

test('looks rebuild recognised fields only and reject out-of-range values', () => {
  const look = normalizeLook({ ...structuredClone(STUDIO_DARK), extra: 'ignored', lighting: { ...STUDIO_DARK.lighting, __proto__: { polluted: true } } });
  assert.deepEqual(look, STUDIO_DARK);
  assert.equal('extra' in look, false);
  assert.throws(() => normalizeLook({ ...STUDIO_DARK, camera: { ...STUDIO_DARK.camera, bloom: 2 } }), /camera\.bloom/);
  assert.throws(() => normalizeLook({ ...STUDIO_DARK, lighting: { ...STUDIO_DARK.lighting, rimColor: 'red' } }), /rimColor/);
});

test('the studio stage always has a look; other scenes keep their own light until one is set', () => {
  assert.equal(effectiveLook(undefined, 'studio'), STUDIO_DARK);
  assert.equal(effectiveLook(undefined, 'gsplat'), null);
});

test('light cues switch the rig on their start time and can move it to another subject', () => {
  const look = normalizeLook({ ...structuredClone(STUDIO_DARK), lighting: { ...STUDIO_DARK.lighting, subjectId: 'prop:a', cues: [
    { start: 4, angle: 1, key: 2, rim: .5, beam: 0, rimColor: '#0000ff', rimColor2: '#ffffff', subjectId: 'prop:b' },
    { start: 2, angle: .5, key: 1, rim: 1, beam: 1, rimColor: '#00ff00', rimColor2: '#ffffff' },
  ] } });
  assert.deepEqual(look.lighting.cues!.map(cue => cue.start), [2, 4]);
  assert.equal(lightingAt(look, 1).lighting.rimColor, STUDIO_DARK.lighting.rimColor);
  assert.equal(lightingAt(look, 2).lighting.rimColor, '#00ff00');
  assert.equal(lightingAt(look, 2).lighting.subjectId, 'prop:a');
  assert.equal(lightingAt(look, 5).lighting.subjectId, 'prop:b');
  assert.equal(lightingAt(look, 5).lighting.key, 2);
});

test('fades, titles and letterbox follow the timeline', () => {
  const look = { ...STUDIO_DARK, finish: { letterbox: 2.39, fadeIn: 1, fadeOut: 1 } };
  assert.equal(fadeAt(look, 0, 10), 1);
  assert.equal(fadeAt(look, .5, 10), .5);
  assert.equal(fadeAt(look, 5, 10), 0);
  assert.equal(fadeAt(look, 10, 10), 1);
  const [title] = normalizeTitles([{ id: 'title:end', text: 'Not filmed.  ', start: 8, duration: 2, align: 'upper' }]);
  assert.equal(title.text, 'Not filmed.  ', 'spaces typed mid-edit are kept');
  assert.equal(titleOpacity(title, 7.9), 0);
  assert.equal(titleOpacity(title, 9), 1);
  assert.throws(() => normalizeTitles([{ id: 'title:x', text: '   ', start: 0, duration: 1, align: 'center' }]));
  assert.deepEqual(letterboxRect(1920, 1080, 2.39), { x: 0, y: 139, width: 1920, height: 803 });
  assert.deepEqual(letterboxRect(1920, 1080, null), { x: 0, y: 0, width: 1920, height: 1080 });
});
