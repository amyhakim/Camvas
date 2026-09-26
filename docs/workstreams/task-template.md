# Worker assignment: <task-name>

## Outcome

Describe the concrete behavior this task must deliver and the acceptance evidence required.

## Assignment

- Worktree: `<absolute path returned by create>`
- Branch: `agent/<task-name>`
- Base SHA: `<fixed commit>`
- Owned paths: `<exact files and/or directories ending in />`
- Dependencies: `<integrated task names, or none>`
- Development port: `<assigned port>`
- Artifact directory: `<worktree>/.agent-local/artifacts`
- Coordinator contact: `<task/agent responsible for shared interfaces and integration>`

Copy these values from the coordinator registry. Read [the collaboration workflow](../collaboration.md) before starting. Run every command in the assigned worktree. Keep edits within owned paths and request coordinator changes for shared files.

## Contracts and checks

- Required interfaces: `<exports, props, data types, selectors, routes, or fixtures>`
- Behavior that must remain stable: `<explicit compatibility requirements>`
- Fixtures: `<shared and feature fixture entry points>`
- Integration points: `<editor wiring or coordinator-owned follow-up>`
- Acceptance commands: `<commands with expected outcomes>`
- Visual evidence, if applicable: `<screenshots, viewport, and interaction states>`

## Handoff

Return the committed SHA, a brief description of changes, acceptance results, artifact paths, and changed interfaces (or none), limitations, and any remaining integration requirements. Handoff is ready when `node scripts/workstreams/cli.mjs check` passes and `git status --short` is empty. The coordinator records completion and integration.
