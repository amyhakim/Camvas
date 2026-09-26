import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultCollaborator, normalizeCollaboratorName, normalizeRoomId, readCollaborators, readSharedSceneState } from './model';

test('room ids are shareable but reject unsafe values', () => {
  assert.equal(normalizeRoomId('Team_Room-12'), 'team_room-12');
  assert.equal(normalizeRoomId('../room'), null);
  assert.equal(normalizeRoomId('tiny'), null);
});

test('shared scene state clamps frames and ignores invalid modes', () => {
  const state = readSharedSceneState(new Map<string, unknown>([['frame', -12], ['mode', 'teleport'], ['cameraId', 'Camera.002']]));
  assert.deepEqual(state, { frame: 1, cameraId: 'Camera.002' });
});

test('awareness exposes safe cursor and collaborator values', () => {
  const people = readCollaborators(new Map([[7, { user: { id: 'abc', name: '  Amy   H  ', color: '#fff' }, cursor: { x: 2, y: -.5 }, selectedId: 'chair' }]]), 7);
  assert.deepEqual(people[0], { clientId: 7, id: 'abc', name: 'Amy H', color: '#fff', selectedId: 'chair', cursor: { x: 1, y: 0 }, local: true });
  assert.equal(normalizeCollaboratorName('   '), 'Anonymous builder');
  assert.match(defaultCollaborator('participant123').name, /^Builder /);
});
