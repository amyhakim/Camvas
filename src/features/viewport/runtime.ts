import { readSplatSamples } from './splat-samples';
import { fitBlockoutPoints } from './blockout-fit';
import { generateSplatCollision } from './splat-collision';
import { placedCollision } from '../collision/model';
import type { CollisionOptions } from '@/contracts';
import * as pc from 'playcanvas';
import { Euler, Quaternion } from 'three';
import type { SceneLandmark, Vector3Tuple, ViewportHandle } from '@/contracts';
import type { LiveViewportProps } from './types';
import { SceneContent, tuple, vec } from './content';
import { framePath } from './framing';
import { actorBounds } from './actors';
import { ViewportInput } from './viewport-input';
import { ActorModels, ModelLibrary, PropLayer } from './props';
import { BlockoutLayer, type BlockoutView } from './blockout-layer';

const amber = new pc.Color(.929, .773, .549);
const rotation = new Quaternion();
const euler = new Euler(0, 0, 0, 'YXZ');

export class ViewportRuntime implements ViewportHandle {
  readonly app: pc.Application;
  readonly camera: pc.Entity;
  private readonly previewCamera: pc.Entity;
  readonly content: SceneContent;
  private blockoutAbort: AbortController | null = null;
  private blockoutLayer: BlockoutLayer | null = null;
  readonly target = new pc.Vec3();
  readonly actors = new Map<string, pc.Entity>();
  readonly markers = new Map<string, pc.Entity>();
  readonly materials = new Set<pc.StandardMaterial>();
  landmarkDraft: SceneLandmark | null = null;
  private landmarkPins = new Map<string, HTMLButtonElement>();
  private actorStyles = new Map<string, string>();
  private actorMaterials = new Map<string, pc.StandardMaterial[]>();
  readonly models: ModelLibrary;
  readonly propLayer: PropLayer;
  private actorModels: ActorModels;
  props: LiveViewportProps;
  input: ViewportInput | null = null;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private loaded = false;
  private modelStatusKey = '';
  private lastFrame = -1;
  private lastMode: string | null = null;
  private focusPending = false;
  private pathPending = false;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private constructor(readonly canvas: HTMLCanvasElement, device: pc.GraphicsDevice, props: LiveViewportProps) {
    this.props = props;
    this.app = new pc.Application(canvas, { graphicsDevice: device });
    // Images in streamed SOG chunks are cross-origin and must remain readable by the GPU.
    const textures = this.app.loader.getHandler('texture') as pc.TextureHandler;
    textures.crossOrigin = 'anonymous';
    this.app.scene.ambientLight = new pc.Color(.55, .59, .64);
    const mobile = window.matchMedia('(max-width: 800px)').matches;
    device.maxPixelRatio = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
    this.app.setCanvasFillMode(pc.FILLMODE_NONE, canvas.clientWidth, canvas.clientHeight);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
    this.app.scene.gsplat.splatBudget = mobile ? 2_000_000 : 4_000_000;
    this.app.scene.gsplat.colorUpdateAngle = .2;
    this.camera = new pc.Entity('Showcam camera', this.app);
    this.camera.addComponent('camera', { fov: 52, nearClip: .05, farClip: 400, clearColor: props.manifest.asset?.kind === 'gsplat' ? new pc.Color(.02, .025, .03) : new pc.Color(.655, .729, .714) });
    this.app.root.addChild(this.camera);
    this.camera.camera!.toneMapping = props.manifest.asset?.kind === 'gsplat' ? pc.TONEMAP_LINEAR : pc.TONEMAP_ACES;
    this.previewCamera = new pc.Entity('Shot preview camera', this.app);
    this.previewCamera.addComponent('camera', { enabled: false, fov: 52, nearClip: .05, farClip: 400, clearColor: props.manifest.asset?.kind === 'gsplat' ? new pc.Color(.02, .025, .03) : new pc.Color(.655, .729, .714), priority: 1 });
    this.previewCamera.camera!.toneMapping = this.camera.camera!.toneMapping;
    this.app.root.addChild(this.previewCamera);
    const light = new pc.Entity('Sun', this.app);
    light.addComponent('light', { type: 'directional', color: new pc.Color(1, .95, .86), intensity: 2.5, castShadows: true, shadowResolution: 2048, shadowDistance: 100, normalOffsetBias: .035 });
    light.setEulerAngles(55, -25, 0); this.app.root.addChild(light);
    this.content = new SceneContent(this.app, props.manifest);
    this.models = new ModelLibrary(this.app, () => this.invalidate());
    this.propLayer = new PropLayer(this.app, this.content, this.models, () => this.invalidate());
    this.actorModels = new ActorModels(this.models, () => this.invalidate());
    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      this.app.resizeCanvas(Math.max(1, rect.width), Math.max(1, rect.height));
      this.invalidate();
      if (this.pathPending) this.framePath();
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(canvas.parentElement!);
    resize();
    this.app.systems.gsplat!.on('frame:request', this.invalidate, this);
    this.app.on('update', this.update, this);
    canvas.dataset.renderer = `playcanvas-${device.deviceType}`;
    this.app.start();
  }

  static async create(canvas: HTMLCanvasElement, props: LiveViewportProps, signal: AbortSignal, compatible = false) {
    // Let Strict Mode's synchronous setup/cleanup replay cancel before allocating a GPU device.
    await Promise.resolve();
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const device = await pc.createGraphicsDevice(canvas, { deviceTypes: compatible ? ['webgl2'] : ['webgpu', 'webgl2'], antialias: false, depth: true, stencil: true, powerPreference: 'high-performance' });
    if (signal.aborted) { device.destroy(); throw new DOMException('Cancelled', 'AbortError'); }
    return new ViewportRuntime(canvas, device, props);
  }

  async load(progress: (text: string) => void, ready: () => void, failed: (error: Error) => void) {
    this.app.graphicsDevice.on('devicelost', () => { if (!this.disposed) failed(new Error('The graphics device stopped. Retry the scene or try compatibility mode.')); });
    await this.content.load(progress);
    if (this.disposed) return;
    this.input = new ViewportInput(this);
    this.resetView();
    this.content.update(this.props.frame, this.props.placements ?? []);
    if ((this.props.manifest.id ?? 'pavilion-v1') === 'pavilion-v1') {
      progress('Fitting Blockout blocks to the pavilion…');
      this.blockoutLayer = new BlockoutLayer(this.app, this.content.root!);
      this.setBlockoutView('blocks');
    }
    if (this.props.manifest.asset?.kind === 'gsplat') {
      // Load a complete coarse view before revealing; then refine within the device budget.
      const splat = this.content.root!.gsplat!;
      const resource = splat.resource as pc.GSplatResourceBase & { octree?: { lodLevels: number } };
      if (resource.octree) splat.lodRangeMin = splat.lodRangeMax = resource.octree.lodLevels - 1;
      let streamingStarted = false;
      const reveal = (_camera: pc.CameraComponent, _layer: pc.Layer, ready: boolean, loading: number) => {
        if (loading > 0 || this.app.stats.frame.gsplats > 0) streamingStarted = true;
        if (ready && loading === 0 && streamingStarted) {
          this.app.systems.gsplat!.off('frame:ready', reveal);
          splat.lodRangeMin = 0; splat.lodRangeMax = 1000;
          this.app.once('frameend', () => this.finishLoading(readyCallback));
        }
      };
      const readyCallback = ready;
      this.app.systems.gsplat!.on('frame:ready', reveal);
      this.readyTimer = setTimeout(() => {
        if (!this.loaded && !this.disposed) failed(new Error('The streamed scene has not produced a frame. Check your connection, retry, or open the pavilion.'));
      }, 90000);
    } else this.app.once('frameend', () => this.finishLoading(ready));
    this.invalidate();
  }

  private finishLoading(ready: () => void) {
    if (this.disposed) return;
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.loaded = true;
    this.canvas.dataset.ready = 'true';
    this.app.autoRender = false;
    ready(); this.invalidate();
  }

  setProps(props: LiveViewportProps) {
    if (this.props.selectedId !== props.selectedId || this.props.actorTool !== props.actorTool || this.props.mode !== props.mode || this.props.landmarkMode !== props.landmarkMode) this.input?.cancel();
    const modeChanged = this.props.mode !== props.mode;
    const regionChanged = this.props.region !== props.region;
    this.props = props;
    if ((regionChanged || modeChanged) && this.collisionFocusId && props.showCollision && props.mode === 'orbit') this.frameCollision(this.collisionFocusId);
    if (regionChanged && this.pathPending && props.mode === 'orbit' && props.showPath) this.framePath();
    this.invalidate();
  }
  invalidate() { if (!this.disposed) this.app.renderNextFrame = true; }
  setBlockoutView(mode: BlockoutView) {
    this.blockoutLayer?.setView(mode);
    this.canvas.dataset.blockoutView = mode;
    this.canvas.dataset.blockoutBlocks = String(this.blockoutLayer?.count ?? 0);
    this.canvas.dataset.blockoutSources = String(this.blockoutLayer?.sourceCount ?? 0);
    this.invalidate();
  }
  async fitSplatBlockout(progress: (text: string) => void, size = .5) {
    const root = this.content.root, asset = this.props.manifest.asset;
    if (!this.loaded || !root || asset?.kind !== 'gsplat') throw new Error('Wait for the splat scene to load.');
    this.blockoutAbort?.abort();
    const abort = new AbortController(); this.blockoutAbort = abort;
    const points: number[] = [];
    const inverse = root.getWorldTransform().clone().invert(), point = new pc.Vec3();
    await readSplatSamples(this.app, root, { sourceUrl: asset.url }, abort.signal, progress, (x, y, z) => {
      inverse.transformPoint(point.set(x, y, z), point);
      points.push(point.x, point.y, point.z);
    });
    if (abort.signal.aborted || this.disposed) return;
    progress('Fitting blocks directly to splat samples…');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    if (abort.signal.aborted || this.disposed) return;
    const blocks = fitBlockoutPoints(points, size);
    if (!blocks.length) throw new Error('No supported blocks were found in this capture.');
    const previous = this.blockoutLayer;
    const next = new BlockoutLayer(this.app, root, blocks);
    previous?.destroy(); this.blockoutLayer = next;
    this.canvas.dataset.blockoutSamples = String(points.length / 3);
    this.setBlockoutView('blocks');
    progress(`${blocks.length.toLocaleString()} fitted blocks · ${(points.length / 3).toLocaleString()} samples`);
  }
  retryModel(uid: string) {
    if (this.models.status.get(uid)?.state !== 'error') return;
    this.propLayer.retry(uid, this.props.props ?? []); this.actorModels.retry(uid); this.invalidate();
  }
  private reportModels() {
    const sources = new Map((this.props.props ?? []).flatMap(prop => prop.source.kind === 'model' ? [[prop.source.uid, prop.source] as const] : []));
    for (const actor of this.props.actors ?? []) if (actor.model) sources.set(actor.model.uid, { ...actor.model, kind: 'model' });
    const statuses = [...sources.values()].map(source => ({ uid: source.uid, name: source.name, state: this.models.status.get(source.uid)?.state ?? 'queued' as const, message: this.models.status.get(source.uid)?.message ?? 'Waiting to load…', progress: this.models.status.get(source.uid)?.progress }));
    const key = JSON.stringify(statuses);
    if (key !== this.modelStatusKey) { this.modelStatusKey = key; this.props.onModelStatus?.(statuses); }
  }
  setMovement(code: string, pressed: boolean) { this.input?.setMovement(code, pressed); }

  resetView() {
    this.collisionFocusId = null;
    const initial = this.props.manifest.initialView;
    const opening = this.content.cameras.get('Camera') ?? this.content.cameras.get(this.props.manifest.activeCameraId);
    if (initial) {
      this.camera.setPosition(...initial.position); this.target.copy(vec(initial.target)); this.camera.lookAt(this.target); this.camera.camera!.fov = initial.fov;
    } else if (opening) {
      this.copyCamera(opening); this.target.copy(this.camera.getPosition()).add(this.camera.forward.clone().mulScalar(20));
    } else {
      this.camera.setPosition(-30, 9, 27); this.target.set(-2, 2, 0); this.camera.lookAt(this.target);
    }
    this.pathPending = false; this.invalidate();
  }
  private copyCamera(source: pc.Entity) {
    this.camera.setPosition(source.getPosition()); this.camera.setRotation(source.getRotation());
    this.camera.camera!.fov = source.camera?.fov ?? 52;
  }
  bounds(id: string) {
    const actor = this.props.actors?.find(item => item.id === id);
    if (actor) {
      const bound = actorBounds(actor);
      const min = vec(bound.min), max = vec(bound.max);
      return new pc.BoundingBox(min.clone().add(max).mulScalar(.5), max.sub(min).mulScalar(.5));
    }
    return this.content.bounds(id);
  }
  captureSubject(id: string) {
    const entity = this.props.manifest.objects.find(item => item.id === id);
    const actor = this.props.actors?.find(item => item.id === id);
    const prop = this.props.props?.find(item => item.id === id);
    if (!this.loaded || (!entity && !actor && !prop) || entity?.type === 'Camera') return null;
    // A model prop measures its placeholder until the file arrives; wait for the real bounds.
    if (prop?.source.kind === 'model' && this.models.status.get(prop.source.uid)?.state !== 'ready') return null;
    if (actor?.model && this.models.status.get(actor.model.uid)?.state !== 'ready') return null;
    const bound = this.bounds(id);
    return bound ? { subjectId: id, subjectName: actor?.name ?? prop?.name ?? entity!.name, min: tuple(bound.getMin()), max: tuple(bound.getMax()), cameraPosition: tuple(this.camera.getPosition()) } : null;
  }
  viewState() {
    if (!this.loaded) return null;
    return { position: tuple(this.camera.getPosition()), forward: tuple(this.camera.forward) };
  }
  private collisionAbort: AbortController | null = null;
  async generateCollision(options: CollisionOptions, progress: (message: string) => void) {
    if (!this.loaded || !this.content.root || this.props.manifest.asset?.kind !== 'gsplat') throw new Error('Wait for a splat capture to load first.');
    if (this.collisionAbort) throw new Error('Box generation is already running.');
    const source = this.props.manifest.objects.find(object => object.type === 'Splat');
    if (!source) throw new Error('No splat capture found.');
    const abort = new AbortController(); this.collisionAbort = abort;
    const offset = this.props.placements?.find(p => p.id === source.id)?.offset ?? [0, 0, 0];
    try { return await generateSplatCollision(this.app, this.content.root, options, tuple(this.camera.getPosition()), { entityId: source.id, sourceUrl: this.props.manifest.asset.url, offset }, abort.signal, progress); }
    finally { this.collisionAbort = null; }
  }
  private collisionFocusId: string | null = null;
  frameCollision(id: string) {
    this.collisionFocusId = id;
    if (this.props.mode !== 'orbit') return;
    const layer = this.props.collision;
    const box = layer && placedCollision(layer, this.props.placements ?? []).boxes.find(box => box.id === id);
    if (!box) return;
    const center = box.min.map((v, i) => (v + box.max[i]) / 2) as Vector3Tuple;
    this.target.copy(vec(center));
    const direction = tuple(this.camera.forward.clone().mulScalar(-1));
    this.place(framePath([box.min, box.max], center, this.aspect(), this.props.region, direction));
  }
  captureObstacles(excludeId: string) {
    if (!this.loaded) return [];
    if (this.props.manifest.asset?.kind === 'gsplat') {
      const layer = this.props.collision;
      return layer?.reviewed && layer.sourceUrl === this.props.manifest.asset.url ? placedCollision(layer, this.props.placements ?? []).boxes : [];
    }
    const boxes: { min: Vector3Tuple; max: Vector3Tuple }[] = [];
    for (const entity of this.props.manifest.objects) {
      if (entity.id === excludeId || entity.type === 'Camera') continue;
      const bound = this.content.bounds(entity.id);
      if (bound) {
        const min = tuple(bound.getMin()), max = tuple(bound.getMax());
        if ([...min, ...max].every(Number.isFinite)) boxes.push({ min, max });
      }
    }
    return boxes;
  }
  captureRouteMapGeometry() {
    if (!this.loaded || !this.content.root || this.props.manifest.asset?.kind === 'gsplat') return [];
    const shapes: { min: Vector3Tuple; max: Vector3Tuple; color: string }[] = [];
    for (const component of this.content.root.findComponents('render') as pc.RenderComponent[]) {
      for (const instance of component.meshInstances) {
        const bound = instance.aabb;
        const min = tuple(bound.getMin()), max = tuple(bound.getMax());
        if (![...min, ...max].every(Number.isFinite)) continue;
        const diffuse = instance.material instanceof pc.StandardMaterial ? instance.material.diffuse : new pc.Color(.65, .7, .7);
        const channel = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0');
        shapes.push({ min, max, color: `#${channel(diffuse.r)}${channel(diffuse.g)}${channel(diffuse.b)}` });
        if (shapes.length >= 1500) return shapes;
      }
    }
    return shapes;
  }
  async captureRouteMap(view: { centerX: number; centerZ: number; halfHeight: number; cutHeight: number }): Promise<string | null> {
    if (!this.loaded || this.disposed || !this.content.root || this.props.manifest.asset?.kind === 'gsplat') return null;
    const width = 480, height = 320, device = this.app.graphicsDevice;
    const texture = new pc.Texture(device, { width, height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
    const target = new pc.RenderTarget({ colorBuffer: texture, depth: true, origin: pc.RENDERTARGET_ORIGIN_TOP });
    const mapCamera = new pc.Entity('Flight path top view', this.app);
    mapCamera.addComponent('camera', { enabled: false, projection: pc.PROJECTION_ORTHOGRAPHIC, orthoHeight: view.halfHeight,
      nearClip: .1, farClip: 2000, priority: 10, clearColor: new pc.Color(.09, .11, .14) });
    mapCamera.camera!.renderTarget = target;
    mapCamera.camera!.toneMapping = this.camera.camera!.toneMapping;
    const meshes = (this.content.root.findComponents('render') as pc.RenderComponent[]).flatMap(component => component.meshInstances);
    const hidden = meshes.filter(instance => instance.visible && instance.aabb.getMin().y > view.cutHeight);
    const mainEnabled = this.camera.camera!.enabled, previewEnabled = this.previewCamera.camera!.enabled;
    let pixels: Uint8Array | null = null;
    try {
      this.app.root.addChild(mapCamera);
      const top = Math.max(100, ...meshes.map(instance => instance.aabb.getMax().y + 80));
      mapCamera.setPosition(view.centerX, top, view.centerZ);
      mapCamera.setEulerAngles(-90, 0, 0);
      this.camera.camera!.enabled = false;
      this.previewCamera.camera!.enabled = false;
      hidden.forEach(instance => { instance.visible = false; });
      mapCamera.camera!.enabled = true;
      this.app.render();
      mapCamera.camera!.enabled = false;
      hidden.forEach(instance => { instance.visible = true; });
      this.camera.camera!.enabled = mainEnabled;
      this.previewCamera.camera!.enabled = previewEnabled;
      const reader = device as pc.GraphicsDevice & { readTextureAsync?: (texture: pc.Texture, x: number, y: number, width: number, height: number, options: { renderTarget: pc.RenderTarget }) => Promise<Uint8Array> };
      pixels = reader.readTextureAsync
        ? await reader.readTextureAsync(texture, 0, 0, width, height, { renderTarget: target })
        : await (texture.impl as { read: (x: number, y: number, width: number, height: number, options: { immediate: boolean }) => Promise<Uint8Array> }).read(0, 0, width, height, { immediate: true });
      const output = document.createElement('canvas'); output.width = width; output.height = height;
      const context = output.getContext('2d');
      if (!context || pixels.length !== width * height * 4) return null;
      const imagePixels = new Uint8ClampedArray(pixels.length);
      for (let row = 0; row < height; row++) imagePixels.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), (reader.readTextureAsync ? height - row - 1 : row) * width * 4);
      context.putImageData(new ImageData(imagePixels, width, height), 0, 0);
      return output.toDataURL('image/png');
    } catch (error) { console.warn('Flight path top-view capture failed', error); return null; }
    finally {
      hidden.forEach(instance => { instance.visible = true; });
      this.camera.camera!.enabled = mainEnabled;
      this.previewCamera.camera!.enabled = previewEnabled;
      mapCamera.destroy(); target.destroy(); texture.destroy();
      this.invalidate();
    }
  }
  frameSelection() { this.collisionFocusId = null; this.focusPending = true; this.pathPending = false; this.invalidate(); }
  framePath() {
    this.collisionFocusId = null;
    this.pathPending = true;
    if (this.props.mode !== 'orbit' || !this.props.path || !this.props.showPath) return;
    this.place(framePath(this.props.path.points, this.props.path.target, this.aspect(), this.props.region));
  }
  private aspect() { return this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight); }
  private place(view: { position: Vector3Tuple; target: Vector3Tuple; fov: number }) {
    this.camera.setPosition(...view.position); this.target.copy(vec(view.target)); this.camera.lookAt(this.target); this.camera.camera!.fov = view.fov; this.invalidate();
  }
  private focusSelected() {
    const id = this.props.selectedId;
    if (!id || this.props.mode !== 'orbit') return;
    const box = this.bounds(id);
    if (box) {
      const direction = this.camera.getPosition().clone().sub(box.center);
      this.place(framePath([tuple(box.getMin()), tuple(box.getMax())], tuple(box.center), this.aspect(), this.props.region, tuple(direction)));
    } else {
      const source = this.content.cameras.get(id);
      if (source) this.place(framePath([tuple(source.getPosition())], tuple(source.getPosition()), this.aspect(), this.props.region));
    }
  }

  project(position: pc.Vec3) {
    const p = this.camera.camera!.worldToScreen(position), rect = this.canvas.getBoundingClientRect();
    return { x: p.x + rect.left, y: p.y + rect.top };
  }
  ray(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const far = this.camera.camera!.screenToWorld(clientX - rect.left, clientY - rect.top, this.camera.camera!.farClip);
    const origin = this.camera.getPosition().clone();
    return new pc.Ray(origin, far.sub(origin).normalize());
  }
  landmarkHit(clientX: number, clientY: number) {
    const ray = this.ray(clientX, clientY);
    const mesh = this.content.pick(ray, true);
    if (mesh) return { entityId: mesh.id, kind: 'mesh' as const, point: tuple(mesh.point) };
    // Splats have no triangle surfaces. Expose the authored floor plane explicitly.
    if (this.props.manifest.asset?.kind !== 'gsplat' || Math.abs(ray.direction.y) < 1e-6) return null;
    const y = this.props.manifest.actorOrigin?.[1] ?? 0;
    const distance = (y - ray.origin.y) / ray.direction.y;
    if (distance <= 0 || distance > 200) return null;
    return { entityId: null, kind: 'floor' as const, point: tuple(ray.origin.clone().add(ray.direction.clone().mulScalar(distance))) };
  }
  pick(clientX: number, clientY: number) {
    const ray = this.ray(clientX, clientY);
    let nearest: { id: string; point: pc.Vec3; distance: number } | null = null;
    for (const actor of this.props.actors ?? []) {
      const point = new pc.Vec3();
      if (this.bounds(actor.id)?.intersectsRay(ray, point)) {
        const distance = point.distance(ray.origin);
        if (!nearest || distance < nearest.distance - 1e-6 || (Math.abs(distance - nearest.distance) <= 1e-6 && actor.id === this.props.selectedId)) nearest = { id: actor.id, point, distance };
      }
    }
    if (this.props.showCameras && this.props.mode !== 'shot') for (const [id, camera] of this.content.cameras) {
      const point = new pc.Vec3();
      if (new pc.BoundingBox(camera.getPosition(), new pc.Vec3(.25, .25, .25)).intersectsRay(ray, point)) {
        const distance = point.distance(ray.origin);
        if (!nearest || distance < nearest.distance) nearest = { id, point, distance };
      }
    }
    const scene = this.content.pick(ray);
    // Captured interiors have only an environment bound, so authored actors take selection priority.
    return nearest && (this.props.manifest.asset?.kind === 'gsplat' || !scene || nearest.distance < scene.distance) ? nearest : scene;
  }

  private material(hex: string) {
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color().fromString(hex); material.gloss = .25;
    material.update(); this.materials.add(material); return material;
  }
  private shape(parent: pc.Entity, type: string, position: Vector3Tuple, scale: Vector3Tuple, material: pc.StandardMaterial) {
    const part = new pc.Entity(type, this.app);
    part.addComponent('render', { type, material, castShadows: true, receiveShadows: true });
    part.setLocalPosition(...position); part.setLocalScale(...scale); parent.addChild(part); return part;
  }
  private updateActors() {
    const current = new Set((this.props.actors ?? []).map(actor => actor.id));
    for (const [id, entity] of this.actors) if (!current.has(id)) {
      // Only proxy materials are owned here; character models share their loaded materials.
      for (const material of this.actorMaterials.get(id) ?? []) if (this.materials.delete(material)) material.destroy();
      this.actorModels.forget(id); entity.destroy(); this.actors.delete(id); this.actorStyles.delete(id); this.actorMaterials.delete(id);
    }
    for (const actor of this.props.actors ?? []) {
      let root = this.actors.get(actor.id);
      if (!root) {
        root = new pc.Entity(actor.id, this.app); this.app.root.addChild(root); this.actors.set(actor.id, root);
        const material = this.material(actor.color), nose = this.material('#edc58c');
        this.actorMaterials.set(actor.id, [material, nose]);
        this.shape(root, 'cylinder', [0, .38, 0], [.3, .76, .3], material);
        this.shape(root, 'sphere', [0, .88, 0], [.24, .24, .24], material);
        this.shape(root, 'sphere', [0, .88, -.12], [.07, .07, .07], nose);
      }
      this.actorModels.sync(actor, root);
      root.setPosition(...actor.position); root.setEulerAngles(0, actor.heading * pc.math.RAD_TO_DEG, 0); root.setLocalScale(actor.height, actor.height, actor.height);
      const style = `${actor.color}:${this.props.selectedId === actor.id}`;
      if (this.actorStyles.get(actor.id) === style) continue;
      this.actorStyles.set(actor.id, style);
      const body = this.actorMaterials.get(actor.id)?.[0];
      if (body) {
        body.diffuse.fromString(actor.color);
        body.emissive.copy(this.props.selectedId === actor.id ? body.diffuse.clone().mulScalar(.12) : pc.Color.BLACK);
        body.update();
      }
    }
  }
  private line(points: Vector3Tuple[], color = amber) {
    for (let i = 1; i < points.length; i++) this.app.drawLine(vec(points[i - 1]), vec(points[i]), color, false);
  }
  private box(bound: pc.BoundingBox, color = amber) {
    const a = tuple(bound.getMin()), b = tuple(bound.getMax());
    const vertices = Array.from({ length: 8 }, (_, i) => new pc.Vec3(i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]));
    for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) this.app.drawLine(vertices[i], vertices[i | bit], color, false);
  }
  private overlays() {
    if (this.props.showCollision && this.props.collision) {
      const layer = placedCollision(this.props.collision, this.props.placements ?? []);
      for (const box of [...layer.boxes.filter(box => !this.props.isolateCollision || box.id === (layer.boxes.find(b => b.id === this.props.selectedCollisionId)?.id ?? layer.boxes[0]?.id)), { id: 'review-region', ...layer.region }]) {
        const center = box.min.map((v, i) => (v + box.max[i]) / 2) as Vector3Tuple;
        const half = box.min.map((v, i) => (box.max[i] - v) / 2) as Vector3Tuple;
        const color = box.id === this.props.selectedCollisionId ? new pc.Color(1, 1, 1) : box.id === 'review-region' ? new pc.Color(.69, .81, .69) : amber;
        this.box(new pc.BoundingBox(vec(center), vec(half)), color);
      }
    }
    if (this.props.mode === 'shot') { this.markers.forEach(marker => { marker.enabled = false; }); return; }
    const selected = this.props.selectedId && this.bounds(this.props.selectedId);
    if (selected) this.box(selected);
    if (this.props.showPath && this.props.path) {
      this.line(this.props.path.points);
      for (const mark of this.props.path.marks) this.box(new pc.BoundingBox(vec(mark), new pc.Vec3(.08, .08, .08)));
    }
    for (const path of this.props.actorPaths ?? []) this.line(path.points);
    for (const [id, source] of this.content.cameras) {
      let marker = this.markers.get(id);
      if (!marker) {
        marker = new pc.Entity(id, this.app); this.app.root.addChild(marker); this.markers.set(id, marker);
        this.shape(marker, 'box', [0, 0, 0], [.35, .25, .25], this.material('#9eae9e'));
        this.shape(marker, 'cone', [0, 0, -.22], [.32, .25, .32], this.material('#edc58c')).setLocalEulerAngles(90, 0, 0);
      }
      marker.setPosition(source.getPosition()); marker.setRotation(source.getRotation());
      marker.enabled = this.props.showCameras && marker.getPosition().distance(this.camera.getPosition()) > 1;
      if (this.props.showCameras && id === this.props.selectedId) {
        const fov = (source.camera?.fov ?? 52) * pc.math.DEG_TO_RAD / 2;
        const h = Math.tan(fov) * 3, w = h * this.aspect();
        const corners = [[-w, -h, -3], [w, -h, -3], [w, h, -3], [-w, h, -3]].map(point => source.getWorldTransform().transformPoint(vec(point)));
        for (let i = 0; i < 4; i++) { this.app.drawLine(source.getPosition(), corners[i], amber, false); this.app.drawLine(corners[i], corners[(i + 1) % 4], amber, false); }
      }
    }
  }
  private updateLandmarkPins() {
    const draft = this.landmarkDraft;
    const marks = (this.props.landmarks ?? []).filter(mark => mark.id !== draft?.id);
    if (draft) marks.push(draft);
    const current = new Set(marks.map(mark => mark.id));
    for (const [id, button] of this.landmarkPins) if (!current.has(id)) { button.remove(); this.landmarkPins.delete(id); }
    for (const mark of marks) {
      let button = this.landmarkPins.get(mark.id);
      if (!button) {
        button = document.createElement('button'); button.type = 'button'; button.className = 'landmark-pin';
        const dot = document.createElement('span'); dot.className = 'landmark-dot'; dot.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.className = 'landmark-pin-label';
        button.append(dot, label);
        button.addEventListener('pointerdown', event => this.input?.beginLandmarkDrag(mark.id, event));
        button.addEventListener('click', () => this.props.onLandmarkSelect?.(mark.id));
        this.canvas.parentElement!.appendChild(button); this.landmarkPins.set(mark.id, button);
      }
      const point = vec(mark.position), screen = this.camera.camera!.worldToScreen(point);
      const forward = point.clone().sub(this.camera.getPosition()).dot(this.camera.forward);
      button.hidden = !!this.props.hideLandmarks || this.props.mode !== 'orbit' || forward <= 0 || screen.x < 0 || screen.y < 0 || screen.x > this.canvas.clientWidth || screen.y > this.canvas.clientHeight;
      button.style.left = `${screen.x}px`; button.style.top = `${screen.y}px`;
      const label = mark.label || 'New landmark';
      if (button.lastElementChild!.textContent !== label) button.lastElementChild!.textContent = label;
      button.setAttribute('aria-label', `Landmark: ${label}`);
      button.setAttribute('aria-pressed', String(this.props.activeLandmarkId === mark.id));
      button.title = `${label} · Drag to move; use Reposition for click placement`;
      button.dataset.landmarkId = mark.id;
    }
  }
  private telemetry() {
    const camera = this.camera;
    this.canvas.dataset.cameraPosition = tuple(camera.getPosition()).map(n => n.toFixed(4)).join(',');
    const q = camera.getRotation(); this.canvas.dataset.cameraRotation = [q.x, q.y, q.z, q.w].map(n => n.toFixed(4)).join(',');
    this.canvas.dataset.cameraFov = String(camera.camera!.fov);
    this.canvas.dataset.cameraSource = this.props.mode === 'shot' ? this.props.cameraId : this.props.mode;
    this.canvas.dataset.frame = String(this.props.frame);
    this.canvas.dataset.drawCalls = String(this.app.stats.drawCalls.total);
    this.canvas.dataset.splats = String(this.app.stats.frame.gsplats);
    this.canvas.dataset.actorPoses = JSON.stringify((this.props.actors ?? []).map(({ id, position, heading }) => ({ id, position, heading })));
    const objects = (this.props.actors ?? []).map(actor => ({ id: actor.id, ...this.project(vec(actor.position).add(new pc.Vec3(0, actor.height * .5, 0))) }));
    if (this.props.selectedId && this.content.index.has(this.props.selectedId)) {
      const bound = this.bounds(this.props.selectedId);
      if (bound) objects.push({ id: this.props.selectedId, ...this.project(bound.center) });
    }
    this.canvas.dataset.objectScreenPositions = JSON.stringify(objects);
    this.canvas.dataset.propStatus = JSON.stringify(this.propLayer.status(this.props.props ?? []));
    if (this.props.path && this.props.showPath && this.props.mode === 'orbit') {
      const points = this.props.path.points.map(point => this.camera.camera!.worldToScreen(vec(point)));
      this.canvas.dataset.pathScreenBounds = JSON.stringify({ left: Math.min(...points.map(p => p.x / this.canvas.clientWidth)), right: Math.max(...points.map(p => p.x / this.canvas.clientWidth)), top: Math.min(...points.map(p => p.y / this.canvas.clientHeight)), bottom: Math.max(...points.map(p => p.y / this.canvas.clientHeight)) });
    } else delete this.canvas.dataset.pathScreenBounds;
  }
  private update(delta: number) {
    if (this.disposed) return;
    const p = this.props;
    if (this.lastFrame !== p.frame) { this.lastFrame = p.frame; this.invalidate(); }
    this.content.update(p.frame, p.placements ?? []);
    this.propLayer.sync(p.props ?? []);
    this.updateActors();
    this.reportModels();
    if (p.mode !== this.lastMode) {
      if (p.mode === 'orbit' && this.lastMode !== null) this.target.copy(this.camera.getPosition()).add(this.camera.forward.clone().mulScalar(8));
      this.lastMode = p.mode;
    }
    if (p.mode === 'shot') {
      if (p.pose) {
        this.camera.setPosition(...p.pose.position);
        rotation.setFromEuler(euler.set(p.pose.tilt, p.pose.pan, p.pose.roll, 'YXZ'));
        this.camera.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
        this.camera.camera!.fov = p.pose.fov;
      } else {
        const source = this.content.cameras.get(p.cameraId); if (source) this.copyCamera(source);
      }
    }
    const preview = p.preview;
    const previewCamera = this.previewCamera.camera!;
    const previewWidth = preview ? preview.region.right - preview.region.left : 0;
    const previewHeight = preview ? preview.region.bottom - preview.region.top : 0;
    previewCamera.enabled = !!preview && previewWidth > 0 && previewHeight > 0;
    if (previewCamera.enabled && preview) {
      previewCamera.rect = new pc.Vec4(preview.region.left, 1 - preview.region.bottom, previewWidth, previewHeight);
      if (preview.pose) {
        this.previewCamera.setPosition(...preview.pose.position);
        rotation.setFromEuler(euler.set(preview.pose.tilt, preview.pose.pan, preview.pose.roll, 'YXZ'));
        this.previewCamera.setRotation(rotation.x, rotation.y, rotation.z, rotation.w);
        previewCamera.fov = preview.pose.fov;
      } else {
        const source = this.content.cameras.get(preview.cameraId);
        if (source) {
          this.previewCamera.setPosition(source.getPosition());
          this.previewCamera.setRotation(source.getRotation());
          previewCamera.fov = source.camera?.fov ?? 52;
        }
      }
    }
    if (this.focusPending && this.content.root) { this.focusSelected(); this.focusPending = false; }
    this.input?.update(Math.min(delta, .05));
    if (this.app.autoRender || this.app.renderNextFrame) this.overlays();
    this.updateLandmarkPins();
    this.telemetry();
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.collisionAbort?.abort();
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.landmarkPins.forEach(button => button.remove()); this.landmarkPins.clear();
    this.resizeObserver.disconnect(); this.input?.destroy();
    this.propLayer.destroy(); this.actorModels.destroy(); this.models.destroy();
    this.blockoutAbort?.abort();
    this.blockoutLayer?.destroy(); this.blockoutLayer = null;
    this.content.destroy();
    this.materials.forEach(material => material.destroy());
    this.app.destroy();
  }
}
