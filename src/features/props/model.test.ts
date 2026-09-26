import assert from 'node:assert/strict';
import test from 'node:test';
import type { ModelSource, ProjectDocument } from '../../contracts';
import { parseProject, serializeProject } from '../project/model';
import { createProp, updateProp, validateModelSource } from './model';

const source: ModelSource = { provider: 'sketchfab', uid: 'c'.repeat(32), name: 'Chair', author: 'Author', authorUrl: 'https://sketchfab.com/author', license: 'CC0 Public Domain', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', viewerUrl: `https://sketchfab.com/3d-models/${'c'.repeat(32)}` };

test('props validate size, tint and source links', () => {
  assert.throws(() => createProp('prop:a', 'A', { kind: 'primitive', shape: 'box' }, [0, 0, 0], { size: 0 }));
  assert.throws(() => createProp('bad', 'A', { kind: 'primitive', shape: 'box' }, [0, 0, 0]));
  assert.throws(() => validateModelSource({ ...source, authorUrl: 'javascript:alert(1)' }));
  assert.throws(() => validateModelSource({ ...source, viewerUrl: 'https://evil.example/3d-models/x' }));
  const prop = createProp('prop:a', 'A', { kind: 'model', ...source }, [1, 0, 1], { color: '#112233' });
  assert.equal(updateProp(prop, { color: null }).color, undefined);
  assert.equal(updateProp(prop, { size: 2 }).color, '#112233');
});

test('projects round-trip props, actor models and camera signatures', () => {
  const project: ProjectDocument = {
    format: 'showcam-project', version: 1, sceneId: 's', name: 'Props', shot: null,
    actors: [{ id: 'actor:a', name: 'A', color: '#aabbcc', height: 1.7, marks: [{ time: 0, position: [0, 0, 0], heading: 0 }], model: source }],
    props: [createProp('prop:chair', 'Chair', { kind: 'model', ...source }, [1, 0, 1], { rotation: [0, 1, 0], size: .9, color: '#ffffff' }), createProp('prop:box', 'Box', { kind: 'primitive', shape: 'box' }, [0, 0, 0])],
  };
  assert.deepEqual(parseProject(serializeProject(project), 's'), project);
  const hostile = JSON.parse(serializeProject(project));
  hostile.props[0].source.viewerUrl = 'https://evil.example/';
  assert.throws(() => parseProject(JSON.stringify(hostile), 's'));
  hostile.props[0].source.viewerUrl = project.props![0].source.kind === 'model' ? project.props![0].source.viewerUrl : '';
  hostile.props[0].__proto__polluted = true;
  assert.equal('__proto__polluted' in parseProject(JSON.stringify(hostile), 's').props![0], false);
});
