import { spawn } from 'node:child_process';
import path from 'node:path';

export const runtime = 'nodejs';

const vector = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) <= 1000);

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  let originHost: string | null = null;
  try { if (origin) originHost = new URL(origin).host; } catch { return Response.json({ error: 'Invalid origin.' }, { status: 403 }); }
  if (!host || (origin ? originHost !== host : !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) || request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Open FlyThru and generate the path there.' }, { status: 403 });
  let data: unknown;
  try { data = await request.json(); } catch { return Response.json({ error: 'Invalid path request.' }, { status: 400 }); }
  if (!data || typeof data !== 'object') return Response.json({ error: 'Invalid path request.' }, { status: 400 });
  const input = data as { positions?: unknown; obstacles?: unknown; region?: unknown };
  if (!Array.isArray(input.positions) || input.positions.length !== 121 || !input.positions.every(vector) || !Array.isArray(input.obstacles) || input.obstacles.length < 1 || input.obstacles.length > 400 || !input.obstacles.every(box => Array.isArray(box) && box.length === 2 && vector(box[0]) && vector(box[1]) && box[0].every((min: number, axis: number) => min <= box[1][axis]))) return Response.json({ error: 'Invalid camera path or scene bounds.' }, { status: 400 });
  if (input.region !== undefined && (!Array.isArray(input.region) || input.region.length !== 2 || !vector(input.region[0]) || !vector(input.region[1]) || !input.region[0].every((v: number, i: number) => v < (input.region as number[][])[1][i]))) return Response.json({ error: 'Invalid reviewed area.' }, { status: 400 });
  const script = path.join(process.cwd(), 'scripts/cinematraj/optimize.py');
  const child = spawn(/* turbopackIgnore: true */ process.env.CINEMATRAJ_PYTHON || 'python3', [script], { cwd: process.cwd(), env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const output = await new Promise<{ code: number; stdout: string; stderr: string }>(resolve => {
    let stdout = '', stderr = '', finished = false;
    const timeout = setTimeout(() => child.kill(), 60000);
    child.stdout.on('data', chunk => { stdout += String(chunk); if (stdout.length > 300000) child.kill(); });
    child.stderr.on('data', chunk => { stderr += String(chunk); if (stderr.length > 4000) child.kill(); });
    child.on('error', error => { if (!finished) { finished = true; clearTimeout(timeout); resolve({ code: 1, stdout: '', stderr: error.message }); } });
    child.on('close', code => { if (!finished) { finished = true; clearTimeout(timeout); resolve({ code: code ?? 1, stdout, stderr }); } });
    child.stdin.end(JSON.stringify(input));
  });
  if (output.code !== 0) return Response.json({ error: output.stderr.trim().split('\n').at(-1) || 'CinemaTraj could not generate a clear path.' }, { status: 422 });
  try {
    const line = output.stdout.split('\n').find(item => item.startsWith('CINEMATRAJ_RESULT='));
    return Response.json(JSON.parse(line?.slice('CINEMATRAJ_RESULT='.length) ?? ''));
  } catch { return Response.json({ error: 'CinemaTraj returned an invalid result.' }, { status: 502 }); }
}
