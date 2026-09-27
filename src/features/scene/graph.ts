import { sourceTime } from './timing';
import type { ProjectDocument, SceneManifest, Vector3Tuple } from '../../contracts';
import { Quaternion, Vector3 } from 'three';

export type GraphBounds = { min: Vector3Tuple; max: Vector3Tuple };
export type GraphNode = {
  id: string;
  kind: 'scene' | 'mesh' | 'collection' | 'camera' | 'actor' | 'prop' | 'landmark';
  label: string;
  category?: string;
  position?: Vector3Tuple;
  bounds?: GraphBounds;
  geometry?: { asset: string; entityId: string; role: 'render-mesh' };
  visual?: { kind: 'primitive' | 'model'; shape?: string; modelUid?: string; size?: number; rotation?: Vector3Tuple };
  collisionProxy?: { kind: 'oriented-box'; size: Vector3Tuple };
  semanticSource: 'blender-name' | 'project' | 'scene';
  /** Generic Blender names describe geometry but do not identify an object. */
  needsSemanticLabel?: boolean;
};
export type GraphEdge = { from: string; to: string; kind: 'contains' | 'attached-to' | 'targets' | 'marks'; offset?: Vector3Tuple; yaw?: number };
export type GraphKey = { time: number; position: Vector3Tuple; forward?: Vector3Tuple; heading?: number; pan?: number; tilt?: number; roll?: number; focalLength?: number; target?: Vector3Tuple };
export type GraphTrack = { targetId: string; kind: 'actor-pose' | 'source-camera' | 'draft-camera'; keys: GraphKey[]; timing: 'shot-seconds' | 'source-seconds' };
export type SceneGraph = { version: 1; sceneId: string; coordinateSpace: 'Y-up metres'; nodes: GraphNode[]; edges: GraphEdge[]; tracks: GraphTrack[]; coverage: { bounds: 'measured-when-available'; connectivity: 'unverified'; collider: 'uncomputed' } };

const web = (source: Vector3Tuple): Vector3Tuple => [source[0], source[2], -source[1]];
const move = (point: Vector3Tuple, offset: Vector3Tuple): Vector3Tuple => point.map((value, axis) => value + offset[axis]) as Vector3Tuple;
const cameraForward = (source: [number, number, number, number]): Vector3Tuple => web(new Vector3(0, 0, -1).applyQuaternion(new Quaternion(...source)).toArray());

/** Build an exportable snapshot from source metadata and current project edits. No renderer objects are stored. */
export function buildSceneGraph(manifest: SceneManifest, project: ProjectDocument, measuredBounds?: (id: string) => GraphBounds | null): SceneGraph {
  if (project.sceneId !== (manifest.id ?? 'pavilion-v1')) throw new Error('The project and scene graph must use the same asset.');
  const sceneId = `scene:${project.sceneId}`;
  const asset = manifest.asset?.url ?? '/scenes/pavilion.glb';
  const offsets = new Map((project.placements ?? []).map(placement => [placement.id, placement.offset]));
  const nodes: GraphNode[] = [{ id: sceneId, kind: 'scene', label: manifest.name, semanticSource: 'scene' }];
  const edges: GraphEdge[] = [];
  const tracks: GraphTrack[] = [];
  const add = (node: GraphNode) => { nodes.push(node); edges.push({ from: sceneId, to: node.id, kind: 'contains' }); };

  for (const entity of manifest.objects) {
    const offset: Vector3Tuple = offsets.get(entity.id) ?? [0, 0, 0];
    const camera = entity.type === 'Camera';
    const bounds = camera ? null : measuredBounds?.(entity.id);
    add({ id: entity.id, kind: camera ? 'camera' : entity.type === 'Collection' ? 'collection' : 'mesh', label: entity.name, category: entity.category,
      position: move(entity.positionWeb, offset), ...(bounds ? { bounds } : {}),
      ...(entity.type === 'Mesh' && manifest.asset?.kind !== 'gsplat' ? { geometry: { asset, entityId: entity.id, role: 'render-mesh' as const } } : {}),
      semanticSource: 'blender-name', ...(/^(Cube|Plane|Cylinder)(\.\d+)?$/.test(entity.name) ? { needsSemanticLabel: true } : {}) });
    if (camera && entity.samples?.length) tracks.push({ targetId: entity.id, kind: 'source-camera', timing: 'source-seconds',
      keys: entity.samples.map(sample => ({ time: sourceTime(sample.frame, manifest), position: web(sample.position), forward: cameraForward(sample.quaternion), ...(entity.lens ? { focalLength: entity.lens } : {}) })) });
  }

  for (const actor of project.actors) {
    add({ id: actor.id, kind: 'actor', label: actor.name, category: 'Actor', position: [...actor.marks[0].position],
      ...(actor.model ? { visual: { kind: 'model' as const, modelUid: actor.model.uid } } : {}),
      collisionProxy: { kind: 'oriented-box', size: [actor.height * .36, actor.height, actor.height * .32] }, semanticSource: 'project' });
    tracks.push({ targetId: actor.id, kind: 'actor-pose', timing: 'shot-seconds', keys: actor.marks.map(mark => ({ time: mark.time, position: [...mark.position], heading: mark.heading })) });
  }
  for (const prop of project.props ?? []) {
    add({ id: prop.id, kind: 'prop', label: prop.name, category: 'Prop', position: [...prop.position],
      visual: { kind: prop.source.kind, ...(prop.source.kind === 'primitive' ? { shape: prop.source.shape } : { modelUid: prop.source.uid }), size: prop.size, rotation: [...prop.rotation] }, semanticSource: 'project' });
    if (prop.attachment) edges.push({ from: prop.id, to: prop.attachment.actorId, kind: 'attached-to', offset: [...prop.attachment.offset], yaw: prop.attachment.yaw });
  }
  for (const landmark of project.landmarks ?? []) {
    add({ id: landmark.id, kind: 'landmark', label: landmark.label, position: [...landmark.position], semanticSource: 'project' });
    if (landmark.entityId) edges.push({ from: landmark.id, to: landmark.entityId, kind: 'marks' });
  }
  if (project.shot) {
    const shot = project.shot, id = 'shot:current';
    add({ id, kind: 'camera', label: shot.name, position: [shot.marks[0].position.x, shot.marks[0].position.y, shot.marks[0].position.z], semanticSource: 'project' });
    edges.push({ from: id, to: shot.subjectId, kind: 'targets' });
    const keys = shot.cinemaTraj ? shot.cinemaTraj.positions.map((point, index) => ({ time: point.time, position: [...point.position] as Vector3Tuple, target: [...shot.cinemaTraj!.targets[index].position] as Vector3Tuple }))
      : shot.marks.map(mark => ({ time: mark.time, position: [mark.position.x, mark.position.y, mark.position.z] as Vector3Tuple, pan: mark.pan, tilt: mark.tilt, roll: mark.roll, focalLength: mark.focalLength, target: [...shot.target] as Vector3Tuple }));
    tracks.push({ targetId: id, kind: 'draft-camera', timing: 'shot-seconds', keys });
  }
  return { version: 1, sceneId: project.sceneId, coordinateSpace: 'Y-up metres', nodes, edges, tracks,
    coverage: { bounds: 'measured-when-available', connectivity: 'unverified', collider: 'uncomputed' } };
}
