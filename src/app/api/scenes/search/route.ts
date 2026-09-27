import { apiError, HttpError } from '@/backend/http';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { searchSuperSplat } from '@/backend/supersplat';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Search scenes from Showcam.');
    if (rateLimited(request, 'scene-search', 30)) throw new HttpError(429, 'Too many searches. Wait a minute and try again.');
    const results = await searchSuperSplat(new URL(request.url).searchParams.get('q') ?? '', request.signal);
    return Response.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return apiError(error); }
}
