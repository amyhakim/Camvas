# Find a starting scene on SuperSplat

From the home page, choose **New project** or **Add project**, name the project, and use **Find on SuperSplat**. Enter a place or scene description (for example, `greenhouse`, `library`, or `Japanese house`) and press **Find scenes** or Enter. Search matches public titles and descriptions; it is not a semantic or AI search. Up to 24 upstream matches are requested, with incomplete or unsupported captures omitted.

Results show the creator's thumbnail, title, username, published asset size, and Creative Commons license when SuperSplat supplies one. **Preview on SuperSplat** opens the creator's scene in a new tab. Choose a result, then **Create project**. Creation verifies the hosted opening camera and asset reference before writing the project. **Built-in scenes** retains the Pavilion, Residence, and Studio choices. The Studio home shortcut opens that choice directly.

The dialog handles loading, no matches, remote errors, and creation/storage errors. Editing a search cancels the prior request and clears its selection. Closing the dialog aborts outstanding reads, and native dialog behavior contains keyboard focus and returns it to the opener. Search errors never substitute a different scene.

## Implementation

- `src/features/project/new-project-dialog.tsx`: discovery, explicit selection, and creation preflight.
- `src/backend/supersplat.ts`: public Explore adapter and hosted viewer JSON bootstrap adapter.
- `GET /api/scenes/search?q=…`: public search, 2–160 characters, up to 24 upstream results.
- `GET /api/scenes/manifest?id=supersplat-<hash>-v<version>`: source manifest with the published opening camera, attribution, and one selectable capture.
- `src/features/scene/catalog.ts`: resolves built-in and versioned remote source IDs.

No account, API key, new dependency, project schema, or separate browser registry is required. Source IDs and display names persist through the existing project collection, reload, home library, and export/import. Links and asset URLs are constructed or strictly checked against the expected SuperSplat hosts, hash, version, and supported filenames. Server reads have timeouts and use the existing origin/rate guards. The renderer streams assets directly from the publisher's CDN; Showcam does not copy or rehost them.

The adapter uses SuperSplat's anonymous Explore API (`https://playcanvas.com/api/splats/explore`) and the JSON `sse-bootstrap` in its hosted viewer. Those response details are external dependencies and may change. The [official Explore guide](https://developer.playcanvas.com/user-manual/supersplat/explore/) documents title/description search and anonymous discovery; the [scene-page guide](https://developer.playcanvas.com/user-manual/supersplat/scene-page/) describes creator previews and downloads.

## Limits

Only captures with a supported published asset and opening camera can be opened. Republished source versions are rejected rather than silently swapping a saved project's geometry. Removed/private captures and remote outages may prevent reopening; the saved project bytes remain intact. A later published version requires a new search/selection.

The source's 180-degree Z rotation and opening Y-up camera are preserved. The published horizontal FOV is converted to a vertical FOV for a 16:9 view. Capture bounds are unknown until rendering; metadata uses zero extents rather than invented surveyed dimensions. Scale and floor height are unverified. A capture is one environment, not segmented furniture or verified collision geometry. SuperSplat animations, annotations, post effects, and collision data are not imported. Creator license/source links remain available; visibility does not imply permission for every reuse.

## Validation

```sh
node --import tsx --test src/backend/supersplat.test.ts
npm run typecheck
npm run build
# With the local app running, and access to hosted SuperSplat assets:
node scripts/check-scene-discovery.mjs
```

The browser check uses an isolated browser context. It exercises live discovery and rendering, desktop/phone accessibility, selection, create/reload/reopen, empty/error recovery, built-in fallback, and Escape/focus restoration. Artifacts default to `.agent-local/artifacts/scene-discovery` (override `SHOWCAM_ARTIFACT_DIR`); use `SHOWCAM_URL` for another server.

Validated on 2026-09-27: production build and TypeScript passed; all 151 module checks, four discovery adapter tests, and 17 focused project/compatibility tests passed. The real-browser check passed with Hozy Greenhouse, including an additional rejected-creation check that leaves storage untouched. Desktop and phone dialog scans reported no accessibility violations. The design detector reported advisory differences between the existing home-page styling and DESIGN.md; the extension preserves the home page's current visual system.
