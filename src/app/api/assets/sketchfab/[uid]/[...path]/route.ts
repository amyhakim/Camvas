import { modelTransfer } from '@/backend/model-transfer';
import { apiError, HttpError } from '@/backend/http';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { cachedModel, readCachedFile } from '@/backend/model-cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ uid: string; path: string[] }> };

/**
 * GET /api/assets/sketchfab/<uid>/model → { entry } for the viewer, or /<uid>/<file> for the scene and its textures.
 * The first request downloads and unpacks the archive with the server token; later requests read the disk cache.
 */
export async function GET(request: Request, context: Context) {
  try {
    if (!sameOrigin(request, { allowMissingOrigin: true })) throw new HttpError(403, 'Load models from the viewer.');
    const { uid, path } = await context.params;
    if (path.length === 1 && path[0] === 'model') {
      if (rateLimited(request, 'model-open', 60)) throw new HttpError(429, 'Too many model loads. Wait a minute and try again.');
      if (new URL(request.url).searchParams.get('progress') === '1') {
        const encoder = new TextEncoder();
        let closed = false;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (event: object) => { if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
            void cachedModel(uid, progress => send({ type: 'progress', ...progress })).then(model => send({ type: 'ready', entry: model.entry }), error => send({ type: 'error', message: error instanceof Error ? error.message : 'Model download failed.' })).finally(() => { if (!closed) { closed = true; controller.close(); } });
          },
          cancel() { closed = true; },
        });
        return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
      }
      const model = await cachedModel(uid);
      return Response.json({ entry: model.entry }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const file = await readCachedFile(uid, path.join('/'));
    const transfer = await modelTransfer(new Uint8Array(file.data), file.type, request.headers.get('accept-encoding') ?? '');
    return new Response(new Uint8Array(transfer.data), { headers: { ...(transfer.compressed ? { 'Content-Encoding': 'gzip' } : {}), Vary: 'Accept-Encoding', 'Content-Length': String(transfer.data.byteLength), 'Content-Type': file.type, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
  } catch (error) { return apiError(error); }
}
