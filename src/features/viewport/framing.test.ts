import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { pathFixture, regionFixture } from './fixtures';
import { framePath } from './framing';

test('fits a plain path contract without knowledge of shot authoring', () => {
  for (const aspect of [16 / 9, 390 / 844]) {
    const fit = framePath(pathFixture.points, pathFixture.target, aspect, regionFixture);
    const camera = new PerspectiveCamera(fit.fov, aspect, .05, 400);
    camera.position.fromArray(fit.position);
    camera.lookAt(new Vector3(...fit.target));
    camera.updateMatrixWorld();
    for (const point of [...pathFixture.points, pathFixture.target]) {
      const p = new Vector3(...point).project(camera);
      const x = (p.x + 1) / 2, y = (1 - p.y) / 2;
      assert.ok(x >= regionFixture.left && x <= regionFixture.right);
      assert.ok(y >= regionFixture.top && y <= regionFixture.bottom);
    }
  }
});

test('object fitting keeps the current viewing side while fitting the clear region', () => {
  const view = new Vector3(-4, 2, 7).normalize();
  const fit = framePath([[-1, 0, -1], [1, 2, 1]], [0, 1, 0], 16 / 9, regionFixture, view.toArray());
  const fittedDirection = new Vector3(...fit.position).sub(new Vector3(...fit.target)).normalize();
  assert.ok(fittedDirection.distanceTo(view) < 1e-10);
  const camera = new PerspectiveCamera(fit.fov, 16 / 9, .05, 400);
  camera.position.fromArray(fit.position); camera.lookAt(new Vector3(...fit.target)); camera.updateMatrixWorld();
  for (const x of [-1, 1]) for (const y of [0, 2]) for (const z of [-1, 1]) {
    const p = new Vector3(x, y, z).project(camera);
    assert.ok((p.x + 1) / 2 >= regionFixture.left && (p.x + 1) / 2 <= regionFixture.right);
    assert.ok((1 - p.y) / 2 >= regionFixture.top && (1 - p.y) / 2 <= regionFixture.bottom);
  }
});
