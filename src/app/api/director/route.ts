import { spawn } from 'node:child_process';
import readline from 'node:readline';
import type { ModelSource } from '@/contracts';
import { rateLimited, sameOrigin } from '@/backend/guards';
import { searchModels, sketchfabConfigured, verifiedModel } from '@/backend/sketchfab';

export const runtime = 'nodejs';

type DirectorRequest = { prompt?: unknown; threadId?: unknown; context?: unknown };
type Reply = { message?: unknown; searchQuery?: unknown; actions?: unknown };

const MAX_SEARCHES = 2;
const REQUEST_DEADLINE_MS = 180_000;
const nullable = (type: string) => ({ type: [type, 'null'] });
const actionSchema = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['none', 'generateShot', 'moveObject', 'selectObject', 'selectCamera', 'seek', 'play', 'pause', 'discardShot', 'frameSelection', 'addProp', 'updateProp', 'removeProp', 'addActor', 'updateActor', 'setActorMark', 'removeActor'] },
    targetId: nullable('string'), presetId: nullable('string'), duration: nullable('number'), focalLength: nullable('number'),
    framing: { type: ['string', 'null'], enum: ['wide', 'full', 'detail', null] },
    delta: { type: ['array', 'null'], items: { type: 'number' }, minItems: 3, maxItems: 3 },
    frame: nullable('number'), name: nullable('string'),
    position: { type: ['array', 'null'], items: { type: 'number' }, minItems: 3, maxItems: 3 },
    rotationDeg: { type: ['array', 'null'], items: { type: 'number' }, minItems: 3, maxItems: 3 },
    size: nullable('number'), color: nullable('string'), height: nullable('number'), time: nullable('number'), headingDeg: nullable('number'),
    shape: { type: ['string', 'null'], enum: ['box', 'sphere', 'cylinder', 'cone', 'capsule', 'plane', null] },
    modelUid: nullable('string'),
  },
  required: ['type', 'targetId', 'presetId', 'duration', 'focalLength', 'framing', 'delta', 'frame', 'name', 'position', 'rotationDeg', 'size', 'color', 'height', 'time', 'headingDeg', 'shape', 'modelUid'],
  additionalProperties: false,
};
const outputSchema = {
  type: 'object',
  properties: { message: { type: 'string' }, searchQuery: nullable('string'), actions: { type: 'array', maxItems: 8, items: actionSchema } },
  required: ['message', 'searchQuery', 'actions'],
  additionalProperties: false,
};

const instructions = (downloads: boolean) => `You are the director assistant in the Showcam previs editor. Each reply returns JSON: a short message, optional searchQuery, and up to 8 actions that the editor validates and applies together (all or nothing). Use null for unused fields.

World: metres, Y up. Positions are base/feet points on the floor (use floorY from the viewer state for Y unless stacking). Angles are degrees; yaw/heading 0 faces -Z, +90 faces -X. "In front of me" means along view.forward from view.position. Use the current selection for "this"/"it". Only reference IDs present in the viewer state, or IDs you create earlier in the same reply.

Actions:
- addProp: new object. Give either shape (box|sphere|cylinder|cone|capsule|plane, a stand-in) or modelUid (a Sketchfab uid from search results you were given). Set name, position, size (largest dimension in metres, realistic: shoes 0.3, chair 0.9, car 4.5), optional rotationDeg [pitch,yaw,roll] and color (#rrggbb tint). You may set targetId to a new ID like "prop:red-shoes" to refer to it later in the same reply.
- updateProp: targetId (prop:…), change any of name, position (absolute) or delta (relative), rotationDeg, size, color ("none" clears the tint).
- removeProp / removeActor: targetId.
- addActor: a character that can be blocked and followed by the camera. name, position, headingDeg, color, height (0.5–3 m). For a realistic person or creature, search Sketchfab and set modelUid; otherwise it is a coloured proxy. Optional new targetId like "actor:alice".
- updateActor: targetId, change name, color, height, or modelUid ("none" returns to the proxy body).
- setActorMark: targetId, time in seconds (0–60), position (feet) and/or headingDeg. Marks interpolate linearly; add several to make an actor walk a path.
- moveObject: relative delta [x,y,z] (±10 m per axis) for imported scene geometry or a prop. Actors move with setActorMark.
- generateShot: targetId of scene geometry, a prop, or an actor, plus presetId, duration (1–60 s), focalLength (8–300 mm), framing (wide|full|detail). With an actor subject the camera follows them through their marks.
- selectObject, selectCamera (source camera), seek (frame), play, pause, discardShot, frameSelection, none.

Sketchfab: ${downloads ? `to use a real 3D model, set searchQuery to 1–3 plain words (e.g. "sneakers", "office chair") and return actions: []; the server will reply with free Creative Commons results (uid, name, author, license, faces, megabytes). Then pick the best fit (prefer lower faces/megabytes and a matching name) and return the final actions. You may search at most ${MAX_SEARCHES} times per direction. If nothing fits, use a primitive stand-in and say so.` : 'model downloads are not configured on this server, so do not search; use primitive stand-in shapes and mention that real models need a Sketchfab token.'}

Describe what you intend in the message; do not claim success before the editor applies it. If a request cannot be done, return no actions and explain what you need.`;

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

/** Replace any model attribution with what Sketchfab reports now; reject unverifiable models before the browser sees them. */
async function verifyModels(actions: unknown[]): Promise<Record<string, ModelSource>> {
  const uids = [...new Set(actions.flatMap(action => {
    const uid = action && typeof action === 'object' ? (action as { modelUid?: unknown }).modelUid : null;
    return typeof uid === 'string' && uid !== 'none' ? [uid] : [];
  }))].slice(0, 8);
  const sources = await Promise.all(uids.map(uid => verifiedModel(uid)));
  return Object.fromEntries(sources.map(source => [source.uid, source]));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Open the viewer and send the direction from that page.' }, { status: 403 });
  if (rateLimited(request, 'director', 20)) return Response.json({ error: 'Too many directions in a minute. Wait a moment and try again.' }, { status: 429 });

  let body: DirectorRequest;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const threadId = typeof body.threadId === 'string' && /^[a-zA-Z0-9_-]{10,128}$/.test(body.threadId) ? body.threadId : null;
  const context = typeof body.context === 'string' ? body.context.slice(0, 48000) : '';
  if (!prompt || prompt.length > 4000) return Response.json({ error: 'Enter a direction under 4,000 characters.' }, { status: 400 });

  const encoder = new TextEncoder();
  let child: ReturnType<typeof spawn> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let finished = false;
      let reply = '';
      let readable = '';
      let result: Reply | null = null;
      let started = false;
      let stderr = '';
      let searches = 0;
      let conversation = '';
      const sendEvent = (event: object) => { if (!finished) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); };
      const finish = (event?: object) => {
        if (finished) return;
        if (event) sendEvent(event);
        finished = true;
        clearTimeout(deadline);
        controller.close();
        child?.kill();
      };
      const fail = (message: string) => finish({ type: 'error', message });
      const deadline = setTimeout(() => fail('Codex took too long to answer. Try a shorter direction.'), REQUEST_DEADLINE_MS);
      try {
        child = spawn(/* turbopackIgnore: true */ process.env.CODEX_BIN || 'codex', ['app-server'], {
          cwd: process.cwd(),
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      } catch { fail('Could not start the local Codex CLI.'); return; }

      let nextId = 2;
      const send = (value: object) => child?.stdin?.write(`${JSON.stringify(value)}\n`);
      const startTurn = (text: string) => {
        reply = ''; readable = ''; result = null;
        send({ method: 'turn/start', id: nextId++, params: { threadId: conversation, input: [{ type: 'text', text }], cwd: process.cwd(), approvalPolicy: 'never', sandboxPolicy: { type: 'readOnly' }, outputSchema } });
      };
      const promptText = `${instructions(sketchfabConfigured())}\n\nViewer state: ${context || 'No scene state available.'}\n\nDirector: ${prompt}`;

      async function completeTurn() {
        const current = result as Reply | null;
        if (!current || typeof current.message !== 'string' || !Array.isArray(current.actions)) { fail('Codex completed without a usable scene response.'); return; }
        const query = typeof current.searchQuery === 'string' ? current.searchQuery.trim().slice(0, 80) : '';
        if (query && searches < MAX_SEARCHES && sketchfabConfigured()) {
          searches++;
          sendEvent({ type: 'status', text: `Searching Sketchfab for “${query}”…` });
          let found: string;
          try {
            const results = await searchModels(query, 6);
            found = results.length ? JSON.stringify(results.map(({ uid, name, author, license, faces, megabytes, tags }) => ({ uid, name, author, license, faces, megabytes, tags }))) : '[] (no free downloadable matches under the size limit)';
          } catch (error) { found = `[] (search failed: ${error instanceof Error ? error.message : 'unknown error'})`; }
          if (finished) return;
          sendEvent({ type: 'round' });
          sendEvent({ type: 'status', text: 'Choosing a model…' });
          startTurn(`Sketchfab results for "${query}": ${found}\n\nNow return the final actions using one result's uid as modelUid, or searchQuery once more with different words (${MAX_SEARCHES - searches} search${MAX_SEARCHES - searches === 1 ? '' : 'es'} left), or a primitive stand-in if nothing fits.`);
          return;
        }
        let models: Record<string, ModelSource>;
        try { models = await verifyModels(current.actions); }
        catch (error) { fail(error instanceof Error ? `Could not use that Sketchfab model: ${error.message}` : 'Could not verify the Sketchfab model.'); return; }
        sendEvent({ type: 'message', text: current.message });
        sendEvent({ type: 'actions', actions: current.actions, models });
        finish({ type: 'done', text: current.message });
      }

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
          conversation = id;
          sendEvent({ type: 'thread', threadId: id });
          startTurn(promptText);
        } else if (typeof message.id === 'number' && message.id >= 2) {
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
            const parsed = JSON.parse(reply) as Reply;
            if (typeof parsed.message !== 'string' || !Array.isArray(parsed.actions)) throw new Error();
            result = parsed; readable = parsed.message;
          } catch { fail('Codex returned an invalid scene command. Try a more specific direction.'); }
        } else if (message.method === 'turn/completed') {
          const status = message.params?.turn?.status;
          if (status === 'completed') void completeTurn().catch(() => fail('Codex could not finish this turn.'));
          else fail(message.params?.turn?.error?.message || `Codex turn ${status || 'ended'}.`);
        } else if (message.method === 'error') {
          fail(message.params?.error?.message || 'Codex reported an error.');
        }
      });
      child.stderr?.on('data', chunk => { stderr = `${stderr}${String(chunk)}`.slice(-2000); });
      child.on('error', () => fail('Could not start the local Codex CLI.'));
      child.on('close', code => { if (!finished) fail(started ? `Codex stopped before finishing (${code ?? 'unknown'}).` : stderr.trim() || 'Codex stopped before starting.'); });
      send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'showcam', title: 'Showcam Director', version: '0.2.0' } } });
      request.signal.addEventListener('abort', () => { if (!finished) { finished = true; clearTimeout(deadline); child?.kill(); } }, { once: true });
    },
    cancel() { child?.kill(); },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
