import { NextResponse } from 'next/server';
import { audioConfigured, searchAudio } from '@/backend/audio';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { apiError, HttpError } from '@/backend/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/audio/search?kind=music|sfx&q=… — Jamendo music or Freesound effects, filtered to usable licences. */
export async function GET(request: Request) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Search audio from the viewer.');
    if (rateLimited(request, 'audio-search', 30)) throw new HttpError(429, 'Too many audio searches. Wait a minute and try again.');
    const params = new URL(request.url).searchParams;
    const kind = params.get('kind') === 'sfx' ? 'sfx' : 'music';
    const configured = audioConfigured();
    if (!configured[kind]) return NextResponse.json({ results: [], configured: false, error: kind === 'music' ? 'Music needs a Jamendo client ID on the server (JAMENDO_CLIENT_ID).' : 'Sound effects need a Freesound API key on the server (FREESOUND_API_KEY).' }, { headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json({ results: await searchAudio(kind, params.get('q') ?? '', 10), configured: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
