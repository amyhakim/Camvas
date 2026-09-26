import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// PlayCanvas is ESM. tsx runs the actual TypeScript modules without a CommonJS-only staging build.
const tests = ['src/features', 'src/editor'].flatMap(root => readdirSync(root, { recursive: true }).filter(path => path.endsWith('.test.ts')).map(path => join(root, path)));
execFileSync(process.execPath, ['--import', 'tsx', '--test', ...tests], { stdio: 'inherit' });
