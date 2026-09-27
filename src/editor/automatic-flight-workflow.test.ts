import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAutomaticFlight } from './automatic-flight-workflow';
import { generateAutomaticFlight } from '../features/camera/automatic-flight';
import { parseAutomaticPlan, parseAutomaticSnapshot, type AutomaticFlightPlan, type AutomaticFlightSnapshot } from '../contracts/automatic-flight';
import { parseProject, serializeProject } from '../features/project/model';

const snapshot: AutomaticFlightSnapshot = { sceneId: 'fixture', revision: 'one', intent: 'Smooth pass and zoom', start: [0, 2, 0],
  subjects: [{ id: 'chair', entityId: 'chair-mesh', label: 'Chair', min: [3, 0, -3], max: [4, 1, -2] }],
  obstacles: [{ min: [-20, -1, -20], max: [20, 0, 20] }] };
const plan: AutomaticFlightPlan = { name: 'Smooth test', narrative: 'Approach, reveal, settle', controls: [
  { position: [0, 2, 0], gazeTargetId: 'chair', gazeMode: 'subject' }, { position: [3, 2, 0], gazeTargetId: 'chair', gazeMode: 'subject' }, { position: [6, 2, 0], gazeTargetId: 'chair', gazeMode: 'subject' }],
  beats: [{ label: 'Approach', controlIndex: 0, targetId: 'chair' }, { label: 'Reveal', controlIndex: 2, targetId: 'chair' }], cruiseSpeed: 1, focalLength: 22, finalFocalLength: 40, zoomSeconds: 6, uncertainties: [] };
const frames = async (samples: { time: number }[]) => samples.map(s => ({ time: s.time, image: 'data:image/jpeg;base64,AAAA' }));
const options = () => ({ signal: new AbortController().signal, isCurrent: () => true, onStage: () => {}, render: frames });
test('generic intent route is smooth, serializable and not landmark locked', () => {
  const result = generateAutomaticFlight(parseAutomaticPlan(plan, parseAutomaticSnapshot(snapshot)), snapshot);
  assert.ok(result.metrics.clearance > .31); assert.ok(result.metrics.peakTurnRate < 35);
  assert.equal(result.shot.anchorIds, undefined);
  parseProject(serializeProject({ format: 'showcam-project', version: 1, sceneId: snapshot.sceneId, name: 'Test', actors: [], shot: result.shot }), snapshot.sceneId);
});
test('thin obstacles between camera keys block automatic acceptance', () => {
  assert.throws(() => generateAutomaticFlight(plan, { ...snapshot, obstacles: [...snapshot.obstacles, { min: [2.13, 0, -.1], max: [2.14, 4, .1] }] }), /blocked/);
});
test('no geometry, bad bounds, invented gaze subjects and skipped end beats are rejected', () => {
  assert.throws(() => parseAutomaticSnapshot({ ...snapshot, obstacles: [] }));
  assert.throws(() => parseAutomaticSnapshot({ ...snapshot, obstacles: [{ min: [1, 2, 3], max: [0, 0, 0] }] }));
  assert.throws(() => parseAutomaticPlan({ ...plan, controls: plan.controls.map(c => ({ ...c, gazeTargetId: 'invented' })) }, snapshot));
  assert.throws(() => parseAutomaticPlan({ ...plan, beats: plan.beats.slice(0, 1) }, snapshot));
});
test('auto flow only returns a saveable shot after matching rendered review', async () => {
  const stages: string[] = [], requests: string[] = [];
  const result = await runAutomaticFlight(snapshot, { ...options(), onStage: s => stages.push(s), request: async body => {
    const stage = (body as { stage: string }).stage; requests.push(stage);
    return { sceneId: snapshot.sceneId, revision: snapshot.revision, ...(stage === 'plan' ? { plan } : { review: { approved: true, notes: ['Framing matches.'] } }) };
  } });
  assert.deepEqual(requests, ['plan', 'review']); assert.deepEqual(stages, ['planning', 'validating', 'rendering', 'reviewing']);
  assert.ok(result.frames.length >= 3);
});
test('visual rejection retries at most three times and never returns a shot', async () => {
  let reviews = 0;
  await assert.rejects(runAutomaticFlight(snapshot, { ...options(), request: async body => {
    const stage = (body as { stage: string }).stage;
    if (stage === 'review') reviews++;
    return { sceneId: snapshot.sceneId, revision: snapshot.revision, ...(stage === 'plan' ? { plan } : { review: { approved: false, notes: ['Chair occluded.'] } }) };
  } }), /3 attempts/);
  assert.equal(reviews, 3);
});
test('stale scene and cancellation prevent subsequent stages', async () => {
  let current = true;
  await assert.rejects(runAutomaticFlight(snapshot, { ...options(), isCurrent: () => current, request: async () => { current = false; return { sceneId: snapshot.sceneId, revision: snapshot.revision, plan }; } }), /stale/);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(runAutomaticFlight(snapshot, { ...options(), signal: abort.signal, request: async () => { throw Error('Must not call'); } }), /abort/i);
});
test('mismatched or missing frame evidence never reaches visual approval', async () => {
  let reviews = 0;
  await assert.rejects(runAutomaticFlight(snapshot, { ...options(), render: async () => [], request: async body => { if ((body as { stage: string }).stage === 'review') reviews++; return { sceneId: snapshot.sceneId, revision: snapshot.revision, plan }; } }), /3 attempts/);
  assert.equal(reviews, 0);
});
