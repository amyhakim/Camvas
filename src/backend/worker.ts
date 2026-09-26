import type { OptimizationJob, OptimizationRequest } from './contracts';
import { parseOptimizationJob } from './contracts';
import { HttpError } from './http';

function workerConfig() {
  const baseUrl = process.env.GPU_WORKER_URL?.replace(/\/$/, '');
  if (!baseUrl) throw new HttpError(503, 'Optimization is not configured. Set GPU_WORKER_URL on Railway.');
  return { baseUrl, token: process.env.GPU_WORKER_TOKEN };
}

async function callWorker(path: string, init?: RequestInit): Promise<OptimizationJob> {
  const { baseUrl, token } = workerConfig();
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    console.error(`GPU worker request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
    throw new HttpError(response.status === 404 ? 404 : 502, response.status === 404 ? 'Optimization job not found.' : 'GPU worker request failed.');
  }
  return parseOptimizationJob(await response.json());
}

export function createOptimization(input: OptimizationRequest) {
  return callWorker('/v1/jobs', { method: 'POST', body: JSON.stringify(input) });
}

export function getOptimization(jobId: string) { return callWorker(`/v1/jobs/${encodeURIComponent(jobId)}`); }
export function cancelOptimization(jobId: string) { return callWorker(`/v1/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }); }
