#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RESERVED = new Set(['.git', '.agent-local', 'node_modules', '.next']);
const HELD = new Set(['provisioning', 'setup-failed', 'active', 'complete']);
const IMMUTABLE = ['name', 'branch', 'base', 'ownedPaths', 'dependencies', 'port', 'worktree', 'createdAt'];

function command(program, args, cwd, options = {}) {
  const result = spawnSync(program, args, { cwd, encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${program} ${args.join(' ')} failed (${result.status ?? result.signal}): ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout?.trimEnd() ?? '';
}

function git(cwd, ...args) {
  return command('git', args, cwd);
}

function context(cwd) {
  const root = fs.realpathSync(git(cwd, 'rev-parse', '--show-toplevel'));
  const common = fs.realpathSync(path.resolve(root, git(root, 'rev-parse', '--git-common-dir')));
  const firstWorktree = git(root, 'worktree', 'list', '--porcelain', '-z').split('\0')[0];
  const coordinator = fs.realpathSync(firstWorktree.slice('worktree '.length));
  const directory = path.join(common, 'showcam');
  return { root, common, coordinator, directory, registry: path.join(directory, 'workstreams.json') };
}

function readRegistry(ctx) {
  if (!fs.existsSync(ctx.registry)) return { version: 1, coordinator: ctx.coordinator, tasks: {} };
  const registry = JSON.parse(fs.readFileSync(ctx.registry, 'utf8'));
  if (registry.version !== 1 || registry.coordinator !== ctx.coordinator) throw new Error('Registry coordinator/version mismatch. Review the registry before continuing.');
  return registry;
}

function updateRegistry(ctx, update) {
  fs.mkdirSync(ctx.directory, { recursive: true });
  const lock = path.join(ctx.directory, 'registry.lock');
  try { fs.mkdirSync(lock); } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another coordinator operation holds ${lock}. Retry after it finishes; inspect a stale lock manually.`);
    throw error;
  }
  try {
    const registry = readRegistry(ctx);
    const result = update(registry);
    const temporary = `${ctx.registry}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, ctx.registry);
    return result;
  } finally { fs.rmdirSync(lock); }
}

function coordinatorOnly(ctx) {
  if (ctx.root !== ctx.coordinator) throw new Error(`Coordinator-only command. Run from ${ctx.coordinator}.`);
}

function normalizeOwnership(value) {
  const directory = value.endsWith('/');
  const bare = directory ? value.slice(0, -1) : value;
  if (!bare || bare === '.' || path.posix.isAbsolute(bare) || bare.includes('\\') || /[\0*?\[\]{}!]/.test(bare)
    || bare.split('/').some((part) => !part || part === '.' || part === '..') || RESERVED.has(bare.split('/')[0])) {
    throw new Error(`Invalid owned path ${JSON.stringify(value)}. Use a repository-relative exact file or directory ending in /; globs and generated paths are excluded.`);
  }
  return bare + (directory ? '/' : '');
}

function overlaps(first, second) {
  const a = first.replace(/\/$/, '');
  const b = second.replace(/\/$/, '');
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function owns(ownedPaths, file) {
  return ownedPaths.some((owned) => owned.endsWith('/') ? file.startsWith(owned) : file === owned);
}

function assertSnapshotNoSymlinks(root, args, ownedPaths) {
  for (const entry of git(root, ...args).split('\0').filter(Boolean)) {
    const file = entry.slice(entry.indexOf('\t') + 1);
    if (entry.startsWith('120000 ') && owns(ownedPaths, file)) throw new Error(`Symlink ownership escape/alias is not allowed in Git snapshot: ${file}`);
  }
}

function assertNoSymlinks(root, relative) {
  let current = root;
  for (const component of relative.replace(/\/$/, '').split('/')) {
    current = path.join(current, component);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error(`Symlink ownership escape/alias is not allowed: ${relative}`);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return;
      throw error;
    }
  }
}

function assertOwnershipShape(root, ownedPaths) {
  for (const owned of ownedPaths) {
    assertNoSymlinks(root, owned);
    const location = path.join(root, owned);
    if (fs.existsSync(location)) {
      const isDirectory = fs.statSync(location).isDirectory();
      if (isDirectory !== owned.endsWith('/')) throw new Error(`Owned path ${owned} must use a trailing / only for directories.`);
    }
  }
}

function assertBaseOwnershipShape(root, base, ownedPaths) {
  assertSnapshotNoSymlinks(root, ['ls-tree', '-r', '-z', base], ownedPaths);
  for (const owned of ownedPaths) {
    const components = owned.replace(/\/$/, '').split('/');
    for (let index = 1; index <= components.length; index++) {
      const relative = components.slice(0, index).join('/');
      const entry = git(root, 'ls-tree', '-z', base, '--', relative);
      if (!entry) continue;
      const mode = entry.slice(0, 6);
      if (mode === '120000') throw new Error(`Symlink ownership escape/alias is not allowed in base: ${relative}`);
      if (index === components.length && (mode === '040000') !== owned.endsWith('/')) throw new Error(`Owned path ${owned} must use a trailing / only for directories.`);
    }
  }
  if (git(root, 'ls-tree', '-z', base, '--', '.agent-local')) throw new Error('.agent-local must be untracked in the base commit.');
}

async function portAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (error) => error.code === 'EADDRINUSE' || error.code === 'EACCES' ? resolve(false) : reject(error));
    server.listen({ port, host: '0.0.0.0', exclusive: true }, () => server.close(() => resolve(true)));
  });
}

function parse(args, allowed) {
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (!(flag in allowed)) throw new Error(`Unknown argument ${flag}. See --help.`);
    if (allowed[flag] === 'boolean') { values[flag] = true; continue; }
    const value = args[++index];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}.`);
    if (allowed[flag] === 'many') (values[flag] ??= []).push(value);
    else if (flag in values) throw new Error(`Duplicate argument ${flag}.`);
    else values[flag] = value;
  }
  return values;
}

function identity(task) {
  return Object.fromEntries(IMMUTABLE.map((key) => [key, task[key]]));
}

function localRecord(task) {
  return path.join(task.worktree, '.agent-local', 'task.json');
}

function taskFor(ctx, name) {
  const registry = readRegistry(ctx);
  const task = name ? registry.tasks[name] : Object.values(registry.tasks).find((candidate) => candidate.worktree === ctx.root);
  if (!task) throw new Error('No registered task found. Run from its worktree or pass --task NAME.');
  return task;
}

function checkIdentity(task) {
  for (const generated of ['.agent-local', '.agent-local/artifacts', 'node_modules', '.next']) assertNoSymlinks(task.worktree, generated);
  const local = JSON.parse(fs.readFileSync(localRecord(task), 'utf8'));
  if (JSON.stringify(local) !== JSON.stringify(identity(task))) throw new Error('Local task metadata differs from the coordinator registry. Restore .agent-local/task.json from the registry.');
  if (fs.realpathSync(task.worktree) !== task.worktree) throw new Error('Worktree path changed or contains a symlink.');
  if (git(task.worktree, 'branch', '--show-current') !== task.branch) throw new Error(`Task must remain on ${task.branch}.`);
  git(task.worktree, 'merge-base', '--is-ancestor', task.base, 'HEAD');
}

function diffPaths(output) {
  const entries = output.split('\0');
  const paths = [];
  for (let index = 0; index < entries.length && entries[index];) {
    const status = entries[index++];
    paths.push(entries[index++]);
    if (status.startsWith('R') || status.startsWith('C')) paths.push(entries[index++]);
  }
  return paths;
}

export function checkTask(task) {
  checkIdentity(task);
  assertOwnershipShape(task.worktree, task.ownedPaths);
  assertSnapshotNoSymlinks(task.worktree, ['ls-tree', '-r', '-z', 'HEAD'], task.ownedPaths);
  assertSnapshotNoSymlinks(task.worktree, ['ls-files', '--stage', '-z'], task.ownedPaths);
  const changes = new Map();
  const sources = [
    ['committed', ['diff', '--name-status', '-z', '--find-renames', task.base, 'HEAD']],
    ['staged', ['diff', '--cached', '--name-status', '-z', '--find-renames']],
    ['unstaged', ['diff', '--name-status', '-z', '--find-renames']],
  ];
  for (const [source, args] of sources) {
    for (const changed of diffPaths(git(task.worktree, ...args))) {
      if (!changes.has(changed)) changes.set(changed, new Set());
      changes.get(changed).add(source);
    }
  }
  for (const changed of git(task.worktree, 'ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)) {
    if (!changes.has(changed)) changes.set(changed, new Set());
    changes.get(changed).add('untracked');
  }
  const violations = [];
  for (const [changed, sources] of changes) {
    if (!owns(task.ownedPaths, changed)) {
      violations.push(`${changed} (${[...sources].join(', ')}) is outside owned paths`);
    } else {
      try { assertNoSymlinks(task.worktree, changed); } catch (error) { violations.push(error.message); }
    }
  }
  if (violations.length) throw new Error(`Ownership check failed:\n${violations.map((entry) => `- ${entry}`).join('\n')}`);
  return { task: task.name, base: task.base, head: git(task.worktree, 'rev-parse', 'HEAD'), changes: [...changes].map(([file, sources]) => ({ file, sources: [...sources] })) };
}

function install(task, skip) {
  if (skip) return 'skipped';
  command('npm', ['ci'], task.worktree, { stdio: 'inherit' });
  return 'npm-ci';
}

async function create(ctx, args) {
  coordinatorOnly(ctx);
  const options = parse(args, { '--name': 'one', '--base': 'one', '--own': 'many', '--depends': 'many', '--port': 'one', '--no-install': 'boolean' });
  const name = options['--name'];
  if (!name || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(name)) throw new Error('--name must be a lowercase slug starting with a letter.');
  if (!options['--base']) throw new Error('--base is required; record a fixed integration starting point.');
  const base = git(ctx.root, 'rev-parse', '--verify', `${options['--base']}^{commit}`);
  const ownedPaths = (options['--own'] ?? []).map(normalizeOwnership);
  if (!ownedPaths.length) throw new Error('At least one --own path is required.');
  assertBaseOwnershipShape(ctx.root, base, ownedPaths);
  for (let index = 0; index < ownedPaths.length; index++) {
    if (ownedPaths.slice(0, index).some((other) => overlaps(other, ownedPaths[index]))) throw new Error('Duplicate or overlapping owned paths within this task.');
  }
  const dependencies = options['--depends'] ?? [];
  const worktreeParent = path.join(path.dirname(ctx.coordinator), `${path.basename(ctx.coordinator)}-worktrees`);
  fs.mkdirSync(worktreeParent, { recursive: true });
  if (fs.realpathSync(worktreeParent) !== worktreeParent) throw new Error('Worktree parent must not contain symlinks.');
  const worktree = path.join(worktreeParent, name);
  if (fs.existsSync(worktree) || fs.lstatSync(worktree, { throwIfNoEntry: false })) throw new Error(`Worktree destination already exists: ${worktree}`);
  const branch = `agent/${name}`;
  if (git(ctx.root, 'branch', '--list', branch)) throw new Error(`Branch already exists: ${branch}`);
  let port = options['--port'] ? Number(options['--port']) : 3101;
  if (!Number.isInteger(port) || port < 3101 || port > 65535) throw new Error('--port must be an integer from 3101 to 65535.');
  const current = readRegistry(ctx);
  const reservedPorts = new Set(Object.values(current.tasks).filter((task) => HELD.has(task.status)).map((task) => task.port));
  if (options['--port']) {
    if (reservedPorts.has(port) || !(await portAvailable(port))) throw new Error(`Port ${port} is reserved or already in use.`);
  } else {
    while (port <= 65535 && (reservedPorts.has(port) || !(await portAvailable(port)))) port++;
    if (port > 65535) throw new Error('No available worker port.');
  }
  const task = { name, branch, base, ownedPaths, dependencies, port, worktree, createdAt: new Date().toISOString(), status: 'provisioning' };
  updateRegistry(ctx, (registry) => {
    if (registry.tasks[name]) throw new Error(`Task ${name} is already registered; choose a new name.`);
    const held = Object.values(registry.tasks).filter((existing) => HELD.has(existing.status));
    if (held.length >= 3) throw new Error('Three worker slots are already reserved. Integrate a completed task before starting another.');
    if (held.some((existing) => existing.port === port)) throw new Error(`Port ${port} was concurrently reserved. Retry.`);
    for (const existing of held) {
      if (ownedPaths.some((owned) => existing.ownedPaths.some((other) => overlaps(owned, other)))) throw new Error(`Ownership overlaps active task ${existing.name}.`);
    }
    for (const dependency of dependencies) {
      const prerequisite = registry.tasks[dependency];
      if (!prerequisite || prerequisite.status !== 'integrated') throw new Error(`Dependency ${dependency} is not integrated.`);
      try { git(ctx.root, 'merge-base', '--is-ancestor', prerequisite.integratedAtCommit, base); }
      catch { throw new Error(`Base ${base} does not include integrated dependency ${dependency}.`); }
    }
    registry.tasks[name] = task;
  });
  let created = false;
  try {
    git(ctx.root, 'worktree', 'add', '-b', branch, worktree, base);
    created = true;
    assertOwnershipShape(worktree, ownedPaths);
    const local = path.join(worktree, '.agent-local');
    if (fs.existsSync(local)) throw new Error('.agent-local already exists in the base commit; choose a clean base.');
    fs.mkdirSync(path.join(local, 'artifacts'), { recursive: true });
    fs.writeFileSync(localRecord(task), `${JSON.stringify(identity(task), null, 2)}\n`, { flag: 'wx', mode: 0o444 });
    // Repository-local exclude also supports fixture repos without Showcam's .gitignore.
    const exclude = path.join(ctx.common, 'info', 'exclude');
    fs.mkdirSync(path.dirname(exclude), { recursive: true });
    if (!fs.existsSync(exclude) || !fs.readFileSync(exclude, 'utf8').split('\n').includes('.agent-local/')) fs.appendFileSync(exclude, '\n.agent-local/\n');
    const installation = install(task, options['--no-install']);
    updateRegistry(ctx, (registry) => Object.assign(registry.tasks[name], { status: 'active', installation }));
    return { ...task, status: 'active', installation };
  } catch (error) {
    updateRegistry(ctx, (registry) => Object.assign(registry.tasks[name], { status: created ? 'setup-failed' : 'creation-failed', error: error.message }));
    throw new Error(`${error.message}\nTask ${name} recorded as ${created ? 'setup-failed (ownership and port retained)' : 'creation-failed'}. Existing worktree/branch were preserved for inspection.`);
  }
}

function environment(task) {
  return { SHOWCAM_URL: `http://127.0.0.1:${task.port}`, PORT: String(task.port), SHOWCAM_TASK: task.name, SHOWCAM_BASE_SHA: task.base, SHOWCAM_WORKTREE: task.worktree, SHOWCAM_ARTIFACT_DIR: path.join(task.worktree, '.agent-local', 'artifacts') };
}

const HELP = `Usage (Node 24+): node scripts/workstreams/cli.mjs COMMAND [options]

Coordinator commands (run in the main checkout):
  create --name SLUG --base REF --own PATH [--own PATH] [--depends NAME] [--port 3101] [--no-install]
  retry --task NAME [--no-install]   Retry installation after setup failure
  complete --task NAME              Check ownership and require a clean committed worker
  integrated --task NAME            Verify the completed commit is included in coordinator HEAD

Worker or coordinator commands:
  list                             Print registry, including failed and integrated tasks
  check [--task NAME]               Audit committed, staged, unstaged, and untracked paths
  env [--task NAME]                 Print task environment as JSON
  run [--task NAME] [--server] -- COMMAND [ARG...]
                                   Run argv in worker root with task environment

Owned paths are exact files or directories ending in /. No globs or symlinks.
Dependencies must already be integrated and included in the chosen base.
The default create runs npm ci inside the new worktree. --no-install is an explicit
escape hatch for fixture tests or manually provisioned dependencies.
No command rebases, force pushes, removes worktrees, or deletes branches.
`;

export async function main(args, cwd = process.cwd()) {
  const [action, ...rest] = args;
  if (!action || action === '--help' || action === 'help') return HELP;
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Node 24 or newer is required.');
  const ctx = context(cwd);
  if (action === 'create') return create(ctx, rest);
  if (action === 'list') { parse(rest, {}); return readRegistry(ctx); }
  if (['check', 'env', 'complete', 'integrated', 'retry'].includes(action)) {
    const options = parse(rest, { '--task': 'one', ...(action === 'retry' ? { '--no-install': 'boolean' } : {}) });
    const task = taskFor(ctx, options['--task']);
    if (action === 'check') return checkTask(task);
    if (action === 'env') { checkIdentity(task); return environment(task); }
    coordinatorOnly(ctx);
    if (action === 'retry') {
      if (task.status !== 'setup-failed') throw new Error('Retry requires a setup-failed task.');
      checkIdentity(task);
      assertOwnershipShape(task.worktree, task.ownedPaths);
      if (!(await portAvailable(task.port))) throw new Error(`Port ${task.port} is already in use.`);
      const installation = install(task, options['--no-install']);
      return updateRegistry(ctx, (registry) => Object.assign(registry.tasks[task.name], { status: 'active', installation, error: null }));
    }
    if (action === 'complete') {
      if (task.status !== 'active') throw new Error('Complete requires an active task.');
      const report = checkTask(task);
      if (git(task.worktree, 'status', '--porcelain', '--untracked-files=all')) throw new Error('Commit all worker changes before marking complete.');
      return updateRegistry(ctx, (registry) => Object.assign(registry.tasks[task.name], { status: 'complete', completedCommit: report.head }));
    }
    if (task.status !== 'complete') throw new Error('Integrated requires a completed task.');
    const report = checkTask(task);
    if (report.head !== task.completedCommit || git(task.worktree, 'status', '--porcelain', '--untracked-files=all')) throw new Error('Worker changed after completion. Review it before integration.');
    git(ctx.root, 'merge-base', '--is-ancestor', task.completedCommit, 'HEAD');
    return updateRegistry(ctx, (registry) => Object.assign(registry.tasks[task.name], { status: 'integrated', integratedAtCommit: git(ctx.root, 'rev-parse', 'HEAD') }));
  }
  if (action === 'run') {
    const divider = rest.indexOf('--');
    if (divider < 0 || !rest[divider + 1]) throw new Error('run requires -- COMMAND [ARG...].');
    const options = parse(rest.slice(0, divider), { '--task': 'one', '--server': 'boolean' });
    const task = taskFor(ctx, options['--task']);
    if (task.status !== 'active') throw new Error('run requires an active task.');
    checkIdentity(task);
    if (options['--server'] && !(await portAvailable(task.port))) throw new Error(`Port ${task.port} is already in use.`);
    command(rest[divider + 1], rest.slice(divider + 2), task.worktree, { stdio: 'inherit', env: { ...process.env, ...environment(task) } });
    return { task: task.name, command: rest.slice(divider + 1), status: 'passed' };
  }
  throw new Error(`Unknown command ${action}. See --help.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((result) => {
    process.stdout.write(typeof result === 'string' ? result : `${JSON.stringify(result, null, 2)}\n`);
  }).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
