import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { ProjectDocument, SceneManifest } from '../contracts';
import { parseFlightPlan } from '../contracts/flight-plan';
import { buildSceneGraph, type SceneGraph } from '../features/scene/graph';
import { flightPlanningSnapshot } from './flight-planning-snapshot';
import { PAVILION_FLIGHT_LANDMARKS } from './pavilion-landmarks';

const graph: SceneGraph = {
  version: 1, sceneId: 'test', coordinateSpace: 'Y-up metres',
  nodes: [
    { id: 'scene:test', kind: 'scene', label: 'Test', semanticSource: 'scene' },
    { id: 'chair', kind: 'mesh', label: 'Chair', position: [2, 1, 2], semanticSource: 'blender-name' },
    { id: 'actor:one', kind: 'actor', label: 'Visitor', position: [0, 0, 0], semanticSource: 'project' },
    { id: 'flight:a', kind: 'landmark', category: 'Flight waypoint', label: 'Arrival', position: [0, 2, 0], semanticSource: 'project' },
    { id: 'flight:b', kind: 'landmark', category: 'Flight waypoint', label: 'Reveal', position: [3, 2, 0], semanticSource: 'project' },
  ],
  edges: [{ from: 'shot:current', to: 'flight:b', kind: 'planned-via', order: 1 }, { from: 'shot:current', to: 'flight:a', kind: 'planned-via', order: 0 }],
  tracks: [{ targetId: 'actor:one', kind: 'actor-pose', timing: 'shot-seconds', keys: [{ time: 0, position: [0, 0, 0], heading: 0 }, { time: 4, position: [2, 0, 0], heading: 1 }] }],
  coverage: { bounds: 'measured-when-available', connectivity: 'unverified', collider: 'uncomputed' },
};
const project: ProjectDocument = { format: 'showcam-project', version: 1, sceneId: 'test', name: 'Test', shot: null, actors: [] };

test('flight planning consumes ordered graph landmarks and actor tracks without changing the project', () => {
  const original = JSON.stringify(project);
  const snapshot = flightPlanningSnapshot(graph, project)!;
  assert.deepEqual(snapshot.landmarks.map(mark => mark.id), ['flight:a', 'flight:b']);
  assert.deepEqual(snapshot.actors[0].marks.map(mark => mark.time), [0, 4]);
  assert.deepEqual(snapshot.nodes.map(node => node.id), ['chair', 'actor:one']);
  assert.deepEqual(snapshot.edges.map(edge => [edge.kind, edge.to, edge.order]), [['planned-via', 'flight:b', 1], ['planned-via', 'flight:a', 0]]);
  assert.equal(JSON.stringify(project), original);
  assert.equal(flightPlanningSnapshot({ ...graph, nodes: graph.nodes.filter(node => node.id !== 'flight:b') }, project), null);
});

test('flight plan rejects skipped, reordered, stale, or invented scene references', () => {
  const snapshot = flightPlanningSnapshot(graph, project)!;
  const proposal = { arc: 'Approach and reveal', reviewNotes: ['Check the transition visually'], waypoints: [
    { landmarkId: 'flight:a', beat: 'Establish', arrivalTime: 0, gazeTargetId: 'chair', gazeNote: 'Wide view', blocking: 'Visitor at start', uncertainty: 'Clearance unknown' },
    { landmarkId: 'flight:b', beat: 'Reveal', arrivalTime: 4, gazeTargetId: 'chair', gazeNote: 'Show chair', blocking: 'Visitor at second mark', uncertainty: 'Clearance unknown' },
  ] };
  const accepted = parseFlightPlan(proposal, snapshot);
  assert.equal(accepted.revision, snapshot.revision);
  assert.deepEqual(accepted.waypoints.map(point => point.landmarkId), ['flight:a', 'flight:b']);
  assert.throws(() => parseFlightPlan({ ...proposal, waypoints: [proposal.waypoints[1], proposal.waypoints[0]] }, snapshot), /invalid waypoint/);
  assert.throws(() => parseFlightPlan({ ...proposal, waypoints: proposal.waypoints.slice(0, 1) }, snapshot), /incomplete/);
  assert.throws(() => parseFlightPlan({ ...proposal, waypoints: [proposal.waypoints[0], { ...proposal.waypoints[1], gazeTargetId: 'invented' }] }, snapshot), /invalid waypoint/);
  assert.notEqual(flightPlanningSnapshot({ ...graph, nodes: graph.nodes.map(node => node.id === 'flight:b' ? { ...node, position: [4, 2, 0] as [number, number, number] } : node) }, project)?.revision, snapshot.revision);
});

test('the Pavilion graph exposes all flight landmarks to the planner', () => {
  const manifest = JSON.parse(readFileSync('public/scenes/pavilion.json', 'utf8')) as SceneManifest;
  const pavilion: ProjectDocument = { ...project, sceneId: 'pavilion-v1', landmarks: PAVILION_FLIGHT_LANDMARKS };
  const snapshot = flightPlanningSnapshot(buildSceneGraph(manifest, pavilion), pavilion)!;
  assert.equal(snapshot.landmarks.length, PAVILION_FLIGHT_LANDMARKS.length);
  assert.equal(snapshot.landmarks.at(-1)?.id, 'flight:exterior-aerial');
});
