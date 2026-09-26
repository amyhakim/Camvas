import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function invoke(cwd, args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function fails(cwd, args, pattern, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', ...options });
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
}

function fixture(t) {
  const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'showcam-workstreams-')));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'showcam');
  fs.mkdirSync(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Workstream Test');
  git(root, 'config', 'user.email', 'workstreams@example.invalid');
  for (const [file, text] of Object.entries({
    '.gitignore': '.agent-local/\nnode_modules/\n.next/\n',
    'src/alpha/a.txt': 'alpha\n',
    'src/beta/b.txt': 'beta\n',
    'docs/notes.md': '# Notes\n',
    'package.json': '{"name":"workstream-test","version":"1.0.0"}\n',
  })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'fixture');
  const base = git(root, 'rev-parse', 'HEAD');
  const create = (name = 'alpha', owned = 'src/alpha/', extra = []) => invoke(root, ['create', '--name', name, '--base', base, '--own', owned, '--no-install', ...extra]);
  return { root, base, create, temporary };
}

test('create pins a base, isolates environment, and audits all four change sources', (t) => {
  const { root, base, create } = fixture(t);
  const task = create();
  assert.equal(task.base, base);
  assert.equal(task.branch, 'agent/alpha');
  assert.equal(task.worktree, path.join(path.dirname(root), 'showcam-worktrees', 'alpha'));
  assert.equal(task.status, 'active');
  assert.ok(task.port >= 3101);
  fs.writeFileSync(path.join(task.worktree, 'src/alpha/a.txt'), 'committed\n');
  git(task.worktree, 'add', '.');
  git(task.worktree, 'commit', '-m', 'owned commit');
  fs.writeFileSync(path.join(task.worktree, 'src/alpha/staged.txt'), 'staged\n');
  git(task.worktree, 'add', '.');
  fs.writeFileSync(path.join(task.worktree, 'src/alpha/a.txt'), 'unstaged\n');
  fs.writeFileSync(path.join(task.worktree, 'src/alpha/untracked.txt'), 'untracked\n');
  const report = invoke(task.worktree, ['check']);
  assert.deepEqual(new Set(report.changes.flatMap((change) => change.sources)), new Set(['committed', 'staged', 'unstaged', 'untracked']));
  const environment = invoke(task.worktree, ['env']);
  assert.equal(environment.PORT, String(task.port));
  assert.equal(environment.SHOWCAM_URL, `http://127.0.0.1:${task.port}`);
  assert.equal(environment.SHOWCAM_BASE_SHA, base);
  assert.ok(environment.SHOWCAM_ARTIFACT_DIR.startsWith(task.worktree));
  assert.equal(fs.existsSync(path.join(task.worktree, 'node_modules')), false);
});

for (const source of ['committed', 'staged', 'unstaged', 'untracked']) {
  test(`check rejects an out-of-scope ${source} change`, (t) => {
    const { create } = fixture(t);
    const task = create();
    const file = source === 'untracked' ? 'src/beta/new.txt' : 'src/beta/b.txt';
    fs.writeFileSync(path.join(task.worktree, file), 'forbidden\n');
    if (source === 'committed' || source === 'staged') git(task.worktree, 'add', '.');
    if (source === 'committed') git(task.worktree, 'commit', '-m', 'outside ownership');
    fails(task.worktree, ['check'], new RegExp(`${file} \\(${source}\\) is outside owned paths`));
  });
}

test('staged violations cannot be concealed by restoring working-tree contents', (t) => {
  const { create } = fixture(t);
  const task = create();
  const file = path.join(task.worktree, 'src/beta/b.txt');
  fs.writeFileSync(file, 'forbidden\n');
  git(task.worktree, 'add', '.');
  fs.writeFileSync(file, 'beta\n');
  fails(task.worktree, ['check'], /src\/beta\/b.txt \(staged, unstaged\)/);
});

test('rename audit checks both original and destination paths', (t) => {
  const { create } = fixture(t);
  const task = create();
  git(task.worktree, 'mv', 'src/beta/b.txt', 'src/alpha/moved.txt');
  fails(task.worktree, ['check'], /src\/beta\/b.txt \(staged\)/);
  git(task.worktree, 'commit', '-m', 'rename into scope');
  fails(task.worktree, ['check'], /src\/beta\/b.txt \(committed\)/);
});

test('symlinks cannot expand directory ownership outside a worktree', (t) => {
  const { create, temporary } = fixture(t);
  const task = create();
  fs.symlinkSync(temporary, path.join(task.worktree, 'src/alpha/escape'));
  fails(task.worktree, ['check'], /Symlink ownership escape/);
});

test('staged symlinks cannot hide behind a replaced working-copy file', (t) => {
  const { create, temporary } = fixture(t);
  const task = create();
  const file = path.join(task.worktree, 'src/alpha/escape');
  fs.symlinkSync(temporary, file);
  git(task.worktree, 'add', '.');
  fs.unlinkSync(file);
  fs.writeFileSync(file, 'ordinary working file\n');
  fails(task.worktree, ['check'], /Symlink ownership escape.*Git snapshot/);
});

test('symlink directory ownership fails before reserving a worker', (t) => {
  const { root, temporary } = fixture(t);
  fs.symlinkSync(temporary, path.join(root, 'outside'));
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'symlink fixture');
  fails(root, ['create', '--name', 'escape', '--base', 'HEAD', '--own', 'outside/', '--no-install'], /Symlink ownership escape/);
  assert.equal(invoke(root, ['list']).tasks.escape, undefined);
});

test('worker dependencies and build outputs cannot alias a shared directory', (t) => {
  const { create, temporary } = fixture(t);
  const task = create();
  for (const directory of ['node_modules', '.next']) {
    const location = path.join(task.worktree, directory);
    fs.symlinkSync(temporary, location);
    fails(task.worktree, ['check'], /Symlink ownership escape/);
    fs.unlinkSync(location);
  }
});

test('ownership rejects overlap, globs, traversal, generated directories, and duplicate names', (t) => {
  const { root, base, create } = fixture(t);
  create();
  for (const owned of ['src/', 'src/alpha/a.txt']) fails(root, ['create', '--name', 'overlap', '--base', base, '--own', owned, '--no-install'], /Ownership overlaps active task alpha/);
  for (const owned of ['../other/', '/tmp/', 'src/**', '.git/', '.agent-local/', 'src//alpha/']) fails(root, ['create', '--name', 'invalid', '--base', base, '--own', owned, '--no-install'], /Invalid owned path/);
  fails(root, ['create', '--name', 'alpha', '--base', base, '--own', 'docs/', '--no-install'], /already exists/);
});

test('preexisting destinations and branches remain untouched', (t) => {
  const { root, base, temporary } = fixture(t);
  const destination = path.join(temporary, 'showcam-worktrees', 'existing');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'keep.txt'), 'keep');
  fails(root, ['create', '--name', 'existing', '--base', base, '--own', 'docs/', '--no-install'], /destination already exists/);
  assert.equal(fs.readFileSync(path.join(destination, 'keep.txt'), 'utf8'), 'keep');
  git(root, 'branch', 'agent/existing-branch');
  fails(root, ['create', '--name', 'existing-branch', '--base', base, '--own', 'docs/', '--no-install'], /Branch already exists/);
});

test('at most three workers reserve slots and ports', (t) => {
  const { root, base, create } = fixture(t);
  const tasks = [create('alpha'), create('beta', 'src/beta/'), create('docs', 'docs/')];
  assert.equal(new Set(tasks.map((task) => task.port)).size, 3);
  fails(root, ['create', '--name', 'fourth', '--base', base, '--own', 'package.json', '--no-install'], /Three worker slots/);
});

test('occupied requested ports fail before worktree creation and auto allocation skips them', async (t) => {
  const { root, base, create } = fixture(t);
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '0.0.0.0', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  fails(root, ['create', '--name', 'busy', '--base', base, '--own', 'src/alpha/', '--port', String(port), '--no-install'], /reserved or already in use/);
  assert.equal(invoke(root, ['list']).tasks.busy, undefined);
  const first = create();
  fails(root, ['create', '--name', 'same-port', '--base', base, '--own', 'src/beta/', '--port', String(first.port), '--no-install'], /reserved or already in use/);
  const workerServer = net.createServer();
  await new Promise((resolve) => workerServer.listen(first.port, '0.0.0.0', resolve));
  t.after(() => new Promise((resolve) => workerServer.close(resolve)));
  fails(first.worktree, ['run', '--server', '--', process.execPath, '-e', 'process.exit(0)'], /already in use/);
});

test('failed npm ci retains metadata, ownership and worktree for explicit retry', (t) => {
  const { root, base, temporary } = fixture(t);
  const bin = path.join(temporary, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'npm'), `#!${process.execPath}\nprocess.exit(23);\n`, { mode: 0o755 });
  fails(root, ['create', '--name', 'broken', '--base', base, '--own', 'src/alpha/'], /setup-failed/, { env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}` } });
  const task = invoke(root, ['list']).tasks.broken;
  assert.equal(task.status, 'setup-failed');
  assert.equal(git(task.worktree, 'branch', '--show-current'), 'agent/broken');
  assert.ok(fs.existsSync(path.join(task.worktree, '.agent-local/task.json')));
  fails(root, ['create', '--name', 'overlap', '--base', base, '--own', 'src/alpha/', '--no-install'], /Ownership overlaps/);
  assert.equal(invoke(root, ['retry', '--task', 'broken', '--no-install']).status, 'active');
});

test('completion and integration are coordinator-only and dependencies require an integrated base', (t) => {
  const { root, base, create } = fixture(t);
  const task = create();
  fs.writeFileSync(path.join(task.worktree, 'src/alpha/a.txt'), 'complete\n');
  fails(task.worktree, ['complete'], /Coordinator-only/);
  fails(root, ['complete', '--task', 'alpha'], /Commit all worker changes/);
  git(task.worktree, 'add', '.');
  git(task.worktree, 'commit', '-m', 'completed work');
  invoke(root, ['complete', '--task', 'alpha']);
  fails(root, ['create', '--name', 'dependent', '--base', base, '--own', 'docs/', '--depends', 'alpha', '--no-install'], /not integrated/);
  fails(root, ['integrated', '--task', 'alpha'], /merge-base/);
  git(root, 'merge', '--no-ff', 'agent/alpha', '-m', 'integrate alpha');
  assert.equal(invoke(root, ['integrated', '--task', 'alpha']).status, 'integrated');
  fails(root, ['create', '--name', 'dependent', '--base', base, '--own', 'docs/', '--depends', 'alpha', '--no-install'], /does not include integrated dependency/);
  assert.equal(invoke(root, ['create', '--name', 'dependent', '--base', 'HEAD', '--own', 'docs/', '--depends', 'alpha', '--no-install']).status, 'active');
  assert.equal(create('next-alpha').status, 'active');
});

test('registry identity rejects metadata edits and branch switches', (t) => {
  const { create } = fixture(t);
  const task = create();
  git(task.worktree, 'switch', '-c', 'wrong-branch');
  fails(task.worktree, ['check'], /must remain on agent\/alpha/);
  git(task.worktree, 'switch', task.branch);
  const record = path.join(task.worktree, '.agent-local/task.json');
  fs.chmodSync(record, 0o644);
  fs.writeFileSync(record, '{}\n');
  fails(task.worktree, ['check'], /differs from the coordinator registry/);
});

test('run preserves literal argv and supplies worker-local output paths', (t) => {
  const { create } = fixture(t);
  const task = create();
  const literal = '$(touch should-not-exist); `echo nope`';
  invoke(task.worktree, ['run', '--', process.execPath, '-e', 'require("node:fs").writeFileSync(process.env.SHOWCAM_ARTIFACT_DIR + "/argv.json", JSON.stringify({arg: process.argv[1], cwd: process.cwd(), port: process.env.PORT}))', literal]);
  const artifact = JSON.parse(fs.readFileSync(path.join(task.worktree, '.agent-local/artifacts/argv.json'), 'utf8'));
  assert.deepEqual(artifact, { arg: literal, cwd: task.worktree, port: String(task.port) });
  assert.equal(fs.existsSync(path.join(task.worktree, 'should-not-exist')), false);
  invoke(task.worktree, ['check']);
});
