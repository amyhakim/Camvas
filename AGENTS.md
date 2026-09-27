<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FlyThru working directions

Read [docs/architecture.md](docs/architecture.md) before changing module interfaces, coordinates, or timing. The renderer is PlayCanvas. Keep renderer objects inside the viewport; shared contracts are plain data. Renderer coordinates are Y-up, while source Blender metadata is Z-up.

## Blockout fitter

Read [docs/blockout-fitter.md](docs/blockout-fitter.md) for setup, usage, implementation paths, limits, and validation. This is the current Blockout workflow for both the Pavilion and Private Residence Interior.

- Use the upstream `buildAsset('prim.cube')` geometry for fitted blocks. Keep upstream attribution and the notices in `public/licenses/blockout/` intact.
- Keep direct splat fitting independent of occupancy-grid collision generation. Do not silently replace the fitting algorithm with voxel reconstruction or a different primitive builder.
- Treat fitted blocks as derived visual geometry, not verified solid geometry, semantic objects, or proof of navigation clearance.
- Preserve source transforms and the Blocks / Overlay / Original comparison modes. Failed regeneration must leave the previous fit available; cancel pending reads on viewport teardown.
- Read [docs/splat-collision.md](docs/splat-collision.md) before changing collision generation, review, persistence, or CinemaTraj coverage handling.

## Scope and collaboration

Preserve unrelated working-tree edits. Before delegating or editing an assigned worktree, read [docs/collaboration.md](docs/collaboration.md) and its task record. The coordinator owns integration and shared interfaces. Do not assume a proposed project plan describes implemented behavior.

## Validation and handoff

Run checks appropriate to the changed code; the fitter guide lists the headless, build, and real-browser checks. For changes to fitting or rendering, inspect the real scene in comparison modes and report approximation limits. Browser tests depend on hosted splat assets and a running local server.

Stage only the requested work. Include usage directions and preserve vendor notices when publishing changes. Report the branch, commit, checks completed, and any remaining limitations.
