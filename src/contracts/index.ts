/** Shared plain data: metres, seconds, radians, Three.js Y-up unless named Blender. */
export type Vector3Tuple = [number, number, number];
export type ViewMode = 'orbit' | 'fly' | 'shot';
export type SensorId = 'super16' | 'super35' | 'fullFrame' | 'imax65';
export type CameraMark = { time: number; position: { x: number; y: number; z: number }; pan: number; tilt: number; roll: number; focalLength: number; easeIn: number; easeOut: number; hold: number };
export type ShotSnapshot = { subjectId: string; subjectName: string; min: Vector3Tuple; max: Vector3Tuple; cameraPosition: Vector3Tuple };
export type ShotSettings = { presetId: string; duration: number; focalLength: number; sensor: SensorId; framing: 'wide' | 'full' | 'detail' };
export type CameraShot = { name: string; subjectId: string; subjectName: string; target: Vector3Tuple; settings: ShotSettings; marks: CameraMark[]; trackSubject: boolean };
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
  position: Vector3Tuple;
  positionWeb: Vector3Tuple;
  dimensions: Vector3Tuple;
  lens?: number;
  sensorWidth?: number;
  animated?: boolean;
  forwardWeb?: Vector3Tuple;
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

