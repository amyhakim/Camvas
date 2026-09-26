# Object controls wave

Continue on `feature/remaining-slices` with Sol workers. Add scene object context actions and actor manipulation within the existing glass viewport. Imported scene geometry remains fixed; camera/object actions inspect and frame. Actors support move, heading rotation, duplicate, and delete. Explicit touch/keyboard-accessible actions accompany right-click.

Transform transactions carry plain `ActorTransformEvent` data with start/preview/commit/cancel phases. The editor pauses playback at start, keeps preview transient, and commits one actor mark at the playhead (update existing or insert interpolated mark). Escape cancels without saving. Actor time is `(frame - 1) / fps`. Invalid or capacity-exceeding edits produce recoverable feedback. No camera tracking or AI implementation.

Workers use fixed-base isolated worktrees, separate ports, and only assigned paths. Coordinator owns contracts, editor, object-browser wiring, tests, docs and integration.

- Viewport worker: `src/features/viewport/`. Optional props `actorTool?: ActorTool`, `onActorTransform?: (event: ActorTransformEvent) => void`, `onContextRequest?: (request: ObjectContextRequest) => void`. Actor tool active only in Orbit. Body drag on a horizontal plane in Move mode; translation handles include vertical motion; Rotate exposes heading only. Disable navigation while dragging, support Escape cancellation, suppress context menu after right-drag pan, and keep picking of imported geometry. No imports of blocking implementation.
- Blocking worker: `src/features/blocking/`. Export `setActorPoseAtTime(actor, seconds, transform)` and `duplicateActor(actor, id, name)`; validate bounded data and immutable results. Set-or-insert an exact playhead mark, preserve all other marks; duplicate deeply with identical marks (coordinator chooses ID/name). Add fixture tests. No UI changes required.
- Object actions worker: `src/features/object-actions/`. Controlled glass context menu plus actor tool strip; detailed component interface in dispatch. No editor dependencies. Include independent fixture/data coverage where useful.

Checks: typecheck, module tests, focused browser tests for mouse move/rotate, context menu keyboard/dismissal, cancel/reload persistence, right-pan preservation, desktop/phone screenshots and accessibility; existing camera/navigation regressions. Handoff: clean commit, ownership check, tests, limitations. Preserve worktrees after integration.
