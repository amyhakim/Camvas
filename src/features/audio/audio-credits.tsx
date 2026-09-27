'use client';

import type { AudioClip } from '@/contracts';
import styles from './audio.module.css';

/** Creative Commons attribution for every track and sound on the timeline (CC BY requires visible credit). */
export function AudioCredits({ clips }: { clips: AudioClip[] }) {
  const sources = [...new Map(clips.map(clip => [`${clip.source.provider}:${clip.source.id}`, clip.source])).values()];
  if (!sources.length) return null;
  return <details className={styles.credits}>
    <summary>Audio credits ({sources.length})</summary>
    <ul>{sources.map(source => <li key={`${source.provider}:${source.id}`}>“<a href={source.pageUrl} target="_blank" rel="noreferrer noopener">{source.name}</a>” by <a href={source.artistUrl} target="_blank" rel="noreferrer noopener">{source.artist}</a> · <a href={source.licenseUrl} target="_blank" rel="noreferrer noopener">{source.license}</a> · {source.provider === 'builtin' ? 'Included soundtrack' : source.provider === 'jamendo' ? 'Jamendo' : 'Freesound'}</li>)}</ul>
  </details>;
}
