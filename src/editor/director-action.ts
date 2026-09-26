import type { SceneEntity } from '../contracts';

export type DirectorAction =
  | { type: 'generateShot'; targetId: string; presetId: string; duration: number; focalLength: number; framing: 'wide' | 'full' | 'detail' }
  | { type: 'moveObject'; targetId: string; delta: [number, number, number] }
  | { type: 'selectObject' | 'selectCamera'; targetId: string }
  | { type: 'seek'; frame: number }
  | { type: 'play' | 'pause' | 'discardShot' | 'frameSelection' };

type ActionFields = { type?: unknown; targetId?: unknown; presetId?: unknown; duration?: unknown; focalLength?: unknown; framing?: unknown; delta?: unknown; frame?: unknown };

export function validateDirectorAction(raw: unknown, objects: SceneEntity[], presetIds: string[], frameEnd: number): DirectorAction | null {
  if (!raw || typeof raw !== 'object') throw new Error('Codex returned an invalid scene action.');
  const action = raw as ActionFields;
  if (action.type === 'none') return null;
  if (['play', 'pause', 'discardShot', 'frameSelection'].includes(String(action.type))) return { type: action.type as 'play' | 'pause' | 'discardShot' | 'frameSelection' };
  if (action.type === 'seek') {
    if (typeof action.frame !== 'number' || !Number.isInteger(action.frame) || action.frame < 1 || action.frame > frameEnd) throw new Error('Codex chose a frame outside the timeline.');
    return { type: 'seek', frame: action.frame };
  }
  const target = objects.find(object => object.id === action.targetId);
  if (!target) throw new Error('Codex chose an object that is not in this scene.');
  if (action.type === 'selectCamera') {
    if (target.type !== 'Camera') throw new Error('Codex chose an object instead of a camera.');
    return { type: 'selectCamera', targetId: target.id };
  }
  if (action.type === 'selectObject') {
    return { type: 'selectObject', targetId: target.id };
  }
  if (target.type === 'Camera') throw new Error('Choose scene geometry for this action.');
  if (action.type === 'moveObject') {
    if (!Array.isArray(action.delta) || action.delta.length !== 3 || !action.delta.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 10)) throw new Error('Object movement must be a finite XYZ offset within 10 metres per axis.');
    return { type: 'moveObject', targetId: target.id, delta: action.delta as [number, number, number] };
  }
  if (action.type === 'generateShot') {
    if (typeof action.presetId !== 'string' || !presetIds.includes(action.presetId)) throw new Error('Codex chose an unknown camera move.');
    if (typeof action.duration !== 'number' || !Number.isFinite(action.duration) || action.duration < 1 || action.duration > 60) throw new Error('Camera move duration must be 1–60 seconds.');
    if (typeof action.focalLength !== 'number' || !Number.isFinite(action.focalLength) || action.focalLength < 8 || action.focalLength > 300) throw new Error('Camera lens must be 8–300 mm.');
    if (action.framing !== 'wide' && action.framing !== 'full' && action.framing !== 'detail') throw new Error('Codex chose an unknown framing.');
    return { type: 'generateShot', targetId: target.id, presetId: action.presetId, duration: action.duration, focalLength: action.focalLength, framing: action.framing };
  }
  throw new Error('Codex returned an unsupported scene action.');
}
