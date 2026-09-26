import * as pc from 'playcanvas';
import { Box3, Matrix4, Ray, Vector3 } from 'three';
import { placementAdapter } from './transforms';
import type { SceneManifest, ScenePlacement, Vector3Tuple } from '@/contracts';

export const tuple = (v: pc.Vec3): Vector3Tuple => [v.x, v.y, v.z];
export const vec = (v: readonly number[]) => new pc.Vec3(v[0], v[1], v[2]);

/** Asset ownership, source animation and entity identity stay behind the viewport boundary. */
export class SceneContent {
  readonly index = new Map<string, pc.Entity[]>();
  readonly cameras = new Map<string, pc.Entity>();
  readonly assets: pc.Asset[] = [];
  root: pc.Entity | null = null;
  private evaluator: pc.AnimEvaluator | null = null;
  private clips: pc.AnimClip[] = [];
  private placements = placementAdapter(this.index);
  private triangles = new Map<pc.Mesh, { positions: number[]; indices: number[] }>();
  private destroyed = false;
  private pending = new Set<() => void>();

  constructor(private app: pc.Application, readonly manifest: SceneManifest) {}

  async load(progress: (text: string) => void) {
    const source = this.manifest.asset ?? { kind: 'glb', url: '/scenes/pavilion.glb' };
    const asset = new pc.Asset(this.manifest.name, source.kind === 'gsplat' ? 'gsplat' : 'container', { url: source.url });
    this.assets.push(asset);
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { asset.off(); reject(new DOMException('Scene loading cancelled', 'AbortError')); };
      this.pending.add(cancel);
      asset.once('load', () => { this.pending.delete(cancel); resolve(); });
      asset.once('error', (error: string) => { this.pending.delete(cancel); reject(new Error(error)); });
      asset.on('progress', (received: number, total: number) => { if (total > 0) progress(`Loading scene · ${Math.round(received / total * 100)}%`); });
      this.app.assets.add(asset);
      this.app.assets.load(asset);
    });
    if (this.destroyed) return;
    if (source.kind === 'gsplat') {
      this.root = new pc.Entity('Captured environment', this.app);
      this.root.setLocalEulerAngles(...(source.rotation ?? [0, 0, 180]));
      this.root.addComponent('gsplat', { asset });
      this.app.root.addChild(this.root);
      const subject = this.manifest.objects.find(object => object.type !== 'Camera');
      if (subject) this.index.set(subject.id, [this.root]);
      for (const object of this.manifest.objects.filter(object => object.type === 'Camera')) {
        const camera = new pc.Entity(object.id, this.app);
        camera.addComponent('camera', { enabled: false, fov: this.manifest.initialView?.fov ?? 52 });
        camera.setPosition(...object.positionWeb);
        if (this.manifest.initialView) camera.lookAt(vec(this.manifest.initialView.target));
        this.app.root.addChild(camera);
        this.cameras.set(object.id, camera);
      }
      progress('Streaming nearby detail…');
    } else {
      const resource = asset.resource as pc.ContainerResource & { animations: pc.Asset[]; data: { gltf: { nodes: { name?: string; extras?: { entityId?: string } }[] } } };
      this.root = resource.instantiateRenderEntity();
      this.app.root.addChild(this.root);
      // glTF extras preserve stable Showcam IDs independently of renderer objects.
      const data = resource.data;
      for (const node of data.gltf.nodes) {
        const id = node.extras?.entityId;
        if (!id || !node.name) continue;
        const entity = this.root.findByName(node.name) as pc.Entity | null;
        if (!entity) continue;
        if (entity.camera) { entity.camera.enabled = false; this.cameras.set(id, entity); }
        else this.index.set(id, [...(this.index.get(id) ?? []), entity]);
      }
      this.evaluator = new pc.AnimEvaluator(new pc.DefaultAnimBinder(this.root));
      this.clips = resource.animations.map(animation => new pc.AnimClip(animation.resource as pc.AnimTrack, 0, 1, true, false));
      this.clips.forEach(clip => this.evaluator!.addClip(clip));
      for (const component of this.root.findComponents('render') as pc.RenderComponent[]) {
        component.castShadows = true;
        component.receiveShadows = true;
        for (const instance of component.meshInstances) {
          const material = instance.material as pc.StandardMaterial;
          if (material.name.includes('leafs')) {
            material.alphaTest = .45; material.blendType = pc.BLEND_NONE; material.cull = pc.CULLFACE_NONE;
            material.diffuse.fromString('#829d55'); material.update();
          }
          if (material.name.includes('glass') || material.name.includes('water')) {
            instance.castShadow = false; material.depthWrite = false; material.update();
          }
        }
      }
    }
  }

  update(frame: number, placements: ScenePlacement[]) {
    this.placements.restore();
    this.clips.forEach(clip => { clip.time = Math.min(frame / this.manifest.fps, clip.track.duration); });
    this.evaluator?.update(0);
    this.placements.apply(placements);
  }

  bounds(id: string): pc.BoundingBox | null {
    let result: pc.BoundingBox | null = null;
    for (const entity of this.index.get(id) ?? []) {
      if (entity.gsplat?.customAabb) {
        const bound = new pc.BoundingBox();
        bound.setFromTransformedAabb(entity.gsplat.customAabb, entity.getWorldTransform());
        if (result) result.add(bound); else result = bound.clone();
      }
      for (const component of entity.findComponents('render') as pc.RenderComponent[]) {
        for (const mesh of component.meshInstances) {
          if (result) result.add(mesh.aabb); else result = mesh.aabb.clone();
        }
      }
    }
    return result;
  }

  /** Triangle picking preserves mesh object selection; a capture is a single scene entity. */
  pick(ray: pc.Ray): { id: string; point: pc.Vec3; distance: number } | null {
    let nearest: { id: string; point: pc.Vec3; distance: number } | null = null;
    let environment: { id: string; point: pc.Vec3; distance: number } | null = null;
    const threeRay = new Ray(new Vector3(...tuple(ray.origin)), new Vector3(...tuple(ray.direction)));
    const inverse = new Matrix4();
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), hit = new Vector3();
    for (const [id, entities] of this.index) {
      for (const entity of entities) {
        if (entity.gsplat) {
          const box = this.bounds(id), point = new pc.Vec3();
          if (box?.intersectsRay(ray, point)) {
            const distance = point.distance(ray.origin);
            // A capture's bound encloses everything inside it; props and meshes win over it.
            if (!environment || distance < environment.distance) environment = { id, point, distance };
          }
        }
        for (const component of entity.findComponents('render') as pc.RenderComponent[]) for (const instance of component.meshInstances) {
          const bound = instance.aabb;
          const worldBox = new Box3(new Vector3(...tuple(bound.getMin())), new Vector3(...tuple(bound.getMax())));
          if (!threeRay.intersectsBox(worldBox)) continue;
          let geometry = this.triangles.get(instance.mesh);
          if (!geometry) {
            geometry = { positions: [], indices: [] };
            instance.mesh.getPositions(geometry.positions);
            instance.mesh.getIndices(geometry.indices);
            this.triangles.set(instance.mesh, geometry);
          }
          const world = new Matrix4().fromArray(instance.node.getWorldTransform().data);
          inverse.copy(world).invert();
          const localRay = threeRay.clone().applyMatrix4(inverse);
          const { indices, positions } = geometry;
          for (let i = 0; i < indices.length; i += 3) {
            a.fromArray(positions, indices[i] * 3); b.fromArray(positions, indices[i + 1] * 3); c.fromArray(positions, indices[i + 2] * 3);
            if (localRay.intersectTriangle(a, b, c, false, hit)) {
              hit.applyMatrix4(world);
              const distance = hit.distanceTo(threeRay.origin);
              if (!nearest || distance < nearest.distance) nearest = { id, point: new pc.Vec3(hit.x, hit.y, hit.z), distance };
            }
          }
        }
      }
    }
    return nearest ?? environment;
  }

  destroy() {
    this.destroyed = true;
    this.pending.forEach(cancel => cancel()); this.pending.clear();
    this.evaluator?.removeClips();
    this.root?.destroy();
    this.cameras.forEach(camera => { if (camera.parent) camera.destroy(); });
    this.assets.forEach(asset => { asset.off(); asset.unload(); this.app.assets.remove(asset); });
    this.triangles.clear();
  }
}
