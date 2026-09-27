'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowDown, ArrowRight, Camera, Check, Copy, Focus, Info, Layers2, MousePointer2, Pause, Play, RotateCcw, Search, X } from 'lucide-react';
import { AppHeader } from '@/components/ui/app-header';
import { Badge, Button, GlassPanel, PropertyRow, SegmentedControl, TextField, Toggle } from '@/components/ui/primitives';
import { usePreferences } from '@/components/ui/preferences';

const colors = [
  { name: 'Canvas', token: '--color-canvas', hex: '#131615', use: 'The quiet foundation' },
  { name: 'Surface', token: '--color-surface', hex: '#202522', use: 'Opaque controls and fallback' },
  { name: 'Warm white', token: '--color-text', hex: '#F5F4ED', use: 'Primary text' },
  { name: 'Sage gray', token: '--color-text-secondary', hex: '#C1C6BD', use: 'Supporting information' },
  { name: 'Amber', token: '--color-accent', hex: '#EDC58C', use: 'Selection and primary action' },
  { name: 'Soft green', token: '--color-success', hex: '#AFCEAF', use: 'Ready and complete' },
  { name: 'Soft coral', token: '--color-danger', hex: '#F4AAA4', use: 'Errors and destructive action' },
];
const sections = ['Surfaces', 'Color', 'Typography', 'Controls', 'Patterns', 'Foundations'];

export function DesignSystem() {
  const { opaque, setOpaque } = usePreferences();
  const [mode, setMode] = useState<'inspect' | 'camera'>('inspect');
  const [pressed, setPressed] = useState(false);
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState(false);
  const [sceneName, setSceneName] = useState('Barcelona Pavilion');
  const [lens, setLens] = useState('36');
  const [guides, setGuides] = useState(true);
  const [frame, setFrame] = useState(125);
  const [selection, setSelection] = useState<'camera' | 'empty'>('camera');
  const lensError = lens !== '' && (Number(lens) < 1 || Number(lens) > 300) ? 'Use a focal length between 1 and 300 mm.' : undefined;
  async function copyToken(token: string) {
    try { await navigator.clipboard.writeText(`var(${token})`); setCopied(token); setCopyError(false); }
    catch { setCopyError(true); setCopied(''); }
  }
  return <div className="system-shell"><AppHeader designSystem /><main id="main" className="system-main">
    <div className="system-intro"><div><h1>Clarity, through glass<span>.</span></h1><p>A quiet interface for moving ideas. Camvas’s shared language of translucent surfaces, soft geometry, and precise controls.</p></div><Link className="button button--primary" href="/">Explore the viewer <ArrowRight size={16} /></Link></div>
    <div className="system-meta"><Badge>Design system · v0.1</Badge><span>Manrope / smoked glass / warm amber</span><a href="#surfaces">Explore the foundations <ArrowDown size={13} /></a></div>
    <div className="system-layout"><aside className="system-nav"><nav aria-label="Design system sections">{sections.map(section => <a key={section} href={`#${section.toLowerCase()}`}>{section}</a>)}</nav><div className="nav-note"><Layers2 size={19} /><p>One language.<br />Every surface.</p></div></aside><div className="system-content">
      <section id="surfaces" className="system-section"><div className="section-heading"><div><h2>Surfaces with a purpose.</h2><p>Glass keeps the scene present. Density keeps the interface legible.</p></div><span className="component-count">3 densities</span></div>
        <div className="surface-study"><Image src="/scenes/pavilion-day.jpg" alt="Pavilion reference used to compare glass densities over detailed imagery." fill sizes="(max-width: 800px) 100vw, 75vw" />
          <div className="surface-samples">{(['light', 'default', 'dense'] as const).map((density, index) => <GlassPanel key={density} density={density} className="surface-sample"><Layers2 size={20} /><h3>{['Floating', 'Panel', 'Precision'][index]}</h3><p>{['Brief labels and viewport tools.', 'Inspectors and object browsers.', 'Timelines and dense controls.'][index]}</p><code>{['60%', '64%', '72%'][index]} · 32px blur</code></GlassPanel>)}</div>
          <span className="surface-credit">Reference render: eMirage</span>
        </div>
        <div className="surface-note"><Info size={16} /><p>One glass layer per floating panel. Controls inside use solid fills, so text and focus states stay clear.</p></div>
        <Toggle checked={opaque} onChange={setOpaque} label="Reduce transparency" hint="Replace glass with solid surfaces across the app. Your preference is saved on this device." />
      </section>
      <section id="color" className="system-section"><div className="section-heading"><div><h2>A little warmth. A clear signal.</h2><p>Neutral surfaces let the scene lead. Amber tells you where you are.</p></div></div><div className="swatch-grid">{colors.map(color => <button className="color-swatch" key={color.token} onClick={() => copyToken(color.token)} aria-label={`Copy ${color.name} CSS token`}><span className="swatch-color" style={{ backgroundColor: color.hex }}>{copied === color.token ? <Check size={16} /> : <Copy size={14} />}</span><strong>{color.name}</strong><code>{color.hex}</code><small>{color.use}</small></button>)}</div><p className="copy-status" role="status">{copyError ? 'Clipboard unavailable. Select the token names in DESIGN.md to copy them.' : copied ? `Copied var(${copied})` : 'Select a swatch to copy its CSS variable.'}</p></section>
      <section id="typography" className="system-section"><div className="section-heading"><div><h2>One voice, at every scale.</h2><p>Manrope brings a human shape to precise information. Tabular numerals keep timing still.</p></div></div><div className="type-specimen"><div className="type-display">See the story.</div><div className="type-meta"><span>Manrope Variable</span><span>Regular → Semibold</span><span>Aa Bb Cc · 0123456789</span></div></div>
        <div className="type-rows">{[{ name: 'Display', spec: '56 / 62 · 500', text: 'Room to imagine.', cls: 'sample-display' }, { name: 'Heading', spec: '28 / 35 · 500', text: 'Barcelona Pavilion', cls: 'sample-heading' }, { name: 'Title', spec: '20 / 28 · 600', text: 'Camera properties', cls: 'sample-title' }, { name: 'Body', spec: '14 / 22 · 400', text: 'Select an object to understand its place in the scene.', cls: 'sample-body' }, { name: 'Label', spec: '12 / 18 · 500', text: 'Focal length · 36 mm', cls: 'sample-label' }].map(type => <div className="type-row" key={type.name}><div><strong>{type.name}</strong><code>{type.spec}</code></div><span className={type.cls}>{type.text}</span></div>)}</div>
      </section>
      <section id="controls" className="system-section"><div className="section-heading"><div><h2>Small controls. Clear intent.</h2><p>Rounded, tactile, and consistent. Every action has a visible focus state.</p></div></div>
        <div className="component-row"><div className="component-description"><h3>Buttons</h3><p>Amber for the next action. Quiet surfaces for everything around it.</p><code>Button</code></div><div className="component-example button-examples"><Button variant="primary" aria-pressed={pressed} onClick={() => setPressed(!pressed)}>{pressed ? <Pause size={16} /> : <Play size={16} />}{pressed ? 'Pause preview' : 'Play preview'}</Button><Button onClick={() => { setFrame(1); setPressed(false); }}><RotateCcw size={15} />Reset preview</Button><Button variant="ghost" onClick={() => setCopied('')}>Clear copied token</Button><Button disabled>Render scene</Button><Button loading>Loading</Button><Button variant="danger" onClick={() => setSelection('empty')}><X size={15} />Clear selection</Button><span className="example-feedback" role="status">{pressed ? 'Pressed state: on' : 'Pressed state: off'}</span></div></div>
        <div className="component-row"><div className="component-description"><h3>Mode selection</h3><p>One active mode. Arrow keys move between options.</p><code>SegmentedControl</code></div><div className="component-example"><SegmentedControl label="Example viewport mode" value={mode} onChange={setMode} options={[{ value: 'inspect', label: 'Inspect', icon: <MousePointer2 size={15} /> }, { value: 'camera', label: 'Camera', icon: <Camera size={15} /> }]} /><span className="example-feedback">Selected: {mode === 'inspect' ? 'Inspect' : 'Camera'}</span></div></div>
        <div className="component-row"><div className="component-description"><h3>Fields</h3><p>Persistent labels and useful errors. Measurements always include units.</p><code>TextField</code></div><div className="component-example field-examples"><TextField id="scene-name" label="Scene name" value={sceneName} onChange={event => setSceneName(event.target.value)} hint="Used in your scene browser." /><TextField id="focal-length" label="Focal length (mm)" value={lens} onChange={event => setLens(event.target.value)} type="number" min={1} max={300} error={lensError} hint="Try 0 to preview validation." /></div></div>
        <div className="component-row"><div className="component-description"><h3>Status</h3><p>Color supports a written label. It never carries meaning alone.</p><code>Badge</code></div><div className="component-example badge-examples"><Badge>Perspective</Badge><Badge tone="accent">Selected</Badge><Badge tone="success">Ready</Badge><Badge tone="danger">Missing texture</Badge></div></div>
      </section>
      <section id="patterns" className="system-section"><div className="section-heading"><div><h2>Built for the scene.</h2><p>Patterns that connect the viewport, selection, and time.</p></div></div><div className="pattern-grid"><div className="pattern-preview"><GlassPanel density="dense" className="mini-inspector"><div className="panel-heading"><h3>Inspector</h3><Button variant="ghost" size="sm" iconOnly aria-label="Toggle example selection" onClick={() => setSelection(selection === 'camera' ? 'empty' : 'camera')}>{selection === 'camera' ? <X size={15} /> : <Camera size={15} />}</Button></div>{selection === 'camera' ? <><div className="inspector-identity"><Camera size={22} /><div><h3>Camera.002</h3><p>Perspective camera</p></div></div><dl><PropertyRow label="Focal length">36 mm</PropertyRow><PropertyRow label="Sensor width">36 mm</PropertyRow><PropertyRow label="Animation">Frames 1–250</PropertyRow></dl></> : <div className="empty-state"><MousePointer2 size={25} /><h3>Find your focus.</h3><p>Select an object in the scene to inspect its properties.</p><Button size="sm" onClick={() => setSelection('camera')}>Select camera</Button></div>}</GlassPanel><h3>Selection & empty state</h3><p>Show useful properties, or explain the next action.</p></div>
          <div className="pattern-preview"><div className="mini-viewport"><Image src="/scenes/pavilion-day.jpg" alt="Pavilion composition with optional frame guides." fill sizes="420px" />{guides && <div className="frame-guides" aria-hidden="true" />}<span className="mini-view-label"><Camera size={13} />Reference still</span></div><Toggle label="Frame guides" checked={guides} onChange={setGuides} /><p>Helpers appear when they support a decision.</p></div></div>
        <div className="scrubber-example"><div><h3>One shared playhead.</h3><p>Frame stepping, keyboard input, and scrubbing use the same value.</p></div><div><label htmlFor="example-frame">Frame <output>{frame}</output><span>/ 374</span></label><input id="example-frame" type="range" min={1} max={374} value={frame} onChange={event => setFrame(Number(event.target.value))} /></div></div>
      </section>
      <section id="foundations" className="system-section"><div className="section-heading"><div><h2>Consistency is a system.</h2><p>Shared scales keep the next screen part of the same world.</p></div></div><div className="foundation-grid"><div><h3>Spacing</h3><div className="spacing-specimen">{[4, 8, 12, 16, 24, 32, 48, 64].map(size => <div key={size}><span style={{ height: size }} /><code>{size}</code></div>)}</div><p>A 4px rhythm. Tight groups, breathing room between tasks.</p></div><div><h3>Corner language</h3><div className="radius-specimen">{[12, 16, 24].map(size => <div key={size}><span style={{ borderRadius: size }} /><code>{size}px</code></div>)}</div><p>12px controls, 16px groups, 24px floating panels.</p></div></div>
        <div className="principle-list"><div><Focus size={18} /><h3>Always in focus</h3><p>Visible keyboard rings, labeled icon buttons, and comfortable targets.</p></div><div><Layers2 size={18} /><h3>Glass, with a fallback</h3><p>Opaque surfaces when blur is unsupported or transparency is reduced.</p></div><div><Search size={18} /><h3>Calm by default</h3><p>Short state transitions. Reduced motion follows the system preference.</p></div></div>
      </section>
      <footer className="system-footer"><span>Camvas · A clearer way to see the scene.</span><Link href="/">Back to the viewer <ArrowRight size={15} /></Link></footer>
    </div></div>
  </main></div>;
}
