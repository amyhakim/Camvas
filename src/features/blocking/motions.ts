import type { ActorBody, ActorMotion, ActorTrack, MotionSource, PoseControls, PoseJoint, PoseKey } from '../../contracts';
import { blendPose, sanitizePose, UPPER_BODY_JOINTS } from '../../lib/humanoid';

export const MAX_ACTOR_MOTIONS = 32;
export const MAX_POSE_KEYS = 24;
const FADE = .3;

type Generator = (seconds: number) => PoseControls;
export type MotionPreset = { id: string; label: string; description: string; layer: 'full' | 'upper'; loop: boolean; length: number; keys?: PoseKey[]; generate?: Generator };

const TAU = Math.PI * 2;
const both = (left: PoseJoint, right: PoseJoint, controls: Record<string, number>): PoseControls => ({ [left]: controls, [right]: controls });
const merge = (...poses: PoseControls[]): PoseControls => poses.reduce<PoseControls>((acc, pose) => {
  for (const [joint, controls] of Object.entries(pose) as [PoseJoint, Record<string, number>][]) acc[joint] = { ...acc[joint], ...controls };
  return acc;
}, {});
const arms = (controls: Record<string, number>) => both('leftArm', 'rightArm', controls);
const elbows = (bend: number) => both('leftElbow', 'rightElbow', { bend });
const legs = (controls: Record<string, number>) => both('leftLeg', 'rightLeg', controls);
const knees = (bend: number) => both('leftKnee', 'rightKnee', { bend });

/** Standing relaxed with a slow breath. */
export const REST: PoseControls = merge(arms({ raise: 6 }), elbows(8));
const idle: Generator = t => {
  const breath = Math.sin(TAU * t / 4);
  return merge(REST, { chest: { bend: 1.5 * breath }, head: { nod: 1.5 * breath }, leftElbow: { bend: 8 + 2 * breath }, rightElbow: { bend: 8 + 2 * breath } });
};
/** One full gait cycle per unit phase (left and right step). */
function gait(phase: number, amount: 'walk' | 'run'): PoseControls {
  const s = Math.sin(TAU * phase), c = Math.cos(TAU * phase);
  const run = amount === 'run';
  const leg = run ? 38 : 22, arm = run ? 35 : 18;
  return {
    hips: { lower: run ? .03 + .04 * s * s : .02 * s * s, turn: (run ? 6 : 4) * s },
    spine: { bend: run ? 10 : 3 }, chest: { twist: -(run ? 8 : 5) * s },
    leftLeg: { forward: leg * s }, rightLeg: { forward: -leg * s },
    leftKnee: { bend: (run ? 15 : 6) + (run ? 80 : 35) * Math.max(0, c) }, rightKnee: { bend: (run ? 15 : 6) + (run ? 80 : 35) * Math.max(0, -c) },
    leftFoot: { point: (run ? 10 : 6) * Math.max(0, -s) }, rightFoot: { point: (run ? 10 : 6) * Math.max(0, s) },
    leftArm: { forward: -arm * s, raise: run ? 12 : 6 }, rightArm: { forward: arm * s, raise: run ? 12 : 6 },
    leftElbow: { bend: run ? 85 : 12 + 10 * Math.max(0, -s) }, rightElbow: { bend: run ? 85 : 12 + 10 * Math.max(0, s) },
  };
}
const key = (time: number, ...poses: PoseControls[]): PoseKey => ({ time, pose: merge(...poses) });

const GUARD = merge(arms({ forward: 55, raise: 10, twist: 10 }), elbows(125), { leftLeg: { forward: 15 }, rightLeg: { forward: -10 } }, knees(15));
const SIT = merge({ hips: { lower: .42 } }, legs({ forward: 88 }), knees(88), { spine: { bend: -4 } }, arms({ forward: 30, raise: 5 }), elbows(55));
const LIE = merge({ hips: { pitch: -90, lower: .85 } }, arms({ raise: 15 }));
const CROUCH = merge({ hips: { lower: .45 } }, legs({ forward: 95 }), knees(125), { spine: { bend: 30 } }, arms({ forward: 40 }), elbows(40));

/** Built-in motions, all authored in the canonical pose language (free, no external assets). */
export const MOTION_PRESETS: MotionPreset[] = [
  { id: 'idle', label: 'Idle', description: 'Stand relaxed and breathe.', layer: 'full', loop: true, length: 4, generate: idle },
  { id: 'walk', label: 'Walk in place', description: 'Walk cycle without travelling (moving between marks walks automatically).', layer: 'full', loop: true, length: 1.1, generate: t => gait(t / 1.1, 'walk') },
  { id: 'run', label: 'Run in place', description: 'Run cycle without travelling (fast moves between marks run automatically).', layer: 'full', loop: true, length: .7, generate: t => gait(t / .7, 'run') },
  { id: 'wave', label: 'Wave', description: 'Wave with the right hand. Upper body, so it works while walking.', layer: 'upper', loop: true, length: 1.2, keys: [0, .3, .6, .9, 1.2].map((time, i) => key(time, { rightArm: { raise: 105, forward: 15, twist: 90 }, rightElbow: { bend: i % 2 ? 85 : 55 }, head: { tilt: -4 }, leftArm: { raise: 6 }, leftElbow: { bend: 8 } })) },
  { id: 'point', label: 'Point', description: 'Point forward with the right arm and look along it.', layer: 'upper', loop: false, length: .6, keys: [key(0, REST), key(.6, { rightArm: { forward: 85, raise: 8 }, rightElbow: { bend: 5 }, rightWrist: { bend: -10 }, head: { turn: -10 }, chest: { twist: -8 }, leftArm: { raise: 6 }, leftElbow: { bend: 8 } })] },
  { id: 'clap', label: 'Clap', description: 'Clap hands in front of the chest.', layer: 'upper', loop: true, length: .5, keys: [key(0, arms({ forward: 55, raise: -8 }), elbows(85)), key(.25, arms({ forward: 58, raise: -18 }), elbows(95)), key(.5, arms({ forward: 55, raise: -8 }), elbows(85))] },
  { id: 'cheer', label: 'Cheer', description: 'Both arms up, pumping.', layer: 'upper', loop: true, length: .8, keys: [key(0, arms({ forward: 160, raise: 25 }), elbows(10)), key(.4, arms({ forward: 150, raise: 25 }), elbows(45)), key(.8, arms({ forward: 160, raise: 25 }), elbows(10))] },
  { id: 'hands-up', label: 'Hands up', description: 'Raise both hands (surrender).', layer: 'upper', loop: false, length: .4, keys: [key(0, REST), key(.4, arms({ raise: 95, twist: 90 }), elbows(90))] },
  { id: 'arms-crossed', label: 'Arms crossed', description: 'Fold the arms across the chest.', layer: 'upper', loop: false, length: .5, keys: [key(0, REST), key(.5, arms({ forward: 45, raise: -25, twist: 25 }), elbows(115))] },
  { id: 'hands-on-hips', label: 'Hands on hips', description: 'Hands resting on the hips, elbows out.', layer: 'upper', loop: false, length: .5, keys: [key(0, REST), key(.5, arms({ raise: 40, forward: -10, twist: -70 }), elbows(105))] },
  { id: 'think', label: 'Think', description: 'Hand to chin, other arm supporting.', layer: 'upper', loop: false, length: .6, keys: [key(0, REST), key(.6, { rightArm: { forward: 35, raise: 5, twist: 20 }, rightElbow: { bend: 145 }, leftArm: { forward: 30, raise: -10 }, leftElbow: { bend: 95 }, head: { nod: 12, tilt: 6 } })] },
  { id: 'phone', label: 'Phone call', description: 'Hold a phone to the right ear.', layer: 'upper', loop: false, length: .6, keys: [key(0, REST), key(.6, { rightArm: { forward: 25, raise: 30, twist: 60 }, rightElbow: { bend: 150 }, head: { tilt: 10 }, leftArm: { raise: 6 }, leftElbow: { bend: 8 } })] },
  { id: 'talk', label: 'Talk', description: 'Conversational hand gestures.', layer: 'upper', loop: true, length: 3, keys: [
    key(0, arms({ forward: 25, raise: 5 }), elbows(70)),
    key(.75, { rightArm: { forward: 45, raise: 8, twist: 15 }, rightElbow: { bend: 60 }, leftArm: { forward: 25, raise: 5 }, leftElbow: { bend: 80 }, head: { nod: 4 } }),
    key(1.5, arms({ forward: 35, raise: 15, twist: 20 }), elbows(65), { head: { tilt: 4 } }),
    key(2.25, { leftArm: { forward: 45, raise: 8, twist: 15 }, leftElbow: { bend: 60 }, rightArm: { forward: 25, raise: 5 }, rightElbow: { bend: 80 }, head: { nod: -3 } }),
    key(3, arms({ forward: 25, raise: 5 }), elbows(70))] },
  { id: 'salute', label: 'Salute', description: 'Right-hand salute.', layer: 'upper', loop: false, length: .5, keys: [key(0, REST), key(.5, { rightArm: { raise: 80, forward: 35, twist: 70 }, rightElbow: { bend: 140 }, leftArm: { raise: 4 }, leftElbow: { bend: 5 }, head: { nod: -3 } })] },
  { id: 'shrug', label: 'Shrug', description: 'Palms up, head tilted.', layer: 'upper', loop: false, length: 1.2, keys: [key(0, REST), key(.4, arms({ raise: 25, twist: 70 }), elbows(90), { head: { tilt: 8 } }), key(.9, arms({ raise: 25, twist: 70 }), elbows(90), { head: { tilt: 8 } }), key(1.2, REST)] },
  { id: 'nod', label: 'Nod', description: 'Nod yes.', layer: 'upper', loop: true, length: .8, keys: [key(0, REST), key(.4, REST, { head: { nod: 15 } }), key(.8, REST)] },
  { id: 'shake-head', label: 'Shake head', description: 'Shake head no.', layer: 'upper', loop: true, length: .8, keys: [key(0, REST, { head: { turn: -20 } }), key(.4, REST, { head: { turn: 20 } }), key(.8, REST, { head: { turn: -20 } })] },
  { id: 'look-around', label: 'Look around', description: 'Scan left and right.', layer: 'upper', loop: true, length: 4, keys: [key(0, REST), key(1, REST, { head: { turn: 55 }, chest: { twist: 15 } }), key(2, REST), key(3, REST, { head: { turn: -55 }, chest: { twist: -15 } }), key(4, REST)] },
  { id: 'bow', label: 'Bow', description: 'Bow from the waist and straighten.', layer: 'full', loop: false, length: 2, keys: [key(0, REST), key(.6, REST, { spine: { bend: 35 }, chest: { bend: 20 }, head: { nod: 15 } }, arms({ forward: 10 })), key(1.4, REST, { spine: { bend: 35 }, chest: { bend: 20 }, head: { nod: 15 } }, arms({ forward: 10 })), key(2, REST)] },
  { id: 'sit', label: 'Sit (chair)', description: 'Sit down on a chair-height seat and stay seated.', layer: 'full', loop: false, length: 1, keys: [key(0, REST), key(1, SIT)] },
  { id: 'stand-up', label: 'Stand up', description: 'Stand up from a chair.', layer: 'full', loop: false, length: 1, keys: [key(0, SIT), key(1, REST)] },
  { id: 'sit-ground', label: 'Sit on ground', description: 'Sit cross-legged on the floor.', layer: 'full', loop: false, length: 1.2, keys: [key(0, REST), key(1.2, { hips: { lower: .85 } }, legs({ forward: 80, out: 40, twist: 50 }), knees(130), { spine: { bend: 10 } }, arms({ forward: 25 }), elbows(50))] },
  { id: 'kneel', label: 'Kneel', description: 'Kneel on the right knee.', layer: 'full', loop: false, length: 1, keys: [key(0, REST), key(1, { hips: { lower: .45 }, leftLeg: { forward: 90 }, leftKnee: { bend: 90 }, rightLeg: { forward: -5 }, rightKnee: { bend: 95 }, rightFoot: { point: 40 } }, arms({ raise: 8 }), elbows(20))] },
  { id: 'crouch', label: 'Crouch', description: 'Crouch low, ready.', layer: 'full', loop: false, length: .8, keys: [key(0, REST), key(.8, CROUCH)] },
  { id: 'lie-down', label: 'Lie down', description: 'Lie on the back.', layer: 'full', loop: false, length: 1.5, keys: [key(0, REST), key(.8, CROUCH), key(1.5, LIE)] },
  { id: 'fall', label: 'Fall', description: 'Lose balance and fall backwards onto the ground.', layer: 'full', loop: false, length: 1.2, keys: [key(0, REST), key(.35, { spine: { bend: -15 }, hips: { lower: .1 } }, arms({ raise: 60, forward: 40 }), knees(20)), key(.8, { hips: { pitch: -60, lower: .6 } }, arms({ raise: 50, forward: 30 }), knees(30)), key(1.2, LIE)] },
  { id: 'jump', label: 'Jump', description: 'Jump straight up and land.', layer: 'full', loop: false, length: 1.2, keys: [
    key(0, REST), key(.3, { hips: { lower: .18 }, spine: { bend: 20 } }, legs({ forward: 45 }), knees(70), arms({ forward: -30 })),
    key(.5, { hips: { lower: -.25 } }, legs({ forward: 5 }), knees(10), both('leftFoot', 'rightFoot', { point: 30 }), arms({ forward: 150, raise: 20 })),
    key(.75, { hips: { lower: -.3 } }, legs({ forward: 20 }), knees(30), arms({ forward: 120, raise: 20 })),
    key(1, { hips: { lower: .18 } }, legs({ forward: 45 }), knees(70), arms({ forward: 20 })), key(1.2, REST)] },
  { id: 'punch', label: 'Punch', description: 'Boxing guard with alternating jabs.', layer: 'full', loop: true, length: .9, keys: [
    key(0, GUARD), key(.2, GUARD, { rightArm: { forward: 88, raise: 5, twist: 0 }, rightElbow: { bend: 5 }, chest: { twist: 20 } }), key(.45, GUARD),
    key(.65, GUARD, { leftArm: { forward: 88, raise: 5, twist: 0 }, leftElbow: { bend: 5 }, chest: { twist: -12 } }), key(.9, GUARD)] },
  { id: 'kick', label: 'Kick', description: 'Front kick with the right leg.', layer: 'full', loop: false, length: 1, keys: [key(0, GUARD), key(.35, GUARD, { rightLeg: { forward: 70 }, rightKnee: { bend: 100 } }), key(.55, GUARD, { rightLeg: { forward: 85 }, rightKnee: { bend: 5 }, spine: { bend: -10 } }), key(.8, GUARD, { rightLeg: { forward: 70 }, rightKnee: { bend: 100 } }), key(1, GUARD)] },
  { id: 'dance', label: 'Dance', description: 'Side-to-side groove with arm swings.', layer: 'full', loop: true, length: 2, keys: [
    key(0, { hips: { side: 8, lower: .05 }, leftArm: { raise: 120, twist: 60 }, leftElbow: { bend: 40 }, rightArm: { raise: 30 }, rightElbow: { bend: 30 }, head: { tilt: 6 } }, knees(15)),
    key(.5, { hips: { lower: .12 }, leftArm: { raise: 70, twist: 30 }, leftElbow: { bend: 60 }, rightArm: { raise: 70, twist: 30 }, rightElbow: { bend: 60 } }, knees(30)),
    key(1, { hips: { side: -8, lower: .05 }, rightArm: { raise: 120, twist: 60 }, rightElbow: { bend: 40 }, leftArm: { raise: 30 }, leftElbow: { bend: 30 }, head: { tilt: -6 } }, knees(15)),
    key(1.5, { hips: { lower: .12 }, leftArm: { raise: 70, twist: 30 }, leftElbow: { bend: 60 }, rightArm: { raise: 70, twist: 30 }, rightElbow: { bend: 60 } }, knees(30)),
    key(2, { hips: { side: 8, lower: .05 }, leftArm: { raise: 120, twist: 60 }, leftElbow: { bend: 40 }, rightArm: { raise: 30 }, rightElbow: { bend: 30 }, head: { tilt: 6 } }, knees(15))] },
  { id: 'push', label: 'Push', description: 'Lean in and push forward with both arms.', layer: 'full', loop: false, length: .8, keys: [key(0, REST), key(.8, arms({ forward: 85 }), elbows(20), { spine: { bend: 15 }, leftLeg: { forward: 15 }, rightLeg: { forward: -20 } }, knees(20))] },
  { id: 'pick-up', label: 'Pick up', description: 'Bend down, pick something up with the right hand, stand holding it.', layer: 'full', loop: false, length: 2, keys: [
    key(0, REST), key(.8, { hips: { pitch: 25, lower: .15 }, spine: { bend: 45 }, chest: { bend: 15 }, rightArm: { forward: 70 }, rightElbow: { bend: 10 }, leftArm: { forward: 40 } }, legs({ forward: 30 }), knees(45)),
    key(1.2, { hips: { pitch: 25, lower: .15 }, spine: { bend: 45 }, chest: { bend: 15 }, rightArm: { forward: 70 }, rightElbow: { bend: 30 }, leftArm: { forward: 40 } }, legs({ forward: 30 }), knees(45)),
    key(2, REST, { rightArm: { forward: 20 }, rightElbow: { bend: 60 } })] },
  { id: 'stumble', label: 'Stumble', description: 'Trip forward and recover.', layer: 'full', loop: false, length: 1.2, keys: [key(0, REST), key(.3, { spine: { bend: 25 }, rightLeg: { forward: 40 } }, arms({ forward: 60, raise: 40 }), knees(30)), key(.7, { spine: { bend: 10 } }, arms({ raise: 20 })), key(1.2, REST)] },
];
const PRESETS = new Map(MOTION_PRESETS.map(preset => [preset.id, preset]));
export const motionPreset = (id: string) => PRESETS.get(id);

/** Director-facing catalogue: id, layer, one-line description. */
export function motionCatalogue() { return MOTION_PRESETS.map(preset => [preset.id, preset.layer, preset.description]); }

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

function sampleKeys(keys: PoseKey[], t: number): PoseControls {
  if (t <= keys[0].time) return keys[0].pose;
  const end = keys.findIndex(item => item.time >= t);
  if (end < 0) return keys[keys.length - 1].pose;
  const a = keys[end - 1], b = keys[end];
  return blendPose(a.pose, b.pose, smooth((t - a.time) / Math.max(1e-6, b.time - a.time)));
}

export function motionLayer(source: MotionSource): 'full' | 'upper' {
  return source.kind === 'custom' ? source.layer : source.kind === 'preset' ? PRESETS.get(source.preset)?.layer ?? 'full' : 'full';
}
export function motionLabel(source: MotionSource) {
  return source.kind === 'preset' ? PRESETS.get(source.preset)?.label ?? source.preset : source.kind === 'clip' ? `Clip · ${source.clip}` : source.name;
}

/** Pose of a procedural motion `seconds` after it starts. Looping motions tile; one-shots hold their last pose. */
function sampleMotion(motion: ActorMotion, seconds: number): PoseControls {
  const source = motion.source;
  if (source.kind === 'custom') {
    const length = source.keys[source.keys.length - 1].time;
    return sampleKeys(source.keys, motion.loop && length > 0 ? seconds % length : seconds);
  }
  if (source.kind !== 'preset') return {};
  const preset = PRESETS.get(source.preset);
  if (!preset) return {};
  const t = preset.loop || motion.loop ? seconds % preset.length : Math.min(seconds, preset.length);
  return preset.generate ? preset.generate(t) : sampleKeys(preset.keys!, t);
}

/** Walk/run from the actor's own marks: phase follows distance travelled, so feet never slide; fades at starts and stops. */
function locomotion(actor: ActorTrack, t: number): PoseControls {
  const marks = actor.marks, scale = actor.height / 1.75;
  let travelled = 0;
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i], b = marks[i + 1];
    const length = Math.hypot(b.position[0] - a.position[0], b.position[2] - a.position[2]);
    const duration = b.time - a.time;
    if (t < a.time) break;
    if (t >= b.time) { travelled += length; continue; }
    const speed = length / duration;
    if (speed < .05 * scale) break;
    const run = speed > 2.2 * scale;
    const stride = (run ? 2.6 : 1.4) * scale;
    const moving = (j: number) => { const p = marks[j], q = marks[j + 1]; return !!q && Math.hypot(q.position[0] - p.position[0], q.position[2] - p.position[2]) / (q.time - p.time) >= .05 * scale; };
    const into = i > 0 && moving(i - 1) ? 1 : smooth((t - a.time) / FADE);
    const out = moving(i + 1) ? 1 : smooth((b.time - t) / FADE);
    const phase = (travelled + length * (t - a.time) / duration) / stride;
    return blendPose(idle(t), gait(phase, run ? 'run' : 'walk'), Math.min(into, out));
  }
  return idle(t);
}

/** Body state at authored time t (seconds). Pure and stateless, so scrubbing in either direction is exact. */
export function evaluateActorBody(actor: ActorTrack, t: number): ActorBody {
  const base = locomotion(actor, t);
  const active = (layer: 'full' | 'upper') => (actor.motions ?? []).filter(motion => motionLayer(motion.source) === layer && t >= motion.start && t < motion.start + motion.duration).sort((a, b) => b.start - a.start)[0];
  const full = active('full'), upper = active('upper');
  const weight = (motion: ActorMotion) => { const fade = Math.min(FADE, motion.duration / 3); return Math.min(smooth((t - motion.start) / fade), smooth((motion.start + motion.duration - t) / fade)); };
  if (full?.source.kind === 'clip') return { pose: base, clip: { name: full.source.clip, time: t - full.start, loop: full.loop } };
  let pose = full ? blendPose(base, sampleMotion(full, t - full.start), weight(full)) : base;
  if (upper) pose = blendPose(pose, sampleMotion(upper, t - upper.start), weight(upper), UPPER_BODY_JOINTS);
  return { pose };
}

export function validateMotion(motion: ActorMotion): void {
  if (!Number.isFinite(motion.start) || motion.start < 0 || motion.start > 60) throw new Error('Motion start must be 0–60 s.');
  if (!Number.isFinite(motion.duration) || motion.duration < .2 || motion.duration > 60 || motion.start + motion.duration > 120) throw new Error('Motion duration must be 0.2–60 s.');
  if (typeof motion.loop !== 'boolean') throw new Error('Motion loop must be true or false.');
  const source = motion.source;
  if (source.kind === 'preset') { if (!PRESETS.has(source.preset)) throw new Error(`Unknown motion “${String(source.preset).slice(0, 40)}”.`); }
  else if (source.kind === 'clip') { if (typeof source.clip !== 'string' || !source.clip.trim() || source.clip.length > 100) throw new Error('Clip names must be 1–100 characters.'); }
  else if (source.kind === 'custom') {
    if (typeof source.name !== 'string' || !source.name.trim() || source.name.length > 60) throw new Error('Custom motion names must be 1–60 characters.');
    if (source.layer !== 'full' && source.layer !== 'upper') throw new Error('Custom motion layer must be full or upper.');
    if (!Array.isArray(source.keys) || source.keys.length < 1 || source.keys.length > MAX_POSE_KEYS) throw new Error(`Custom motions need 1–${MAX_POSE_KEYS} pose keys.`);
    source.keys.forEach((item, i) => {
      if (!Number.isFinite(item.time) || item.time < 0 || item.time > 60 || (i && item.time <= source.keys[i - 1].time)) throw new Error('Pose key times must increase within 0–60 s.');
      sanitizePose(item.pose, true);
    });
  } else throw new Error('Unknown motion source.');
}

/** Place a motion, replacing overlapping motions on the same layer so the timeline stays readable. */
export function placeMotion(actor: ActorTrack, motion: ActorMotion): ActorTrack {
  validateMotion(motion);
  const layer = motionLayer(motion.source), end = motion.start + motion.duration;
  const kept = (actor.motions ?? []).filter(item => motionLayer(item.source) !== layer || item.start >= end || item.start + item.duration <= motion.start);
  if (kept.length >= MAX_ACTOR_MOTIONS) throw new Error(`Keep at most ${MAX_ACTOR_MOTIONS} motions per actor.`);
  return { ...actor, motions: [...kept, motion].sort((a, b) => a.start - b.start) };
}

export function removeMotionAt(actor: ActorTrack, seconds: number | null): ActorTrack {
  const motions = seconds === null ? [] : (actor.motions ?? []).filter(item => !(seconds >= item.start && seconds < item.start + item.duration));
  const { motions: _old, ...rest } = actor;
  return motions.length ? { ...rest, motions } : rest;
}

export function motionsEnd(actor: ActorTrack) { return Math.max(0, ...(actor.motions ?? []).map(motion => motion.start + motion.duration)); }

/** Natural length of a preset for default durations: one-shots play once and hold briefly; loops run four seconds. */
export function defaultMotionDuration(source: MotionSource) {
  if (source.kind === 'preset') { const preset = PRESETS.get(source.preset); return preset ? (preset.loop ? 4 : Math.max(1, preset.length + 1)) : 2; }
  if (source.kind === 'custom') return Math.max(.5, source.keys[source.keys.length - 1].time + .5);
  return 3;
}
