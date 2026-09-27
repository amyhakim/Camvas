# Splat collision boxes

Open the captured scene, position the camera near the area you want to use, and open **Project → Collision boxes**. **Generate around view** samples the complete coarse capture within a cube around the camera. The default radius is 4 scene units and cell size is 0.5. This is a local review area, not a whole-house collision model. Scan scale is not surveyed.

The app reads the coarsest nonempty LOD for every octree leaf, independently of visible or resident detail. It transforms sample centers by the capture’s world transform (including its authored rotation and placement). Cells need at least three sample centers; fully occupied neighbors are merged into boxes without spanning empty cells. This is an approximation from point density, not wall/furniture recognition or solid reconstruction. It does not use splat opacity or ellipsoid extents. Coarse data may miss thin surfaces or put noisy boxes in open spaces.

Generation reads at most five million samples across 64 source files from the complete coarse capture. Exceeding either limit requires a coarser source. Within the review area, generation allows 150,000 occupied cells and 400 output boxes; reduce the radius or increase cell size if these limits are exceeded. An over-budget result fails with a recovery message; it never silently drops boxes or fills gaps to meet the budget. Failed generation preserves the previous layer.

## Review and edit

- Amber wireframes show estimated occupied cells; green shows the review boundary. The selected box is white.
- Choose **Review box**, use **Frame box**, or enable **Show only selected box** to inspect one proxy.
- **Adjust box bounds** changes its X/Y/Z minimum and maximum in the generation coordinate frame. Keep the box inside the review area. Boxes and coverage follow later translations of the capture.
- **Remove box** clears a false positive, such as a box filling an open doorway. **Undo change** reverses the latest project editing transaction while no other project change has intervened.
- **Use reviewed boxes** marks the layer as ready for the existing CinemaTraj adapter. Editing, removing or regenerating boxes revokes review. **Return to review** revokes it explicitly.

Inspect every relevant surface and passage before approval. Unboxed space is not proof of clearance. Review is a user judgment, not an automatic safety certification.

Boxes are saved in browser storage and **Export JSON** with the project. Version-1 files without collision data still load. Imports reject malformed bounds and mismatched source assets. Layers are local project data, not shared room data, and the external splat files remain unchanged.

## CinemaTraj

The residence option becomes eligible after review. It requires the optional CinemaTraj Python installation described in the README. Optimize an existing continuous camera draft, or block an actor to generate a new follow path. The adapter sends reviewed boxes and their coverage boundary. Both initial camera samples and the solver’s returned path must remain inside the reviewed area, with the existing 0.25-unit clearance margin. The optimizer treats the coverage boundary as a constraint and checks the densely sampled output against it. It cannot silently escape into unreviewed space to avoid obstacles.

This does not add a Director action for CinemaTraj or automatic landmark-route planning. Those remain separate follow-ups. The generated boxes cover the scanned environment, not subsequently added props.

## Validation

`npm run test:collision` runs against the real hosted residence on a local server (default `http://localhost:3000`; override `SHOWCAM_URL`). It tests generation, limits on the resulting geometry, bounds editing, removal/undo, review state, persistence, CinemaTraj eligibility, failed-regeneration preservation, accessibility, and responsive overflow. Artifacts are under `.impeccable/review/collision`, or `SHOWCAM_ARTIFACT_DIR`.

Headless collision tests cover doorway gaps, noise filtering, the box budget, invalid persisted data, old-project compatibility, and placement alignment. These checks do not validate that every real wall is covered, that a real doorway is unobstructed, or that a CinemaTraj optimizer run succeeds.
