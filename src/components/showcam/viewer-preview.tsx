'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Armchair, Box, Camera, ChevronDown, Crosshair, Focus, Info, Layers2, Layers3, Move3D, Orbit, PanelRightClose, PanelRightOpen, RotateCcw, Search, Square, SwatchBook } from 'lucide-react';
import { usePreferences } from '@/components/ui/preferences';
import { Badge, Button, GlassPanel, PropertyRow, SegmentedControl, cx } from '@/components/ui/primitives';
import { ShotAuthoring } from './shot-authoring';
import { AUTHORED_CAMERA_ID, shotEndFrame, type CameraShot, type ShotSnapshot } from '@/lib/camera-shot';
import { Timeline } from './timeline';
import { entityPosition, type SceneManifest, type ViewMode } from '@/lib/scene-types';

const LiveViewport = dynamic(() => import('./live-viewport'), { ssr: false });

export function ViewerPreview() {
  const { opaque, setOpaque } = usePreferences();
  useEffect(() => { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }, []);
  const [inspectorTab, setInspectorTab] = useState<'object' | 'move'>('object');
  const [shot, setShot] = useState<CameraShot | null>(null);
  const [pathFocusRequest, setPathFocusRequest] = useState(0);
  const [showPath, setShowPath] = useState(true);
  const captureRef = useRef<((id: string) => ShotSnapshot | null) | null>(null);
  const [manifest, setManifest] = useState<SceneManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>('Camera.002');
  const [cameraId, setCameraId] = useState('Camera.002');
  const [mode, setMode] = useState<ViewMode>('orbit');
  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [showCameras, setShowCameras] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [resetRequest, setResetRequest] = useState(0);
  const [query, setQuery] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/scenes/pavilion.json', { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('Scene metadata unavailable'); return response.json(); }).then(setManifest).catch(error => { if (error.name !== 'AbortError') setLoadError(true); });
    return () => abort.abort();
  }, []);
  const endFrame = manifest ? Math.max(manifest.frameEnd, shot ? shotEndFrame(shot, manifest.fps) : 0) : 374;
  const playbackEnd = cameraId === AUTHORED_CAMERA_ID && shot && manifest ? shotEndFrame(shot, manifest.fps) : endFrame;
  useEffect(() => { frameRef.current = frame; }, [frame]);
  useEffect(() => {
    if (!playing || !manifest) return;
    const start = performance.now(), initial = frameRef.current;
    let request: number;
    function tick(now: number) {
      const next = Math.min(playbackEnd, initial + Math.floor((now - start) * manifest!.fps / 1000));
      setFrame(next);
      if (next === playbackEnd) setPlaying(false);
      else request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, manifest, playbackEnd]);
  const onReady = useCallback(() => setReady(true), []);
  const select = useCallback((id: string | null) => { setSelectedId(id); if (id) setInspectorOpen(true); }, []);
  const selected = manifest?.objects.find(object => object.id === selectedId);
  const cameras = manifest?.objects.filter(object => object.type === 'Camera') || [];
  const filtered = manifest?.objects.filter(object => `${object.name} ${object.sourceName} ${object.type} ${object.category} ${object.materials.join(' ')}`.toLowerCase().includes(query.toLowerCase())) || [];
  const position = selected ? entityPosition(selected, frame) : null;
  const ObjectIcon = selected?.type === 'Camera' ? Camera : selected?.type === 'Collection' ? Armchair : Box;
  function revealPhoneViewport() { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }
  function useShot(next: CameraShot) { setShot(next); setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(1); revealPhoneViewport(); }
  function previewShot() { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  function seekShot(seconds: number) { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function focusSelected() { setMode('orbit'); setFocusRequest(value => value + 1); }
  function resetView() { setMode('orbit'); setResetRequest(value => value + 1); }
  function setMovement(code: string, pressed: boolean, event?: PointerEvent<HTMLButtonElement>) {
    if (event && pressed) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }
    viewportRef.current?.querySelector('canvas')?.dispatchEvent(new CustomEvent('showcam-move', { detail: { code, pressed } }));
  }
  const help = mode === 'orbit' ? 'Drag to orbit · Right-drag to pan · Scroll to zoom' : mode === 'fly' ? 'Click the scene · WASD to move · Drag to look · Q/E down/up · Shift to accelerate' : 'Shot camera · Play or scrub the timeline';
  return <div className="viewer-shell"><main id="main" className={cx('viewer-stage', 'live-stage', focusMode && 'is-focus-mode')}>
    <div ref={viewportRef} className={cx('live-canvas', mode === 'shot' && 'live-canvas--shot')} data-mode={mode}>
      {manifest ? <LiveViewport pathFocusRequest={pathFocusRequest} shot={shot} showPath={showPath} captureRef={captureRef} manifest={manifest} mode={mode} frame={frame} cameraId={cameraId} selectedId={selectedId} onSelect={select} showCameras={showCameras} focusRequest={focusRequest} resetRequest={resetRequest} onReady={onReady} /> : <div className="viewport-message" role={loadError ? 'alert' : 'status'}><h2>{loadError ? 'The scene could not load' : 'Opening the pavilion'}</h2><p>{loadError ? 'Check the connection and reload the viewer.' : 'Preparing the 3D scene…'}</p>{loadError && <Button onClick={() => window.location.reload()}>Reload viewer</Button>}</div>}
    </div>
    <div className="stage-heading"><h1>Barcelona Pavilion</h1><p><span className="live-dot" />{ready ? 'Live 3D · Blender scene' : 'Loading scene'}</p></div>
    <GlassPanel density="default" className="viewport-tools live-tools" role="toolbar" aria-label="Viewport controls">
      <SegmentedControl label="Navigation mode" value={mode} onChange={setMode} options={[{ value: 'orbit', label: 'Orbit', icon: <Orbit size={15} /> }, { value: 'fly', label: 'Fly', icon: <Move3D size={15} /> }, { value: 'shot', label: 'Shot', icon: <Camera size={15} /> }]} />
      <span className="tool-divider" />
      <Button variant="ghost" size="sm" iconOnly aria-label="Reset view" onClick={resetView} title="Reset view"><RotateCcw size={16} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Focus view" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)} title="Hide panels"><Focus size={17} /></Button>
    </GlassPanel>
    <div className="reference-select camera-select"><Camera size={15} /><label className="sr-only" htmlFor="shot-camera">Shot camera</label><select id="shot-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setMode('shot'); if (event.target.value !== AUTHORED_CAMERA_ID) select(event.target.value); else { setInspectorOpen(true); setInspectorTab('move'); } }}>{shot && <option value={AUTHORED_CAMERA_ID}>{shot.name} · draft</option>}{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}{camera.animated ? ' · animated' : ''}</option>)}</select><ChevronDown size={13} /></div>
    <GlassPanel className="object-browser side-panel live-object-browser" density="default" role="region" aria-label="Scene objects">
      <div className="panel-heading"><h2><Layers3 size={16} />Scene objects</h2><span className="count">{manifest?.objects.length || '…'}</span></div>
      <label className="search-field"><Search size={15} /><span className="sr-only">Find an object</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an object…" /></label>
      <div className="object-list live-object-list">{filtered.length ? filtered.map(object => <button key={object.id} type="button" className={cx('object-row', selectedId === object.id && 'is-selected')} aria-pressed={selectedId === object.id} onClick={() => select(object.id)}>{object.type === 'Camera' ? <Camera size={16} /> : object.type === 'Collection' ? <Armchair size={16} /> : <Box size={16} />}<span><strong>{object.name}</strong><small>{object.type === 'Camera' ? `${object.lens} mm · ${object.animated ? 'animated' : 'perspective'}` : object.category}</small></span></button>) : <p className="empty-inline">{manifest ? 'No matching objects. Try “chair”, “water”, or “camera”.' : 'Loading scene objects…'}</p>}</div>
      <div className="object-browser-footer"><Button size="sm" variant="ghost" aria-pressed={showCameras} onClick={() => setShowCameras(!showCameras)}><Camera size={14} />Camera helpers</Button></div>
    </GlassPanel>
    <GlassPanel className="viewer-utilities" role="navigation" aria-label="Viewer preferences">
      <Button variant="ghost" size="sm" iconOnly aria-label={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'} aria-pressed={opaque} onClick={() => setOpaque(!opaque)} title={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'}>{opaque ? <Square size={17} /> : <Layers2 size={17} />}</Button>
      <Link href="/design-system" className="button button--ghost button--sm button--icon" aria-label="Design system" title="Design system"><SwatchBook size={17} /></Link>
      <Button variant="ghost" size="sm" iconOnly aria-label="Show inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)} title="Show inspector">{inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</Button>
    </GlassPanel>
    {inspectorOpen && <GlassPanel className="inspector side-panel" density="default" role="region" aria-label="Object inspector" tabIndex={0}>
      <div className="panel-heading"><h2>Inspector</h2>{shot && <Badge tone="accent">Draft</Badge>}</div>
      <SegmentedControl label="Inspector section" value={inspectorTab} onChange={setInspectorTab} options={[{ value: 'object', label: 'Object' }, { value: 'move', label: 'Camera move' }]} />
      {inspectorTab === 'move' ? <ShotAuthoring objects={manifest?.objects || []} selectedId={selectedId} onSelect={select} capture={captureRef} shot={shot} onShot={next => { setShot(next); setPlaying(false); }} onGenerate={useShot} onPreview={previewShot} showPath={showPath && mode !== 'shot'} onPath={() => { const show = mode === 'shot' || !showPath; setShowPath(show); if (show) { setPathFocusRequest(value => value + 1); revealPhoneViewport(); } setMode('orbit'); }} onSeek={seekShot} onRemove={() => { setShot(null); setCameraId('Camera.002'); setPlaying(false); setFrame(1); }} /> : <>
      {selected && position ? <>
        <div className="inspector-identity"><ObjectIcon size={22} strokeWidth={1.5} /><div><h3>{selected.name}</h3><p>{selected.category} · {selected.type}</p></div></div>
        <Button className="frame-selected" size="sm" onClick={focusSelected}><Crosshair size={14} />Frame selected object</Button>
        {selected.type !== 'Camera' && <Button className="frame-selected" variant="primary" size="sm" onClick={() => setInspectorTab('move')}><Camera size={14} />Create camera move</Button>}
        {selected.type === 'Camera' && <Button className="view-through" variant="ghost" size="sm" onClick={() => { setCameraId(selected.id); setMode('shot'); }}>View through camera <ArrowRight size={14} /></Button>}
        <div className="inspector-section"><h4>Properties</h4><dl><PropertyRow label="Type">{selected.type}</PropertyRow><PropertyRow label="Source name"><span className="source-name">{selected.sourceName}</span></PropertyRow>{selected.lens ? <><PropertyRow label="Focal length">{selected.lens} mm</PropertyRow><PropertyRow label="Sensor width">{selected.sensorWidth} mm</PropertyRow><PropertyRow label="Animation">{selected.animated ? 'Frames 1–250' : 'Static'}</PropertyRow></> : <><PropertyRow label="Material">{selected.materials.filter(Boolean).join(', ') || 'Default'}</PropertyRow><PropertyRow label="Dimensions">{selected.dimensions.map(value => value.toFixed(2)).join(' × ')} m</PropertyRow></>}</dl></div>
        <div className="inspector-section"><h4>Position <span>m · Blender Z-up</span></h4><div className="vector-fields">{position.map((value, index) => <div key={index}><span>{['X', 'Y', 'Z'][index]}</span><output aria-label={`${['X','Y','Z'][index]} position`}>{value.toFixed(3)}</output></div>)}</div></div>
        <div className="inspector-note"><Info size={14} /><span>Live scene selection. Camera values follow the playhead.</span></div>
      </> : <div className="empty-state"><Crosshair size={24} /><h3>Select an object</h3><p>Click geometry in the viewport to inspect it, or choose a camera below.</p><Button size="sm" onClick={() => select(cameraId)}>Select shot camera</Button></div>}
    </>}
    </GlassPanel>}
    {mode === 'fly' && <GlassPanel className="fly-pad" density="default" aria-label="Fly movement controls">{[
      { code: 'KeyW', label: 'Move forward', icon: <ArrowUp size={18} /> },
      { code: 'KeyA', label: 'Move left', icon: <ArrowLeft size={18} /> },
      { code: 'KeyS', label: 'Move backward', icon: <ArrowDown size={18} /> },
      { code: 'KeyD', label: 'Move right', icon: <ArrowRight size={18} /> },
      { code: 'KeyE', label: 'Move up', icon: <span>Up</span> },
      { code: 'KeyQ', label: 'Move down', icon: <span>Down</span> },
    ].map(control => <Button key={control.code} size="sm" iconOnly aria-label={control.label} onPointerDown={event => setMovement(control.code, true, event)} onPointerUp={() => setMovement(control.code, false)} onPointerCancel={() => setMovement(control.code, false)} onLostPointerCapture={() => setMovement(control.code, false)} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setMovement(control.code, true); } }} onKeyUp={() => setMovement(control.code, false)} onBlur={() => setMovement(control.code, false)}>{control.icon}</Button>)}</GlassPanel>}
    <div className="preview-caption navigation-caption"><span>{help}</span><span>Scene: eMirage</span></div>
    <div className="timeline-position"><Timeline shot={shot} frameEnd={endFrame} fps={manifest?.fps || 24} onShotSelect={() => { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setInspectorOpen(true); setInspectorTab('move'); }} frame={frame} playing={playing} onFrameChange={setFrame} onPlayChange={value => { if (value && frame >= playbackEnd) setFrame(1); setPlaying(value); }} onCameraSelect={() => { select('Camera.002'); setCameraId('Camera.002'); setMode('shot'); }} /></div>
    <div className="viewer-mobile-note"><Move3D size={14} />Orbit with one finger, pinch to zoom. In Fly, drag to look and hold the movement buttons.</div>
  </main></div>;
}
