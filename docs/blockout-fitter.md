# Blockout fitter

The viewport can display a block representation of the Pavilion mesh and the Private Residence Interior Gaussian splat. Blocks use the original Blockout `buildAsset('prim.cube')` geometry, with FlyThru fitting and a PlayCanvas display bridge.

## Run and view

1. Install dependencies with `npm ci`, then run `npm run dev`.
2. Open `http://localhost:3000/editor?scene=residence-9d09ab82` (use the port printed by Next if different).
3. Wait for the residence to load. Click the **Scene layers** icon in the top navigation bar to open the Blockout controls. Click the icon again, click outside, or press Escape to close them.
4. New splat projects fit Medium blocks during automatic scene preparation. Select **Fine**, **Medium**, or **Coarse**, then click **Fit splat blocks** to regenerate. See [splat preparation](splat-preparation.md) for AI labeling and separate navigation proxies.
5. **Original** is the default. Switch between **Blocks**, **Overlay**, and **Original** to compare the result. Only these layer buttons change the selected appearance; selection, playback, capture, and fitting preserve it. Choose another size and fit again to regenerate.

For the Pavilion, open `/editor?scene=pavilion-v1`. Its blocks are fitted automatically when the mesh loads.

The residence requires access to its hosted capture. Fitted blocks are temporary display geometry, regenerated after a reload; they are not saved in project JSON. Source assets remain unchanged. Blocks follow the source transform.

## How it works

- `src/features/viewport/blockout-fit.ts`: triangle fitting for meshes and direct point fitting for splats. Mesh fitting welds seams, separates disconnected pieces, and subdivides complex pieces. Point fitting recursively splits samples along the longest bounds axis, discards leaves with fewer than three samples, and pads thin leaves.
- `src/features/viewport/splat-samples.ts`: reads every leaf's coarsest nonempty LOD independently of the visible tiles, with cancellation and download limits.
- `src/features/viewport/blockout-layer.ts`: batches upstream Blockout cube vertices into PlayCanvas meshes and controls source/overlay visibility.
- `src/features/viewport/runtime.ts` and `live-viewport.tsx`: generation, lifecycle, and comparison controls.
- `src/vendor/blockout/upstream/`: attributed upstream cube builder and its supporting types/assets. Preserve vendor notices.

The direct splat fitter does not use the collision occupancy grid or generate an intermediate reconstructed mesh. Fine, Medium, and Coarse bound leaf extents to 0.25, 0.5, and 1 source-local units. The fitter limits output to 50,000 blocks. Reading the coarse capture is limited to 64 source files and five million samples. If a fit exceeds its block budget, try a coarser size; failure retains the previous fit.

## Collision boxes are a separate workflow

Open **Show details → Edit details → Project → Collision boxes** to generate and review collision proxies. See [Splat collision boxes](splat-collision.md). Those reviewed boxes persist with the project and can feed CinemaTraj. The visual Blockout representation does not mark them reviewed or replace them.

Neither a fitted block nor empty space between blocks proves physical occupancy or clearance. Direct fitting leaves holes and can retain scan noise; it is an experimental visual approximation.

## Verification

Run:

```sh
npm run typecheck
npm run test:modules
npm run test:backend
npm run build
node --import tsx --test src/features/viewport/blockout-fit.test.ts src/features/collision/model.test.ts
```

With the dev server running, `node scripts/check-blockout-map.mjs` checks the Pavilion comparison modes. `node scripts/check-residence-blockout.mjs` checks the real residence fit, comparison modes, phone overflow, and collision generation/remove/undo/review/persistence. These scripts currently launch Google Chrome from its macOS application path. The residence script accepts `SHOWCAM_URL`; the Pavilion script uses port 3000. Screenshots and results are written under `/private/tmp/flythru-blockout-map` and `/private/tmp/flythru-residence-blockout`.

The September 27, 2026 residence check produced 36,781 Medium blocks from 934,927 coarse samples, plus 158 separately generated collision boxes around the starting view, with no browser page errors. This verifies generation and UI behavior, not reconstruction accuracy.


## Frame rates

The editor timeline uses 30 FPS. During video recording, the viewport renders continuously and requests capture frames at 30 FPS after rendering (with timed capture as a fallback). Imported 24 FPS animations retain their original duration and initial pose; actor and authored camera marks remain in seconds. The live viewport stays uncapped and renders on demand, so 30 FPS video capture does not limit interactive navigation to 30 FPS.

`node scripts/check-30fps.mjs` exercises both scenes in Blocks and Original modes, checks the 30 FPS timeline and explicit video capture mode, saves a real export, and measures live navigation. Results and the video are saved in `/private/tmp/flythru-30fps`. `data-render-fps` on the canvas measures rendered frames during sustained activity, excluding idle periods. Performance depends on hardware and scene complexity; browser recording can drop frames under load.

Landmark controls appear only after clicking **Landmarks** in the top navigation. Click that button again to hide the side panel; selecting or placing a pin does not open it automatically.
