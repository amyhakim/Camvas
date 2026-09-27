import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProjectDocument, SceneManifest, ViewportHandle } from '../contracts';
import { automaticFlightSnapshot } from './automatic-flight-snapshot';
import { semanticRevision } from '../features/semantics/model';
const project: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'test', name: 'Test', actors: [], shot: null };
project.semantics = { version: 1, sceneId: 'test', revision: semanticRevision(project), regions: [{ id: 'region:chair', label: 'Chair', category: 'seating', entityIds: ['chair'], min: [0, 0, 0], max: [1, 1, 1], confidence: 1, reviewed: true, evidence: 'fixture', viewIds: ['fixture'] }] };
const manifest = { id: 'test', objects: [{ id: 'chair', type: 'Mesh' }] } as SceneManifest;
const viewport = { captureRouteMapGeometry: () => [{ min: [0, 0, 0], max: [1, 1, 1], color: '#fff' }], viewState: () => ({ position: [2, 2, 2] }) } as unknown as ViewportHandle;
test('automatic planning does not require or reuse landmarks', () => {
  const s = automaticFlightSnapshot(project, manifest, viewport, 'Show chair');
  assert.equal(s.subjects[0].entityId, 'chair'); assert.equal('landmarks' in s, false);
  assert.notEqual(s.revision, automaticFlightSnapshot(project, manifest, viewport, 'Show chair then zoom').revision);
});
test('automatic saving blocks stale labels, missing geometry and unsupported dynamic scenes', () => {
  assert.throws(() => automaticFlightSnapshot({ ...project, placements: [{ id: 'chair', offset: [1, 0, 0] }] }, manifest, viewport, 'Test'), /up-to-date/);
  assert.throws(() => automaticFlightSnapshot(project, { ...manifest, asset: { kind: 'gsplat', url: '/splat' } }, viewport, 'Test'), /segmented/);
  assert.throws(() => automaticFlightSnapshot(project, { ...manifest, objects: [{ ...manifest.objects[0], animated: true }] }, viewport, 'Test'), /time-aware/);
  assert.throws(() => automaticFlightSnapshot(project, manifest, { ...viewport, captureRouteMapGeometry: () => [] }, 'Test'), /geometry/);
  assert.throws(() => automaticFlightSnapshot(project, manifest, { ...viewport, captureRouteMapGeometry: () => Array(1500).fill({ min: [0, 0, 0], max: [1, 1, 1], color: '#fff' }) }, 'Test'), /limit/);
});
