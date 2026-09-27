import type { CameraShot, SensorId, ShotSettings, ShotSnapshot } from '../contracts';

export type ProjectRef = { projectId: string; revision: string };

export type PlanShotRequest = ProjectRef & {
  prompt: string;
  sceneDescription: string;
  subject: ShotSnapshot;
};

export type ShotPlan = ProjectRef & {
  settings: ShotSettings;
  rationale: string;
};

export type OptimizationRequest = ProjectRef & {
  shot: CameraShot;
  sceneSnapshot: unknown;
};

export type OptimizationJob = ProjectRef & {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress?: number;
  result?: unknown;
  error?: string;
};

const sensors = new Set<SensorId>(['super16', 'super35', 'fullFrame', 'imax65']);
const framings = new Set<ShotSettings['framing']>(['wide', 'full', 'detail', 'medium', 'close']);
const projectToken = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`${label} must be between 1 and ${max} characters.`);
  return value.trim();
}

function projectRef(value: Record<string, unknown>): ProjectRef {
  const projectId = text(value.projectId, 'projectId', 128);
  const revision = text(value.revision, 'revision', 128);
  if (!projectToken.test(projectId) || !projectToken.test(revision)) throw new Error('projectId and revision may contain only letters, numbers, dots, underscores, colons, and hyphens.');
  return { projectId, revision };
}

function vector(value: unknown, label: string): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) throw new Error(`${label} must contain three finite numbers.`);
  return value as [number, number, number];
}

export function parsePlanShotRequest(value: unknown): PlanShotRequest {
  const input = record(value, 'request');
  const subject = record(input.subject, 'subject');
  return {
    ...projectRef(input),
    prompt: text(input.prompt, 'prompt', 2_000),
    sceneDescription: text(input.sceneDescription, 'sceneDescription', 10_000),
    subject: {
      subjectId: text(subject.subjectId, 'subject.subjectId', 256),
      subjectName: text(subject.subjectName, 'subject.subjectName', 256),
      min: vector(subject.min, 'subject.min'),
      max: vector(subject.max, 'subject.max'),
      cameraPosition: vector(subject.cameraPosition, 'subject.cameraPosition'),
    },
  };
}

export function parseShotSettings(value: unknown, presetIds: ReadonlySet<string>): ShotSettings {
  const input = record(value, 'settings');
  const presetId = text(input.presetId, 'settings.presetId', 128);
  const duration = input.duration;
  const focalLength = input.focalLength;
  if (!presetIds.has(presetId)) throw new Error('Gemini returned an unknown camera preset.');
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 1 || duration > 60) throw new Error('Gemini returned an invalid duration.');
  if (typeof focalLength !== 'number' || !Number.isFinite(focalLength) || focalLength < 8 || focalLength > 300) throw new Error('Gemini returned an invalid focal length.');
  if (!sensors.has(input.sensor as SensorId)) throw new Error('Gemini returned an invalid sensor.');
  if (!framings.has(input.framing as ShotSettings['framing'])) throw new Error('Gemini returned an invalid framing.');
  return { presetId, duration, focalLength, sensor: input.sensor as SensorId, framing: input.framing as ShotSettings['framing'] };
}

export function parseOptimizationRequest(value: unknown): OptimizationRequest {
  const input = record(value, 'request');
  const shot = record(input.shot, 'shot');
  if (!Array.isArray(shot.marks) || shot.marks.length < 2) throw new Error('shot.marks must contain at least two camera marks.');
  if (input.sceneSnapshot === undefined) throw new Error('sceneSnapshot is required.');
  return { ...projectRef(input), shot: input.shot as CameraShot, sceneSnapshot: input.sceneSnapshot };
}

export function parseOptimizationJob(value: unknown): OptimizationJob {
  const input = record(value, 'worker response');
  const validStatuses = new Set<OptimizationJob['status']>(['queued', 'running', 'succeeded', 'failed', 'cancelled']);
  const status = input.status as OptimizationJob['status'];
  if (!validStatuses.has(status)) throw new Error('Worker returned an invalid job status.');
  const job: OptimizationJob = { ...projectRef(input), id: text(input.id, 'id', 128), status };
  if (typeof input.progress === 'number' && Number.isFinite(input.progress)) job.progress = Math.max(0, Math.min(1, input.progress));
  if (input.result !== undefined) job.result = input.result;
  if (typeof input.error === 'string') job.error = input.error;
  return job;
}
