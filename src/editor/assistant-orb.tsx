import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './editor.module.css';

export function AssistantOrb({ state = 'idle', suspended = false }: { state?: 'idle' | 'listening' | 'thinking'; suspended?: boolean }) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update(); document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return <span className={styles.assistantOrb} data-state={state} data-paused={hidden || suspended} aria-hidden="true">
    <Image className={styles.assistantIcon} src="/icons/ai-director.png" width={512} height={512} alt="" unoptimized />
  </span>;
}
