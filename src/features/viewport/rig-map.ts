import type { HumanBone } from '@/lib/humanoid';

/** Extra landmarks used only to measure end-bone directions. */
export type RigLandmark = HumanBone | 'leftToe' | 'rightToe' | 'leftMiddle' | 'rightMiddle' | 'headTop';
/** `position` is the node's rest position in model space (Y up), used to infer parts names don't reveal. */
export type RigNode = { name: string; parent: number; position?: [number, number, number] };
/**
 * `humanoid`: every core part found. `drivable`: enough parts to animate (the rest stay still).
 * `inferred`: parts found from the skeleton's shape rather than bone names. `missingParts`: plain-language gaps.
 */
export type RigMapping = { bones: Partial<Record<RigLandmark, number>>; humanoid: boolean; drivable: boolean; missing: HumanBone[]; inferred: RigLandmark[]; missingParts: string[]; structured: boolean };

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
  const inferred = inferFromShape(nodes, bones);
  const required: HumanBone[] = ['hips', 'head', 'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm', 'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'];
  const missing = required.filter(bone => bones[bone] === undefined);
  const core: HumanBone[] = ['hips', 'spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'rightUpperLeg', 'rightLowerLeg', 'rightFoot'];
  const found = core.filter(bone => bones[bone] !== undefined).length;
  const has = (...keys: HumanBone[]) => keys.some(key => bones[key] !== undefined);
  const missingParts = [
    ...(!has('leftUpperArm', 'rightUpperArm') ? ['arms'] : !has('leftUpperArm') || !has('rightUpperArm') ? ['one arm'] : []),
    ...(!has('leftUpperLeg', 'rightUpperLeg') ? ['legs'] : !has('leftUpperLeg') || !has('rightUpperLeg') ? ['one leg'] : []),
    ...(!has('head', 'neck') ? ['head'] : []),
  ];
  return { bones, humanoid: missing.length === 0, drivable: found >= 3, missing, inferred, missingParts, structured: structuredNodes(nodes) >= 4 };
}

type V3 = [number, number, number];
/** Nodes that sit somewhere of their own (zero-length helpers and duplicates don't count as structure). */
function structuredNodes(nodes: RigNode[]) {
  const seen = new Set<string>();
  for (const node of nodes) if (node.position) seen.add(node.position.map(value => value.toFixed(3)).join(','));
  return seen.size;
}

/**
 * Fill parts that bone names didn't reveal, from the skeleton's shape (generic names like "Bone.001", missing
 * hips, separate body-part meshes). Canonical assumptions: Y up; which way is forward is detected from the toes.
 * Proportions are fractions of the skeleton's height. Named parts are never overridden.
 */
function inferFromShape(nodes: RigNode[], bones: Partial<Record<RigLandmark, number>>): RigLandmark[] {
  if (nodes.some(node => !node.position) || structuredNodes(nodes) < 4) return [];
  const P = nodes.map(node => node.position!) as V3[];
  const ys = P.map(p => p[1]), minY = Math.min(...ys), H = Math.max(...ys) - minY;
  if (!(H > 1e-6)) return [];
  const xs = P.map(p => p[0]).sort((a, b) => a - b), cx = xs[Math.floor(xs.length / 2)];
  const h = (i: number) => (P[i][1] - minY) / H;
  const dist = (a: number, b: number) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]);
  const ancestors = (i: number) => { const out: number[] = []; for (let j = nodes[i].parent; j >= 0; j = nodes[j].parent) out.push(j); return out; };
  const lca = (a: number, b: number) => { const chain = new Set([a, ...ancestors(a)]); for (const j of [b, ...ancestors(b)]) if (chain.has(j)) return j; return -1; };
  /** Nodes strictly below `from` down to and including `to`, skipping zero-length helpers. */
  const pathDown = (from: number, to: number) => {
    if (!ancestors(to).includes(from)) return [];
    const list: number[] = [];
    for (let j = to; j !== from; j = nodes[j].parent) list.unshift(j);
    return list.filter((node, i) => dist(node, i ? list[i - 1] : from) > .004 * H);
  };
  const closest = (list: number[], score: (i: number) => number) => list.reduce<number | undefined>((best, i) => best === undefined || score(i) < score(best) ? i : best, undefined);
  const inferred: RigLandmark[] = [];
  const part = (s: 'left' | 'right', name: string) => `${s}${name}` as RigLandmark;
  const set = (key: RigLandmark, index: number | undefined) => { if (bones[key] === undefined && index !== undefined && index >= 0) { bones[key] = index; inferred.push(key); } };
  const used = new Set(Object.values(bones));

  // Feet: the lowest node on each side. Toes point forward, which tells us the facing and so which side is left.
  const low = nodes.map((_, i) => i).filter(i => h(i) < .12);
  const lowestOn = (sign: number) => closest(low.filter(i => sign * (P[i][0] - cx) > .02 * H), i => h(i) - Math.abs(P[i][0] - cx) * .01);
  const plusX = lowestOn(1), minusX = lowestOn(-1);
  let facing = 1;
  if (plusX !== undefined && minusX !== undefined) {
    const forward = [plusX, minusX].reduce((sum, i) => sum + (nodes[i].parent >= 0 ? P[i][2] - P[nodes[i].parent][2] : 0), 0);
    if (forward < -.01 * H) facing = -1;
  }
  const side = { left: facing, right: -facing } as const;
  const footTip = { left: facing > 0 ? plusX : minusX, right: facing > 0 ? minusX : plusX };

  if (footTip.left !== undefined && footTip.right !== undefined) {
    const branch = lca(footTip.left, footTip.right);
    if (bones.hips === undefined && branch >= 0) set('hips', branch);
  }
  const hips = bones.hips;

  const legs = new Set<number>();
  for (const s of ['left', 'right'] as const) {
    const prefix = s;
    const tip = footTip[s];
    if (hips === undefined || tip === undefined || !ancestors(tip).includes(hips)) continue;
    const path = pathDown(hips, tip);
    path.forEach(i => legs.add(i));
    if (bones[part(prefix, 'UpperLeg')] !== undefined || path.length < 2) continue;
    const upper = path.find(i => P[hips][1] - P[i][1] > .02 * H || Math.abs(P[i][0] - P[hips][0]) > .02 * H) ?? path[0];
    const after = (node: number | undefined) => node === undefined ? [] : path.slice(path.indexOf(node) + 1);
    const lower = closest(after(upper).filter(i => h(i) > .08 && h(i) < .45), i => Math.abs(dist(upper, i) - .24 * H));
    const foot = closest(after(lower).filter(i => h(i) < .15), i => Math.abs(dist(lower!, i) - .24 * H));
    set(part(prefix, 'UpperLeg'), upper); set(part(prefix, 'LowerLeg'), lower); set(part(prefix, 'Foot'), foot);
    set(part(prefix, 'Toe'), after(foot)[0]);
  }

  // Head: the highest central node; its lowest ancestor still above 80% height is the skull joint.
  const top = closest(nodes.map((_, i) => i).filter(i => h(i) > .78 && Math.abs(P[i][0] - cx) < .12 * H && !legs.has(i)), i => -h(i));
  if (top !== undefined && bones.head === undefined) {
    // The skull joint sits about 7/8 of the way up; the neck below it does not count.
    const chain = [top, ...ancestors(top)].filter(i => h(i) >= .855);
    const head = chain.at(-1);
    set('head', head);
    if (head !== top) set('headTop', top);
  }
  const head = bones.head;
  if (hips !== undefined && head !== undefined && ancestors(head).includes(hips)) {
    const interior = pathDown(hips, head).filter(i => i !== head);
    set('spine', interior[0]);
    const chest = closest(interior.filter(i => i !== bones.spine), i => Math.abs(h(i) - .72));
    set('chest', chest);
    set('neck', closest(interior.filter(i => i !== bones.spine && i !== bones.chest && h(i) > .76), i => Math.abs(h(i) - .84)));
  }

  // Arms: the most sideways chain on each side, measured from where it branches off the body.
  const trunk = head ?? bones.chest ?? bones.spine ?? hips;
  for (const s of ['left', 'right'] as const) {
    if (bones[part(s, 'UpperArm')] !== undefined || trunk === undefined) continue;
    const sign = side[s];
    const candidates = nodes.map((_, i) => i).filter(i => h(i) > .35 && h(i) < .98 && sign * (P[i][0] - cx) > .12 * H && !legs.has(i) && !used.has(i));
    const tip = closest(candidates, i => -sign * (P[i][0] - cx));
    if (tip === undefined) continue;
    const branch = lca(tip, trunk);
    if (branch < 0) continue;
    const path = pathDown(branch, tip);
    if (path.length < 2) continue;
    const upper = path.find(i => sign * (P[i][0] - cx) >= .08 * H) ?? path[0];
    const after = (node: number | undefined) => node === undefined ? [] : path.slice(path.indexOf(node) + 1);
    const lower = closest(after(upper), i => Math.abs(dist(upper, i) - .165 * H));
    const hand = closest(after(lower), i => Math.abs(dist(lower!, i) - .145 * H));
    set(part(s, 'UpperArm'), upper); set(part(s, 'LowerArm'), lower); set(part(s, 'Hand'), hand);
    set(part(s, 'Middle'), after(hand)[0]);
  }
  return inferred;
}
