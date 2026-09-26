import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = mkdtempSync(`${process.cwd()}/.camera-test-`);
const tests = ['src/features', 'src/editor'].flatMap(root => readdirSync(root, { recursive: true }).filter(path => path.endsWith('.test.ts')).map(path => join(root, path)));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', dir, '--module', 'node16', '--moduleResolution', 'node16', '--target', 'es2022', '--types', 'node', '--skipLibCheck', ...tests], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--test', ...tests.map(path => join(dir, path.replace(/^src\//, '').replace(/\.ts$/, '.js')))], { stdio: 'inherit' });
} finally { rmSync(dir, { recursive: true, force: true }); }
