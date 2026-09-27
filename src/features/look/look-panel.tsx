'use client';

import { useId, type ReactNode } from 'react';
import { Clapperboard, Plus, Trash2 } from 'lucide-react';
import { Button, SegmentedControl } from '@/components/ui/primitives';
import type { LookSettings, TitleCard } from '@/contracts';
import { ENVIRONMENT_MAPS, LETTERBOXES, LOOK_PRESETS, MAX_LIGHT_CUES, MAX_TITLES, STUDIO_DARK, effectiveLook, lightingAt, normalizeLook, normalizeTitles } from './model';
import styles from './look.module.css';

type Props = {
  look: LookSettings | undefined; sceneKind: string | undefined; subjects: { id: string; name: string }[];
  titles: TitleCard[]; seconds: number; timelineSeconds: number;
  onLook: (look: LookSettings | undefined) => void; onTitles: (titles: TitleCard[]) => void; onRender: () => void; onError: (message: string) => void;
};

function Slider({ label, value, min, max, step = .01, format = (v: number) => v.toFixed(2), onChange }: { label: string; value: number; min: number; max: number; step?: number; format?: (value: number) => string; onChange: (value: number) => void }) {
  const id = useId();
  return <label className={styles.slider} htmlFor={id}>{label}<output htmlFor={id}>{format(value)}</output>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}
function Swatch({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  return <label className={styles.swatch} htmlFor={id}><input id={id} type="color" value={value} onChange={event => onChange(event.target.value)} />{label}</label>;
}
function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section className={styles.group}><h3>{title}</h3>{children}</section>;
}
const percent = (value: number) => `${Math.round(value * 100)}%`;
const seconds = (value: number) => `${value.toFixed(1)} s`;

/** Lighting, lens effects, atmosphere, finishing and titles for the shot, plus the way into rendering. */
export function LookPanel({ look, sceneKind, subjects, titles, seconds: now, timelineSeconds, onLook, onTitles, onRender, onError }: Props) {
  const current = effectiveLook(look, sceneKind);
  function update(change: (draft: LookSettings) => void) {
    const draft = structuredClone(current ?? STUDIO_DARK);
    change(draft);
    try { onLook(normalizeLook(draft)); } catch (error) { onError(error instanceof Error ? error.message : 'That look setting is out of range.'); }
  }
  function changeTitles(next: TitleCard[]) {
    try { onTitles(normalizeTitles(next)); } catch (error) { onError(error instanceof Error ? error.message : 'That title is not valid.'); }
  }
  const selectedPreset = LOOK_PRESETS.find(preset => current && JSON.stringify({ ...preset.look, lighting: { ...preset.look.lighting, subjectId: null } }) === JSON.stringify({ ...current, lighting: { ...current.lighting, subjectId: null } }))?.id;
  return <div className={styles.root}>
    <div className={styles.renderCall}>
      <Button variant="primary" onClick={onRender}><Clapperboard size={15} />Render video…</Button>
      <p>Renders the shot camera frame by frame, with this look, titles and timeline audio, to an MP4.</p>
    </div>
    <Group title="Look">
      <div className={styles.presets}>{LOOK_PRESETS.map(preset => <button key={preset.id} type="button" aria-pressed={selectedPreset === preset.id} onClick={() => onLook(normalizeLook({ ...structuredClone(preset.look), lighting: { ...preset.look.lighting, subjectId: current?.lighting.subjectId ?? null } }))}>{preset.name}</button>)}
        <button type="button" aria-pressed={!current} disabled={sceneKind === 'studio'} title={sceneKind === 'studio' ? 'The studio stage needs a look to be lit.' : undefined} onClick={() => onLook(undefined)}>Scene default</button></div>
    </Group>
    {current && <>
      <Group title="Lighting">
        <SegmentedControl label="Light rig" value={current.lighting.rig} onChange={rig => update(draft => { draft.lighting.rig = rig; })} options={[{ value: 'studio', label: 'Studio rig' }, { value: 'scene', label: 'Scene light' }]} />
        {current.lighting.rig === 'studio' && <>
          <label className={styles.field}>Light the<select value={current.lighting.subjectId ?? ''} onChange={event => update(draft => { draft.lighting.subjectId = event.target.value || null; })}>
            <option value="">First prop (automatic)</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
          <Slider label="Rig angle" value={current.lighting.angle * 180 / Math.PI} min={-180} max={180} step={1} format={v => `${Math.round(v)}°`} onChange={v => update(draft => { draft.lighting.angle = v * Math.PI / 180; })} />
          <div className={styles.pair}>
            <Slider label="Key" value={current.lighting.key} min={0} max={4} onChange={v => update(draft => { draft.lighting.key = v; })} />
            <Slider label="Fill" value={current.lighting.fill} min={0} max={4} onChange={v => update(draft => { draft.lighting.fill = v; })} />
            <Slider label="Rims" value={current.lighting.rim} min={0} max={4} onChange={v => update(draft => { draft.lighting.rim = v; })} />
            <Slider label="Top beam" value={current.lighting.beam} min={0} max={4} onChange={v => update(draft => { draft.lighting.beam = v; })} />
          </div>
          <Slider label="Softbox reflections" value={current.lighting.environment} min={0} max={3} onChange={v => update(draft => { draft.lighting.environment = v; })} />
          <div className={styles.swatches}>
            <Swatch label="Key" value={current.lighting.keyColor} onChange={v => update(draft => { draft.lighting.keyColor = v; })} />
            <Swatch label="Rim" value={current.lighting.rimColor} onChange={v => update(draft => { draft.lighting.rimColor = v; })} />
            <Swatch label="Rim 2" value={current.lighting.rimColor2} onChange={v => update(draft => { draft.lighting.rimColor2 = v; })} />
          </div>
          <label className={styles.check}><input type="checkbox" checked={!!current.lighting.sweep} onChange={event => update(draft => { draft.lighting.sweep = event.target.checked ? { start: Math.round(now * 10) / 10, duration: 1.5, intensity: 1 } : null; })} />Light sweep across the subject</label>
          <details className={styles.cues} open={!!current.lighting.cues?.length}>
            <summary>Light cues · {current.lighting.cues?.length ?? 0}</summary>
            {(current.lighting.cues ?? []).map((cue, i) => <fieldset key={i} className={styles.title}>
              <legend>From {cue.start.toFixed(2)} s</legend>
              <div className={styles.pair}>
                <Slider label="Starts" value={cue.start} min={0} max={Math.max(cue.start, timelineSeconds)} step={.01} format={seconds} onChange={v => update(draft => { draft.lighting.cues![i].start = v; })} />
                <Slider label="Rig angle" value={cue.angle * 180 / Math.PI} min={-180} max={180} step={1} format={v => `${Math.round(v)}°`} onChange={v => update(draft => { draft.lighting.cues![i].angle = v * Math.PI / 180; })} />
                <Slider label="Key" value={cue.key} min={0} max={4} onChange={v => update(draft => { draft.lighting.cues![i].key = v; })} />
                <Slider label="Rims" value={cue.rim} min={0} max={4} onChange={v => update(draft => { draft.lighting.cues![i].rim = v; })} />
                <Slider label="Top beam" value={cue.beam} min={0} max={4} onChange={v => update(draft => { draft.lighting.cues![i].beam = v; })} />
              </div>
              <div className={styles.inline}>
                <Swatch label="Rim" value={cue.rimColor} onChange={v => update(draft => { draft.lighting.cues![i].rimColor = v; })} />
                <Swatch label="Rim 2" value={cue.rimColor2} onChange={v => update(draft => { draft.lighting.cues![i].rimColor2 = v; })} />
                <label className={styles.field}>Lights<select value={cue.subjectId ?? ''} onChange={event => update(draft => { if (event.target.value) draft.lighting.cues![i].subjectId = event.target.value; else delete draft.lighting.cues![i].subjectId; })}><option value="">Same subject</option>{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                <Button size="sm" variant="ghost" iconOnly aria-label={`Remove cue at ${cue.start.toFixed(2)} s`} onClick={() => update(draft => { draft.lighting.cues = draft.lighting.cues!.filter((_, index) => index !== i); if (!draft.lighting.cues.length) delete draft.lighting.cues; })}><Trash2 size={14} /></Button>
              </div>
            </fieldset>)}
            <Button size="sm" disabled={(current.lighting.cues?.length ?? 0) >= MAX_LIGHT_CUES || !!current.lighting.cues?.some(cue => Math.abs(cue.start - now) < .01)} onClick={() => update(draft => {
              const at = lightingAt(draft, now).lighting;
              draft.lighting.cues = [...(draft.lighting.cues ?? []), { start: Math.round(now * 100) / 100, angle: at.angle, key: at.key, rim: at.rim, beam: at.beam, rimColor: at.rimColor, rimColor2: at.rimColor2 }];
            })}><Plus size={14} />Cue at playhead</Button>
            <p className={styles.hint}>From its time on, a cue switches the rig: put one on each cut for a new lighting set-up per shot.</p>
          </details>
          {current.lighting.sweep && <div className={styles.pair}>
            <Slider label="Sweep starts" value={current.lighting.sweep.start} min={0} max={Math.max(1, timelineSeconds)} step={.05} format={seconds} onChange={v => update(draft => { draft.lighting.sweep!.start = v; })} />
            <Slider label="Sweep length" value={current.lighting.sweep.duration} min={.2} max={6} step={.05} format={seconds} onChange={v => update(draft => { draft.lighting.sweep!.duration = v; })} />
          </div>}
        </>}
      </Group>
      <Group title="Realism">
        <p className={styles.hint}>What separates filmed from rendered: captured light, soft contact shadows, real optics, surface imperfection and a camera held by hands.</p>
        {current.lighting.rig === 'studio' && <>
          <label className={styles.field}>Reflections<select value={current.lighting.environmentMap ?? 'softboxes'} onChange={event => update(draft => { draft.lighting.environmentMap = event.target.value as NonNullable<LookSettings['lighting']['environmentMap']>; })}>{ENVIRONMENT_MAPS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <div className={styles.pair}>
            <Slider label="Soft contact shadows" value={current.lighting.shadowSoftness ?? 0} min={0} max={1} format={percent} onChange={v => update(draft => { draft.lighting.shadowSoftness = v; })} />
            <Slider label="Floor tone" value={current.lighting.floor ?? 0} min={0} max={1} format={percent} onChange={v => update(draft => { draft.lighting.floor = v; })} />
          </div>
        </>}
        <label className={styles.check}><input type="checkbox" checked={!!current.camera.aperture} onChange={event => update(draft => { if (event.target.checked) draft.camera.aperture = 4; else delete draft.camera.aperture; })} />Real lens depth of field (f-stop)</label>
        {current.camera.aperture && <Slider label="Aperture" value={current.camera.aperture} min={1.4} max={22} step={.1} format={v => `f/${v.toFixed(1)}`} onChange={v => update(draft => { draft.camera.aperture = v; })} />}
        <div className={styles.pair}>
          <Slider label="Contact occlusion" value={current.camera.ao ?? 0} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.ao = v; })} />
          <Slider label="Surface micro-detail" value={current.camera.detail ?? 0} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.detail = v; })} />
          <Slider label="Lens sharpness" value={current.camera.sharpen ?? 0} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.sharpen = v; })} />
          <Slider label="Handheld camera" value={current.camera.shake ?? 0} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.shake = v; })} />
        </div>
        <label className={styles.field}>Render motion blur<select value={current.finish.motionBlur ?? 0} onChange={event => update(draft => { draft.finish.motionBlur = Number(event.target.value); })}><option value={0}>Off</option><option value={180}>180° shutter · film</option><option value={270}>270° shutter · dreamy</option></select></label>
      </Group>
      <Group title="Camera">
        <div className={styles.pair}>
          <Slider label="Exposure" value={current.camera.exposure} min={-3} max={3} step={.05} format={v => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV`} onChange={v => update(draft => { draft.camera.exposure = v; })} />
          <Slider label={current.camera.aperture ? 'Depth of field · set by f-stop' : 'Depth of field'} value={current.camera.dof} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.dof = v; })} />
          <Slider label="Bloom" value={current.camera.bloom} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.bloom = v; })} />
          <Slider label="Vignette" value={current.camera.vignette} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.vignette = v; })} />
          <Slider label="Film grain" value={current.camera.grain} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.grain = v; })} />
          <Slider label="Lens fringing" value={current.camera.fringing} min={0} max={1} format={percent} onChange={v => update(draft => { draft.camera.fringing = v; })} />
          <Slider label="Contrast" value={current.camera.contrast} min={.5} max={1.5} onChange={v => update(draft => { draft.camera.contrast = v; })} />
          <Slider label="Saturation" value={current.camera.saturation} min={0} max={2} onChange={v => update(draft => { draft.camera.saturation = v; })} />
        </div>
        <div className={styles.inline}>
          <Swatch label="Tint" value={current.camera.tint} onChange={v => update(draft => { draft.camera.tint = v; })} />
          <label className={styles.field}>Tone mapping<select value={current.camera.toneMapping} onChange={event => update(draft => { draft.camera.toneMapping = event.target.value as LookSettings['camera']['toneMapping']; })}><option value="aces2">ACES 2 · photographic</option><option value="aces">ACES · filmic contrast</option><option value="neutral">Neutral · true colour</option><option value="filmic">Filmic · soft</option></select></label>
        </div>
        <p className={styles.hint}>Depth of field focuses where the shot camera aims (its subject or the mark's aim point).</p>
      </Group>
      <Group title="Atmosphere">
        <div className={styles.pair}>
          <Slider label="Haze · light beams" value={current.atmosphere.haze} min={0} max={1} format={percent} onChange={v => update(draft => { draft.atmosphere.haze = v; })} />
          <Slider label="Dust in the light" value={current.atmosphere.dust} min={0} max={1} format={percent} onChange={v => update(draft => { draft.atmosphere.dust = v; })} />
        </div>
      </Group>
      <Group title="Finish">
        <label className={styles.field}>Frame<select value={current.finish.letterbox ?? ''} onChange={event => update(draft => { draft.finish.letterbox = event.target.value ? Number(event.target.value) : null; })}>{LETTERBOXES.map(option => <option key={option.label} value={option.value ?? ''}>{option.label}</option>)}</select></label>
        <div className={styles.pair}>
          <Slider label="Fade in from black" value={current.finish.fadeIn} min={0} max={5} step={.05} format={seconds} onChange={v => update(draft => { draft.finish.fadeIn = v; })} />
          <Slider label="Fade out to black" value={current.finish.fadeOut} min={0} max={5} step={.05} format={seconds} onChange={v => update(draft => { draft.finish.fadeOut = v; })} />
        </div>
      </Group>
    </>}
    <Group title="Titles">
      {titles.map((title, index) => <fieldset key={title.id} className={styles.title}>
        <legend>Title {index + 1}</legend>
        <label className={styles.field}>Text<input value={title.text} maxLength={80} onChange={event => changeTitles(titles.map(item => item.id === title.id ? { ...item, text: event.target.value.trim() ? event.target.value : item.text } : item))} /></label>
        <label className={styles.field}>Subtitle<input value={title.subtitle ?? ''} maxLength={120} onChange={event => changeTitles(titles.map(item => { if (item.id !== title.id) return item; const { subtitle: _old, ...rest } = item; return event.target.value.trim() ? { ...rest, subtitle: event.target.value } : rest; }))} /></label>
        <div className={styles.pair}>
          <Slider label="Starts" value={title.start} min={0} max={Math.max(title.start, timelineSeconds)} step={.05} format={seconds} onChange={v => changeTitles(titles.map(item => item.id === title.id ? { ...item, start: v } : item))} />
          <Slider label="Length" value={title.duration} min={.3} max={10} step={.05} format={seconds} onChange={v => changeTitles(titles.map(item => item.id === title.id ? { ...item, duration: v } : item))} />
        </div>
        <div className={styles.inline}>
          <SegmentedControl label="Placement" value={title.align} onChange={align => changeTitles(titles.map(item => item.id === title.id ? { ...item, align } : item))} options={[{ value: 'upper', label: 'Top' }, { value: 'center', label: 'Centre' }, { value: 'lower', label: 'Lower third' }]} />
          <Button size="sm" variant="ghost" iconOnly aria-label={`Remove title ${index + 1}`} onClick={() => changeTitles(titles.filter(item => item.id !== title.id))}><Trash2 size={14} /></Button>
        </div>
      </fieldset>)}
      <Button size="sm" disabled={titles.length >= MAX_TITLES} onClick={() => changeTitles([...titles, { id: `title:${crypto.randomUUID().slice(0, 8)}`, text: 'Your title', start: Math.round(now * 20) / 20, duration: 2, align: 'center' }])}><Plus size={14} />Add title at playhead</Button>
      <p className={styles.hint}>Titles, grain, fades and letterbox show in Shot view and are burned into renders.</p>
    </Group>
  </div>;
}
