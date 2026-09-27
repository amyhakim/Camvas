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


## Landmark follow-up

The user requested labeled, movable landmarks instead of the pen. The coordinator owns this follow-up on the same branch. The viewport uses surface picking to place and drag a named point, with click-based Reposition as an alternative. Labels are unique, landmarks remain session-local, and undo covers add/move/rename/remove. The Director receives named positions and the selected landmark. Read-only review/documentation roles retain the ownership constraints above. New visual evidence includes `desktop-landmarks.png`; existing room-tools fixtures now test landmarks in place of strokes.


Landmark follow-up validation: typecheck, production build, 64 module tests, and the updated room-tools browser workflow passed. Browser fixtures verify placement, naming, direct drag without camera movement, Escape rollback, click-based repositioning, move/removal undo, named agent context, and mobile action hit areas/accessibility. The independent visual review returned ship for this follow-up. Read-only documentation verification confirmed behavior, persistence boundaries, and fixture limits; existing design-system documents remain unchanged.


## Automatic splat collision boxes

User follow-up: generate collision boxes automatically, then review. Coordinator owns implementation in this checkout on `codex/splat-collision-boxes`, based on `a14e2ce` after PR #10 merged; there are no module edit workers. Read-only skill finish/documentation reviewers inspect current files and evidence without writes, servers, or commits.

Scope: camera-centered coarse-LOD occupancy generation, bounded cell merging, review overlay and bounds editing, project persistence/export, placement alignment, and reviewed-area constraints in the existing CinemaTraj adapter. The scan stays externally hosted and its visual data stays unchanged. Whole-house semantic segmentation, automatic route planning, and installing the optional optimizer are outside this follow-up.

Acceptance: typecheck, module/backend tests, production build, real-splat browser generation/review/persistence test, and desktop/mobile/user-width screenshots. The optimizer environment is absent locally; its Python change is syntax-checked, with full solver execution explicitly unverified.

Validation outcome: typecheck and production build passed; 68 module tests and 8 backend tests passed. The real-splat browser workflow generated 158 boxes from 141,329 in-region samples and passed generation, edit validation, removal/undo, review/revocation, save/reload, CinemaTraj eligibility, failed-generation preservation, and responsive checks. Axe reported no violations for both the open collision form and scene. Screenshots cover 1440, 505 and 390 pixel widths in `.impeccable/review/collision/`. The detector returned no findings.

The independent finish reviewer identified mobile box framing that clipped the selected proxy. Reusing the existing viewport-region fitting calculation resolved that finding; the verdict pass returned ship scoped to the framing correction. Read-only documentation verification confirmed the behavior and requested a capture-wide versus region-specific budget clarification, which was applied. Existing design-system documents remain unchanged. No full CinemaTraj solver or physical scene clearance is claimed.
