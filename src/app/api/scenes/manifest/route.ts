import { apiError, HttpError } from '@/backend/http';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { loadSuperSplatManifest } from '@/backend/supersplat';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Open scenes from Showcam.');
    if (rateLimited(request, 'scene-manifest', 60)) throw new HttpError(429, 'Too many scene requests. Wait a minute and try again.');
    const manifest = await loadSuperSplatManifest(new URL(request.url).searchParams.get('id') ?? '', request.signal);
    return Response.json(manifest, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
