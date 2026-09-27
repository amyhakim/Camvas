'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronDown, Focus, Layers2, Move3D, Orbit, PanelRightClose, PanelRightOpen, RotateCcw, Square, SwatchBook } from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { usePreferences } from '@/components/ui/preferences';
import { Badge, Button, GlassPanel, SegmentedControl, cx } from '@/components/ui/primitives';
import { ShotAuthoring, AUTHORED_CAMERA_ID, shotEndFrame, compileShot, createPathPreview } from '@/features/camera';
import { CollaborationBar, CollaborationCursors, useSceneCollaboration, type CollaborationSceneState } from '@/features/collaboration';
import { PAVILION_SEMANTIC_GRAPH } from '@/features/navigation';
import { Timeline } from '@/features/timeline';
import { ObjectBrowser, ObjectInspector, useSceneManifest } from '@/features/scene';
import type { CameraShot, ViewMode, ViewportHandle } from '@/contracts';
import { describeTracks } from './tracks';
import { useViewportRegion } from './use-viewport-region';
import styles from './editor.module.css';

const LiveViewport = dynamic(() => import('@/features/viewport'), { ssr: false });
const MotionGlassPanel = motion.create(GlassPanel);

export function ViewerPreview() {
  const { opaque, setOpaque } = usePreferences();
  useEffect(() => { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }, []);
  const [inspectorTab, setInspectorTab] = useState<'object' | 'move'>('object');
  const [shot, setShot] = useState<CameraShot | null>(null);
  const [showPath, setShowPath] = useState(true);
  const viewportHandle = useRef<ViewportHandle | null>(null);
  const { manifest, loading, loadError } = useSceneManifest();
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>('Camera.002');
  const [cameraId, setCameraId] = useState('Camera.002');
  const [mode, setMode] = useState<ViewMode>('orbit');
  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [showCameras, setShowCameras] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const endFrame = manifest ? Math.max(manifest.frameEnd, shot ? shotEndFrame(shot, manifest.fps) : 0) : 374;
  const playbackEnd = cameraId === AUTHORED_CAMERA_ID && shot && manifest ? shotEndFrame(shot, manifest.fps) : endFrame;
  const applyCollaborativeState = useCallback((next: Partial<CollaborationSceneState>) => {
    if ('selectedId' in next) setSelectedId(next.selectedId ?? null);
    if (next.cameraId !== undefined) setCameraId(next.cameraId);
    if (next.mode !== undefined) setMode(next.mode);
    if (next.frame !== undefined) setFrame(next.frame);
    if (next.playing !== undefined) setPlaying(next.playing);
    if (next.showPath !== undefined) setShowPath(next.showPath);
    if ('shot' in next) setShot(next.shot ?? null);
  }, []);
  const collaborativeState = useMemo<CollaborationSceneState>(() => ({ selectedId, cameraId, mode, frame, playing, showPath, shot }), [selectedId, cameraId, mode, frame, playing, showPath, shot]);
  const collaboration = useSceneCollaboration(collaborativeState, applyCollaborativeState);
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
  const region = useViewportRegion(viewportRef, inspectorOpen, focusMode, inspectorTab);
  const evaluate = useMemo(() => shot ? compileShot(shot) : null, [shot]);
  // Imported Blender animation uses frame/fps inside the viewport. Drafts start at frame 1 = t0.
  const pose = cameraId === AUTHORED_CAMERA_ID && evaluate ? evaluate((frame - 1) / (manifest?.fps || 24)) : null;
  const path = useMemo(() => shot ? createPathPreview(shot) : null, [shot]);
  const tracks = describeTracks(manifest, shot, endFrame);
  function revealPhoneViewport() { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }
  function useShot(next: CameraShot) { setShot(next); setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(1); revealPhoneViewport(); }
  function previewShot() { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  function seekShot(seconds: number) { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function focusSelected() { setMode('orbit'); viewportHandle.current?.frameSelection(); }
  function resetView() { setMode('orbit'); viewportHandle.current?.resetView(); }
  function setMovement(code: string, pressed: boolean, event?: PointerEvent<HTMLButtonElement>) {
    if (event && pressed) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }
    viewportHandle.current?.setMovement(code, pressed);
  }
  function updateCollaboratorCursor(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    collaboration.updateCursor({ x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height });
  }
  const help = mode === 'orbit' ? 'Drag to orbit · Right-drag to pan · Scroll to zoom' : mode === 'fly' ? 'Click the scene · WASD to move · Drag to look · Q/E down/up · Shift to accelerate' : 'Shot camera · Play or scrub the timeline';
  const inspectorKey = inspectorTab === 'object' ? `object:${selectedId || 'empty'}` : 'camera-move';
  return <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 360, damping: 32, mass: .8 }}><div className={`${styles.root} viewer-shell`}><main id="main" className={cx('viewer-stage', 'live-stage', focusMode && 'is-focus-mode')}>
    <div ref={viewportRef} className={cx('live-canvas', mode === 'shot' && 'live-canvas--shot')} data-mode={mode} onPointerMoveCapture={updateCollaboratorCursor} onPointerLeave={() => collaboration.updateCursor(null)}>
      {manifest ? <LiveViewport pose={pose} path={path} region={region} handle={viewportHandle} showPath={showPath} manifest={manifest} mode={mode} frame={frame} cameraId={cameraId} selectedId={selectedId} onSelect={select} showCameras={showCameras} onReady={onReady} /> : <div className="scene-status" role={loadError ? 'alert' : 'status'}><h2>{loadError ? 'The scene could not load' : 'Opening the pavilion'}</h2><p>{loadError ? 'Check the connection and reload the viewer.' : 'Preparing the 3D scene…'}</p>{loadError && <Button onClick={() => window.location.reload()}>Reload viewer</Button>}</div>}
      <CollaborationCursors collaborators={collaboration.collaborators} />
    </div>
    <div className="stage-heading"><h1>Barcelona Pavilion</h1><p><span className="live-dot" />{ready ? 'Live 3D · Blender scene' : 'Loading scene'}</p></div>
    <CollaborationBar status={collaboration.status} roomId={collaboration.roomId} collaborators={collaboration.collaborators} identity={collaboration.identity} onName={collaboration.updateName} onShare={collaboration.share} />
    <GlassPanel density="default" className="viewport-tools live-tools" role="toolbar" aria-label="Viewport controls">
      <SegmentedControl label="Navigation mode" value={mode} onChange={setMode} options={[{ value: 'orbit', label: 'Orbit', icon: <Orbit size={15} /> }, { value: 'fly', label: 'Fly', icon: <Move3D size={15} /> }, { value: 'shot', label: 'Shot', icon: <Camera size={15} /> }]} />
      <span className="tool-divider" />
      <Button variant="ghost" size="sm" iconOnly aria-label="Reset view" onClick={resetView} title="Reset view"><RotateCcw size={16} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Focus view" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)} title="Hide panels"><Focus size={17} /></Button>
    </GlassPanel>
    <div className="reference-select camera-select"><Camera size={15} /><label className="sr-only" htmlFor="shot-camera">Shot camera</label><select id="shot-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setMode('shot'); if (event.target.value !== AUTHORED_CAMERA_ID) select(event.target.value); else { setInspectorOpen(true); setInspectorTab('move'); } }}>{shot && <option value={AUTHORED_CAMERA_ID}>{shot.name} · draft</option>}{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}{camera.animated ? ' · animated' : ''}</option>)}</select><ChevronDown size={13} /></div>
    <ObjectBrowser objects={manifest?.objects || []} loading={loading} selectedId={selectedId} onSelect={select} showCameras={showCameras} onToggleCameras={() => setShowCameras(!showCameras)} />
    <GlassPanel className="viewer-utilities" role="navigation" aria-label="Viewer preferences">
      <Button variant="ghost" size="sm" iconOnly aria-label={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'} aria-pressed={opaque} onClick={() => setOpaque(!opaque)} title={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'}>{opaque ? <Square size={17} /> : <Layers2 size={17} />}</Button>
      <Link href="/design-system" className="button button--ghost button--sm button--icon" aria-label="Design system" title="Design system"><SwatchBook size={17} /></Link>
      <Button variant="ghost" size="sm" iconOnly aria-label="Show inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)} title="Show inspector">{inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</Button>
    </GlassPanel>
    <AnimatePresence initial={false}>
    {inspectorOpen && <MotionGlassPanel key="inspector" className="inspector side-panel" density="default" role="region" aria-label="Object inspector" tabIndex={0} initial={{ opacity: 0, x: 18, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 14, scale: .985 }}>
      <div className="panel-heading"><h2>Inspector</h2>{shot && <Badge tone="accent">Draft</Badge>}</div>
      <SegmentedControl label="Inspector section" value={inspectorTab} onChange={setInspectorTab} options={[{ value: 'object', label: 'Object' }, { value: 'move', label: 'Camera move' }]} />
      <AnimatePresence mode="wait" initial={false}><motion.div key={inspectorKey} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .16, ease: 'easeOut' }}>
        {inspectorTab === 'move' ? <ShotAuthoring objects={manifest?.objects || []} selectedId={selectedId} onSelect={select} captureSubject={id => viewportHandle.current?.captureSubject(id) ?? null} semanticGraph={PAVILION_SEMANTIC_GRAPH} planSemanticRoute={(anchorId, clearance) => viewportHandle.current?.planSemanticRoute(PAVILION_SEMANTIC_GRAPH, anchorId, clearance) ?? null} shot={shot} onShot={next => { setShot(next); setPlaying(false); }} onGenerate={useShot} onPreview={previewShot} showPath={showPath && mode !== 'shot'} onPath={() => { const show = mode === 'shot' || !showPath; setShowPath(show); if (show) { viewportHandle.current?.framePath(); revealPhoneViewport(); } setMode('orbit'); }} onSeek={seekShot} onRemove={() => { setShot(null); setCameraId('Camera.002'); setPlaying(false); setFrame(1); }} /> : <ObjectInspector selected={selected} frame={frame} onFrameSelected={focusSelected} onViewCamera={id => { setCameraId(id); setMode('shot'); }} onCreateMove={() => setInspectorTab('move')} onSelectCamera={() => select(cameraId)} />}
      </motion.div></AnimatePresence>

    </MotionGlassPanel>}
    </AnimatePresence>
    <AnimatePresence initial={false}>
    {mode === 'fly' && <MotionGlassPanel key="fly-controls" className="fly-pad" density="default" aria-label="Fly movement controls" initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .97 }}>{[
      { code: 'KeyW', label: 'Move forward', icon: <ArrowUp size={18} /> },
      { code: 'KeyA', label: 'Move left', icon: <ArrowLeft size={18} /> },
      { code: 'KeyS', label: 'Move backward', icon: <ArrowDown size={18} /> },
      { code: 'KeyD', label: 'Move right', icon: <ArrowRight size={18} /> },
      { code: 'KeyE', label: 'Move up', icon: <span>Up</span> },
      { code: 'KeyQ', label: 'Move down', icon: <span>Down</span> },
    ].map(control => <Button key={control.code} size="sm" iconOnly aria-label={control.label} onPointerDown={event => setMovement(control.code, true, event)} onPointerUp={() => setMovement(control.code, false)} onPointerCancel={() => setMovement(control.code, false)} onLostPointerCapture={() => setMovement(control.code, false)} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setMovement(control.code, true); } }} onKeyUp={() => setMovement(control.code, false)} onBlur={() => setMovement(control.code, false)}>{control.icon}</Button>)}</MotionGlassPanel>}
    </AnimatePresence>
    <div className="preview-caption navigation-caption"><span>{help}</span><span>Scene: eMirage</span></div>
    <div className="timeline-position"><Timeline tracks={tracks} frameStart={manifest?.frameStart || 1} frameEnd={endFrame} fps={manifest?.fps || 24} frame={frame} playing={playing} subtitle={shot ? 'Camera authoring' : 'Camera animation'} footerText={shot ? `Draft: ${shot.subjectName} · ${shot.marks.length} editable marks` : 'Camera animation · frames 1–250'} onFrameChange={setFrame} onPlayChange={value => { if (value && frame >= playbackEnd) setFrame(1); setPlaying(value); }} onTrackSelect={id => { setCameraId(id); setMode('shot'); if (id === AUTHORED_CAMERA_ID) { setInspectorOpen(true); setInspectorTab('move'); } else select(id); }} /></div>
    <div className="viewer-mobile-note"><Move3D size={14} />Orbit with one finger, pinch to zoom. In Fly, drag to look and hold the movement buttons.</div>
  </main></div></MotionConfig>;
}
