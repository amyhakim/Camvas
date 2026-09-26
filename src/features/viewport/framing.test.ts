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
