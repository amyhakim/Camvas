# Showcam

A live Next.js / Three.js viewer for the supplied Blender pavilion scene, with a reusable rounded glass design system. The scene fills the window, with navigation, inspector, and timeline floating over it.

## Run

```sh
npm ci
npm run dev
```

Open [the live viewer](http://localhost:3000) or [the design system](http://localhost:3000/design-system).

## What works

- Shared glass surfaces, tokens, typography, buttons, fields, segmented controls, switches, badges, and property rows.
- Real geometry selection connecting raycast clicks, the scene browser, selection bounds, and live inspector data.
- Timeline play/pause, scrubbing, restart, and frame stepping at 24 fps.
- Orbit/pan/zoom navigation, keyboard and touch Fly navigation, and Shot mode through all seven source cameras.
- Focus mode, inspector visibility, keyboard controls, and a persistent reduced-transparency preference.
- Responsive reference pages with interactive component examples, validation, empty states, and token copying.

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

The current scene project keeps one camera draft and up to eight proxy actors, saved automatically in this browser. Camera subjects are treated as static, and generated paths do not check collision or occlusion. This is local procedural authoring, without CinemaTraj or a Blender backend. Draft camera time starts at frame 1 = 0 seconds; the imported Blender animation retains its export offset. The timeline extends for longer drafts and holds each shorter clip's final pose.

## Save a project

Open **Project** in the floating utility controls or inspector. Name the project and watch its browser save status. Camera drafts, actors, and imported-object placements restore after reload. **Export JSON** downloads a portable copy; **Import JSON** validates a copy before replacing the working project. Save scope is this browser and scene, with one current project; keep exported copies to manage alternatives or move between browsers.

Malformed files leave your work unchanged. If browser storage is damaged, blocked, or full, the editor keeps your in-memory work and offers **Retry browser save** or export. Corrupted stored data is retained until explicit recovery. Imports are limited to 1 MB and scene-compatible version 1 projects.

## Block actors

1. Open **Actors**, then **Add actor**. A human-sized proxy appears on the terrace and is framed in the viewport.
2. Edit its name, height, or first mark's X/Y/Z position and heading. Fields commit on Enter or blur; Y is up, positions are the actor's feet, and heading zero faces −Z.
3. Move the timeline playhead, choose **Add mark at playhead**, and edit the new mark's position/heading. Select marks to seek, or adjust their times in increasing order. There are up to 64 marks per actor, from 0 to 60 seconds.
4. **Preview** plays the shared timeline. Movement uses linear positions and the shortest heading arc, holds at endpoints, and supports deterministic backward scrubbing. On phones, Preview closes the inspector.
5. Select a proxy in the viewport, object browser, or actor track; **Frame actor** centers it. **Remove actor** removes its saved track. The timeline contracts safely if a long actor track is removed.

Actors are spatial proxies, without collision detection, gait animation, or automatic camera following. [AI integration is the next planned phase](docs/ai-planning-next.md).

## Move objects in the viewport

Right-click scene geometry, an actor, or an object-browser row for context actions. **Object actions** in the inspector and **More actions** in the floating object tools offer the same menu on touch screens. Arrow keys navigate the menu; Escape closes it. Shift+F10 opens actions for a focused object row or the selected object from the canvas.

- **Move:** drag a selected object's body across a horizontal plane or use the XYZ handles, including vertical movement. Actors can also **Rotate** around the Y-axis with the ring.
- Actor gestures pause playback and update or add a movement mark at the current playhead. Imported furniture and architecture use static world offsets that apply at every frame. Their original asset and camera animation remain unchanged.
- During a gesture, the viewport previews the edit; release saves it and **Escape** cancels it. **Undo** reverses the latest object edit while no later project edit has replaced it.
- Actor actions also include **Duplicate actor** (copies the full movement track at the same position) and **Delete actor**. Move the duplicate to separate it. Imported objects offer **Reset transform** and numeric X/Y/Z offsets in the inspector.
- **Select** leaves normal Orbit navigation active. Right-drag remains pan. Source cameras can be inspected, framed, and viewed through, but cannot be repositioned with these controls.

Camera drafts capture a static subject snapshot. After moving their subject, regenerate the camera move to frame its new location. These controls do not change mesh geometry, snap to floors, or prevent collisions.

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
```

The UI check expects a server at `http://localhost:3000`; set `SHOWCAM_URL` to use another URL. Install Chromium once with `npx playwright install chromium` if needed. It exercises real orbit/zoom, raycast selection, fly movement/look, touch movement buttons, camera animation versus Blender samples at frames 1/125/250/374, backward scrubbing, playback, keyboard input, validation, transparency persistence, and empty states; checks layout at desktop and mobile sizes; and runs axe WCAG A/AA checks. Set `SHOWCAM_ARTIFACT_DIR` to isolate screenshots and results (defaults to gitignored `.impeccable/review/`). Run browser suites sequentially within each task, or give concurrent runs different artifact directories.

## Assets and design provenance

- Design workflow: [Impeccable by Paul Bakaus](https://github.com/pbakaus/impeccable), applied with the user's rounded-glass direction and code-first preference.
- Reference images were supplied with `pabellon_barcelona_v1.scene_`; the originals credit [eMirage](https://www.emirage.org/). Reference copies in `public/scenes/` retain image content and have source provenance embedded as JPEG metadata. The original scene and textures are unchanged.
- Manrope is self-hosted through `@fontsource-variable/manrope`; icons use Lucide. License information is included in the respective packages.

No site has been deployed. The local viewer supports camera draft authoring; scene geometry editing, moving-actor camera tracking, live Blender synchronization, and AI controls remain future work. `project.md` remains the original product concept.

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
