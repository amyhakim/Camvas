import * as pc from 'playcanvas';
import { HUMAN_SKELETON, HUMAN_TIPS, type HumanBone } from '@/lib/humanoid';
import type { RigLandmark } from './rig-map';
import { HumanoidDriver, RestPose } from './rig';

type Part = { type: string; center: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number]; accent?: boolean };
/** Segment shapes per joint, in the joint's T-pose frame (height 1). Limbs run along their canonical direction. */
const PARTS: Partial<Record<HumanBone, Part[]>> = {
  hips: [{ type: 'box', center: [0, -.01, 0], scale: [.2, .1, .12] }],
  spine: [{ type: 'box', center: [0, .06, 0], scale: [.19, .13, .11] }],
  chest: [{ type: 'box', center: [0, .06, 0], scale: [.25, .15, .13] }, { type: 'sphere', center: [.12, .09, 0], scale: [.07, .07, .07] }, { type: 'sphere', center: [-.12, .09, 0], scale: [.07, .07, .07] }],
  neck: [{ type: 'cylinder', center: [0, .03, 0], scale: [.05, .06, .05] }],
  head: [{ type: 'sphere', center: [0, .06, 0], scale: [.13, .15, .14] }, { type: 'sphere', center: [0, .06, .07], scale: [.035, .035, .035], accent: true }],
  leftUpperArm: [{ type: 'cylinder', center: [.08, 0, 0], scale: [.06, .16, .06], rotation: [0, 0, 90] }],
  leftLowerArm: [{ type: 'sphere', center: [0, 0, 0], scale: [.055, .055, .055] }, { type: 'cylinder', center: [.07, 0, 0], scale: [.05, .14, .05], rotation: [0, 0, 90] }],
  leftHand: [{ type: 'box', center: [.04, 0, 0], scale: [.08, .025, .055] }],
  rightUpperArm: [{ type: 'cylinder', center: [-.08, 0, 0], scale: [.06, .16, .06], rotation: [0, 0, 90] }],
  rightLowerArm: [{ type: 'sphere', center: [0, 0, 0], scale: [.055, .055, .055] }, { type: 'cylinder', center: [-.07, 0, 0], scale: [.05, .14, .05], rotation: [0, 0, 90] }],
  rightHand: [{ type: 'box', center: [-.04, 0, 0], scale: [.08, .025, .055] }],
  leftUpperLeg: [{ type: 'cylinder', center: [0, -.115, 0], scale: [.085, .23, .085] }],
  leftLowerLeg: [{ type: 'sphere', center: [0, 0, 0], scale: [.075, .075, .075] }, { type: 'cylinder', center: [0, -.12, 0], scale: [.065, .24, .065] }],
  leftFoot: [{ type: 'box', center: [0, -.02, .04], scale: [.065, .04, .15] }],
  rightUpperLeg: [{ type: 'cylinder', center: [0, -.115, 0], scale: [.085, .23, .085] }],
  rightLowerLeg: [{ type: 'sphere', center: [0, 0, 0], scale: [.075, .075, .075] }, { type: 'cylinder', center: [0, -.12, 0], scale: [.065, .24, .065] }],
  rightFoot: [{ type: 'box', center: [0, -.02, .04], scale: [.065, .04, .15] }],
};

/**
 * A jointed stand-in built on the canonical skeleton. The root faces −Z (actor heading 0) by turning the
 * canonical +Z-facing space 180°; the actor root scales it to the actor's height.
 */
export function buildMannequin(app: pc.Application, body: pc.StandardMaterial, accent: pc.StandardMaterial) {
  const root = new pc.Entity('mannequin', app);
  root.setLocalEulerAngles(0, 180, 0);
  const joints = new Map<HumanBone, pc.Entity>();
  const landmarks: Partial<Record<RigLandmark, pc.GraphNode>> = {};
  for (const { bone, parent, offset } of HUMAN_SKELETON) {
    const joint = new pc.Entity(bone, app);
    (parent ? joints.get(parent)! : root).addChild(joint);
    joint.setLocalPosition(...offset);
    joints.set(bone, joint);
    landmarks[bone] = joint;
    for (const part of PARTS[bone] ?? []) {
      const shape = new pc.Entity(`${bone}:${part.type}`, app);
      shape.addComponent('render', { type: part.type, material: part.accent ? accent : body, castShadows: true, receiveShadows: true });
      shape.setLocalPosition(...part.center); shape.setLocalScale(...part.scale);
      if (part.rotation) shape.setLocalEulerAngles(...part.rotation);
      joint.addChild(shape);
    }
  }
  // Landmarks for end-bone directions and the floor, matching the canonical tips.
  const tip = (bone: HumanBone, key: RigLandmark) => { const node = new pc.GraphNode(key); node.setLocalPosition(...HUMAN_TIPS[bone]!); joints.get(bone)!.addChild(node); landmarks[key] = node; };
  tip('head', 'headTop'); tip('leftFoot', 'leftToe'); tip('rightFoot', 'rightToe'); tip('leftHand', 'leftMiddle'); tip('rightHand', 'rightMiddle');
  root.syncHierarchy();
  const nodes: pc.GraphNode[] = [...joints.values()];
  return { root, driver: new HumanoidDriver(root, landmarks), rest: new RestPose(nodes) };
}
