import * as pc from 'playcanvas';
import { Mesh as ThreeMesh, MeshLambertMaterial } from 'three';
import { buildAsset } from '@/vendor/blockout/upstream/renderer/viewport/builders';
import { fitBlockoutBounds, type FittedBlock } from './blockout-fit';

export type BlockoutView = 'source' | 'blocks' | 'overlay';

/** Display bridge only: all cube vertices/indices/normals come from Blockout.
 * Batched by source mesh, with the original node as transform owner. This keeps
 * blocks aligned through source animation, scene placement, and nested scales.
 */
export class BlockoutLayer {
  readonly root: pc.Entity;
  readonly material = new pc.StandardMaterial();
  readonly originals = new Map<pc.MeshInstance, boolean>();
  count = 0;
  sourceCount = 0;

  constructor(app: pc.Application, private source: pc.Entity, fitted?: FittedBlock[]) {
    this.root = new pc.Entity('Blockout fitted blocks', app);
    // Call the unmodified upstream entry point; never use FlyThru's PropLayer
    // or PlayCanvas's primitive generator to construct a block.
    const asset = buildAsset('prim.cube');
    const cube = asset.group.children[0] as ThreeMesh;
    cube.updateMatrix();
    const geometry = cube.geometry.clone().applyMatrix4(cube.matrix);
    const vertices = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const indices = geometry.index!;
    this.material.diffuse.fromString('#80b8bd');
    this.material.gloss = 18;
    this.material.update();
    const instances: pc.MeshInstance[] = [];
    // Snapshot before adding proxies; never recursively fit the proxy geometry.
    const components = source.findComponents('render') as pc.RenderComponent[];
    const originals = fitted ? [] : components.flatMap(component => component.meshInstances);
    const entries = fitted ? [{ node: source, blocks: fitted }] : originals.map(original => {
      this.originals.set(original, original.visible);
      const p: number[] = [], ix: number[] = [];
      original.mesh.getPositions(p); original.mesh.getIndices(ix);
      if (!ix.length) for (let i = 0; i < p.length / 3; i++) ix.push(i);
      const s = original.node.getWorldTransform().getScale();
      const blocks = fitBlockoutBounds(p, ix, [s.x, s.y, s.z]);
      return { node: original.node, blocks };
    });
    for (const { node, blocks } of entries) {
      if (!blocks.length) continue;
      this.count += blocks.length; this.sourceCount++;
      const positions: number[] = [], normalData: number[] = [], triangles: number[] = [];
      for (const block of blocks) {
        const offset = positions.length / 3;
        for (let v = 0; v < vertices.count; v++) {
          positions.push(
            block.min[0] + (vertices.getX(v) + .5) * (block.max[0] - block.min[0]),
            block.min[1] + vertices.getY(v) * (block.max[1] - block.min[1]),
            block.min[2] + (vertices.getZ(v) + .5) * (block.max[2] - block.min[2]),
          );
          normalData.push(normals.getX(v), normals.getY(v), normals.getZ(v));
        }
        for (let i = 0; i < indices.count; i++) triangles.push(offset + indices.getX(i));
      }
      const mesh = new pc.Mesh(app.graphicsDevice);
      mesh.setPositions(positions); mesh.setNormals(normalData); mesh.setIndices(triangles); mesh.update(pc.PRIMITIVE_TRIANGLES);
      const instance = new pc.MeshInstance(mesh, this.material, node);
      instance.castShadow = true; instance.receiveShadow = true;
      instances.push(instance);
    }
    geometry.dispose(); cube.geometry.dispose(); (cube.material as MeshLambertMaterial).dispose();
    this.root.addComponent('render', { meshInstances: instances });
    app.root.addChild(this.root);
    this.setView('blocks');
  }

  setView(mode: BlockoutView) {
    for (const [mesh, visible] of this.originals) mesh.visible = visible && mode !== 'blocks';
    if (this.source.gsplat) this.source.gsplat.enabled = mode !== 'blocks';
    this.root.enabled = mode !== 'source';
    this.material.opacity = mode === 'overlay' ? .38 : 1;
    this.material.blendType = mode === 'overlay' ? pc.BLEND_NORMAL : pc.BLEND_NONE;
    this.material.depthWrite = mode !== 'overlay';
    this.material.depthBias = mode === 'overlay' ? -1 : 0;
    this.material.update();
  }

  destroy() {
    if (this.source.gsplat) this.source.gsplat.enabled = true;
    for (const [mesh, visible] of this.originals) mesh.visible = visible;
    this.root.destroy();
    this.material.destroy();
  }
}
