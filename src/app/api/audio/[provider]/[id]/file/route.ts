import { cachedAudio } from '@/backend/audio';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { apiError, HttpError } from '@/backend/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ provider: string; id: string }> };

/** Same-origin audio bytes (Web Audio needs them for decoding); downloaded once, then served from the disk cache. */
export async function GET(request: Request, context: Context) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Load audio from the viewer.');
    if (rateLimited(request, 'audio-file', 120)) throw new HttpError(429, 'Too many audio loads. Wait a minute and try again.');
    const { provider, id } = await context.params;
    if (provider !== 'jamendo' && provider !== 'freesound' && provider !== 'builtin') throw new HttpError(404, 'Unknown audio provider.');
    const data = await cachedAudio(provider, id);
    return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch (error) { return apiError(error); }
}
