import type { SemanticLayer, SemanticRegion, SemanticSnapshot } from '../../contracts/semantics';
import type { ProjectDocument, Vector3Tuple } from '../../contracts';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const vector = (v: unknown): v is Vector3Tuple => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10000);
const strings = (v: unknown, max: number, length = 500): v is string[] => Array.isArray(v) && v.length > 0 && v.length <= max && v.every(s => text(s, length)) && new Set(v).size === v.length;
export const semanticRevision = (project: Pick<ProjectDocument, 'sceneId' | 'placements'>) => JSON.stringify({ sceneId: project.sceneId, placements: [...(project.placements ?? [])].sort((a, b) => a.id.localeCompare(b.id)) });

export function validateSemanticLayer(value: unknown): SemanticLayer {
  if (!record(value) || value.version !== 1 || !text(value.sceneId, 120) || !text(value.revision, 100000) || !Array.isArray(value.regions) || value.regions.length > 80) throw new Error('Invalid semantic layer.');
  const ids = new Set<string>();
  for (const r of value.regions) {
    if (!record(r) || !text(r.id, 120) || ids.has(r.id) || !text(r.label, 80) || !text(r.category, 50) || !strings(r.entityIds, 200) || !vector(r.min) || !vector(r.max) || r.min.some((n, a) => n > (r.max as number[])[a]) || typeof r.confidence !== 'number' || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1 || !text(r.evidence, 800) || !strings(r.viewIds, 4, 60) || typeof r.reviewed !== 'boolean') throw new Error('Invalid semantic region.');
    ids.add(r.id);
  }
  return structuredClone(value) as SemanticLayer;
}

export function parseSemanticSnapshot(value: unknown): SemanticSnapshot {
  if (!record(value) || !text(value.sceneId, 120) || !text(value.revision, 100000) || !Array.isArray(value.candidates) || !value.candidates.length || value.candidates.length > 200 || !Array.isArray(value.views) || value.views.length < 2 || value.views.length > 4) throw new Error('Capture two to four scene views first.');
  const ids = new Set<string>();
  for (const c of value.candidates) {
    if (!record(c) || !text(c.id, 500) || ids.has(c.id) || !text(c.name, 500) || !Array.isArray(c.materials) || c.materials.length > 30 || !c.materials.every(m => text(m, 200)) || !vector(c.min) || !vector(c.max) || c.min.some((n, a) => n > (c.max as number[])[a])) throw new Error('Invalid scene geometry.');
    ids.add(c.id);
  }
  const views = new Set<string>();
  for (const view of value.views) {
    if (!record(view) || !text(view.id, 60) || views.has(view.id) || typeof view.image !== 'string' || view.image.length > 2_000_000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(view.image) || !Array.isArray(view.objects) || view.objects.length > 200) throw new Error('Invalid scene image.');
    views.add(view.id);
    for (const o of view.objects) if (!record(o) || !ids.has(o.id as string) || !Number.isInteger(o.number) || typeof o.x !== 'number' || typeof o.y !== 'number' || !Number.isFinite(o.x) || !Number.isFinite(o.y) || o.x < 0 || o.x > 1 || o.y < 0 || o.y > 1) throw new Error('Invalid image-to-object mapping.');
  }
  return value as SemanticSnapshot;
}

/** The model chooses identities; all world bounds are computed from measured geometry. */
export function groundSemanticProposal(value: unknown, snapshot: SemanticSnapshot): SemanticLayer {
  if (!record(value) || !Array.isArray(value.regions) || value.regions.length > 80) throw new Error('AI returned invalid regions.');
  const candidates = new Map(snapshot.candidates.map(c => [c.id, c]));
  const regions: SemanticRegion[] = value.regions.map((r: unknown, index: number) => {
    if (!record(r) || !strings(r.entityIds, 200) || !strings(r.viewIds, 4, 60)) throw new Error('AI returned invalid region references.');
    const entityIds = r.entityIds, viewIds = r.viewIds;
    const members = entityIds.map(id => { const c = candidates.get(id); if (!c) throw new Error(`AI referenced an unknown object: ${id}`); return c; });
    for (const id of viewIds) if (!snapshot.views.some(v => v.id === id)) throw new Error('AI referenced an unknown view.');
    for (const id of entityIds) if (!snapshot.views.some(v => viewIds.includes(v.id) && v.objects.some(o => o.id === id))) throw new Error('A labeled object has no supporting view.');
    return { id: `semantic:${index + 1}`, label: r.label as string, category: r.category as string, entityIds,
      min: [0, 1, 2].map(a => Math.min(...members.map(m => m.min[a]))) as Vector3Tuple,
      max: [0, 1, 2].map(a => Math.max(...members.map(m => m.max[a]))) as Vector3Tuple,
      confidence: r.confidence as number, evidence: r.evidence as string, viewIds, reviewed: false };
  });
  return validateSemanticLayer({ version: 1, sceneId: snapshot.sceneId, revision: snapshot.revision, regions });
}
