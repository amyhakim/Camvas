# Showcam extraction — 2026-09-26

Source: local Blockout checkout, commit 3f2d0564fd575f70fc28e9bfaa7e94b05e3955d9.
Copyright 2026 Sam Wasserman (wassermanproductions.com).

Copied camera-moves.ts, camera.ts, path.ts, and easing.ts from src/engine with attribution headers added. types.ts contains only the V3, SensorId, ShotSizeId, and AspectId declarations required by these modules. Upstream algorithms are unchanged.

Showcam adds its own bounds adapter, camera-track evaluation and editing, React Three Fiber integration, and glass controls outside the copied directory. No Electron, FFmpeg, desktop store, or renderer is included. The upstream LICENSE, NOTICE, and MODIFICATIONS.md are retained here.

The extracted source now lives in `src/vendor/blockout/`. Module isolation moved the Showcam adapter/evaluator to `src/features/camera/` and rendering/path framing to `src/features/viewport/`; upstream algorithms and notices remain unchanged.

The flight-path top view adapts Blockout's `RouteOverview.tsx` and local route-refinement behavior to FlyThru's saved camera drafts and PlayCanvas scene bounds. FlyThru samples its own camera evaluator, draws a cutaway plan from captured mesh bounds, and keeps optimization changes in the project draft. The local refinement cost model traces to CinemaTraj; its MIT notice is in `CINEMATRAJ-OPTIMIZER-LICENSE`.

## Visible Blockout map — 2026-09-27

Copied the complete `src/renderer/viewport/builders.ts`, `src/engine/assets.ts`, and `src/engine/types.ts` from the same upstream commit into `src/vendor/blockout/upstream/`, preserving the source layout. Added attribution headers and changed only the builder's two `@engine/` import paths to relative paths. All builder algorithms remain unchanged.

The viewport calls upstream `buildAsset('prim.cube')` to obtain the cube mesh. New fitting code separates disconnected Pavilion mesh pieces and subdivides complex pieces, then scales instances of that original cube geometry to their local bounds. A PlayCanvas display bridge batches the resulting vertices while retaining the source node transforms. No FlyThru prop generator or PlayCanvas primitive generator creates these blocks. Blocks, Overlay, and Original are comparison modes; the source asset is preserved.

This is a visible surface approximation of the existing Pavilion GLB, not Gaussian reconstruction, a solid occupancy guarantee, or a replacement collision planner. Individual blocks are derived display geometry; source-object transforms remain authoritative.


## Direct splat fitting — 2026-09-27

FlyThru adds direct fitting of coarse Gaussian sample centers to bounded boxes for the Private Residence comparison. This fitting code is FlyThru's adapter, not an upstream reconstruction algorithm. It shares only the coarse sample reader with collision generation; it does not consume occupancy boxes or reconstruct a collision mesh. The same upstream cube builder supplies all displayed block geometry. See `docs/blockout-fitter.md` for usage and limitations.
