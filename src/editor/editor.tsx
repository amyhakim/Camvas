'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronDown, FolderOpen, Users, Focus, Layers2, Move3D, Orbit, PanelRightClose, PanelRightOpen, RotateCcw, Square, SwatchBook } from 'lucide-react';
import { usePreferences } from '@/components/ui/preferences';
import { Badge, Button, GlassPanel, SegmentedControl, cx } from '@/components/ui/primitives';
import { ShotAuthoring, AUTHORED_CAMERA_ID, shotEndFrame, compileShot, createPathPreview } from '@/features/camera';
import { Timeline } from '@/features/timeline';
import { ObjectBrowser, ObjectInspector, useSceneManifest } from '@/features/scene';
import { BlockingControls, evaluateActor, createActor, actorEndFrame, actorPath } from '@/features/blocking';
import { ProjectControls } from '@/features/project';
import { useProject } from './use-project';
import { actorEntity } from './actors';
import type { ActorTrack, CameraShot, ViewMode, ViewportHandle } from '@/contracts';
import { describeTracks } from './tracks';
import { useViewportRegion } from './use-viewport-region';
import styles from './editor.module.css';

const LiveViewport = dynamic(() => import('@/features/viewport'), { ssr: false });

export function ViewerPreview() {
  const { opaque, setOpaque } = usePreferences();
  useEffect(() => { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }, []);
  const [inspectorTab, setInspectorTab] = useState<'object' | 'move' | 'actors' | 'project'>('object');
  const [showPath, setShowPath] = useState(true);
  const viewportHandle = useRef<ViewportHandle | null>(null);
  const { manifest, loading, loadError } = useSceneManifest();
  const { document: project, updateDocument, importDocument, status: projectStatus, error: projectError, hydrated, retrySave } = useProject(manifest);
  const shot = project.shot;
  const actors = project.actors;
  const setShot = (next: CameraShot | null) => updateDocument(previous => ({ ...previous, shot: next }));
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
  const endFrame = manifest ? Math.max(manifest.frameEnd, shot ? shotEndFrame(shot, manifest.fps) : 0, ...actors.map(actor => actorEndFrame(actor, manifest.fps))) : 374;
  useEffect(() => { if (frame > endFrame) { setFrame(endFrame); setPlaying(false); } }, [frame, endFrame]);
  const playbackEnd = !actors.length && cameraId === AUTHORED_CAMERA_ID && shot && manifest ? shotEndFrame(shot, manifest.fps) : endFrame;
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
  const select = useCallback((id: string | null) => { setSelectedId(id); if (id) { setInspectorOpen(true); setInspectorTab(current => id.startsWith('actor:') ? 'actors' : current === 'move' ? 'move' : 'object'); } }, []);
  const actorPoses = useMemo(() => actors.map(actor => evaluateActor(actor, (frame - 1) / (manifest?.fps || 24))), [actors, frame, manifest?.fps]);
  const actorPaths = useMemo(() => actors.filter(actor => actor.id === selectedId).map(actorPath), [actors, selectedId]);
  const objects = useMemo(() => [...(manifest?.objects || []), ...actorPoses.map(actorEntity)], [manifest, actorPoses]);
  const selected = objects.find(object => object.id === selectedId);
  const cameras = manifest?.objects.filter(object => object.type === 'Camera') || [];
  const region = useViewportRegion(viewportRef, inspectorOpen, focusMode, inspectorTab);
  const evaluate = useMemo(() => shot ? compileShot(shot) : null, [shot]);
  // Imported Blender animation uses frame/fps inside the viewport. Drafts start at frame 1 = t0.
  const pose = cameraId === AUTHORED_CAMERA_ID && evaluate ? evaluate((frame - 1) / (manifest?.fps || 24)) : null;
  const path = useMemo(() => shot ? createPathPreview(shot) : null, [shot]);
  const tracks = describeTracks(manifest, shot, endFrame, actors);
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
  function addActor() {
    if (actors.length >= 8) return;
    const actor = createActor(`actor:${crypto.randomUUID()}`, `Actor ${actors.length + 1}`, [-7 + actors.length * .8, 1.4, 2]);
    updateDocument(previous => ({ ...previous, actors: [...previous.actors, actor] }));
    setPlaying(false); setSelectedId(actor.id); setInspectorTab('actors'); setInspectorOpen(true); setMode('orbit'); viewportHandle.current?.frameSelection();
  }
  function changeActor(next: ActorTrack) {
    updateDocument(previous => ({ ...previous, actors: previous.actors.map(actor => actor.id === next.id ? next : actor) }));
    setPlaying(false);
  }
  function removeActor(id: string) {
    updateDocument(previous => ({ ...previous, actors: previous.actors.filter(actor => actor.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    setPlaying(false);
  }
  function seekActor(seconds: number) { setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function previewActors() { setCameraId('Camera.002'); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  const help = mode === 'orbit' ? 'Drag to orbit · Right-drag to pan · Scroll to zoom' : mode === 'fly' ? 'Click the scene · WASD to move · Drag to look · Q/E down/up · Shift to accelerate' : 'Shot camera · Play or scrub the timeline';
  return <div className={`${styles.root} viewer-shell`}><main id="main" className={cx('viewer-stage', 'live-stage', actors.length > 0 && 'has-actor-tracks', focusMode && 'is-focus-mode')}>
    <div ref={viewportRef} className={cx('live-canvas', mode === 'shot' && 'live-canvas--shot')} data-mode={mode}>
      {manifest ? <LiveViewport actors={actorPoses} actorPaths={actorPaths} pose={pose} path={path} region={region} handle={viewportHandle} showPath={showPath} manifest={manifest} mode={mode} frame={frame} cameraId={cameraId} selectedId={selectedId} onSelect={select} showCameras={showCameras} onReady={onReady} /> : <div className="scene-status" role={loadError ? 'alert' : 'status'}><h2>{loadError ? 'The scene could not load' : 'Opening the pavilion'}</h2><p>{loadError ? 'Check the connection and reload the viewer.' : 'Preparing the 3D scene…'}</p>{loadError && <Button onClick={() => window.location.reload()}>Reload viewer</Button>}</div>}
    </div>
    <div className="stage-heading"><h1>Barcelona Pavilion</h1><p><span className="live-dot" />{ready ? 'Live 3D · Blender scene' : 'Loading scene'}</p>{projectStatus === 'error' && <button className="project-warning" onClick={() => { setInspectorTab('project'); setInspectorOpen(true); }}>Project needs attention</button>}</div>
    <GlassPanel density="default" className="viewport-tools live-tools" role="toolbar" aria-label="Viewport controls">
      <SegmentedControl label="Navigation mode" value={mode} onChange={setMode} options={[{ value: 'orbit', label: 'Orbit', icon: <Orbit size={15} /> }, { value: 'fly', label: 'Fly', icon: <Move3D size={15} /> }, { value: 'shot', label: 'Shot', icon: <Camera size={15} /> }]} />
      <span className="tool-divider" />
      <Button variant="ghost" size="sm" iconOnly aria-label="Reset view" onClick={resetView} title="Reset view"><RotateCcw size={16} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Focus view" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)} title="Hide panels"><Focus size={17} /></Button>
    </GlassPanel>
    <div className="reference-select camera-select"><Camera size={15} /><label className="sr-only" htmlFor="shot-camera">Shot camera</label><select id="shot-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setMode('shot'); if (event.target.value !== AUTHORED_CAMERA_ID) select(event.target.value); else { setInspectorOpen(true); setInspectorTab('move'); } }}>{shot && <option value={AUTHORED_CAMERA_ID}>{shot.name} · draft</option>}{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}{camera.animated ? ' · animated' : ''}</option>)}</select><ChevronDown size={13} /></div>
    <ObjectBrowser objects={objects} loading={loading} selectedId={selectedId} onSelect={select} showCameras={showCameras} onToggleCameras={() => setShowCameras(!showCameras)} />
    <GlassPanel className="viewer-utilities" role="navigation" aria-label="Viewer preferences">
      <Button variant="ghost" size="sm" iconOnly aria-label="Project" title="Project" aria-pressed={inspectorOpen && inspectorTab === 'project'} onClick={() => { setInspectorTab('project'); setInspectorOpen(true); }}><FolderOpen size={17} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Actors" title="Actors" aria-pressed={inspectorOpen && inspectorTab === 'actors'} onClick={() => { setInspectorTab('actors'); setInspectorOpen(true); }}><Users size={17} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'} aria-pressed={opaque} onClick={() => setOpaque(!opaque)} title={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'}>{opaque ? <Square size={17} /> : <Layers2 size={17} />}</Button>
      <Link href="/design-system" className="button button--ghost button--sm button--icon" aria-label="Design system" title="Design system"><SwatchBook size={17} /></Link>
      <Button variant="ghost" size="sm" iconOnly aria-label="Show inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)} title="Show inspector">{inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</Button>
    </GlassPanel>
    {inspectorOpen && <GlassPanel className="inspector side-panel" data-section={inspectorTab} density="default" role="region" aria-label="Object inspector" tabIndex={0}>
      <div className="panel-heading"><h2>Inspector</h2>{shot && <Badge tone="accent">Draft</Badge>}</div>
      <SegmentedControl label="Inspector section" value={inspectorTab} onChange={setInspectorTab} options={[{ value: 'object', label: 'Object' }, { value: 'move', label: 'Camera move' }, { value: 'actors', label: 'Actors' }, { value: 'project', label: 'Project' }]} />
      {!hydrated ? <p role="status">Opening project…</p> : inspectorTab === 'project' ? <ProjectControls document={project} status={projectStatus} error={projectError} onNameChange={name => updateDocument(previous => ({ ...previous, name }))} onRetrySave={retrySave} onImport={next => { importDocument(next); setPlaying(false); setFrame(1); setCameraId('Camera.002'); setSelectedId(null); }} /> : inspectorTab === 'actors' ? <BlockingControls actors={actors} selectedId={selectedId} frame={frame} fps={manifest?.fps || 24} onSelect={select} onAdd={addActor} onChange={changeActor} onRemove={removeActor} onSeek={seekActor} onPreview={previewActors} onFrameSelected={focusSelected} /> : inspectorTab === 'move' ? <ShotAuthoring objects={manifest?.objects || []} selectedId={selectedId} onSelect={select} captureSubject={id => viewportHandle.current?.captureSubject(id) ?? null} shot={shot} onShot={next => { setShot(next); setPlaying(false); }} onGenerate={useShot} onPreview={previewShot} showPath={showPath && mode !== 'shot'} onPath={() => { const show = mode === 'shot' || !showPath; setShowPath(show); if (show) { viewportHandle.current?.framePath(); revealPhoneViewport(); } setMode('orbit'); }} onSeek={seekShot} onRemove={() => { setShot(null); setCameraId('Camera.002'); setPlaying(false); setFrame(1); }} /> : <ObjectInspector selected={selected} frame={frame} onFrameSelected={focusSelected} onViewCamera={id => { setCameraId(id); setMode('shot'); }} onCreateMove={() => setInspectorTab('move')} onSelectCamera={() => select(cameraId)} />}

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
    <div className="timeline-position"><Timeline tracks={tracks} frameStart={manifest?.frameStart || 1} frameEnd={endFrame} fps={manifest?.fps || 24} frame={frame} playing={playing} subtitle={shot ? 'Camera authoring' : 'Camera animation'} footerText={shot ? `Draft: ${shot.subjectName} · ${shot.marks.length} editable marks` : 'Camera animation · frames 1–250'} onFrameChange={setFrame} onPlayChange={value => { if (value && frame >= playbackEnd) setFrame(1); setPlaying(value); }} onTrackSelect={id => { if (id.startsWith('actor:')) { select(id); return; } setCameraId(id); setMode('shot'); if (id === AUTHORED_CAMERA_ID) { setInspectorOpen(true); setInspectorTab('move'); } else select(id); }} /></div>
    <div className="viewer-mobile-note"><Move3D size={14} />Orbit with one finger, pinch to zoom. In Fly, drag to look and hold the movement buttons.</div>
  </main></div>;
}
