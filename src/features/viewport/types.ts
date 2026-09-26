import type { RefObject } from 'react';
import type { SceneManifest, ViewMode, CameraPose, PathPreview, ViewportRegion, ViewportHandle, ShotSnapshot, ActorPose, ActorPath, ActorTool, ActorTransformEvent, ScenePlacement, SceneTransformEvent, ObjectContextRequest, SceneProp, PropTransformEvent, ActorRigInfo } from '@/contracts';

export type LiveViewportProps = {
  actorTool?: ActorTool;
  onActorTransform?: (event: ActorTransformEvent) => void;
  placements?: ScenePlacement[];
  onSceneTransform?: (event: SceneTransformEvent) => void;
  props?: SceneProp[];
  onPropTransform?: (event: PropTransformEvent) => void;
  onContextRequest?: (request: ObjectContextRequest) => void;
  actors?: ActorPose[];
  /** Reports each actor's body once it is built or its model finishes loading. */
  onActorRig?: (id: string, info: ActorRigInfo) => void;
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
