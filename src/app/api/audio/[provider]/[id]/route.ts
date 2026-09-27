import { NextResponse } from 'next/server';
import { verifiedAudio } from '@/backend/audio';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { apiError, HttpError } from '@/backend/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ provider: string; id: string }> };

/** Attribution always comes from the provider, never from the client, before audio enters a project. */
export async function GET(request: Request, context: Context) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Add audio from the viewer.');
    if (rateLimited(request, 'audio-verify', 60)) throw new HttpError(429, 'Too many audio requests. Wait a minute and try again.');
    const { provider, id } = await context.params;
    if (provider !== 'jamendo' && provider !== 'freesound') throw new HttpError(404, 'Unknown audio provider.');
    return NextResponse.json({ source: await verifiedAudio(provider, id) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
