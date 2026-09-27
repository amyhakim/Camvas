import Link from 'next/link';
import { DirectorChairIcon } from '@/components/ui/director-chair-icon';
import styles from './workspace-nav.module.css';

export function WorkspaceNav({ active }: { active: 'projects' | 'films' }) {
  return <header className={styles.header}>
    <Link className={styles.brand} href="/" aria-label="Camvas home"><DirectorChairIcon width={25} height={25} />Camvas<span>.</span></Link>
    <nav className={styles.tabs} aria-label="Workspace">
      <Link href="/" aria-current={active === 'projects' ? 'page' : undefined}>Projects</Link>
      <Link href="/films" aria-current={active === 'films' ? 'page' : undefined}>Films</Link>
    </nav>
  </header>;
}
