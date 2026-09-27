'use client';

import type { ModelSource } from '@/contracts';
import styles from './props.module.css';

/** Creative Commons attribution for every third-party model in the scene (CC BY requires visible credit). */
export function ModelCredits({ sources }: { sources: ModelSource[] }) {
  // Local imports are the user's own files and need no third-party credit.
  const unique = [...new Map(sources.filter(source => source.provider === 'sketchfab').map(source => [source.uid, source])).values()];
  if (!unique.length) return null;
  return <details className={styles.credits}>
    <summary>Model credits ({unique.length})</summary>
    <ul>{unique.map(source => <li key={source.uid}>“<a href={source.viewerUrl} target="_blank" rel="noreferrer noopener">{source.name}</a>” by <a href={source.authorUrl} target="_blank" rel="noreferrer noopener">{source.author}</a> · <a href={source.licenseUrl} target="_blank" rel="noreferrer noopener">{source.license}</a></li>)}</ul>
  </details>;
}
