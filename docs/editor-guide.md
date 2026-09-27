# Editor and Development Guide

Detailed controls, workflows, and development notes for Camvas. Start with the [project overview](../README.md) for setup and features. Older source names and storage keys retain the Showcam/FlyThru naming.

[Live demo](https://flythru-production.up.railway.app/)

A live Next.js / PlayCanvas scene editor for Gaussian splats and GLB models, with a reusable rounded glass design system. The scene fills the window, with navigation, inspector, and timeline floating over it.

## Run

```sh
npm ci
npm run dev
```

Open [the residence](http://localhost:3000), [the original pavilion](http://localhost:3000/?scene=pavilion-v1), or [the design system](http://localhost:3000/design-system).

## Scenes and renderer

The default scene is [Private Residence Interior](https://superspl.at/scene/9d09ab82) by Tony Rose / eraser851. Its published v2 streamed SOG is loaded directly from the creator's SuperSplat delivery URL; no copy of the capture is checked into this repository. The viewer starts with a complete coarse view, then streams finer detail within a 4-million-splat desktop / 2-million-splat phone budget. Source availability and CORS remain external dependencies. Use the scene picker to return to the local pavilion GLB. Projects and their recovery data are saved separately for each scene.

PlayCanvas owns the canvas, rendering, streaming, picking, navigation, and gizmos. WebGPU is preferred where supported; WebGL2 is the automatic fallback. Loading errors offer retry, compatibility mode, and the local pavilion. Three.js remains a math dependency for the established camera algorithms, framing, and triangle intersection; React Three Fiber and Drei are removed.

A splat capture is one environment, not a set of segmented chairs and walls. You can place the whole capture, add and animate proxy actors, and author camera moves. Its lighting is baked, actors do not cast shadows onto the capture, and source scale/floor height are not surveyed. No walk collision system is implied. GLB object editing and original camera animation remain available in the pavilion. Materials and lighting can look different from the old renderer.

See [migration notes](workstreams/playcanvas-supersplat.md) for behavior coverage and validation.

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
- Timeline play/pause, scrubbing, restart, and frame stepping on a normalized 30 fps editor timeline.
- Explore navigation with orbit/pan/zoom and keyboard movement, plus Shot mode through all seven source cameras.
- Focus mode, inspector visibility, keyboard controls, and a persistent reduced-transparency preference.
- Responsive reference pages with interactive component examples, validation, empty states, and token copying.
- Peer-to-peer collaboration rooms with share links, live presence/cursors, and synchronized selection, camera mode, timeline, path visibility, and authored shot state.

## Collaborate on a scene

Every viewer URL receives a random `?room=` identifier. Choose **Share** in the collaboration bar and open that link in another browser to join the same scene. Yjs merges scene-editing fields while y-webrtc carries updates directly between peers; presence, names, selections, and cursors use the ephemeral awareness channel.

The prototype uses the public y-webrtc signaling service by default. For a controlled deployment, set `NEXT_PUBLIC_COLLAB_SIGNALING_URLS` to one or more comma-separated secure WebSocket signaling URLs before building. Scene assets are still loaded normally from the app; collaboration sends only compact edit state. Rooms are peer-hosted and are not durable after every participant disconnects.

The viewport renders real 3D geometry and textures exported from Blender. The 30 fps editor timeline retimes the imported camera animation while preserving its source timing; Shot mode shows it directly. Explore movement is unconstrained (no collision detection). Browser PBR materials approximate the original Cycles shader networks. The design-system material specimens still use clearly labeled reference images.

## Navigate the scene

- **Explore:** drag to orbit, Alt-drag to look, right-drag to pan, scroll/pinch to zoom. Use arrow keys or WASD to fly, Space to move up, Ctrl to move down, and Shift to accelerate. A shortcut hint sits at the side of the scene.
- **Shot:** choose a source camera, then play or scrub. Camera.002 contains the original movement; frames 251–374 hold its final pose.
- Click actual geometry to inspect it. Use **Frame selected object** to orbit a selection and **Reset view** to return to the opening camera position.

## Author a camera move

1. Select geometry, then choose **Create camera move**, or open **Inspector → Camera** and choose a subject.
2. Choose one of 39 Blockout camera presets, a 1–60 second duration, an 8–300 mm lens, sensor, and framing. The current viewing direction sets the initial angle; framing uses the object's actual world-space bounds.
3. **Generate move** creates a separate draft camera and timeline track. Play or scrub it; the original Blender cameras remain selectable and unchanged.
4. **Preview** restarts playback and closes the inspector on phones so the shot stays visible. **Path** opens a top-down flight-path popup; **Show in scene** frames the route in Orbit. Expand **Edit camera marks** to seek a mark and edit its position, lens, or roll. Disable **Keep subject centered** to edit pan and tilt.
5. Change generation settings and **Regenerate move** to replace the draft, including mark edits. **Discard draft** returns to the imported camera.

The current scene project keeps one camera draft and up to eight proxy actors, saved automatically in this browser. Preset camera shots can follow blocked actors; imported geometry and props remain static subjects. Preset paths do not check collision or occlusion. Draft camera time starts at frame 1 = 0 seconds; the imported Blender animation retains its export offset. The timeline extends for longer drafts and holds each shorter clip's final pose.

### Optional CinemaTraj CPU path

CinemaTraj can refine the current camera move or generate a path following a blocked actor. The pavilion GLB supplies object bounds. For the residence splat, first generate and review collision boxes in **Project → Collision boxes**; see [splat collision review](splat-collision.md). These approximate proxies cover only the outlined review area. Install the pinned CinemaTraj checkout and Python dependencies locally, then start FlyThru with the two environment variables below:

```sh
git clone https://github.com/Pangolin112/CinemaTraj.git ../CinemaTraj
git -C ../CinemaTraj checkout e0ac10e1e74514b4139a89393dbacbd98d0eee8e
python3 -m venv .cinematraj-venv
.cinematraj-venv/bin/python -m pip install -r scripts/cinematraj/requirements.txt
CINEMATRAJ_ROOT="$(cd ../CinemaTraj && pwd)" CINEMATRAJ_PYTHON="$(pwd)/.cinematraj-venv/bin/python" npm run dev
```

Open the pavilion, or review collision boxes in the residence. In **Inspector → Camera**, create a camera move, then press **Optimize current move** in **Optimize drone path**. CinemaTraj refines its camera positions while keeping the move's timing, lens, and aim. Moves with cuts or fixed landmarks are not eligible. To create a new actor-following move, choose an actor and press **Create actor path**. FlyThru sends the sampled route and scene bounds to CinemaTraj's `DirectPoseOptimizer` on CPU, then saves the returned positions in the draft. Failure leaves the current draft intact. The shot and route popup play the same sampled route. Axis-aligned object bounds or reviewed splat boxes are approximate collision proxies; the solver can reject a route when no clear result is found. The integration does not run CinemaTraj's prompt planner, occlusion optimizer, or render pipeline. The hosted demo needs its own CinemaTraj Python setup before this option can run there.

## Save a project

Open **Project** in the inspector. Named projects contain an ordered list of scenes; each scene has its own source asset, camera draft, actor blocking, props, placements, and landmarks. Add or rename scenes there, or switch scenes from the heading. Changes save in this browser. Export or import the whole project from the scene controls; the older scene JSON controls exchange only the current scene. Existing single-scene saves still open.

Malformed files leave your work unchanged. If browser storage is damaged, blocked, or full, the editor keeps your in-memory work and offers **Retry browser save** or export. Corrupted stored data is retained until explicit recovery. Imports are limited to 1 MB and scene-compatible version 1 projects.

## Block actors

1. Open **Actors**, then **Add actor**. A human-sized proxy appears on the terrace and is framed in the viewport.
2. Edit its name, height, or first mark's X/Y/Z position and heading. Fields commit on Enter or blur; Y is up, positions are the actor's feet, and heading zero faces −Z.
3. Move the timeline playhead, choose **Add mark at playhead**, and edit the new mark's position/heading. Select marks to seek, or adjust their times in increasing order. There are up to 64 marks per actor, from 0 to 60 seconds.
4. **Preview** plays the shared timeline. Movement uses linear positions and the shortest heading arc, holds at endpoints, and supports deterministic backward scrubbing. On phones, Preview closes the inspector.
5. Select a proxy in the viewport, object browser, or actor track; **Frame actor** centers it. **Remove actor** removes its saved track. The timeline contracts safely if a long actor track is removed.

Actors are spatial proxies without collision detection or gait animation. Camera presets and optional CinemaTraj paths can follow their blocking. See [current AI flight planning](flight-planning.md) for the implemented workflow and eligibility limits.

## Move objects in the viewport

Right-click scene geometry, an actor, or an object-browser row for context actions. **Object actions** in the inspector and **More actions** in the floating object tools offer the same menu on touch screens. Arrow keys navigate the menu; Escape closes it. Shift+F10 opens actions for a focused object row or the selected object from the canvas.

- **Move:** drag a selected object's body across a horizontal plane or use the XYZ handles, including vertical movement. Actors can also **Rotate** around the Y-axis with the ring.
- Actor gestures pause playback and update or add a movement mark at the current playhead. Imported furniture and architecture use static world offsets that apply at every frame. Their original asset and camera animation remain unchanged.
- During a gesture, the viewport previews the edit; release saves it and **Escape** cancels it. **Undo** reverses the latest object edit while no later project edit has replaced it.
- Actor actions also include **Duplicate actor** (copies the full movement track at the same position) and **Delete actor**. Move the duplicate to separate it. Imported objects offer **Reset transform** and numeric X/Y/Z offsets in the inspector.
- **Select** leaves normal Orbit navigation active. Right-drag remains pan. Source cameras can be inspected, framed, and viewed through, but cannot be repositioned with these controls.

Camera drafts capture a static subject snapshot. After moving their subject, regenerate the camera move to frame its new location. These controls do not change mesh geometry, snap to floors, or prevent collisions.

## Talk to the director

The Director panel sends typed directions to the Codex CLI installed on the machine running Showcam and streams replies into the viewer. Browsers with Speech Recognition can transcribe a spoken direction through the microphone button. Sign in to Codex, run `npm run dev`, and open the viewer. Codex proposes one scene command in a read-only turn; the editor validates it before applying it. Supported commands move imported scene objects, select objects or cameras, generate a draft camera move, seek, play, pause, frame a selection, and discard a draft. Object placements and camera drafts save with the local project; the source scene files stay unchanged.

The Director can also make a prop follow a blocked actor, as in “have Alice carry the case.” The relationship is saved with the project, follows actor position and heading during playback, and can be inspected or removed with **Stop following** in the prop inspector. Detaching or deleting the actor leaves the prop at its current world position. Attachments currently link props to actors; imported scene geometry and cameras are not attachment children.

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
npm run test:projects
npm run test:objects
npm run test:splats
```

The existing viewport regression suites explicitly select the pavilion; `test:splats` checks the new streamed scene, scene switching, and loading recovery and requires network access. The UI check expects a server at `http://localhost:3000`; set `SHOWCAM_URL` to use another URL. Install Chromium once with `npx playwright install chromium` if needed. It exercises real orbit/zoom, raycast selection, keyboard movement/look and the side shortcut hint, camera animation versus Blender samples at frames 1/125/250/374, backward scrubbing, playback, keyboard input, validation, transparency persistence, and empty states; checks layout at desktop and mobile sizes; and runs axe WCAG A/AA checks. Set `SHOWCAM_ARTIFACT_DIR` to isolate screenshots and results (defaults to gitignored `.impeccable/review/`). Run browser suites sequentially within each task, or give concurrent runs different artifact directories.

## Assets and design provenance

- Design workflow: [Impeccable by Paul Bakaus](https://github.com/pbakaus/impeccable), applied with the user's rounded-glass direction and code-first preference.
- Reference images were supplied with `pabellon_barcelona_v1.scene_`; the originals credit [eMirage](https://www.emirage.org/). Reference copies in `public/scenes/` retain image content and have source provenance embedded as JPEG metadata. The original scene and textures are unchanged.
- Manrope is self-hosted through `@fontsource-variable/manrope`; icons use Lucide. License information is included in the respective packages.

The local viewer supports camera draft authoring, persistent scene placements, actor blocking, optional CinemaTraj actor-following paths, and Codex-directed live scene actions. Live Blender synchronization remains future work. `project.md` remains the original product concept.

## Blockout camera engine attribution

Camera presets, optics, path utilities, easing, and their required types are adapted from Blockout by **Sam Wasserman (wassermanproductions.com)**. Source snapshot: `3f2d0564fd575f70fc28e9bfaa7e94b05e3955d9`. The Apache-2.0 [license](../public/licenses/blockout/LICENSE), [NOTICE](../public/licenses/blockout/NOTICE), upstream modification history, and [Showcam extraction record](../public/licenses/blockout/SHOWCAM-MODIFICATIONS.md) are retained. Credits also appear in the camera authoring panel. The desktop renderer, Electron integration, and FFmpeg binaries were not copied.

`test:camera` checks all 39 presets, optics, world-space subject aiming, deterministic scrubbing, camera-mark edits, playback, extended timelines, source-camera preservation, mobile authoring, and accessibility.

## Independent work

Start with [the collaboration workflow](collaboration.md), [module interfaces](architecture.md), and [the task template](workstreams/task-template.md). One coordinator owns shared contracts, integration, dependencies, configuration, tokens, and project documentation. Up to three agents each own disjoint module paths in separate worktrees. Worktrees isolate files; shared interface changes still need coordination.

```sh
npm run worktree -- help
npm run test:modules
npm run test:workstreams
```

The repository includes the runnable scene and original Blender sources. Worktrees are retained after integration until cleanup is explicitly requested.
