import type { ProjectDocument } from '@/contracts';
import { flightSnapshotRevision, type FlightPlanningSnapshot } from '@/contracts/flight-plan';
import type { SceneGraph } from '@/features/scene';

/** Consume the scene graph produced by the scene owner; this planner never labels or fills it. */
export function flightPlanningSnapshot(graph: SceneGraph, project: ProjectDocument): FlightPlanningSnapshot | null {
  const landmarkNodes = new Map(graph.nodes.filter(node => node.kind === 'landmark' && node.category === 'Flight waypoint').map(node => [node.id, node]));
  const orderedIds = graph.edges.filter(edge => edge.kind === 'planned-via').sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map(edge => edge.to);
  const ids = orderedIds.length ? orderedIds : [...landmarkNodes.keys()];
  const landmarks = ids.flatMap(id => {
    const node = landmarkNodes.get(id);
    return node?.position ? [{ id, label: node.label, position: node.position }] : [];
  });
  if (landmarks.length < 2) return null;
  const content = {
    sceneId: graph.sceneId,
    landmarks,
    nodes: graph.nodes.filter(node => node.kind !== 'landmark' && node.kind !== 'scene').map(({ id, label, kind, category, position, bounds }) => ({ id, label, kind, ...(category ? { category } : {}), ...(position ? { position } : {}), ...(bounds ? { bounds } : {}) })),
    edges: graph.edges.filter(edge => edge.kind !== 'contains').map(({ from, to, kind, order }) => ({ from, to, kind, ...(order === undefined ? {} : { order }) })),
    actors: graph.tracks.filter(track => track.kind === 'actor-pose').map(track => ({
      id: track.targetId,
      name: graph.nodes.find(node => node.id === track.targetId)?.label ?? track.targetId,
      marks: track.keys.map(key => ({ time: key.time, position: key.position, heading: key.heading ?? 0 })),
    })),
    currentShot: project.shot ? { name: project.shot.name, subjectId: project.shot.subjectId, duration: project.shot.settings.duration, anchorIds: project.shot.anchorIds ?? [] } : null,
    collisionCoverage: graph.coverage.collider,
  };
  return { ...content, revision: flightSnapshotRevision(content) };
}
