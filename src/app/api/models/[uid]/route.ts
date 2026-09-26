import { NextResponse } from 'next/server';
import { apiError, HttpError } from '@/backend/http';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { verifiedModel } from '@/backend/sketchfab';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ uid: string }> };

/** Attribution comes from Sketchfab, never from the client, before a model enters a project. */
export async function GET(request: Request, context: Context) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Add models from the viewer.');
    if (rateLimited(request, 'model-verify', 30)) throw new HttpError(429, 'Too many model requests. Wait a minute and try again.');
    return NextResponse.json({ source: await verifiedModel((await context.params).uid) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
