# Preparation validation — 2026-09-26

The working application was committed before refactoring at `eabc337`. The baseline includes the original Blender scene/textures and runnable web assets (about 41 MB combined), with dependency folders, builds, credentials, and generated test output excluded. No remote was created or publishing performed. Next.js instructions, design provenance, and Blockout notices are retained.

Shared contracts were committed at `0368290` before dispatching the first independent module work. Scene, timeline, and workflow tooling were developed in separate bootstrap worktrees and merged individually. Camera/viewport/editor integration was committed at `e0304ed`.

## Real worktree demonstration

Both tasks below were created by the CLI from the same fixed base, `e0304ed7391840cad30c248d8459de859fbb4fc1`, with no dependencies. Each ran its own `npm ci` successfully and used distinct real `node_modules` and `.next` directories.

| Task / branch | Exclusive paths | Port | Worker commit | Integration commit |
| --- | --- | --- | --- | --- |
| `fixture-camera` / `agent/fixture-camera` | `src/features/camera/` | 3101 | `0257f42` | `40759fc` |
| `fixture-timeline` / `agent/fixture-timeline` | `src/features/timeline/` | 3102 | `5673f95` | `66141e6` |

Worktrees are retained in sibling `showcam-worktrees/fixture-camera` and `showcam-worktrees/fixture-timeline`. Both servers ran simultaneously and served the application plus the 190-object scene manifest successfully. Their smoke reports were written to separate `.agent-local/artifacts/isolation-smoke.json` files. The reports record their own port, cwd, dependency/cache paths, and artifact directory. Servers were stopped after verification; no worktree or branch was removed.

The two agents changed only independent fixture/test files: an edited camera draft with holds and random seeking, and a timeline with a non-default frame origin and partially clipped tracks. Both handoffs passed ownership validation and had clean worktrees. Both merges completed without conflicts; combined module tests passed after each integration. No product features were added by this demonstration.

Next rewrote the tracked `next-env.d.ts` during the demonstration. The ownership guard correctly rejected it as outside the worker assignments. The coordinator restored that generated file in the original worker bases, and future main bases now ignore it (`9bffcfa`) so normal dev/build switching does not create false ownership violations. The fixed worker bases were preserved.

## Checks

- `npm run typecheck`: passed.
- `npm run build`: production build passed.
- `npm run test:modules`: 15 tests passed across camera, viewport, scene, timeline, and editor layout measurement.
- `npm run test:workstreams`: 19 tests passed using isolated temporary Git repositories. They cover permitted changes and rejected committed/staged/unstaged/untracked out-of-scope changes, both sides of renames, hidden staged violations, symlink escapes, fixed assignment identity, ownership conflicts, three-worker capacity, ports, dependency readiness, installation failure recovery, and integration ancestry.
- `npm run test:camera`: all 39 presets, deterministic evaluation, optics, subject bounds, edits, timeline playback/scrubbing, original Blender animation preservation, responsive path framing, phone preview, and accessibility passed.
- `npm run test:overlay`: desktop, compact, and mobile checks passed with no accessibility violations or runtime errors.
- `npm run test:ui`: orbit/zoom/raycast selection, reset/framing, keyboard/touch Fly navigation, Blender samples at frames 1/125/250/374, design-system interactions, and accessibility passed with no runtime errors or overflow.

The orbit regression now checks actual three-dimensional displacement, matching its existing distance assertion. A real orbit moved more than ten metres while its X component changed by only about 0.05 m; the former X-only wait could incorrectly time out. No navigation implementation was changed to accommodate the test.

Camera and overlay acceptance artifacts use `.agent-local/acceptance/`, proving the configurable artifact directory. Live-viewer and design-system artifacts remain under `.impeccable/review/`. These generated outputs are intentionally local and ignored.

A review also caught the phone inspector being measured as a right sidebar after reopening it over a visible path. The editor now treats a wide inspector as a bottom sheet and guarantees valid normalized bounds; a focused geometry regression covers this. The viewport has no UI-selector dependency.

## Next wave

Use the current committed `main` SHA as the next fixed base, not these older demonstration branches. Fill in `task-template.md`, assign disjoint paths, and create fresh worktrees through the CLI. Keep shared interface changes with the coordinator. Retain existing worktrees until their cleanup is explicitly requested.
