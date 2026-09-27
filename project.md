# Showcam / FlyThru — Product Vision, Current Implementation, and Technical Plan

**Last updated:** September 26, 2026

**Implementation baseline:** `origin/main` at `90b7e99`, including merged pull requests #1–#6.

**Repository:** [amyhakim/FlyThru](https://github.com/amyhakim/FlyThru)

**Published demo address:** [FlyThru on Railway](https://flythru-production.up.railway.app/)

**Local application:** `http://localhost:3000/`

This document replaces the original conversational concept note with a detailed reference for the product and the software that now exists. It preserves the original ambition: a director should be able to work through the spatial and cinematic decisions of a scene in an editable environment, with an assistant helping translate intent into concrete changes.

Implementation statements below are grounded in the repository and merged work. A merged feature, a configured external service, and a verified production deployment are different states. The demo address is recorded here for convenience; this documentation update did not verify its deployed commit, external credentials, or live AI service availability.

## Contents

1. [Product definition and long-term vision](#1-product-definition-and-long-term-vision)
2. [Users, problems, and creative workflow](#2-users-problems-and-creative-workflow)
3. [Current product status](#3-current-product-status)
4. [Scenes and environment representations](#4-scenes-and-environment-representations)
5. [PlayCanvas rendering architecture](#5-playcanvas-rendering-architecture)
6. [Navigation, selection, and inspection](#6-navigation-selection-and-inspection)
7. [Camera authoring](#7-camera-authoring)
8. [Actor blocking](#8-actor-blocking)
9. [Object manipulation and undo](#9-object-manipulation-and-undo)
10. [Timeline, coordinates, and units](#10-timeline-coordinates-and-units)
11. [Project persistence and data contracts](#11-project-persistence-and-data-contracts)
12. [The Codex Director](#12-the-codex-director)
13. [Assistant orb and interface design](#13-assistant-orb-and-interface-design)
14. [Backend planning and optimization services](#14-backend-planning-and-optimization-services)
15. [Application architecture and module ownership](#15-application-architecture-and-module-ownership)
16. [Local development and deployment](#16-local-development-and-deployment)
17. [Validation evidence and coverage limits](#17-validation-evidence-and-coverage-limits)
18. [Recent delivery history](#18-recent-delivery-history)
19. [Current limitations and engineering gaps](#19-current-limitations-and-engineering-gaps)
20. [Proposed roadmap](#20-proposed-roadmap)
21. [Demonstration and product evaluation](#21-demonstration-and-product-evaluation)
22. [Provenance and related documentation](#22-provenance-and-related-documentation)

## 1. Product definition and long-term vision

Showcam is a browser-based spatial planning and camera-authoring application. The repository and deployment use the FlyThru name, while the package, editor, project file format, and much of the product language still use Showcam. These names currently refer to the same implementation; a final public naming decision has not been established by this work.

The product centers on a structured scene containing an environment, identifiable objects, proxy actors, camera information, and time-based tracks. A user can navigate the location, inspect a subject, move editable objects, block actors, create a camera move, play the result, and save the underlying decisions. The Director adds conversational commands to part of that workflow.

The original product concept remains broader than the current application. The intended destination is an AI-assisted previs environment in which a director can iteratively develop both action and camera choreography. A future instruction might describe two characters moving through a location, a reveal at a particular narrative beat, and a camera transition that supports that reveal. The application would produce editable actor and camera tracks, show the proposal, and let the director refine it through direct manipulation or conversation.

That destination depends on keeping structured project data authoritative. A scene change should become an identifiable modification to an actor mark, object placement, camera setting, or other supported contract. The renderer should display that state consistently. Natural-language explanations, rendered images, and future generative-video output should remain connected to those underlying decisions.

### The central product promise

Help a director move from an idea to an inspectable spatial plan:

- Understand the location from multiple viewpoints.
- Establish where subjects and cameras are placed.
- Explore lens, composition, duration, and movement.
- Watch timing play out in a shared scene.
- Refine individual decisions without rebuilding everything.
- Preserve the result in a reusable project document.
- Use an assistant to reduce repetitive operations and interpret supported directions.

The current application delivers a working foundation for this promise. It does not yet deliver complete choreography generation, a multi-shot sequence editor, or production-ready techvis.

### Role of future cinematic concept rendering

The original concept proposed an optional generative rendering layer, including Seedance as one possible future integration. That idea remains a roadmap concept. There is no Seedance adapter, video-generation route, or “Render Concept” workflow in the current repository.

If such a layer is added, it should generate a visual interpretation of an approved structured plan. The project should retain the camera path, actor positions, timing, and source scene even when the generated imagery differs from the simulation. The creative preview and the measured plan serve different purposes and should be presented with clear provenance.

## 2. Users, problems, and creative workflow

### Intended users

The initial audience is directors and collaborators exploring a scene before production. Potential collaborators include a cinematographer, previs artist, action designer, editor, or other person who needs to discuss composition and movement. These are intended roles, not a claim that production teams have adopted or validated the application.

The present interaction model is best suited to one person operating a browser and discussing the result with others. There are no team accounts, shared editing sessions, permission roles, cloud project libraries, or simultaneous collaboration controls.

### Problems the product addresses

A written shot description leaves many spatial decisions unresolved. A user can describe an orbit, a reveal, or a push toward a subject without specifying the exact starting angle, camera distance, lens, or relationship to the surrounding environment. A static image also cannot fully communicate how a move evolves over time.

Showcam makes some of those decisions visible and editable. The user can move through the environment, select a subject, generate an initial camera path, adjust marks, and replay the result. Actor proxies add a second source of timing information, so camera and actor movement can be viewed together even though automatic actor-following cameras are not implemented.

The assistant is useful when a request maps to a supported action. It can reduce the steps needed to choose a camera preset, move an imported object, select a camera, or control playback. Requests involving unsupported choreography still require further product and engine work.

### Workflow vocabulary

The original concept described a progression from idea to production. Within this project, the terms have these intended meanings:

| Stage | Question it helps answer | Showcam status |
| --- | --- | --- |
| Storyboarding | What compositions and narrative beats should the sequence contain? | Product context; no storyboard authoring surface. |
| Blocking | Where do performers or subject proxies move, and when? | Manual timed actor proxies are implemented. |
| Previs | What does the camera see as spatial action unfolds? | Interactive scene playback and camera drafts are implemented. |
| Stuntvis | How should physical action and camera choreography relate? | Long-term ambition; no stunt simulation or rigging model. |
| Techvis | Which measured positions, optics, rig movements, and timing are needed? | Some numeric inputs exist, but production feasibility analysis and reports are not implemented. |
| Concept rendering | How might an approved plan look with more finished imagery? | The residence is a detailed captured environment; generative concept rendering remains proposed. |

These categories describe the product's intended scope. The application does not certify that a physical setup, camera move, stunt, or location plan is safe or feasible.

## 3. Current product status

The application has progressed from a pavilion viewer into a local project editor with two environment types, camera authoring, actor blocking, persistent object placement, a conversational Director, and a compact assistant interface.

| Capability | Current state | Important qualification |
| --- | --- | --- |
| Full-window scene viewport | Implemented | Custom PlayCanvas application integrated with React. |
| High-detail Gaussian splat environment | Implemented | Public streamed residence capture; external asset host required. |
| Local GLB environment | Implemented | Barcelona Pavilion remains selectable. |
| Explore and Shot modes | Implemented | Explore movement is unconstrained; no collision system. |
| Object selection and inspection | Implemented | GLB entities are individually identifiable; the splat capture is one entity. |
| Camera generation | Implemented | 39 deterministic presets adapted from Blockout. |
| Camera mark editing | Implemented | One saved draft camera per scene project. |
| Proxy actor blocking | Implemented | Up to eight actors with timed position and heading marks. |
| Object translation and actor rotation | Implemented | Saved offsets for imported objects; movement marks for actors. |
| Undo | Implemented with limited scope | Latest object edit while no later project mutation invalidates it. |
| Browser-local persistence | Implemented | One current project per scene, with JSON import/export. |
| Conversational Director | Implemented | Requires Codex CLI access on the server host; one validated action per turn. |
| Spoken directions | Browser-dependent | Uses available browser speech recognition to produce text. |
| Assistant orb and compact tools | Implemented and merged | Latest interface work in PR #6. |
| Gemini planning API | Prototype route implemented | Credentials and external model availability must be configured separately. |
| GPU optimization API | Proxy contract implemented | The external worker and optimizer are not included. |
| Multi-shot editing, cloud collaboration, generative video | Not implemented | Future product work. |

The interface is operational rather than a set of static mockups. Nevertheless, implemented route code does not demonstrate that every optional service is available in the deployed environment.

## 4. Scenes and environment representations

### 4.1 Scene catalog

The scene catalog is currently explicit in code. It contains two entries:

| Scene | Stable ID | Manifest | Representation |
| --- | --- | --- | --- |
| Private Residence Interior | `residence-9d09ab82` | `public/scenes/residence.json` | Streamed Gaussian splat capture. |
| Barcelona Pavilion | `pavilion-v1` | `public/scenes/pavilion.json` | Local GLB with textures, objects, and source cameras. |

Opening `/` selects the residence. `/?scene=pavilion-v1` opens the pavilion, and the shorter `?scene=pavilion` alias also resolves to it. Unknown scene query values fall back to the default residence. The scene picker changes the URL and reloads the editor, allowing project hydration to run for the selected scene.

There is no general scene upload dialog, user-managed asset library, or arbitrary SuperSplat URL importer yet. Adding another environment currently requires preparing compatible asset metadata and extending the catalog.

### 4.2 Private Residence Interior

The default environment is [Private Residence Interior](https://superspl.at/scene/9d09ab82), attributed in the application to **Tony Rose / eraser851**. Its manifest references the published dataset at:

```text
https://d28zzqy0iyovbz.cloudfront.net/9d09ab82/v2/lod-meta.json
```

The repository contains the manifest and integration code, not a redistributed copy of the scan. Runtime access depends on the asset remaining available and permitting the browser's cross-origin requests. The attribution link remains visible in the viewer's scene credits when that caption is shown.

The manifest exposes one `Splat` entity and one source camera, `residence:camera`. The camera corresponds to the published opening view. The residence uses a 24 fps timeline with a base range of frames 1–374; its source camera is static. That base timeline is an editor range, not evidence that the scan contains animation.

The root capture uses a 180-degree Z rotation to match its published viewer orientation. The stored opening FOV was converted from the source's horizontal framing to a vertical FOV for the 16:9 source aspect. The manifest also supplies an actor origin for convenient initial placement.

The visual detail comes from the captured splat data and its streamed levels of detail. It does not imply a semantic scene graph of every visible furnishing. The sofa, table, lamps, windows, and walls visible in the capture are not individually selectable mesh assets.

Consequences for authoring:

- The entire capture can be selected and translated as one environment.
- Proxy actors can be added and moved independently within it.
- Camera drafts can be created using the supported subject and bounds workflow.
- Individual photographed furniture cannot be moved or deleted independently.
- Captured lighting is baked into the appearance.
- Actors do not cast realistic shadows onto the photographed surfaces.
- Floor alignment and metric scale are approximate rather than surveyed.
- There is no reconstructed collision mesh, floor snapping, or walkable-surface guarantee.

### 4.3 Barcelona Pavilion

The original environment remains a local asset at `public/scenes/pavilion.glb`. Its manifest currently contains 190 entities: seven cameras, four collections, and 179 meshes. These counts describe the exported scene manifest; they are not a count of individual triangles, render calls, or all objects in the original Blender file.

The source timeline uses 24 fps and frames 1–374. `Camera.002` is the active imported camera, with the authored movement ending at frame 250. Later frames retain its final pose.

This environment is the better demonstration of individual imported-object selection and placement editing. Furniture, architecture, and other exported entities retain stable IDs through glTF metadata, so a clicked object can be connected to the object browser, inspector, saved placement, and camera subject.

The exporter approximates the original Blender rendering. It evaluates architectural modifiers, realizes instances, shares geometry where applicable, and exports source camera animation and metadata. Landscape density and some materials are simplified. The browser image should not be described as pixel-identical to the original Cycles render.

### 4.4 Representation parity

The two scenes share the editor's navigation, actor, camera, persistence, and timeline interfaces. Their asset-level capabilities differ. A scan can supply a convincing environment without providing editable component meshes. A GLB can supply individually addressable objects without matching the richness of a photographic capture.

The migration preserves supported editor workflows. It does not establish “100% feature parity” for every material, lighting effect, geometry operation, or semantic object across both representations.

## 5. PlayCanvas rendering architecture

### 5.1 Renderer migration

The active renderer is now PlayCanvas. The earlier React Three Fiber and Drei rendering integration was removed. Three.js remains installed for established mathematical utilities used by the camera engine, framing, and triangle intersection. Its continued presence in dependencies does not mean the viewport is still rendered by Three.js.

This is a custom viewport, rather than an embedded SuperSplat iframe. The application controls the scene, camera, proxy actors, selection helpers, gizmos, and editor transactions. It loads compatible splat data using the underlying engine capabilities.

### 5.2 Graphics device and quality policy

The runtime requests WebGPU first and allows WebGL2 fallback. A compatibility action explicitly retries with WebGL2. Graphics initialization, device loss, and asset loading are handled through visible loading or recovery states.

The current quality policy is:

| Setting | Desktop | Compact/mobile breakpoint |
| --- | --- | --- |
| Splat budget | 4,000,000 | 2,000,000 |
| Device-pixel-ratio cap | 2 | 1.5 |
| Breakpoint used for this choice | Above 800 CSS px | At or below 800 CSS px |

These are rendering budgets, not promises that every frame draws exactly that number of splats. The visible count depends on the dataset, camera, available detail, and engine selection. The quality choice is made when the runtime is created; it is not a user-facing adaptive-quality settings panel.

### 5.3 Loading and progressive detail

For a streamed capture, the runtime initially restricts the scene to its coarsest available level of detail. It waits until streaming reports a complete ready view and a frame has rendered before revealing the scene as ready. The LOD range then opens so nearby detail can refine within the configured budget.

A 90-second readiness timer produces a recoverable error if the streamed scene fails to produce a usable initial frame. The user can retry, choose compatibility mode, or return to the local pavilion. The local asset provides a recovery route when the public scan host is unavailable.

After readiness, rendering is requested when scene streaming, input, playback, or editor changes need another frame. The viewport does not depend on React rebuilding a component tree for every rendered object on every animation frame.

### 5.4 Ownership and lifecycle

The React host creates a fresh canvas for each runtime lifecycle. Pending initialization is cancellable, and cleanup destroys the runtime and its owned resources. This also prevents React Strict Mode effect replay from allowing an older asynchronous device request to disrupt a newer canvas.

Responsibilities are separated across four implementation units:

- `live-viewport.tsx`: React mounting, imperative handle, loading messages, retries, and disposal.
- `runtime.ts`: PlayCanvas application, active camera, evaluated poses, actor meshes, visual helpers, bounds, picking integration, and view commands.
- `content.ts`: GLB/splat loading, entity identity, source animation, asset ownership, and mesh triangle selection.
- `viewport-input.ts`: pointer, touch, keyboard, movement, body dragging, and transform-gizmo transactions.

Engine instances remain inside the viewport boundary. Other features communicate with serializable contracts and callbacks.

## 6. Navigation, selection, and inspection

### Explore

Explore supports dragging around the current target, right-drag panning, wheel zoom, and touch navigation. Touch gestures support orbiting and multi-touch pan/zoom. Selecting an object and framing an object are separate operations, so inspection does not always move the user's viewpoint unexpectedly.

Explore mode supports keyboard movement with WASD or arrow keys, Space for ascending, Ctrl for descending, Alt-drag to look, and Shift acceleration. A side hint shows the six movement shortcuts. The viewport tracks key release and blur to avoid continuing movement after an interaction ends.

Movement is unrestricted. A user can travel through a wall, below a floor, or outside the area with useful capture data. There is no navigation mesh or collision-aware walkthrough system.

### Shot

Shot mode uses the selected imported camera or generated draft. Imported cameras retain their source animation. A draft supplies its evaluated position, orientation, lens, and vertical FOV. Shot presentation uses the established 16:9 viewing area.

### Selection and inspection

For GLB content, mesh selection uses geometry intersection and stable exported entity IDs. Actor proxies can also be selected. A captured environment uses its whole-scene bound rather than per-furnishing mesh selection.

The object browser can filter visible metadata such as names, type, category, source name, and materials. The inspector exposes object details and appropriate actions, including framing, source-camera viewing, camera authoring, or numeric placement controls.

Source cameras can be selected, inspected, framed, and viewed through. The object-placement tools do not reposition them. A generated camera draft is edited through the camera-authoring controls instead.

Focus view reduces surrounding UI to prioritize the image. The transparency preference offers an opaque alternative when reading over the scene is difficult.

## 7. Camera authoring

### 7.1 Deterministic generation

The camera feature adapts 39 presets and associated optics/path utilities from Blockout. Generation is local and deterministic. The assistant may select settings for that engine, but the established camera code creates the actual marks and evaluates the path.

The normal workflow is:

1. Select a supported scene subject.
2. Open camera authoring from the inspector or the subject's camera action.
3. Choose a preset, duration, lens, sensor, and framing.
4. Capture the subject's current world-space bounds and the current viewing position.
5. Generate a separate editable draft.
6. Play, scrub, preview the path, or change camera marks.
7. Regenerate or discard the draft as needed.

The generation range is 1–60 seconds with focal length between 8 and 300 mm. Available sensor choices are Super 16, Super 35, full frame, and IMAX 65. Framing choices are wide, full, and detail. The Director's generation action currently uses full frame; manual controls expose the broader sensor selection.

### 7.2 Subject snapshot and framing

A subject snapshot stores its ID, display name, minimum and maximum world bounds, and the camera position from which generation begins. The bounds are taken from the placed geometry, so imported-object offsets influence subsequent framing and generation.

The captured target is static. The `trackSubject` setting keeps a generated camera aimed at the stored target; it is not an implementation of continuous tracking of a moving actor. Moving the original subject afterward does not rewrite an existing camera draft. Regeneration is required to capture its new location.

Path overview uses the clear viewport region between visible overlays. That rectangle is computed by the editor and passed to the viewport as normalized data. It helps keep the path and marks visible without coupling the renderer to CSS selectors or React panels.

### 7.3 Editing and playback

A camera mark stores time, position, pan, tilt, roll, focal length, easing, and hold data. The current UI supports editing positions, lens, and roll, and exposes pan/tilt editing when subject centering is disabled. Mark selection seeks the timeline. Edits and tracking changes pause playback.

Generate creates or replaces the draft, selects its camera, and starts at the beginning. Preview restarts playback. Regeneration replaces existing marks, including manual changes. Discard removes the draft from the project and returns to the selected scene's source-camera workflow.

Only one camera draft is stored in each current project. There is no multi-shot sequence, cut list, alternate-take browser, or version tree. Exporting separate project files is the present way to preserve alternatives.

### 7.4 Geometry and physical limits

Generated paths do not test walls, occlusion, camera-rig reach, speed limits, acceleration comfort, or subject visibility throughout a move. A plausible preset can still intersect the scene or look away from a desired feature after manual editing. The viewport is the user's current means of evaluating the result.

## 8. Actor blocking

Actors are selectable spatial proxies intended to show position, scale, heading, and timing. They are not rigged characters and do not play a walking cycle, fight animation, facial performance, or motion-capture clip.

A project supports up to eight actors. Each actor stores:

- A unique ID beginning with `actor:`.
- A display name and six-digit hexadecimal color.
- A height between 0.5 and 3 metres.
- Between one and 64 ordered movement marks.
- A feet position and heading at every mark.

Actor marks span 0–60 seconds. Positions use renderer world coordinates, with Y as up. Heading is in radians: zero faces −Z, and a positive quarter turn faces −X. Position components are bounded to ±1000 by the project validator.

An actor is initially placed near the scene's configured actor origin, with a small offset to distinguish consecutive additions. In the residence, that origin is a practical starting estimate rather than a surveyed floor coordinate.

### Manual blocking workflow

The user adds an actor, names it, adjusts its height and initial pose, then moves the playhead and adds additional marks. Marks must remain strictly ordered with no duplicate times. Position interpolation is linear, and heading follows the shortest angular arc. Evaluation is deterministic when scrubbing forward or backward and holds at the endpoints.

The viewport's Move tool supports horizontal body dragging and XYZ handles, including vertical adjustment. Rotate changes the actor's Y-axis heading. A gesture previews the change while dragging and commits a mark at the current playhead when released. Editing at an existing mark updates that mark; editing between marks can insert a new one within the supported limits.

Duplicate creates a new actor with an independent copy of the source movement track. It starts at the same positions, so the user should move it if visual separation is desired. Delete removes the actor and its track. The timeline extends or contracts to reflect the longest remaining authored content.

### Future actor capabilities

Automatic choreography, pathfinding, collision avoidance, interaction constraints, actor-following camera generation, and animation retargeting remain future work. The current actor system provides a useful data foundation for those additions without claiming their behavior.

## 9. Object manipulation and undo

Imported meshes and collections use persistent world-space translation offsets. The splat environment can use the same placement concept as a whole capture. These offsets are separate from the original source asset.

The viewport restores the base transforms, evaluates source animation, and applies placements. The transform adapter preserves original orientation and scale and accounts for transformed parents. Multiple pieces associated with a stable object ID move together without intentionally applying the offset twice to nested nodes.

### Interaction transaction

A manipulation has four phases:

1. **Start:** identify the object and capture the editing context.
2. **Preview:** update its visible transient pose or placement.
3. **Commit:** validate and write the completed change into project state.
4. **Cancel:** restore the pre-gesture state when Escape, cancellation, or loss of interaction requires it.

The editor owns the transaction and persistence. The viewport reports intent and renders the preview. Imported-object placements apply at every frame; actor transformations edit a timed movement mark.

Numeric X/Y/Z controls provide an alternative to dragging. Reset transform removes the imported object's accumulated offset and returns it to its source placement. Mesh rotation, mesh scaling, topology edits, snapping, and collision-aware placement are not exposed by this workflow.

### Context actions and compact toolbar

Context actions are available by right-clicking geometry, an actor, or an object-browser row. Keyboard users can use Shift+F10 or the context-menu key where supported. Inspector actions and the toolbar's More actions button provide explicit touch-accessible entry points.

The floating object toolbar now uses icons for Select, Move, actor-only Rotate, More actions, and Undo. Each control retains an accessible name; hover titles identify the buttons, and a screen-reader description retains the distinction between actor marks and all-frame scene placement. The actual context menu keeps written action labels, including destructive actions.

Undo is deliberately narrower than a full edit history. It restores the latest object edit while no later project mutation has invalidated that snapshot. It should not be described as unlimited undo/redo for all camera, actor, assistant, and project operations.

## 10. Timeline, coordinates, and units

### 10.1 Shared timeline

The timeline combines source camera/scene clips, the generated draft, and actor tracks. It provides play/pause, scrubbing, frame stepping, first/last frame navigation, timecode, frame counts, and selectable tracks.

It extends for longer camera drafts or actor tracks. Shorter clips hold their final state. Selecting an actor track selects that actor; selecting a camera track enters the relevant camera workflow.

The timeline is controlled by the editor. It receives generic track descriptions and callbacks rather than reaching into camera-generation or renderer internals. This separation matters when new track types are introduced.

### 10.2 Coordinate conventions

| Data | Convention |
| --- | --- |
| Renderer positions, bounds, actor paths, placement offsets | World Y-up coordinates, nominally metres. |
| Imported/source inspection metadata | Z-up coordinates retained from the source/export convention. |
| `positionWeb` | Renderer-space Y-up position. |
| Camera pan, tilt, and roll | Radians, applied in Euler order YXZ. |
| Camera FOV | Vertical degrees. |
| Focal length | Millimetres. |
| Actor position | Feet location in world coordinates. |
| Actor heading | Radians around Y, zero toward −Z. |

“Nominally metres” is particularly important for the capture: numeric values follow the editor's metric convention, but the source capture has not been calibrated as a measured location survey.

### 10.3 Time origins

Imported animation and authored animation use different time origins intentionally:

```text
Imported source animation time = frame / fps
Authored camera/actor time      = (frame - 1) / fps
Authored end frame             = ceil(duration × fps) + 1
```

At 24 fps, imported frame 1 corresponds to 1/24 second in the exported source animation, while authored frame 1 is time zero. Treating these conventions as interchangeable would shift animation samples and mark placement.

Timeline clip widths use endpoint differences rather than inclusive frame counts. The editor translates between scene, draft, and actor timing. The timeline itself should not infer a hidden camera time origin.

## 11. Project persistence and data contracts

### 11.1 Storage scope

Each browser has one current saved project per scene. The storage key is:

```text
showcam-project:v1:<URL-encoded scene ID>
```

Pavilion and residence data therefore remain separate. Scene switching restores the relevant project rather than rewriting the other scene's actors or draft. The old pavilion key is preserved.

This is local browser persistence. There is no server project database, login-based synchronization, shared cloud document, or automatic cross-device backup.

### 11.2 Version 1 document

The current project schema is conceptually:

```ts
{
  format: 'showcam-project';
  version: 1;
  sceneId: string;
  name: string;
  shot: CameraShot | null;
  actors: ActorTrack[];
  placements?: { id: string; offset: [number, number, number] }[];
}
```

The document stores authored decisions and references the source scene. It does not embed the GLB, splat dataset, textures, renderer objects, DOM nodes, or graphics resources. Navigation state and playback state are transient. Director chat messages and its active conversation reference are also held in memory rather than serialized into this project file.

Older version 1 files can omit `placements`. The validator reconstructs recognized data rather than admitting arbitrary imported properties into editor state.

### 11.3 Validation limits

| Field or collection | Current constraint |
| --- | --- |
| Serialized project size | At most 1 MiB, measured as UTF-8 bytes. |
| Project name | Nonempty, trimmed, at most 100 characters. |
| Scene identity | Must match the currently opened scene. |
| Actors | 0–8, with unique actor IDs. |
| Actor marks | 1–64 per actor, strictly increasing times within 0–60 seconds. |
| Actor height | 0.5–3 metres. |
| Position/offset vectors | Three finite components, each between −1000 and 1000. |
| Placement entries | At most 2,000, with unique IDs. |
| Camera duration | 1–60 seconds. |
| Camera marks | 2–4,096; ordered; first at 0 and last at the duration. |
| Camera focal length | 8–300 mm. |
| Camera easing values | 0–1. |
| Holds | Bounded by duration and the following mark. |

Editor-level compatibility checks additionally reject missing placement IDs, source-camera placements, and saved camera subjects that do not resolve to a non-camera manifest entity. This is why a project file cannot simply be imported into an unrelated scene.

### 11.4 Hydration and recovery

Hydration waits for the scene manifest. If saved data can be restored and validated, the editor opens it. If there is no saved document, it creates an empty project for that scene.

If saved bytes are corrupt or storage is inaccessible, the application reports an error and blocks automatic overwriting. The user can keep working in memory, export a copy, import a valid backup, or explicitly retry saving. This preserves recovery options instead of silently replacing damaged storage with a fresh empty project.

Import validates before replacing current state. Export produces a portable JSON copy. Exporting multiple files is currently the practical way to keep alternate versions, share a project manually, or move it to another browser with access to the same scene.

### 11.5 Project identity versus backend revision references

The backend prototype uses `{ projectId, revision }` references for requests and results. Those fields are not currently part of the saved `ProjectDocument` schema above. A complete backend-planning integration still needs a defined mapping from editor document state to persistent project IDs and revisions, plus rules for rejecting or presenting stale results.

The existence of a revision field in the API contract should not be interpreted as end-to-end conflict protection in the current Director UI.

## 12. The Codex Director

### 12.1 User-facing behavior

The Director is a conversational control surface opened through the assistant orb. The user can type a direction, or use supported browser speech recognition to transcribe a spoken direction. Replies stream into the panel.

The assistant can request one supported editor action per completed turn. The browser validates the returned action and applies it through existing editor functions. The UI adds an application result after the action succeeds, so an assistant's proposed intent and the editor's completion message remain distinguishable.

This is a specific action interface. It does not let the assistant invent arbitrary React code, directly manipulate engine objects, or create unsupported timeline/choreography structures through its returned command.

### 12.2 Current action set

| Action | Behavior |
| --- | --- |
| `none` | Reply without changing the scene. |
| `generateShot` | Choose a known static scene subject and preset, then generate a draft with bounded duration, focal length, and framing. |
| `moveObject` | Apply a relative XYZ translation to a supported imported entity. Each requested delta component is limited to ±10. |
| `selectObject` | Select a known manifest entity and enter Orbit. |
| `selectCamera` | Select a known source camera and enter Shot mode. |
| `seek` | Move to an integer frame within the current timeline. |
| `play` | Start playback, rewinding first if already at the end. |
| `pause` | Pause playback. |
| `discardShot` | Remove the draft and return to the scene's source camera. |
| `frameSelection` | Frame the current selection when one exists. |

The validation target list comes from `manifest.objects`. Authored actors are managed separately and are not currently available as Director actor-edit commands. The assistant cannot create actors, add actor marks, generate a fight, edit several objects atomically, or execute a multi-action sequence in one response.

For the residence, the known environment target is the complete capture. Asking to move a photographed chair does not give the application a chair mesh that the capture does not contain.

### 12.3 Request context

The browser sends the current scene name, selected object metadata, camera ID, navigation mode, frame, fps, draft summary, placement offsets, manifest object IDs/names/types, and available preset IDs/names. This makes supported targets explicit.

The current request does not send a screenshot, the full rendered framebuffer, or a semantic reconstruction of the scan. It also does not supply the complete actor-mark system as an editable action vocabulary. The Director reasons from the structured context provided by the editor and its conversation.

Prompts are limited to 4,000 characters. The route truncates the supplied scene-context string to 16,000 characters. Large catalogs may eventually need structured filtering or retrieval instead of simple truncation.

### 12.4 Server-side execution

`POST /api/director` runs in the Next.js Node runtime. It starts `codex app-server`, using `CODEX_BIN` when supplied or `codex` from PATH. The process runs on the machine hosting the Next.js server, which may be different from the device displaying the browser.

The route initializes the app-server connection, starts or resumes a conversation, and starts a turn with a structured output schema. Its current code requests a read-only sandbox and no interactive approval flow. It translates the app-server messages into newline-delimited JSON events for the browser: conversation identity, reply deltas, completed message, proposed action, completion, or error.

The Director therefore depends on a compatible installed CLI and an authenticated runtime on the server host. A browser that can open the Railway demo does not automatically provide that environment to the Railway server. The current deployment configuration does not install and authenticate Codex as part of its standard Next.js startup.

The route checks browser origin information against request host information and rejects cross-site requests. These checks are not user authentication, account authorization, rate limiting, or a multi-tenant security model. Those are future deployment concerns for making this local/prototype workflow broadly available.

### 12.5 Conversation and asynchronous-edit limits

The browser keeps its current conversation reference in memory and can resume it for a later prompt. Reloading the page does not restore the panel's visible conversation from the project file. A server-side CLI session may have its own persistence behavior; that is separate from Showcam project storage.

There is no explicit user-visible cancellation button or application-level Director request deadline. The route attempts process cleanup when a request ends or aborts. A more complete production workflow should bound request duration, handle abandoned streams, and expose cancellation.

The current Director applies a validated action after completion without a separate review-and-accept screen. It does not pin the request to a project revision and reject a reply when the user has edited the project in the meantime. The panel also needs a stronger explicit strategy for using current editor state when asynchronous responses arrive. These remain gaps to address before relying on long-running or multi-step assistant edits.

## 13. Assistant orb and interface design

### 13.1 Visual direction

The application uses a director's light-table composition: the scene fills the window, and compact translucent controls sit around it. The established material is smoked charcoal glass with warm white Manrope typography and amber emphasis.

The palette, typography, radii, spacing, glass density, and shared controls come from `src/styles/tokens.css` and the UI primitives. CSS Modules own feature styling. The interface has an opaque accessibility alternative for users or environments where transparency reduces clarity.

### 13.2 Orb behavior

The latest UI replaces the labeled Director launcher with a compact amber orb. Its waves are vector geometry, avoiding a second 3D renderer or a large animated image asset for the assistant itself.

The orb has three states:

- **Idle:** a slow wave drift that settles after two cycles.
- **Listening:** a faster wave treatment while speech recognition is active.
- **Thinking/responding:** a distinct reverse-direction treatment while the request is busy.

Hover can reactivate the decorative wave motion. The implementation pauses it when the page is hidden or the UI is suspended in focus mode. The reduced-motion preference disables the wave animation.

The assistant starts collapsed so the environment remains visible. Opening it focuses the prompt. Close or Escape returns keyboard focus to the orb. The underlying panel remains called Director and preserves its existing conversation purpose.

### 13.3 Panel spacing and layout

The Director header, conversation feedback, error message, and composer are separated by explicit spacing rather than incidental margins. Microphone and Send are compact icon controls with accessible names. The composer remains a distinct input surface inside the single glass panel.

The Director sits above the measured timeline height, while movement shortcuts appear in a small hint at the side of the scene. Additional actor tracks can change timeline height, so measuring the timeline is more reliable than assuming a fixed bottom offset.

The expanded assistant reserves a close gap above the timeline. The collapsed orb leaves additional space for navigation instructions. On phones, opening the Director closes the inspector, and opening the inspector dismisses the Director, keeping one primary sheet usable at a time.

### 13.4 Motion and density

The existing `motion` package supplies Framer Motion functionality through `motion/react`; a second animation package was not added. Motion covers inspector panels and content, assistant expansion/dismissal, incoming feedback, object toolbar appearance, object-browser rows, and context-menu entry.

Routine transitions are short. Reduced-motion handling also suppresses panel opacity transitions where the previous dismissal animation caused an accessibility regression. User-requested scene playback remains a separate intentional behavior.

Icon-only object controls reduce repeated text over the image. Accessible labels, hover titles, keyboard radio semantics, selected states, focus indication, and the descriptive editing hint remain. Context menus keep readable action labels so uncommon and destructive commands are not reduced to ambiguous symbols.

### 13.5 Responsive and accessibility scope

The canvas remains full-window on desktop and phone. Desktop uses side panels; phones hide the object browser and use bounded inspector sheets. Scrolling belongs inside constrained panels rather than creating a tall page below the scene.

The implementation includes semantic regions, labeled inputs, icon-button names, keyboard context actions, native radio controls, live status/error feedback, reduced transparency, and reduced motion. These mechanisms and the recorded checks support usability; they are not a claim of a complete accessibility certification for every browser, input method, or future content state.

## 14. Backend planning and optimization services

There are three distinct AI-related pieces in the repository. They should be documented and evaluated separately:

1. The browser-integrated Codex Director.
2. A Gemini shot-planning route.
3. An external optimization-worker proxy.

The Director panel currently posts to `/api/director`. It does not automatically use the Gemini route or launch GPU optimization when a user asks for a camera move.

### 14.1 Route inventory

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Reports service status and whether planning/optimization configuration variables are present. |
| `/api/director` | POST | Streams a Codex conversation and one structured editor action. |
| `/api/plan` | POST | Requests bounded camera settings and a rationale from Gemini. |
| `/api/optimizations` | POST | Sends a scene/shot request to the configured external worker. |
| `/api/optimizations/:jobId` | GET | Retrieves worker job state. |
| `/api/optimizations/:jobId` | DELETE | Requests cancellation from the worker. |

### 14.2 Gemini planning

The planning request includes `projectId`, `revision`, a prompt, a scene description, and a subject snapshot. The route provides the preset catalog and an output schema to the model. It validates returned settings against known presets, duration, lens, sensor, and framing constraints, and returns those settings with a rationale and the original project reference.

The intended integration point is the deterministic camera engine. The model proposes settings; existing camera code constructs the trajectory. The route does not accept arbitrary generated camera code or treat an explanation as a complete camera path.

`GEMINI_API_KEY` is a server-only configuration value. `GEMINI_MODEL` currently defaults in the code to `gemini-3.8-flash`. That is a repository default, not a claim that the model name has been verified against the provider or enabled on the deployed account. Availability must be checked when configuring the service.

Requests to the external planning service use a 30-second timeout. Missing configuration produces an explicit unavailable response. The common backend JSON reader limits planning/optimization request bodies to 2 MiB; that reader is not used by the Director route.

### 14.3 Optimization worker

The web service forwards requests to a worker configured by `GPU_WORKER_URL`, optionally using `GPU_WORKER_TOKEN` as a bearer token. Its contract is:

- `POST /v1/jobs`: create a job from a project reference, shot, and scene snapshot.
- `GET /v1/jobs/:id`: fetch the job.
- `DELETE /v1/jobs/:id`: request cancellation.

Supported status values are `queued`, `running`, `succeeded`, `failed`, and `cancelled`. Finite progress values are normalized to the 0–1 range. Results carry the project ID and revision so a future client can compare them with its current work.

The repository supplies the bridge and validation contract, not a running CinemaTraj implementation, GPU scheduler, optimizer model, durable job database, or result-application interface. The `sceneSnapshot` and result payloads remain broad. Deeper semantic validation and stale-result handling are still required for a complete product workflow.

## 15. Application architecture and module ownership

### Stack

The current dependency ranges include Next.js `^16.3.6`, React `^19.3.0`, TypeScript `^7.0.2`, PlayCanvas `^2.22.4`, Motion `^13.4.4`, and Three.js `^0.186.1`. The lockfile records resolved dependencies. These versions describe this repository snapshot rather than a recommendation to upgrade unrelated projects to the same versions.

The application uses Next.js App Router, client-side editor composition, server route handlers for backend integrations, self-hosted Manrope, Lucide icons, shared CSS tokens, and feature CSS Modules.

### Modules

| Area | Responsibility |
| --- | --- |
| `src/app` | Next.js pages/layout and HTTP routes. |
| `src/contracts` | Plain shared scene, project, actor, camera, path, and command types. |
| `src/editor` | Composition, selection, playback, persistence integration, editing transactions, Director integration, and overlay layout. |
| `src/features/scene` | Catalog, manifest loading, object browser, and inspector metadata. |
| `src/features/viewport` | Rendering, asset ownership, navigation, picking, evaluated pose display, and manipulation input. |
| `src/features/camera` | Generation, compilation, evaluation, presets adapter, and authoring UI. |
| `src/features/timeline` | Controlled transport, scrubbing, time display, and track presentation. |
| `src/features/blocking` | Actor models, marks, deterministic evaluation, and authoring controls. |
| `src/features/project` | Versioned codec, storage interface, import/export, and project controls. |
| `src/features/object-actions` | Context-menu positioning/focus and compact tool presentation. |
| `src/backend` | Planning/worker contracts and provider adapters. |
| `src/components/ui` and `src/styles` | Reusable primitives, preferences, and design tokens. |
| `src/vendor/blockout` | Adapted camera algorithms and internal utilities. |
| `public/scenes` | Local pavilion asset and scene manifests. |

Features communicate through public exports and plain contracts. Renderer objects should not leak into project documents, and the timeline should not depend on the internals of a camera shot. The editor coordinates the flow without moving each feature's responsibilities into a single renderer component.

A typical authored frame follows this sequence:

```text
Scene manifest + saved project
              ↓
Editor selection, current frame, and editing state
              ↓
Camera evaluator + actor evaluator + static placement offsets
              ↓
CameraPose + ActorPose[] + ActorPath[] + PathPreview + placements
              ↓
PlayCanvas viewport
```

Conversational actions enter at the editor-command layer and then use the same supported feature APIs. They do not establish a second rendering or playback implementation.

Independent module work follows `docs/collaboration.md`: shared contracts are established first, ownership is explicit, workers use isolated worktrees, and the coordinator integrates changes while preserving ancestry. This is a development workflow rather than an end-user collaboration feature.

## 16. Local development and deployment

### 16.1 Local application

Install the locked dependencies and start Next.js:

```sh
npm ci
npm run dev
```

Useful routes:

```text
http://localhost:3000/
http://localhost:3000/?scene=pavilion-v1
http://localhost:3000/design-system
http://localhost:3000/api/health
```

The standard dev/start scripts listen on `0.0.0.0`. This supports development access from other devices when the host environment permits it; the application should not be assumed to have a complete remote-access authorization layer.

### 16.2 Optional configuration

| Variable | Used by | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Planning route | Server-side provider credential. |
| `GEMINI_MODEL` | Planning route | Model selection; code currently has a default. |
| `GPU_WORKER_URL` | Worker adapter | External optimizer service base URL. |
| `GPU_WORKER_TOKEN` | Worker adapter | Optional worker bearer token. |
| `CODEX_BIN` | Director route | Optional path to the Codex executable; otherwise PATH is used. |
| `SHOWCAM_URL` | Browser check scripts | Application URL to inspect instead of the default local URL. |
| `SHOWCAM_ARTIFACT_DIR` | Browser check scripts | Output directory for screenshots and check artifacts. |

`.env.example` documents the Gemini and worker settings. Secrets should remain server-side. The Codex Director uses the host's CLI environment and authentication rather than the Gemini credential.

### 16.3 Railway

`railway.toml` configures Railpack, `npm run build`, `npm run start`, `/api/health` as the health check, a 100-second health-check timeout, and an on-failure restart policy with three retries.

The browser and HTTP backend can run in one Next.js service. A GPU worker, if provisioned, is a separate service; the existing documentation suggests using a private service address. This setup does not itself provision a worker, install model weights, configure Codex, or turn local browser saves into server persistence.

The health endpoint reports configuration presence for planning and optimization. It does not prove the provider credential works, the selected model exists for that account, the worker is healthy, or the Director runtime is available.

### 16.4 Rebuilding the pavilion

The committed pavilion runs without Blender on the web server. Re-exporting requires the original source files and a local Blender installation:

```sh
npm run export:scene
```

The export command loads the source `.blend` in a background process, runs the exporter, and preserves the original file. Export output and simplification metadata should be reviewed together when changing the source scene.

## 17. Validation evidence and coverage limits

This section records existing evidence; no implementation tests were rerun merely to update this document.

### Available commands

| Command | Coverage area |
| --- | --- |
| `npm run typecheck` | TypeScript consistency. |
| `npm run build` | Production Next.js compilation and route generation. |
| `npm run test:modules` | Headless feature/editor tests, discovered from TypeScript test files and run through `tsx`. |
| `npm run test:backend` | Prototype backend contract checks. |
| `npm run test:camera` | Camera engine checks plus browser authoring workflow. |
| `npm run test:ui` | Live scene navigation and design-system interaction/accessibility checks. |
| `npm run test:overlay` | Responsive overlays, page overflow, transparency controls, and accessibility. |
| `npm run test:projects` | Project persistence, import/export/recovery, and actor blocking. |
| `npm run test:objects` | Object actions, manipulation, cancellation, undo, and persistence. |
| `npm run test:splats` | Residence streaming, display resolution, navigation, scene-specific persistence, phone picker, and loading recovery. |
| `npm run test:workstreams` | Development worktree/ownership workflow fixtures. |

Browser suites need a running application and an installed Playwright Chromium. The splat suite additionally requires network access. Existing pavilion regressions select the pavilion explicitly rather than silently changing their coverage when the application's default scene changes.

### Recorded results by delivery stage

- The PlayCanvas/backend integration passed typecheck and production build, 45 headless module checks, three backend contract checks, all 39 preset checks, and the recorded browser suites for navigation, camera authoring, projects, object controls, overlays, and splats.
- Native WebGPU rendering of the residence was visually observed in the app browser. Automated Chromium runs exercised WebGL2. Forced software WebGPU had an isolated failure even in a minimal PlayCanvas example, so that software-only path was not treated as validated.
- The Director PR reported 47 module checks in its authoring environment. Its integration in this workspace was checked with typecheck and production build; a live paid/authenticated Director conversation was not established as part of that merge evidence.
- The orb/interface refinement passed typecheck and production build and received bounded desktop/phone visual and focus/layout inspection. Full automated browser suites were not rerun for that refinement.

These results apply to the recorded changes and environments. They do not establish cross-browser equivalence, production load capacity, all GPU/driver combinations, live external-service availability, or a complete accessibility conformance assessment.

## 18. Recent delivery history

All of the following pull requests were merged as of this document's update:

| PR | Delivery | Contribution |
| --- | --- | --- |
| [#1](https://github.com/amyhakim/FlyThru/pull/1) | Saved projects and actor blocking | Browser persistence, validated project files, actor tracks, and blocking controls. |
| [#2](https://github.com/amyhakim/FlyThru/pull/2) | Viewport object actions and mouse manipulation | Context actions, body/gizmo editing, static placements, duplication, cancellation, and limited undo. |
| [#3](https://github.com/amyhakim/FlyThru/pull/3) | Backend | Prototype planning/optimization routes, Railway configuration, and Motion UI transitions. |
| [#4](https://github.com/amyhakim/FlyThru/pull/4) | PlayCanvas and SuperSplat residence | Renderer migration, streamed residence, retained pavilion, scene-specific persistence, loading recovery. |
| [#5](https://github.com/amyhakim/FlyThru/pull/5) | Live Codex Director actions | Browser conversation, streamed feedback, optional spoken input, and validated editor commands. |
| [#6](https://github.com/amyhakim/FlyThru/pull/6) | Assistant orb and compact controls | Animated orb, compact icon tools, transition refinements, prompt spacing, and measured timeline docking. |

Integration work reconciled competing editor changes so that backend/UI animation work retained actor/project controls, and Director commands used the active scene instead of hardcoding the pavilion. The reduced-motion panel dismissal was also adjusted after a contrast check caught an intermediate fading state.

## 19. Current limitations and engineering gaps

### Scene understanding and authoring

- A splat is one environment; there is no semantic segmentation or editable furniture reconstruction.
- Additional scenes require code/manifest integration rather than an upload workflow.
- The residence's metric scale and floor are approximate.
- Imported-object editing is translation-based; no general geometry modeling or object rotation/scale authoring is exposed.
- There is no collision, physics, floor snapping, pathfinding, or occlusion-aware camera solver.

### Cinematic workflow

- One draft camera per project, with no multi-shot editing, take management, or cut sequencing.
- Static subject snapshots, with no continuous moving-actor camera tracking.
- Actors are proxies, with no gait, performance animation, interaction choreography, or rigging.
- No dedicated top-down blocking pane or synchronized multi-camera layout.
- No audio/dialogue track, narrative cue editor, or storyboard surface.
- No rendered movie export, FFmpeg pipeline, generative concept render, or production report export.

### AI and asynchronous operations

- One Director action per turn and a limited command vocabulary.
- No actor-authoring commands or atomic multi-object proposal application.
- No explicit proposal approval/diff workflow or durable assistant action history.
- No complete revision-aware stale-response protection for live Director edits.
- No complete client workflow that connects Gemini plans or worker results to project revisions and applies them safely.
- No included optimizer implementation or verified worker deployment.

### Persistence and operations

- Projects live in browser storage; exports are the portable backup mechanism.
- No accounts, server project database, permissions, billing, or team collaboration.
- No full undo/redo history or automatic project versioning.
- Host/proxy-origin checks are not authentication for the CLI or backend services.
- No demonstrated rate limiting, concurrent-job limits, usage budgeting, or production observability strategy for AI requests.
- A public asset host is a runtime dependency for the default scene.

These gaps identify the next engineering and product decisions. They do not invalidate the current manual scene/camera workflow, but they define what can be demonstrated accurately today.

## 20. Proposed roadmap

The following phases are a proposed development order, not an approved schedule or a claim that work is already underway.

### Phase A — Make assistant edits dependable

Establish request IDs and project revisions at the editor boundary. Capture the revision when sending a request and compare it again before applying the result. Define what happens when selection, scene, project content, or playback changes while a request is running.

Add cancellation and bounded request lifetime, ensure streams/processes are cleaned up, and make errors distinguishable from applied edits. Introduce a proposal representation that can show the exact changes before acceptance and restore the prior state as one operation.

Acceptance should include stale responses, repeated submissions, navigation away, malformed output, unsupported targets, and interruption during streaming. The assistant should never overwrite a newer manual edit merely because an older request finishes later.

### Phase B — Extend the command vocabulary to blocking

Add explicit actor commands using the existing actor contracts: create a proxy, select it, set a mark, change mark timing, duplicate a track, or delete a track. Validate mark ordering, actor limits, coordinate bounds, and intended time origin through the same feature model as manual editing.

Develop atomic proposals for related actor and camera changes. Preserve stable IDs and human-readable explanations so a director can understand which subject or mark changed.

### Phase C — Add moving-subject camera evaluation

Define a deterministic camera target interface evaluated at time. Keep it separate from the language model and from static subject snapshots. Decide whether framing follows an actor's feet, center, bounds, or an explicit target offset.

Only after this interface exists should the product promise instructions such as “follow Alice through the room.” Validate backward scrubbing, endpoint behavior, interpolation, target switching, and actor deletion before adding more expressive camera-planning language.

### Phase D — Strengthen spatial constraints

Introduce collision proxies or other geometry suitable for camera and actor reasoning, especially for splat environments. Provide calibration tools for scale and floor alignment. Add visibility checks and a clear distinction between suggested paths and paths that satisfy configured constraints.

If GPU optimization is used, connect its results through revision-aware proposals. Show the objective, constraints, and relevant failure conditions so a result can be judged rather than accepted as inherently correct.

### Phase E — Expand scene and shot management

Add an asset/import workflow with durable source references and attribution. Add multiple projects per scene, takes or draft versions, and a shot sequence model. A top-down blocking view and synchronized camera/overview panes become useful when the project contains more simultaneous spatial decisions.

These changes require schema and persistence planning rather than adding more panels around the current one-draft document.

### Phase F — Production and concept outputs

Define portable output requirements for shot lists, optics, camera and actor marks, timing cues, and coordinate systems. A production view could summarize structured decisions with calibration status and constraint results.

A separate concept-rendering integration could then use an approved plan to generate more finished imagery. Preserve the exact input project revision, provider/model metadata, and generated output provenance. Continue to show the structured scene as the editable record of intent.

## 21. Demonstration and product evaluation

### A credible current demonstration

1. Open the residence and show the captured visual detail with Orbit/Fly navigation.
2. Open the scene picker and switch to the pavilion to explain the difference between a capture and individually editable geometry.
3. Select an imported chair or architectural subject, frame it, and generate a camera move with the manual controls.
4. Play and scrub the draft, display its path, and change a camera mark.
5. Add a proxy actor, place two or more timed marks, and preview its movement alongside the camera.
6. Move an imported object through the icon toolbar, cancel one gesture, commit another, and demonstrate the available undo.
7. Export the project, reload, and show that the scene-specific work returns.
8. Open the assistant orb. If the local Codex runtime is configured, issue a supported request such as pausing playback, selecting a source camera, moving a known pavilion object, or creating one camera preset around a known subject.

The demonstration should identify optional-service configuration clearly. A typed command that works locally through Codex should not be presented as proof that the public Railway deployment has the same CLI environment.

### Requests that exceed the current demonstration

The original vision included complex instructions such as two characters fighting through an apartment, a reveal around an island, and a crane move timed to a stunt. That remains a useful future scenario for evaluating the product's direction. It is not a supported end-to-end command today.

A successful future implementation of that scenario would require actor choreography, multi-action proposals, time-aware camera targets, environmental constraints, and a way to review the complete proposal. The present editor provides several of the underlying data and playback components, but those higher-level behaviors still need to be built.

### Proposed evaluation measures

No user-study results or production usage metrics are claimed here. Useful future measures include:

- Time to create and revise a usable camera draft.
- Percentage of assistant requests that map to valid supported actions.
- Rate of rejected, stale, canceled, or incorrectly targeted proposals.
- Ease of restoring the previous state after a change.
- Ability to find an object or actor and understand its timing.
- Frame time and memory use for representative GLB and splat scenes.
- Initial scene-ready time under realistic network conditions.
- Keyboard/touch task completion and readability over varied imagery.
- Confidence that an exported project restores the same authored result.

The product should be judged by how clearly and reliably it helps a person make scene decisions, as well as by the visual quality of the demonstration environment.

## 22. Provenance and related documentation

### Asset and code provenance

The pavilion source and reference renders were supplied with the project and retain eMirage provenance. The residence is attributed to Tony Rose / eraser851 and referenced from its public SuperSplat delivery host. Referencing that host is not a statement that the project owns redistribution rights to the scan.

Camera presets, optics, easing, and path utilities are adapted from Blockout by **Sam Wasserman (wassermanproductions.com)**, from source snapshot `3f2d0564fd575f70fc28e9bfaa7e94b05e3955d9`. The Apache-2.0 license, NOTICE, source/modification record, and visible attribution are retained under `public/licenses/blockout`. The Blockout desktop renderer, Electron integration, and FFmpeg binaries were not copied.

The interface uses Manrope and Lucide, with their package licenses. The design workflow uses Impeccable and the user's explicitly chosen rounded-glass direction. The assistant orb is code-authored vector artwork, not a newly generated raster asset.

### Related files

- [README](README.md): concise run instructions and feature walkthroughs.
- [Module architecture](docs/architecture.md): contracts, ownership, coordinates, and renderer boundary.
- [PlayCanvas migration record](docs/workstreams/playcanvas-supersplat.md): renderer decisions, limits, and validation evidence.
- [Backend contract](docs/backend.md): planning and worker request/response shapes.
- [AI planning proposal](docs/ai-planning-next.md): earlier proposal for a broader atomic planning workflow.
- [Design system](DESIGN.md): the established visual language and components.
- [Viewer surface brief](.impeccable/surfaces/src-app-page-tsx.md): task-specific interface decisions, including the assistant extension.
- [Collaboration workflow](docs/collaboration.md): contributor worktree and integration process.
- [Shared contracts](src/contracts/index.ts): current serialized data interfaces.
- [Project codec](src/features/project/model.ts): actual persistence validation rules.
- [Director action validator](src/editor/director-action.ts): supported assistant commands and limits.

Some older supporting documents still describe the prior Three.js rendering stack or AI functionality as entirely future work. This update records the current product in `project.md`; it does not silently rewrite every historical design or planning document. When updating those documents next, retain their useful rationale while bringing implementation statements into alignment with the code and delivery history above.
