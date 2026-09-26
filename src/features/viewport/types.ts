import type { RefObject } from 'react';
import type { SceneManifest, ViewMode, CameraPose, PathPreview, ViewportRegion, ViewportHandle, ShotSnapshot, ActorPose, ActorPath, ActorTool, ActorTransformEvent, ScenePlacement, SceneTransformEvent, ObjectContextRequest } from '@/contracts';

export type LiveViewportProps = {
  actorTool?: ActorTool;
  onActorTransform?: (event: ActorTransformEvent) => void;
  placements?: ScenePlacement[];
  onSceneTransform?: (event: SceneTransformEvent) => void;
  onContextRequest?: (request: ObjectContextRequest) => void;
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
export type { ShotSnapshot };
