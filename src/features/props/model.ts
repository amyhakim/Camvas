import type { ModelSource, PropShape, SceneProp, Vector3Tuple } from '../../contracts';

export const MAX_PROPS = 32;
export const MIN_PROP_SIZE = .02;
export const MAX_PROP_SIZE = 50;
export const PROP_SHAPES: readonly PropShape[] = ['box', 'sphere', 'cylinder', 'cone', 'capsule', 'plane'];
/** Free Creative Commons licences the owner allows the Director to import. Store-bought licences are excluded. */
export const MODEL_LICENSES = ['cc0', 'by', 'by-sa', 'by-nd', 'by-nc', 'by-nc-sa', 'by-nc-nd'] as const;
const SKETCHFAB_UID = /^[a-f0-9]{32}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const PROP_ID = /^prop:[A-Za-z0-9_-]{1,64}$/;

function finiteVector(value: readonly number[], limit: number) { return value.length === 3 && value.every(v => Number.isFinite(v) && Math.abs(v) <= limit); }
function httpsUrl(value: string, hosts: string[]) {
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)); } catch { return false; }
}

/** Attribution is displayed to the user; accept only plain text and links back to the licence or Sketchfab. */
export function validateModelSource(source: ModelSource): void {
  if (source.provider !== 'sketchfab' || !SKETCHFAB_UID.test(source.uid)) throw new Error('Model reference must be a Sketchfab model ID.');
  for (const [field, value] of [['name', source.name], ['author', source.author], ['license', source.license]] as const) {
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error(`Model ${field} must be 1–200 characters.`);
  }
  if (!httpsUrl(source.viewerUrl, ['sketchfab.com']) || !httpsUrl(source.authorUrl, ['sketchfab.com'])) throw new Error('Model links must point to Sketchfab.');
  if (!httpsUrl(source.licenseUrl.replace(/^http:/, 'https:'), ['creativecommons.org', 'sketchfab.com'])) throw new Error('Model licence link must point to Creative Commons or Sketchfab.');
}

export function validateProp(prop: SceneProp): void {
  if (!PROP_ID.test(prop.id)) throw new Error('Prop ID must look like prop:name.');
  if (typeof prop.name !== 'string' || !prop.name.trim() || prop.name.length > 100) throw new Error('Use a prop name between 1 and 100 characters.');
  if (prop.source.kind === 'primitive') { if (!PROP_SHAPES.includes(prop.source.shape)) throw new Error('Choose a supported prop shape.'); }
  else if (prop.source.kind === 'model') validateModelSource(prop.source);
  else throw new Error('Unknown prop source.');
  if (!finiteVector(prop.position, 1000)) throw new Error('Prop position must be between −1000 and 1000 m.');
  if (!finiteVector(prop.rotation, Math.PI * 4)) throw new Error('Prop rotation must be a finite angle.');
  if (!Number.isFinite(prop.size) || prop.size < MIN_PROP_SIZE || prop.size > MAX_PROP_SIZE) throw new Error(`Prop size must be ${MIN_PROP_SIZE}–${MAX_PROP_SIZE} m.`);
  if (prop.color !== undefined && !HEX.test(prop.color)) throw new Error('Prop tint must be a six-digit hex color.');
  if (prop.attachment && (!/^actor:[A-Za-z0-9_-]{1,200}$/.test(prop.attachment.actorId) || !finiteVector(prop.attachment.offset, 1000) || !Number.isFinite(prop.attachment.yaw) || Math.abs(prop.attachment.yaw) > Math.PI * 4)) throw new Error('Prop attachment needs a valid actor, offset, and yaw.');
}

export function validateProps(props: SceneProp[]): void {
  if (props.length > MAX_PROPS) throw new Error(`Keep at most ${MAX_PROPS} props in a project.`);
  props.forEach(validateProp);
  if (new Set(props.map(prop => prop.id)).size !== props.length) throw new Error('Prop IDs must be unique.');
}

export function createProp(id: string, name: string, source: SceneProp['source'], position: Vector3Tuple, options: { rotation?: Vector3Tuple; size?: number; color?: string } = {}): SceneProp {
  const prop: SceneProp = { id, name: name.trim().slice(0, 100), source, position: [...position], rotation: [...(options.rotation ?? [0, 0, 0])], size: options.size ?? (source.kind === 'primitive' ? .5 : 1), ...(options.color ? { color: options.color } : {}) };
  validateProp(prop);
  return prop;
}

export type PropPatch = { name?: string; position?: Vector3Tuple; rotation?: Vector3Tuple; size?: number; color?: string | null };
/** `color: null` removes the tint; omitted fields are unchanged. */
export function updateProp(prop: SceneProp, patch: PropPatch): SceneProp {
  const { color, ...rest } = prop;
  const next: SceneProp = {
    ...rest,
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    position: [...(patch.position ?? prop.position)],
    rotation: [...(patch.rotation ?? prop.rotation)],
    size: patch.size ?? prop.size,
    ...(patch.color === null ? {} : patch.color !== undefined ? { color: patch.color } : color ? { color } : {}),
    ...(prop.attachment ? { attachment: prop.attachment } : {}),
  };
  validateProp(next);
  return next;
}

export function propLabel(prop: SceneProp) { return prop.source.kind === 'model' ? `Sketchfab · ${prop.source.author}` : `Primitive · ${prop.source.shape}`; }
