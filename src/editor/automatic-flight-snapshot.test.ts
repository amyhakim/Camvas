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
  assert.throws(() => automaticFlightSnapshot(project, { ...manifest, asset: { kind: 'gsplat', url: '/splat' } }, viewport, 'Test'), /Review navigation/);
  assert.throws(() => automaticFlightSnapshot(project, { ...manifest, objects: [{ ...manifest.objects[0], animated: true }] }, viewport, 'Test'), /time-aware/);
  assert.throws(() => automaticFlightSnapshot(project, manifest, { ...viewport, captureRouteMapGeometry: () => [] }, 'Test'), /geometry/);
  assert.throws(() => automaticFlightSnapshot(project, manifest, { ...viewport, captureRouteMapGeometry: () => Array(1500).fill({ min: [0, 0, 0], max: [1, 1, 1], color: '#fff' }) }, 'Test'), /limit/);
});


test('reviewed splat proxies ground routes with source identity and bounded placed coverage', () => {
  const capture: SceneManifest = { ...manifest, asset: { kind: 'gsplat', url: '/splat' }, objects: [{ ...manifest.objects[0], type: 'Splat' }] };
  const prepared: ProjectDocument = { ...project, collision: { version: 1, entityId: 'chair', sourceUrl: '/splat', offset: [0, 0, 0], cellSize: 1, sampleCount: 50, reviewed: true, region: { min: [-4, -4, -4], max: [4, 4, 4] }, boxes: [{ id: 'box', min: [0, 0, 0], max: [1, 1, 1] }] } };
  const result = automaticFlightSnapshot(prepared, capture, viewport, 'Tour the capture');
  assert.equal(result.geometryKind, 'splat-proxies');
  assert.deepEqual(result.coverage, prepared.collision!.region);
  assert.throws(() => automaticFlightSnapshot({ ...prepared, collision: { ...prepared.collision!, sourceUrl: '/different' } }, capture, viewport, 'Tour'), /match/);
  assert.throws(() => automaticFlightSnapshot(prepared, capture, { ...viewport, viewState: () => ({ position: [9, 9, 9], target: [0, 0, 0], forward: [0, 0, -1], fov: 50 }) }, 'Tour'), /inside/);
});
