import type { ProjectDocument, SceneManifest, ViewportHandle } from '../contracts';
import { parseAutomaticSnapshot, type AutomaticFlightSnapshot } from '../contracts/automatic-flight';
import { flightSnapshotRevision } from '../contracts/flight-plan';
import { containsPoint, placedCollision, validateCollisionLayer } from '../features/collision/model';
import { semanticRevision } from '../features/semantics/model';
export function automaticSceneRevision(p: ProjectDocument): string {
  return flightSnapshotRevision({ sceneId: p.sceneId, semantics: p.semantics, placements: p.placements, actors: p.actors, props: p.props, collision: p.collision });
}
export function automaticFlightSnapshot(project: ProjectDocument, manifest: SceneManifest, viewport: ViewportHandle, intent: string): AutomaticFlightSnapshot {
  if (project.sceneId !== (manifest.id ?? 'pavilion-v1')) throw Error('Scene is still loading.');
  const splat = manifest.asset?.kind === 'gsplat';
  let navigation: ReturnType<typeof placedCollision> | undefined;
  if (splat) {
    if (!project.collision?.reviewed) throw Error('Review navigation boxes in Project before planning a splat route.');
    const collision = validateCollisionLayer(project.collision);
    if (collision.sourceUrl !== manifest.asset!.url || !manifest.objects.some(o => o.type === 'Splat' && o.id === collision.entityId)) throw Error('Navigation boxes do not match this capture. Regenerate them.');
    navigation = placedCollision(collision, project.placements ?? []);
  }
  if (project.actors.length || project.props?.length || manifest.objects.some(o => o.type !== 'Camera' && o.animated)) throw Error('Actors, props or animated geometry need time-aware clearance; automatic saving is unavailable for this scene.');
  const layer = project.semantics;
  if (!layer || layer.revision !== semanticRevision(project)) throw Error('Generate and review up-to-date semantic labels first.');
  const subjects = layer.regions.filter(r => r.reviewed).map(r => ({ id: r.id, label: r.label, entityId: r.entityIds[0], min: r.min, max: r.max }));
  const ids = new Set(manifest.objects.filter(o => o.type !== 'Camera').map(o => o.id));
  if (subjects.some(s => !ids.has(s.entityId))) throw Error('A labeled subject is missing from the scene.');
  const obstacles = navigation?.boxes ?? viewport.captureRouteMapGeometry();
  if (obstacles.length >= 1500) throw Error('Scene exceeds the geometry capture limit; no partial-geometry auto-approval.');
  const start = viewport.viewState()?.position;
  if (!start) throw Error('Wait for the viewport.');
  if (navigation && !containsPoint(navigation.region, start, .31)) throw Error('Move the camera inside the reviewed navigation area, or generate and review boxes around the current view.');
  return parseAutomaticSnapshot({ sceneId: project.sceneId, revision: flightSnapshotRevision({ scene: automaticSceneRevision(project), intent }), intent, subjects, obstacles, start, ...(navigation ? { geometryKind: 'splat-proxies', coverage: navigation.region } : {}) });
}
