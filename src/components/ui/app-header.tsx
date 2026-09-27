'use client';

import Link from 'next/link';
import { ArrowLeft, Layers2, Square } from 'lucide-react';
import { Button } from './primitives';
import { usePreferences } from './preferences';
import { DirectorChairIcon } from './director-chair-icon';

export function AppHeader({ designSystem = false }: { designSystem?: boolean }) {
  const { opaque, setOpaque } = usePreferences();
  return <header className="app-header">
    <Link href="/" className="brand" aria-label="Camvas home"><DirectorChairIcon width={23} height={23} /><span>Camvas<span className="brand-dot">.</span></span></Link>
    <div className="header-context"><span className="header-divider" /><span>{designSystem ? 'Design system' : 'Barcelona Pavilion'}</span>{!designSystem && <span className="header-context-detail">Scene 01</span>}</div>
    <nav aria-label="Main navigation" className="header-actions">
      <Button variant="ghost" iconOnly aria-label={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'} aria-pressed={opaque} onClick={() => setOpaque(!opaque)} title={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'}>{opaque ? <Square size={17} /> : <Layers2 size={17} />}</Button>
      {designSystem && <Link href="/" className="button button--secondary button--sm"><ArrowLeft size={15} /><span>Live viewer</span></Link>}
    </nav>
  </header>;
}
