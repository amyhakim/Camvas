# Independent workstreams

Use this workflow when several agents are editing Showcam concurrently. One coordinator owns the main checkout and integration. Up to three workers each receive a branch, a sibling Git worktree, a fixed base commit, exclusive paths, and a development port. Keep the coordinator outside that worker limit.

## Coordinator: prepare and dispatch

1. Commit the shared contracts and workflow tools in the main checkout. Resolve the base with `git rev-parse HEAD`. Every independent task in the same wave starts at that SHA; shared prerequisites belong in that base before dispatch.
2. Fill in [the task template](workstreams/task-template.md). Use exact files or directory prefixes ending in `/` for ownership. The coordinator owns shared entry points, global CSS, package files, lockfiles, and integration glue for every wave. Shared changes require a coordinator commit before dispatch. Decide acceptance checks and dependencies before creating the worker.
3. Create each worker from the main checkout:

   ```sh
   node scripts/workstreams/cli.mjs create --name camera-panel --base <BASE_SHA> --own src/features/camera/ --own scripts/check-camera.mjs
   node scripts/workstreams/cli.mjs create --name asset-panel --base <BASE_SHA> --own src/features/assets/
   node scripts/workstreams/cli.mjs list
   ```

   Creation runs `npm ci` inside each new worktree. Workers live in the sibling `showcam-worktrees/<name>` directory on `agent/<name>`. Ports are allocated from 3101 upward; `--port 3110` requests a specific free port. The task registry reserves both paths and ports. Start dispatch only after `create` reports `active`.
4. Give the worker its task template and the absolute worktree path returned by `create`. Every worker command must run there. The main checkout remains the coordinator's integration workspace.

Directory prefixes and exact files cannot overlap between reserved tasks. Duplicate names and existing directories or branches are rejected. A dependency declared with `--depends camera-panel` must already be integrated, and its integration commit must be an ancestor of the new base. Use a later wave for dependent work.

## Worker: implement and verify

Read `.agent-local/task.json` before editing. It records the task's immutable assignment; the coordinator registry is authoritative. Restrict tracked changes to its `ownedPaths`. Propose interface changes to the coordinator when work requires another owner's path. Continue independent work against the committed fixtures while that proposal is resolved.

Run commands from the assigned worktree:

```sh
node scripts/workstreams/cli.mjs env
node scripts/workstreams/cli.mjs run --server -- npm run dev
node scripts/workstreams/cli.mjs run -- npm run typecheck
node scripts/workstreams/cli.mjs run -- npm run build
node scripts/workstreams/cli.mjs run -- node scripts/workstreams/smoke.mjs
node scripts/workstreams/cli.mjs check
```

`run` launches the supplied command and arguments directly, with no intervening shell. It sets `PORT`, `SHOWCAM_URL`, `SHOWCAM_TASK`, `SHOWCAM_BASE_SHA`, `SHOWCAM_WORKTREE`, and `SHOWCAM_ARTIFACT_DIR`. `--server` also checks that the assigned port is free immediately before launch. Next uses `PORT`; browser tests consume `SHOWCAM_URL=http://127.0.0.1:<assigned-port>`.

Keep `node_modules`, `.next`, generated `next-env.d.ts`, browser profiles, screenshots, and test reports within the assigned worktree. `next-env.d.ts` is ignored because Next regenerates different type paths for dev and production. Store optional artifacts beneath the absolute `SHOWCAM_ARTIFACT_DIR` (`.agent-local/artifacts`); pass that directory explicitly to tools that do not consume the environment variable. Dependencies and build outputs must remain real directories, not symlinks into another checkout. A port reservation prevents task-to-task collisions; an unrelated process can still occupy the port after the preflight check, so inspect any server startup error.

`check` compares the pinned base with `HEAD`, then audits the index, working tree, and nonignored untracked files separately. It checks both sides of renames and rejects symlink ownership aliases. A staged violation still fails if the working copy was restored. Ignored generated artifacts are outside this change audit. This is a collaboration guard, not an operating-system sandbox.

Run the task's acceptance checks, commit only its owned paths, and send the coordinator the commit SHA, validation results, artifact paths, and any integration notes. The worker is ready for handoff when ownership checks pass and `git status --short` is empty.

## Coordinator: integrate one task at a time

Review the worker's diff and evidence, then run from the main checkout:

```sh
node scripts/workstreams/cli.mjs check --task camera-panel
node scripts/workstreams/cli.mjs complete --task camera-panel
git merge --no-ff agent/camera-panel
# Run the combined acceptance checks in the main checkout.
node scripts/workstreams/cli.mjs integrated --task camera-panel
```

`complete` requires a clean, committed worker and records its exact commit. `integrated` requires that commit to be an ancestor of the coordinator's `HEAD`, with the worker still unchanged. Use a merge that preserves ancestry. Record integration only after the combined checks pass; it releases the task's ownership and port reservations for later tasks. Completed tasks retain reservations until this step.

The CLI never merges, rebases, force pushes, deletes branches, or removes worktrees. Retain worktrees and branches until integrated and the user explicitly requests cleanup. Keep existing workers on their original bases; start new tasks for follow-up waves.

## Recovery and diagnostics

Use `node scripts/workstreams/cli.mjs list` to inspect status and `--help` for the command reference. Registry data lives in the Git common directory under `showcam/workstreams.json`; it is shared across worktrees and excluded from commits. `.agent-local/task.json` is a read-only local copy of the assignment, not an editable policy file.

If dependency installation fails, the task becomes `setup-failed`, retains its reservations, and preserves the worktree and branch. Correct the cause, then run `node scripts/workstreams/cli.mjs retry --task <name>` from the coordinator checkout. `--no-install` is available on `create` and `retry` for fixture tests or deliberately provisioned dependencies; normal workers use the default independent installation. A failed Git creation is recorded as `creation-failed` without reserving a worker slot; inspect any leftovers and choose a new task name.

Registry updates use an exclusive lock at `showcam/registry.lock`. If an operation reports a held lock, wait for the active coordinator operation. Remove a stale lock manually only after verifying no coordinator operation remains. Interrupted provisioning is retained for inspection; verify the worktree, branch, metadata, and installation before repairing the registry. Never edit assignments while a worker is running.

Run the workflow's isolated Git fixture tests with:

```sh
node --test scripts/workstreams/cli.test.mjs
```

With the assigned dev server running, `smoke.mjs` verifies the app and scene manifest at `SHOWCAM_URL`, checks real local dependency/cache directories, and writes `isolation-smoke.json` only beneath `SHOWCAM_ARTIFACT_DIR`. Run it once per worktree while both servers are alive to verify isolation.

These tests use temporary repositories, skip real package installation, and exercise change boundaries, startup failures, port conflicts, dependency readiness, and lifecycle transitions.
