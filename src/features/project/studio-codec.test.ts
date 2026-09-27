import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProjectDocument } from '../../contracts';
import { STUDIO_DARK } from '../look/model';
import { manualShot, addMark, markFromView } from '../camera/marks';
import { parseProject, serializeProject } from './model';

const view = { position: [0, 1, 3] as [number, number, number], target: [.1, .2, 0] as [number, number, number], fov: 30 };
const shot = addMark(manualShot(view, null, 2), { ...markFromView({ ...view, position: [2, .5, 1] }, 3, 'fullFrame'), cut: true });
const project: ProjectDocument = {
  format: 'showcam-project', version: 1, sceneId: 'studio', name: 'Spec ad', actors: [], shot,
  props: [{ id: 'prop:shoe', name: 'Shoe', source: { kind: 'model', provider: 'local', uid: 'local-0123456789abcdef01234567', name: 'shoe', author: 'You', authorUrl: '', license: 'Imported file', licenseUrl: '', viewerUrl: '' },
    position: [0, 0, 0], rotation: [0, 0, -Math.PI / 2], size: .4, motion: { spin: 38, float: .02, start: 1, end: 3, pivot: .11 } }],
  look: { ...structuredClone(STUDIO_DARK), lighting: { ...STUDIO_DARK.lighting, subjectId: 'prop:shoe', cues: [{ start: 2, angle: 1, key: 1, rim: 1, beam: 1, rimColor: '#4aa8ff', rimColor2: '#ffffff', subjectId: 'prop:shoe' }] } },
  titles: [{ id: 'title:end', text: 'Not filmed.', subtitle: 'Rendered in Camvas', start: 1, duration: 1.5, align: 'upper' }],
};

test('studio projects round-trip: local model, prop motion, cuts, aims, look, cues and titles', () => {
  assert.deepEqual(parseProject(serializeProject(project), 'studio'), project);
});

test('invalid studio data is rejected with its path', () => {
  const bad = (change: (draft: Record<string, any>) => void) => { const draft = structuredClone(project) as Record<string, any>; change(draft); return JSON.stringify(draft); };
  assert.throws(() => parseProject(bad(d => { d.shot.marks[0].cut = true; }), 'studio'), /first mark cannot be a cut/);
  assert.throws(() => parseProject(bad(d => { d.props[0].source.viewerUrl = 'https://example.com'; }), 'studio'), /local models have no links/);
  assert.throws(() => parseProject(bad(d => { d.look.atmosphere.haze = 3; }), 'studio'), /haze/);
  assert.throws(() => parseProject(bad(d => { d.titles[0].id = 'end'; }), 'studio'), /title:name/);
  assert.throws(() => parseProject(bad(d => { d.props[0].motion.spin = 9000; }), 'studio'), /spin/);
});
