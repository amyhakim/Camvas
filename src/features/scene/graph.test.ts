import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { ProjectDocument, SceneManifest } from '../../contracts';
import { buildSceneGraph } from './graph';

const manifest = JSON.parse(readFileSync('public/scenes/pavilion.json', 'utf8')) as SceneManifest;
const emptyProject = (): ProjectDocument => ({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Pavilion study', shot: null, actors: [] });

test('Pavilion source becomes a stable spatial and temporal graph', () => {
  const project = { ...emptyProject(), placements: [{ id: 'Group', offset: [1, 0, 0] as [number, number, number] }] };
  const graph = buildSceneGraph(manifest, project, id => id === 'Group' ? { min: [0, 0, 0], max: [2, 2, 2] } : null);
  assert.equal(graph.sceneId, 'pavilion-v1');
  assert.equal(graph.nodes.length, manifest.objects.length + 1);
  assert.equal(graph.nodes.find(node => node.id === 'Group')?.kind, 'collection');
  assert.deepEqual(graph.nodes.find(node => node.id === 'Group')?.bounds, { min: [0, 0, 0], max: [2, 2, 2] });
  assert.equal(graph.nodes.find(node => node.id === 'Group')?.position?.[0], manifest.objects.find(object => object.id === 'Group')!.positionWeb[0] + 1);
  assert.equal(graph.nodes.find(node => node.id === 'Group')?.geometry, undefined);
  assert.equal(graph.nodes.filter(node => node.geometry?.role === 'render-mesh').length, 179);
  assert.ok(graph.nodes.some(node => node.needsSemanticLabel));
  const camera = manifest.objects.find(object => object.type === 'Camera' && object.samples && object.samples.length > 1)!;
  const track = graph.tracks.find(track => track.targetId === camera.id)!;
  assert.equal(track.keys[0].time, camera.samples![0].frame / manifest.fps);
  assert.deepEqual(track.keys[0].position, camera.positionWeb);
  assert.ok(track.keys[0].forward?.every((value, index) => Math.abs(value - camera.forwardWeb![index]) < .001));
  assert.equal(track.keys[1].time - track.keys[0].time, 1 / manifest.fps);
  assert.equal(graph.coverage.collider, 'uncomputed');
});

test('blocking and draft camera marks retain their time and relationships', () => {
  const project = emptyProject();
  project.actors = [{ id: 'actor:1', name: 'Visitor', color: '#ffffff', height: 1.7, marks: [
    { time: 0, position: [0, 0, 0], heading: 0 },
    { time: 3, position: [2, 0, 1], heading: 1 },
  ] }];
  project.props = [{ id: 'prop:1', name: 'Case', source: { kind: 'primitive', shape: 'box' }, position: [0, 0, 0], rotation: [0, 0, 0], size: 1, attachment: { actorId: 'actor:1', offset: [0, 1, 0], yaw: 0 } }];
  project.shot = { name: 'Follow visitor', subjectId: 'actor:1', subjectName: 'Visitor', target: [0, 1, 0], trackSubject: true,
    settings: { presetId: 'follow', duration: 3, focalLength: 35, sensor: 'fullFrame', framing: 'full' },
    marks: [{ time: 0, position: { x: -2, y: 2, z: 0 }, pan: 0, tilt: 0, roll: 0, focalLength: 35, easeIn: 0, easeOut: 0, hold: 0 }],
  };
  const graph = buildSceneGraph(manifest, project);
  assert.deepEqual(graph.tracks.find(track => track.kind === 'actor-pose')?.keys.map(key => key.time), [0, 3]);
  assert.deepEqual(graph.nodes.find(node => node.id === 'actor:1')?.collisionProxy?.size, [1.7 * .36, 1.7, 1.7 * .32]);
  assert.equal(graph.nodes.find(node => node.id === 'prop:1')?.visual?.shape, 'box');
  assert.ok(graph.edges.some(edge => edge.kind === 'attached-to' && edge.from === 'prop:1' && edge.to === 'actor:1'));
  assert.deepEqual(graph.edges.find(edge => edge.kind === 'attached-to')?.offset, [0, 1, 0]);
  assert.ok(graph.edges.some(edge => edge.kind === 'targets' && edge.from === 'shot:current' && edge.to === 'actor:1'));
  assert.deepEqual(graph.tracks.find(track => track.kind === 'draft-camera')?.keys[0].position, [-2, 2, 0]);
});
