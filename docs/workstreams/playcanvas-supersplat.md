# PlayCanvas viewport and streamed residence

## Scope

Replace React Three Fiber rendering with a custom PlayCanvas viewport while retaining the editor's renderer-independent contracts. Default to the public [Private Residence Interior by Tony Rose / eraser851](https://superspl.at/scene/9d09ab82). Keep the local pavilion available through the scene picker and `?scene=pavilion-v1`.

The residence manifest references its published, externally hosted LOD dataset; scan files are not redistributed in this repository. Availability requires that host and a network connection. The viewport loads a complete coarse view before progressively refining, with a four-million-splat desktop budget and two-million mobile budget. WebGPU is preferred; WebGL2 and an explicit compatibility retry are supported.

## Preserved behavior

- Orbit, pan, zoom, keyboard/touch fly controls, reset and focus selection.
- Original pavilion camera animation, deterministic timeline scrubbing, source-camera views and helpers.
- Camera presets, subject snapshots, editable marks, paths, framing, shot playback and optics.
- Actor creation, duplicate/delete, movement marks, move/rotate gizmos, body dragging, cancellation and undo.
- Imported object selection, world-space offsets, reset and persistent placement edits.
- Accessible context actions, numeric controls, responsive panels and local project recovery.

Project storage is separated by scene ID. Existing pavilion saves retain their key. Three.js remains a math dependency for the extracted camera engine and triangle intersection; PlayCanvas owns rendering, assets, animation evaluation and gizmos.

## Limits

The capture is one splat entity, without separate furniture meshes, collision geometry or editable materials. Actors and camera paths are independent editable entities. Lighting in the capture is baked: actors do not cast realistic shadows onto its photographed surfaces. Its floor origin and metric scale are approximate. GLB shading uses PlayCanvas materials and is not pixel-identical to the former renderer. These are documented capability limits rather than a claim of complete visual or asset parity.

## Validation

- TypeScript and production Next.js build passed.
- 45 headless module checks and all 39 camera preset checks passed.
- Browser suites passed for live navigation, source animation samples, camera authoring, saved projects, object manipulation/undo, responsive overlays and accessibility.
- `test:splats` passed for streamed scene rendering, canvas resolution, navigation, scene-specific persistence, mobile controls and load-error recovery to the local pavilion.
- Native WebGPU rendering was visually confirmed in the Codex app browser, with approximately two million splats at its compact viewport. Automated Chromium checks covered WebGL2. Forced software WebGPU failed even for an isolated minimal PlayCanvas canvas; that software-only path is not claimed as validated.

The browser suites require a running server. The splat suite additionally requires network access. Full production GPU coverage and metric calibration of the capture remain outside this migration.
