import * as pc from 'playcanvas';
import type { ActorPose, ActorRigInfo, SceneProp } from '@/contracts';
import { LoadQueue } from './load-queue';
import type { SceneContent } from './content';
import { analyzeRig, ClipPlayer, facingYaw, HumanoidDriver, RestPose, type RigAnalysis } from './rig';

type Loaded = { resource: pc.ContainerResource; asset: pc.Asset };
type ModelStatus = 'queued' | 'loading' | 'ready' | 'error';
const DEFAULT_PROP = '#b9b3a8';

/** Fetches each Sketchfab model once through the server cache and hands out normalised instances. */
export class ModelLibrary {
  private queue = new LoadQueue(2);
  private abort = new AbortController();
  private assets = new Set<pc.Asset>();
  private loads = new Map<string, Promise<Loaded>>();
  readonly status = new Map<string, { state: ModelStatus; message?: string; progress?: number }>();
  private destroyed = false;
  constructor(private app: pc.Application, private changed: () => void) {}

  private load(uid: string): Promise<Loaded> {
    let pending = this.loads.get(uid);
    if (pending) return pending;
    this.status.set(uid, { state: 'queued', message: 'Waiting for a download slot…' });
    this.changed();
    pending = this.queue.run(async () => {
      if (this.destroyed) throw new DOMException('Viewport closed', 'AbortError');
      const signal = AbortSignal.any([this.abort.signal, AbortSignal.timeout(180_000)]);
      const progress = (message: string, percent?: number) => { if (!this.destroyed) { this.status.set(uid, { state: 'loading', message, progress: percent }); this.changed(); } };
      progress('Checking model cache…');
      const response = await fetch(`/api/assets/sketchfab/${uid}/model?progress=1`, { signal });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || `Model unavailable (${response.status}).`);
      }
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '', entry = '';
      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line) as { type: string; message?: string; progress?: number; entry?: string };
            if (event.type === 'error') throw new Error(event.message || 'Download failed.');
            if (event.type === 'progress') progress(event.message || 'Downloading…', event.progress);
            if (event.type === 'ready' && event.entry) entry = event.entry;
          }
          if (done) break;
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (!entry) throw new Error('Model download ended before it was ready. Retry.');
      if (signal.aborted || this.destroyed) throw new DOMException('Model load cancelled', 'AbortError');
      progress('Loading geometry and textures…');
      const url = `/api/assets/sketchfab/${uid}/${entry.split('/').map(encodeURIComponent).join('/')}`;
      const asset = new pc.Asset(`sketchfab:${uid}`, 'container', { url });
      this.assets.add(asset);
      try {
        await new Promise<void>((resolve, reject) => {
          const clean = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); asset.off('load', loaded); asset.off('error', failed); };
          const loaded = () => { clean(); resolve(); };
          const failed = (error: string) => { clean(); reject(new Error(error || 'The model file could not be parsed.')); };
          const abort = () => failed('Model load cancelled. Retry to load it again.');
          const timer = setTimeout(() => failed('Model parsing took too long. Retry or choose a smaller model.'), 90_000);
          asset.once('load', loaded); asset.once('error', failed);
          signal.addEventListener('abort', abort, { once: true });
          this.app.assets.add(asset); this.app.assets.load(asset);
        });
        if (this.destroyed) throw new DOMException('Viewport closed', 'AbortError');
        return { resource: asset.resource as pc.ContainerResource, asset };
      } catch (error) {
        if (this.assets.delete(asset)) { asset.unload(); this.app.assets.remove(asset); }
        throw error;
      }
    });
    pending.then(() => { if (!this.destroyed) { this.status.set(uid, { state: 'ready', message: 'Ready' }); this.changed(); } }, error => {
      if (this.destroyed) return;
      this.status.set(uid, { state: 'error', message: error instanceof Error ? error.message : 'Model unavailable.' });
      this.loads.delete(uid); this.changed();
    });
    this.loads.set(uid, pending);
    return pending;
  }

  /**
   * An instance wrapped so its largest dimension (or height, for characters) is 1 and its base centre sits
   * at the origin. Returns the wrapper (`root`), the canonical `space` node (Y up, facing +Z, scaled), the
   * model instance and its resource. `orient` may turn the model to face +Z before it is measured.
   * Characters are then turned 180° so they face −Z like actor heading 0.
   */
  async instantiate(uid: string, fit: 'largest' | 'height', orient?: (model: pc.Entity) => number): Promise<{ root: pc.Entity; space: pc.Entity; model: pc.Entity; resource: pc.ContainerResource }> {
    const { resource } = await this.load(uid);
    const root = new pc.Entity(`model:${uid}`, this.app), space = new pc.Entity('fit', this.app), facing = new pc.Entity('facing', this.app);
    const model = resource.instantiateRenderEntity();
    root.addChild(space); space.addChild(facing); facing.addChild(model);
    root.syncHierarchy();
    const yaw = orient?.(model) ?? 0;
    if (yaw) { facing.setLocalEulerAngles(0, -yaw, 0); root.syncHierarchy(); }
    let box: pc.BoundingBox | null = null;
    let skinned = false;
    for (const component of model.findComponents('render') as pc.RenderComponent[]) {
      component.castShadows = true; component.receiveShadows = true;
      for (const instance of component.meshInstances) {
        let bound: pc.BoundingBox;
        // Skinned AABBs refresh only at render time; measure the bind-pose mesh through its node instead.
        if (instance.skinInstance) { skinned = true; bound = new pc.BoundingBox(); bound.setFromTransformedAabb(instance.mesh.aabb, instance.node.getWorldTransform()); }
        else bound = instance.aabb;
        if (box) box.add(bound); else box = bound.clone();
      }
    }
    if (skinned) {
      // Cross-check against the skeleton; trust the bones when the mesh bound disagrees wildly.
      const min = new pc.Vec3(Infinity, Infinity, Infinity), max = new pc.Vec3(-Infinity, -Infinity, -Infinity);
      const visit = (node: pc.GraphNode) => { const p = node.getPosition(); min.min(p); max.max(p); node.children.forEach(visit); };
      visit(model);
      const boneHeight = (max.y - min.y) * 1.08;
      const meshHeight = box ? box.halfExtents.y * 2 : 0;
      if (boneHeight > 1e-6 && (!box || meshHeight < boneHeight * .6 || meshHeight > boneHeight * 1.6)) { box = new pc.BoundingBox(); box.setMinMax(min, new pc.Vec3(max.x, min.y + boneHeight, max.z)); }
    }
    if (box) {
      const min = box.getMin(), size = box.getMax().clone().sub(min);
      const reference = fit === 'height' ? size.y : Math.max(size.x, size.y, size.z);
      const k = reference > 1e-6 ? 1 / reference : 1;
      space.setLocalScale(k, k, k);
      space.setLocalPosition(-box.center.x * k, -min.y * k, -box.center.z * k);
    }
    if (fit === 'height') root.setLocalEulerAngles(0, 180, 0);
    root.syncHierarchy();
    return { root, space, model, resource };
  }
  destroy() {
    this.destroyed = true;
    this.queue.close(); this.abort.abort();
    for (const asset of this.assets) { asset.unload(); this.app.assets.remove(asset); }
    this.assets.clear();
    this.loads.clear();
  }
}

type PropView = { root: pc.Entity; body: pc.Entity; key: string; materials: pc.StandardMaterial[]; tint: string; model: pc.Entity | null; placeholder: pc.Entity | null };

/** Owns prop entities; registers them in the scene index so picking, bounds and gizmos treat them like imported objects. */
export class PropLayer {
  private views = new Map<string, PropView>();
  private disposed = false;
  constructor(private app: pc.Application, private content: SceneContent, private library: ModelLibrary, private changed: () => void) {}

  private material(hex: string, opacity = 1) {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color().fromString(hex); material.gloss = .3;
    if (opacity < 1) { material.opacity = opacity; material.blendType = pc.BLEND_NORMAL; material.depthWrite = false; }
    material.update(); return material;
  }
  private shape(view: PropView, type: string, hex: string, opacity = 1) {
    const part = new pc.Entity(type, this.app);
    const material = this.material(hex, opacity); view.materials.push(material);
    part.addComponent('render', { type, material, castShadows: opacity === 1, receiveShadows: true });
    // Primitives are unit-sized around their centre; lift so the base sits on the prop position.
    part.setLocalPosition(0, type === 'plane' ? 0 : .5, 0);
    if (type === 'cylinder' || type === 'cone' || type === 'capsule') part.setLocalScale(.5, 1, .5);
    view.body.addChild(part);
    return part;
  }
  private build(prop: SceneProp): PropView {
    const root = new pc.Entity(prop.id, this.app), body = new pc.Entity('body', this.app);
    root.addChild(body); this.app.root.addChild(root);
    const view: PropView = { root, body, key: prop.source.kind === 'model' ? `model:${prop.source.uid}` : `shape:${prop.source.shape}`, materials: [], tint: '', model: null, placeholder: null };
    if (prop.source.kind === 'primitive') this.shape(view, prop.source.shape, prop.color ?? DEFAULT_PROP);
    else {
      view.placeholder = this.shape(view, 'box', '#edc58c', .35);
      const uid = prop.source.uid;
      this.library.instantiate(uid, 'largest').then(({ root: model }) => {
        if (this.disposed || this.views.get(prop.id) !== view) { model.destroy(); return; }
        view.placeholder?.destroy(); view.placeholder = null;
        for (const material of view.materials.splice(0)) material.destroy();
        view.body.addChild(model); view.model = model; view.tint = '';
        this.changed();
      }, () => this.changed());
    }
    this.content.index.set(prop.id, [root]);
    return view;
  }
  private applyTint(view: PropView, prop: SceneProp) {
    const tint = prop.color ?? '';
    if (view.tint === tint) return;
    view.tint = tint;
    if (!view.model) { for (const material of view.materials) { material.diffuse.fromString(prop.color ?? DEFAULT_PROP); material.update(); } return; }
    // Clone materials once per prop so tints never leak into another instance of the same model.
    for (const component of view.model.findComponents('render') as pc.RenderComponent[]) for (const instance of component.meshInstances) {
      const original = (instance as pc.MeshInstance & { showcamOriginal?: pc.Material }).showcamOriginal ?? instance.material;
      (instance as pc.MeshInstance & { showcamOriginal?: pc.Material }).showcamOriginal = original;
      if (!(original instanceof pc.StandardMaterial)) continue;
      if (!tint) { if (instance.material !== original) { view.materials = view.materials.filter(m => m !== instance.material); (instance.material as pc.StandardMaterial).destroy(); instance.material = original; } continue; }
      let material = instance.material as pc.StandardMaterial;
      if (material === original) { material = original.clone(); view.materials.push(material); instance.material = material; }
      const t = new pc.Color().fromString(tint), base = original.diffuse;
      material.diffuse.set(base.r * t.r, base.g * t.g, base.b * t.b, base.a); material.update();
    }
  }
  sync(props: SceneProp[]) {
    const ids = new Set(props.map(prop => prop.id));
    for (const [id, view] of this.views) {
      const prop = props.find(item => item.id === id);
      if (!ids.has(id) || !prop || view.key !== (prop.source.kind === 'model' ? `model:${prop.source.uid}` : `shape:${prop.source.shape}`)) this.remove(id);
    }
    for (const prop of props) {
      let view = this.views.get(prop.id);
      if (!view) { view = this.build(prop); this.views.set(prop.id, view); }
      view.root.setPosition(prop.position[0], prop.position[1], prop.position[2]);
      view.root.setEulerAngles(0, 0, 0);
      // Euler YXZ (yaw, then pitch, then roll), matching the camera convention.
      const q = new pc.Quat().setFromEulerAngles(0, prop.rotation[1] * pc.math.RAD_TO_DEG, 0)
        .mul(new pc.Quat().setFromEulerAngles(prop.rotation[0] * pc.math.RAD_TO_DEG, 0, 0))
        .mul(new pc.Quat().setFromEulerAngles(0, 0, prop.rotation[2] * pc.math.RAD_TO_DEG));
      view.root.setRotation(q);
      view.body.setLocalScale(prop.size, prop.size, prop.size);
      this.applyTint(view, prop);
    }
  }
  private remove(id: string) {
    const view = this.views.get(id); if (!view) return;
    view.materials.forEach(material => material.destroy());
    view.root.destroy(); this.views.delete(id); this.content.index.delete(id);
  }
  retry(uid: string, props: SceneProp[]) {
    for (const prop of props) if (prop.source.kind === 'model' && prop.source.uid === uid) this.remove(prop.id);
  }
  status(props: SceneProp[]) {
    return props.map(prop => ({ id: prop.id, state: prop.source.kind === 'model' ? this.library.status.get(prop.source.uid)?.state ?? 'loading' : 'ready', message: prop.source.kind === 'model' ? this.library.status.get(prop.source.uid)?.message : undefined }));
  }
  destroy() { this.disposed = true; for (const id of [...this.views.keys()]) this.remove(id); }
}

type Character = { uid: string; entity: pc.Entity | null; driver: HumanoidDriver | null; clips: ClipPlayer | null; rest: RestPose | null; info: ActorRigInfo };

/**
 * Swap an actor's mannequin for a character model, scaled by the actor root to the actor's height.
 * Rigged humanoids are posed by the same canonical driver as the mannequin, and their own clips can play.
 * Unrigged models are shown still and reported as static so the editor can tell the user.
 */
export class ActorModels {
  private attached = new Map<string, Character>();
  private disposed = false;
  /** Bumped when a character finishes loading so the runtime re-applies poses. */
  version = 0;
  constructor(private library: ModelLibrary, private changed: () => void) {}
  sync(actor: ActorPose, root: pc.Entity) {
    const uid = actor.model?.uid ?? '';
    const current = this.attached.get(actor.id);
    if ((current?.uid ?? '') === uid) return;
    this.forget(actor.id);
    const proxies = root.children.filter(child => child.name !== 'character') as pc.Entity[];
    proxies.forEach(child => { child.enabled = true; });
    this.version++;
    if (!uid) return;
    const name = actor.model?.name ?? 'This model';
    const record: Character = { uid, entity: null, driver: null, clips: null, rest: null, info: { status: 'loading', body: 'model', clips: [] } };
    this.attached.set(actor.id, record);
    let analysis: RigAnalysis | null = null;
    this.library.instantiate(uid, 'height', model => { analysis = analyzeRig(model); return analysis.mapping.humanoid ? facingYaw(analysis.landmarks) : 0; }).then(({ root: character, space, model, resource }) => {
      if (this.disposed || this.attached.get(actor.id) !== record || !root.parent) { character.destroy(); return; }
      character.name = 'character'; root.addChild(character); record.entity = character;
      proxies.forEach(child => { child.enabled = false; });
      const rig = analysis ?? analyzeRig(model);
      const clips = new ClipPlayer(model, resource);
      record.rest = new RestPose(rig.nodes);
      record.clips = clips.clips.length ? clips : null;
      const clipInfo = clips.clips.map(clip => ({ name: clip.name, duration: Math.round(clip.duration * 100) / 100 }));
      if (!rig.skinned) record.info = { status: 'static', body: 'model', clips: [], message: `“${name}” isn’t rigged, so it can’t be animated. Use the mannequin body or ask for a rigged model.` };
      else if (rig.mapping.humanoid) { record.driver = new HumanoidDriver(space, rig.landmarks); record.info = { status: 'animatable', body: 'model', clips: clipInfo }; }
      else record.info = { status: 'static', body: 'model', clips: clipInfo, message: `“${name}” is rigged, but its skeleton isn’t a recognisable humanoid (missing ${rig.mapping.missing.slice(0, 3).join(', ')}), so the motion library can’t drive it.${clipInfo.length ? ' Its own clips can still play.' : ''}` };
      this.version++; this.changed();
    }, error => {
      if (this.attached.get(actor.id) !== record) return;
      record.info = { status: 'error', body: 'model', clips: [], message: error instanceof Error ? error.message : 'The character model could not load.' };
      this.version++; this.changed();
    });
  }
  retry(uid: string) { for (const [id, record] of this.attached) if (record.uid === uid) this.forget(id); }
  info(id: string): ActorRigInfo | null { return this.attached.get(id)?.info ?? null; }
  /** Pose a loaded character. Returns false when the mannequin should be posed instead. */
  applyBody(actor: ActorPose): boolean {
    const record = this.attached.get(actor.id);
    if (!record?.entity || !record.rest) return false;
    record.rest.restore();
    const body = actor.body;
    if (body?.clip && record.clips?.apply(body.clip.name, body.clip.time, body.clip.loop)) { record.driver?.pinHips(); return true; }
    if (body && record.driver) record.driver.apply(body.pose);
    return true;
  }
  forget(id: string) { const record = this.attached.get(id); record?.entity?.destroy(); record?.clips?.destroy(); this.attached.delete(id); }
  destroy() { this.disposed = true; for (const id of [...this.attached.keys()]) this.forget(id); }
}
