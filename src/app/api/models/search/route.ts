import { NextResponse } from 'next/server';
import { apiError, HttpError } from '@/backend/http';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { searchModels, sketchfabConfigured } from '@/backend/sketchfab';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Search models from the viewer.');
    if (rateLimited(request, 'model-search', 30)) throw new HttpError(429, 'Too many model searches. Wait a minute and try again.');
    const query = new URL(request.url).searchParams.get('q') ?? '';
    return NextResponse.json({ results: await searchModels(query, 8), downloads: sketchfabConfigured() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
