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
| `src/editor` | `index.ts` application composition | Selection, draft state, playback clock, track adapters, overlay layout, clear viewport measurement |
| `src/contracts` | `index.ts` types; `fixtures.ts` shared examples | Coordinator-owned data contracts, with no React or renderer types |
| `src/components/ui`, `src/styles` | Shared primitives, preferences, tokens | Shared foundations and reference design-system styling |
| `src/vendor/blockout` | Internal to camera feature | Extracted algorithms, attributed headers; notices in `public/licenses/blockout` |

Features import shared contracts and UI, never another feature's implementation. Editor integration uses feature public exports. Headless entry points let Node tests run without importing React/CSS; use those for pure algorithms. Camera may import the vendor engine. Viewport must not import shot-generation/evaluation code or inspect camera marks. Timeline must not inspect `CameraShot`.

Each feature has fixtures and tests next to its implementation. Project controls and actor controls reuse the existing inspector; feature styles stay in CSS Modules. `npm run test:modules` compiles and exercises all four against their data interfaces. `npm run test:camera` adds all 39 vendor presets, optics, end-to-end authoring, and source preservation checks.

## Data flow and commands

1. Scene supplies a manifest. Editor owns selected entity and active camera IDs.
2. Editor calls `ViewportHandle.captureSubject(id)` to obtain actual world bounds and current viewing position. Camera authoring generates an editable shot from that snapshot.
3. Editor compiles the shot after edits and evaluates it at the current draft time, passing `CameraPose | null` to viewport. A non-null pose overrides the selected imported camera in Shot mode.
4. Camera produces a serializable `PathPreview` of sampled positions, mark positions, and target. Viewport renders/framing uses this without knowing how it was generated.
   The optional CinemaTraj route accepts actor samples and viewport-captured world bounds, runs the pinned CPU position optimizer in a local Python process, and stores timed camera and actor targets on the shot. Playback interpolates those stored positions linearly, matching the clearance check; the viewport still receives only a plain pose and preview.
5. Editor describes imported and draft clips as `TimelineTrack[]`; timeline reports seeks, playback changes, and selected track IDs through callbacks.
6. Editor owns normalized `ViewportRegion` measurements and observes overlay/viewport resizing. Viewport uses this rectangle for path framing; it never queries UI selectors.

`ViewportHandle` exposes subject capture, segmented GLB obstacle bounds, frame selection, reset view, frame path, and movement commands. Commands are local to a viewport instance. Editor selects Orbit before framing/reset commands. Subject capture returns null until geometry is available or when a camera/unknown entity is requested; obstacle capture returns an empty list for the unsegmented splat scene.

## Coordinates and time

- Renderer bounds, poses, paths, `positionWeb`, and shot targets use renderer Y-up coordinates in metres. `CameraPose` pan/tilt/roll are radians, applied with Euler order YXZ; FOV is vertical degrees, focal length millimetres.
- `SceneEntity.position`, `dimensions`, and sampled positions preserve Blender Z-up source metadata. Inspector displays those values. Do not pass them directly into the renderer as Y-up coordinates.
- Imported Blender animation deliberately evaluates at `frame / fps`; exported frame 1 is at 1/24 second for this scene.
- Generated shots evaluate at `(frame - 1) / fps`; draft frame 1 is t=0. End frame is `ceil(duration * fps) + 1`. Evaluation is deterministic and holds at endpoints.
- Timeline labels measure elapsed frames from their supplied `frameStart`. Clip bounds use endpoint differences rather than inclusive frame counts. Editor maps source and draft time origins; timeline does not infer them.

## Later attachment points

Persistence is integrated at editor hydration/save boundaries in `use-project.ts`. `ProjectDocument` version 1 stores a scene ID, name, camera draft and actor tracks; it excludes engine instances and transient navigation/playback state. The project module validates nested data and storage errors. Hydration waits for the manifest; corrupted saved bytes remain until explicit retry/import.

Actor blocking supplies evaluated `ActorPose[]` and plain `ActorPath[]` to the viewport. The editor owns actor selection, browser metadata conversion, and timeline track descriptions. Preset camera shots still capture a static subject snapshot. The optional CinemaTraj shot samples one blocked actor through the editor and stores the target timeline with its camera path. Its CPU optimizer uses world bounds from segmented GLB objects; the single splat capture has no usable collision geometry for this route.

AI planning can produce a proposed `ShotSettings`/`CameraShot` through a future adapter and validation step in the editor. The camera feature remains the deterministic generation/evaluation boundary. No planning service, background job system, or speculative plugin framework is implemented.

## Object manipulation transactions

Viewport input emits plain actor or scene transform events (`start`, `preview`, `commit`, `cancel`). Editor integration pauses the clock, holds transient previews separately from the project, and commits one undoable edit on release. Actor transforms upsert a mark at `(frame - 1) / fps`; scene placements are static world-space translation offsets. Escape, pointer cancellation, and window blur restore the pre-gesture state. The editor rejects commits when the project changed during a gesture.

Optional version-1 `placements` data keeps older projects compatible. The codec validates unique IDs and bounded vectors; hydration/import verifies IDs against non-camera manifest entities. The viewport applies offsets to each entity's topmost mesh roots after evaluating source animation, restoring original transforms before each application. Bounds, framing, capture, and inspector metadata use placed geometry. This preserves original Blender cameras and mesh rotation/scale. Existing camera drafts keep their original subject snapshot until regenerated.

`features/object-actions` knows only controlled action descriptors and tool state. The editor supplies entity-specific commands, undo availability, menu context, and layout; shared contracts contain no React or Three objects. Object-browser right-click and Shift+F10 delegate to the same menu as the viewport.

The local Codex Director streams a structured action proposal from a server route. The editor validates entity IDs, camera presets, coordinate offsets, lenses, and timing, then commits object placement through the same project editing transaction as direct manipulation. Camera generation stays inside the camera feature. The browser receives streamed feedback and applies the validated action only after a completed Codex turn.

## PlayCanvas viewport

`live-viewport.tsx` owns the React lifecycle and accessible load/retry states. Each mount creates a fresh canvas, aborts pending initialization, and destroys the engine and asset ownership on unmount. `runtime.ts` implements the existing viewport commands, consumes evaluated camera/actor poses, and renders overlays. `content.ts` loads GLB or GSplat assets, maps glTF extras to stable entity IDs, and evaluates source animation. `viewport-input.ts` translates pointer, keyboard, touch, and PlayCanvas gizmo input into the existing edit transactions. `transforms.ts` applies world offsets under transformed parents. No engine objects cross the public contract. Three.js remains only for camera/framing/intersection math.

The optional manifest asset, initial view, scene identity, actor origin, and attribution fields select a scene. Missing asset metadata retains the legacy pavilion GLB default. Metadata positions use Z-up inspection coordinates; renderer transforms and poses use Y-up. SuperSplat's capture is rotated 180 degrees around Z, matching its viewer, and its authored horizontal FOV is converted to vertical FOV at the source 16:9 aspect. Scene switching reloads the editor and restores the selected scene's existing storage key; pavilion projects retain `pavilion-v1`. A splat is one selectable environment, not inferred mesh segments.

Streamed captures are initially clamped to their coarsest LOD until the engine reports completion and a frame renders. The range then opens for refinement within a per-device Gaussian budget. Streaming frame requests invalidate the otherwise demand-rendered canvas. External assets can fail independently of the local application; retry/compatibility/local-scene recovery stays available.
