import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

// Compile the portable TypeScript modules into a disposable Node test directory.
const dir = mkdtempSync(`${process.cwd()}/.camera-test-`);
try {
  execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--ignoreConfig', '--outDir', dir, '--module', 'node16', '--moduleResolution', 'node16', '--target', 'es2020', '--skipLibCheck', 'src/features/camera/model.ts', 'src/features/viewport/framing.ts'], { stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  const { generateShot, compileShot, shotEndFrame } = require(`${dir}/features/camera/model.js`);
  const { framePath } = require(`${dir}/features/viewport/framing.js`);
  const { CAMERA_MOVE_PRESETS } = require(`${dir}/vendor/blockout/camera-moves.js`);
  const { verticalFov, frameSubject } = require(`${dir}/vendor/blockout/camera.js`);
  const { Euler, Vector3, PerspectiveCamera } = require('three');
  const snapshot = { subjectId: 'chair', subjectName: 'Chair', min: [9, 2, -6], max: [11, 4, -4], cameraPosition: [10, 5, 7] };
  const settings = { presetId: 'orbit-90-left', duration: 6, focalLength: 35, sensor: 'fullFrame', framing: 'wide' };
  assert.equal(CAMERA_MOVE_PRESETS.length, 39);
  assert.equal(new Set(CAMERA_MOVE_PRESETS.map(p => p.id)).size, 39);
  for (const preset of CAMERA_MOVE_PRESETS) {
    const shot = generateShot(snapshot, { ...settings, presetId: preset.id });
    assert.deepEqual(shot.target, [10, 3, -5], 'Aim uses bounds center, not mesh origin or ground assumption');
    assert.equal(shot.marks[0].time, 0);
    assert.equal(shot.marks.at(-1).time, 6);
    assert.ok(shot.marks.every((m, i) => i === 0 || m.time > shot.marks[i-1].time));
    const evaluate = compileShot(shot);
    for (const time of [0, .05, 1.2, 3, 5.9, 6, 90, 2, 0]) {
      const pose = evaluate(time);
      assert.ok([...pose.position, pose.pan, pose.tilt, pose.roll, pose.fov].every(Number.isFinite), `${preset.id}: finite pose`);
      assert.ok(pose.focalLength >= 8 && pose.focalLength <= 300);
      if (shot.trackSubject) {
        const forward = new Vector3(0,0,-1).applyEuler(new Euler(pose.tilt, pose.pan, pose.roll, 'YXZ'));
        const toward = new Vector3(...shot.target).sub(new Vector3(...pose.position)).normalize();
        assert.ok(forward.dot(toward) > .99999, `${preset.id}: camera actually points at subject`);
      }
    }
    const path = Array.from({length:121}, (_,i)=>evaluate(shot.settings.duration*i/120).position);
    for (const viewport of [{w:1440,h:900,left:272,right:1086,top:90,bottom:640}, {w:1280,h:720,left:272,right:926,top:90,bottom:461}]) {
      const region = {left:viewport.left/viewport.w,right:viewport.right/viewport.w,top:viewport.top/viewport.h,bottom:viewport.bottom/viewport.h};
      const fit = framePath(path,shot.target,viewport.w/viewport.h,region);
      const camera = new PerspectiveCamera(fit.fov,viewport.w/viewport.h,.05,400);
      camera.position.fromArray(fit.position); camera.lookAt(new Vector3(...fit.target)); camera.updateMatrixWorld();
      for(const point of [...path,shot.target]) {
        const projected=new Vector3(...point).project(camera);
        const x=(projected.x+1)/2, y=(1-projected.y)/2;
        assert.ok(x>=region.left && x<=region.right && y>=region.top && y<=region.bottom,`${preset.id}: full path fits clear viewport at ${viewport.w}`);
      }
    }
    const before = evaluate(2.4); evaluate(5); evaluate(0);
    assert.deepEqual(evaluate(2.4), before, 'Random access playback is deterministic');
    assert.deepEqual(evaluate(99), evaluate(6), 'End pose holds');
    for (const mark of shot.marks) {
      const actual = evaluate(mark.time).position;
      assert.ok(actual.every((v, i) => Math.abs(v - [mark.position.x,mark.position.y,mark.position.z][i]) < 1e-7), 'Path visits each editable mark');
    }
  }
  const shot = generateShot(snapshot, settings);
  assert.equal(shotEndFrame(generateShot(snapshot,{...settings,duration:1.1}),24),28, 'Fractional duration reaches final pose');
  assert.equal(shotEndFrame(shot, 24), 145, 'Frame 1 is t=0');
  assert.equal(shotEndFrame(generateShot(snapshot,{...settings,duration:20}),24),481);
  assert.ok(verticalFov('fullFrame', 85, '16:9') < verticalFov('fullFrame', 24, '16:9'));
  assert.ok(Math.abs(verticalFov('super35',35,'9:16') - 2*Math.atan(18.66/70))<1e-10,'Portrait crop respects actual sensor height');
  assert.ok(frameSubject('WS',2,'fullFrame',85,'16:9').distance > frameSubject('WS',2,'fullFrame',24,'16:9').distance);
  const edited = structuredClone(shot); edited.marks[2].position.x += 3; edited.marks[2].focalLength = 85;
  assert.equal(compileShot(edited)(edited.marks[2].time).focalLength,85);
  assert.notDeepEqual(compileShot(edited)(edited.marks[2].time).position,compileShot(shot)(shot.marks[2].time).position);
  for (const value of [NaN, Infinity, 0, -1, 61]) assert.throws(()=>generateShot(snapshot,{...settings,duration:value}));
  for (const value of [NaN, Infinity, 0, 301]) assert.throws(()=>generateShot(snapshot,{...settings,focalLength:value}));
  console.log('Camera engine: 39 presets, optics, bounds, aim, mark edits, deterministic seeking, duration limits passed.');
} finally { rmSync(dir, { recursive: true, force: true }); }
