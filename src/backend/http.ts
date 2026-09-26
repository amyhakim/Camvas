import { NextResponse } from 'next/server';

const MAX_BODY_BYTES = 2 * 1024 * 1024;

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.');
  try { return JSON.parse(body); }
  catch { throw new HttpError(400, 'Request body must be valid JSON.'); }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function apiError(error: unknown) {
  const status = error instanceof HttpError ? error.status : error instanceof Error && /must|required|invalid|unknown|between|contain/i.test(error.message) ? 400 : 500;
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  if (status === 500) console.error(error);
  return NextResponse.json({ error: message }, { status });
}
