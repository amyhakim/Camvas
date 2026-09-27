# Blockout fitter

The viewport can display a block representation of the Pavilion mesh and the Private Residence Interior Gaussian splat. Blocks use the original Blockout `buildAsset('prim.cube')` geometry, with FlyThru fitting and a PlayCanvas display bridge.

## Run and view

1. Install dependencies with `npm ci`, then run `npm run dev`.
2. Open `http://localhost:3000/editor?scene=residence-9d09ab82` (use the port printed by Next if different).
3. Wait for the residence to load. Expand **Blockout** if the controls are collapsed; they start collapsed on phones.
4. Select **Fine**, **Medium**, or **Coarse**, then click **Fit splat blocks**. Medium is the default.
5. Switch between **Blocks**, **Overlay**, and **Original** to compare the result. Choose another size and fit again to regenerate.

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
