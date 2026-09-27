import * as pc from 'playcanvas';
import type { PoseControls } from '@/contracts';
import { fromTo, HUMAN_SKELETON, worldRotations, type HumanBone, type Quat } from '@/lib/humanoid';
import { mapHumanoid, type RigLandmark, type RigMapping, type RigNode } from './rig-map';

const pcQuat = (q: Quat) => new pc.Quat(q[0], q[1], q[2], q[3]);
function walk(node: pc.GraphNode, visit: (node: pc.GraphNode) => void) { visit(node); for (const child of node.children) walk(child, visit); }

/** Parent-first node list for name mapping. */
export function collectRig(model: pc.GraphNode): { nodes: pc.GraphNode[]; list: RigNode[] } {
  const nodes: pc.GraphNode[] = [], list: RigNode[] = [], index = new Map<pc.GraphNode, number>();
  walk(model, node => { const p = node.getPosition(); index.set(node, nodes.length); list.push({ name: node.name, parent: node.parent ? index.get(node.parent) ?? -1 : -1, position: [p.x, p.y, p.z] }); nodes.push(node); });
  return { nodes, list };
}
export function isSkinned(model: pc.Entity) {
  return (model.findComponents('render') as pc.RenderComponent[]).some(render => render.meshInstances.some(instance => !!instance.skinInstance));
}
export type RigAnalysis = { skinned: boolean; mapping: RigMapping; landmarks: Partial<Record<RigLandmark, pc.GraphNode>>; nodes: pc.GraphNode[] };
export function analyzeRig(model: pc.Entity): RigAnalysis {
  const { nodes, list } = collectRig(model);
  const mapping = mapHumanoid(list);
  const landmarks: Partial<Record<RigLandmark, pc.GraphNode>> = {};
  for (const [key, index] of Object.entries(mapping.bones) as [RigLandmark, number][]) landmarks[key] = nodes[index];
  return { skinned: isSkinned(model), mapping, landmarks, nodes };
}
/** Degrees about Y that turn the rig to face +Z, from its shoulder line (left shoulder on +X). */
export function facingYaw(landmarks: Partial<Record<RigLandmark, pc.GraphNode>>): number {
  const left = landmarks.leftUpperArm ?? landmarks.leftUpperLeg, right = landmarks.rightUpperArm ?? landmarks.rightUpperLeg;
  if (!left || !right) return 0;
  const across = left.getPosition().clone().sub(right.getPosition());
  if (Math.hypot(across.x, across.z) < 1e-6) return 0;
  return Math.atan2(across.z, across.x) * pc.math.RAD_TO_DEG;
}

/** Snapshot of local transforms so every frame starts from the rest pose and nothing accumulates. */
export class RestPose {
  private entries: { node: pc.GraphNode; position: pc.Vec3; rotation: pc.Quat; scale: pc.Vec3 }[] = [];
  constructor(nodes: pc.GraphNode[]) { for (const node of nodes) this.entries.push({ node, position: node.getLocalPosition().clone(), rotation: node.getLocalRotation().clone(), scale: node.getLocalScale().clone() }); }
  restore() { for (const entry of this.entries) { entry.node.setLocalPosition(entry.position); entry.node.setLocalRotation(entry.rotation); entry.node.setLocalScale(entry.scale); } }
}

const AIM: Record<HumanBone, RigLandmark[]> = {
  hips: ['spine', 'chest', 'neck', 'head'], spine: ['chest', 'neck', 'head'], chest: ['neck', 'head'], neck: ['head'], head: ['headTop'],
  leftUpperArm: ['leftLowerArm'], leftLowerArm: ['leftHand'], leftHand: ['leftMiddle'], rightUpperArm: ['rightLowerArm'], rightLowerArm: ['rightHand'], rightHand: ['rightMiddle'],
  leftUpperLeg: ['leftLowerLeg'], leftLowerLeg: ['leftFoot'], leftFoot: ['leftToe'], rightUpperLeg: ['rightLowerLeg'], rightLowerLeg: ['rightFoot'], rightFoot: ['rightToe'],
};

/**
 * Drives any humanoid skeleton from canonical poses. `space` is a node whose local frame is canonical
 * (Y up, character facing +Z). Each mapped bone gets world rotation  W·C·R  where R is its rest rotation,
 * C the correction that turns its rest direction into the canonical T-pose direction (A-poses included),
 * and W the canonical pose rotation. Unmapped bones (fingers, shoulders, twist bones) keep their rest.
 */
export class HumanoidDriver {
  private bones: { bone: HumanBone; node: pc.GraphNode; rest: pc.Quat; correction: pc.Quat }[] = [];
  private hips: { node: pc.GraphNode; rest: pc.Vec3; height: number } | null = null;
  constructor(private space: pc.GraphNode, landmarks: Partial<Record<RigLandmark, pc.GraphNode>>) {
    const toSpace = space.getWorldTransform().clone().invert();
    const spaceRotation = space.getRotation().clone().invert();
    const at = (node: pc.GraphNode) => toSpace.transformPoint(node.getPosition(), new pc.Vec3());
    const corrections = new Map<HumanBone, pc.Quat>();
    for (const { bone, parent, direction } of HUMAN_SKELETON) {
      const node = landmarks[bone];
      if (!node) continue;
      let correction: pc.Quat | null = null;
      const aim = AIM[bone].map(key => landmarks[key]).find(Boolean);
      if (aim) {
        const d = at(aim).sub(at(node));
        if (d.length() > 1e-6) correction = pcQuat(fromTo([d.x, d.y, d.z], direction));
      }
      if (!correction) {
        // End bones without a landmark follow their nearest mapped parent's correction.
        let ancestor = parent;
        while (ancestor && !corrections.has(ancestor)) ancestor = HUMAN_SKELETON.find(item => item.bone === ancestor)!.parent;
        correction = ancestor ? corrections.get(ancestor)!.clone() : new pc.Quat();
      }
      corrections.set(bone, correction);
      this.bones.push({ bone, node, rest: spaceRotation.clone().mul(node.getRotation()), correction });
    }
    if (landmarks.hips) {
      const rest = at(landmarks.hips);
      const grounds = (['leftToe', 'rightToe', 'leftFoot', 'rightFoot', 'leftLowerLeg', 'rightLowerLeg'] as RigLandmark[]).map(key => landmarks[key]).filter((node): node is pc.GraphNode => !!node).map(node => at(node).y);
      // Without leg landmarks there is no floor reference, so poses never lower the hips.
      this.hips = { node: landmarks.hips, rest, height: grounds.length ? Math.max(0, rest.y - Math.min(...grounds)) : 0 };
    }
  }
  apply(pose: PoseControls) {
    const world = worldRotations(pose);
    const spaceRotation = this.space.getRotation().clone();
    const target = new pc.Quat(), local = new pc.Quat();
    for (const item of this.bones) {
      target.copy(spaceRotation).mul(pcQuat(world[item.bone])).mul(item.correction).mul(item.rest);
      const parent = item.node.parent;
      if (parent) local.copy(parent.getRotation()).invert().mul(target); else local.copy(target);
      item.node.setLocalRotation(local);
    }
    if (this.hips) {
      const lower = pose.hips?.lower ?? 0;
      const desired = this.hips.rest.clone(); desired.y -= lower * this.hips.height;
      this.placeHips(desired);
    }
  }
  /** Keep a clip's travel from pulling the body off the actor's marks: pin the hips' horizontal position. */
  pinHips() {
    if (!this.hips) return;
    const now = this.space.getWorldTransform().clone().invert().transformPoint(this.hips.node.getPosition(), new pc.Vec3());
    this.placeHips(new pc.Vec3(this.hips.rest.x, now.y, this.hips.rest.z));
  }
  private placeHips(spacePosition: pc.Vec3) {
    const world = this.space.getWorldTransform().transformPoint(spacePosition, new pc.Vec3());
    const parent = this.hips!.node.parent;
    this.hips!.node.setLocalPosition(parent ? parent.getWorldTransform().clone().invert().transformPoint(world, new pc.Vec3()) : world);
  }
}

/** A model's own animation clips, sampled at an exact time (scrub-safe). */
export class ClipPlayer {
  readonly clips: { name: string; duration: number; track: pc.AnimTrack }[];
  private evaluator: pc.AnimEvaluator;
  private current: { name: string; loop: boolean; clip: pc.AnimClip } | null = null;
  constructor(model: pc.Entity, resource: pc.ContainerResource) {
    const animations = (resource as pc.ContainerResource & { animations?: pc.Asset[] }).animations ?? [];
    const used = new Set<string>();
    this.clips = animations.map((asset, i) => {
      const track = asset.resource as pc.AnimTrack;
      let name = (track.name || asset.name || `Clip ${i + 1}`).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 100) || `Clip ${i + 1}`;
      while (used.has(name)) name = `${name.slice(0, 96)} ${i + 1}`;
      used.add(name);
      return { name, duration: track.duration, track };
    }).filter(clip => clip.duration > 0);
    this.evaluator = new pc.AnimEvaluator(new pc.DefaultAnimBinder(model));
  }
  apply(name: string, time: number, loop: boolean): boolean {
    const entry = this.clips.find(clip => clip.name === name);
    if (!entry) return false;
    if (!this.current || this.current.name !== name || this.current.loop !== loop) {
      this.evaluator.removeClips();
      const clip = new pc.AnimClip(entry.track, 0, 1, true, loop);
      this.evaluator.addClip(clip);
      this.current = { name, loop, clip };
    }
    this.current.clip.time = loop ? ((time % entry.duration) + entry.duration) % entry.duration : Math.min(Math.max(0, time), entry.duration);
    this.evaluator.update(0);
    return true;
  }
  destroy() { this.evaluator.removeClips(); }
}
