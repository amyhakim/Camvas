import * as pc from 'playcanvas';
import type { ActorPose, SceneProp } from '@/contracts';
import { LoadQueue } from './load-queue';
import type { SceneContent } from './content';

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
   * An instance wrapped so its largest dimension (or height, for characters) is 1 and its base
   * centre sits at the origin. glTF faces +Z; characters are turned to face −Z like actor heading 0.
   */
  async instantiate(uid: string, fit: 'largest' | 'height'): Promise<pc.Entity> {
    const { resource } = await this.load(uid);
    const wrapper = new pc.Entity(`model:${uid}`, this.app);
    const model = resource.instantiateRenderEntity();
    wrapper.addChild(model);
    if (fit === 'height') wrapper.setLocalEulerAngles(0, 180, 0);
    wrapper.syncHierarchy();
    let box: pc.BoundingBox | null = null;
    for (const component of model.findComponents('render') as pc.RenderComponent[]) {
      component.castShadows = true; component.receiveShadows = true;
      for (const instance of component.meshInstances) { if (box) box.add(instance.aabb); else box = instance.aabb.clone(); }
    }
    const inner = new pc.Entity('fit', this.app);
    wrapper.removeChild(model); inner.addChild(model); wrapper.addChild(inner);
    if (box) {
      const min = box.getMin(), max = box.getMax(), size = max.clone().sub(min);
      const reference = fit === 'height' ? size.y : Math.max(size.x, size.y, size.z);
      const k = reference > 1e-6 ? 1 / reference : 1;
      // The AABB was measured in wrapper space (including the 180° turn); undo that for the local offset.
      const sign = fit === 'height' ? -1 : 1;
      inner.setLocalScale(k, k, k);
      inner.setLocalPosition(-box.center.x * k * sign, -min.y * k, -box.center.z * k * sign);
    }
    return wrapper;
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
      this.library.instantiate(uid, 'largest').then(model => {
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

/** Swap an actor's proxy body for a character model, scaled by the actor root to the actor's height. */
export class ActorModels {
  private attached = new Map<string, { uid: string; entity: pc.Entity | null }>();
  private disposed = false;
  constructor(private library: ModelLibrary, private changed: () => void) {}
  sync(actor: ActorPose, root: pc.Entity) {
    const uid = actor.model?.uid ?? '';
    const current = this.attached.get(actor.id);
    if (current?.uid === uid) return;
    current?.entity?.destroy();
    this.attached.delete(actor.id);
    const proxies = root.children.filter(child => child.name !== 'character') as pc.Entity[];
    proxies.forEach(child => { child.enabled = true; });
    if (!uid) return;
    const record = { uid, entity: null as pc.Entity | null };
    this.attached.set(actor.id, record);
    this.library.instantiate(uid, 'height').then(model => {
      if (this.disposed || this.attached.get(actor.id) !== record || !root.parent) { model.destroy(); return; }
      model.name = 'character'; root.addChild(model); record.entity = model;
      proxies.forEach(child => { child.enabled = false; });
      this.changed();
    }, () => this.changed());
  }
  retry(uid: string) { for (const [id, record] of this.attached) if (record.uid === uid) this.forget(id); }
  forget(id: string) { this.attached.get(id)?.entity?.destroy(); this.attached.delete(id); }
  destroy() { this.disposed = true; this.attached.clear(); }
}
