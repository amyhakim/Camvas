# Room tools bucket list

Coordinator implementation in `/Users/ericgeorge/workspace/code/showcam`, branch `codex/room-tools-bucket-list`, from `a084bf824ede400906fe3ea1d05a9a2f5bcbca03`.

This is a single-checkout implementation. No independent module workers or edit ownership are dispatched. Skill-required finish review and documentation review are read-only: they inspect this checkout and return findings/prose to the coordinator, with no file writes, commits, servers, or worktrees. The coordinator retains all implementation and integration ownership. See [collaboration](../collaboration.md) and [architecture](../architecture.md).

## Outcome

- Smaller movable assistant launcher and window, with pointer and keyboard controls and viewport bounds.
- Surface pen marks supplied to the Director as Y-up region bounds, mesh identity and frame. Splat scenes explicitly use an estimated floor plane.
- Compact corner Share room disclosure, away from object context controls.
- Sketchfab candidate choice before downloading, lazy thumbnail loading, two concurrent model loads, cache/download/decode/ready/error feedback, retry, and negotiated lossless gzip transfer compression.

## Acceptance

`npm run typecheck`, `npm run build`, `npm run test:modules`, `npm run test:backend`, `node scripts/check-room-tools.mjs`, and existing overlay/collaboration smoke checks where compatible. New browser fixtures mock the Director and Sketchfab services while exercising real PlayCanvas mesh rendering; they do not validate live model quality or the Codex service.

Visual evidence: `.impeccable/review/room-tools/desktop-options.png`, `desktop-loading.png`, `mobile-options.png`, `mobile-share.png`. Mechanical design advisories: `.agent-local/artifacts/room-tools-detector.json`. Keep `DESIGN.md`, vendor notices, and existing Next instructions intact.

## Validation outcome

Passed: typecheck; production build; 64 module tests; 7 backend tests; `npm run test:room-tools` (real fixture glTF rendering, mocked external services); overlay checks at 1440, 1280 and 390 pixels with no accessibility violations; two-peer selection/timeline/cursor collaboration smoke test. Browser checks exercise drag versus click, keyboard positioning, resize clamping, mesh strokes and cancellation, annotation context, deferred alternative selection, load failure/retry, mobile action hit areas, and overflow.

The independent finish review identified overlapping default status controls and insufficient chooser evidence. The coordinator moved status/annotations into inspector flow or one shared floating panel, separated the mobile orb, and gave model selection the conversation space. The reviewer scored both findings resolved, with a ship verdict scoped to those fixes. Final evidence also includes `.impeccable/review/room-tools/mobile-work-status.png`.

The mechanical detector reported only incumbent design advisories; no new editor CSS values were flagged. Existing design-system documents and vendor notices are preserved. Live Codex and Sketchfab service behavior, real thumbnail appearance, and lossy mesh/texture optimization are outside the fixture checks.
