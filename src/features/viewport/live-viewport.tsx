'use client';

import { Component, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, Line, OrbitControls, Sky, useGLTF, useProgress } from '@react-three/drei';
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { framePath } from './framing';
import { actorBounds } from './actors';
import styles from './viewport.module.css';
import type { SceneManifest, ViewMode, CameraPose, PathPreview, ViewportRegion, ViewportHandle, ShotSnapshot, ActorPose, ActorPath } from '@/contracts';

const EMPTY_ACTORS: ActorPose[] = [];
const EMPTY_ACTOR_PATHS: ActorPath[] = [];

export type LiveViewportProps = {
  actors?: ActorPose[];
  actorPaths?: ActorPath[];
  pose: CameraPose | null;
  path: PathPreview | null;
  region: ViewportRegion;
  handle: RefObject<ViewportHandle | null>;
  showPath: boolean;
  manifest: SceneManifest;
  mode: ViewMode;
  frame: number;
  cameraId: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  showCameras: boolean;
  onReady: () => void;
};

class ViewportBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    return this.state.error ? <div className={`${styles.message} viewport-message`} role="alert"><AlertTriangle size={24} /><h2>The 3D scene couldn’t load</h2><p>Reload the viewer. If this continues, check that WebGL is enabled in your browser.</p><Button onClick={() => window.location.reload()}>Reload viewer</Button></div> : this.props.children;
  }
}

function LoadingMessage() {
  const { progress } = useProgress();
  return <div className={`${styles.message} viewport-message`} role="status"><LoaderCircle className="loading-icon" size={24} /><h2>Opening the pavilion</h2><p>Loading geometry, textures, and cameras{progress > 0 ? ` · ${Math.round(progress)}%` : '…'}</p></div>;
}

function FlyNavigation() {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const velocity = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const element = gl.domElement;
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    let dragging = false;
    let lastX = 0, lastY = 0;
    const recognized = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
    function keydown(event: KeyboardEvent) { if (recognized.includes(event.code)) { event.preventDefault(); keys.current.add(event.code); } }
    function keyup(event: KeyboardEvent) { keys.current.delete(event.code); }
    function clear() { keys.current.clear(); dragging = false; }
    function down(event: PointerEvent) {
      if (event.button !== 0 && event.pointerType !== 'touch') return;
      element.focus(); dragging = true; lastX = event.clientX; lastY = event.clientY;
    }
    function move(event: PointerEvent) {
      if (!dragging) return;
      const dx = event.clientX - lastX, dy = event.clientY - lastY;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= dx * .003;
      euler.x = THREE.MathUtils.clamp(euler.x - dy * .003, -Math.PI / 2 + .03, Math.PI / 2 - .03);
      camera.quaternion.setFromEuler(euler);
      lastX = event.clientX; lastY = event.clientY;
    }
    function up() { dragging = false; }
    element.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    element.addEventListener('blur', clear);
    window.addEventListener('blur', clear);
    element.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    // Touch movement buttons dispatch scoped commands to this canvas.
    function movement(event: Event) { const { code, pressed } = (event as CustomEvent<{ code: string; pressed: boolean }>).detail; if (pressed) keys.current.add(code); else keys.current.delete(code); }
    element.addEventListener('showcam-move', movement);
    return () => {
      element.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      element.removeEventListener('blur', clear); window.removeEventListener('blur', clear);
      element.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      element.removeEventListener('showcam-move', movement); keys.current.clear();
    };
  }, [camera, gl]);
  useFrame((_, delta) => {
    const held = keys.current;
    const forward = Number(held.has('KeyW') || held.has('ArrowUp')) - Number(held.has('KeyS') || held.has('ArrowDown'));
    const right = Number(held.has('KeyD') || held.has('ArrowRight')) - Number(held.has('KeyA') || held.has('ArrowLeft'));
    const up = Number(held.has('KeyE')) - Number(held.has('KeyQ'));
    velocity.set(right, 0, -forward);
    if (velocity.lengthSq()) velocity.normalize().applyQuaternion(camera.quaternion);
    velocity.y += up;
    if (velocity.lengthSq()) velocity.normalize();
    camera.position.addScaledVector(velocity, Math.min(delta, .05) * (held.has('ShiftLeft') || held.has('ShiftRight') ? 12 : 4));
    camera.updateMatrixWorld();
  });
  return null;
}

type PavilionProps = LiveViewportProps & { focusRequest: number; resetRequest: number; pathFocusRequest: number; captureRef: RefObject<((id: string) => ShotSnapshot | null) | null> };

function Pavilion(props: PavilionProps) {
  const { scene: cachedScene, animations } = useGLTF('/scenes/pavilion.glb');
  const scene = useMemo(() => cachedScene.clone(true), [cachedScene]);
  const { camera, gl, invalidate, size } = useThree();
  const pathPoints = props.path?.points;
  const actors = props.actors ?? EMPTY_ACTORS;
  const actorPaths = props.actorPaths ?? EMPTY_ACTOR_PATHS;
  const selectedActor = actors.find(actor => actor.id === props.selectedId);
  const selectedActorPath = actorPaths.find(path => path.id === props.selectedId);
  useEffect(() => {
    gl.domElement.dataset.actorPoses = JSON.stringify(actors.map(({ id, position, heading }) => ({ id, position, heading })));
  }, [actors, gl]);
  const orbit = useRef<OrbitControlsImpl>(null);
  const lastMode = useRef<ViewMode | null>(null);
  const handledPathRequest = useRef('');
  const handledFocusRequest = useRef(0);
  const [target] = useState(() => new THREE.Vector3(-2, 2, 0));
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const index = useMemo(() => {
    const entities = new Map<string, THREE.Object3D[]>();
    scene.traverse(object => {
      const id = object.userData.entityId;
      if (id) entities.set(id, [...(entities.get(id) || []), object]);
      if (object instanceof THREE.Mesh) {
        object.castShadow = true; object.receiveShadow = true;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(mat => {
          if (mat.name.includes('leafs')) { mat.alphaTest = .45; mat.transparent = false; mat.side = THREE.DoubleSide; if (mat instanceof THREE.MeshStandardMaterial) mat.color.set('#829d55'); }
          if (mat.name.includes('glass') || mat.name.includes('water')) { object.castShadow = false; mat.depthWrite = false; }
        });
      }
    });
    return entities;
  }, [scene]);
  useEffect(() => {
    props.captureRef.current = (id: string) => {
      const actor = actors.find(item => item.id === id);
      if (actor) return { subjectId: id, subjectName: actor.name, ...actorBounds(actor), cameraPosition: camera.position.toArray() };
      const entity = props.manifest.objects.find(item => item.id === id);
      if (!entity || entity.type === 'Camera') return null;
      scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3();
      (index.get(id) || []).forEach(object => bounds.expandByObject(object));
      if (bounds.isEmpty()) return null;
      return { subjectId: id, subjectName: entity.name, min: bounds.min.toArray(), max: bounds.max.toArray(), cameraPosition: camera.position.toArray() };
    };
    return () => { props.captureRef.current = null; };
  }, [props.captureRef, props.manifest, camera, scene, index, actors]);
  const cameras = useMemo(() => {
    const result = new Map<string, THREE.PerspectiveCamera>();
    scene.traverse(object => { if (object instanceof THREE.PerspectiveCamera && object.userData.entityId) result.set(object.userData.entityId, object); });
    return result;
  }, [scene]);
  const helper = useMemo(() => {
    const box = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#edc58c'));
    (Array.isArray(box.material) ? box.material : [box.material]).forEach(material => { material.depthTest = false; }); box.renderOrder = 10; return box;
  }, []);
  const focusBox = useMemo(() => new THREE.Box3(), []);
  const center = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const cameraHelpers = useMemo(() => Array.from(cameras.entries()).map(([id, source]) => {
    const displayCamera = source.clone(); displayCamera.far = 3; displayCamera.updateProjectionMatrix();
    const helper = new THREE.CameraHelper(displayCamera);
    const color = new THREE.Color('#edc58c'); helper.setColors(color,color,color,color,color);
    return { id, source, helper, displayCamera };
  }), [cameras]);

  useEffect(() => {
    const actions = animations.map(clip => { const action = mixer.clipAction(clip); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play(); return action; });
    return () => { actions.forEach(action => action.stop()); mixer.uncacheRoot(scene); };
  }, [animations, mixer, scene]);
  useEffect(() => { props.onReady(); }, [props.onReady]);
  useEffect(() => { invalidate(); }, [props.frame, props.selectedId, props.showCameras, props.cameraId, props.mode, props.pose, props.path, props.region, props.pathFocusRequest, props.showPath, actors, actorPaths, invalidate]);
  useEffect(() => () => { helper.geometry.dispose(); (Array.isArray(helper.material) ? helper.material : [helper.material]).forEach(material => material.dispose()); cameraHelpers.forEach(item => item.helper.dispose()); }, [helper, cameraHelpers]);

  function resetCamera() {
    // Clear residual orbit damping before an explicit camera placement.
    if (orbit.current) { orbit.current.enableDamping = false; orbit.current.update(); orbit.current.enableDamping = true; }
    const opening = cameras.get('Camera');
    if (opening) { opening.getWorldPosition(camera.position); opening.getWorldQuaternion(camera.quaternion); camera.getWorldDirection(offset); target.copy(camera.position).addScaledVector(offset, 20); }
    else { camera.position.set(-30, 9, 27); target.set(-2, 2, 0); camera.lookAt(target); }
    if (camera instanceof THREE.PerspectiveCamera) { camera.fov = opening?.fov || 52; camera.near = .05; camera.far = 400; camera.updateProjectionMatrix(); }
    orbit.current?.target.copy(target); orbit.current?.update();
  }
  useEffect(() => { resetCamera(); }, [props.resetRequest]); // Explicit user command.
  useEffect(() => {
    if (props.mode === 'fly' && lastMode.current !== 'fly') {
      const source = cameras.get(props.cameraId);
      if (source) { source.getWorldPosition(camera.position); source.getWorldQuaternion(camera.quaternion); }
      if (camera instanceof THREE.PerspectiveCamera) { camera.fov = 65; camera.updateProjectionMatrix(); }
      gl.domElement.focus();
    }
    if (props.mode === 'orbit' && lastMode.current !== null && lastMode.current !== 'orbit') {
      camera.getWorldDirection(offset); target.copy(camera.position).addScaledVector(offset, 8);
      orbit.current?.target.copy(target); orbit.current?.update();
    }
    lastMode.current = props.mode;
  }, [props.mode, camera, cameras, gl, props.cameraId, offset, target]);
  useEffect(() => {
    if (!props.focusRequest || props.focusRequest === handledFocusRequest.current || !props.selectedId || props.mode !== 'orbit') return;
    handledFocusRequest.current = props.focusRequest;
    if (orbit.current) { orbit.current.enableDamping = false; orbit.current.update(); orbit.current.enableDamping = true; }
    focusBox.makeEmpty();
    if (selectedActor) { const bounds = actorBounds(selectedActor); focusBox.set(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)); }
    (index.get(props.selectedId) || []).forEach(object => focusBox.expandByObject(object));
    if (focusBox.isEmpty()) {
      const entity = props.manifest.objects.find(object => object.id === props.selectedId);
      if (!entity) return;
      const sourceCamera = cameras.get(props.selectedId);
      if (sourceCamera) sourceCamera.getWorldPosition(center);
      else center.fromArray(entity.positionWeb);
    } else focusBox.getCenter(center);
    if (selectedActor) {
      // Proxy framing must account for the lens and the editor's clear rectangle.
      const bounds = actorBounds(selectedActor);
      const placement = framePath([bounds.min, bounds.max], center.toArray(), size.width / size.height, props.region);
      camera.position.fromArray(placement.position); target.fromArray(placement.target); camera.lookAt(target);
      if (camera instanceof THREE.PerspectiveCamera) { camera.fov = placement.fov; camera.updateProjectionMatrix(); }
      orbit.current?.target.copy(target); orbit.current?.update(); invalidate();
      return;
    }
    const radius = focusBox.isEmpty() ? 2 : Math.max(1, focusBox.getSize(offset).length() * .65);
    offset.copy(camera.position).sub(target).normalize().multiplyScalar(radius);
    camera.position.copy(center).add(offset); target.copy(center);
    orbit.current?.target.copy(center); orbit.current?.update(); invalidate();
  }, [props.focusRequest, props.selectedId, props.mode, props.manifest, index, cameras, camera, target, focusBox, center, offset, selectedActor, size.width, size.height, props.region, invalidate]);

  function placePathCamera() {
    const request = `${props.pathFocusRequest}:${size.width}:${size.height}:${JSON.stringify(props.region)}`;
    if (!orbit.current || !props.pathFocusRequest || request === handledPathRequest.current || !pathPoints || !props.path || !props.showPath || props.mode !== 'orbit') return;
    handledPathRequest.current = request;
    if (orbit.current) { orbit.current.enableDamping = false; orbit.current.update(); orbit.current.enableDamping = true; }
    const placement = framePath(pathPoints, props.path.target, size.width / size.height, props.region);
    camera.position.fromArray(placement.position); target.fromArray(placement.target); camera.lookAt(target);
    if (camera instanceof THREE.PerspectiveCamera) { camera.fov = placement.fov; camera.updateProjectionMatrix(); }
    orbit.current?.target.copy(target); orbit.current?.update(); invalidate();
  }

  useFrame(() => {
    animations.forEach(clip => { const action = mixer.clipAction(clip); action.paused = false; action.enabled = true; });
    // Blender exported frame 1 at 1/24s; maintain that exact offset while scrubbing.
    mixer.setTime(props.frame / props.manifest.fps);
    scene.updateMatrixWorld(true);
    // Place explicit path requests after OrbitControls mounts and updates.
    placePathCamera();
    if (props.mode === 'shot') {
      const source = cameras.get(props.cameraId);
      if (props.pose) {
        const pose = props.pose;
        camera.position.fromArray(pose.position);
        camera.quaternion.setFromEuler(new THREE.Euler(pose.tilt, pose.pan, pose.roll, 'YXZ'));
        if (camera instanceof THREE.PerspectiveCamera) { camera.fov = pose.fov; camera.updateProjectionMatrix(); }
      } else if (source) {
        source.getWorldPosition(camera.position); source.getWorldQuaternion(camera.quaternion);
        if (camera instanceof THREE.PerspectiveCamera && camera.fov !== source.fov) { camera.fov = source.fov; camera.updateProjectionMatrix(); }
      }
    }
    helper.box.makeEmpty();
    if (props.selectedId && props.mode !== 'shot') (index.get(props.selectedId) || []).forEach(object => helper.box.expandByObject(object));
    if (selectedActor && props.mode !== 'shot') { const bounds = actorBounds(selectedActor); helper.box.set(new THREE.Vector3(...bounds.min), new THREE.Vector3(...bounds.max)); }
    helper.visible = !helper.box.isEmpty();
    cameraHelpers.forEach(item => { item.source.getWorldPosition(item.displayCamera.position); item.source.getWorldQuaternion(item.displayCamera.quaternion); item.displayCamera.updateMatrixWorld(); item.helper.update(); item.helper.visible = props.showCameras && props.mode !== 'shot' && item.id === props.selectedId; });
    camera.updateMatrixWorld();
    if (pathPoints && props.showPath && props.mode === 'orbit') {
      const projected = pathPoints.map(point => new THREE.Vector3(...point).project(camera));
      gl.domElement.dataset.pathScreenBounds = JSON.stringify({ left: Math.min(...projected.map(p => (p.x + 1) / 2)), right: Math.max(...projected.map(p => (p.x + 1) / 2)), top: Math.min(...projected.map(p => (1 - p.y) / 2)), bottom: Math.max(...projected.map(p => (1 - p.y) / 2)) });
    } else delete gl.domElement.dataset.pathScreenBounds;
    gl.domElement.dataset.cameraPosition = camera.position.toArray().map(v => v.toFixed(4)).join(',');
    gl.domElement.dataset.cameraRotation = camera.quaternion.toArray().map(v => v.toFixed(4)).join(',');
    gl.domElement.dataset.ready = 'true';
    gl.domElement.dataset.cameraFov = camera instanceof THREE.PerspectiveCamera ? String(camera.fov) : '';
    gl.domElement.dataset.cameraSource = props.mode === 'shot' ? props.cameraId : props.mode;
    gl.domElement.dataset.frame = String(props.frame);
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
  });
  function pick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (event.delta > 5) return;
    let object: THREE.Object3D | null = event.object;
    while (object && !object.userData.entityId) object = object.parent;
    if (object?.userData.entityId) props.onSelect(object.userData.entityId);
  }
  return <>
    <primitive object={scene} onClick={pick} dispose={null} />
    <primitive object={helper} />
    {actors.map(actor => <ActorProxy key={actor.id} actor={actor} selected={props.selectedId === actor.id} onSelect={() => props.onSelect(actor.id)} />)}
    {selectedActorPath && selectedActorPath.points.length > 1 && props.mode === 'orbit' && <Line points={selectedActorPath.points} color={selectedActor?.color ?? '#edc58c'} lineWidth={2} transparent opacity={.8} depthTest={false} />}
    {pathPoints && props.showPath && props.mode !== 'shot' && <Line points={pathPoints} color="#edc58c" lineWidth={2} depthTest={false} transparent opacity={.85} />}
    {props.path && props.showPath && props.mode !== 'shot' && props.path.marks.map((mark, i) => <mesh key={i} renderOrder={10} position={mark}><sphereGeometry args={[.09, 8, 8]} /><meshBasicMaterial color="#edc58c" depthTest={false} /></mesh>)}
    {cameraHelpers.map(({ id, helper: cameraHelper, source }) => <group key={id}>
      <primitive object={cameraHelper} />
      {props.showCameras && props.mode !== 'shot' && <CameraMarker source={source} selected={props.selectedId === id} onSelect={() => props.onSelect(id)} />}
    </group>)}
    {props.mode === 'orbit' && <OrbitControls ref={orbit} makeDefault target={target} minDistance={.3} maxDistance={180} maxPolarAngle={Math.PI * .98} enableDamping dampingFactor={.1} />}
    {props.mode === 'fly' && <FlyNavigation />}
  </>;
}

function ActorProxy({ actor, selected, onSelect }: { actor: ActorPose; selected: boolean; onSelect: () => void }) {
  const h = actor.height;
  return <group position={actor.position} rotation={[0, actor.heading, 0]} userData={{ entityId: actor.id }} onClick={event => { event.stopPropagation(); if (event.delta < 5) onSelect(); }}>
    <mesh position={[0, h * .38, 0]} castShadow receiveShadow><cylinderGeometry args={[h * .13, h * .16, h * .76, 12]} /><meshStandardMaterial color={actor.color} roughness={.75} emissive={selected ? actor.color : '#000000'} emissiveIntensity={selected ? .12 : 0} /></mesh>
    <mesh position={[0, h * .88, 0]} castShadow><sphereGeometry args={[h * .12, 16, 12]} /><meshStandardMaterial color={actor.color} roughness={.75} /></mesh>
    <mesh position={[0, h * .88, -h * .12]} castShadow><sphereGeometry args={[h * .035, 8, 6]} /><meshStandardMaterial color="#edc58c" roughness={.75} /></mesh>
  </group>;
}

function CameraMarker({ source, selected, onSelect }: { source: THREE.Camera; selected: boolean; onSelect: () => void }) {
  const group = useRef<THREE.Group>(null);
  const camera = useThree(state => state.camera);
  useFrame(() => { if (group.current) { source.getWorldPosition(group.current.position); source.getWorldQuaternion(group.current.quaternion); group.current.visible = camera.position.distanceTo(group.current.position) > 1; } });
  return <group ref={group} onClick={event => { event.stopPropagation(); if (event.delta < 5) onSelect(); }}>
    <mesh><boxGeometry args={[.35, .25, .25]} /><meshBasicMaterial color={selected ? '#edc58c' : '#9eae9e'} /></mesh>
    <mesh position={[0,0,-.22]} rotation={[Math.PI / 2,0,0]}><coneGeometry args={[.16,.25,4]} /><meshBasicMaterial color={selected ? '#edc58c' : '#9eae9e'} /></mesh>
  </group>;
}

export default function LiveViewport(props: LiveViewportProps) {
  const [focusRequest, setFocusRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [pathFocusRequest, setPathFocusRequest] = useState(0);
  const captureRef = useRef<((id: string) => ShotSnapshot | null) | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(props.handle, () => ({
    captureSubject: id => captureRef.current?.(id) ?? null,
    frameSelection: () => setFocusRequest(value => value + 1),
    resetView: () => setResetRequest(value => value + 1),
    framePath: () => setPathFocusRequest(value => value + 1),
    setMovement: (code, pressed) => canvasRef.current?.dispatchEvent(new CustomEvent('showcam-move', { detail: { code, pressed } })),
  }), []);
  const [loaded, setLoaded] = useState(false);
  const readyCallback = useRef(props.onReady);
  readyCallback.current = props.onReady;
  const onReady = useMemo(() => () => { setLoaded(true); readyCallback.current(); }, []);
  return <ViewportBoundary>
    <Canvas className={styles.canvas} shadows frameloop={props.mode === 'fly' ? 'always' : 'demand'} dpr={[1, 1.5]} camera={{ position: [-30, 9, 27], fov: 52, near: .05, far: 400 }} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { canvasRef.current = gl.domElement; gl.domElement.tabIndex = 0; gl.domElement.setAttribute('aria-label', 'Interactive 3D pavilion. Drag to orbit, right drag to pan, scroll to zoom. In Fly mode use WASD and drag to look.'); gl.setClearColor('#a7bab6'); gl.toneMappingExposure = .85; }} onPointerMissed={event => { if (event.type === 'click') props.onSelect(null); }} fallback={<div className={`${styles.message} viewport-message`} role="alert"><h2>WebGL is unavailable</h2><p>Enable hardware acceleration or open Showcam in a browser with WebGL support.</p></div>}>
      <Sky distance={450} sunPosition={[50, 60, -25]} turbidity={5} rayleigh={.8} />
      <hemisphereLight args={['#e7f0ff', '#827e5b', .7]} />
      <directionalLight position={[-25, 45, 15]} intensity={2.5} color="#fff2d4" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-48} shadow-camera-right={48} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={120} shadow-normalBias={.035} />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={.8} color="#f2f2e8" scale={[100,100,1]} position={[0,50,0]} rotation={[Math.PI/2,0,0]} />
        <Lightformer form="rect" intensity={.5} color="#c7deec" scale={[100,40,1]} position={[0,10,80]} />
      </Environment>
      <Suspense fallback={null}><Pavilion {...props} focusRequest={focusRequest} resetRequest={resetRequest} pathFocusRequest={pathFocusRequest} captureRef={captureRef} onReady={onReady} /></Suspense>
    </Canvas>
    {!loaded && <LoadingMessage />}
  </ViewportBoundary>;
}
