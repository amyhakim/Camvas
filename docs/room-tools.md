# Room tools

The assistant, scene marks, room sharing, and model chooser extend the existing Operate interface.

## Assistant

Click the 48px Assistant launcher to open the compact Director panel. Drag the launcher or the panel’s Director handle to move it. With either control focused, arrow keys move it 16px, Shift+arrow moves it 32px, and Home restores its default position. Escape closes the open panel.

The default position is above the timeline: centered on desktop, with the closed launcher at the lower right on phones. The open panel is at most 340px wide. Moved panels are constrained inside the viewport with 12px margins and kept above the timeline; resizing or opening the panel reapplies those bounds. Free dragging can intentionally place it over other controls.

## Labeled landmarks

Choose **Add landmark** (the pin icon), then click a visible surface. A labeled pin appears in the scene. Select it and edit **Landmark label** in the inspector or scene work status; Enter or blur saves the name. Labels must be unique and 1–48 characters long. For example, call one “Doorway” and ask the agent to “Place a chair at Doorway.” The selected landmark supplies the location for “here.”

Drag a pin in Orbit to move it across surfaces without moving the camera. **Reposition** also lets you click a new surface location, which is useful on touch screens or when the pin is behind a panel. Escape during a drag restores its prior position. **Cancel placement** exits click-placement mode. **Remove** deletes the selected pin, and **Undo** reverses additions, moves, label changes, or removals (up to 20 local edits).

Mesh landmarks use triangle intersections; captured splat scenes use an explicitly labeled estimated floor plane where no mesh is hit. Up to eight landmarks are kept in this editor session. Their positions are world-space snapshots at the recorded frame, not live attachments, saved project data, or shared room state. The agent receives each landmark’s label, Y-up position, target mesh identity, kind, and frame. This supplies spatial context for supported scene commands; it does not add mesh topology editing.

## Sharing a room

The corner **Share room** button opens a compact disclosure with connection state, collaborators, your editable name, room identifier, and **Share** to copy the collaboration link. Close it with its close button, Escape, or a click outside. Copy failures appear beside the sharing control so the action can be retried.

## Choosing and loading models

When the Director proposes Sketchfab models, the assistant presents candidate choices before applying model actions or downloading archives. Each candidate includes attribution, licensing, a Sketchfab link, available size and face-count information, and a lazily loaded thumbnail when supplied. Choose a candidate for each proposed model and select **Use selected models**. Selected sources are verified before their actions are applied. **Cancel** dismisses the proposal.

Each viewport runs at most two model loading jobs at once, including download and geometry loading. Further jobs wait for a slot. Repeated uses of one model share its load, and the server caches downloaded model files.

Status distinguishes checking the cache, requesting/downloading the archive, preparing model files, loading geometry and textures, ready, and error. Archive progress shows a percentage when its total size is known, or downloaded megabytes otherwise. A completed archive download does not mean the model is ready: geometry and textures still need to load. Failed loads provide **Retry**. Scene work status is available in the inspector or a floating panel when the inspector is closed; on phones the open assistant also exposes pending/error status and retry.

Eligible model files use negotiated, lossless gzip transfer compression when the browser accepts gzip and the compressed response saves at least 5%. This changes transfer bytes only; it does not simplify meshes, alter materials, or reduce texture quality. Already compressed assets may be sent unchanged.

## Validation

Run:

```sh
npm run typecheck
npm run build
npm run test:modules
npm run test:backend
```

With the app running, run:

```sh
npm run test:room-tools
npm run test:overlay
npm run test:collaboration
```

Browser checks default to `http://localhost:3000`; set `SHOWCAM_URL` to use another server. `SHOWCAM_ARTIFACT_DIR` can redirect room-tools screenshots.

The room-tools browser fixture mocks Director responses and Sketchfab services while using the real PlayCanvas viewport and a small glTF mesh. It checks assistant movement and keyboard bounds, landmark placement, labels, dragging, repositioning, cancellation and undo, spatial context, deferred model choice, failed-load retry, ready state, phone overflow, action hit areas, and an automated accessibility scan. Module/backend tests cover landmark context and label validation, load-queue behavior, cache progress, and transfer compression. These checks do not validate live Codex responses, Sketchfab availability, production model quality, real thumbnails, or splat-floor placement in the browser. The loading screenshot shows the cache-checking stage; backend fixtures verify archive progress.

## Design evidence

This work extends Showcam’s existing smoked-glass and amber Operate interface. The compact assistant, model choices, room disclosure, and status surfaces reuse the current typography, glass, button, border, and selection vocabulary. There is no new visual world or approved comparison composition. `DESIGN.md` and `.impeccable/design.json` remain unchanged. Evidence is recorded in `.impeccable/review/room-tools/desktop-landmarks.png`, `desktop-options.png`, `desktop-loading.png`, `mobile-options.png`, `mobile-share.png`, and `mobile-work-status.png`.

An independent finish review scored the status-control collision and chooser-evidence fixes resolved. Its ship verdict is scoped to those fixes. Pre-existing documentation drift remains outside this extension: PRODUCT.md still describes Three.js/R3F and omits backend/AI/collaboration capabilities that the current PlayCanvas application implements.
