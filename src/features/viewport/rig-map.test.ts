import assert from 'node:assert/strict';
import test from 'node:test';
import { mapHumanoid, parseBoneName, type RigNode } from './rig-map';

/** Build a node list from "parent>child" chains so fixtures stay readable. */
function skeleton(chains: string[]): RigNode[] {
  const nodes: RigNode[] = [], index = new Map<string, number>();
  for (const chain of chains) {
    let parent = -1;
    for (const name of chain.split('>')) {
      if (!index.has(name)) { index.set(name, nodes.length); nodes.push({ name, parent }); }
      parent = index.get(name)!;
    }
  }
  return nodes;
}
const named = (nodes: RigNode[], mapping: ReturnType<typeof mapHumanoid>) => Object.fromEntries(Object.entries(mapping.bones).map(([bone, i]) => [bone, nodes[i!].name]));

test('bone names split into side and core across conventions', () => {
  assert.deepEqual(parseBoneName('mixamorig:LeftUpLeg'), { side: 'left', core: 'upleg', skip: false });
  assert.deepEqual(parseBoneName('upperarm_r'), { side: 'right', core: 'upperarm', skip: false });
  assert.deepEqual(parseBoneName('J_Bip_L_LowerArm'), { side: 'left', core: 'lowerarm', skip: false });
  assert.deepEqual(parseBoneName('Bip01 R Calf'), { side: 'right', core: 'calf', skip: false });
  assert.deepEqual(parseBoneName('lShldrBend'), { side: 'left', core: 'shldrbend', skip: false });
  assert.equal(parseBoneName('upperarm_twist_01_l').skip, true);
});

test('Mixamo rigs map fully, with LeftArm/LeftLeg resolved by context', () => {
  const m = 'mixamorig:';
  const nodes = skeleton([
    `Armature>${m}Hips>${m}Spine>${m}Spine1>${m}Spine2>${m}Neck>${m}Head>${m}HeadTop_End`,
    `${m}Spine2>${m}LeftShoulder>${m}LeftArm>${m}LeftForeArm>${m}LeftHand>${m}LeftHandMiddle1`,
    `${m}Spine2>${m}RightShoulder>${m}RightArm>${m}RightForeArm>${m}RightHand`,
    `${m}Hips>${m}LeftUpLeg>${m}LeftLeg>${m}LeftFoot>${m}LeftToeBase>${m}LeftToe_End`,
    `${m}Hips>${m}RightUpLeg>${m}RightLeg>${m}RightFoot>${m}RightToeBase`,
  ]);
  const mapping = mapHumanoid(nodes);
  assert.equal(mapping.humanoid, true, mapping.missing.join());
  const bones = named(nodes, mapping);
  assert.equal(bones.leftUpperArm, `${m}LeftArm`);
  assert.equal(bones.leftUpperLeg, `${m}LeftUpLeg`);
  assert.equal(bones.leftLowerLeg, `${m}LeftLeg`);
  assert.equal(bones.spine, `${m}Spine`);
  assert.equal(bones.chest, `${m}Spine2`);
  assert.equal(bones.headTop, `${m}HeadTop_End`);
  assert.equal(bones.leftToe, `${m}LeftToeBase`);
  assert.equal(bones.leftMiddle, `${m}LeftHandMiddle1`);
});

test('Unreal, VRM and Biped naming map; the hips can be inferred', () => {
  const unreal = skeleton(['root>pelvis>spine_01>spine_02>spine_03>neck_01>head', 'spine_03>clavicle_l>upperarm_l>lowerarm_l>hand_l', 'spine_03>clavicle_r>upperarm_r>lowerarm_r>hand_r', 'pelvis>thigh_l>calf_l>foot_l>ball_l', 'pelvis>thigh_r>calf_r>foot_r>ball_r']);
  assert.equal(mapHumanoid(unreal).humanoid, true);
  const vrm = skeleton(['J_Bip_C_Hips>J_Bip_C_Spine>J_Bip_C_Chest>J_Bip_C_UpperChest>J_Bip_C_Neck>J_Bip_C_Head', 'J_Bip_C_UpperChest>J_Bip_L_Shoulder>J_Bip_L_UpperArm>J_Bip_L_LowerArm>J_Bip_L_Hand', 'J_Bip_C_UpperChest>J_Bip_R_Shoulder>J_Bip_R_UpperArm>J_Bip_R_LowerArm>J_Bip_R_Hand', 'J_Bip_C_Hips>J_Bip_L_UpperLeg>J_Bip_L_LowerLeg>J_Bip_L_Foot', 'J_Bip_C_Hips>J_Bip_R_UpperLeg>J_Bip_R_LowerLeg>J_Bip_R_Foot']);
  const vrmMap = mapHumanoid(vrm);
  assert.equal(vrmMap.humanoid, true);
  assert.equal(named(vrm, vrmMap).chest, 'J_Bip_C_UpperChest');
  const unnamedHips = skeleton(['Root>Body>Torso>Neck>Head', 'Torso>Arm.L>Forearm.L>Hand.L', 'Torso>Arm.R>Forearm.R>Hand.R', 'Body>Thigh.L>Shin.L>Foot.L', 'Body>Thigh.R>Shin.R>Foot.R']);
  const inferred = mapHumanoid(unnamedHips);
  assert.equal(named(unnamedHips, inferred).hips, 'Body');
  assert.equal(inferred.humanoid, true);
});

test('non-humanoid or partial rigs are reported, not guessed', () => {
  const quadruped = skeleton(['root>body>neck>head', 'body>frontleg_l>frontleg_l_2', 'body>tail>tail2']);
  const mapping = mapHumanoid(quadruped);
  assert.equal(mapping.humanoid, false);
  assert.ok(mapping.missing.includes('leftUpperArm'));
  const crossed = skeleton(['Hips>Spine>Head', 'Spine>LeftForeArm', 'Spine>LeftUpperArm']);
  assert.equal(mapHumanoid(crossed).bones.leftLowerArm, undefined, 'a forearm that is not under the upper arm is dropped');
});

test('bone names that match Object members are ignored', () => {
  const nodes = skeleton(['constructor>toString>Hips>Spine>Head']);
  const mapping = mapHumanoid(nodes);
  assert.deepEqual(Object.keys(mapping.bones).sort(), ['head', 'hips', 'spine']);
});

type Spec = [name: string, parent: string | null, position: [number, number, number]];
/** A generic Blender-style rig ("Bone", "Bone.001", …) in T-pose, facing +Z, 1.9 m to the top of the head. */
function genericRig(options: { hips?: boolean; legs?: boolean } = {}): Spec[] {
  const root = options.hips === false ? 'Armature' : 'Bone';
  const specs: Spec[] = options.hips === false ? [['Armature', null, [0, 0, 0]]] : [['Bone', null, [0, 1, 0]]];
  specs.push(['Bone.001', root, [0, 1.2, 0]], ['Bone.002', 'Bone.001', [0, 1.4, 0]], ['Bone.003', 'Bone.002', [0, 1.6, 0]], ['Bone.004', 'Bone.003', [0, 1.7, 0]], ['Bone.005', 'Bone.004', [0, 1.9, 0]]);
  for (const [sign, tag] of [[1, 'L'], [-1, 'R']] as const) {
    specs.push([`Bone.${tag}1`, 'Bone.002', [.1 * sign, 1.5, 0]], [`Bone.${tag}2`, `Bone.${tag}1`, [.2 * sign, 1.5, 0]], [`Bone.${tag}3`, `Bone.${tag}2`, [.5 * sign, 1.5, 0]], [`Bone.${tag}4`, `Bone.${tag}3`, [.75 * sign, 1.5, 0]], [`Bone.${tag}5`, `Bone.${tag}4`, [.85 * sign, 1.5, 0]]);
    if (options.legs !== false) specs.push([`Bone.${tag}6`, root, [.1 * sign, .95, 0]], [`Bone.${tag}7`, `Bone.${tag}6`, [.1 * sign, .5, 0]], [`Bone.${tag}8`, `Bone.${tag}7`, [.1 * sign, .08, 0]], [`Bone.${tag}9`, `Bone.${tag}8`, [.1 * sign, 0, .15]]);
  }
  return specs;
}
function build(specs: Spec[], transform = (p: [number, number, number]) => p): RigNode[] {
  const index = new Map(specs.map(([name], i) => [name, i]));
  return specs.map(([name, parent, position]) => ({ name, parent: parent ? index.get(parent)! : -1, position: transform(position) }));
}

test('generic bone names are mapped from the skeleton shape', () => {
  const nodes = build(genericRig());
  const mapping = mapHumanoid(nodes);
  assert.equal(mapping.humanoid, true, mapping.missing.join());
  const bones = named(nodes, mapping);
  assert.deepEqual([bones.hips, bones.spine, bones.chest, bones.neck, bones.head, bones.headTop], ['Bone', 'Bone.001', 'Bone.002', 'Bone.003', 'Bone.004', 'Bone.005']);
  assert.deepEqual([bones.leftUpperArm, bones.leftLowerArm, bones.leftHand, bones.leftMiddle], ['Bone.L2', 'Bone.L3', 'Bone.L4', 'Bone.L5'], 'the clavicle is skipped');
  assert.deepEqual([bones.rightUpperLeg, bones.rightLowerLeg, bones.rightFoot, bones.rightToe], ['Bone.R6', 'Bone.R7', 'Bone.R8', 'Bone.R9']);
  assert.ok(mapping.inferred.length > 10);
});

test('a model facing backwards still gets left and right correct (from where its toes point)', () => {
  const nodes = build(genericRig(), ([x, y, z]) => [-x, y, -z]);
  const bones = named(nodes, mapHumanoid(nodes));
  assert.equal(bones.leftUpperArm, 'Bone.L2');
  assert.equal(bones.leftUpperLeg, 'Bone.L6');
});

test('a rig without a hip bone uses the node the legs branch from', () => {
  const nodes = build(genericRig({ hips: false }));
  const mapping = mapHumanoid(nodes);
  assert.equal(named(nodes, mapping).hips, 'Armature');
  assert.equal(mapping.drivable, true);
});

test('partial rigs still animate what they have; structureless models are flagged', () => {
  const upperBody = build(genericRig({ legs: false }));
  const partial = mapHumanoid(upperBody);
  assert.equal(partial.drivable, true);
  assert.deepEqual(partial.missingParts, ['legs']);
  const blob = mapHumanoid([{ name: 'Mesh', parent: -1, position: [0, 0, 0] }, { name: 'Mesh.001', parent: 0, position: [0, 0, 0] }]);
  assert.equal(blob.structured, false);
  assert.equal(blob.drivable, false);
});
