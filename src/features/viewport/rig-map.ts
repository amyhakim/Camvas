import type { HumanBone } from '@/lib/humanoid';

/** Extra landmarks used only to measure end-bone directions. */
export type RigLandmark = HumanBone | 'leftToe' | 'rightToe' | 'leftMiddle' | 'rightMiddle' | 'headTop';
export type RigNode = { name: string; parent: number };
export type RigMapping = { bones: Partial<Record<RigLandmark, number>>; humanoid: boolean; missing: HumanBone[] };

const JUNK = new Set(['mixamorig', 'mixamorig1', 'mixamorig2', 'bip', 'bip01', 'bip001', 'b', 'bn', 'j', 'jnt', 'def', 'org', 'mch', 'sk', 'c', 'cc', 'base', 'rig', 'bone', 'armature', 'ctrl', 'jj']);
const SKIP = new Set(['twist', 'roll', 'end', 'nub', 'ik', 'pole', 'target', 'helper', 'share', 'meta', 'correct']);

/** Split "mixamorig:LeftUpLeg", "upperarm_l", "J_Bip_L_UpperArm", "Bip01 L Thigh", "lShldrBend" into side + core. */
export function parseBoneName(raw: string): { side: 'left' | 'right' | null; core: string; skip: boolean } {
  const name = raw.split(/[:|]/).pop() ?? raw;
  let tokens = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z])([A-Z][a-z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  // Daz-style "lShldr" / "rForeArm" collapse the side into the first token.
  if (tokens[0] && /^[lr](shldr|forearm|hand|thigh|shin|foot|collar|toe)/.test(tokens[0])) tokens = [tokens[0][0], tokens[0].slice(1), ...tokens.slice(1)];
  let side: 'left' | 'right' | null = null;
  const rest: string[] = [];
  for (const token of tokens) {
    if (token === 'left' || token === 'l') side = 'left';
    else if (token === 'right' || token === 'r') side = 'right';
    else if (!JUNK.has(token)) rest.push(token);
  }
  return { side, core: rest.join(''), skip: rest.some(token => SKIP.has(token)) };
}

const CENTRE: Record<string, 'hips' | 'spine' | 'chest' | 'neck' | 'head' | 'headTop'> = {
  hips: 'hips', pelvis: 'hips', hip: 'hips', cog: 'hips',
  spine: 'spine', spine0: 'spine', spine1: 'spine', spine01: 'spine', abdomen: 'spine', abdomenlower: 'spine', torso: 'spine', waist: 'spine', lowerback: 'spine',
  chest: 'chest', upperchest: 'chest', spine2: 'chest', spine02: 'chest', spine3: 'chest', spine03: 'chest', ribcage: 'chest', chestlower: 'chest', chestupper: 'chest', abdomenupper: 'chest', upperback: 'chest',
  neck: 'neck', neck1: 'neck', neck01: 'neck', necklower: 'neck',
  head: 'head', headtop: 'headTop', headtopend: 'headTop', headend: 'headTop', headnub: 'headTop',
};
type Limb = 'upperArm' | 'lowerArm' | 'hand' | 'upperLeg' | 'lowerLeg' | 'foot' | 'toe' | 'middle' | 'arm' | 'leg';
const SIDED: Record<string, Limb> = {
  upperarm: 'upperArm', uparm: 'upperArm', humerus: 'upperArm', shldr: 'upperArm', shldrbend: 'upperArm', armupper: 'upperArm',
  forearm: 'lowerArm', lowerarm: 'lowerArm', loarm: 'lowerArm', elbow: 'lowerArm', radius: 'lowerArm', forearmbend: 'lowerArm', armlower: 'lowerArm',
  hand: 'hand', wrist: 'hand',
  upleg: 'upperLeg', upperleg: 'upperLeg', thigh: 'upperLeg', femur: 'upperLeg', thighbend: 'upperLeg', legupper: 'upperLeg', hip: 'upperLeg',
  lowerleg: 'lowerLeg', calf: 'lowerLeg', shin: 'lowerLeg', knee: 'lowerLeg', loleg: 'lowerLeg', tibia: 'lowerLeg', leglower: 'lowerLeg',
  foot: 'foot', ankle: 'foot',
  toe: 'toe', toes: 'toe', toebase: 'toe', ball: 'toe', toe0: 'toe', toe01: 'toe',
  handmiddle1: 'middle', middle1: 'middle', middle01: 'middle', middleproximal: 'middle', fingermiddle1: 'middle', middlefinger1: 'middle', mid1: 'middle',
  arm: 'arm', leg: 'leg',
};

function depthOf(nodes: RigNode[], index: number) { let depth = 0; for (let i = nodes[index].parent; i >= 0; i = nodes[i].parent) depth++; return depth; }
function isAncestor(nodes: RigNode[], ancestor: number, index: number) { for (let i = nodes[index]?.parent ?? -1; i >= 0; i = nodes[i].parent) if (i === ancestor) return true; return false; }

/** Map a node list onto the canonical humanoid. Name-based, with structural inference for the hips. */
export function mapHumanoid(nodes: RigNode[]): RigMapping {
  const bones: Partial<Record<RigLandmark, number>> = {};
  const limbs: Record<'left' | 'right', Partial<Record<Limb, number>>> = { left: {}, right: {} };
  const spines: number[] = [];
  const chests: number[] = [];
  const claim = (key: RigLandmark, index: number) => { if (bones[key] === undefined || depthOf(nodes, index) < depthOf(nodes, bones[key]!)) bones[key] = index; };
  nodes.forEach((node, index) => {
    const { side, core, skip } = parseBoneName(node.name);
    const named = Object.hasOwn(CENTRE, core) ? CENTRE[core] : undefined;
    if (!core || (skip && named !== 'headTop')) return;
    if (side) {
      const limb = Object.hasOwn(SIDED, core) ? SIDED[core] : undefined;
      if (limb) { const slot = limbs[side]; if (slot[limb] === undefined || depthOf(nodes, index) < depthOf(nodes, slot[limb]!)) slot[limb] = index; }
      return;
    }
    const centre = named ?? (/^spine\d+$/.test(core) ? 'spine' : undefined);
    if (centre === 'spine') spines.push(index);
    else if (centre === 'chest') chests.push(index);
    else if (centre) claim(centre, index);
  });
  for (const side of ['left', 'right'] as const) {
    const s = limbs[side];
    // Mixamo: LeftArm/LeftForeArm and LeftUpLeg/LeftLeg; elsewhere "arm"/"leg" is the upper segment.
    if (s.upperArm === undefined && s.arm !== undefined) s.upperArm = s.arm;
    if (s.leg !== undefined) { if (s.upperLeg === undefined) s.upperLeg = s.leg; else if (s.lowerLeg === undefined) s.lowerLeg = s.leg; }
    const prefix = side === 'left' ? 'left' : 'right';
    const set = (key: Limb, bone: RigLandmark) => { if (s[key] !== undefined) bones[bone] = s[key]; };
    set('upperArm', `${prefix}UpperArm`); set('lowerArm', `${prefix}LowerArm`); set('hand', `${prefix}Hand`);
    set('upperLeg', `${prefix}UpperLeg`); set('lowerLeg', `${prefix}LowerLeg`); set('foot', `${prefix}Foot`);
    set('toe', `${prefix}Toe`); set('middle', `${prefix}Middle`);
  }
  // Structural fallback: the hips are the nearest common ancestor of both thighs.
  if (bones.hips === undefined && bones.leftUpperLeg !== undefined && bones.rightUpperLeg !== undefined) {
    for (let i = nodes[bones.leftUpperLeg].parent; i >= 0; i = nodes[i].parent) if (isAncestor(nodes, i, bones.rightUpperLeg)) { bones.hips = i; break; }
  }
  const byDepth = (list: number[]) => [...list].filter(index => index !== bones.hips).sort((a, b) => depthOf(nodes, a) - depthOf(nodes, b));
  const spineChain = byDepth(spines);
  if (spineChain.length) bones.spine = spineChain[0];
  if (chests.length) bones.chest = byDepth(chests).at(-1);
  else if (spineChain.length > 1) bones.chest = spineChain.at(-1);
  // Discard landmarks whose hierarchy contradicts the humanoid chain.
  const chain: [RigLandmark, RigLandmark][] = [['leftUpperArm', 'leftLowerArm'], ['leftLowerArm', 'leftHand'], ['rightUpperArm', 'rightLowerArm'], ['rightLowerArm', 'rightHand'], ['leftUpperLeg', 'leftLowerLeg'], ['leftLowerLeg', 'leftFoot'], ['rightUpperLeg', 'rightLowerLeg'], ['rightLowerLeg', 'rightFoot'], ['hips', 'leftUpperLeg'], ['hips', 'rightUpperLeg']];
  for (const [parent, child] of chain) if (bones[parent] !== undefined && bones[child] !== undefined && !isAncestor(nodes, bones[parent]!, bones[child]!)) delete bones[child];
  if (bones.spine !== undefined && bones.chest === bones.spine) delete bones.chest;
  const required: HumanBone[] = ['hips', 'head', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm', 'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'];
  const missing = required.filter(bone => bones[bone] === undefined);
  return { bones, humanoid: missing.length === 0, missing };
}
