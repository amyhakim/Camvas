# AI planning: next integration slice

Saved projects and actor blocking are the implementation scope of `feature/remaining-slices`. AI planning is deliberately a follow-up. The deterministic scene remains the source of truth.

## Proposed first task

Given the current scene summary, actor IDs and marks, camera draft, and a director's instruction, produce an editable proposal for actor marks and a camera move. Show what would change before applying it. Apply a validated proposal atomically and retain the previous project so it can be restored.

The model does not control the renderer directly. Its output must resolve to the same plain project/actor/shot contracts used by manual authoring. Playback and seeking continue through the existing deterministic evaluators.

## Decisions required before implementation

- Provider/model/runtime, credentials, latency and spending limits. No provider has been configured or selected by this work.
- First supported request set, for example “move Hero to this mark over six seconds” and “use a wide orbit around this static subject.” Moving-actor camera tracking needs its own deterministic seam before promises of continuous following.
- Proposal presentation and application: which changes are highlighted, how conflicts with edits made while a request runs are handled, and how to restore the prior project.

## Suggested independent assignments

The coordinator defines and commits the proposal/result/error contracts and fixtures first. One worker owns the planner adapter and cancellation/error handling; one owns the proposal UI within the existing glass surface; one owns deterministic validation and replay tests. The editor integrates requests and atomic application. Use Sol workers, separate worktrees, and disjoint paths.

## Acceptance cases

- A valid proposal uses existing scene/actor IDs, bounded coordinates/times, and valid ordered marks; it remains editable after application.
- Malformed/partial output, missing IDs, unsupported actions, timeout, or service failure leaves the current project unchanged and allows retry.
- A canceled or stale response never replaces newer edits.
- Proposal preview is distinct from applied project state; applying then restoring recovers the exact prior document.
- JSON export/import and local save work after applying a proposal; deterministic evaluation gives the same result on repeated seeks.

Proxy actors are currently simple spatial markers with position and heading. Rigged animation, physical collision/occlusion checks, stunt safety assessment, live Blender synchronization, cinematic generation, and cloud collaboration are separate capabilities.
