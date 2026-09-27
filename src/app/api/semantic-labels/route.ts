import { sameOrigin, rateLimited } from '@/backend/guards';
import { labelSceneWithCodex } from '@/backend/semantic-labeler';
import { parseSemanticSnapshot, groundSemanticProposal } from '@/features/semantics/model';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: 'Open auto-labeling from the editor.' }, { status: 403 });
  if (rateLimited(request, 'semantic-labels', 3)) return Response.json({ error: 'Wait a minute before labeling again.' }, { status: 429 });
  try {
    const body = await request.text();
    if (body.length > 8_500_000) return Response.json({ error: 'Scene images are too large.' }, { status: 413 });
    const snapshot = parseSemanticSnapshot(JSON.parse(body));
    const output = await labelSceneWithCodex(snapshot, request.signal);
    return Response.json(groundSemanticProposal(output, snapshot));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Could not label the scene.' }, { status: 400 }); }
}
