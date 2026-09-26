import { spawn } from 'node:child_process';
import readline from 'node:readline';

export const runtime = 'nodejs';

type DirectorRequest = { prompt?: unknown; threadId?: unknown; context?: unknown };

const actionSchema = {
  type: 'object',
  properties: {
    message: { type: 'string' },
    action: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['none', 'generateShot', 'moveObject', 'selectObject', 'selectCamera', 'seek', 'play', 'pause', 'discardShot', 'frameSelection'] },
        targetId: { type: ['string', 'null'] },
        presetId: { type: ['string', 'null'] },
        duration: { type: ['number', 'null'] },
        focalLength: { type: ['number', 'null'] },
        framing: { type: ['string', 'null'], enum: ['wide', 'full', 'detail', null] },
        delta: { type: ['array', 'null'], items: { type: 'number' }, minItems: 3, maxItems: 3 },
        frame: { type: ['number', 'null'] },
      },
      required: ['type', 'targetId', 'presetId', 'duration', 'focalLength', 'framing', 'delta', 'frame'],
      additionalProperties: false,
    },
  },
  required: ['message', 'action'],
  additionalProperties: false,
};

function readableMessage(raw: string): string | null {
  const match = /"message"\s*:\s*"/.exec(raw);
  if (!match) return null;
  let fragment = '';
  let escaped = false;
  for (let index = match.index + match[0].length; index < raw.length; index++) {
    const char = raw[index];
    if (char === '"' && !escaped) break;
    fragment += char;
    if (char === '\\' && !escaped) escaped = true;
    else escaped = false;
  }
  try { return JSON.parse(`"${fragment}"`) as string; } catch { return null; }
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  let originUrl: URL | null = null;
  try { if (origin) originUrl = new URL(origin); } catch { return Response.json({ error: 'Invalid origin.' }, { status: 403 }); }
  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const allowedHosts = [host, forwardedHost].filter((value): value is string => !!value);
  const localRequest = allowedHosts.some(value => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(value));
  if ((originUrl && !allowedHosts.includes(originUrl.host)) || (!originUrl && !localRequest) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return Response.json({ error: 'Open the viewer and send the direction from that page.' }, { status: 403 });
  }

  let body: DirectorRequest;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const threadId = typeof body.threadId === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(body.threadId) ? body.threadId : null;
  const context = typeof body.context === 'string' ? body.context.slice(0, 16000) : '';
  if (!prompt || prompt.length > 4000) return Response.json({ error: 'Enter a direction under 4,000 characters.' }, { status: 400 });

  const encoder = new TextEncoder();
  let child: ReturnType<typeof spawn> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let finished = false;
      let reply = '';
      let readable = '';
      let started = false;
      let stderr = '';
      const sendEvent = (event: object) => { if (!finished) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      const finish = (event?: object) => {
        if (finished) return;
        if (event) sendEvent(event);
        finished = true;
        controller.close();
        child?.kill();
      };
      const fail = (message: string) => finish({ type: 'error', message });
      try {
        child = spawn(/* turbopackIgnore: true */ process.env.CODEX_BIN || 'codex', ['app-server'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch { fail('Could not start the local Codex CLI.'); return; }

      const send = (value: object) => child?.stdin?.write(`${JSON.stringify(value)}\n`);
      const promptText = `You are the director assistant in the Showcam browser viewer. You can request one live editor action per turn. Choose only a valid target ID and camera preset ID from the supplied viewer state. For a camera move, choose scene geometry as the subject; the editor will create a draft camera and switch to its view. For object movement, delta is [X,Y,Z] in Three.js Y-up metres and moves the chosen mesh or collection relative to its current position. Use the current selection if the director says "this" or "it". The editor validates and applies the action after your reply; describe your intention, and do not claim success before it happens. If the request is a question or cannot map to one supported action, use type "none" and explain what you need. For unused action fields use null. Return a short message first in the JSON object. Viewer state: ${context || 'No scene state available.'}\n\nDirector: ${prompt}`;
      const lines = readline.createInterface({ input: child.stdout! });
      lines.on('line', line => {
        let message: { id?: number; result?: { thread?: { id?: string } }; error?: { message?: string }; method?: string; params?: { delta?: string; item?: { type?: string; text?: string }; turn?: { status?: string; error?: { message?: string } }; error?: { message?: string } } };
        try { message = JSON.parse(line); } catch { return; }
        if (message.error?.message) { fail(message.error.message); return; }
        if (message.id === 0) {
          send({ method: 'initialized', params: {} });
          send(threadId
            ? { method: 'thread/resume', id: 1, params: { threadId } }
            : { method: 'thread/start', id: 1, params: { cwd: process.cwd(), approvalPolicy: 'never', sandbox: 'read-only', serviceName: 'showcam_director' } });
        } else if (message.id === 1) {
          const id = message.result?.thread?.id;
          if (!id) { fail('Codex did not start a conversation.'); return; }
          sendEvent({ type: 'thread', threadId: id });
          send({ method: 'turn/start', id: 2, params: { threadId: id, input: [{ type: 'text', text: promptText }], cwd: process.cwd(), approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly' }, outputSchema: actionSchema } });
        } else if (message.id === 2) {
          started = true;
        } else if (message.method === 'item/agentMessage/delta' && typeof message.params?.delta === 'string') {
          reply += message.params.delta;
          const next = readableMessage(reply);
          if (next !== null && next.startsWith(readable)) {
            if (next.length > readable.length) sendEvent({ type: 'delta', text: next.slice(readable.length) });
            readable = next;
          }
        } else if (message.method === 'item/completed' && message.params?.item?.type === 'agentMessage' && typeof message.params.item.text === 'string') {
          reply = message.params.item.text;
          try {
            const result = JSON.parse(reply) as { message?: unknown; action?: unknown };
            if (typeof result.message !== 'string' || !result.action || typeof result.action !== 'object') throw new Error();
            readable = result.message;
            sendEvent({ type: 'message', text: readable });
            sendEvent({ type: 'action', action: result.action });
          } catch { fail('Codex returned an invalid scene command. Try a more specific direction.'); }
        } else if (message.method === 'turn/completed') {
          const status = message.params?.turn?.status;
          if (status === 'completed' && readable) finish({ type: 'done', text: readable });
          else if (status === 'completed') fail('Codex completed without a usable scene response.');
          else fail(message.params?.turn?.error?.message || `Codex turn ${status || 'ended'}.`);
        } else if (message.method === 'error') {
          fail(message.params?.error?.message || 'Codex reported an error.');
        }
      });
      child.stderr?.on('data', chunk => { stderr = `${stderr}${String(chunk)}`.slice(-2000); });
      child.on('error', () => fail('Could not start the local Codex CLI.'));
      child.on('close', code => { if (!finished) fail(started ? `Codex stopped before finishing (${code ?? 'unknown'}).` : stderr.trim() || 'Codex stopped before starting.'); });
      send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'showcam', title: 'Showcam Director', version: '0.1.0' } } });
      request.signal.addEventListener('abort', () => { if (!finished) { finished = true; child?.kill(); } }, { once: true });
    },
    cancel() { child?.kill(); },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
