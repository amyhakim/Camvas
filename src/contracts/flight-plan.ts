import type { ActorMark, Vector3Tuple } from './index';

export type FlightLandmark = { id: string; label: string; position: Vector3Tuple };
export type FlightPlanningSnapshot = {
  sceneId: string;
  revision: string;
  landmarks: FlightLandmark[];
  nodes: { id: string; label: string; kind: string; category?: string; position?: Vector3Tuple; bounds?: { min: Vector3Tuple; max: Vector3Tuple } }[];
  edges: { from: string; to: string; kind: string; order?: number }[];
  actors: { id: string; name: string; marks: ActorMark[] }[];
  currentShot: { name: string; subjectId: string; duration: number; anchorIds: string[] } | null;
  collisionCoverage: 'uncomputed' | 'partial' | 'complete';
};
export type FlightPlanWaypoint = {
  landmarkId: string;
  beat: string;
  arrivalTime: number;
  gazeTargetId: string | null;
  gazeNote: string;
  blocking: string;
  uncertainty: string;
};
export type FlightPlanProposal = {
  sceneId: string;
  revision: string;
  arc: string;
  waypoints: FlightPlanWaypoint[];
  reviewNotes: string[];
};

/** A stable, small revision token for stale-proposal checks; this is not an authorization token. */
export function flightSnapshotRevision(value: unknown): string {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const shortText = (value: unknown, max = 300): value is string => typeof value === 'string' && value.length <= max;

/** The proposal must visit every supplied landmark exactly once, in source order. */
export function parseFlightPlan(value: unknown, snapshot: FlightPlanningSnapshot): FlightPlanProposal {
  if (!record(value) || !shortText(value.arc, 700) || !value.arc.trim() || !Array.isArray(value.waypoints) || value.waypoints.length !== snapshot.landmarks.length || !Array.isArray(value.reviewNotes) || value.reviewNotes.length > 8 || !value.reviewNotes.every(note => shortText(note, 300))) {
    throw new Error('Astra returned an incomplete flight plan.');
  }
  const targetIds = new Set([...snapshot.nodes.map(node => node.id), ...snapshot.actors.map(actor => actor.id)]);
  let previousTime = -1;
  const waypoints: FlightPlanWaypoint[] = value.waypoints.map((raw, index) => {
    if (!record(raw) || raw.landmarkId !== snapshot.landmarks[index].id || typeof raw.arrivalTime !== 'number' || !Number.isFinite(raw.arrivalTime) || raw.arrivalTime < 0 || raw.arrivalTime > 60 || raw.arrivalTime <= previousTime || !shortText(raw.beat, 120) || !raw.beat.trim() || !shortText(raw.gazeNote) || !shortText(raw.blocking) || !shortText(raw.uncertainty) || (raw.gazeTargetId !== null && (typeof raw.gazeTargetId !== 'string' || !targetIds.has(raw.gazeTargetId)))) {
      throw new Error(`Astra's flight plan has an invalid waypoint at ${snapshot.landmarks[index].label}.`);
    }
    previousTime = raw.arrivalTime;
    return {
      landmarkId: raw.landmarkId as string,
      beat: raw.beat as string,
      arrivalTime: raw.arrivalTime as number,
      gazeTargetId: raw.gazeTargetId as string | null,
      gazeNote: raw.gazeNote as string,
      blocking: raw.blocking as string,
      uncertainty: raw.uncertainty as string,
    };
  });
  return { sceneId: snapshot.sceneId, revision: snapshot.revision, arc: value.arc, waypoints, reviewNotes: value.reviewNotes as string[] };
}
