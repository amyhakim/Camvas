import { useEffect, useState } from 'react';
import styles from './editor.module.css';

/** Small vector waves leave the GPU budget to the scene. */
export function AssistantOrb({ state = 'idle', suspended = false }: { state?: 'idle' | 'listening' | 'thinking'; suspended?: boolean }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <span className={styles.assistantOrb} data-state={state} data-paused={hidden || suspended} aria-hidden="true">
    <svg viewBox="0 0 64 64" fill="none">
      <g className={styles.orbWaves}>
        <path d="M-64 32 Q-48 12 -32 32 T0 32 T32 32 T64 32 T96 32 T128 32" />
        <path d="M-64 32 Q-48 48 -32 32 T0 32 T32 32 T64 32 T96 32 T128 32" />
        <path d="M-64 32 Q-48 22 -32 32 T0 32 T32 32 T64 32 T96 32 T128 32" />
      </g>
    </svg>
  </span>;
}
