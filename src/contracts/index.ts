/** Shared serializable contracts. Renderer/shot data uses metres and Three.js Y-up; source metadata exceptions are documented below. */
export type Vector3Tuple = [number, number, number];
export type ViewMode = 'orbit' | 'shot';
export type SensorId = 'super16' | 'super35' | 'fullFrame' | 'imax65';
export type CameraMark = { time: number; position: { x: number; y: number; z: number }; pan: number; tilt: number; roll: number; focalLength: number; easeIn: number; easeOut: number; hold: number };
export type ShotSnapshot = { subjectId: string; subjectName: string; min: Vector3Tuple; max: Vector3Tuple; cameraPosition: Vector3Tuple };
export type ShotSettings = { presetId: string; duration: number; focalLength: number; sensor: SensorId; framing: 'wide' | 'full' | 'detail' };
export type TimedPoint = { time: number; position: Vector3Tuple };
/** An actor subject (`actor:` ID) keeps aim locked to the actor at playback time; `subjectSignature` records its marks at generation for stale hints. */
export type CameraShot = { name: string; subjectId: string; subjectName: string; target: Vector3Tuple; settings: ShotSettings; marks: CameraMark[]; trackSubject: boolean; subjectSignature?: string; cinemaTraj?: { positions: TimedPoint[]; targets: TimedPoint[] } };
/** Y-up metres; Euler YXZ pan/tilt/roll in radians; focalLength in mm; vertical fov in degrees. */
export type CameraPose = { position: Vector3Tuple; pan: number; tilt: number; roll: number; focalLength: number; fov: number };
export type PathPreview = { points: Vector3Tuple[]; marks: Vector3Tuple[]; target: Vector3Tuple };
export type ViewportRegion = { left: number; right: number; top: number; bottom: number };
export type CollisionBox = { id: string; min: Vector3Tuple; max: Vector3Tuple };
/** Reviewed collision proxies in Y-up coordinates; region is the limited surveyed area, not a free-space guarantee. */
export type CollisionLayer = { version: 1; entityId: string; sourceUrl: string; offset: Vector3Tuple; cellSize: number; sampleCount: number; reviewed: boolean; region: { min: Vector3Tuple; max: Vector3Tuple }; boxes: CollisionBox[] };
export type CollisionOptions = { radius: number; cellSize: number };
export type ViewportHandle = {
  generateCollision: (options: CollisionOptions, progress: (message: string) => void) => Promise<CollisionLayer>;
  frameCollision: (id: string) => void;
  retryModel?: (uid: string) => void; captureSubject: (id: string) => ShotSnapshot | null; captureObstacles: (excludeId: string) => { min: Vector3Tuple; max: Vector3Tuple }[]; captureRouteMapGeometry: () => { min: Vector3Tuple; max: Vector3Tuple; color: string }[]; captureRouteMap: (view: { centerX: number; centerZ: number; halfHeight: number; cutHeight: number }) => Promise<string | null>; frameSelection: () => void; resetView: () => void; framePath: () => void; setMovement: (code: string, pressed: boolean) => void; viewState: () => { position: Vector3Tuple; forward: Vector3Tuple } | null };
export type TimelineTrack = { id: string; label: string; kind: 'camera' | 'scene' | 'actor'; clip: { label: string; startFrame: number; endFrame: number; detail?: string; draft?: boolean }; hold?: boolean; selectable?: boolean };
export type SceneEntity = {
  id: string;
  name: string;
  sourceName: string;
  type: 'Mesh' | 'Collection' | 'Camera' | 'Actor' | 'Splat' | 'Prop';
  category: 'Architecture' | 'Landscape' | 'Furniture' | 'Camera' | 'Actor' | 'Prop';
  materials: string[];
  /** Original Blender Z-up coordinates, in metres (inspector metadata). */
  position: Vector3Tuple;
  /** Converted Three.js Y-up coordinates, in metres. */
  positionWeb: Vector3Tuple;
  /** Extents along Blender X/Y/Z, in metres. */
  dimensions: Vector3Tuple;
  lens?: number;
  sensorWidth?: number;
  animated?: boolean;
  forwardWeb?: Vector3Tuple;
  /** Source samples on the manifest frame grid; Z-up positions and source quaternions. */
  samples?: { frame: number; position: Vector3Tuple; quaternion: [number, number, number, number] }[];
};

export type SceneManifest = {
  id?: string;
  name: string;
  asset?: { kind: 'glb' | 'gsplat'; url: string; rotation?: Vector3Tuple };
  initialView?: { position: Vector3Tuple; target: Vector3Tuple; fov: number };
  actorOrigin?: Vector3Tuple;
  attribution?: { author: string; url: string };
  fps: number;
  /** Original asset rate; preserves the first imported sample when playback is retimed. */
  sourceFps?: number;
  frameStart: number;
  frameEnd: number;
  animationEnd: number;
  activeCameraId: string;
  aspect: number;
  objects: SceneEntity[];
  simplifications: string[];
};

/** Authored proxy actors: feet at Y-up world position, metres; heading radians, zero faces -Z. */
export type ActorMark = { time: number; position: Vector3Tuple; heading: number };
/** A referenced third-party model. The file is fetched through the server at view time; only this attribution is stored. */
export type ModelSource = { provider: 'sketchfab'; uid: string; name: string; author: string; authorUrl: string; license: string; licenseUrl: string; viewerUrl: string };
export type ActorTrack = { id: string; name: string; color: string; height: number; marks: ActorMark[]; model?: ModelSource };
export type ActorPose = { id: string; name: string; color: string; height: number; position: Vector3Tuple; heading: number; model?: ModelSource };
/** Placed props: base-centre position (Y-up metres), Euler YXZ rotation in radians, `size` is the largest dimension in metres, optional tint. */
export type PropShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'plane';
export type PropSource = { kind: 'primitive'; shape: PropShape } | ({ kind: 'model' } & ModelSource);
/** Local position and yaw relative to a moving actor; created from the prop's world pose at attachment time. */
export type PropAttachment = { actorId: string; offset: Vector3Tuple; yaw: number };
export type SceneProp = { id: string; name: string; source: PropSource; position: Vector3Tuple; rotation: Vector3Tuple; size: number; color?: string; attachment?: PropAttachment };
export type ActorPath = { id: string; points: Vector3Tuple[] };
/** Scene assets are referenced, never embedded. Playback/navigation are transient editor state. */
export type ProjectDocument = {
  format: 'showcam-project'; version: 1; sceneId: string; name: string;
  shot: CameraShot | null; actors: ActorTrack[];
  /** Optional for older version-1 files; world-space translations of imported non-camera entities. */
  placements?: ScenePlacement[];
  /** Optional for older version-1 files; props added in the editor or by the Director. */
  props?: SceneProp[];
  /** Named spatial points persist with the scene and can ground Director directions. */
  landmarks?: SceneLandmark[];
  /** Local project collision proxies; deliberately separate from visual geometry and room collaboration. */
  collision?: CollisionLayer;
};
export type ProjectStatus = 'loading' | 'saved' | 'saving' | 'error';

/** Transient viewport authoring; only committed transforms become actor marks. */
export type ActorTool = 'select' | 'move' | 'rotate';
export type ActorTransform = { id: string; position: Vector3Tuple; heading: number };
export type ActorTransformEvent = ActorTransform & { phase: 'start' | 'preview' | 'commit' | 'cancel' };
/** Props share the actor gesture shape: absolute base position plus yaw (`heading`), all frames. */
export type PropTransformEvent = ActorTransformEvent;
export type ObjectContextRequest = { id: string | null; x: number; y: number };

export type ScenePlacement = { id: string; offset: Vector3Tuple };
export type SceneTransformEvent = ScenePlacement & { phase: 'start' | 'preview' | 'commit' | 'cancel' };

/** Named location placed at the current frame, in renderer Y-up metres. */
export type SceneLandmark = {
  id: string;
  entityId: string | null;
  kind: 'mesh' | 'floor';
  frame: number;
  label: string;
  position: Vector3Tuple;
};
export type ModelLoadStatus = { uid: string; name: string; state: 'queued' | 'loading' | 'ready' | 'error'; message: string; progress?: number };
export type ModelOption = { uid: string; name: string; author: string; license: string; licenseSlug: string; faces: number; megabytes: number; tags: string[]; thumbnail?: string; viewerUrl: string };
