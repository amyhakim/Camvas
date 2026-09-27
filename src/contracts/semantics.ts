import type { Vector3Tuple } from './index';

export type SemanticCandidate = { id: string; name: string; materials: string[]; min: Vector3Tuple; max: Vector3Tuple };
export type SemanticView = { id: string; image: string; objects: { id: string; number: number; x: number; y: number }[] };
export type SemanticSnapshot = { sceneId: string; revision: string; candidates: SemanticCandidate[]; views: SemanticView[] };
export type SemanticRegion = {
  id: string; label: string; category: string; entityIds: string[];
  min: Vector3Tuple; max: Vector3Tuple; confidence: number;
  evidence: string; viewIds: string[]; reviewed: boolean;
};
export type SemanticLayer = { version: 1; sceneId: string; revision: string; regions: SemanticRegion[] };
