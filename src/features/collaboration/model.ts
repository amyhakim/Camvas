import type { CameraShot, ViewMode } from '../../contracts';

export type CollaborationSceneState = {
  selectedId: string | null;
  cameraId: string;
  mode: ViewMode;
  frame: number;
  playing: boolean;
  showPath: boolean;
  shot: CameraShot | null;
};

export type Collaborator = {
  clientId: number;
  id: string;
  name: string;
  color: string;
  selectedId: string | null;
  cursor: { x: number; y: number } | null;
  local: boolean;
};

export const COLLABORATION_COLORS = ['#edc58c', '#8dc8ff', '#ff98b8', '#9be3b1', '#cbb1ff', '#ffd56a'];
export const SCENE_STATE_KEYS: (keyof CollaborationSceneState)[] = ['selectedId', 'cameraId', 'mode', 'frame', 'playing', 'showPath', 'shot'];

export function createRoomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return Math.random().toString(36).slice(2, 14);
}

export function normalizeRoomId(value: string | null | undefined) {
  const room = value?.trim().toLowerCase();
  return room && /^[a-z0-9_-]{6,64}$/.test(room) ? room : null;
}

export function defaultCollaborator(id: string) {
  const suffix = id.slice(-4).toUpperCase();
  const hash = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return { id, name: `Builder ${suffix}`, color: COLLABORATION_COLORS[hash % COLLABORATION_COLORS.length] };
}

export function normalizeCollaboratorName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ');
  return name.slice(0, 32) || 'Anonymous builder';
}

export function isViewMode(value: unknown): value is ViewMode {
  return value === 'orbit' || value === 'fly' || value === 'shot';
}

export function readSharedSceneState(values: Map<string, unknown>): Partial<CollaborationSceneState> {
  const state: Partial<CollaborationSceneState> = {};
  const selectedId = values.get('selectedId');
  if (selectedId === null || typeof selectedId === 'string') state.selectedId = selectedId;
  const cameraId = values.get('cameraId');
  if (typeof cameraId === 'string' && cameraId) state.cameraId = cameraId;
  const mode = values.get('mode');
  if (isViewMode(mode)) state.mode = mode;
  const frame = values.get('frame');
  if (typeof frame === 'number' && Number.isFinite(frame)) state.frame = Math.max(1, Math.round(frame));
  const playing = values.get('playing');
  if (typeof playing === 'boolean') state.playing = playing;
  const showPath = values.get('showPath');
  if (typeof showPath === 'boolean') state.showPath = showPath;
  const shot = values.get('shot');
  if (shot === null || (typeof shot === 'object' && shot !== null)) state.shot = shot as CameraShot | null;
  return state;
}

export function readCollaborators(states: Map<number, Record<string, unknown>>, localClientId: number): Collaborator[] {
  return [...states.entries()].flatMap(([clientId, state]) => {
    const user = state.user;
    if (!user || typeof user !== 'object') return [];
    const data = user as Record<string, unknown>;
    if (typeof data.id !== 'string' || typeof data.name !== 'string' || typeof data.color !== 'string') return [];
    const cursor = state.cursor;
    const point = cursor && typeof cursor === 'object' && Number.isFinite((cursor as { x?: number }).x) && Number.isFinite((cursor as { y?: number }).y)
      ? { x: Math.max(0, Math.min(1, Number((cursor as { x: number }).x))), y: Math.max(0, Math.min(1, Number((cursor as { y: number }).y))) }
      : null;
    return [{ clientId, id: data.id, name: normalizeCollaboratorName(data.name), color: data.color, selectedId: typeof state.selectedId === 'string' ? state.selectedId : null, cursor: point, local: clientId === localClientId }];
  }).sort((a, b) => Number(b.local) - Number(a.local) || a.name.localeCompare(b.name));
}
