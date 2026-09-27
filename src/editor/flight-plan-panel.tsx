import { Button } from '@/components/ui/primitives';
import type { BackgroundFlightPlan } from './use-background-flight-plan';
import styles from './flight-plan-panel.module.css';

export function FlightPlanPanel({ plan }: { plan: BackgroundFlightPlan }) {
  return <section className={styles.panel} aria-label="Astra automated drone shot">
    <div className={styles.heading}><div><span className={styles.eyebrow}>Astra · intent-first choreography</span><h3>Automatic drone shot</h3></div></div>
    <label>Viewing sequence<textarea aria-label="Drone shot intent" rows={4} maxLength={2000} value={plan.intent} onChange={event => plan.setIntent(event.target.value)} /></label>
    <label><input type="checkbox" checked={plan.enabled} onChange={event => plan.setEnabled(event.target.checked)} /> Generate in background when a labeled scene has no shot</label>
    <p className={styles.note}>Intent → geometry → fresh route → smooth motion → rendered review → save. Existing landmarks are not route constraints.</p>
    <p role={plan.status === 'error' ? 'alert' : 'status'}>{plan.message}</p>
    <div className={styles.heading}>{plan.busy ? <Button size="sm" onClick={plan.stop}>Cancel generation</Button> : <Button size="sm" disabled={!plan.intent.trim()} onClick={plan.start}>Generate smooth shot</Button>}
      {plan.canUndo && <Button size="sm" variant="ghost" onClick={plan.undo}>Undo generated shot</Button>}</div>
    {plan.result && <>
      <p>{plan.result.plan.narrative}</p>
      <p>{plan.result.shot.settings.duration.toFixed(1)} s · {plan.result.metrics.peakSpeed.toFixed(2)} m/s peak · {plan.result.metrics.clearance.toFixed(2)} m minimum static-box clearance</p>
      <ol className={styles.beats}>{plan.result.plan.beats.map(beat => <li key={beat.controlIndex}>{beat.label}</li>)}</ol>
      <details><summary>Rendered review evidence ({plan.result.frames.length} views)</summary>{plan.result.frames.map(frame => <figure key={frame.time}><img src={frame.image} alt={`Reviewed flight at ${frame.time.toFixed(1)} seconds`} /><figcaption>{frame.time.toFixed(1)} s</figcaption></figure>)}</details>
      {plan.result.notes.map((note, i) => <p key={i}>{note}</p>)}
    </>}
    <p className={styles.note}>Uses reviewed labels and segmented static meshes. Unresolved passages, moving actors/props, splats, stale results, or failed checks never auto-save. Scene data and rendered evidence are sent to the configured Astra model. Sampled visual review is not a physical-flight safety guarantee.</p>
  </section>;
}
