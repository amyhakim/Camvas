import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';

export function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function GlassPanel({ density = 'default', className, ...props }: HTMLAttributes<HTMLDivElement> & { density?: 'light' | 'default' | 'dense' }) {
  return <div className={cx('glass-panel', `glass-panel--${density}`, className)} {...props} />;
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  iconOnly?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', loading, iconOnly, className, children, disabled, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cx('button', `button--${variant}`, `button--${size}`, iconOnly && 'button--icon', className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading && <LoaderCircle className="loading-icon" size={16} aria-hidden="true" />}{children}
  </button>;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'success' | 'danger'; children: ReactNode }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; icon?: ReactNode }[]; onChange: (value: T) => void }) {
  return <fieldset className="segmented-control"><legend className="sr-only">{label}</legend>{options.map(option => <label key={option.value} className={cx('segment', value === option.value && 'is-selected')}>
    <input type="radio" name={label} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
    {option.icon}<span>{option.label}</span>
  </label>)}</fieldset>;
}

export function TextField({ label, hint, error, id, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; id: string }) {
  return <div className={cx('field', className)}><label htmlFor={id}>{label}</label>
    <input className="text-input" id={id} aria-invalid={!!error} aria-describedby={error || hint ? `${id}-help` : undefined} {...props} />
    {(error || hint) && <span className={cx('field-hint', !!error && 'field-error')} id={`${id}-help`}>{error || hint}</span>}
  </div>;
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return <label className="toggle-row"><span><span className="toggle-label">{label}</span>{hint && <span className="field-hint">{hint}</span>}</span><input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true"><span /></span></label>;
}

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="property-row"><dt>{label}</dt><dd>{children}</dd></div>;
}
