/**
 * Browser-origin checks for routes the viewer calls. These stop cross-site pages from spending
 * the server's CLI session or Sketchfab token; they are not authentication.
 */
export function sameOrigin(request: Request, { allowMissingOrigin = false } = {}): boolean {
  const origin = request.headers.get('origin');
  let originUrl: URL | null = null;
  try { if (origin) originUrl = new URL(origin); } catch { return false; }
  const allowedHosts = [request.headers.get('host'), request.headers.get('x-forwarded-host')].filter((value): value is string => !!value);
  const localRequest = allowedHosts.some(value => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(value));
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  if (originUrl) return allowedHosts.includes(originUrl.host);
  // Same-origin GETs (e.g. asset loads) omit Origin; the Fetch Metadata header covers modern browsers.
  return localRequest || (allowMissingOrigin && request.headers.get('sec-fetch-site') !== 'same-site');
}

const windows = new Map<string, number[]>();
/** Sliding-window limiter per client and bucket. In-memory, so per server instance. */
export function rateLimited(request: Request, bucket: string, limit: number, windowMs = 60_000): boolean {
  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  const key = `${bucket}:${client}`, now = Date.now();
  const hits = (windows.get(key) ?? []).filter(time => now - time < windowMs);
  if (hits.length >= limit) { windows.set(key, hits); return true; }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 5000) for (const [entry, times] of windows) if (!times.some(time => now - time < windowMs)) windows.delete(entry);
  return false;
}
