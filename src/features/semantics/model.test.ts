import assert from 'node:assert/strict';
import test from 'node:test';
import { groundSemanticProposal, parseSemanticSnapshot, semanticRevision, validateSemanticLayer } from './model';
import { parseProject, serializeProject } from '../project/model';
import type { SemanticSnapshot } from '../../contracts/semantics';

const snapshot: SemanticSnapshot = { sceneId: 'pavilion-v1', revision: semanticRevision({ sceneId: 'pavilion-v1' }), candidates: [
  { id: 'wall', name: 'Cube.1', materials: ['marble'], min: [0, 0, 0], max: [4, 3, .2] },
  { id: 'column', name: 'Cube.2', materials: ['steel'], min: [5, 0, 0], max: [5.1, 3, .1] },
], views: ['view-1', 'view-2'].map(id => ({ id, image: 'data:image/jpeg;base64,/9j/AA==', objects: [{ id: 'wall', number: 1, x: .5, y: .5 }, { id: 'column', number: 2, x: .8, y: .5 }] })) };
const proposal = () => ({ regions: [{ label: 'Marble wall', category: 'wall', entityIds: ['wall'], confidence: .8, evidence: 'Stone finish in two views.', viewIds: ['view-1', 'view-2'] }] });

test('AI chooses known geometry; bounds are derived, not accepted from model output', () => {
  const p = proposal(); Object.assign(p.regions[0], { min: [-100, -100, -100], reviewed: true });
  const layer = groundSemanticProposal(p, snapshot);
  assert.deepEqual(layer.regions[0].min, [0, 0, 0]);
  assert.deepEqual(layer.regions[0].max, [4, 3, .2]);
  assert.equal(layer.regions[0].reviewed, false);
  assert.throws(() => groundSemanticProposal({ regions: [{ ...p.regions[0], entityIds: ['invented'] }] }, snapshot), /unknown object/);
  assert.throws(() => groundSemanticProposal({ regions: [{ ...p.regions[0], viewIds: ['invented'] }] }, snapshot), /unknown view/);
});
test('unsupported evidence and invalid confidence reject the whole response', () => {
  const s = structuredClone(snapshot); s.views.forEach(v => v.objects = []);
  assert.throws(() => groundSemanticProposal(proposal(), s), /supporting view/);
  const p = proposal(); p.regions[0].confidence = 1.1;
  assert.throws(() => groundSemanticProposal(p, snapshot), /Invalid semantic region/);
});
test('project round-trip retains labels and review state, and rejects cross-scene labels', () => {
  const layer = groundSemanticProposal(proposal(), snapshot); layer.regions[0].reviewed = true;
  const project = { format: 'showcam-project' as const, version: 1 as const, sceneId: 'pavilion-v1', name: 'Labels', actors: [], shot: null, semantics: layer };
  assert.deepEqual(parseProject(serializeProject(project), project.sceneId).semantics, layer);
  assert.throws(() => serializeProject({ ...project, semantics: { ...layer, sceneId: 'other' } }), /different scene/);
  assert.notEqual(semanticRevision(project), semanticRevision({ ...project, placements: [{ id: 'wall', offset: [1, 0, 0] }] }));
});
test('snapshot validation rejects remote images and duplicate source IDs', () => {
  assert.equal(parseSemanticSnapshot(snapshot).candidates.length, 2);
  const s = structuredClone(snapshot); s.views[0].image = 'https://example.com/image.jpg';
  assert.throws(() => parseSemanticSnapshot(s), /Invalid scene image/);
  assert.throws(() => parseSemanticSnapshot({ ...snapshot, candidates: [snapshot.candidates[0], snapshot.candidates[0]] }), /Invalid scene geometry/);
  const layer = groundSemanticProposal(proposal(), snapshot);
  assert.throws(() => validateSemanticLayer({ ...layer, regions: [layer.regions[0], layer.regions[0]] }), /Invalid semantic region/);
});
