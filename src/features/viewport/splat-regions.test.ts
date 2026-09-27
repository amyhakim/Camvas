import test from 'node:test';
import assert from 'node:assert/strict';
import { splatRegionCandidates } from './splat-regions';
import { groundSemanticProposal } from '../semantics/model';
import { createCollection, serializeCollection, parseCollection } from '../project/collection';
import type { FittedBlock } from './blockout-fit';

test('splat candidates are bounded, deterministic groups of measured surfaces with a stable source', () => {
  const blocks: FittedBlock[] = Array.from({ length: 200 }, (_, i) => ({ min: [i % 20, Math.floor(i / 20), 0], max: [i % 20 + .2, Math.floor(i / 20) + .2, .1] }));
  const candidates = splatRegionCandidates(blocks, 'capture', 32);
  assert.equal(candidates.length, 32);
  assert.deepEqual(candidates, splatRegionCandidates(blocks, 'capture', 32));
  assert.ok(candidates.every(c => c.sourceEntityId === 'capture' && c.min.every((n, a) => n <= c.max[a])));
  const chosen = candidates[3];
  const snapshot = { sceneId: 'splat', revision: 'r', candidates, views: [{ id: 'view', image: 'data:image/jpeg;base64,AAAA', objects: [{ id: chosen.id, number: 4, x: .5, y: .5 }] }] };
  const semantics = groundSemanticProposal({ regions: [{ label: 'Surface area', category: 'area', entityIds: [chosen.id], confidence: .7, evidence: 'Measured fixture', viewIds: ['view'] }] }, snapshot);
  assert.deepEqual(semantics.regions[0].entityIds, ['capture']);
  assert.deepEqual(semantics.regions[0].min, chosen.min);
  assert.equal(semantics.regions[0].reviewed, false);
  const collection = createCollection({ format: 'showcam-project', version: 1, sceneId: 'splat', name: 'Test', actors: [], shot: null, semantics }, 'entry');
  assert.deepEqual(parseCollection(serializeCollection(collection)).scenes[0].document.semantics, semantics);
});
