export type ViewMode = 'orbit' | 'fly' | 'shot';
export type Vector3Tuple = [number, number, number];
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

export function entityPosition(entity: SceneEntity, frame: number): Vector3Tuple {
  if (!entity.samples?.length) return entity.position;
  return entity.samples[Math.min(entity.samples.length - 1, Math.max(0, frame - 1))].position;
}
