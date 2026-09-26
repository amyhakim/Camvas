'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/primitives';
import type { Vector3Tuple } from '@/contracts';

export function PlacementControls({ offset, onChange, onReset }: { offset: Vector3Tuple; onChange: (offset: Vector3Tuple) => void; onReset: () => void }) {
  const [error, setError] = useState('');
  return <section className="placement-controls" aria-label="Scene object placement"><h3>Scene placement</h3><p>Offset in metres · Y is up · All frames</p>
    <div className="placement-fields">{(['X', 'Y', 'Z'] as const).map((axis, i) => <label key={`${axis}:${offset[i]}`}>{axis}<input aria-label={`${axis} offset`} type="number" min={-1000} max={1000} step={.1} defaultValue={offset[i]} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} onBlur={event => {
      const value = Number(event.currentTarget.value);
      if (!event.currentTarget.value.trim() || !Number.isFinite(value) || Math.abs(value) > 1000) { setError('Enter an offset between −1000 and 1000 m.'); return; }
      setError(''); if (value !== offset[i]) { const next: Vector3Tuple = [...offset]; next[i] = value; onChange(next); }
    }} /></label>)}</div>
    {error && <p role="alert">{error}</p>}<Button size="sm" variant="ghost" disabled={offset.every(value => value === 0)} onClick={() => { setError(''); onReset(); }}>Reset transform</Button>
  </section>;
}
