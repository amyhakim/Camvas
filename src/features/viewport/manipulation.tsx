import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import type { TransformControls as Controls } from 'three-stdlib';
import * as THREE from 'three';
import type { LiveViewportProps } from './live-viewport';
import { boundedPosition } from './transforms';

type Session = { id: string; actor: boolean; position: THREE.Vector3; heading: number; anchor: THREE.Vector3; plane?: THREE.Plane; hit?: THREE.Vector3; pointer?: number };
export function Manipulation({ props, index }: { props: LiveViewportProps; index: Map<string, THREE.Object3D[]> }) {
  const { camera, gl, scene, invalidate, controls: defaultControls } = useThree();
  const controls = defaultControls as unknown as { enabled: boolean } | null;
  // three-stdlib declares runtime state private although Drei exposes it as props.
  const state = () => gizmo.current as unknown as { axis: string | null; dragging: boolean; onPointerUp: (event: PointerEvent) => void } | null;
  const anchor = useMemo(() => new THREE.Object3D(), []);
  const gizmo = useRef<Controls>(null);
  const session = useRef<Session | null>(null);
  const latest = useRef(props); latest.current = props;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const actor = props.actors?.find(item => item.id === props.selectedId);
  const entity = props.manifest.objects.find(item => item.id === props.selectedId);
  const enabled = props.mode === 'orbit' && props.actorTool !== undefined && props.actorTool !== 'select' && (!!actor || (!!entity && entity.type !== 'Camera' && props.actorTool === 'move'));
  function origin() {
    const p = latest.current;
    const current = p.actors?.find(item => item.id === p.selectedId);
    if (current) return new THREE.Vector3(...current.position);
    const bounds = new THREE.Box3(); (index.get(p.selectedId ?? '') ?? []).forEach(object => bounds.expandByObject(object));
    return bounds.isEmpty() ? new THREE.Vector3() : bounds.getCenter(new THREE.Vector3());
  }
  function emit(phase: 'start' | 'preview' | 'commit' | 'cancel') {
    const s = session.current; if (!s) return;
    const position = boundedPosition(phase === 'cancel' ? s.position.toArray() : s.position.clone().add(anchor.position.clone().sub(s.anchor)).toArray());
    if (s.actor) latest.current.onActorTransform?.({ id: s.id, position, heading: phase === 'cancel' ? s.heading : anchor.rotation.y, phase });
    else latest.current.onSceneTransform?.({ id: s.id, offset: position, phase });
    invalidate();
  }
  function finish(cancel: boolean) {
    if (!session.current) return;
    if (cancel) gizmo.current?.reset();
    emit(cancel ? 'cancel' : 'commit');
    if (cancel) { anchor.position.copy(session.current.anchor); anchor.rotation.y = session.current.heading; }
    const pointer = session.current.pointer;
    if (pointer !== undefined && gl.domElement.hasPointerCapture(pointer)) gl.domElement.releasePointerCapture(pointer);
    session.current = null;
    if (state()) {
      state()!.dragging = false;
      if (cancel) { state()!.axis = null; state()!.onPointerUp(new PointerEvent('pointerup', { button: 0 })); }
    }
    if (controls) controls.enabled = true;
    gl.domElement.dataset.suppressClickUntil = String(performance.now() + 250);
    invalidate();
  }
  function start(): Session | null {
    const p = latest.current; if (!p.selectedId || session.current) return null;
    const current = p.actors?.find(item => item.id === p.selectedId);
    session.current = { id: p.selectedId, actor: !!current, position: new THREE.Vector3(...(current?.position ?? p.placements?.find(item => item.id === p.selectedId)?.offset ?? [0, 0, 0])), heading: current?.heading ?? 0, anchor: anchor.position.clone() };
    if (controls) controls.enabled = false;
    gl.domElement.focus(); emit('start'); return session.current;
  }
  function ray(event: PointerEvent | MouseEvent) {
    const rect = gl.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    let nearest: { id: string; point: THREE.Vector3; distance: number } | null = null;
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object && !object.userData.entityId) object = object.parent;
      if (!object?.userData.entityId) continue;
      const candidate = { id: object.userData.entityId as string, point: hit.point, distance: hit.distance };
      nearest ??= candidate;
      if (hit.distance > nearest.distance + 1e-6) break;
      if (candidate.id === latest.current.selectedId) return candidate;
    }
    return nearest;
  }
  useEffect(() => {
    const element = gl.domElement;
    let right: { x: number; y: number; distance: number; down: boolean; requested: boolean; opened: boolean } | null = null;
    function down(event: PointerEvent) {
      if (event.button === 2) { right = { x: event.clientX, y: event.clientY, distance: 0, down: true, requested: false, opened: false }; return; }
      if (session.current || event.button !== 0 || latest.current.mode !== 'orbit' || latest.current.actorTool !== 'move' || state()?.axis) return;
      const hit = ray(event);
      if (!hit || hit.id !== latest.current.selectedId) return;
      const p = latest.current;
      if (!p.actors?.some(item => item.id === hit.id) && !p.manifest.objects.some(item => item.id === hit.id && item.type !== 'Camera')) return;
      event.stopImmediatePropagation(); event.preventDefault(); const active = start();
      if (active) { active.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y); active.hit = hit.point.clone(); active.pointer = event.pointerId; }
      element.setPointerCapture(event.pointerId);
    }
    function move(event: PointerEvent) {
      if (right?.down) right.distance = Math.max(right.distance, Math.hypot(event.clientX - right.x, event.clientY - right.y));
      const s = session.current; if (!s?.plane || s.pointer !== event.pointerId) return;
      ray(event); const point = raycaster.ray.intersectPlane(s.plane, new THREE.Vector3());
      if (point && s.hit) { anchor.position.copy(s.anchor).add(point.sub(s.hit)); emit('preview'); }
    }
    function openContext(event: MouseEvent | PointerEvent) { latest.current.onContextRequest?.({ id: ray(event)?.id ?? null, x: event.clientX, y: event.clientY }); }
    function up(event: PointerEvent) {
      if (session.current?.pointer === event.pointerId) finish(false);
      if (event.button === 2 && right) {
        right.down = false;
        if (right.requested && right.distance < 5) { openContext(event); right.opened = true; }
      }
    }
    function cancel() { right = null; finish(true); }
    function key(event: KeyboardEvent) { if (event.key === 'Escape' && session.current) { event.preventDefault(); cancel(); } }
    function context(event: MouseEvent) {
      event.preventDefault();
      // Chromium can fire contextmenu on mouse-down. Wait for release to distinguish pan.
      if (right?.down) { right.requested = true; return; }
      if (!right || (!right.opened && right.distance < 5)) { openContext(event); if (right) right.opened = true; }
    }
    element.addEventListener('pointerdown', down, true); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    element.addEventListener('contextmenu', context); window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel); window.addEventListener('keydown', key);
    return () => { cancel(); element.removeEventListener('pointerdown', down, true); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); element.removeEventListener('contextmenu', context); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key); };
  }, [camera, gl, controls, scene, index]);
  useEffect(() => { finish(true); }, [props.selectedId, props.actorTool, props.mode]);
  useFrame(() => {
    if (!session.current) { anchor.position.copy(origin()); anchor.rotation.set(0, actor?.heading ?? 0, 0); }
    const rect = gl.domElement.getBoundingClientRect();
    const project = (position: THREE.Vector3) => { const p = position.clone().project(camera); return { x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 }; };
    gl.domElement.dataset.objectScreenPositions = JSON.stringify([...(props.actors ?? []).map(a => ({ id: a.id, ...project(new THREE.Vector3(...a.position).add(new THREE.Vector3(0, a.height * .5, 0))) })), ...Array.from(index).filter(([id]) => id === props.selectedId).map(([id, objects]) => { const bounds = new THREE.Box3(); objects.forEach(object => bounds.expandByObject(object)); return { id, ...project(bounds.getCenter(new THREE.Vector3())) }; })]);
    gl.domElement.dataset.gizmoPosition = JSON.stringify(project(anchor.position));
  });
  return <><primitive object={anchor} />{enabled ? <TransformControls ref={gizmo} object={anchor} mode={props.actorTool === 'rotate' ? 'rotate' : 'translate'} space="world" showX={props.actorTool !== 'rotate'} showY showZ={props.actorTool !== 'rotate'} onMouseDown={start} onObjectChange={() => emit('preview')} onMouseUp={() => finish(false)} /> : null}</>;
}
