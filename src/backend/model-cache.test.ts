import assert from 'node:assert/strict';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { extractGltfZip, safeRelativePath } from './model-cache';

test('archive paths cannot escape the model folder or smuggle unservable types', () => {
  assert.equal(safeRelativePath('textures/wood.png'), 'textures/wood.png');
  assert.equal(safeRelativePath('./scene.gltf'), 'scene.gltf');
  for (const hostile of ['../../etc/passwd.png', 'a/../../b.bin', '.hidden/x.png', 'index.html', 'script.js', 'C:evil.png', 'x.svg']) assert.equal(safeRelativePath(hostile), null, hostile);
});

test('gltf archives extract only allowed files and enforce the decompressed budget', () => {
  const archive = zipSync({ 'scene.gltf': strToU8('{"asset":{"version":"2.0"}}'), 'scene.bin': new Uint8Array(16), 'textures/a.png': new Uint8Array(8), 'readme.html': strToU8('<script>'), '../escape.png': new Uint8Array(4) });
  const files = extractGltfZip(archive);
  assert.deepEqual([...files.keys()].sort(), ['scene.bin', 'scene.gltf', 'textures/a.png']);
  // Highly compressible payload: tiny archive, large expansion.
  const bomb = zipSync({ 'scene.bin': new Uint8Array(4 * 1024 * 1024) }, { level: 9 });
  assert.ok(bomb.byteLength < 64 * 1024);
  assert.throws(() => extractGltfZip(bomb, 1024 * 1024), /size limit/);
});
