import { generateAutomaticFlight, type AutomaticFlightResult } from '../features/camera/automatic-flight';
import { parseAutomaticPlan, parseFlightEvidence, parseVisualReview, type AutomaticFlightSnapshot, type AutomaticFlightPlan, type FlightEvidence } from '../contracts/automatic-flight';
export type FlightStage = 'planning' | 'validating' | 'rendering' | 'reviewing' | 'refining';
export async function runAutomaticFlight(snapshot: AutomaticFlightSnapshot, options: {
  signal: AbortSignal; isCurrent: () => boolean; onStage: (stage: FlightStage, attempt: number) => void;
  request: (body: object, signal: AbortSignal) => Promise<Record<string, unknown>>;
  render: (samples: AutomaticFlightResult['evidence'], signal: AbortSignal) => Promise<FlightEvidence[]>;
}): Promise<AutomaticFlightResult & { plan: AutomaticFlightPlan; frames: FlightEvidence[]; notes: string[] }> {
  const guard = () => { options.signal.throwIfAborted(); if (!options.isCurrent()) throw Error('Project changed. Discarded the stale flight.'); };
  let feedback = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    guard(); options.onStage(attempt === 1 ? 'planning' : 'refining', attempt);
    const body = await options.request({ mode: 'automated', stage: 'plan', snapshot, feedback }, options.signal);
    guard();
    if (body.revision !== snapshot.revision || body.sceneId !== snapshot.sceneId) throw Error('Astra returned a stale scene revision.');
    const plan = parseAutomaticPlan(body.plan, snapshot);
    try {
      if (plan.uncertainties.length) throw Error(`Unresolved intent or geometry: ${plan.uncertainties.join('; ')}`);
      options.onStage('validating', attempt);
      const generated = generateAutomaticFlight(plan, snapshot);
      guard(); options.onStage('rendering', attempt);
      const frames = parseFlightEvidence(await options.render(generated.evidence, options.signal));
      guard();
      if (frames.length !== generated.evidence.length || frames.some((f, i) => f.time !== generated.evidence[i].time)) throw Error('Rendered evidence does not match playback.');
      options.onStage('reviewing', attempt);
      const reviewed = await options.request({ mode: 'automated', stage: 'review', snapshot, plan, frames }, options.signal);
      guard();
      if (reviewed.revision !== snapshot.revision || reviewed.sceneId !== snapshot.sceneId) throw Error('Visual review used a stale scene.');
      const review = parseVisualReview(reviewed.review);
      if (!review.approved) throw Error(`Visual review rejected: ${review.notes.join('; ') || 'Requested beats were not convincingly shown.'}`);
      return { ...generated, plan, frames, notes: review.notes };
    } catch (error) {
      guard(); feedback = `${error instanceof Error ? error.message : 'Validation failed.'}\nRejected controls: ${JSON.stringify(plan.controls)}`.slice(0, 4000);
      if (attempt === 3) throw Error(`Could not validate a route after 3 attempts. Existing shot unchanged. ${feedback.split('\n')[0]}`);
    }
  }
  throw Error('No acceptable flight.');
}
