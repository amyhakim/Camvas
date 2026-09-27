# Showcam extraction — 2026-09-26

Source: local Blockout checkout, commit 3f2d0564fd575f70fc28e9bfaa7e94b05e3955d9.
Copyright 2026 Sam Wasserman (wassermanproductions.com).

Copied camera-moves.ts, camera.ts, path.ts, and easing.ts from src/engine with attribution headers added. types.ts contains only the V3, SensorId, ShotSizeId, and AspectId declarations required by these modules. Upstream algorithms are unchanged.

Showcam adds its own bounds adapter, camera-track evaluation and editing, React Three Fiber integration, and glass controls outside the copied directory. No Electron, FFmpeg, desktop store, or renderer is included. The upstream LICENSE, NOTICE, and MODIFICATIONS.md are retained here.

The extracted source now lives in `src/vendor/blockout/`. Module isolation moved the Showcam adapter/evaluator to `src/features/camera/` and rendering/path framing to `src/features/viewport/`; upstream algorithms and notices remain unchanged.

The flight-path top view adapts Blockout's `RouteOverview.tsx` and local route-refinement behavior to FlyThru's saved camera drafts and PlayCanvas scene bounds. FlyThru samples its own camera evaluator, draws a cutaway plan from captured mesh bounds, and keeps optimization changes in the project draft. The local refinement cost model traces to CinemaTraj; its MIT notice is in `CINEMATRAJ-OPTIMIZER-LICENSE`.
