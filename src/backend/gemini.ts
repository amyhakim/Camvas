import { CAMERA_MOVE_PRESETS } from '../vendor/blockout/camera-moves';
import type { PlanShotRequest, ShotPlan } from './contracts';
import { HttpError } from './http';
import { parseShotSettings } from './contracts';

const presetIds = new Set(['static-coverage', ...CAMERA_MOVE_PRESETS.map(preset => preset.id)]);

export async function planShot(input: PlanShotRequest): Promise<ShotPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new HttpError(503, 'Shot planning is not configured. Set GEMINI_API_KEY on Railway.');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const schema = {
    type: 'object', additionalProperties: false, required: ['settings', 'rationale'], properties: {
      settings: { type: 'object', additionalProperties: false, required: ['presetId', 'duration', 'focalLength', 'sensor', 'framing'], properties: {
        presetId: { type: 'string', enum: [...presetIds] }, duration: { type: 'number', minimum: 1, maximum: 60 },
        focalLength: { type: 'number', minimum: 8, maximum: 300 }, sensor: { type: 'string', enum: ['super16', 'super35', 'fullFrame', 'imax65'] },
        framing: { type: 'string', enum: ['wide', 'full', 'detail', 'medium', 'close'] },
      } }, rationale: { type: 'string', maxLength: 500 },
    },
  };
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: [
        'You are a cinematography planner. Select one available camera preset and practical optics for the requested shot.',
        `Available presets: static-coverage (Static composition), ${CAMERA_MOVE_PRESETS.map(preset => `${preset.id} (${preset.name})`).join(', ')}`,
        `Shot request: ${input.prompt}`, `Scene: ${input.sceneDescription}`, `Subject: ${JSON.stringify(input.subject)}`,
      ].join('\n') }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.3 },
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error(`Gemini request failed (${response.status}): ${detail}`);
    throw new HttpError(502, 'Gemini could not plan the shot.');
  }
  const payload = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const raw = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('');
  if (!raw) throw new HttpError(502, 'Gemini returned an empty plan.');
  let plan: unknown;
  try { plan = JSON.parse(raw); } catch { throw new HttpError(502, 'Gemini returned malformed JSON.'); }
  const data = plan as Record<string, unknown>;
  const rationale = typeof data.rationale === 'string' ? data.rationale.trim().slice(0, 500) : '';
  if (!rationale) throw new HttpError(502, 'Gemini returned a plan without a rationale.');
  return { projectId: input.projectId, revision: input.revision, settings: parseShotSettings(data.settings, presetIds), rationale };
}
