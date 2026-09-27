import { useState } from 'react';
import { Button } from '@/components/ui/primitives';
import type { ModelOption, ModelSource } from '@/contracts';
import { validateModelSource } from '@/features/props';
import type { DirectorPayload } from './director-panel';
import styles from './editor.module.css';

export type ModelProposal = { payload: DirectorPayload; options: ModelOption[] };

/** Search thumbnails are cheap; no archive is requested until the user commits their choices. */
export function ModelChoices({ proposal, onApply, onCancel }: { proposal: ModelProposal; onApply: (payload: DirectorPayload) => void; onCancel: () => void }) {
  const ids = Object.keys(proposal.payload.models);
  const [selected, setSelected] = useState<Record<string, string>>(() => Object.fromEntries(ids.map(id => [id, id])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function apply() {
    setBusy(true); setError('');
    try {
      const sources = await Promise.all([...new Set(Object.values(selected))].map(async uid => {
        const response = await fetch(`/api/models/${encodeURIComponent(uid)}`, { signal: AbortSignal.timeout(20_000) });
        const body = await response.json() as { source?: ModelSource; error?: string };
        if (!response.ok || !body.source) throw new Error(body.error || 'Could not verify this model. Choose another or retry.');
        validateModelSource(body.source); return body.source;
      }));
      const actions = (Array.isArray(proposal.payload.actions) ? proposal.payload.actions : [proposal.payload.actions]).map(action => {
        if (!action || typeof action !== 'object') return action;
        const record = action as Record<string, unknown>;
        return typeof record.modelUid === 'string' && selected[record.modelUid] ? { ...record, modelUid: selected[record.modelUid] } : record;
      });
      onApply({ ...proposal.payload, actions, models: Object.fromEntries(sources.map(source => [source.uid, source])) });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not use this model. Retry.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.modelChoices} aria-label="Choose Sketchfab models">
    <p>Choose a model. Downloads start after you confirm.</p>
    <div className={styles.modelChoiceList} tabIndex={0} aria-label="Available models">{ids.map(id => {
      const recommended = proposal.payload.models[id];
      const options = proposal.options.some(option => option.uid === id) ? proposal.options : [{ ...recommended, faces: 0, megabytes: 0, tags: [], licenseSlug: '' }, ...proposal.options];
      return <fieldset key={id} disabled={busy}><legend>Model for {recommended.name}</legend>
        {options.map(option => <label key={option.uid} className={styles.modelOption}>
          <input type="radio" name={`model-${id}`} value={option.uid} checked={selected[id] === option.uid} onChange={() => setSelected(previous => ({ ...previous, [id]: option.uid }))} />
          {option.thumbnail && <img src={option.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" width={56} height={44} />}
          <span><strong>{option.name}</strong><small>{option.author} · {option.license}</small><small>{option.megabytes ? `${option.megabytes} MB · ${option.faces.toLocaleString()} faces` : 'Size unavailable'}{id === option.uid ? ' · Suggested' : ''}</small><a href={option.viewerUrl} target="_blank" rel="noreferrer">View on Sketchfab</a></span>
        </label>)}
      </fieldset>;
    })}</div>
    {error && <p role="alert" className={styles.directorError}>{error}</p>}
    <div className={styles.choiceActions}><Button size="sm" disabled={busy} onClick={onCancel}>Cancel</Button><Button size="sm" variant="primary" disabled={busy} onClick={() => void apply()}>{busy ? 'Verifying…' : 'Use selected models'}</Button></div>
  </section>;
}
