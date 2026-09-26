import * as pc from 'playcanvas';
import { Euler, Quaternion } from 'three';
import type { ActorTransformEvent, Vector3Tuple } from '@/contracts';
import type { ViewportRuntime } from './runtime';
import { tuple, vec } from './content';
import { boundedPosition } from './transforms';

type Gesture = { id: string; kind: 'actor' | 'prop' | 'placement'; position: Vector3Tuple; heading: number; anchor: pc.Vec3; point?: pc.Vec3; pointer?: number };
type Pointer = { x: number; y: number; startX: number; startY: number; button: number; distance: number };

/** Input emits the same begin/preview/commit/cancel transactions as the previous viewport. */
export class ViewportInput {
  private anchor: pc.Entity;
  private move: pc.TranslateGizmo;
  private rotate: pc.RotateGizmo;
  private session: Gesture | null = null;
  private pointers = new Map<number, Pointer>();
  private keys = new Set<string>();
  private attached = '';
  private suppressClick = 0;
  private right: { down: boolean; requested: boolean; opened: boolean; moved: boolean } | null = null;
  private abort = new AbortController();

  constructor(private runtime: ViewportRuntime) {
    const { app, camera, canvas } = runtime;
    this.anchor = new pc.Entity('Transform anchor', app); app.root.addChild(this.anchor);
    const layer = pc.Gizmo.createLayer(app);
    this.move = new pc.TranslateGizmo(camera.camera!, layer);
    this.rotate = new pc.RotateGizmo(camera.camera!, layer);
    this.rotate.enableShape('x', false); this.rotate.enableShape('z', false); this.rotate.enableShape('face', false);
    for (const gizmo of [this.move, this.rotate]) {
      gizmo.on('transform:start', () => this.start());
      gizmo.on('transform:move', () => { this.emit('preview'); runtime.invalidate(); });
      gizmo.on('transform:end', () => this.finish(false));
      gizmo.on('render:update', () => runtime.invalidate());
    }
    const options = { signal: this.abort.signal };
    canvas.addEventListener('pointerdown', this.down, options);
    canvas.addEventListener('pointermove', this.pointerMove, options);
    canvas.addEventListener('pointerup', this.up, options);
    canvas.addEventListener('pointercancel', this.cancel, options);
    canvas.addEventListener('lostpointercapture', this.lostCapture, options);
    canvas.addEventListener('wheel', this.wheel, { ...options, passive: false });
    canvas.addEventListener('contextmenu', this.context, options);
    canvas.addEventListener('keydown', this.keyDown, options);
    canvas.addEventListener('blur', this.clear, options);
    window.addEventListener('keyup', this.keyUp, options);
    window.addEventListener('keydown', this.escape, options);
    window.addEventListener('blur', this.clear, options);
  }

  private selectedOrigin() {
    const id = this.runtime.props.selectedId;
    const actor = this.runtime.props.actors?.find(actor => actor.id === id);
    const prop = this.runtime.props.props?.find(prop => prop.id === id);
    return actor ? vec(actor.position) : prop ? vec(prop.position) : (id && this.runtime.bounds(id)?.center.clone()) || new pc.Vec3();
  }
  private start() {
    const p = this.runtime.props, id = p.selectedId;
    if (!id || this.session) return;
    const actor = p.actors?.find(actor => actor.id === id);
    const prop = p.props?.find(prop => prop.id === id);
    this.session = { id, kind: actor ? 'actor' : prop ? 'prop' : 'placement', position: actor?.position ?? prop?.position ?? p.placements?.find(item => item.id === id)?.offset ?? [0, 0, 0], heading: actor?.heading ?? prop?.rotation[1] ?? 0, anchor: this.anchor.getPosition().clone() };
    this.runtime.canvas.focus(); this.emit('start');
  }
  private emit(phase: ActorTransformEvent['phase']) {
    const s = this.session; if (!s) return;
    const p = this.runtime.props;
    const position = phase === 'cancel' ? s.position : boundedPosition(tuple(vec(s.position).add(this.anchor.getPosition().clone().sub(s.anchor))));
    const direction = this.anchor.forward;
    const heading = phase === 'cancel' ? s.heading : Math.atan2(-direction.x, -direction.z);
    if (s.kind === 'actor') p.onActorTransform?.({ id: s.id, position, heading, phase });
    else if (s.kind === 'prop') p.onPropTransform?.({ id: s.id, position, heading, phase });
    else p.onSceneTransform?.({ id: s.id, offset: position, phase });
  }
  private finish(cancel: boolean) {
    if (!this.session) return;
    this.emit(cancel ? 'cancel' : 'commit');
    const pointer = this.session.pointer;
    this.session = null;
    this.suppressClick = performance.now() + 250;
    if (pointer !== undefined && this.runtime.canvas.hasPointerCapture(pointer)) this.runtime.canvas.releasePointerCapture(pointer);
    if (cancel) { this.move.detach(); this.rotate.detach(); this.attached = ''; }
    this.runtime.invalidate();
  }
  cancel = () => { this.finish(true); this.pointers.clear(); this.right = null; };
  private clear = () => { this.keys.clear(); this.cancel(); };
  private lostCapture = (event: PointerEvent) => { if (this.pointers.has(event.pointerId)) this.cancel(); };
  setMovement(code: string, pressed: boolean) { if (pressed) this.keys.add(code); else this.keys.delete(code); this.runtime.invalidate(); }
  private keyDown = (event: KeyboardEvent) => {
    if (this.runtime.props.mode === 'fly' && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(event.code)) {
      event.preventDefault(); this.keys.add(event.code);
    }
  };
  private keyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && this.session) { event.preventDefault(); this.cancel(); } };

  private down = (event: PointerEvent) => {
    const { canvas, props: p } = this.runtime;
    canvas.focus();
    if (event.button === 2) this.right = { down: true, requested: false, opened: false, moved: false };
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, button: event.button, distance: 0 });
    canvas.setPointerCapture(event.pointerId);
    if (this.pointers.size > 1) { this.finish(true); return; }
    // Gizmos receive pointerdown first; their transform:start owns the gesture.
    if (this.session || event.button !== 0 || p.mode !== 'orbit' || p.actorTool !== 'move') return;
    const hit = this.runtime.pick(event.clientX, event.clientY);
    if (hit?.id !== p.selectedId || !hit) return;
    if (this.runtime.content.cameras.has(hit.id)) return;
    this.start();
    const session = this.session as Gesture | null;
    if (session) { session.point = hit.point; session.pointer = event.pointerId; }
  };
  private pointerMove = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId); if (!pointer) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    pointer.distance = Math.max(pointer.distance, Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY));
    if (pointer.button === 2 && this.right && pointer.distance > 5) this.right.moved = true;
    const other = [...this.pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
    if (other && this.runtime.props.mode === 'orbit') {
      const before = Math.hypot(pointer.x - other.x, pointer.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (after > 0) this.zoom(before / after);
      this.pan(dx / 2, dy / 2);
    } else if (this.session) {
      const s = this.session;
      if (s.pointer === event.pointerId && s.point) {
        const ray = this.runtime.ray(event.clientX, event.clientY);
        if (Math.abs(ray.direction.y) > 1e-6) {
          const distance = (s.point.y - ray.origin.y) / ray.direction.y;
          if (distance > 0) {
            const point = ray.origin.clone().add(ray.direction.clone().mulScalar(distance));
            this.anchor.setPosition(s.anchor.clone().add(point.sub(s.point))); this.emit('preview');
          }
        }
      }
    } else if (this.runtime.props.mode === 'orbit') {
      if (pointer.button === 2 || pointer.button === 1 || event.shiftKey) this.pan(dx, dy);
      else this.orbit(dx, dy);
    } else if (this.runtime.props.mode === 'fly' && pointer.button === 0) {
      const q = this.runtime.camera.getRotation();
      const angles = new Euler().setFromQuaternion(new Quaternion(q.x, q.y, q.z, q.w), 'YXZ');
      angles.y -= dx * .003; angles.x = pc.math.clamp(angles.x - dy * .003, -Math.PI / 2 + .03, Math.PI / 2 - .03);
      const next = new Quaternion().setFromEuler(angles);
      this.runtime.camera.setRotation(next.x, next.y, next.z, next.w);
    }
    pointer.x = event.clientX; pointer.y = event.clientY; this.runtime.invalidate();
  };
  private up = (event: PointerEvent) => {
    const pointer = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    const wasBody = this.session?.pointer === event.pointerId;
    if (wasBody) this.finish(false);
    if (this.runtime.canvas.hasPointerCapture(event.pointerId)) this.runtime.canvas.releasePointerCapture(event.pointerId);
    if (!pointer) return;
    if (event.button === 2 && this.right) {
      this.right.down = false;
      if (this.right.requested && !this.right.moved) { this.openContext(event); this.right.opened = true; }
    } else if (event.button === 0 && !wasBody && pointer.distance < 5 && performance.now() >= this.suppressClick) {
      this.runtime.props.onSelect(this.runtime.pick(event.clientX, event.clientY)?.id ?? null);
    }
    this.runtime.invalidate();
  };
  private context = (event: MouseEvent) => {
    event.preventDefault();
    if (this.right?.down) { this.right.requested = true; return; }
    if (!this.right || (!this.right.opened && !this.right.moved)) { this.openContext(event); if (this.right) this.right.opened = true; }
  };
  private openContext(event: MouseEvent | PointerEvent) { this.runtime.props.onContextRequest?.({ id: this.runtime.pick(event.clientX, event.clientY)?.id ?? null, x: event.clientX, y: event.clientY }); }
  private orbit(dx: number, dy: number) {
    const { camera, target } = this.runtime;
    const offset = camera.getPosition().clone().sub(target), radius = Math.max(.3, offset.length());
    const azimuth = Math.atan2(offset.x, offset.z) - dx * .006;
    const polar = pc.math.clamp(Math.acos(pc.math.clamp(offset.y / radius, -1, 1)) - dy * .006, .02, Math.PI * .98);
    camera.setPosition(target.x + radius * Math.sin(polar) * Math.sin(azimuth), target.y + radius * Math.cos(polar), target.z + radius * Math.sin(polar) * Math.cos(azimuth));
    camera.lookAt(target);
  }
  private pan(dx: number, dy: number) {
    const { camera, target, canvas } = this.runtime;
    const scale = 2 * camera.getPosition().distance(target) * Math.tan(camera.camera!.fov * Math.PI / 360) / Math.max(1, canvas.clientHeight);
    const shift = camera.right.clone().mulScalar(-dx * scale).add(camera.up.clone().mulScalar(dy * scale));
    camera.setPosition(camera.getPosition().clone().add(shift)); target.add(shift);
  }
  private zoom(factor: number) {
    const { camera, target } = this.runtime;
    const offset = camera.getPosition().clone().sub(target), length = Math.max(.001, offset.length());
    camera.setPosition(target.clone().add(offset.mulScalar(pc.math.clamp(length * factor, .3, 180) / length)));
  }
  private wheel = (event: WheelEvent) => {
    if (this.runtime.props.mode !== 'orbit') return;
    event.preventDefault(); this.zoom(Math.exp(pc.math.clamp(event.deltaY, -200, 200) * .001)); this.runtime.invalidate();
  };
  update(delta: number) {
    const p = this.runtime.props;
    if (!this.session) {
      const actor = p.actors?.find(item => item.id === p.selectedId);
      const prop = p.props?.find(item => item.id === p.selectedId);
      this.anchor.setPosition(this.selectedOrigin()); this.anchor.setEulerAngles(0, (actor?.heading ?? prop?.rotation[1] ?? 0) * pc.math.RAD_TO_DEG, 0);
      const valid = actor || (p.selectedId && this.runtime.content.index.has(p.selectedId));
      const next = p.mode === 'orbit' && valid && p.actorTool && p.actorTool !== 'select' ? `${p.selectedId}:${p.actorTool}` : '';
      if (next !== this.attached) {
        this.move.detach(); this.rotate.detach();
        if (next) (p.actorTool === 'rotate' ? this.rotate : this.move).attach(this.anchor);
        this.attached = next;
      }
    }
    this.runtime.canvas.dataset.gizmoPosition = JSON.stringify(this.runtime.project(this.anchor.getPosition()));
    if (p.mode !== 'fly' || !this.keys.size) return;
    const held = this.keys;
    const forward = Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown'));
    const right = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
    const up = Number(held.has('KeyE')) - Number(held.has('KeyQ'));
    const { camera } = this.runtime;
    const velocity = camera.forward.clone().mulScalar(forward).add(camera.right.clone().mulScalar(right));
    if (velocity.lengthSq()) velocity.normalize(); velocity.y += up;
    if (velocity.lengthSq()) {
      const speed = held.has('ShiftLeft') || held.has('ShiftRight') ? 12 : 4;
      camera.setPosition(camera.getPosition().clone().add(velocity.normalize().mulScalar(delta * speed))); this.runtime.invalidate();
    }
  }
  destroy() { this.clear(); this.abort.abort(); this.move.destroy(); this.rotate.destroy(); this.anchor.destroy(); }
}
