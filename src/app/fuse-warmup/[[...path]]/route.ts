import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path?: string[] }> };
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.ply': 'application/octet-stream',
  '.wav': 'audio/wav', '.mp4': 'video/mp4', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

/** Local production preview and range-capable movie/scan delivery; no application state changes. */
export async function GET(request: Request, context: Context) {
  const { path } = await context.params;
  if (!path?.length) return Response.redirect(new URL('/fuse-warmup/index.html', request.url), 307);
  if (path.some(part => part.startsWith('.') || part.includes('/') || part.includes('\\'))) return new Response('Not found', { status: 404 });
  const root = resolve(process.cwd(), 'productions/fuse-warmup');
  const file = resolve(root, ...path);
  const mime = types[extname(file)];
  if (!file.startsWith(root + sep) || !mime) return new Response('Not found', { status: 404 });
  try {
    // Stream the original PLY from the supplied ZIP to avoid a second 1.54 GB disk copy.
    if (path.join('/') === 'assets/scene.ply') {
      await stat(resolve(root, 'assets/FUSEgym.zip'));
      const child = spawn('/usr/bin/unzip', ['-p', resolve(root, 'assets/FUSEgym.zip'), 'scene.ply'], { stdio: ['ignore', 'pipe', 'ignore'] });
      request.signal.addEventListener('abort', () => child.kill(), { once: true });
      return new Response(Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>, { headers: { 'Content-Type': mime, 'Content-Length': '1540320378', 'Cache-Control': 'no-store' } });
    }
    const info = await stat(file);
    if (!info.isFile()) return new Response('Not found', { status: 404 });
    let start = 0, end = info.size - 1;
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
      if (!match[1]) start = Math.max(0, info.size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
    }
    const stream = createReadStream(file, { start, end });
    request.signal.addEventListener('abort', () => stream.destroy(), { once: true });
    const headers: Record<string, string> = { 'Content-Type': mime, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
  } catch { return new Response('Not found', { status: 404 }); }
}
