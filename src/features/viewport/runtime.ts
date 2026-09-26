import * as pc from 'playcanvas';
import { Euler, Quaternion } from 'three';
import type { Vector3Tuple, ViewportHandle } from '@/contracts';
import type { LiveViewportProps } from './types';
import { SceneContent, tuple, vec } from './content';
import { framePath } from './framing';
import { actorBounds } from './actors';
import { ViewportInput } from './viewport-input';

const amber = new pc.Color(.929, .773, .549);
const rotation = new Quaternion();
const euler = new Euler(0, 0, 0, 'YXZ');

export class ViewportRuntime implements ViewportHandle {
  readonly app: pc.Application;
  readonly camera: pc.Entity;
  readonly content: SceneContent;
  readonly target = new pc.Vec3();
  readonly actors = new Map<string, pc.Entity>();
  readonly markers = new Map<string, pc.Entity>();
  readonly materials = new Set<pc.StandardMaterial>();
  private actorStyles = new Map<string, string>();
  props: LiveViewportProps;
  input: ViewportInput | null = null;
  private resizeObserver: ResizeObserver;
  private disposed = false;
  private loaded = false;
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
    const light = new pc.Entity('Sun', this.app);
    light.addComponent('light', { type: 'directional', color: new pc.Color(1, .95, .86), intensity: 2.5, castShadows: true, shadowResolution: 2048, shadowDistance: 100, normalOffsetBias: .035 });
    light.setEulerAngles(55, -25, 0); this.app.root.addChild(light);
    this.content = new SceneContent(this.app, props.manifest);
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
    if (this.props.selectedId !== props.selectedId || this.props.actorTool !== props.actorTool || this.props.mode !== props.mode) this.input?.cancel();
    const regionChanged = this.props.region !== props.region;
    this.props = props;
    if (regionChanged && this.pathPending && props.mode === 'orbit' && props.showPath) this.framePath();
    this.invalidate();
  }
  invalidate() { if (!this.disposed) this.app.renderNextFrame = true; }
  setMovement(code: string, pressed: boolean) { this.input?.setMovement(code, pressed); }

  resetView() {
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
    if (!this.loaded || (!entity && !actor) || entity?.type === 'Camera') return null;
    const bound = this.bounds(id);
    return bound ? { subjectId: id, subjectName: actor?.name ?? entity!.name, min: tuple(bound.getMin()), max: tuple(bound.getMax()), cameraPosition: tuple(this.camera.getPosition()) } : null;
  }
  frameSelection() { this.focusPending = true; this.pathPending = false; this.invalidate(); }
  framePath() {
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
    for (const [id, entity] of this.actors) if (!current.has(id)) { for (const component of entity.findComponents('render') as pc.RenderComponent[]) for (const mesh of component.meshInstances) { const material = mesh.material as pc.StandardMaterial; if (this.materials.delete(material)) material.destroy(); }
      entity.destroy(); this.actors.delete(id); this.actorStyles.delete(id); }
    for (const actor of this.props.actors ?? []) {
      let root = this.actors.get(actor.id);
      if (!root) {
        root = new pc.Entity(actor.id, this.app); this.app.root.addChild(root); this.actors.set(actor.id, root);
        const material = this.material(actor.color);
        this.shape(root, 'cylinder', [0, .38, 0], [.3, .76, .3], material);
        this.shape(root, 'sphere', [0, .88, 0], [.24, .24, .24], material);
        this.shape(root, 'sphere', [0, .88, -.12], [.07, .07, .07], this.material('#edc58c'));
      }
      root.setPosition(...actor.position); root.setEulerAngles(0, actor.heading * pc.math.RAD_TO_DEG, 0); root.setLocalScale(actor.height, actor.height, actor.height);
      const style = `${actor.color}:${this.props.selectedId === actor.id}`;
      if (this.actorStyles.get(actor.id) === style) continue;
      this.actorStyles.set(actor.id, style);
      for (const component of root.findComponents('render') as pc.RenderComponent[]) for (const instance of component.meshInstances) {
        if (component.entity.getLocalPosition().z !== 0) continue;
        const material = instance.material as pc.StandardMaterial;
        material.diffuse.fromString(actor.color);
        material.emissive.copy(this.props.selectedId === actor.id ? material.diffuse.clone().mulScalar(.12) : pc.Color.BLACK);
        material.update();
      }
    }
  }
  private line(points: Vector3Tuple[], color = amber) {
    for (let i = 1; i < points.length; i++) this.app.drawLine(vec(points[i - 1]), vec(points[i]), color, false);
  }
  private box(bound: pc.BoundingBox) {
    const a = tuple(bound.getMin()), b = tuple(bound.getMax());
    const vertices = Array.from({ length: 8 }, (_, i) => new pc.Vec3(i & 1 ? b[0] : a[0], i & 2 ? b[1] : a[1], i & 4 ? b[2] : a[2]));
    for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if (!(i & bit)) this.app.drawLine(vertices[i], vertices[i | bit], amber, false);
  }
  private overlays() {
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
    this.updateActors();
    if (p.mode !== this.lastMode) {
      if (p.mode === 'fly') {
        const source = this.content.cameras.get(p.cameraId); if (source) this.copyCamera(source);
        this.camera.camera!.fov = this.props.manifest.initialView?.fov ?? 65; this.canvas.focus();
      } else if (p.mode === 'orbit' && this.lastMode !== null) this.target.copy(this.camera.getPosition()).add(this.camera.forward.clone().mulScalar(8));
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
    if (this.focusPending && this.content.root) { this.focusSelected(); this.focusPending = false; }
    this.input?.update(Math.min(delta, .05));
    if (this.app.autoRender || this.app.renderNextFrame) this.overlays();
    this.telemetry();
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.readyTimer) clearTimeout(this.readyTimer);
    this.resizeObserver.disconnect(); this.input?.destroy();
    this.content.destroy();
    this.materials.forEach(material => material.destroy());
    this.app.destroy();
  }
}
