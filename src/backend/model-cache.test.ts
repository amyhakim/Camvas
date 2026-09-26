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

test('concurrent model opens share one download and report cache/download/preparation stages', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { cachedModel } = await import('./model-cache');
  const dir = await mkdtemp(join(tmpdir(), 'showcam-progress-'));
  const originalFetch = globalThis.fetch, oldCache = process.env.SKETCHFAB_CACHE_DIR, oldToken = process.env.SKETCHFAB_API_TOKEN;
  process.env.SKETCHFAB_CACHE_DIR = dir; process.env.SKETCHFAB_API_TOKEN = 'fixture-token';
  let downloads = 0;
  globalThis.fetch = async input => {
    const url = String(input);
    if (url.endsWith('/download')) return Response.json({ glb: { url: 'https://fixture.invalid/model.glb', size: 8 } });
    downloads++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response(new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0, 0, 0, 0]), { headers: { 'Content-Length': '8' } });
  };
  try {
    const first: string[] = [], second: string[] = [];
    const uid = 'c'.repeat(32);
    const [a, b] = await Promise.all([cachedModel(uid, progress => first.push(progress.message)), cachedModel(uid, progress => second.push(progress.message))]);
    assert.deepEqual(a, b); assert.equal(downloads, 1);
    for (const stages of [first, second]) {
      assert.ok(stages.some(message => message.includes('Checking model cache')));
      assert.ok(stages.some(message => message.includes('100%')));
      assert.ok(stages.some(message => message.includes('Preparing model files')));
    }
    await cachedModel(uid); assert.equal(downloads, 1, 'Repeat opens use the cache');
  } finally {
    globalThis.fetch = originalFetch;
    if (oldCache === undefined) delete process.env.SKETCHFAB_CACHE_DIR; else process.env.SKETCHFAB_CACHE_DIR = oldCache;
    if (oldToken === undefined) delete process.env.SKETCHFAB_API_TOKEN; else process.env.SKETCHFAB_API_TOKEN = oldToken;
    await rm(dir, { recursive: true, force: true });
  }
});


test('model transfer compression is lossless, negotiated, and skips compressed images', async () => {
  const { modelTransfer } = await import('./model-transfer');
  const { gunzipSync } = await import('node:zlib');
  const bytes = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, extras: 'model-data-'.repeat(1000) }));
  const compressed = await modelTransfer(bytes, 'model/gltf+json', 'br, gzip');
  assert.equal(compressed.compressed, true);
  assert.deepEqual(new Uint8Array(gunzipSync(compressed.data)), bytes);
  assert.equal((await modelTransfer(bytes, 'model/gltf+json', 'gzip;q=0, br')).compressed, false);
  assert.equal((await modelTransfer(bytes, 'image/png', 'gzip')).compressed, false);
});
