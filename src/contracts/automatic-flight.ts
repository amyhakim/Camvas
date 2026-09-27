import type { Vector3Tuple } from './index';

export type FlightBounds = { min: Vector3Tuple; max: Vector3Tuple };
export type FlightSubject = FlightBounds & { id: string; label: string; entityId: string };
export type AutomaticFlightSnapshot = {
  sceneId: string; revision: string; intent: string;
  subjects: FlightSubject[]; obstacles: FlightBounds[];
  start: Vector3Tuple;
  /** Reviewed local proxies still have partial coverage; never navigate outside this region. */
  geometryKind?: 'splat-proxies'; coverage?: FlightBounds;
};
export type AutomaticFlightPlan = {
  name: string; narrative: string;
  controls: { position: Vector3Tuple; gazeTargetId: string; gazeMode: 'ahead' | 'subject' }[];
  beats: { label: string; controlIndex: number; targetId: string }[];
  cruiseSpeed: number; focalLength: number; finalFocalLength: number; zoomSeconds: number;
  uncertainties: string[];
};
export type FlightEvidence = { time: number; image: string };
export type FlightVisualReview = { approved: boolean; notes: string[] };
export const DEFAULT_FLIGHT_INTENT = 'Create a smooth architectural drone tour: establish the exterior, enter through a geometry-supported opening if available, reveal interior seating or hero features, exit toward water or outdoor space, and settle into a gentle zoom. Reuse the same opening if necessary. Never cross glass. Adapt these beats to the available subjects; report unavailable requested features.';

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 500): v is string => typeof v === 'string' && !!v.trim() && v.length <= max;
const finite = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const vector = (v: unknown): v is Vector3Tuple => Array.isArray(v) && v.length === 3 && v.every(x => finite(x, -1000, 1000));
const bounds = (v: unknown): v is FlightBounds => obj(v) && vector(v.min) && vector(v.max) && v.min.every((x, i) => x <= (v.max as Vector3Tuple)[i]);
const strings = (v: unknown, max: number): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => text(x));

export function parseAutomaticSnapshot(v: unknown): AutomaticFlightSnapshot {
  if (!obj(v) || !text(v.sceneId, 120) || !text(v.revision, 120) || !text(v.intent, 2000) || !vector(v.start)
    || !Array.isArray(v.subjects) || !v.subjects.length || v.subjects.length > 80
    || !v.subjects.every(s => obj(s) && text(s.id) && text(s.entityId) && text(s.label) && bounds(s))
    || !Array.isArray(v.obstacles) || !v.obstacles.length || v.obstacles.length > 1500 || !v.obstacles.every(bounds)) throw Error('Measured scene geometry and reviewed subjects are required.');
  if (v.geometryKind !== undefined && v.geometryKind !== 'splat-proxies') throw Error('Unknown navigation geometry.');
  if ((v.geometryKind === 'splat-proxies') !== (v.coverage !== undefined) || (v.coverage !== undefined && (!bounds(v.coverage) || v.coverage.min.some((n, a) => n >= (v.coverage as FlightBounds).max[a])))) throw Error('Splat navigation requires a bounded reviewed coverage region.');
  if (new Set(v.subjects.map(s => s.id)).size !== v.subjects.length) throw Error('Duplicate subjects.');
  return { sceneId: v.sceneId, revision: v.revision, intent: v.intent, start: v.start,
    ...(v.geometryKind === 'splat-proxies' ? { geometryKind: 'splat-proxies' as const, coverage: { min: [...(v.coverage as FlightBounds).min] as Vector3Tuple, max: [...(v.coverage as FlightBounds).max] as Vector3Tuple } } : {}),
    subjects: (v.subjects as FlightSubject[]).map(s => ({ id: s.id, entityId: s.entityId, label: s.label, min: s.min, max: s.max })), obstacles: v.obstacles.map(b => ({ min: b.min, max: b.max })) };
}

export function parseAutomaticPlan(v: unknown, snapshot: AutomaticFlightSnapshot): AutomaticFlightPlan {
  const ids = new Set(snapshot.subjects.map(s => s.id));
  if (!obj(v) || !text(v.name, 100) || !text(v.narrative, 1000) || !Array.isArray(v.controls) || v.controls.length < 3 || v.controls.length > 48
    || !v.controls.every(c => obj(c) && vector(c.position) && typeof c.gazeTargetId === 'string' && ids.has(c.gazeTargetId) && ['ahead', 'subject'].includes(c.gazeMode as string))
    || !Array.isArray(v.beats) || v.beats.length < 2 || v.beats.length > 5
    || !finite(v.cruiseSpeed, .3, 2) || !finite(v.focalLength, 16, 35) || !finite(v.finalFocalLength, 16, 85) || !finite(v.zoomSeconds, 4, 10)
    || !strings(v.uncertainties, 8)) throw Error('Astra returned an invalid intent-based route.');
  const controls = v.controls as AutomaticFlightPlan['controls'];
  let previous = -1;
  for (const b of v.beats) {
    if (!obj(b) || !text(b.label, 160) || !Number.isInteger(b.controlIndex) || !finite(b.controlIndex, 0, controls.length - 1) || b.controlIndex <= previous || typeof b.targetId !== 'string' || !ids.has(b.targetId)) throw Error('Invalid beat order or target.');
    previous = b.controlIndex;
  }
  if (v.beats[0].controlIndex !== 0 || v.beats.at(-1).controlIndex !== controls.length - 1) throw Error('Beats must cover the complete route.');
  for (let i = 1; i < controls.length; i++) if (Math.hypot(...controls[i].position.map((n, a) => n - controls[i - 1].position[a])) < .05) throw Error('Consecutive route positions are too close.');
  return { name: v.name, narrative: v.narrative, controls: controls.map(c => ({ position: [...c.position], gazeTargetId: c.gazeTargetId, gazeMode: c.gazeMode })),
    beats: v.beats.map(b => ({ label: b.label, controlIndex: b.controlIndex, targetId: b.targetId })), cruiseSpeed: v.cruiseSpeed,
    focalLength: v.focalLength, finalFocalLength: v.finalFocalLength, zoomSeconds: v.zoomSeconds, uncertainties: [...v.uncertainties] };
}

export function parseFlightEvidence(v: unknown): FlightEvidence[] {
  if (!Array.isArray(v) || v.length < 3 || v.length > 12 || !v.every(f => obj(f) && finite(f.time, 0, 60) && typeof f.image === 'string' && f.image.length < 900000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f.image))) throw Error('Rendered flight evidence is required.');
  let prior = -1;
  for (const f of v) { if (f.time <= prior) throw Error('Evidence times must increase.'); prior = f.time; }
  return v.map(f => ({ time: f.time, image: f.image }));
}
export function parseVisualReview(v: unknown): FlightVisualReview {
  if (!obj(v) || typeof v.approved !== 'boolean' || !strings(v.notes, 8)) throw Error('Invalid visual review.');
  return { approved: v.approved, notes: [...v.notes] };
}
