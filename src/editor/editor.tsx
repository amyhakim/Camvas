'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, ChevronDown, FolderOpen, Users, Focus, Layers2, Move3D, Orbit, PanelRightClose, PanelRightOpen, RotateCcw, Square, SwatchBook, Ellipsis, Undo2 } from 'lucide-react';
import { usePreferences } from '@/components/ui/preferences';
import { Badge, Button, GlassPanel, SegmentedControl, cx } from '@/components/ui/primitives';
import { ShotAuthoring, AUTHORED_CAMERA_ID, CAMERA_MOVE_PRESETS, shotEndFrame, compileShot, createPathPreview, generateShot, cinemaTrajInput, cinemaTrajShot } from '@/features/camera';
import { Timeline } from '@/features/timeline';
import { ObjectBrowser, ObjectInspector, useSceneManifest, SCENES } from '@/features/scene';
import { BlockingControls, evaluateActor, createActor, actorEndFrame, actorPath, duplicateActor } from '@/features/blocking';
import { ProjectControls } from '@/features/project';
import { useProject } from './use-project';
import { actorEntity } from './actors';
import { ObjectContextMenu, ObjectToolStrip, type ObjectAction } from '@/features/object-actions';
import { useObjectEditing } from './use-object-editing';
import { placedEntity, withPlacement } from './object-edits';
import { PlacementControls } from './placement-controls';
import type { ActorTrack, ActorTool, ObjectContextRequest, CameraShot, ShotSettings, ViewMode, ViewportHandle, Vector3Tuple } from '@/contracts';
import { describeTracks } from './tracks';
import { DirectorPanel } from './director-panel';
import { validateDirectorAction } from './director-action';
import { useViewportRegion } from './use-viewport-region';
import styles from './editor.module.css';

const MotionGlassPanel = motion.create(GlassPanel);
const LiveViewport = dynamic(() => import('@/features/viewport'), { ssr: false });

export function ViewerPreview() {
  const reduceMotion = useReducedMotion();
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState('');
  useEffect(() => { if (manifest) { setCameraId(manifest.activeCameraId); setSelectedId(manifest.activeCameraId); } }, [manifest]);
  const [mode, setMode] = useState<ViewMode>('orbit');
  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [actorTool, setActorTool] = useState<ActorTool>('select');
  const [contextRequest, setContextRequest] = useState<ObjectContextRequest | null>(null);
  const pause = useCallback(() => setPlaying(false), []);
  const editing = useObjectEditing(project, updateDocument, frame, manifest?.fps || 24, pause);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [directorOpen, setDirectorOpen] = useState(false);
  useEffect(() => { if (inspectorOpen && window.matchMedia('(max-width: 800px)').matches) setDirectorOpen(false); }, [inspectorOpen]);
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
  const actorPoses = useMemo(() => actors.map(actor => {
    const evaluated = evaluateActor(actor, (frame - 1) / (manifest?.fps || 24));
    return editing.actorPreview?.id === actor.id ? { ...evaluated, position: editing.actorPreview.position, heading: editing.actorPreview.heading } : evaluated;
  }), [actors, frame, manifest?.fps, editing.actorPreview]);
  const placements = useMemo(() => editing.placementPreview ? [...(project.placements ?? []).filter(item => item.id !== editing.placementPreview!.id), editing.placementPreview] : project.placements ?? [], [project.placements, editing.placementPreview]);
  const actorPaths = useMemo(() => actors.filter(actor => actor.id === selectedId).map(actorPath), [actors, selectedId]);
  const objects = useMemo(() => [...(manifest?.objects || []).map(entity => placedEntity(entity, placements)), ...actorPoses.map(actorEntity)], [manifest, actorPoses, placements]);
  const selected = objects.find(object => object.id === selectedId);
  const selectedActor = actors.find(actor => actor.id === selectedId);
  const seconds = (frame - 1) / (manifest?.fps || 24);
  const editBlocked = !!selectedActor && (seconds > 60 || (selectedActor.marks.length >= 64 && !selectedActor.marks.some(mark => Math.abs(mark.time - seconds) < 1e-9)));
  const effectiveTool = editBlocked || !selected || selected.type === 'Camera' ? 'select' : selectedActor || actorTool !== 'rotate' ? actorTool : 'move';
  const cameras = manifest?.objects.filter(object => object.type === 'Camera') || [];
  const region = useViewportRegion(viewportRef, inspectorOpen, focusMode, inspectorTab, selectedId, directorOpen);
  const evaluate = useMemo(() => shot ? compileShot(shot) : null, [shot]);
  // Imported Blender animation uses frame/fps inside the viewport. Drafts start at frame 1 = t0.
  const pose = cameraId === AUTHORED_CAMERA_ID && evaluate ? evaluate((frame - 1) / (manifest?.fps || 24)) : null;
  const path = useMemo(() => shot ? createPathPreview(shot) : null, [shot]);
  const tracks = describeTracks(manifest, shot, endFrame, actors);
  function revealPhoneViewport() { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }
  function useShot(next: CameraShot) { setShot(next); setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(1); revealPhoneViewport(); }
  async function generateCinemaTraj(actorId: string, settings: ShotSettings) {
    if (manifest?.asset?.kind === 'gsplat') throw new Error('CinemaTraj needs separate scene geometry. Switch to the pavilion scene.');
    const actor = actors.find(item => item.id === actorId);
    const snapshot = viewportHandle.current?.captureSubject(actorId);
    if (!actor || !snapshot) throw new Error('Wait for the actor and scene to load, then try again.');
    if (!Number.isFinite(settings.duration) || settings.duration < 1 || settings.duration > 60 || !Number.isFinite(settings.focalLength) || settings.focalLength < 8 || settings.focalLength > 300) throw new Error('Use a duration of 1–60 seconds and a lens of 8–300 mm.');
    const input = cinemaTrajInput(actor, time => evaluateActor(actor, time), snapshot.cameraPosition, settings);
    const obstacles = viewportHandle.current?.captureObstacles(actorId) ?? [];
    if (!obstacles.length) throw new Error('The scene geometry is not ready for CinemaTraj.');
    const response = await fetch('/api/cinematraj', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ positions: input.positions.map(point => point.position), obstacles: obstacles.map(box => [box.min, box.max]) }) });
    const result = await response.json() as { error?: string; positions?: Vector3Tuple[] };
    if (!response.ok) throw new Error(result.error || 'CinemaTraj could not generate a clear path.');
    if (!Array.isArray(result.positions) || result.positions.length !== input.positions.length || !result.positions.every(point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))) throw new Error('CinemaTraj returned an invalid path.');
    useShot(cinemaTrajShot(actor, settings, input.positions.map((point, index) => ({ time: point.time, position: result.positions![index] })), input.targets));
    setInspectorOpen(true);
  }
  function previewShot() { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  function seekShot(seconds: number) { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function focusSelected() { setMode('orbit'); viewportHandle.current?.frameSelection(); }
  function resetView() { setMode('orbit'); viewportHandle.current?.resetView(); }
  function applyDirectorAction(raw: unknown): string {
    if (!manifest || !hydrated) throw new Error('Wait for the scene and project to load before changing them.');
    const action = validateDirectorAction(raw, manifest.objects, CAMERA_MOVE_PRESETS.map(preset => preset.id), endFrame);
    if (!action) return 'No scene change requested.';
    switch (action.type) {
      case 'generateShot': {
        const snapshot = viewportHandle.current?.captureSubject(action.targetId);
        if (!snapshot) throw new Error('The subject is not ready in the viewport yet.');
        const next = generateShot(snapshot, { presetId: action.presetId, duration: action.duration, focalLength: action.focalLength, framing: action.framing, sensor: 'fullFrame' });
        setSelectedId(action.targetId);
        useShot(next);
        return `Created ${next.name} around ${next.subjectName}.`;
      }
      case 'moveObject': {
        const current = (project.placements ?? []).find(item => item.id === action.targetId)?.offset ?? [0, 0, 0];
        editing.commit(withPlacement(project, { id: action.targetId, offset: current.map((value, axis) => value + action.delta[axis]) as [number, number, number] }));
        setSelectedId(action.targetId);
        setMode('orbit');
        return `Moved ${manifest.objects.find(object => object.id === action.targetId)?.name || action.targetId} by ${action.delta.join(', ')} m (X, Y, Z).`;
      }
      case 'selectObject': select(action.targetId); setMode('orbit'); return `Selected ${manifest.objects.find(object => object.id === action.targetId)?.name || action.targetId}.`;
      case 'selectCamera': setCameraId(action.targetId); select(action.targetId); setMode('shot'); return `Viewing ${manifest.objects.find(object => object.id === action.targetId)?.name || action.targetId}.`;
      case 'seek': setPlaying(false); setFrame(action.frame); return `Moved to frame ${action.frame}.`;
      case 'play': if (frame >= playbackEnd) setFrame(1); setPlaying(true); return 'Playing the timeline.';
      case 'pause': setPlaying(false); return 'Paused the timeline.';
      case 'discardShot': if (!shot) throw new Error('There is no draft shot to discard.'); setShot(null); setCameraId(manifest?.activeCameraId ?? ''); setPlaying(false); setFrame(1); return 'Discarded the draft camera move.';
      case 'frameSelection': if (!selectedId) throw new Error('Select an object before framing it.'); focusSelected(); return 'Framed the selected object.';
    }
  }
  function setMovement(code: string, pressed: boolean, event?: PointerEvent<HTMLButtonElement>) {
    if (event && pressed) { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }
    viewportHandle.current?.setMovement(code, pressed);
  }
  function addActor() {
    if (actors.length >= 8) return;
    const origin = manifest?.actorOrigin ?? [-7, 1.4, 2];
    const actor = createActor(`actor:${crypto.randomUUID()}`, `Actor ${actors.length + 1}`, [origin[0] + actors.length * .8, origin[1], origin[2]]);
    updateDocument(previous => ({ ...previous, actors: [...previous.actors, actor] }));
    setPlaying(false); setSelectedId(actor.id); setInspectorTab('actors'); setInspectorOpen(true); setMode('orbit'); viewportHandle.current?.frameSelection();
  }
  function changeActor(next: ActorTrack) {
    updateDocument(previous => ({ ...previous, actors: previous.actors.map(actor => actor.id === next.id ? next : actor) }));
    setPlaying(false);
  }
  function removeActor(id: string) {
    editing.commit({ ...project, actors: actors.filter(actor => actor.id !== id) });
    if (selectedId === id) setSelectedId(null);
    setPlaying(false);
  }
  function seekActor(seconds: number) { setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function previewActors() { setCameraId(manifest?.activeCameraId ?? ''); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  function openContext(request: ObjectContextRequest) {
    pause(); setSelectedId(request.id); setContextRequest(request);
  }
  function chooseTool(tool: ActorTool) { pause(); setInspectorTab(selectedActor ? 'actors' : 'object'); setMode('orbit'); setActorTool(tool); setContextRequest(null); revealPhoneViewport(); }
  function selectedActions() {
    const rect = viewportRef.current?.getBoundingClientRect();
    setContextRequest({ id: selectedId, x: rect ? rect.left + rect.width / 2 : 200, y: rect ? rect.top + 160 : 160 });
  }
  function duplicateSelected() {
    if (!selectedActor || actors.length >= 8) return;
    const name = `${selectedActor.name.slice(0, 90)} copy`;
    const next = duplicateActor(selectedActor, `actor:${crypto.randomUUID()}`, name);
    editing.commit({ ...project, actors: [...actors, next] }); setSelectedId(next.id); chooseTool('move');
  }
  const contextEntity = objects.find(object => object.id === contextRequest?.id);
  const contextActions: ObjectAction[] = contextEntity ? [
    { id: 'inspect', label: 'Inspect object', onSelect: () => select(contextEntity.id) },
    { id: 'frame', label: 'Frame object', onSelect: focusSelected },
    ...(contextEntity.type === 'Camera' ? [{ id: 'view', label: 'View through camera', onSelect: () => { setCameraId(contextEntity.id); setMode('shot'); } }] : [
      { id: 'move', label: 'Move object', disabled: editBlocked, onSelect: () => chooseTool('move') },
      ...(contextEntity.type === 'Actor' ? [
        { id: 'rotate', label: 'Rotate actor', disabled: editBlocked, onSelect: () => chooseTool('rotate') },
        { id: 'duplicate', label: 'Duplicate actor', disabled: actors.length >= 8, onSelect: duplicateSelected },
        { id: 'delete', label: 'Delete actor', danger: true, onSelect: () => removeActor(contextEntity.id) },
      ] : [
        { id: 'reset', label: 'Reset transform', disabled: !project.placements?.some(item => item.id === contextEntity.id), onSelect: () => editing.commit(withPlacement(project, { id: contextEntity.id, offset: [0, 0, 0] })) },
        { id: 'camera', label: 'Create camera move', onSelect: () => { setInspectorOpen(true); setInspectorTab('move'); } },
      ]),
    ]),
  ] : [{ id: 'actor', label: 'Add actor', disabled: actors.length >= 8, onSelect: addActor }, { id: 'reset-view', label: 'Reset view', onSelect: resetView }];
  if (editing.canUndo) contextActions.unshift({ id: 'undo', label: 'Undo object edit', onSelect: editing.undo });
  const toolHint = editBlocked ? 'Choose an existing mark or a time within 60 s to edit.' : selectedActor ? `Frame ${frame} · Edits a movement mark · Esc cancels` : 'Scene placement · All frames · Esc cancels';
  const help = mode === 'orbit' ? 'Drag to orbit · Right-drag to pan · Scroll to zoom' : mode === 'fly' ? 'Click the scene · WASD to move · Drag to look · Q/E down/up · Shift to accelerate' : 'Shot camera · Play or scrub the timeline';
  const inspectorKey = inspectorTab === 'object' ? `object:${selectedId || 'empty'}` : inspectorTab;
  return <MotionConfig reducedMotion="user" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32, mass: .8 }}><div className={`${styles.root} viewer-shell`}><main id="main" data-inspector-open={inspectorOpen} onKeyDown={event => { if (event.target instanceof HTMLCanvasElement && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) { event.preventDefault(); selectedActions(); } }} className={cx('viewer-stage', 'live-stage', actors.length > 0 && 'has-actor-tracks', focusMode && 'is-focus-mode', directorOpen && 'is-director-open')}>
    <div ref={viewportRef} className={cx('live-canvas', mode === 'shot' && 'live-canvas--shot')} data-mode={mode}>
      {manifest ? <LiveViewport actorTool={effectiveTool} onActorTransform={editing.actorTransform} placements={placements} onSceneTransform={editing.sceneTransform} onContextRequest={openContext} actors={actorPoses} actorPaths={actorPaths} pose={pose} path={path} region={region} handle={viewportHandle} showPath={showPath} manifest={manifest} mode={mode} frame={frame} cameraId={cameraId} selectedId={selectedId} onSelect={select} showCameras={showCameras} onReady={onReady} /> : <div className="scene-status" role={loadError ? 'alert' : 'status'}><h2>{loadError ? 'The scene could not load' : 'Opening scene'}</h2><p>{loadError ? 'Check the connection and reload the viewer.' : 'Preparing the 3D scene…'}</p>{loadError && <Button onClick={() => window.location.reload()}>Reload viewer</Button>}</div>}
    </div>
    <div className="stage-heading"><h1>{manifest?.name ?? 'Showcam'}</h1><p><span className="live-dot" />{ready ? `Live 3D · ${manifest?.asset?.kind === 'gsplat' ? 'Gaussian splat' : 'GLB scene'}` : 'Loading scene'}</p><label className="scene-switcher"><span className="sr-only">Scene</span><select aria-label="Scene" value={manifest?.id ?? 'residence-9d09ab82'} disabled={!manifest} onChange={event => { const url = new URL(window.location.href); url.searchParams.set('scene', event.target.value); window.location.assign(url); }}>{SCENES.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label>{projectStatus === 'error' && <button className="project-warning" onClick={() => { setInspectorTab('project'); setInspectorOpen(true); }}>Project needs attention</button>}</div>
    <GlassPanel density="default" className="viewport-tools live-tools" role="toolbar" aria-label="Viewport controls">
      <SegmentedControl label="Navigation mode" value={mode} onChange={setMode} options={[{ value: 'orbit', label: 'Orbit', icon: <Orbit size={15} /> }, { value: 'fly', label: 'Fly', icon: <Move3D size={15} /> }, { value: 'shot', label: 'Shot', icon: <Camera size={15} /> }]} />
      <span className="tool-divider" />
      <Button variant="ghost" size="sm" iconOnly aria-label="Reset view" onClick={resetView} title="Reset view"><RotateCcw size={16} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Focus view" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)} title="Hide panels"><Focus size={17} /></Button>
    </GlassPanel>
    <div className="reference-select camera-select"><Camera size={15} /><label className="sr-only" htmlFor="shot-camera">Shot camera</label><select id="shot-camera" value={cameraId} onChange={event => { setCameraId(event.target.value); setMode('shot'); if (event.target.value !== AUTHORED_CAMERA_ID) select(event.target.value); else { setInspectorOpen(true); setInspectorTab('move'); } }}>{shot && <option value={AUTHORED_CAMERA_ID}>{shot.name} · draft</option>}{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}{camera.animated ? ' · animated' : ''}</option>)}</select><ChevronDown size={13} /></div>
    <ObjectBrowser objects={objects} loading={loading} selectedId={selectedId} onSelect={select} showCameras={showCameras} onContextRequest={openContext} onToggleCameras={() => setShowCameras(!showCameras)} />
    <GlassPanel className="viewer-utilities" role="navigation" aria-label="Viewer preferences">
      <Button variant="ghost" size="sm" iconOnly aria-label="Project" title="Project" aria-pressed={inspectorOpen && inspectorTab === 'project'} onClick={() => { setInspectorTab('project'); setInspectorOpen(true); }}><FolderOpen size={17} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Actors" title="Actors" aria-pressed={inspectorOpen && inspectorTab === 'actors'} onClick={() => { setInspectorTab('actors'); setInspectorOpen(true); }}><Users size={17} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'} aria-pressed={opaque} onClick={() => setOpaque(!opaque)} title={opaque ? 'Enable glass transparency' : 'Reduce glass transparency'}>{opaque ? <Square size={17} /> : <Layers2 size={17} />}</Button>
      <Link href="/design-system" className="button button--ghost button--sm button--icon" aria-label="Design system" title="Design system"><SwatchBook size={17} /></Link>
      <Button variant="ghost" size="sm" iconOnly aria-label="Show inspector" aria-pressed={inspectorOpen} onClick={() => setInspectorOpen(!inspectorOpen)} title="Show inspector">{inspectorOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}</Button>
    </GlassPanel>
    <AnimatePresence initial={false}>{inspectorOpen && <MotionGlassPanel key="inspector" initial={{ opacity: 0, x: 18, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 14, scale: .985 }} className="inspector side-panel" data-section={inspectorTab} density="default" role="region" aria-label="Object inspector" tabIndex={0}>
      <div className="panel-heading"><h2>Inspector</h2>{selected && <Button size="sm" variant="ghost" iconOnly aria-label="Object actions" title="Object actions" aria-haspopup="menu" onClick={selectedActions}><Ellipsis size={18} /></Button>}{shot && <Badge tone="accent">Draft</Badge>}</div>
      <SegmentedControl label="Inspector section" value={inspectorTab} onChange={setInspectorTab} options={[{ value: 'object', label: 'Object' }, { value: 'move', label: 'Camera move' }, { value: 'actors', label: 'Actors' }, { value: 'project', label: 'Project' }]} />
      <AnimatePresence mode="wait" initial={false}><motion.div key={inspectorKey} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduceMotion ? 0 : .16, ease: 'easeOut' }}>
      {!hydrated ? <p role="status">Opening project…</p> : inspectorTab === 'project' ? <ProjectControls document={project} status={projectStatus} error={projectError} onNameChange={name => updateDocument(previous => ({ ...previous, name }))} onRetrySave={retrySave} onImport={next => { importDocument(next); setPlaying(false); setFrame(1); setCameraId(manifest?.activeCameraId ?? ''); setSelectedId(null); }} /> : inspectorTab === 'actors' ? <BlockingControls actors={actors} selectedId={selectedId} frame={frame} fps={manifest?.fps || 24} onSelect={select} onAdd={addActor} onChange={changeActor} onRemove={removeActor} onSeek={seekActor} onPreview={previewActors} onFrameSelected={focusSelected} /> : inspectorTab === 'move' ? <ShotAuthoring objects={manifest?.objects || []} actors={actors} canCinemaTraj={manifest?.asset?.kind !== 'gsplat'} selectedId={selectedId} onSelect={select} captureSubject={id => viewportHandle.current?.captureSubject(id) ?? null} shot={shot} onShot={next => { setShot(next); setPlaying(false); }} onGenerate={useShot} onCinemaTraj={generateCinemaTraj} onPreview={previewShot} showPath={showPath && mode !== 'shot'} onPath={() => { const show = mode === 'shot' || !showPath; setShowPath(show); if (show) { viewportHandle.current?.framePath(); revealPhoneViewport(); } setMode('orbit'); }} onSeek={seekShot} onRemove={() => { setShot(null); setCameraId(manifest?.activeCameraId ?? ''); setPlaying(false); setFrame(1); }} /> : <><ObjectInspector selected={selected} frame={frame} onFrameSelected={focusSelected} onViewCamera={id => { setCameraId(id); setMode('shot'); }} onCreateMove={() => setInspectorTab('move')} onSelectCamera={() => select(cameraId)} />{selected && selected.type !== 'Camera' && selected.type !== 'Actor' && <PlacementControls key={selected.id} offset={placements.find(item => item.id === selected.id)?.offset ?? [0, 0, 0]} onChange={offset => editing.commit(withPlacement(project, { id: selected.id, offset }))} onReset={() => editing.commit(withPlacement(project, { id: selected.id, offset: [0, 0, 0] }))} />}</>}

      </motion.div></AnimatePresence>
    </MotionGlassPanel>}</AnimatePresence>
    <div className="scene-dock"><AnimatePresence initial={false}>{mode === 'fly' && <MotionGlassPanel layout="position" key="fly-controls" initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .97 }} className="fly-pad" density="default" aria-label="Fly movement controls">{[
      { code: 'KeyW', label: 'Move forward', icon: <ArrowUp size={18} /> },
      { code: 'KeyA', label: 'Move left', icon: <ArrowLeft size={18} /> },
      { code: 'KeyS', label: 'Move backward', icon: <ArrowDown size={18} /> },
      { code: 'KeyD', label: 'Move right', icon: <ArrowRight size={18} /> },
      { code: 'KeyE', label: 'Move up', icon: <span>Up</span> },
      { code: 'KeyQ', label: 'Move down', icon: <span>Down</span> },
    ].map(control => <Button key={control.code} size="sm" iconOnly aria-label={control.label} onPointerDown={event => setMovement(control.code, true, event)} onPointerUp={() => setMovement(control.code, false)} onPointerCancel={() => setMovement(control.code, false)} onLostPointerCapture={() => setMovement(control.code, false)} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setMovement(control.code, true); } }} onKeyUp={() => setMovement(control.code, false)} onBlur={() => setMovement(control.code, false)}>{control.icon}</Button>)}</MotionGlassPanel>}</AnimatePresence>
    <DirectorPanel suspended={focusMode} open={directorOpen} context={JSON.stringify({ scene: manifest?.name ?? 'Loading scene', selected: selected ? { id: selected.id, name: selected.name, type: selected.type } : null, camera: cameraId, mode, frame, fps: manifest?.fps || 24, draftShot: shot ? { name: shot.name, subjectId: shot.subjectId, duration: shot.settings.duration, presetId: shot.settings.presetId } : null, placements: project.placements ?? [], objects: manifest?.objects.map(object => [object.id, object.name, object.type]), cameraPresets: CAMERA_MOVE_PRESETS.map(preset => [preset.id, preset.name]) })} onAction={applyDirectorAction} onOpenChange={open => { if (open && window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); setDirectorOpen(open); }} />
    </div>
    <AnimatePresence initial={false}>
    {selected && selected.type !== 'Camera' && <motion.div key="object-tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .14 }} className="object-tool-position"><ObjectToolStrip name={selected.name} tool={effectiveTool} onToolChange={chooseTool} allowRotate={!!selectedActor} disabled={editBlocked || !hydrated} onActions={selectedActions} onUndo={editing.undo} canUndo={editing.canUndo} hint={toolHint} /></motion.div>}
    {(!selected || selected.type === 'Camera') && editing.canUndo && <motion.div key="undo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="object-tool-position"><Button iconOnly aria-label="Undo object edit" title="Undo object edit" onClick={editing.undo}><Undo2 size={18} /></Button></motion.div>}
    </AnimatePresence>
    {contextRequest && <ObjectContextMenu key={`${contextRequest.id}:${contextRequest.x}:${contextRequest.y}`} title={contextEntity?.name ?? 'Scene actions'} x={contextRequest.x} y={contextRequest.y} actions={contextActions} onClose={() => setContextRequest(null)} />}
    {editing.error && <div className="object-edit-error" role="alert">{editing.error}<Button size="sm" variant="ghost" onClick={() => editing.setError('')}>Dismiss</Button></div>}

    <div className="preview-caption navigation-caption"><span>{help}</span><span>{manifest?.attribution ? <a href={manifest.attribution.url} target="_blank" rel="noreferrer">Scene: {manifest.attribution.author}</a> : 'Scene: eMirage'}</span></div>
    <div className="timeline-position"><Timeline tracks={tracks} frameStart={manifest?.frameStart || 1} frameEnd={endFrame} fps={manifest?.fps || 24} frame={frame} playing={playing} subtitle={shot ? 'Camera authoring' : 'Camera animation'} footerText={shot ? `Draft: ${shot.subjectName} · ${shot.marks.length} editable marks` : manifest?.asset?.kind === 'gsplat' ? 'Captured environment · Add actors or create a camera move' : 'Camera animation · frames 1–250'} onFrameChange={setFrame} onPlayChange={value => { if (value && frame >= playbackEnd) setFrame(1); setPlaying(value); }} onTrackSelect={id => { if (id.startsWith('actor:')) { select(id); return; } setCameraId(id); setMode('shot'); if (id === AUTHORED_CAMERA_ID) { setInspectorOpen(true); setInspectorTab('move'); } else select(id); }} /></div>
    <div className="viewer-mobile-note"><Move3D size={14} />Orbit with one finger, pinch to zoom. In Fly, drag to look and hold the movement buttons.</div>
  </main></div></MotionConfig>;
}
