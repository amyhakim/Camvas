import test from 'node:test';
import assert from 'node:assert/strict';
import { manifestFromSuperSplat, parseSearchResults } from './supersplat';
import { isSupportedScene, sceneIdFromSearch, sceneManifestUrl } from '../features/scene/catalog';
import { createCollection, parseCollection, serializeCollection } from '../features/project/collection';

const id = 'supersplat-592480a3-v1';
const row = { hash: '592480a3', version: 1, title: 'Greenhouse', format: 'sog', task: { status: 'complete' }, listed: true, size: 16000000, user: { username: 'creator' }, downloads: { enabled: true, license: 'by' } };
const data = { contentUrl: 'https://d28zzqy0iyovbz.cloudfront.net/592480a3/v1/meta.json', settings: { cameras: [{ initial: { position: [4, 3, 2], target: [1, 0, -1], fov: 60 } }] } };
const html = (value: unknown) => `<script type="application/json" id="sse-bootstrap">${JSON.stringify(value)}</script>`;
const page = '<meta property="og:title" content="Plants &amp; Light - SuperSplat"/><a href="/user/creator">Creator</a>';

test('search exposes complete public supported captures, with canonical links and attribution', () => {
  const results = parseSearchResults({ result: [row, { ...row, listed: false }, { ...row, task: { status: 'pending' } }, { ...row, hash: '../foo' }, { ...row, format: 'unknown' }] });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, id);
  assert.equal(results[0].author, 'creator');
  assert.equal(results[0].sourceUrl, 'https://superspl.at/scene/592480a3');
  assert.equal(results[0].license, 'by');
  assert.throws(() => parseSearchResults({ error: 'unavailable' }), /unreadable/);
  assert.deepEqual(parseSearchResults({ result: [] }), []);
});

test('manifest preserves opening camera, source transform, attribution, and coordinate conventions', () => {
  const manifest = manifestFromSuperSplat(id, html(data), page);
  assert.equal(manifest.name, 'Plants & Light');
  assert.deepEqual(manifest.asset?.rotation, [0, 0, 180]);
  assert.deepEqual(manifest.initialView?.position, [4, 3, 2]);
  assert.deepEqual(manifest.objects[1].position, [4, -2, 3]);
  assert.ok(Math.abs(manifest.initialView!.fov - 35.98339777135764) < 0.00001);
  assert.equal(manifest.attribution?.author, 'creator');
  assert.equal(manifest.objects[0].type, 'Splat');
});

test('untrusted bootstrap cannot redirect asset fetches or silently change source versions', () => {
  for (const contentUrl of ['http://localhost/secret', 'https://evil.example/meta.json', 'https://d28zzqy0iyovbz.cloudfront.net/592480a3/v2/meta.json', 'https://d28zzqy0iyovbz.cloudfront.net/592480a3/v1/../private/meta.json']) {
    assert.throws(() => manifestFromSuperSplat(id, html({ ...data, contentUrl }), page), /changed|unsupported/);
  }
  assert.throws(() => manifestFromSuperSplat(id, '<script>alert(1)</script>', page), /cannot be opened/);
  assert.throws(() => manifestFromSuperSplat(id, html({ ...data, settings: { cameras: [] } }), page), /opening camera/);
  assert.throws(() => manifestFromSuperSplat('../foo', html(data), page), /Invalid/);
});

test('dynamic source survives collection export/import and URL resolution without a local registry', () => {
  const collection = createCollection({ format: 'showcam-project', version: 1, sceneId: id, name: 'Garden film', shot: null, actors: [] }, 'scene:test');
  collection.scenes[0].name = 'Greenhouse';
  const restored = parseCollection(serializeCollection(collection));
  assert.equal(restored.scenes[0].document.sceneId, id);
  assert.equal(restored.scenes[0].name, 'Greenhouse');
  assert.ok(isSupportedScene(id));
  assert.equal(sceneIdFromSearch(`?scene=${id}`), id);
  assert.equal(sceneManifestUrl(id), `/api/scenes/manifest?id=${id}`);
  assert.equal(sceneIdFromSearch('?scene=pavilion'), 'pavilion-v1');
  assert.equal(sceneIdFromSearch('?scene=unrecognized'), 'pavilion-v1');
  assert.equal(sceneManifestUrl('https://evil.example'), null);
});
