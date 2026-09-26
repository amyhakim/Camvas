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
