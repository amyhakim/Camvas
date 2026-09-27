# Showcam

A live Next.js / Three.js viewer for the supplied Blender pavilion scene, with a reusable rounded glass design system. The scene fills the window, with navigation, inspector, and timeline floating over it.

## Run

```sh
npm ci
npm run dev
```

Open [the live viewer](http://localhost:3000) or [the design system](http://localhost:3000/design-system).

## Prototype backend on Railway

The Next.js service also exposes the prototype backend, so the browser and API can deploy as one Railway service. Copy `.env.example` to `.env.local` for local development and set `GEMINI_API_KEY` in Railway Variables. `GEMINI_MODEL` defaults to `gemini-3.8-flash`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Railway health check and feature configuration status |
| `POST /api/plan` | Turn a shot request and subject snapshot into validated deterministic shot settings |
| `POST /api/optimizations` | Submit a revision-pinned scene/shot snapshot to the GPU worker |
| `GET /api/optimizations/:jobId` | Poll optimization progress/results |
| `DELETE /api/optimizations/:jobId` | Cancel an optimization |

Every planning request, optimization job, and optimization result includes `projectId` and `revision`. The browser must apply a result directly only when its `revision` still matches the current project revision; otherwise it should present the result as a proposal.

Deploy the repository as a Railway service and generate a public domain. `railway.toml` configures the build, start command, restart policy, and `/api/health` check. For optimization, deploy the CinemaTraj worker as a second service in the same Railway project and set `GPU_WORKER_URL` to its private address (for example `http://gpu-worker.railway.internal:8000`) plus `GPU_WORKER_TOKEN` if the worker requires bearer authentication. The worker contract is documented in `docs/backend.md`.

## What works

- Shared glass surfaces, tokens, typography, buttons, fields, segmented controls, switches, badges, and property rows.
- Real geometry selection connecting raycast clicks, the scene browser, selection bounds, and live inspector data.
- Timeline play/pause, scrubbing, restart, and frame stepping at 24 fps.
- Orbit/pan/zoom navigation, keyboard and touch Fly navigation, and Shot mode through all seven source cameras.
- Focus mode, inspector visibility, keyboard controls, and a persistent reduced-transparency preference.
- Responsive reference pages with interactive component examples, validation, empty states, and token copying.
- Peer-to-peer collaboration rooms with share links, live presence/cursors, and synchronized selection, camera mode, timeline, path visibility, and authored shot state.
- Semantic destinations and collision-checked A* camera routing through the pavilion scene graph, with a linear fallback whenever a smoothed spline would leave the safe corridor.

## Collaborate on a scene

Every viewer URL receives a random `?room=` identifier. Choose **Share** in the collaboration bar and open that link in another browser to join the same scene. Yjs merges scene-editing fields while y-webrtc carries updates directly between peers; presence, names, selections, and cursors use the ephemeral awareness channel.

The prototype uses the public y-webrtc signaling service by default. For a controlled deployment, set `NEXT_PUBLIC_COLLAB_SIGNALING_URLS` to one or more comma-separated secure WebSocket signaling URLs before building. Scene assets are still loaded normally from the app; collaboration sends only compact edit state. Rooms are peer-hosted and are not durable after every participant disconnects.

The viewport renders real 3D geometry and textures exported from Blender. The 24 fps timeline drives the imported camera animation; Shot mode shows it directly. Fly movement is unconstrained (no collision detection). Browser PBR materials approximate the original Cycles shader networks. The design-system material specimens still use clearly labeled reference images.

## Navigate the scene

- **Orbit:** drag to orbit, right-drag to pan, scroll/pinch to zoom.
- **Fly:** click the viewport, use WASD or arrow keys to move, drag to look, Q/E to descend/ascend, and Shift for faster motion. Touch users can hold the six movement controls.
- **Shot:** choose a source camera, then play or scrub. Camera.002 contains the original movement; frames 251–374 hold its final pose.
- Click actual geometry to inspect it. Use **Frame selected object** to orbit a selection and **Reset view** to return to the opening camera position.

## Author a camera move

1. Select geometry, then choose **Create camera move**, or open **Inspector → Camera move** and choose a subject.
2. Choose one of 39 Blockout camera presets, a 1–60 second duration, an 8–300 mm lens, sensor, and framing. The current viewing direction sets the initial angle; framing uses the object's actual world-space bounds.
3. **Generate move** creates a separate draft camera and timeline track. Play or scrub it; the original Blender cameras remain selectable and unchanged.
4. **Preview** restarts playback and closes the inspector on phones so the shot stays visible. **Path** closes the phone inspector and frames the trajectory and marks in Orbit, fitting the area between panels and above the timeline when the viewport resizes. Expand **Edit camera marks** to seek a mark and edit its position, lens, or roll. Disable **Keep subject centered** to edit pan and tilt.
5. Change generation settings and **Regenerate move** to replace the draft, including mark edits. **Discard draft** returns to the imported camera.

For a geometry-aware move, choose a destination under **Semantic safe flight**, then select **Plan safe flight**. The viewport validates graph edges against the loaded collision meshes with 35 cm clearance, finds an A* route from the current camera position, and rechecks the smoothed curve. Gemini can choose only from the same semantic destination IDs; it does not generate spatial coordinates.

This first slice keeps one draft in memory; reloading clears it. Subjects are treated as static. Preset camera moves do not check collision or occlusion; semantic safe flights do check the loaded static mesh, but do not yet account for moving actors. This is local procedural authoring, without CinemaTraj or a Blender backend. Draft camera time starts at frame 1 = 0 seconds; the imported Blender animation retains its export offset. The timeline extends for longer drafts and holds each shorter clip's final pose. See [semantic navigation](docs/semantic-navigation.md) for the graph and safety boundary.

## Rebuild the scene asset

The committed `public/scenes/pavilion.glb` and `pavilion.json` run without Blender on the server. Regenerate them with Blender on PATH:

```sh
npm run export:scene
```

On this Mac, Blender is at `/Applications/Blender.app/Contents/MacOS/Blender`; use that path in place of `blender` if it is not on PATH. The exporter works in memory and never saves the original `.blend`. It evaluates architectural modifiers, realizes chair/landscape instances with stable IDs, shares geometry, approximates legacy materials, and exports camera animation and source metadata. Tree/lotus counts are reduced; a textured bed replaces 20,000 pebble particles.

## Reuse the system

`src/styles/tokens.css` is the implementation source for colors, spacing, radii, glass density, and motion. `DESIGN.md` documents the finished system. `src/styles/globals.css` applies these tokens to shared primitives and the design-system reference. Feature styles live in their own CSS Modules; the editor owns overlay placement.

Import reusable primitives from `@/components/ui/primitives`:

| Component | Interface | Use |
| --- | --- | --- |
| `GlassPanel` | `density: light / default / dense` plus div attributes | Floating surfaces with one layer of blur |
| `Button` | `variant`, `size`, `loading`, `iconOnly`, native button props | Actions; icon-only controls require `aria-label` |
| `Badge` | `tone: neutral / accent / success / danger` | Status with a text label |
| `SegmentedControl` | `label`, `value`, `options`, `onChange` | Mutually exclusive modes, using native radio inputs |
| `TextField` | `id`, `label`, `hint`, `error`, native input props | Labeled inputs with connected validation text |
| `Toggle` | `label`, `hint`, `checked`, `onChange` | Immediate binary preferences |
| `PropertyRow` | `label`, children | Key/value pairs inside a `dl` |

`Timeline` receives plain `TimelineTrack[]`, frame bounds, fps, playback state, and callbacks. The editor translates shots into tracks and evaluates draft poses; the viewport only receives poses and paths. Blender export time is `frame / fps`, while draft time is `(frame - 1) / fps`. `PreferencesProvider` exposes the shared transparency preference through `usePreferences()`.

Avoid stacking glass panels inside one another. Use dense glass for data and the default surface for inspectors. Reserve amber for active selection and primary actions. Respect reduced motion and reduced transparency.

## Validate

```sh
npm run typecheck
npm run test:modules
npm run test:workstreams
npm run build
npm run test:ui
npm run test:overlay
npm run test:camera
```

The UI check expects a server at `http://localhost:3000`; set `SHOWCAM_URL` to use another URL. Install Chromium once with `npx playwright install chromium` if needed. It exercises real orbit/zoom, raycast selection, fly movement/look, touch movement buttons, camera animation versus Blender samples at frames 1/125/250/374, backward scrubbing, playback, keyboard input, validation, transparency persistence, and empty states; checks layout at desktop and mobile sizes; and runs axe WCAG A/AA checks. Set `SHOWCAM_ARTIFACT_DIR` to isolate screenshots and results (defaults to gitignored `.impeccable/review/`). Run browser suites sequentially within each task, or give concurrent runs different artifact directories.

## Assets and design provenance

- Design workflow: [Impeccable by Paul Bakaus](https://github.com/pbakaus/impeccable), applied with the user's rounded-glass direction and code-first preference.
- Reference images were supplied with `pabellon_barcelona_v1.scene_`; the originals credit [eMirage](https://www.emirage.org/). Reference copies in `public/scenes/` retain image content and have source provenance embedded as JPEG metadata. The original scene and textures are unchanged.
- Manrope is self-hosted through `@fontsource-variable/manrope`; icons use Lucide. License information is included in the respective packages.

No site has been deployed. The local viewer supports camera draft authoring; scene geometry editing, saved projects, live Blender synchronization, and AI controls remain future work. `project.md` remains the original product concept.

## Blockout camera engine attribution

Camera presets, optics, path utilities, easing, and their required types are adapted from Blockout by **Sam Wasserman (wassermanproductions.com)**. Source snapshot: `3f2d0564fd575f70fc28e9bfaa7e94b05e3955d9`. The Apache-2.0 [license](public/licenses/blockout/LICENSE), [NOTICE](public/licenses/blockout/NOTICE), upstream modification history, and [Showcam extraction record](public/licenses/blockout/SHOWCAM-MODIFICATIONS.md) are retained. Credits also appear in the camera authoring panel. The desktop renderer, Electron integration, and FFmpeg binaries were not copied.

`test:camera` checks all 39 presets, optics, world-space subject aiming, deterministic scrubbing, camera-mark edits, playback, extended timelines, source-camera preservation, mobile authoring, and accessibility.

## Independent work

Start with [the collaboration workflow](docs/collaboration.md), [module interfaces](docs/architecture.md), and [the task template](docs/workstreams/task-template.md). One coordinator owns shared contracts, integration, dependencies, configuration, tokens, and project documentation. Up to three agents each own disjoint module paths in separate worktrees. Worktrees isolate files; shared interface changes still need coordination.

```sh
npm run worktree -- help
npm run test:modules
npm run test:workstreams
```

The local baseline includes the runnable scene and original Blender sources. No remote is configured. Worktrees are retained after integration until cleanup is explicitly requested.
