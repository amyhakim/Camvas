'use client';

import { SceneActions } from './scene-actions';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { ArrowLeft, Camera, ChevronDown, Clapperboard, Download, Play, Focus, Orbit, PanelLeftClose, PanelLeftOpen, Route, RotateCcw, Ellipsis, Undo2, MapPin, Search, Upload, X } from 'lucide-react';
import { Badge, Button, GlassPanel, SegmentedControl, cx } from '@/components/ui/primitives';
import { ShotAuthoring, AUTHORED_CAMERA_ID, CAMERA_MOVE_PRESETS, shotEndFrame, compileShot, createPathPreview, generateShot, cinemaTrajInput, cinemaTrajShot, cinemaTrajDraftInput, motionTarget, shotStarts, type SubjectMotion } from '@/features/camera';
import { CollaborationBar, CollaborationCursors, useSceneCollaboration, type CollaborationSceneState } from '@/features/collaboration';
import { Timeline } from '@/features/timeline';
import { ObjectBrowser, ObjectInspector, useSceneManifest, SCENES, buildSceneGraph } from '@/features/scene';
import { BlockingControls, evaluateActor, evaluateActorBody, createActor, actorEndFrame, actorPath, duplicateActor, actorSignature, validateActor, motionLabel } from '@/features/blocking';
import { PropControls, ModelSearch, ModelCredits, createProp, importLocalModel, movedProp, validateModelSource } from '@/features/props';
import { LookPanel } from '@/features/look/look-panel';
import { effectiveLook } from '@/features/look/model';
import { RenderDialog } from '@/features/render/render-dialog';
import { renderVideo, type RenderOptions, type RenderProgress } from '@/features/render/render';
import { AudioCredits, AudioPanel, audioEnd, createAudioClip, retimeClip, useAudioPlayback, validateAudioSource } from '@/features/audio';
import { CollisionControls, placedCollision, containsPoint, validateCollisionLayer } from '@/features/collision';
import { ProjectControls } from '@/features/project';
import { SemanticControls, semanticRevision, useBackgroundLabels } from '@/features/semantics';
import { useProject } from './use-project';
import { ProjectSceneControls } from './project-scene-controls';
import type { ProjectScene } from '@/features/project/collection';
import { actorEntity } from './actors';
import { ObjectContextMenu, ObjectToolStrip, type ObjectAction } from '@/features/object-actions';
import { useObjectEditing } from './use-object-editing';
import { placedEntity, withPlacement } from './object-edits';
import { PlacementControls } from './placement-controls';
import type { ActorRigInfo, AudioClip, AudioOption, AudioSource, TimelineClipChange, SceneLandmark, ModelLoadStatus, ActorTrack, ActorTool, ModelSource, ObjectContextRequest, CameraShot, PropShape, SceneProp, ShotSettings, Vector3Tuple, ViewMode, ViewportHandle, ViewportRegion } from '@/contracts';
import { propEntity } from './props';
import { detachProp, resolveProp } from '@/features/props/attachment';
import { describeTracks } from './tracks';
import { DirectorPanel, type DirectorPayload } from './director-panel';
import { landmarkContext, landmarkLabel, nextLandmarkLabel, withLandmarkEdit, MAX_LANDMARKS } from './landmarks';
import { LayerMenu } from './layer-menu';
import { LandmarkControls } from './landmark-controls';
import { planDirectorActions } from './director-action';
import { useViewportRegion } from './use-viewport-region';
import { SceneLayers } from './scene-layers';
// import { MovementControls } from './movement-controls';
import { useBackgroundFlightPlan } from './use-background-flight-plan';
import { FlightPlanPanel } from './flight-plan-panel';
import styles from './editor.module.css';

const MotionGlassPanel = motion.create(GlassPanel);
const LiveViewport = dynamic(() => import('@/features/viewport'), { ssr: false });

export function ViewerPreview() {
  const reduceMotion = useReducedMotion();
  useEffect(() => { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }, []);
  const [inspectorTab, setInspectorTab] = useState<'details' | 'object' | 'move' | 'actors' | 'props' | 'look' | 'project' | 'landmarks'>('details');
  const [renderOpen, setRenderOpen] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [semanticOpen, setSemanticOpen] = useState(false);
  const viewportHandle = useRef<ViewportHandle | null>(null);
  const [layerControlsHost, setLayerControlsHost] = useState<HTMLDivElement | null>(null);
  const [showCollision, setShowCollision] = useState(false);
  const [isolateCollision, setIsolateCollision] = useState(false);
  const [selectedCollisionId, setSelectedCollisionId] = useState('');
  const { manifest, loading, loadError } = useSceneManifest();
  const { document: project, updateDocument, importDocument, status: projectStatus, error: projectError, hydrated, retrySave, projectScenes, activeSceneId, projectId, addProjectScene, removeProjectScene, renameProjectScene, replaceCollection } = useProject(manifest);
  const directorSessionKey = `showcam-director:v1:${projectId ? `project:${encodeURIComponent(projectId)}` : `scene:${encodeURIComponent(project.sceneId)}`}`;
  const projectLatest = useRef(project); projectLatest.current = project;
  const sourceObjects = useMemo(() => (manifest?.objects ?? []).filter(object => object.type !== 'Camera' || !project.removedCameraIds?.includes(object.id)), [manifest, project.removedCameraIds]);
  const shot = project.shot;
  const actors = project.actors;
  const props = useMemo(() => project.props ?? [], [project.props]);
  const audio = useMemo(() => project.audio ?? [], [project.audio]);
  const titles = useMemo(() => project.titles ?? [], [project.titles]);
  const look = useMemo(() => effectiveLook(project.look, manifest?.asset?.kind), [project.look, manifest?.asset?.kind]);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioSelected, setAudioSelected] = useState<string | null>(null);
  const setShot = (next: CameraShot | null) => updateDocument(previous => ({ ...previous, shot: next }));
  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraId, setCameraId] = useState('');
  useEffect(() => { if (manifest) { setCameraId(manifest.activeCameraId); setSelectedId(manifest.activeCameraId); } }, [manifest]);
  const [mode, setMode] = useState<ViewMode>('orbit');
  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(false);
  const watching = mode === 'shot' && playing;
  const fuseOpened = useRef(false);
  useEffect(() => {
    if (!hydrated || !ready || projectId !== 'fuse-warmup' || !shot || fuseOpened.current) return;
    fuseOpened.current = true;
    setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setFrame(1); setSelectedId(null); setDirectorOpen(false);
  }, [hydrated, ready, projectId, shot]);
  const pavilionRouteOpened = useRef(false);
  useEffect(() => {
    if (!hydrated || !ready || projectId !== 'pavilion-scene-graph' || !shot || pavilionRouteOpened.current) return;
    pavilionRouteOpened.current = true;
    // Open the built-in route in its inspectable state: the viewport draws the
    // complete route and instantiates a pin for every flight waypoint.
    setMode('orbit');
    setFrame(1);
    viewportHandle.current?.framePath();
  }, [hydrated, ready, projectId, shot]);
  const greenhouseOpened = useRef(false);
  useEffect(() => {
    if (!hydrated || !ready || projectId !== 'a-little-tending' || !shot || greenhouseOpened.current) return;
    greenhouseOpened.current = true;
    setCameraId(AUTHORED_CAMERA_ID); setSelectedId(AUTHORED_CAMERA_ID); setMode('shot'); setFrame(1);
  }, [hydrated, ready, projectId, shot]);
  const [actorTool, setActorTool] = useState<ActorTool>('select');
  const [contextRequest, setContextRequest] = useState<ObjectContextRequest | null>(null);
  const pause = useCallback(() => setPlaying(false), []);
  const editing = useObjectEditing(project, updateDocument, frame, manifest?.fps || 24, pause);
  const backgroundLabels = useBackgroundLabels({ project, ready: ready && hydrated, supported: !!manifest && manifest.asset?.kind !== 'gsplat', scope: `${projectId ?? project.sceneId}:${activeSceneId ?? 'scene'}`, viewport: viewportHandle, onCommit: editing.commit, onPause: pause });
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [recentDirectorChange, setRecentDirectorChange] = useState<string | null>(null);
  const [modelSearchOpen, setModelSearchOpen] = useState(false);
  const modelDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = modelDialog.current;
    if (!dialog) return;
    if (modelSearchOpen && !dialog.open) dialog.showModal();
    if (!modelSearchOpen && dialog.open) dialog.close();
  }, [modelSearchOpen]);
  const [landmarkMode, setLandmarkMode] = useState(false);
  const landmarks = useMemo(() => project.landmarks ?? [], [project.landmarks]);
  const flightPlan = useBackgroundFlightPlan({ project, manifest, ready: ready && hydrated, scope: `${projectId ?? project.sceneId}:${activeSceneId ?? 'scene'}`, viewport: viewportHandle, commit: editing.commit, canUndo: editing.canUndo, undo: editing.undo });
  const setLandmarks = (next: SceneLandmark[]) => updateDocument(previous => ({ ...previous, landmarks: next }));
  const [activeLandmarkId, setActiveLandmarkId] = useState<string | null>(null);
  const [focusLandmarkLabelId, setFocusLandmarkLabelId] = useState<string | null>(null);
  const [landmarkUndo, setLandmarkUndo] = useState<SceneLandmark[][]>([]);
  const [landmarkHint, setLandmarkHint] = useState('Click a surface to place a landmark.');
  const [modelLoads, setModelLoads] = useState<ModelLoadStatus[]>([]);
  const [directorOpen, setDirectorOpen] = useState(false);
  const [directorPinned, setDirectorPinned] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1151px)');
    const update = () => { setDirectorPinned(desktop.matches); if (desktop.matches) setDirectorOpen(true); };
    update();
    desktop.addEventListener('change', update);
    return () => desktop.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (inspectorOpen && window.matchMedia('(max-width: 800px)').matches) setDirectorOpen(false); }, [inspectorOpen]);
  const [focusMode, setFocusMode] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const captureFrameRef = useRef<(() => void) | null>(null);
  const onRenderFrame = useCallback(() => captureFrameRef.current?.(), []);
  const exportCancelled = useRef(false);
  const previousView = useRef<{ mode: ViewMode; frame: number; cameraId: string; playing: boolean } | null>(null);
  useEffect(() => { if (mode !== 'orbit' || playing || focusMode) setLandmarkMode(false); }, [mode, playing, focusMode]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewRegion, setPreviewRegion] = useState<ViewportRegion | null>(null);
  useLayoutEffect(() => {
    if (!previewOpen || focusMode || mode !== 'orbit') { setPreviewRegion(null); return; }
    const viewport = viewportRef.current, preview = previewRef.current;
    if (!viewport || !preview) return;
    const canvasElement = viewport.querySelector('canvas');
    const measure = () => {
      const canvas = (canvasElement ?? viewport).getBoundingClientRect(), image = preview.getBoundingClientRect();
      if (!canvas.width || !canvas.height || !image.width || !image.height) return;
      const next = {
        left: Math.max(0, (image.left - canvas.left) / canvas.width),
        right: Math.min(1, (image.right - canvas.left) / canvas.width),
        top: Math.max(0, (image.top - canvas.top) / canvas.height),
        bottom: Math.min(1, (image.bottom - canvas.top) / canvas.height),
      };
      setPreviewRegion(previous => previous && Object.keys(next).every(key => previous[key as keyof ViewportRegion] === next[key as keyof ViewportRegion]) ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport); observer.observe(preview);
    if (canvasElement) observer.observe(canvasElement);
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [previewOpen, focusMode, mode, ready, inspectorOpen, directorOpen, directorPinned]);
  const frameRef = useRef(frame);
  const endFrame = manifest ? Math.max(manifest.frameEnd, shot ? shotEndFrame(shot, manifest.fps) : 0, ...actors.map(actor => actorEndFrame(actor, manifest.fps)), audio.length ? Math.round(audioEnd(audio) * manifest.fps) + 1 : 0) : 374;
  useEffect(() => { if (frame > endFrame) { setFrame(endFrame); setPlaying(false); } }, [frame, endFrame]);
  const playbackEnd = cameraId === AUTHORED_CAMERA_ID && shot && manifest ? shotEndFrame(shot, manifest.fps) : endFrame;
  const deliveryEnd = cameraId === AUTHORED_CAMERA_ID && shot && manifest ? shotEndFrame(shot, manifest.fps) : manifest?.frameEnd ?? endFrame;
  function openDelivery() {
    previousView.current = { mode, frame, cameraId, playing };
    setPlaying(false); setMode('shot'); setFrame(1); setExportError(''); setDeliveryOpen(true);
  }
  function closeDelivery() {
    if (exporting) return;
    const previous = previousView.current;
    setDeliveryOpen(false);
    if (previous) { setMode(previous.mode); setFrame(previous.frame); setCameraId(previous.cameraId); setPlaying(previous.playing); }
    previousView.current = null;
  }
  function cancelExport() {
    exportCancelled.current = true;
    setPlaying(false);
    recorderRef.current?.stop();
  }
  async function exportVideo() {
    const canvas = viewportRef.current?.querySelector('canvas');
    if (!canvas || !('captureStream' in canvas) || typeof MediaRecorder === 'undefined') { setExportError('Video recording is unavailable in this browser.'); return; }
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1.42E01E', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mimeType) { setExportError('This browser cannot record video.'); return; }
    setExportError(''); setPlaying(false); setFrame(1);
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    let stream: MediaStream | null = null;
    try {
      const fps = Math.min(manifest?.fps ?? 30, 60);
      stream = canvas.captureStream(0);
      const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
      if (typeof track.requestFrame === 'function') {
        const start = performance.now(); let captured = -1;
        captureFrameRef.current = () => {
          const due = Math.floor((performance.now() - start) * fps / 1000);
          if (due > captured) { track.requestFrame(); captured = due; }
        };
      } else {
        stream.getTracks().forEach(track => track.stop());
        stream = canvas.captureStream(fps);
      }
      const capture = stream;
      const chunks: BlobPart[] = [];
      exportCancelled.current = false;
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => { exportCancelled.current = true; setExportError('Video recording failed. Please try again.'); setPlaying(false); if (recorder.state !== 'inactive') recorder.stop(); };
      recorder.onstop = () => {
        captureFrameRef.current = null;
        capture.getTracks().forEach(track => track.stop());
        recorderRef.current = null;
        setPlaying(false);
        setExporting(false);
        if (exportCancelled.current || !chunks.length) return;
        const url = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${(project.name || manifest?.name || 'showcam').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'showcam'}-${cameraId === AUTHORED_CAMERA_ID ? 'draft' : 'camera'}.${mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      };
      recorder.start();
      setExporting(true); setPlaying(true);
    } catch {
      captureFrameRef.current = null;
      stream?.getTracks().forEach(track => track.stop());
      setExportError('Video recording could not start. Please try again.');
    }
  }
  useEffect(() => {
    if (!exporting || frame < deliveryEnd) return;
    const request = requestAnimationFrame(() => requestAnimationFrame(() => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    }));
    return () => cancelAnimationFrame(request);
  }, [exporting, frame, deliveryEnd]);
  const applyCollaborativeState = useCallback((next: Partial<CollaborationSceneState>) => {
    if ('selectedId' in next) setSelectedId(next.selectedId ?? null);
    if (next.cameraId !== undefined) setCameraId(next.cameraId);
    if (next.mode !== undefined) setMode(next.mode);
    if (next.frame !== undefined) setFrame(next.frame);
    if (next.playing !== undefined) setPlaying(next.playing);
    if (next.showPath !== undefined) setShowPath(next.showPath);
    if ('shot' in next) updateDocument(previous => ({ ...previous, shot: next.shot ?? null }));
  }, [updateDocument]);
  const collaborativeState = useMemo<CollaborationSceneState>(() => ({ selectedId, cameraId, mode, frame, playing, showPath, shot }), [selectedId, cameraId, mode, frame, playing, showPath, shot]);
  const collaboration = useSceneCollaboration(collaborativeState, applyCollaborativeState, hydrated ? manifest?.id ?? 'pavilion-v1' : null);
  useEffect(() => { frameRef.current = frame; }, [frame]);
  useEffect(() => {
    if (!playing || !manifest) return;
    const start = performance.now(), initial = frameRef.current;
    const playTo = deliveryOpen ? deliveryEnd : playbackEnd;
    let request: number;
    function tick(now: number) {
      const next = Math.min(playTo, initial + Math.floor((now - start) * manifest!.fps / 1000));
      setFrame(next);
      if (next === playTo) setPlaying(false);
      else request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, manifest, playbackEnd, deliveryOpen, deliveryEnd]);
  const onReady = useCallback(() => setReady(true), []);
  /** Selecting keeps the camera and navigation mode as they are; click the selection again (or Frame selection) to frame it. */
  const select = useCallback((id: string | null) => {
    if (id && id === selectedId && mode === 'orbit') viewportHandle.current?.frameSelection();
    setSelectedId(id);
    if (id) {
      setInspectorOpen(true);
      setInspectorTab('details');
    }
  }, [selectedId, mode]);
  const actorPoses = useMemo(() => actors.map(actor => {
    const seconds = (frame - 1) / (manifest?.fps || 24);
    const evaluated = { ...evaluateActor(actor, seconds), body: evaluateActorBody(actor, seconds) };
    return editing.actorPreview?.id === actor.id ? { ...evaluated, position: editing.actorPreview.position, heading: editing.actorPreview.heading } : evaluated;
  }), [actors, frame, manifest?.fps, editing.actorPreview]);
  // What the viewport found for each actor's body; unrigged characters are reported once so the user knows why.
  const [rigs, setRigs] = useState<Record<string, ActorRigInfo>>({});
  const rigNotices = useRef(new Set<string>());
  const setRigError = editing.setError;
  const onActorRig = useCallback((id: string, info: ActorRigInfo) => {
    setRigs(previous => ({ ...previous, [id]: info }));
    if (info.message && info.status !== 'loading' && !rigNotices.current.has(`${id}:${info.message}`)) { rigNotices.current.add(`${id}:${info.message}`); setRigError(info.message); }
  }, [setRigError]);
  const placements = useMemo(() => editing.placementPreview ? [...(project.placements ?? []).filter(item => item.id !== editing.placementPreview!.id), editing.placementPreview] : project.placements ?? [], [project.placements, editing.placementPreview]);
  const actorPaths = useMemo(() => actors.filter(actor => actor.id === selectedId).map(actorPath), [actors, selectedId]);
  const propsView = useMemo(() => {
    const preview = editing.propPreview;
    return props.map(prop => {
      const placed = resolveProp(movedProp(prop, (frame - 1) / (manifest?.fps || 24)), actorPoses.find(actor => actor.id === prop.attachment?.actorId));
      return preview?.id === prop.id ? { ...placed, position: preview.position, rotation: [placed.rotation[0], preview.heading, placed.rotation[2]] as Vector3Tuple } : placed;
    });
  }, [props, actorPoses, editing.propPreview, frame, manifest?.fps]);
  const objects = useMemo(() => [...sourceObjects.map(entity => placedEntity(entity, placements)), ...propsView.map(propEntity), ...actorPoses.map(actorEntity)], [sourceObjects, actorPoses, placements, propsView]);
  const selected = objects.find(object => object.id === selectedId);
  useEffect(() => {
    if (!selected && (inspectorTab === 'details' || inspectorTab === 'object')) setInspectorOpen(false);
  }, [selected, inspectorTab, inspectorOpen]);
  const selectedActor = actors.find(actor => actor.id === selectedId);
  const selectedProp = props.find(prop => prop.id === selectedId);
  const seconds = (frame - 1) / (manifest?.fps || 24);
  const editBlocked = !!selectedActor && (seconds > 60 || (selectedActor.marks.length >= 64 && !selectedActor.marks.some(mark => Math.abs(mark.time - seconds) < 1e-9)));
  const effectiveTool = editBlocked || selectedProp?.attachment || !selected || selected.type === 'Camera' ? 'select' : selectedActor || selectedProp || actorTool !== 'rotate' ? actorTool : 'move';
  const cameras = useMemo(() => sourceObjects.filter(object => object.type === 'Camera'), [sourceObjects]);
  const fallbackCameraId = cameras.find(camera => camera.id === manifest?.activeCameraId)?.id ?? cameras[0]?.id ?? (shot ? AUTHORED_CAMERA_ID : '');
  useEffect(() => {
    if (!hydrated || !manifest) return;
    if (!cameras.some(camera => camera.id === cameraId) && !(shot && cameraId === AUTHORED_CAMERA_ID)) {
      setCameraId(fallbackCameraId); setPlaying(false);
    }
    if (!fallbackCameraId && mode === 'shot') setMode('orbit');
    if (selectedId && project.removedCameraIds?.includes(selectedId)) setSelectedId(null);
  }, [hydrated, manifest, cameras, cameraId, shot, fallbackCameraId, mode, selectedId, project.removedCameraIds]);
  const measuredRegion = useViewportRegion(viewportRef, inspectorOpen, focusMode, inspectorTab, selectedId, directorOpen);
  const region = deliveryOpen ? { left: 0, right: 1, top: 0, bottom: 1 } : measuredRegion;
  // Actor subjects are linked: generation rides their marks and playback aims at where they are now.
  const motionFor = useCallback((id: string): SubjectMotion | undefined => {
    const actor = actors.find(item => item.id === id);
    return actor ? { height: actor.height, at: seconds => evaluateActor(actor, seconds), signature: actorSignature(actor) } : undefined;
  }, [actors]);
  const shotActor = shot ? actors.find(actor => actor.id === shot.subjectId) : undefined;
  const targetAt = useMemo(() => { const motion = shotActor && motionFor(shotActor.id); return motion ? motionTarget(motion) : undefined; }, [shotActor, motionFor]);
  const shotStale = shot?.subjectSignature && shotActor && actorSignature(shotActor) !== shot.subjectSignature ? `${shotActor.name}'s marks changed after this move was generated. The camera still aims at them; regenerate to update its path.` : undefined;
  const evaluate = useMemo(() => shot ? compileShot(shot, targetAt) : null, [shot, targetAt]);
  // Imported Blender animation uses frame/fps inside the viewport. Drafts start at frame 1 = t0.
  const pose = cameraId === AUTHORED_CAMERA_ID && evaluate ? evaluate((frame - 1) / (manifest?.fps || 24)) : null;
  const path = useMemo(() => shot ? createPathPreview(shot, targetAt) : null, [shot, targetAt]);
  const tracks = describeTracks(manifest, shot, endFrame, actors, audio, audioOpen ? audioSelected : null).filter(track => !project.removedCameraIds?.includes(track.id));
  useAudioPlayback(audio, playing, (frame - 1) / (manifest?.fps || 24), editing.setError);
  function revealPhoneViewport() { if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }
  function openFlightPath() {
    setPlaying(false);
    setMode('orbit');
    setFocusMode(false);
    setLandmarkMode(false);
    setDirectorOpen(false);
    setInspectorTab('move');
    setInspectorOpen(true);
    if (shot) {
      setCameraId(AUTHORED_CAMERA_ID);
      setShowPath(true);
      viewportHandle.current?.framePath();
    }
  }
  function useShot(next: CameraShot) { setShot(next); setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(1); revealPhoneViewport(); }
  async function optimizeCinemaPositions(positions: Vector3Tuple[], excludeId: string) {
    const collision = manifest?.asset?.kind === 'gsplat' ? project.collision : undefined;
    if (manifest?.asset?.kind === 'gsplat' && !collision?.reviewed) throw new Error('Review collision boxes in Project before using CinemaTraj.');
    const coverage = collision && placedCollision(collision, project.placements ?? []).region;
    if (coverage && positions.some(point => !containsPoint(coverage, point, .25))) throw new Error('The current path leaves the reviewed area. Adjust the path or review a larger area.');
    const obstacles = viewportHandle.current?.captureObstacles(excludeId) ?? [];
    if (!obstacles.length) throw new Error('Scene bounds are not ready for CinemaTraj.');
    const response = await fetch('/api/cinematraj', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ positions, obstacles: obstacles.map(box => [box.min, box.max]), ...(coverage ? { region: [coverage.min, coverage.max] } : {}) }) });
    const result = await response.json() as { error?: string; positions?: Vector3Tuple[] };
    if (!response.ok) throw new Error(result.error || 'CinemaTraj could not optimize the path.');
    if (!Array.isArray(result.positions) || result.positions.length !== positions.length || !result.positions.every(point => Array.isArray(point) && point.length === 3 && point.every(Number.isFinite))) throw new Error('CinemaTraj returned an invalid path.');
    if (coverage && result.positions.some(point => !containsPoint(coverage, point, .249))) throw new Error('The optimized path leaves the reviewed area. Review a larger area and try again.');
    if (projectLatest.current !== project) throw new Error('The project changed during optimization. Try again.');
    return result.positions;
  }
  async function optimizeCinemaDraft(current: CameraShot) {
    if (current.marks.some(mark => mark.cut) || current.anchorIds?.length) throw new Error('CinemaTraj needs a continuous path without fixed landmarks.');
    const input = cinemaTrajDraftInput(current, targetAt);
    const positions = await optimizeCinemaPositions(input.map(point => point.position), current.subjectId);
    useShot({ ...current, cinemaTraj: { positions: input.map((point, index) => ({ time: point.time, position: positions[index] })), targets: input.map(point => ({ time: point.time, position: point.target })) } });
    setInspectorOpen(true);
  }
  async function generateCinemaTraj(actorId: string, settings: ShotSettings) {
    const actor = actors.find(item => item.id === actorId);
    const snapshot = viewportHandle.current?.captureSubject(actorId);
    if (!actor || !snapshot) throw new Error('Wait for the actor and scene to load, then try again.');
    if (!Number.isFinite(settings.duration) || settings.duration < 1 || settings.duration > 60 || !Number.isFinite(settings.focalLength) || settings.focalLength < 8 || settings.focalLength > 300) throw new Error('Use a duration of 1–60 seconds and a lens of 8–300 mm.');
    const input = cinemaTrajInput(actor, time => evaluateActor(actor, time), snapshot.cameraPosition, settings);
    const positions = await optimizeCinemaPositions(input.positions.map(point => point.position), actorId);
    useShot({ ...cinemaTrajShot(actor, settings, input.positions.map((point, index) => ({ time: point.time, position: positions[index] })), input.targets), subjectSignature: actorSignature(actor) });
    setInspectorOpen(true);
  }
  /** Offline render through the shot camera (or the scene camera when there is no move). */
  async function renderShot(options: RenderOptions, progress: (value: RenderProgress) => void, signal: AbortSignal) {
    const viewport = viewportHandle.current;
    if (!viewport || !manifest || !ready) throw new Error('Wait for the scene to finish loading.');
    setPlaying(false); setMode('shot'); if (shot) setCameraId(AUTHORED_CAMERA_ID);
    const restore = frame;
    try {
      return await renderVideo({ options, viewport, sceneFps: manifest.fps || 24, seek: setFrame, clips: audio, onProgress: progress, signal, cuts: shot ? shotStarts(shot).slice(1) : [],
        finish: { look, titles, end: options.start + options.duration } });
    } finally { setFrame(restore); }
  }
  /** A .glb from this computer becomes a prop; the file stays in this browser. */
  async function importLocal(file: File | undefined) {
    if (!file) return;
    try {
      const source = await importLocalModel(file);
      const prop = createProp(`prop:${crypto.randomUUID()}`, source.name.slice(0, 100), { kind: 'model', ...source }, manifest?.asset?.kind === 'studio' ? [0, 0, 0] : spawnPoint(), { size: .5 });
      updateDocument(previous => ({ ...previous, props: [...(previous.props ?? []), prop] }));
      setPlaying(false); select(prop.id); setMode('orbit'); setModelSearchOpen(false);
    } catch (cause) { editing.setError(cause instanceof Error ? cause.message : 'The model could not be imported.'); }
  }
  function previewShot() { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  function seekShot(seconds: number) { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function focusSelected() { setMode('orbit'); viewportHandle.current?.frameSelection(); }
  function resetView() { setMode('orbit'); viewportHandle.current?.resetView(); }
  function openProjectScene(scene: ProjectScene & { projectId?: string }) {
    const url = new URL(window.location.href);
    url.searchParams.set('scene', scene.document.sceneId);
    url.searchParams.set('entry', scene.id);
    if (scene.projectId) url.searchParams.set('project', scene.projectId);
    window.location.assign(url);
  }
  const [pendingShot, setPendingShot] = useState<{ targetId: string; settings: ShotSettings; started: number } | null>(null);
  const latest = useRef({ motionFor, useShot, setError: editing.setError });
  latest.current = { motionFor, useShot, setError: editing.setError };
  // A Director camera move can target something added in the same reply; wait for the viewport to measure it.
  useEffect(() => {
    if (!pendingShot) return;
    const attempt = () => {
      const snapshot = viewportHandle.current?.captureSubject(pendingShot.targetId);
      if (snapshot) {
        try { const next = generateShot(snapshot, pendingShot.settings, latest.current.motionFor(pendingShot.targetId)); setSelectedId(pendingShot.targetId); latest.current.useShot(next); }
        catch (cause) { latest.current.setError(cause instanceof Error ? cause.message : 'The camera move could not be generated.'); }
        setPendingShot(null); return true;
      }
      const prop = props.find(item => item.id === pendingShot.targetId);
      const actor = actors.find(item => item.id === pendingShot.targetId);
      const uid = prop?.source.kind === 'model' ? prop.source.uid : actor?.model?.uid;
      const loading = modelLoads.find(model => model.uid === uid);
      if (loading?.state === 'error') { latest.current.setError('The camera subject could not load. Retry the model, then ask for the camera move again.'); setPendingShot(null); return true; }
      if (loading?.state === 'queued' || loading?.state === 'loading') return false;
      if (performance.now() - pendingShot.started > 20000) { latest.current.setError('The camera subject did not finish loading, so no camera move was created.'); setPendingShot(null); return true; }
      return false;
    };
    if (attempt()) return;
    const timer = setInterval(() => { if (attempt()) clearInterval(timer); }, 250);
    return () => clearInterval(timer);
  }, [pendingShot, props, actors, modelLoads]);
  /** Verify attribution with the provider, then place the clip at the playhead; music fills the rest of the timeline. */
  async function addAudio(option: AudioOption) {
    const response = await fetch(`/api/audio/${option.provider}/${encodeURIComponent(option.id)}`);
    const body = await response.json().catch(() => ({})) as { source?: AudioSource; error?: string };
    if (!response.ok || !body.source) throw new Error(body.error || `The audio could not be verified (${response.status}).`);
    validateAudioSource(body.source);
    const fps = manifest?.fps || 24;
    const clip = createAudioClip(`audio:${crypto.randomUUID()}`, body.source, (frame - 1) / fps, { timelineEnd: (endFrame - 1) / fps });
    updateDocument(previous => ({ ...previous, audio: [...(previous.audio ?? []), clip] }));
    setPlaying(false); setAudioSelected(clip.id);
  }
  function changeAudio(next: AudioClip) { updateDocument(previous => ({ ...previous, audio: (previous.audio ?? []).map(clip => clip.id === next.id ? next : clip) })); setPlaying(false); }
  function removeAudio(id: string) { editing.commit({ ...project, audio: audio.filter(clip => clip.id !== id) }); setAudioSelected(null); }
  /** Timeline drag/trim/nudge; frames are authored (seconds × fps + 1). Commits are undoable. */
  function retimeAudio(clipId: string, change: TimelineClipChange) {
    const clip = audio.find(item => item.id === clipId);
    if (!clip) return;
    const fps = manifest?.fps || 24;
    try {
      const next = retimeClip(clip, { mode: change.mode, start: (change.startFrame - 1) / fps, end: (change.endFrame - 1) / fps });
      editing.commit({ ...project, audio: audio.map(item => item.id === clipId ? next : item) });
      setAudioSelected(clipId); setAudioOpen(true);
    } catch (cause) { editing.setError(cause instanceof Error ? cause.message : 'The clip could not be moved.'); }
  }
  function duplicateAudio(clip: AudioClip) {
    if (audio.length >= 24) { editing.setError('Keep at most 24 audio clips.'); return; }
    try {
      const copy = retimeClip({ ...clip, id: `audio:${crypto.randomUUID()}` }, { mode: 'move', start: clip.start + clip.duration });
      editing.commit({ ...project, audio: [...audio, copy] }); setAudioSelected(copy.id);
    } catch (cause) { editing.setError(cause instanceof Error ? cause.message : 'The clip could not be duplicated.'); }
  }
  function applyDirectorAction({ actions, models, audio: audioSources, rigged }: DirectorPayload): string {
    if (!manifest || !hydrated) throw new Error('Wait for the scene and project to load before changing them.');
    const fps = manifest.fps;
    const plan = planDirectorActions(project, actions, {
      audio: audioSources ?? {}, timelineEnd: (endFrame - 1) / fps,
      objects: sourceObjects, presetIds: CAMERA_MOVE_PRESETS.map(preset => preset.id), frameEnd: Math.max(endFrame, 60 * fps + 1), fps, models, riggedModels: rigged, rigs,
      actorOrigin: manifest.actorOrigin ?? [-7, 1.4, 2], selectedId, seconds: (frame - 1) / fps, newId: prefix => `${prefix}:${crypto.randomUUID()}`,
    });
    if (plan.document !== project) editing.commit(plan.document);
    if (plan.document.landmarks !== project.landmarks) {
      setLandmarkMode(false); setFocusLandmarkLabelId(null); setLandmarkUndo([]);
      if (!plan.document.landmarks?.some(mark => mark.id === activeLandmarkId)) setActiveLandmarkId(null);
    }
    if (plan.document !== project) setRecentDirectorChange(plan.summaries.join(' '));
    for (const effect of plan.effects) switch (effect.type) {
      case 'select': select(effect.id); setMode(effect.mode); break;
      case 'camera': setCameraId(effect.id); select(effect.id); setMode('shot'); break;
      case 'seek': setPlaying(false); setFrame(effect.frame); break;
      case 'play': if (frame >= playbackEnd) setFrame(1); setPlaying(true); break;
      case 'pause': setPlaying(false); break;
      case 'frameSelection': focusSelected(); break;
      case 'resetCamera': setCameraId(manifest.activeCameraId); setPlaying(false); setFrame(1); break;
      case 'shot': setPendingShot({ targetId: effect.targetId, settings: effect.settings, started: performance.now() }); break;
    }
    return plan.summaries.join(' ') || 'No scene change requested.';
  }
  /** Built when a direction is sent (not every render): structured, spatial state the Director reasons from. */
  function directorContext(): string {
    const round = (value: number) => Math.round(value * 100) / 100;
    const degrees = (value: number) => Math.round(value * 180 / Math.PI);
    const origin = manifest?.actorOrigin ?? [-7, 1.4, 2];
    const view = viewportHandle.current?.viewState();
    return JSON.stringify({
      scene: manifest?.name ?? 'Loading scene', sceneKind: manifest?.asset?.kind === 'gsplat' ? 'captured Gaussian splat (one environment; furniture is not selectable)' : 'GLB with selectable objects',
      units: 'metres, Y up. Positions are base/feet points. Angles in degrees; yaw/heading 0 faces -Z, +90 faces -X.',
      semanticRegions: project.semantics?.revision === semanticRevision(project) ? project.semantics.regions : [],
      semanticNote: 'AI-suggested object groups with measured bounds. Unreviewed labels are uncertain. Region bounds are framing bounds, not free space or collision clearance.',
      landmarks: landmarkContext(landmarks), activeLandmarkId, landmarkNote: 'Named, saved world-space positions at the recorded frame. Use the selected landmark for here; resolve named landmarks by label. Flight landmarks are camera-eye route anchors, not actor feet positions. A floor landmark is an estimated plane, not a mesh surface.',
      floorY: round(origin[1]), actorOrigin: origin.map(round),
      view: view ? { position: view.position.map(round), forward: view.forward.map(round) } : null,
      selected: selected ? { id: selected.id, name: selected.name, type: selected.type } : null, camera: cameraId, mode, frame, fps: manifest?.fps || 24, timelineEndFrame: endFrame,
      draftShot: shot ? { name: shot.name, subjectId: shot.subjectId, followsActor: !!shotActor, duration: shot.settings.duration, presetId: shot.settings.presetId } : null,
      actors: actors.map(actor => {
        const pose = actorPoses.find(item => item.id === actor.id), rig = rigs[actor.id];
        return { id: actor.id, name: actor.name, height: actor.height, color: actor.color, character: actor.model?.name ?? null, body: rig?.body ?? (actor.model ? 'model' : 'mannequin'), animatable: rig ? rig.status === 'animatable' || rig.status === 'loading' : true, rigNote: rig?.message ?? rig?.note ?? null, ownClips: rig?.clips.map(clip => [clip.name, clip.duration]) ?? [],
          feetNow: pose?.position.map(round), headingNow: pose ? degrees(pose.heading) : 0, marks: actor.marks.slice(0, 16).map(mark => [round(mark.time), ...mark.position.map(round), degrees(mark.heading)]),
          motions: (actor.motions ?? []).map(motion => [motionLabel(motion.source), round(motion.start), round(motion.duration)]) };
      }),
      props: propsView.map(prop => ({ id: prop.id, name: prop.name, source: prop.source.kind === 'model' ? `${prop.source.provider}:${prop.source.uid}` : prop.source.shape, position: prop.position.map(round), rotationDeg: prop.rotation.map(degrees), size: prop.size, color: prop.color ?? null, follows: prop.attachment?.actorId ?? null })),
      placements: project.placements ?? [],
      timeline: { seconds: round((endFrame - 1) / (manifest?.fps || 24)), shotSeconds: shot ? shot.settings.duration : null },
      audio: audio.map(clip => ({ id: clip.id, kind: clip.kind, name: clip.source.name, start: round(clip.start), duration: round(clip.duration), volume: round(clip.volume) })),
      objects: sourceObjects.map(object => [object.id, object.name, object.type, ...placedEntity(object, project.placements ?? []).positionWeb.map(round)]),
      cameraPresets: CAMERA_MOVE_PRESETS.map(preset => [preset.id, preset.name]),
    });
  }
  function exportSceneGraph() {
    if (!manifest || !ready) return;
    const graph = buildSceneGraph(manifest, project, id => {
      const snapshot = viewportHandle.current?.captureSubject(id);
      return snapshot ? { min: snapshot.min, max: snapshot.max } : null;
    });
    const url = URL.createObjectURL(new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.sceneId}-scene-graph.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function spawnPoint(): Vector3Tuple {
    const origin = manifest?.actorOrigin ?? [-7, 1.4, 2];
    const view = viewportHandle.current?.viewState();
    const length = view ? Math.hypot(view.forward[0], view.forward[2]) : 0;
    if (!view || length < 1e-3) return [origin[0], origin[1], origin[2]];
    // 2.5 m in front of the current view, on the scene's estimated floor.
    return [view.position[0] + view.forward[0] / length * 2.5, origin[1], view.position[2] + view.forward[2] / length * 2.5].map(value => Math.max(-1000, Math.min(1000, value))) as Vector3Tuple;
  }
  function addPrimitive(shape: PropShape) {
    const prop = createProp(`prop:${crypto.randomUUID()}`, `${shape[0].toUpperCase()}${shape.slice(1)}`, { kind: 'primitive', shape }, spawnPoint());
    updateDocument(previous => ({ ...previous, props: [...(previous.props ?? []), prop] }));
    setPlaying(false); select(prop.id); setMode('orbit');
  }
  async function addModel(uid: string, as: 'prop' | 'actor' | 'replace') {
    const response = await fetch(`/api/models/${encodeURIComponent(uid)}`);
    const body = await response.json().catch(() => ({})) as { source?: ModelSource; error?: string };
    if (!response.ok || !body.source) throw new Error(body.error || `The model could not be verified (${response.status}).`);
    const source = body.source;
    validateModelSource(source);
    if (as === 'prop') {
      const prop = createProp(`prop:${crypto.randomUUID()}`, source.name, { kind: 'model', ...source }, spawnPoint(), { size: .8 });
      updateDocument(previous => ({ ...previous, props: [...(previous.props ?? []), prop] }));
      setPlaying(false); select(prop.id); setMode('orbit');
    } else if (as === 'replace') {
      // Re-dress the selected character: marks, motions, camera links and name are kept; undo restores the old body.
      const target = actors.find(actor => actor.id === selectedId);
      if (!target) throw new Error('Select a character first, then choose its new model.');
      const next: ActorTrack = { ...target, model: source };
      validateActor(next);
      editing.commit({ ...project, actors: project.actors.map(actor => actor.id === target.id ? next : actor) });
      setPlaying(false);
    } else {
      if (actors.length >= 8) throw new Error('Eight actors maximum. Remove an actor to add another.');
      const actor: ActorTrack = { ...createActor(`actor:${crypto.randomUUID()}`, source.name.slice(0, 100), spawnPoint()), model: source };
      validateActor(actor);
      updateDocument(previous => ({ ...previous, actors: [...previous.actors, actor] }));
      setPlaying(false); select(actor.id); setMode('orbit');
    }
  }
  function changeProp(next: SceneProp) { updateDocument(previous => ({ ...previous, props: (previous.props ?? []).map(prop => prop.id === next.id ? next : prop) })); setPlaying(false); }
  function removeProp(id: string) {
    editing.commit({ ...project, props: props.filter(prop => prop.id !== id) });
    if (selectedId === id) setSelectedId(null);
  }
  function stopFollowing(id: string) {
    const prop = props.find(item => item.id === id);
    if (!prop?.attachment) return;
    editing.commit({ ...project, props: props.map(item => item.id === id ? detachProp(item, actorPoses.find(actor => actor.id === prop.attachment!.actorId)) : item) });
  }
  function updateCollaboratorCursor(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    collaboration.updateCursor({ x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height });
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
  function removeCamera(id: string) {
    if (!cameras.some(camera => camera.id === id)) return;
    editing.commit({ ...project, removedCameraIds: [...(project.removedCameraIds ?? []), id] });
    setContextRequest(null);
  }
  function removeActor(id: string) {
    const pose = actorPoses.find(actor => actor.id === id);
    editing.commit({ ...project, actors: actors.filter(actor => actor.id !== id), props: props.map(prop => prop.attachment?.actorId === id ? detachProp(prop, pose) : prop) });
    if (selectedId === id) setSelectedId(null);
    setPlaying(false);
  }
  function seekActor(seconds: number) { setPlaying(false); setFrame(Math.round(seconds * (manifest?.fps || 24)) + 1); }
  function previewActors() { setCameraId(manifest?.activeCameraId ?? ''); setFrame(1); setPlaying(true); revealPhoneViewport(); }
  function openContext(request: ObjectContextRequest) {
    pause(); setSelectedId(request.id); setContextRequest(request);
  }
  function chooseTool(tool: ActorTool) { pause(); setInspectorTab(selectedActor ? 'actors' : selectedProp ? 'props' : 'object'); setMode('orbit'); setActorTool(tool); setContextRequest(null); revealPhoneViewport(); }
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
    ...(contextEntity.type === 'Camera' ? [{ id: 'view', label: 'View through camera', onSelect: () => { setCameraId(contextEntity.id); setMode('shot'); } }, { id: 'delete', label: 'Delete camera', danger: true, onSelect: () => removeCamera(contextEntity.id) }] : [
      { id: 'move', label: 'Move object', disabled: editBlocked, onSelect: () => chooseTool('move') },
      ...(contextEntity.type === 'Prop' ? [
        { id: 'rotate', label: 'Rotate prop', onSelect: () => chooseTool('rotate') },
        { id: 'camera', label: 'Create camera move', onSelect: () => { setInspectorOpen(true); setInspectorTab('move'); } },
        { id: 'delete', label: 'Delete prop', danger: true, onSelect: () => removeProp(contextEntity.id) },
      ] : contextEntity.type === 'Actor' ? [
        { id: 'camera', label: 'Create following camera move', onSelect: () => { setInspectorOpen(true); setInspectorTab('move'); } },
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
  const toolHint = selectedProp?.attachment ? 'This prop follows an actor. Stop following to move it independently.' : editBlocked ? 'Choose an existing mark or a time within 60 s to edit.' : selectedActor ? `Frame ${frame} · Edits a movement mark · Esc cancels` : selectedProp ? 'Prop placement · All frames · Esc cancels' : 'Scene placement · All frames · Esc cancels';
  const inspectorKey = inspectorTab === 'object' || inspectorTab === 'details' ? `${inspectorTab}:${selectedId || 'empty'}` : inspectorTab;
  const editSelectedDetails = () => setInspectorTab(selectedProp ? 'props' : selectedActor ? 'actors' : selected?.type === 'Camera' && cameraId === AUTHORED_CAMERA_ID ? 'move' : 'object');
  function editLandmarks(next: SceneLandmark[]) {
    if (JSON.stringify(next) === JSON.stringify(landmarks)) return;
    setLandmarkUndo(previous => [...previous.slice(-19), landmarks]); updateDocument(previous => withLandmarkEdit(previous, next));
  }
  function placeLandmark(id: string | null) {
    setActiveLandmarkId(id); setLandmarkMode(true); setMode('orbit'); setPlaying(false); setActorTool('select');
    setLandmarkHint(id ? 'Click a new surface location. Escape cancels the current drag.' : 'Click a surface to place a landmark.');
    if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false);
  }
  function commitLandmark(mark: SceneLandmark) {
    const existing = landmarks.find(item => item.id === mark.id);
    if (!existing && landmarks.length >= MAX_LANDMARKS) { setLandmarkHint('Remove a landmark before adding another.'); return; }
    const next: SceneLandmark = { ...mark, label: existing?.label || mark.label || nextLandmarkLabel(landmarks),
      ...(existing?.kind === 'flight' ? { kind: 'flight', entityId: null, position: [mark.position[0], existing.position[1], mark.position[2]] as Vector3Tuple } : {}) };
    editLandmarks(existing ? landmarks.map(item => item.id === mark.id ? next : item) : [...landmarks, next]);
    setActiveLandmarkId(next.id); setLandmarkMode(false);
    setFocusLandmarkLabelId(next.id);
  }
  const landmarkControls = <LandmarkControls landmarks={landmarks} activeId={activeLandmarkId} placing={landmarkMode} hint={landmarkHint} canUndo={landmarkUndo.length > 0} focusLabelId={focusLandmarkLabelId} onLabelFocused={() => setFocusLandmarkLabelId(null)}
      onSelect={id => { setActiveLandmarkId(id); setLandmarkMode(false); setFocusLandmarkLabelId(id); }} onPlace={placeLandmark} onStop={() => setLandmarkMode(false)}
      onLabel={(id, label) => { const next = landmarkLabel(label, landmarks, id); editLandmarks(landmarks.map(mark => mark.id === id ? { ...mark, label: next } : mark)); }}
      onRemove={id => { const remaining = landmarks.filter(mark => mark.id !== id); editLandmarks(remaining); setActiveLandmarkId(remaining.at(-1)?.id ?? null); setLandmarkMode(false); }}
      onUndo={() => { const previous = landmarkUndo.at(-1); if (previous) { setLandmarks(previous); setLandmarkUndo(history => history.slice(0, -1)); setActiveLandmarkId(previous.find(mark => mark.id === activeLandmarkId)?.id ?? previous.at(-1)?.id ?? null); setLandmarkMode(false); } }}
      onAsk={() => { setLandmarkMode(false); setDirectorOpen(true); if (window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); }} />;
  const workStatus = <>
    {modelLoads.length > 0 && <details className={styles.modelLoadPanel} open={modelLoads.some(model => model.state !== 'ready')}>
      <summary>{modelLoads.filter(model => model.state === 'ready').length} / {modelLoads.length} models ready</summary>
      <div role="status" aria-live="polite">{modelLoads.map(model => <div key={model.uid} className={styles.modelLoadRow}><strong>{model.name}</strong><span>{model.message}</span>{model.progress !== undefined && model.state === 'loading' && <progress value={model.progress} max={100} aria-label={`${model.name} archive download`} />}{model.state === 'error' && <Button size="sm" onClick={() => viewportHandle.current?.retryModel?.(model.uid)}>Retry {model.name}</Button>}</div>)}</div>
    </details>}

  </>;
  return <MotionConfig reducedMotion="user" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 32, mass: .8 }}><div className={`${styles.root} viewer-shell`}><main id="main" data-inspector-open={inspectorOpen} onKeyDown={event => { if (event.target instanceof HTMLCanvasElement && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) { event.preventDefault(); selectedActions(); } }} className={cx('viewer-stage', 'live-stage', actors.length > 0 && 'has-actor-tracks', focusMode && 'is-focus-mode', watching && styles.watching, deliveryOpen && styles.deliveryMode, directorOpen && 'is-director-open', directorPinned && directorOpen && !focusMode && 'is-director-pinned')}>
    <div ref={viewportRef} className={cx('live-canvas', mode === 'shot' && 'live-canvas--shot')} data-mode={mode} onPointerMoveCapture={updateCollaboratorCursor} onPointerLeave={() => collaboration.updateCursor(null)}>
      {manifest ? <LiveViewport look={look} titles={titles} timelineSeconds={(endFrame - 1) / (manifest.fps || 24)} onActorRig={onActorRig} layerControlsContainer={layerControlsHost} recording={exporting} onRenderFrame={onRenderFrame} onOpenSemanticLabels={() => { setSemanticOpen(true); setDirectorOpen(false); setInspectorOpen(false); setPlaying(false); }} collision={project.collision} showCollision={showCollision && mode === 'orbit' && !focusMode && !deliveryOpen} isolateCollision={isolateCollision && mode === 'orbit' && !deliveryOpen} selectedCollisionId={selectedCollisionId} landmarkMode={!deliveryOpen && landmarkMode && mode === 'orbit' && !playing} landmarks={landmarks} activeLandmarkId={activeLandmarkId} hideLandmarks={mode === 'shot' || focusMode || deliveryOpen} preview={mode === 'orbit' && !!fallbackCameraId && !deliveryOpen && previewOpen && !focusMode && previewRegion ? { region: previewRegion, cameraId, pose } : null} onLandmarkSelect={id => { setActiveLandmarkId(id); setPlaying(false); setFocusLandmarkLabelId(id); }} onLandmark={commitLandmark} onLandmarkHint={setLandmarkHint} onModelStatus={setModelLoads} actorTool={effectiveTool} onActorTransform={editing.actorTransform} props={propsView} onPropTransform={editing.propTransform} placements={placements} onSceneTransform={editing.sceneTransform} onContextRequest={openContext} actors={actorPoses} actorPaths={actorPaths} pose={pose} path={deliveryOpen ? null : path} region={region} handle={viewportHandle} showPath={!deliveryOpen && showPath} manifest={manifest} mode={mode} frame={frame} cameraId={cameraId} selectedId={deliveryOpen || watching ? null : selectedId} onSelect={deliveryOpen || watching ? () => {} : select} showCameras={false} onReady={onReady} /> : <div className="scene-status" role={loadError ? 'alert' : 'status'}><h2>{loadError ? 'The scene could not load' : 'Opening scene'}</h2><p>{loadError ? 'Check the connection and reload the viewer.' : 'Preparing the 3D scene…'}</p>{loadError && <Button onClick={() => window.location.reload()}>Reload viewer</Button>}</div>}
      <CollaborationCursors collaborators={collaboration.collaborators} />
      {semanticOpen && <SemanticControls project={project} ready={ready && hydrated && manifest?.asset?.kind !== 'gsplat'} job={backgroundLabels} viewport={viewportHandle} onCommit={editing.commit} onClose={() => setSemanticOpen(false)} canUndo={editing.canUndo} onUndo={editing.undo} />}
      {ready && hydrated && manifest?.asset?.kind === 'studio' && !props.length && !actors.length && !focusMode && <GlassPanel className={styles.studioWelcome} density="default" aria-labelledby="studio-welcome">
        <h2 id="studio-welcome">Your product studio is ready</h2>
        <p>The stage is lit and waiting for a product. Bring your own model or pick a free one, then light it and render.</p>
        <ol>
          <li><strong>Add a product.</strong> Import a .glb from your computer, or search free models.</li>
          <li><strong>Light it.</strong> Details → Look: presets, studio rig, reflections, lens and film settings.</li>
          <li><strong>Move the camera.</strong> Frame a view, then Camera move → Start a shot from this view.</li>
          <li><strong>Render.</strong> The clapperboard in the toolbar exports an MP4.</li>
        </ol>
        <div className={styles.studioWelcomeActions}>
          <label className={styles.localImportPrimary}><Upload size={15} />Import a .glb<input type="file" accept=".glb,model/gltf-binary" onChange={event => { void importLocal(event.target.files?.[0]); event.target.value = ''; }} /></label>
          <Button onClick={() => setModelSearchOpen(true)}><Search size={15} />Find a free model</Button>
          <Button variant="ghost" onClick={() => { setInspectorOpen(true); setInspectorTab('look'); }}>Open the Look panel</Button>
        </div>
      </GlassPanel>}
    </div>
    <div className="stage-heading"><a className={styles.projectsLink} href="/"><ArrowLeft size={13} /> Projects</a><SceneLayers objects={objects} selectedId={selectedId} onSelect={select} /><div className={styles.sceneHeadingText}><h1>{projectId ? projectScenes.find(scene => scene.id === activeSceneId)?.name ?? manifest?.name ?? 'Camvas' : manifest?.name ?? 'Camvas'}</h1><p><span className="live-dot" />{ready ? `Live 3D · ${manifest?.asset?.kind === 'gsplat' ? 'Gaussian splat' : manifest?.asset?.kind === 'studio' ? 'Product studio' : 'GLB scene'}` : 'Loading scene'}</p><div className={styles.scenePicker}><label className="scene-switcher"><span className="sr-only">Scene</span>{projectId ? <select aria-label="Scene" value={activeSceneId ?? ''} disabled={!hydrated || !activeSceneId} onChange={event => { const scene = projectScenes.find(item => item.id === event.target.value); if (scene) openProjectScene(scene); }}>{projectScenes.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select> : <select aria-label="Scene" value={manifest?.id ?? 'residence-9d09ab82'} disabled={!manifest} onChange={event => { const url = new URL(window.location.href); url.searchParams.set('scene', event.target.value); window.location.assign(url); }}>{SCENES.map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select>}</label><SceneActions disabled={!hydrated || projectStatus === 'error'} count={projectId ? projectScenes.length : 1} name={projectScenes.find(scene => scene.id === activeSceneId)?.name ?? 'scene'} onAdd={assetId => openProjectScene(addProjectScene(assetId))} onRemove={() => { if (activeSceneId) openProjectScene(removeProjectScene(activeSceneId)); }} /></div>{projectStatus === 'error' && <button className="project-warning" onClick={() => { setInspectorTab('project'); setInspectorOpen(true); }}>Project needs attention</button>}</div></div>
    <CollaborationBar status={collaboration.status} roomId={collaboration.roomId} collaborators={collaboration.collaborators} identity={collaboration.identity} onName={collaboration.updateName} onShare={collaboration.share} />
    {!deliveryOpen && <Button className={styles.exportLauncher} size="sm" onClick={openDelivery} disabled={!ready || !manifest || !fallbackCameraId}><Download size={16} /> Export</Button>}
    {deliveryOpen && <div className={styles.deliveryShell}>
      <button className={styles.deliveryBack} type="button" onClick={closeDelivery} disabled={exporting}><ArrowLeft size={17} /> Back to editor</button>
      <div className={styles.deliveryPreviewLabel}><span>Final video preview</span><strong>{cameraId === AUTHORED_CAMERA_ID ? shot?.name : cameras.find(camera => camera.id === cameraId)?.name ?? 'Scene camera'}</strong></div>
      <aside className={styles.deliveryPanel} aria-label="Video export">
        <div className={styles.deliveryEyebrow}>Deliver</div><h2>Final video</h2>
        <p>Review the selected camera, then export the full take as a video.</p>
        <label className={styles.deliveryField}>Camera<select value={cameraId} disabled={exporting} onChange={event => { setCameraId(event.target.value); setFrame(1); }}>
          {!fallbackCameraId && <option value="">No cameras</option>}{shot && <option value={AUTHORED_CAMERA_ID}>{shot.name} · draft</option>}{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}{camera.animated ? ' · animated' : ''}</option>)}
        </select></label>
        <div className={styles.deliveryMeta}><div><span>Duration</span><strong>{((deliveryEnd - 1) / (manifest?.fps || 24)).toFixed(1)} s</strong></div><div><span>Frame rate</span><strong>{manifest?.fps ?? 24} fps</strong></div><div><span>Format</span><strong>WebM / MP4</strong></div></div>
        <div className={styles.deliveryTransport}><Button variant="secondary" size="sm" onClick={() => { if (frame >= deliveryEnd) setFrame(1); setPlaying(!playing); }} disabled={exporting}><Play size={15} />{playing ? 'Pause preview' : 'Play preview'}</Button><span>Frame {Math.min(frame, deliveryEnd)} / {deliveryEnd}</span></div>
        <input className={styles.deliverySeek} type="range" aria-label="Preview frame" min={1} max={deliveryEnd} value={Math.min(frame, deliveryEnd)} disabled={exporting} onChange={event => { setPlaying(false); setFrame(Number(event.target.value)); }} />
        <div className={styles.deliveryActions}>{exporting ? <Button onClick={cancelExport} variant="secondary">Cancel export</Button> : <Button onClick={() => void exportVideo()} disabled={!ready}><Download size={16} /> Export video</Button>}</div>
        {exporting && <p role="status">Recording frame {Math.min(frame, deliveryEnd)} of {deliveryEnd}… Keep this tab open.</p>}
        {exportError && <p className={styles.deliveryError} role="alert">{exportError}</p>}
        <p className={styles.deliveryNote}>The video records in real time from this browser. It downloads when playback finishes.</p>
      </aside>
    </div>}
    <GlassPanel density="default" className="viewport-tools live-tools" role="toolbar" aria-label="Viewport controls">
      <SegmentedControl label="Navigation mode" value={mode} onChange={next => { setPlaying(false); setMode(next); }} options={[{ value: 'orbit', label: 'Explore', icon: <Orbit size={15} /> }, { value: 'shot', label: 'Camera view', icon: <Camera size={15} /> }]} />
      <Button className={styles.flightPathButton} variant="ghost" size="sm" aria-label="Flight path" title={shot ? 'Show flight path and camera controls' : 'Create a camera flight path'} aria-expanded={inspectorOpen && inspectorTab === 'move'} disabled={!ready || !hydrated} onClick={openFlightPath}><Route size={16} /><span>Flight path</span></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Landmarks" title="Landmarks" aria-expanded={inspectorOpen && inspectorTab === 'landmarks'} aria-controls={inspectorOpen && inspectorTab === 'landmarks' ? 'landmark-panel' : undefined} disabled={!ready} onClick={() => { const closing = inspectorOpen && inspectorTab === 'landmarks'; setInspectorTab(closing ? 'details' : 'landmarks'); setInspectorOpen(!closing); if (closing) setLandmarkMode(false); }}><MapPin size={16} /></Button>
      <LayerMenu disabled={!ready} onContainer={setLayerControlsHost} />
      <span className="tool-divider" />
      <Button variant="ghost" size="sm" iconOnly aria-label="Reset view" onClick={resetView} title="Reset view"><RotateCcw size={16} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Focus view" aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)} title="Hide panels"><Focus size={17} /></Button>
      <Button variant="ghost" size="sm" iconOnly aria-label="Render video" title="Render video" disabled={!ready} onClick={() => setRenderOpen(true)}><Clapperboard size={16} /></Button>
    </GlassPanel>
    <div className="reference-select camera-select"><Camera size={15} /><label className="sr-only" htmlFor="shot-camera">Active camera</label><select id="shot-camera" disabled={!fallbackCameraId} value={cameraId} onChange={event => { setCameraId(event.target.value); setMode('shot'); if (event.target.value !== AUTHORED_CAMERA_ID) { setSelectedId(event.target.value); setInspectorTab('object'); setInspectorOpen(true); } else { setInspectorOpen(true); setInspectorTab('move'); } }}>{!fallbackCameraId && <option value="">No cameras</option>}{shot && <option value={AUTHORED_CAMERA_ID}>{shot.name} · draft</option>}{cameras.map(camera => <option key={camera.id} value={camera.id}>{camera.name}{camera.animated ? ' · animated' : ''}</option>)}</select><ChevronDown size={13} /></div>
    <div className={cx(styles.scenePanelStack, inspectorOpen && styles.scenePanelStackExpanded)}>
    <ObjectBrowser objects={objects} loading={loading} selectedId={selectedId} onSelect={select} onContextRequest={openContext} onSearchModels={() => setModelSearchOpen(true)} />
    <div className={styles.inspectorDock} data-open={inspectorOpen}>
    <AnimatePresence initial={false}>{inspectorOpen && <MotionGlassPanel key="inspector" initial={{ opacity: 0, x: -18, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -14, scale: .985 }} className="inspector side-panel" data-section={inspectorTab} density="default" role="region" aria-label="Details" tabIndex={0}>
      <div className="panel-heading"><h2>{inspectorTab === 'landmarks' ? 'Landmarks' : inspectorTab === 'details' ? 'Details' : 'Edit details'}</h2>{selected && <Button size="sm" variant="ghost" iconOnly aria-label="Object actions" title="Object actions" aria-haspopup="menu" onClick={selectedActions}><Ellipsis size={18} /></Button>}{shot && <Badge tone="accent">Draft</Badge>}<Button size="sm" variant="ghost" iconOnly aria-label={inspectorTab === 'landmarks' ? 'Close landmarks' : 'Close details'} onClick={() => { setInspectorOpen(false); setLandmarkMode(false); }}><X size={16} /></Button></div>
      {!focusMode && (landmarkMode || landmarks.length > 0 || landmarkUndo.length > 0 || modelLoads.length > 0) && <div className={styles.workStatus}>{workStatus}</div>}
      {inspectorTab !== 'details' && inspectorTab !== 'landmarks' && <><Button size="sm" variant="ghost" onClick={() => setInspectorTab('details')}>← Back to details</Button><nav className={styles.inspectorNav} aria-label="Inspector sections">
        <div><span>Selected</span><div className={styles.inspectorNavRow}>{([{ value: 'object', label: 'Object' }, { value: 'move', label: 'Camera move' }] as const).map(item => <button key={item.value} type="button" aria-current={inspectorTab === item.value ? 'page' : undefined} onClick={() => setInspectorTab(item.value)}>{item.label}</button>)}</div></div>
        <div><span>Scene</span><div className={styles.inspectorNavRow}>{([{ value: 'actors', label: 'Actors' }, { value: 'props', label: 'Props' }, { value: 'look', label: 'Look' }, { value: 'project', label: 'Project' }] as const).map(item => <button key={item.value} type="button" aria-current={inspectorTab === item.value ? 'page' : undefined} onClick={() => setInspectorTab(item.value)}>{item.label}</button>)}</div></div>
        <button className={styles.inspectorSearch} type="button" onClick={() => setModelSearchOpen(true)}><Search size={14} />Add models</button>
      </nav></>}
      <AnimatePresence mode="wait" initial={false}><motion.div key={inspectorKey} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reduceMotion ? 0 : .16, ease: 'easeOut' }}>
      {!hydrated ? <p role="status">Opening project…</p> : inspectorTab === 'landmarks' ? landmarkControls : inspectorTab === 'details' ? <section className={styles.detailsSummary} aria-label="Selection summary">
        {recentDirectorChange && <div className={styles.detailsChange}><strong>Latest Director Assistant change</strong><p>{recentDirectorChange}</p>{editing.canUndo && <Button size="sm" variant="ghost" onClick={() => { editing.undo(); setRecentDirectorChange(null); }}>Undo change</Button>}</div>}
        {selected ? <><div className={styles.detailsIdentity}><span>{selected.category}</span><h3>{selected.name}</h3><p>{selected.type === 'Actor' ? `${selectedActor?.marks.length ?? 0} movement marks · ${selectedActor?.height ?? 0} m tall` : selected.type === 'Prop' ? `Prop · ${selectedProp?.size ?? 0} m` : selected.type === 'Camera' ? 'Scene camera' : selected.type === 'Splat' ? 'Captured environment' : `${selected.type} · ${selected.category}`}</p></div>
          {selectedProp?.attachment && <div className={styles.detailsRelation}><strong>Follows {actors.find(actor => actor.id === selectedProp.attachment?.actorId)?.name ?? 'actor'}</strong><p>This prop moves and turns with the actor.</p><Button size="sm" variant="ghost" onClick={() => stopFollowing(selectedProp.id)}>Stop following</Button></div>}
          <div className={styles.detailsActions}>{selected.type === 'Camera' && <Button size="sm" variant="ghost" onClick={() => removeCamera(selected.id)}>Delete camera</Button>}<Button size="sm" onClick={focusSelected}>Frame selection</Button><Button size="sm" variant="ghost" onClick={editSelectedDetails}>Edit details</Button></div>
        </> : null}
      </section> : inspectorTab === 'project' ? <><ProjectControls document={project} status={projectStatus} error={projectError} onNameChange={name => updateDocument(previous => ({ ...previous, name }))} onRetrySave={retrySave} onImport={next => { importDocument(next); setPlaying(false); setFrame(1); setCameraId(manifest?.activeCameraId ?? ''); setSelectedId(null); }} onGraphExport={manifest?.id === 'pavilion-v1' && ready ? exportSceneGraph : undefined} />{projectId && <ProjectSceneControls scenes={projectScenes} selectedId={activeSceneId} document={project} onOpen={openProjectScene} onAdd={assetId => openProjectScene(addProjectScene(assetId))} onRename={renameProjectScene} onImport={next => { replaceCollection(next); openProjectScene(next.scenes[0]); }} />}{manifest?.asset?.kind === 'gsplat' && <CollisionControls layer={project.collision} show={showCollision} isolate={isolateCollision} onIsolate={setIsolateCollision} selectedId={selectedCollisionId} canUndo={editing.canUndo} onShow={setShowCollision} onSelect={setSelectedCollisionId} onFrame={id => { setMode('orbit'); setPlaying(false); viewportHandle.current?.frameCollision(id); revealPhoneViewport(); }} onUndo={editing.undo} onChange={layer => editing.commit({ ...project, collision: validateCollisionLayer(layer) })} onGenerate={async (options, progress) => {
          const before = project;
          const layer = await viewportHandle.current!.generateCollision(options, progress);
          if (projectLatest.current !== before) throw new Error('The project changed while generating. Generate again to use the current scene.');
          editing.commit({ ...before, collision: validateCollisionLayer(layer) }); setSelectedCollisionId(layer.boxes[0]?.id ?? ''); setShowCollision(true); setMode('orbit');
        }} />}</> : inspectorTab === 'actors' ? <BlockingControls rigs={rigs} onUseMannequin={id => { const actor = actors.find(item => item.id === id); if (actor?.model) { const { model: _model, ...mannequin } = actor; changeActor(mannequin); } }} actors={actors} selectedId={selectedId} frame={frame} fps={manifest?.fps || 24} onSelect={id => { select(id); setInspectorTab('actors'); }} onAdd={addActor} onChange={changeActor} onRemove={removeActor} onSeek={seekActor} onPreview={previewActors} onFrameSelected={focusSelected} /> : inspectorTab === 'props' ? <PropControls props={props} selectedId={selectedId} canAddActor={actors.length < 8} actorNames={Object.fromEntries(actors.map(actor => [actor.id, actor.name]))} onSelect={id => { select(id); setInspectorTab('props'); }} onAddPrimitive={addPrimitive} onAddModel={addModel} onChange={changeProp} onDetach={stopFollowing} onRemove={removeProp} onFrameSelected={focusSelected} /> : inspectorTab === 'look' ? <LookPanel look={project.look} sceneKind={manifest?.asset?.kind} subjects={[...props.map(prop => ({ id: prop.id, name: prop.name })), ...actors.map(actor => ({ id: actor.id, name: actor.name }))]} titles={titles} seconds={seconds} timelineSeconds={(endFrame - 1) / (manifest?.fps || 24)} onLook={next => updateDocument(previous => { const { look: _old, ...rest } = previous; return next ? { ...rest, look: next } : rest; })} onTitles={next => updateDocument(previous => ({ ...previous, titles: next }))} onRender={() => setRenderOpen(true)} onError={editing.setError} /> : inspectorTab === 'move' ? <><FlightPlanPanel plan={flightPlan} /><ShotAuthoring captureView={() => mode === 'orbit' ? viewportHandle.current?.viewState() ?? null : null} seconds={seconds} objects={objects} actors={actors} landmarks={landmarks} canCinemaTraj={manifest?.asset?.kind !== 'gsplat' || !!project.collision?.reviewed} onCinemaTraj={generateCinemaTraj} onOptimizeCinema={optimizeCinemaDraft} selectedId={selectedId} onSelect={id => { select(id); setInspectorTab('move'); }} captureSubject={id => viewportHandle.current?.captureSubject(id) ?? null} captureObstacles={id => viewportHandle.current?.captureObstacles(id) ?? []} captureRouteMapGeometry={() => viewportHandle.current?.captureRouteMapGeometry() ?? []} captureRouteMap={view => viewportHandle.current?.captureRouteMap(view) ?? Promise.resolve(null)} motionFor={motionFor} targetAt={targetAt} stale={shotStale} shot={shot} onShot={next => { setShot(next); setPlaying(false); }} onGenerate={useShot} onPreview={previewShot} onPlay={() => { setCameraId(AUTHORED_CAMERA_ID); setMode('shot'); if (shot && frame >= shotEndFrame(shot, manifest?.fps || 24)) setFrame(1); setPlaying(true); }} onPause={() => setPlaying(false)} time={Math.max(0, (frame - 1) / (manifest?.fps || 24))} playing={playing && cameraId === AUTHORED_CAMERA_ID} showPath={showPath && mode !== 'shot'} onPath={() => { const show = mode === 'shot' || !showPath; setShowPath(show); if (show) { viewportHandle.current?.framePath(); revealPhoneViewport(); } setMode('orbit'); }} onSeek={seekShot} onRemove={() => { setShot(null); setCameraId(manifest?.activeCameraId ?? ''); setPlaying(false); setFrame(1); }} /></> : <><ObjectInspector selected={selected} frame={frame} onFrameSelected={focusSelected} onViewCamera={id => { setCameraId(id); setMode('shot'); }} onCreateMove={() => setInspectorTab('move')} onSelectCamera={() => select(cameraId)} />{selected?.type === 'Camera' && <Button size="sm" variant="ghost" onClick={() => removeCamera(selected.id)}>Delete camera</Button>}{selected && selected.type !== 'Camera' && selected.type !== 'Actor' && selected.type !== 'Prop' && <PlacementControls key={selected.id} offset={placements.find(item => item.id === selected.id)?.offset ?? [0, 0, 0]} onChange={offset => editing.commit(withPlacement(project, { id: selected.id, offset }))} onReset={() => editing.commit(withPlacement(project, { id: selected.id, offset: [0, 0, 0] }))} />}</>}

      </motion.div></AnimatePresence>
    </MotionGlassPanel>}</AnimatePresence>

    </div>
    {mode === 'orbit' && !focusMode && (previewOpen ? <section className={styles.shotPreview} aria-label="Camera preview"><div className={styles.shotPreviewHeading}><strong>Camera preview</strong><span>Frame {frame}</span><button type="button" aria-label="Close camera preview" onClick={() => setPreviewOpen(false)}><X size={16} /></button></div><div ref={previewRef} className={styles.shotPreviewImage} aria-hidden="true" /></section> : <button type="button" className={styles.showShotPreview} onClick={() => setPreviewOpen(true)}>Show camera preview</button>)}
    </div>
    {/* Controls button and popup hidden for now.
    {mode === 'orbit' && !focusMode && <MovementControls />}
    */}
    <dialog ref={modelDialog} className={styles.modelDialog} aria-label="Sketchfab model search" onClose={() => setModelSearchOpen(false)} onClick={event => { if (event.target === event.currentTarget) setModelSearchOpen(false); }}>
      <div className={styles.modelDialogHeading}><div><h2>Find a 3D model</h2><p>Search free Creative Commons models on Sketchfab.</p></div><Button size="sm" variant="ghost" iconOnly aria-label="Close model search" onClick={() => setModelSearchOpen(false)}><X size={18} /></Button></div>
      <label className={styles.localImport}><Upload size={14} />Import a .glb from your computer<input type="file" accept=".glb,model/gltf-binary" onChange={event => { void importLocal(event.target.files?.[0]); event.target.value = ''; }} /></label>
      <ModelSearch props={props} canAddActor={actors.length < 8} characterTarget={selectedActor ? { id: selectedActor.id, name: selectedActor.name } : null} onAddModel={async (uid, as) => { await addModel(uid, as); setModelSearchOpen(false); }} />
    </dialog>
    <RenderDialog key={look?.finish.motionBlur ?? 0} defaultMotionBlur={look?.finish.motionBlur ?? 0} open={renderOpen} onClose={() => setRenderOpen(false)} name={projectId ? projectScenes.find(scene => scene.id === activeSceneId)?.name ?? project.name : project.name} shotSeconds={shot?.settings.duration ?? null} timelineSeconds={(endFrame - 1) / (manifest?.fps || 24)} hasAudio={audio.length > 0} sceneFps={manifest?.fps || 24} onRender={renderShot} />
    {landmarkMode && !inspectorOpen && !focusMode && <GlassPanel className={styles.placementHint} density="dense"><span role="status">{landmarkHint}</span><Button size="sm" onClick={() => setLandmarkMode(false)}>Cancel placement</Button></GlassPanel>}
    {!focusMode && !inspectorOpen && modelLoads.length > 0 && <GlassPanel className={styles.workStatusFloating} density="dense" aria-label="Scene work status">{workStatus}</GlassPanel>}
    {hydrated && <DirectorPanel key={directorSessionKey} sessionKey={directorSessionKey} onRetryModel={uid => viewportHandle.current?.retryModel?.(uid)} landmarkCount={landmarks.length} activeLandmarkLabel={landmarks.find(mark => mark.id === activeLandmarkId)?.label} modelLoads={modelLoads} suspended={focusMode || watching} open={directorOpen} pinned={directorPinned} getContext={directorContext} onAction={applyDirectorAction} onOpenChange={open => { if (open && window.matchMedia('(max-width: 800px)').matches) setInspectorOpen(false); setDirectorOpen(open); }} />}
    <AnimatePresence initial={false}>
    {selected && selected.type !== 'Camera' && <motion.div key="object-tools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .14 }} className="object-tool-position"><ObjectToolStrip name={selected.name} tool={effectiveTool} onToolChange={chooseTool} allowRotate={!!selectedActor || !!selectedProp} disabled={editBlocked || !!selectedProp?.attachment || !hydrated} onActions={selectedActions} onUndo={editing.undo} canUndo={editing.canUndo} hint={toolHint} /></motion.div>}
    {!semanticOpen && (!selected || selected.type === 'Camera') && editing.canUndo && <motion.div key="undo" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="object-tool-position"><Button iconOnly aria-label="Undo object edit" title="Undo object edit" onClick={editing.undo}><Undo2 size={18} /></Button></motion.div>}
    </AnimatePresence>
    {contextRequest && <ObjectContextMenu key={`${contextRequest.id}:${contextRequest.x}:${contextRequest.y}`} title={contextEntity?.name ?? 'Scene actions'} x={contextRequest.x} y={contextRequest.y} actions={contextActions} onClose={() => setContextRequest(null)} />}
    {editing.error && <div className="object-edit-error" role="alert">{editing.error}<Button size="sm" variant="ghost" onClick={() => editing.setError('')}>Dismiss</Button></div>}

    <div className="preview-caption navigation-caption"><AudioCredits clips={audio} /><ModelCredits sources={[...props.flatMap(prop => prop.source.kind === 'model' ? [prop.source] : []), ...actors.flatMap(actor => actor.model ? [actor.model] : [])]} /></div>
    <div className="timeline-position" data-camera-view={mode === 'shot'}>{audioOpen && <AudioPanel clips={audio} selectedId={audioSelected} fps={manifest?.fps || 24} onDuplicate={duplicateAudio} seconds={(frame - 1) / (manifest?.fps || 24)} onSelect={setAudioSelected} onClose={() => { setAudioOpen(false); setAudioSelected(null); }} onAdd={addAudio} onChange={changeAudio} onRemove={removeAudio} />}<Timeline compact={mode === 'shot'} onAddAudio={() => { setAudioSelected(null); setAudioOpen(open => !open); }} audioOpen={audioOpen} onClipChange={(_, clipId, change) => retimeAudio(clipId, change)} onClipSelect={(_, clipId) => { setAudioSelected(clipId); setAudioOpen(true); }} onClipDelete={(_, clipId) => removeAudio(clipId)} tracks={tracks} frameStart={manifest?.frameStart || 1} frameEnd={mode === 'shot' ? playbackEnd : endFrame} fps={manifest?.fps || 24} frame={frame} playing={playing} subtitle={shot ? 'Camera authoring' : 'Camera animation'} footerText={shot ? `Draft: ${shot.subjectName} · ${shot.marks.length} editable marks` : manifest?.asset?.kind === 'gsplat' ? 'Captured environment · Add actors or create a camera move' : 'Camera animation · frames 1–250'} onFrameChange={setFrame} onPlayChange={value => { if (value && frame >= playbackEnd) setFrame(1); setPlaying(value); }} onTrackSelect={id => { if (id.startsWith('lane:')) { setAudioSelected(null); setAudioOpen(true); return; } if (id.startsWith('actor:')) { select(id); return; } setCameraId(id); setMode('shot'); if (id === AUTHORED_CAMERA_ID) { setInspectorOpen(true); setInspectorTab('move'); } else select(id); }} /></div>
  </main></div></MotionConfig>;
}
