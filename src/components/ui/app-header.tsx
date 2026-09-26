'use client';

import Link from 'next/link';
import { ArrowLeft, Layers2, Scan, Square, SwatchBook } from 'lucide-react';
import { Button } from './primitives';
import { usePreferences } from './preferences';

export function AppHeader({ designSystem = false }: { designSystem?: boolean }) {
  const { opaque, setOpaque } = usePreferences();
  return <header className="app-header">
    <Link href="/" className="brand" aria-label="Showcam home"><Scan size={23} strokeWidth={1.7} /><span>showcam<span className="brand-dot">.</span></span></Link>
    <div className="header-context"><span className="header-divider" /><span>{designSystem ? 'Design system' : 'Barcelona Pavilion'}</span>{!designSystem && <span className="header-context-detail">Scene 01</span>}</div>
    <nav aria-label="Main navigation" className="header-actions">
      <Button variant="ghost" iconOnly aria-label={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'} aria-pressed={opaque} onClick={() => setOpaque(!opaque)} title={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'}>{opaque ? <Square size={17} /> : <Layers2 size={17} />}</Button>
      <Link href={designSystem ? '/' : '/design-system'} className="button button--secondary button--sm">{designSystem ? <ArrowLeft size={15} /> : <SwatchBook size={15} />}<span>{designSystem ? 'Live viewer' : 'Design system'}</span></Link>
    </nav>
  </header>;
}
