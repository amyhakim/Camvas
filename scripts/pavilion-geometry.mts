import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
const bytes = readFileSync(new URL('../public/scenes/pavilion.glb', import.meta.url));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
export const pavilionBoxes: { id: string; min: [number, number, number]; max: [number, number, number] }[] = [];
function visit(index: number, parent: Matrix4) {
  const node = gltf.nodes[index];
  const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(new Vector3(...(node.translation ?? [0, 0, 0])), new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), new Vector3(...(node.scale ?? [1, 1, 1])));
  const world = parent.clone().multiply(local);
  if (node.mesh !== undefined) for (const primitive of gltf.meshes[node.mesh].primitives) {
    const a = gltf.accessors[primitive.attributes.POSITION];
    if (!a.min || !a.max) throw Error('Missing mesh bounds');
    const box = new Box3(new Vector3(...a.min), new Vector3(...a.max)).applyMatrix4(world);
    pavilionBoxes.push({ id: node.name, min: box.min.toArray(), max: box.max.toArray() });
  }
  for (const child of node.children ?? []) visit(child, world);
}
for (const node of gltf.scenes[gltf.scene ?? 0].nodes) visit(node, new Matrix4());
