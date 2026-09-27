/** Shared serializable contracts. Renderer/shot data uses metres and Three.js Y-up; source metadata exceptions are documented below. */
export type Vector3Tuple = [number, number, number];
export type ViewMode = 'orbit' | 'shot';
export type SensorId = 'super16' | 'super35' | 'fullFrame' | 'imax65';
/**
 * `cut`: the camera jumps to this mark at its time instead of travelling from the previous one (a new shot).
 * `aim`: while the shot keeps its subject centred, the aim point for this mark (Y-up metres); aims blend between marks.
 */
export type CameraMark = { time: number; position: { x: number; y: number; z: number }; pan: number; tilt: number; roll: number; focalLength: number; easeIn: number; easeOut: number; hold: number; cut?: boolean; aim?: Vector3Tuple };
export type ShotSnapshot = { subjectId: string; subjectName: string; min: Vector3Tuple; max: Vector3Tuple; cameraPosition: Vector3Tuple };
export type ShotSettings = { presetId: string; duration: number; focalLength: number; sensor: SensorId; framing: 'wide' | 'full' | 'detail' };
export type TimedPoint = { time: number; position: Vector3Tuple };
/** An actor subject (`actor:` ID) keeps aim locked to the actor at playback time; `subjectSignature` records its marks at generation for stale hints. */
export type CameraShot = { name: string; subjectId: string; subjectName: string; target: Vector3Tuple; settings: ShotSettings; marks: CameraMark[]; trackSubject: boolean; subjectSignature?: string; anchorIds?: string[]; cinemaTraj?: { positions: TimedPoint[]; targets: TimedPoint[] } };
/** Y-up metres; Euler YXZ pan/tilt/roll in radians; focalLength in mm; vertical fov in degrees. */
/** `focus` is the distance to the aim point in metres, when known (depth of field focuses there). */
export type CameraPose = { position: Vector3Tuple; pan: number; tilt: number; roll: number; focalLength: number; fov: number; focus?: number };
export type PathPreview = { points: Vector3Tuple[]; marks: Vector3Tuple[]; target: Vector3Tuple };
export type ViewportRegion = { left: number; right: number; top: number; bottom: number };
export type CollisionBox = { id: string; min: Vector3Tuple; max: Vector3Tuple };
/** Reviewed collision proxies in Y-up coordinates; region is the limited surveyed area, not a free-space guarantee. */
export type CollisionLayer = { version: 1; entityId: string; sourceUrl: string; offset: Vector3Tuple; cellSize: number; sampleCount: number; reviewed: boolean; region: { min: Vector3Tuple; max: Vector3Tuple }; boxes: CollisionBox[] };
export type CollisionOptions = { radius: number; cellSize: number };
export type ViewportHandle = {
  captureFlightViews: (samples: { time: number; pose: CameraPose }[], signal: AbortSignal) => Promise<import('./automatic-flight').FlightEvidence[]>;
  prepareSplat?: (signal: AbortSignal, progress: (message: string) => void) => Promise<void>;
  captureSemantics: (revision: string, signal?: AbortSignal) => Promise<import('./semantics').SemanticSnapshot>;
  highlightSemantic: (entityIds: string[], region?: { min: Vector3Tuple; max: Vector3Tuple }) => void;
  generateCollision: (options: CollisionOptions, progress: (message: string) => void, signal?: AbortSignal) => Promise<CollisionLayer>;
  frameCollision: (id: string) => void;
  retryModel?: (uid: string) => void; captureSubject: (id: string) => ShotSnapshot | null; captureObstacles: (excludeId: string) => { min: Vector3Tuple; max: Vector3Tuple }[]; captureRouteMapGeometry: () => { min: Vector3Tuple; max: Vector3Tuple; color: string }[]; captureRouteMap: (view: { centerX: number; centerZ: number; halfHeight: number; cutHeight: number }) => Promise<string | null>; frameSelection: () => void; resetView: () => void; framePath: () => void; setMovement: (code: string, pressed: boolean) => void;
  /** The explore camera: `target` is the orbit point, `fov` the vertical field of view in degrees. */
  viewState: () => { position: Vector3Tuple; forward: Vector3Tuple; target: Vector3Tuple; fov: number } | null;
  /** Offline rendering: fix the drawing buffer size, then render exact frames; `draw` runs while the frame is on the canvas. `jitter` offsets each frame by a sub-pixel so averaged sub-frames also anti-alias. */
  beginRender?: (width: number, height: number, jitter?: boolean) => void;
  renderFrame?: (frame: number, draw: (canvas: HTMLCanvasElement) => void, signal?: AbortSignal) => Promise<void>;
  endRender?: () => void };
/** An editable clip inside a multi-clip lane. Bounds are frames: trims stay inside the source; moves end by `latestEnd`. */
export type TimelineClip = { id: string; label: string; startFrame: number; endFrame: number; detail?: string; selected?: boolean; bounds: { minStart: number; maxEnd: number; minLength: number; latestEnd: number } };
export type TimelineClipChange = { mode: 'move' | 'start' | 'end'; startFrame: number; endFrame: number };
export type TimelineTrack = { id: string; label: string; kind: 'camera' | 'scene' | 'actor' | 'music' | 'sfx'; clip: { label: string; startFrame: number; endFrame: number; detail?: string; draft?: boolean }; hold?: boolean; selectable?: boolean; clips?: TimelineClip[] };
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
  /** `studio` is a procedural stage (floor fading into darkness) with no file; `url` is ignored. */
  asset?: { kind: 'glb' | 'gsplat' | 'studio'; url: string; rotation?: Vector3Tuple };
  /** Authored GLB geometry/animation alongside the source asset, already in renderer Y-up coordinates. */
  companion?: { url: string };
  /** Scene-authored backdrop and mesh lighting; does not relight baked Gaussian colors. */
  presentation?: { background: Vector3Tuple; ambient: Vector3Tuple; key: { color: Vector3Tuple; intensity: number; rotation: Vector3Tuple } };
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
/** `local` models are GLB files imported from this computer and kept in this browser (uid `local-<hash>`; links are empty). */
export type ModelSource = { provider: 'sketchfab' | 'local'; uid: string; name: string; author: string; authorUrl: string; license: string; licenseUrl: string; viewerUrl: string };
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
/** Local position and yaw relative to a moving actor; created from the prop's world pose at attachment time. */
export type PropAttachment = { actorId: string; offset: Vector3Tuple; yaw: number };
/**
 * Product motion between `start` and `end` seconds: a turntable `spin` in degrees per second (the turn holds after the
 * window) and a `float` lift in metres that eases in and out, with a gentle bob while it hovers. The spin turns about a
 * vertical axis through the point `pivot` metres up the prop's own (unrotated) height, e.g. its middle, so a prop
 * balanced on its toe spins in place; without a pivot it turns about its base.
 */
export type PropMotion = { spin: number; float: number; start: number; end: number; pivot?: number };
export type SceneProp = { id: string; name: string; source: PropSource; position: Vector3Tuple; rotation: Vector3Tuple; size: number; color?: string; attachment?: PropAttachment; motion?: PropMotion };
export type ActorPath = { id: string; points: Vector3Tuple[] };
/** Scene assets are referenced, never embedded. Playback/navigation are transient editor state. */
export type ProjectDocument = {
  format: 'showcam-project'; version: 1; sceneId: string; name: string;
  shot: CameraShot | null; actors: ActorTrack[];
  /** Optional for older version-1 files; world-space translations of imported non-camera entities. */
  placements?: ScenePlacement[];
  /** Imported cameras removed from this project; source assets remain intact. */
  removedCameraIds?: string[];
  /** Optional for older version-1 files; props added in the editor or by the Director. */
  props?: SceneProp[];
  /** Named spatial points persist with the scene and can ground Director directions. */
  landmarks?: SceneLandmark[];
  /** Local project collision proxies; deliberately separate from visual geometry and room collaboration. */
  collision?: CollisionLayer;
  semantics?: import('./semantics').SemanticLayer;
  /** Optional for older version-1 files; music and sound effects placed on the timeline. */
  audio?: AudioClip[];
  /** Optional: studio lighting, lens effects, atmosphere and finishing. Absent keeps the scene's own lighting. */
  look?: LookSettings;
  /** Optional: text cards drawn over the shot and burned into renders. */
  titles?: TitleCard[];
};

/**
 * The look of the shot. Lighting `rig: 'studio'` replaces the scene light with a key, fill, two rims and a top beam
 * aimed at `subjectId` (or the scene centre), turned by `angle` radians; intensities are multipliers (0 = off).
 * Camera effects follow the shot camera; `dof` is blur strength focused on the camera's aim. Colours are #rrggbb.
 * Realism (all optional): `environmentMap` picks procedural softboxes or a captured studio HDRI for reflections;
 * `shadowSoftness` widens the key light's contact shadow; `floor` lifts the studio floor from black to graphite.
 * `aperture` (f-stop) switches depth of field to real optics for the lens and focus distance; `ao` adds contact
 * occlusion; `detail` adds micro surface texture to the subject; `sharpen` restores fine detail; `shake` is handheld
 * micro-movement. `motionBlur` is the render shutter angle in degrees (180 = natural film blur).
 */
export type LookSettings = {
  lighting: { rig: 'scene' | 'studio'; subjectId: string | null; angle: number; key: number; fill: number; rim: number; beam: number; environment: number; keyColor: string; rimColor: string; rimColor2: string; sweep: { start: number; duration: number; intensity: number } | null; cues?: LightCue[];
    environmentMap?: 'softboxes' | 'studio' | 'warm-studio'; shadowSoftness?: number; floor?: number };
  camera: { exposure: number; bloom: number; dof: number; vignette: number; grain: number; fringing: number; contrast: number; saturation: number; tint: string; toneMapping: 'aces' | 'aces2' | 'neutral' | 'filmic';
    aperture?: number; ao?: number; detail?: number; sharpen?: number; shake?: number };
  atmosphere: { haze: number; dust: number };
  finish: { letterbox: number | null; fadeIn: number; fadeOut: number; motionBlur?: number };
};
/** From `start` seconds the studio rig switches to these values (a new lighting set-up, usually on a cut). */
export type LightCue = { start: number; angle: number; key: number; rim: number; beam: number; rimColor: string; rimColor2: string; subjectId?: string | null };
/** Seconds on the timeline (t0 = frame 1). */
export type TitleCard = { id: string; text: string; subtitle?: string; start: number; duration: number; align: 'upper' | 'center' | 'lower' };
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

/** Named location in renderer Y-up metres. Flight landmarks are camera-eye waypoints. */
export type SceneLandmark = {
  id: string;
  entityId: string | null;
  kind: 'mesh' | 'floor' | 'flight';
  frame: number;
  label: string;
  position: Vector3Tuple;
};
export type ModelLoadStatus = { uid: string; name: string; state: 'queued' | 'loading' | 'ready' | 'error'; message: string; progress?: number };
export type ModelOption = { uid: string; name: string; author: string; license: string; licenseSlug: string; faces: number; megabytes: number; tags: string[]; thumbnail?: string; viewerUrl: string; rigged?: boolean; animations?: number };

/**
 * Timeline audio. Sources are referenced (Jamendo music, Freesound effects) and streamed through the server;
 * only attribution is stored. Times are authored seconds (t0 = frame 1); `offset` trims the start of the file.
 */
export type AudioSource = { provider: 'jamendo' | 'freesound' | 'builtin'; id: string; name: string; artist: string; artistUrl: string; license: string; licenseUrl: string; pageUrl: string; duration: number };
export type AudioClip = { id: string; kind: 'music' | 'sfx'; source: AudioSource; start: number; offset: number; duration: number; volume: number; fadeIn: number; fadeOut: number };
export type AudioOption = AudioSource & { key: string; tags: string[] };
