/** Shared serializable contracts. Renderer/shot data uses metres and Three.js Y-up; source metadata exceptions are documented below. */
export type Vector3Tuple = [number, number, number];
export type ViewMode = 'orbit' | 'fly' | 'shot';
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
export type ViewportHandle = { captureSubject: (id: string) => ShotSnapshot | null; captureObstacles: (excludeId: string) => { min: Vector3Tuple; max: Vector3Tuple }[]; frameSelection: () => void; resetView: () => void; framePath: () => void; setMovement: (code: string, pressed: boolean) => void; viewState: () => { position: Vector3Tuple; forward: Vector3Tuple } | null };
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
  /** Original Blender frame numbers, Z-up positions and source quaternions. */
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
/**
 * Body animation. Poses are readable joint controls in degrees (see src/lib/humanoid.ts); `hips.lower` is a
 * fraction of hip height. Motions are placed on the actor's timeline in authored seconds (t0 = frame 1).
 */
export type PoseJoint = 'hips' | 'spine' | 'chest' | 'neck' | 'head' | 'leftArm' | 'leftElbow' | 'leftWrist' | 'rightArm' | 'rightElbow' | 'rightWrist' | 'leftLeg' | 'leftKnee' | 'leftFoot' | 'rightLeg' | 'rightKnee' | 'rightFoot';
export type PoseControls = Partial<Record<PoseJoint, Record<string, number>>>;
export type PoseKey = { time: number; pose: PoseControls };
export type MotionSource =
  | { kind: 'preset'; preset: string }
  | { kind: 'clip'; clip: string }
  | { kind: 'custom'; name: string; layer: 'full' | 'upper'; keys: PoseKey[] };
export type ActorMotion = { start: number; duration: number; loop: boolean; source: MotionSource };
export type ActorTrack = { id: string; name: string; color: string; height: number; marks: ActorMark[]; model?: ModelSource; motions?: ActorMotion[] };
/** Evaluated body state: a procedural pose, or a model's own clip sampled at `time` seconds. */
export type ActorBody = { pose: PoseControls; clip?: { name: string; time: number; loop: boolean } };
export type ActorPose = { id: string; name: string; color: string; height: number; position: Vector3Tuple; heading: number; model?: ModelSource; body?: ActorBody };
/** What the viewport found when it loaded an actor's body: mannequin, a rigged (animatable) model, or a static one. */
/** `message` explains a problem (static/error); `note` describes a partial rig that still animates. */
export type ActorRigInfo = { status: 'loading' | 'animatable' | 'static' | 'error'; body: 'mannequin' | 'model'; clips: { name: string; duration: number }[]; message?: string; note?: string };
/** Placed props: base-centre position (Y-up metres), Euler YXZ rotation in radians, `size` is the largest dimension in metres, optional tint. */
export type PropShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'plane';
export type PropSource = { kind: 'primitive'; shape: PropShape } | ({ kind: 'model' } & ModelSource);
export type SceneProp = { id: string; name: string; source: PropSource; position: Vector3Tuple; rotation: Vector3Tuple; size: number; color?: string };
export type ActorPath = { id: string; points: Vector3Tuple[] };
/** Scene assets are referenced, never embedded. Playback/navigation are transient editor state. */
export type ProjectDocument = {
  format: 'showcam-project'; version: 1; sceneId: string; name: string;
  shot: CameraShot | null; actors: ActorTrack[];
  /** Optional for older version-1 files; world-space translations of imported non-camera entities. */
  placements?: ScenePlacement[];
  /** Optional for older version-1 files; props added in the editor or by the Director. */
  props?: SceneProp[];
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
