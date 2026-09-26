import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const dir = mkdtempSync(join(process.cwd(), '.camera-test-'));
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', dir, '--module', 'node16', '--moduleResolution', 'node16', '--target', 'es2022', '--types', 'node', '--skipLibCheck', 'src/backend/contracts.test.ts'], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--test', join(dir, 'backend/contracts.test.js')], { stdio: 'inherit' });
} finally { rmSync(dir, { recursive: true, force: true }); }
