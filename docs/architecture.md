# Module boundaries

This refactor preserves the existing viewer and camera draft behavior. The editor composes four features through plain data contracts and explicit callbacks.

| Area | Public interface | Owns |
| --- | --- | --- |
| `src/features/camera` | `index.ts` UI + generation/evaluation; `model.ts` headless entry | Presets adapter, shot generation/evaluation, camera controls, CSS, fixtures, tests |
| `src/features/viewport` | `index.ts` client renderer + props; `framing.ts` headless framing | Rendering, navigation, picking, world bounds capture, path visualization, CSS, fixtures, tests |
| `src/features/timeline` | `index.ts` controlled timeline; `model.ts` headless timing/layout | Transport, scrubbing, track rendering, CSS, fixtures, tests |
| `src/features/scene` | `index.ts` loading/browser/inspector; `data.ts` headless entity helpers | Manifest loading, search, source metadata display, CSS, fixtures, tests |
| `src/editor` | `index.ts` application composition | Selection, draft state, playback clock, track adapters, overlay layout, clear viewport measurement |
| `src/contracts` | `index.ts` types; `fixtures.ts` shared examples | Coordinator-owned data contracts, with no React or renderer types |
| `src/components/ui`, `src/styles` | Shared primitives, preferences, tokens | Shared foundations and reference design-system styling |
| `src/vendor/blockout` | Internal to camera feature | Extracted algorithms, attributed headers; notices in `public/licenses/blockout` |

Features import shared contracts and UI, never another feature's implementation. Editor integration uses feature public exports. Headless entry points let Node tests run without importing React/CSS; use those for pure algorithms. Camera may import the vendor engine. Viewport must not import shot-generation/evaluation code or inspect camera marks. Timeline must not inspect `CameraShot`.

Each feature has fixtures and tests next to its implementation. `npm run test:modules` compiles and exercises all four against their data interfaces. `npm run test:camera` adds all 39 vendor presets, optics, end-to-end authoring, and source preservation checks.

## Data flow and commands

1. Scene supplies a manifest. Editor owns selected entity and active camera IDs.
2. Editor calls `ViewportHandle.captureSubject(id)` to obtain actual world bounds and current viewing position. Camera authoring generates an editable shot from that snapshot.
3. Editor compiles the shot after edits and evaluates it at the current draft time, passing `CameraPose | null` to viewport. A non-null pose overrides the selected imported camera in Shot mode.
4. Camera produces a serializable `PathPreview` of sampled positions, mark positions, and target. Viewport renders/framing uses this without knowing how it was generated.
5. Editor describes imported and draft clips as `TimelineTrack[]`; timeline reports seeks, playback changes, and selected track IDs through callbacks.
6. Editor owns normalized `ViewportRegion` measurements and observes overlay/viewport resizing. Viewport uses this rectangle for path framing; it never queries UI selectors.

`ViewportHandle` exposes subject capture, frame selection, reset view, frame path, and movement commands. Commands are local to a viewport instance. Editor selects Orbit before framing/reset commands. Capture returns null until geometry is available or when a camera/unknown entity is requested.

## Coordinates and time

- Renderer bounds, poses, paths, `positionWeb`, and shot targets use Three.js Y-up coordinates in metres. `CameraPose` pan/tilt/roll are radians, applied with Euler order YXZ; FOV is vertical degrees, focal length millimetres.
- `SceneEntity.position`, `dimensions`, and sampled positions preserve Blender Z-up source metadata. Inspector displays those values. Do not pass them directly into the renderer as Y-up coordinates.
- Imported Blender animation deliberately evaluates at `frame / fps`; exported frame 1 is at 1/24 second for this scene.
- Generated shots evaluate at `(frame - 1) / fps`; draft frame 1 is t=0. End frame is `ceil(duration * fps) + 1`. Evaluation is deterministic and holds at endpoints.
- Timeline labels measure elapsed frames from their supplied `frameStart`. Clip bounds use endpoint differences rather than inclusive frame counts. Editor maps source and draft time origins; timeline does not infer them.

## Later attachment points

Persistence belongs at editor state hydration/save boundaries. It can store plain scene IDs and draft shots; do not serialize Three.js instances or transient navigation handles. No persistence store or schema migration layer is introduced here.

Actor blocking can supply time-sampled subject transforms/bounds through a future agreed contract. Camera currently captures a static subject snapshot; changing that assumption requires coordinated camera/viewport/editor contracts, not a hidden dependency on scene internals.

AI planning can produce a proposed `ShotSettings`/`CameraShot` through a future adapter and validation step in the editor. The camera feature remains the deterministic generation/evaluation boundary. No planning service, background job system, or speculative plugin framework is implemented.
