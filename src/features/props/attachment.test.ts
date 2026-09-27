import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActorPose, SceneProp } from '../../contracts';
import { parseProject, serializeProject } from '../project/model';
import { attachProp, detachProp, resolveProp } from './attachment';

const actor: ActorPose = { id: 'actor:alice', name: 'Alice', color: '#ffffff', height: 1.7, position: [2, 0, 3], heading: Math.PI / 2 };
const prop: SceneProp = { id: 'prop:case', name: 'Case', source: { kind: 'primitive', shape: 'box' }, position: [3, 1, 3], rotation: [0, .2, 0], size: .4 };

test('an attached prop preserves its pose, follows actor yaw, and freezes when detached', () => {
  const attached = attachProp(prop, actor);
  assert.deepEqual(resolveProp(attached, actor).position.map(v => +v.toFixed(8)), prop.position);
  const moved = { ...actor, position: [5, 0, 7] as [number, number, number], heading: Math.PI };
  const world = resolveProp(attached, moved);
  assert.deepEqual(world.position.map(v => +v.toFixed(8)), [5, 1, 6]);
  const detached = detachProp(attached, moved);
  assert.equal(detached.attachment, undefined);
  assert.deepEqual(detached.position.map(v => +v.toFixed(8)), [5, 1, 6]);
  assert.ok(Math.abs(detached.rotation[1] - (Math.PI / 2 + .2)) < 1e-8);
});

test('attachment survives project round trip and rejects a missing actor', () => {
  const project = { format: 'showcam-project' as const, version: 1 as const, sceneId: 'test', name: 'Test', shot: null, actors: [{ id: actor.id, name: actor.name, color: actor.color, height: actor.height, marks: [{ time: 0, position: actor.position, heading: actor.heading }] }], props: [attachProp(prop, actor)] };
  assert.deepEqual(parseProject(serializeProject(project), 'test').props, project.props);
  assert.throws(() => serializeProject({ ...project, actors: [] }), /followed actor is missing/);
});
