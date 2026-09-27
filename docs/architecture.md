# Module boundaries

This refactor preserves the existing viewer and camera draft behavior. The editor composes features through plain data contracts and explicit callbacks.

| Area | Public interface | Owns |
| --- | --- | --- |
| `src/features/camera` | `index.ts` UI + generation/evaluation; `model.ts` headless entry | Presets adapter, shot generation/evaluation, camera controls, CSS, fixtures, tests |
| `src/features/viewport` | `index.ts` client renderer + props; `framing.ts` headless framing | Rendering, navigation, picking, world bounds capture, path visualization, CSS, fixtures, tests |
| `src/features/timeline` | `index.ts` controlled timeline; `model.ts` headless timing/layout | Transport, scrubbing, track rendering, CSS, fixtures, tests |
| `src/features/scene` | `index.ts` loading/browser/inspector; `data.ts` headless entity helpers | Manifest loading, search, source metadata display, CSS, fixtures, tests |
| `src/features/project` | `index.ts` controls/storage; `model.ts` headless codec | Versioned JSON validation, browser storage, import/export controls, fixtures, tests |
| `src/features/blocking` | `index.ts` controls/evaluation; `model.ts` headless authoring | Actor creation, ordered mark editing, deterministic poses/paths, fixtures, tests |
| `src/features/object-actions` | Controlled context menu and tool strip | Menu placement/focus, action presentation, CSS, fixtures, tests |
| `src/features/collision` | `index.ts` controls; `model.ts` validation, occupancy merging and placement | Local collision proxy review and headless geometry contracts |
| `src/features/collaboration` | `index.ts` room hook + collaboration UI; `model.ts` headless validation | Yjs scene fields, WebRTC provider lifecycle, awareness presence and cursors |
| `src/editor` | `index.ts` application composition | Selection, draft state, playback clock, track adapters, overlay layout, clear viewport measurement |
| `src/contracts` | `index.ts` types; `fixtures.ts` shared examples | Coordinator-owned data contracts, with no React or renderer types |
| `src/components/ui`, `src/styles` | Shared primitives, preferences, tokens | Shared foundations and reference design-system styling |
| `src/vendor/blockout` | Camera algorithms; `upstream/` builders used by viewport | Extracted camera algorithms and directly copied procedural builders, attributed headers; notices in `public/licenses/blockout` |

Features import shared contracts and UI, never another feature's implementation. Editor integration uses feature public exports. Headless entry points let Node tests run without importing React/CSS; use those for pure algorithms. Camera may import the vendor engine. Viewport must not import shot-generation/evaluation code or inspect camera marks. Timeline must not inspect `CameraShot`.

On `blockout-map`, the Pavilion viewport calls the directly copied Blockout `buildAsset('prim.cube')` builder. New mesh-fitting code separates connected surface pieces and splits complex pieces into local boxes. A display bridge transfers the upstream cube geometry into PlayCanvas batches attached to the original source nodes, so placements and animation retain the same coordinates. The Blocks/Overlay/Original control changes visualization only; blocks are derived, not separate saved props or validated collision volumes. Gaussian extraction is not part of this Pavilion GLB implementation.

Each feature has fixtures and tests next to its implementation. Project controls and actor controls reuse the existing inspector; feature styles stay in CSS Modules. `npm run test:modules` compiles and exercises the headless modules against their data interfaces. `npm run test:camera` adds all 39 vendor presets, optics, end-to-end authoring, and source preservation checks.

## Data flow and commands

1. Scene supplies a manifest. Editor owns selected entity and active camera IDs.
2. Editor calls `ViewportHandle.captureSubject(id)` to obtain actual world bounds and current viewing position. Camera authoring generates an editable shot from that snapshot.
3. Editor compiles the shot after edits and evaluates it at the current draft time, passing `CameraPose | null` to viewport. A non-null pose overrides the selected imported camera in Shot mode.
4. Camera produces a serializable `PathPreview` of sampled positions, mark positions, and target. Viewport renders/framing uses this without knowing how it was generated.
   The optional CinemaTraj route accepts actor samples and viewport-captured world bounds, runs the pinned CPU position optimizer in a local Python process, and stores timed camera and actor targets on the shot. Playback interpolates those stored positions linearly, matching the clearance check; the viewport still receives only a plain pose and preview.
   The flight-path top view samples the same compiled shot used by playback. The viewport supplies current mesh bounds and colors for a cutaway map and coarse static bounds for local clearance refinement; the map keeps renderer objects out of the camera feature. The optimizer bakes its refined positions into the saved shot and rejects a result that increases sampled clearance conflicts.
5. Editor describes imported and draft clips as `TimelineTrack[]`; timeline reports seeks, playback changes, and selected track IDs through callbacks.
6. Editor owns normalized `ViewportRegion` measurements and observes overlay/viewport resizing. Viewport uses this rectangle for path framing; it never queries UI selectors.
7. Collaboration observes editor-owned serializable state and merges individual fields into a Yjs map. Remote updates return through editor setters; presence and cursors remain outside the shared scene document.

`ViewportHandle` exposes subject capture, segmented GLB obstacle bounds, frame selection, reset view, frame path, and movement commands. Commands are local to a viewport instance. Editor selects Orbit before framing/reset commands. Subject capture returns null until geometry is available or when a camera/unknown entity is requested; obstacle capture returns reviewed project collision proxies for a splat, or an empty list until review. These proxies have a finite coverage region.

## Coordinates and time

- Renderer bounds, poses, paths, `positionWeb`, and shot targets use renderer Y-up coordinates in metres. `CameraPose` pan/tilt/roll are radians, applied with Euler order YXZ; FOV is vertical degrees, focal length millimetres.
- `SceneEntity.position`, `dimensions`, and sampled positions preserve Blender Z-up source metadata. Inspector displays those values. Do not pass them directly into the renderer as Y-up coordinates.
- The editor normalizes scene timelines to 30 FPS in `features/scene/timing.ts`. Original manifests and GLB animation data remain unchanged. `sourceFps` retains the import rate; imported animation evaluates at `(frame - 1) / fps + 1 / sourceFps`, keeping the original first sample at 1/24 second. Sample frame coordinates and timeline endpoints are retimed, with the endpoint rounded up by less than one output frame.
- Generated shots evaluate at `(frame - 1) / fps`; draft frame 1 is t=0. End frame is `ceil(duration * fps) + 1`. Evaluation is deterministic and holds at endpoints.
- Timeline labels measure elapsed frames from their supplied `frameStart`. Clip bounds use endpoint differences rather than inclusive frame counts. Editor maps source and draft time origins; timeline does not infer them.

## Later attachment points

Persistence is integrated at editor hydration/save boundaries in `use-project.ts`. `ProjectDocument` version 1 stores a scene ID, name, camera draft and actor tracks; it excludes engine instances and transient navigation/playback state. The project module validates nested data and storage errors. Hydration waits for the manifest; corrupted saved bytes remain until explicit retry/import.

Named browser projects now wrap those version-1 scene documents in a `ProjectCollection`: an ordered list of stable scene-entry IDs, display names, and scene documents. This preserves the editor's scene contract while letting one project contain multiple scenes, including distinct scene entries based on the same source asset. The collection codec validates every nested scene before saving; older named single-scene files open as one-entry collections and migrate on save. Scene landmarks are saved in the nested document. The UI loads the selected entry through the existing scene manifest and keeps the collection under one named browser-storage key. Legacy scene-scoped saves remain readable.

Actor blocking supplies evaluated `ActorPose[]` and plain `ActorPath[]` to the viewport. The editor owns actor selection, browser metadata conversion, and timeline track descriptions. Preset camera shots capture imported geometry and props as static snapshots; actor subjects supply a timed motion sampler for path generation and live aim. Both preset and CinemaTraj actor shots record a subject signature so edited blocking can flag a stale path. The optional CinemaTraj shot samples one blocked actor through the editor and stores the target timeline with its camera path. Playback uses current actor marks for aim when that actor exists, falling back to stored targets otherwise. Its CPU optimizer uses world bounds from segmented GLB objects or reviewed project collision boxes for a splat. Splat paths must remain inside the reviewed coverage region.

Intent-first automatic camera planning now runs through `editor/use-background-flight-plan.ts` and `/api/flight-plan` in automated mode. Reviewed semantic subjects and measured static GLB bounds are captured as a snapshot. Astra proposes fresh route controls; the camera feature generates and validates smooth motion; viewport captures beat/transition evidence; Astra reviews it. At most three proposals are attempted. Only current, validated results are applied as one undoable project edit with a browser-local backup. Existing shots require an explicit Generate request; empty reviewed scenes may auto-start. Splats, actors/props, animated source meshes and incomplete geometry are explicitly ineligible. See `docs/flight-planning.md` for gates and limits. The legacy landmark proposal API remains compatible but is no longer the editor's background flow.

## Object manipulation transactions

Viewport input emits plain actor or scene transform events (`start`, `preview`, `commit`, `cancel`). Editor integration pauses the clock, holds transient previews separately from the project, and commits one undoable edit on release. Actor transforms upsert a mark at `(frame - 1) / fps`; scene placements are static world-space translation offsets. Escape, pointer cancellation, and window blur restore the pre-gesture state. The editor rejects commits when the project changed during a gesture.

Optional version-1 `placements` data keeps older projects compatible. The codec validates unique IDs and bounded vectors; hydration/import verifies IDs against non-camera manifest entities. The viewport applies offsets to each entity's topmost mesh roots after evaluating source animation, restoring original transforms before each application. Bounds, framing, capture, and inspector metadata use placed geometry. This preserves original Blender cameras and mesh rotation/scale. Existing camera drafts keep their original subject snapshot until regenerated.

`features/object-actions` knows only controlled action descriptors and tool state. The editor supplies entity-specific commands, undo availability, menu context, and layout; shared contracts contain no React or Three objects. Object-browser right-click and Shift+F10 delegate to the same menu as the viewport.

The local Codex Director streams a structured action proposal from a server route. The editor validates entity IDs, camera presets, coordinate offsets, lenses, and timing, then commits object placement through the same project editing transaction as direct manipulation. Camera generation stays inside the camera feature. The browser receives streamed feedback and applies the validated action only after a completed Codex turn.

## PlayCanvas viewport

`live-viewport.tsx` owns the React lifecycle and accessible load/retry states. Each mount creates a fresh canvas, aborts pending initialization, and destroys the engine and asset ownership on unmount. `runtime.ts` implements the existing viewport commands, consumes evaluated camera/actor poses, and renders overlays. `content.ts` loads GLB or GSplat assets, maps glTF extras to stable entity IDs, and evaluates source animation. `viewport-input.ts` translates pointer, keyboard, touch, and PlayCanvas gizmo input into the existing edit transactions. `transforms.ts` applies world offsets under transformed parents. No engine objects cross the public contract. Three.js remains only for camera/framing/intersection math.

The optional manifest asset, initial view, scene identity, actor origin, and attribution fields select a scene. Missing asset metadata retains the legacy pavilion GLB default. Metadata positions use Z-up inspection coordinates; renderer transforms and poses use Y-up. SuperSplat's capture is rotated 180 degrees around Z, matching its viewer, and its authored horizontal FOV is converted to vertical FOV at the source 16:9 aspect. Scene switching reloads the editor and restores the selected scene's existing storage key; pavilion projects retain `pavilion-v1`. A splat is one selectable environment, not inferred mesh segments.

Streamed captures are initially clamped to their coarsest LOD until the engine reports completion and a frame renders. The range then opens for refinement within a per-device Gaussian budget. Streaming frame requests invalidate the otherwise demand-rendered canvas. External assets can fail independently of the local application; retry/compatibility/local-scene recovery stays available.


## Splat collision proxies

`ProjectDocument.collision` optionally stores a validated, versioned box layer separately from the splat appearance. The viewport reads one complete coarse LOD per octree leaf (not the view-dependent resident subset), transforms centers to renderer Y-up, and bins samples inside a camera-centered review region. The headless collision model merges fully occupied adjacent cells without crossing empty cells; it rejects results over 400 boxes rather than dropping obstacles. Empty/sparse cells and coarse LOD are not proof of free space.

The Project inspector controls generation, wireframe display, individual bounds edits/removal, review approval, and the shared one-step undo transaction. Edits revoke approval. Collision layers persist and export with the project; they are not part of collaboration awareness or the shared room document. Stored boxes and region follow the capture placement delta. Imports verify the source asset URL and splat identity. This headless model is a public dependency of project validation and viewport sampling.

CinemaTraj may consume reviewed boxes in a splat scene, but still requires its external Python installation and a blocked actor. Reviewed coverage becomes an additional signed-distance constraint in the optimizer and participates in dense output clearance checks. Pending geometry generation and optimization reject results if the project changed.

Imported camera removal is a project edit: optional `removedCameraIds` stores source camera IDs without changing the source asset. The browser, camera selector, timeline, Director context, and scene graph omit removed cameras. The active view falls back to another source camera, then a draft, or Orbit if none remain. Use **Delete camera** in the selection details or context menu, or ask the Director to remove it; **Undo object edit** restores it. Removal persists with project saves and exports.

Director landmark actions include `removeLandmark` (a saved landmark ID) and `clearLandmarks` (all landmarks, including more than the eight-action batch limit). Both use `withLandmarkEdit` and the project undo transaction. Removing route anchors preserves the generated motion but clears its anchor claim and marks the draft for replanning.

The Director persists its Codex thread ID in browser storage under `showcam-director:v1:project:<projectId>`; all scenes in a named project share that conversation. Legacy unnamed scenes use separate `scene:<sceneId>` keys. Refreshing or reopening resumes the thread, including after request errors. Every Director turn explicitly uses `gpt-6-astra` with `medium` effort. **New Director conversation** clears only that project’s saved ID; its next direction starts a fresh thread. The visible chat log is page-local; conversation history is retained by the local Codex installation. Project exports do not include machine-local thread IDs. Leaving a mounted project aborts pending requests.
