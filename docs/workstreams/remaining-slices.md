# Remaining slices

Integration branch: `feature/remaining-slices`, created from `a3136c71db897d26c5590229088fc375b9f6845f` on `main`.

Use `gpt-6-sol` for implementation and review subagents on this branch, as requested by the user. The coordinator owns shared contracts, editor integration, configuration, dependencies, global tokens, and project documentation. Follow [the collaboration workflow](../collaboration.md) for isolated worktrees, fixed bases, checks, and individual integration.

## Scope awaiting clarification

The product notes identify saved projects, actor blocking, and AI planning as future capabilities, but do not define finished slices. The following is a proposed sequence, not an implementation claim. The coordinator has asked whether to implement saved projects and actor blocking first, include AI planning, or prepare assignments only.

### Saved projects

Proposed first delivery: preserve the current draft in browser-local storage, with explicit save/restore feedback and validated JSON export/import. Existing imported scene assets stay referenced by scene identity rather than duplicated in project files.

Acceptance: edited camera marks and settings survive a round trip and reload; malformed or unsupported documents produce an actionable error without replacing the working draft; storage failures keep editing usable; the original Blender animation remains unchanged.

Suggested owner: `src/features/project/` for serialization, validation, storage, feature UI, fixtures, and tests. Coordinator owns the document contract and editor hydration/save wiring. Commit contracts and fixtures before dispatch. Local persistence must be labeled clearly; cloud collaboration is a separate capability.

### Actor blocking

Proposed first delivery: add named proxy actors to the scene, author timed position/heading marks, and play or scrub their movement alongside the camera. Preserve the imported architectural scene.

Acceptance: actor motion is deterministic during forward/backward seeks, holds at endpoints, uses metres and Y-up coordinates, and shares the editor's clock; selection and actor controls agree; project round trips preserve actors once the persistence contract includes them.

Suggested owners after a shared contract commit: `src/features/blocking/` for authoring/evaluation and tests; `src/features/viewport/` for proxy rendering/picking and tests. Coordinator composes evaluated actor poses, selection, timeline descriptions, and project state. Keep renderer inputs plain data; keep timeline independent of actor implementation details.

### Moving-actor camera tracking

After actor blocking integrates, make actors available as camera subjects. Supply time-sampled targets through an explicit contract while retaining deterministic camera paths. Acceptance: subject centering follows the moving actor during playback and arbitrary seeking; disabling centering restores authored mark orientation; removing an actor safely handles any draft referring to it. Camera and viewport workers operate in a later wave from the integrated blocking base.

### AI planning

Define this slice after deterministic authoring and editable project state are in place. Agree provider/runtime, credentials, proposal format, application/rejection behavior, and acceptance cases before dispatch. Any generated result must become editable structured scene data. Do not present procedural presets or placeholder responses as AI generation.

## Dispatch sequence

1. Resolve the slice scope and acceptance criteria.
2. Commit the minimal shared contracts and independent fixtures on this branch.
3. Fill one [assignment template](task-template.md) per worker, including exact paths and dependencies. Create at most three worker worktrees from that fixed commit.
4. Dispatch each worker with model `gpt-6-sol` and its explicit task/worktree. Dependent slices use later waves after prerequisite integration.
5. Integrate one completed branch at a time and run combined checks. Keep the existing glass overlay, imported animation, camera editing, mobile preview, accessibility, and time-origin conventions covered by regression tests.

Existing worktrees from preparation remain retained. Create fresh task names for this branch rather than changing those fixed assignments.

## Sol assessment: Blockout reuse

The read-only assessment confirmed the Blockout source snapshot still matches `3f2d0564fd575f70fc28e9bfaa7e94b05e3955d9`. Actor records/marks are in `src/engine/types.ts` and `src/engine/schema.ts`; actor interpolation/evaluation is in `src/engine/evaluate.ts`. Prefer the already attributed path/easing helpers in Showcam over importing the complete evaluator and its unrelated rig/animation dependencies. Any additional copied fragments require attribution and an update to the Showcam extraction record.

Blockout persistence uses desktop JSON files and Electron IPC. Reuse validation/round-trip design ideas, with a browser-local implementation for Showcam. Restore only after scene metadata loads; a discarded draft must remain discarded on reload. Storage failures must preserve the in-memory work.
