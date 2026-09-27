/**
 * Canonical humanoid pose language shared by blocking (timeline evaluation), the Director and the viewport.
 *
 * Canonical space: a character facing +Z, Y up, its left hand on +X (glTF convention), feet at Y = 0 and
 * height normalised to 1. The rest pose is a T-pose in which every bone frame is aligned with those axes.
 * Poses are readable controls in degrees (plus `hips.lower`, a fraction of hip height) with 0 meaning
 * "standing relaxed, arms at the sides". Rotations about X keep their sign on both sides; rotations about
 * Y and Z are mirrored, so the same numbers mean the same movement for the left and the right limb.
 */
import type { PoseControls, PoseJoint, Vector3Tuple } from '../contracts';

export type Quat = [number, number, number, number];
export type HumanBone =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'leftUpperArm' | 'leftLowerArm' | 'leftHand' | 'rightUpperArm' | 'rightLowerArm' | 'rightHand'
  | 'leftUpperLeg' | 'leftLowerLeg' | 'leftFoot' | 'rightUpperLeg' | 'rightLowerLeg' | 'rightFoot';

const DEG = Math.PI / 180;

// ── Quaternion helpers ([x, y, z, w]) ────────────────────────────────────────────────────────────────
export const IDENTITY: Quat = [0, 0, 0, 1];
export function axisAngle(axis: 'x' | 'y' | 'z', degrees: number): Quat {
  const half = degrees * DEG / 2, s = Math.sin(half);
  return [axis === 'x' ? s : 0, axis === 'y' ? s : 0, axis === 'z' ? s : 0, Math.cos(half)];
}
export function mul(a: Quat, b: Quat): Quat {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}
export const conjugate = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
export function rotate(q: Quat, v: Vector3Tuple): Vector3Tuple {
  const r = mul(mul(q, [v[0], v[1], v[2], 0]), conjugate(q));
  return [r[0], r[1], r[2]];
}
export function normalize(v: Vector3Tuple): Vector3Tuple {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
/** Shortest rotation taking unit vector `from` onto unit vector `to`. */
export function fromTo(from: Vector3Tuple, to: Vector3Tuple): Quat {
  const a = normalize(from), b = normalize(to);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (dot < -0.999999) {
    const axis = normalize(Math.abs(a[0]) < .9 ? [0, -a[2], a[1]] : [-a[2], 0, a[0]]);
    return [axis[0], axis[1], axis[2], 0];
  }
  const cross: Vector3Tuple = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const q: Quat = [cross[0], cross[1], cross[2], 1 + dot];
  const length = Math.hypot(...q);
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

// ── Canonical skeleton ───────────────────────────────────────────────────────────────────────────────
/** Parent-first order; offsets are T-pose positions relative to the parent joint (height = 1). */
export const HUMAN_SKELETON: { bone: HumanBone; parent: HumanBone | null; offset: Vector3Tuple; direction: Vector3Tuple }[] = [
  { bone: 'hips', parent: null, offset: [0, .53, 0], direction: [0, 1, 0] },
  { bone: 'spine', parent: 'hips', offset: [0, .06, 0], direction: [0, 1, 0] },
  { bone: 'chest', parent: 'spine', offset: [0, .12, 0], direction: [0, 1, 0] },
  { bone: 'neck', parent: 'chest', offset: [0, .12, 0], direction: [0, 1, 0] },
  { bone: 'head', parent: 'neck', offset: [0, .05, 0], direction: [0, 1, 0] },
  { bone: 'leftUpperArm', parent: 'chest', offset: [.12, .09, 0], direction: [1, 0, 0] },
  { bone: 'leftLowerArm', parent: 'leftUpperArm', offset: [.16, 0, 0], direction: [1, 0, 0] },
  { bone: 'leftHand', parent: 'leftLowerArm', offset: [.14, 0, 0], direction: [1, 0, 0] },
  { bone: 'rightUpperArm', parent: 'chest', offset: [-.12, .09, 0], direction: [-1, 0, 0] },
  { bone: 'rightLowerArm', parent: 'rightUpperArm', offset: [-.16, 0, 0], direction: [-1, 0, 0] },
  { bone: 'rightHand', parent: 'rightLowerArm', offset: [-.14, 0, 0], direction: [-1, 0, 0] },
  { bone: 'leftUpperLeg', parent: 'hips', offset: [.06, -.02, 0], direction: [0, -1, 0] },
  { bone: 'leftLowerLeg', parent: 'leftUpperLeg', offset: [0, -.23, 0], direction: [0, -1, 0] },
  { bone: 'leftFoot', parent: 'leftLowerLeg', offset: [0, -.24, 0], direction: normalize([0, -.26, .96]) },
  { bone: 'rightUpperLeg', parent: 'hips', offset: [-.06, -.02, 0], direction: [0, -1, 0] },
  { bone: 'rightLowerLeg', parent: 'rightUpperLeg', offset: [0, -.23, 0], direction: [0, -1, 0] },
  { bone: 'rightFoot', parent: 'rightLowerLeg', offset: [0, -.24, 0], direction: normalize([0, -.26, .96]) },
];
/** Segment ends past the last joint of each chain, for drawing the mannequin. */
export const HUMAN_TIPS: Partial<Record<HumanBone, Vector3Tuple>> = {
  head: [0, .12, 0], leftHand: [.08, 0, 0], rightHand: [-.08, 0, 0], leftFoot: [0, -.03, .11], rightFoot: [0, -.03, .11],
};
export const HIP_HEIGHT = .53;

// ── Pose controls ────────────────────────────────────────────────────────────────────────────────────
type Limits = Record<string, [number, number]>;
const TORSO: Limits = { bend: [-30, 60], side: [-30, 30], twist: [-45, 45] };
const HEAD: Limits = { nod: [-40, 50], turn: [-80, 80], tilt: [-30, 30] };
const ARM: Limits = { raise: [-30, 180], forward: [-60, 180], twist: [-90, 90] };
const LEG: Limits = { forward: [-40, 120], out: [-20, 60], twist: [-45, 45] };
export const POSE_JOINTS: Record<PoseJoint, { bone: HumanBone; controls: Limits }> = {
  hips: { bone: 'hips', controls: { turn: [-180, 180], pitch: [-90, 90], side: [-45, 45], lower: [-.4, .9] } },
  spine: { bone: 'spine', controls: TORSO }, chest: { bone: 'chest', controls: TORSO },
  neck: { bone: 'neck', controls: HEAD }, head: { bone: 'head', controls: HEAD },
  leftArm: { bone: 'leftUpperArm', controls: ARM }, rightArm: { bone: 'rightUpperArm', controls: ARM },
  leftElbow: { bone: 'leftLowerArm', controls: { bend: [0, 150] } }, rightElbow: { bone: 'rightLowerArm', controls: { bend: [0, 150] } },
  leftWrist: { bone: 'leftHand', controls: { bend: [-70, 70], side: [-30, 30] } }, rightWrist: { bone: 'rightHand', controls: { bend: [-70, 70], side: [-30, 30] } },
  leftLeg: { bone: 'leftUpperLeg', controls: LEG }, rightLeg: { bone: 'rightUpperLeg', controls: LEG },
  leftKnee: { bone: 'leftLowerLeg', controls: { bend: [0, 150] } }, rightKnee: { bone: 'rightLowerLeg', controls: { bend: [0, 150] } },
  leftFoot: { bone: 'leftFoot', controls: { point: [-30, 50] } }, rightFoot: { bone: 'rightFoot', controls: { point: [-30, 50] } },
};
export const UPPER_BODY_JOINTS: PoseJoint[] = ['spine', 'chest', 'neck', 'head', 'leftArm', 'rightArm', 'leftElbow', 'rightElbow', 'leftWrist', 'rightWrist'];

/** Keep only known joints/controls with finite values, clamped to their limits. Throws on non-numeric input when `strict`. */
export function sanitizePose(raw: unknown, strict = false): PoseControls {
  const pose: PoseControls = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) { if (strict) throw new Error('A pose must be an object of joints.'); return pose; }
  for (const [joint, controls] of Object.entries(raw as Record<string, unknown>)) {
    // Own keys only: names such as "constructor" must never resolve to Object.prototype members.
    const spec = Object.hasOwn(POSE_JOINTS, joint) ? POSE_JOINTS[joint as PoseJoint] : undefined;
    if (!spec) { if (strict) throw new Error(`Unknown pose joint "${joint.slice(0, 40)}".`); continue; }
    if (!controls || typeof controls !== 'object' || Array.isArray(controls)) { if (strict) throw new Error(`Pose joint ${joint} must be an object of controls.`); continue; }
    const out: Record<string, number> = {};
    for (const [name, value] of Object.entries(controls as Record<string, unknown>)) {
      const limits = Object.hasOwn(spec.controls, name) ? spec.controls[name] : undefined;
      if (!limits) { if (strict) throw new Error(`${joint} has no "${name.slice(0, 40)}" control. Use ${Object.keys(spec.controls).join(', ')}.`); continue; }
      if (typeof value !== 'number' || !Number.isFinite(value)) { if (strict) throw new Error(`${joint}.${name} must be a number.`); continue; }
      out[name] = Math.min(limits[1], Math.max(limits[0], value));
    }
    if (Object.keys(out).length) pose[joint as PoseJoint] = out;
  }
  return pose;
}

const value = (pose: PoseControls, joint: PoseJoint, control: string) => pose[joint]?.[control] ?? 0;

/** Linear blend per control; absent controls count as neutral (0). `joints` limits which joints `over` replaces. */
export function blendPose(base: PoseControls, over: PoseControls, weight: number, joints?: PoseJoint[]): PoseControls {
  const w = Math.min(1, Math.max(0, weight));
  if (w === 0) return base;
  const out: PoseControls = {};
  for (const joint of Object.keys(POSE_JOINTS) as PoseJoint[]) {
    const names = new Set([...Object.keys(base[joint] ?? {}), ...(!joints || joints.includes(joint) ? Object.keys(over[joint] ?? {}) : [])]);
    if (!names.size) continue;
    const replace = !joints || joints.includes(joint);
    const controls: Record<string, number> = {};
    for (const name of names) {
      const a = value(base, joint, name);
      controls[name] = replace ? a + (value(over, joint, name) - a) * w : a;
    }
    out[joint] = controls;
  }
  return out;
}

/** Parent-relative canonical rotations of each bone from its T-pose frame. */
export function localRotations(pose: PoseControls): Record<HumanBone, Quat> {
  const v = (joint: PoseJoint, control: string) => value(pose, joint, control);
  const rot = (...parts: Quat[]) => parts.reduce((acc, part) => mul(acc, part), IDENTITY);
  const arm = (side: 'left' | 'right') => {
    const s = side === 'left' ? 1 : -1, j = `${side}Arm` as PoseJoint;
    return rot(axisAngle('x', -v(j, 'forward')), axisAngle('z', s * (v(j, 'raise') - 90)), axisAngle('x', -v(j, 'twist')));
  };
  const leg = (side: 'left' | 'right') => {
    const s = side === 'left' ? 1 : -1, j = `${side}Leg` as PoseJoint;
    return rot(axisAngle('x', -v(j, 'forward')), axisAngle('z', s * v(j, 'out')), axisAngle('y', s * v(j, 'twist')));
  };
  const torso = (j: PoseJoint) => rot(axisAngle('y', v(j, 'twist')), axisAngle('x', v(j, 'bend')), axisAngle('z', v(j, 'side')));
  const head = (j: PoseJoint) => rot(axisAngle('y', v(j, 'turn')), axisAngle('x', v(j, 'nod')), axisAngle('z', v(j, 'tilt')));
  return {
    hips: rot(axisAngle('y', v('hips', 'turn')), axisAngle('x', v('hips', 'pitch')), axisAngle('z', v('hips', 'side'))),
    spine: torso('spine'), chest: torso('chest'), neck: head('neck'), head: head('head'),
    leftUpperArm: arm('left'), rightUpperArm: arm('right'),
    leftLowerArm: axisAngle('y', -v('leftElbow', 'bend')), rightLowerArm: axisAngle('y', v('rightElbow', 'bend')),
    leftHand: rot(axisAngle('z', -v('leftWrist', 'bend')), axisAngle('y', -v('leftWrist', 'side'))),
    rightHand: rot(axisAngle('z', v('rightWrist', 'bend')), axisAngle('y', v('rightWrist', 'side'))),
    leftUpperLeg: leg('left'), rightUpperLeg: leg('right'),
    leftLowerLeg: axisAngle('x', v('leftKnee', 'bend')), rightLowerLeg: axisAngle('x', v('rightKnee', 'bend')),
    leftFoot: axisAngle('x', v('leftFoot', 'point')), rightFoot: axisAngle('x', v('rightFoot', 'point')),
  };
}

/** Canonical-space rotation of each bone relative to its T-pose orientation (forward kinematics). */
export function worldRotations(pose: PoseControls): Record<HumanBone, Quat> {
  const local = localRotations(pose), world = {} as Record<HumanBone, Quat>;
  for (const { bone, parent } of HUMAN_SKELETON) world[bone] = parent ? mul(world[parent], local[bone]) : local[bone];
  return world;
}

/** Joint positions of the canonical mannequin (height 1) in a pose; used for drawing checks and tests. */
export function jointPositions(pose: PoseControls): Record<HumanBone | `${HumanBone}Tip`, Vector3Tuple> {
  const world = worldRotations(pose), out = {} as Record<string, Vector3Tuple>;
  for (const { bone, parent, offset } of HUMAN_SKELETON) {
    if (!parent) { out[bone] = [0, HIP_HEIGHT * (1 - value(pose, 'hips', 'lower')), 0]; continue; }
    const r = rotate(world[parent], offset), p = out[parent];
    out[bone] = [p[0] + r[0], p[1] + r[1], p[2] + r[2]];
  }
  for (const [bone, tip] of Object.entries(HUMAN_TIPS) as [HumanBone, Vector3Tuple][]) {
    const r = rotate(world[bone], tip), p = out[bone];
    out[`${bone}Tip`] = [p[0] + r[0], p[1] + r[1], p[2] + r[2]];
  }
  return out as Record<HumanBone | `${HumanBone}Tip`, Vector3Tuple>;
}

/** Plain-language control reference for the Director prompt. */
export function poseReference(): string {
  return Object.entries(POSE_JOINTS).map(([joint, spec]) => `${joint}{${Object.entries(spec.controls).map(([name, [min, max]]) => `${name} ${min}..${max}`).join(', ')}}`).join('; ');
}
