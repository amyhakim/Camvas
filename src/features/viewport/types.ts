import type { RefObject } from 'react';
import type { LookSettings, TitleCard, SceneLandmark, ModelLoadStatus, SceneManifest, ViewMode, CameraPose, PathPreview, ViewportRegion, ViewportHandle, ShotSnapshot, ActorPose, ActorPath, ActorTool, ActorTransformEvent, ScenePlacement, SceneTransformEvent, ObjectContextRequest, SceneProp, PropTransformEvent, ActorRigInfo } from '@/contracts';

export type LiveViewportProps = {
  semantics?: import('@/contracts/semantics').SemanticLayer;
  showSemanticLabels?: boolean;
  layerControlsContainer?: HTMLDivElement | null;
  /** Keep frames flowing to canvas.captureStream while recording video. */
  recording?: boolean;
  onRenderFrame?: () => void;
  onOpenSemanticLabels?: () => void;
  collision?: import('@/contracts').CollisionLayer;
  showCollision?: boolean;
  isolateCollision?: boolean;
  selectedCollisionId?: string;
  landmarkMode?: boolean;
  landmarks?: SceneLandmark[];
  activeLandmarkId?: string | null;
  hideLandmarks?: boolean;
  preview?: { region: ViewportRegion; cameraId: string; pose: CameraPose | null } | null;
  onLandmarkSelect?: (id: string) => void;
  onLandmark?: (landmark: SceneLandmark) => void;
  onLandmarkHint?: (hint: string) => void;
  onModelStatus?: (models: ModelLoadStatus[]) => void;
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
  /** The effective look (null keeps the scene's own lighting and no post-processing). */
  look?: LookSettings | null;
  /** Title cards drawn over the shot camera. */
  titles?: TitleCard[];
  /** Timeline length in seconds, for fades. */
  timelineSeconds?: number;
};
export type { ShotSnapshot };
