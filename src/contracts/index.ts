/** Shared serializable contracts. Renderer/shot data uses metres and Three.js Y-up; source metadata exceptions are documented below. */
export type Vector3Tuple = [number, number, number];
export type ViewMode = 'orbit' | 'fly' | 'shot';
export type SensorId = 'super16' | 'super35' | 'fullFrame' | 'imax65';
export type CameraMark = { time: number; position: { x: number; y: number; z: number }; pan: number; tilt: number; roll: number; focalLength: number; easeIn: number; easeOut: number; hold: number };
export type ShotSnapshot = { subjectId: string; subjectName: string; min: Vector3Tuple; max: Vector3Tuple; cameraPosition: Vector3Tuple };
export type ShotSettings = { presetId: string; duration: number; focalLength: number; sensor: SensorId; framing: 'wide' | 'full' | 'detail' };
export type CameraShot = { name: string; subjectId: string; subjectName: string; target: Vector3Tuple; settings: ShotSettings; marks: CameraMark[]; trackSubject: boolean };
/** Y-up metres; Euler YXZ pan/tilt/roll in radians; focalLength in mm; vertical fov in degrees. */
export type CameraPose = { position: Vector3Tuple; pan: number; tilt: number; roll: number; focalLength: number; fov: number };
export type PathPreview = { points: Vector3Tuple[]; marks: Vector3Tuple[]; target: Vector3Tuple };
export type ViewportRegion = { left: number; right: number; top: number; bottom: number };
export type ViewportHandle = { captureSubject: (id: string) => ShotSnapshot | null; frameSelection: () => void; resetView: () => void; framePath: () => void; setMovement: (code: string, pressed: boolean) => void };
export type TimelineTrack = { id: string; label: string; kind: 'camera' | 'scene'; clip: { label: string; startFrame: number; endFrame: number; detail?: string; draft?: boolean }; hold?: boolean; selectable?: boolean };
export type SceneEntity = {
  id: string;
  name: string;
  sourceName: string;
  type: 'Mesh' | 'Collection' | 'Camera';
  category: 'Architecture' | 'Landscape' | 'Furniture' | 'Camera';
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
  name: string;
  fps: number;
  frameStart: number;
  frameEnd: number;
  animationEnd: number;
  activeCameraId: string;
  aspect: number;
  objects: SceneEntity[];
  simplifications: string[];
};

