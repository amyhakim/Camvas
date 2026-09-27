import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
const results = [];
const exportOnly = process.argv.includes('--export-only');
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
 await mkdir('/private/tmp/flythru-30fps', { recursive: true });
 await page.addInitScript(() => { const capture = HTMLCanvasElement.prototype.captureStream; HTMLCanvasElement.prototype.captureStream = function(fps) { window.captureFps = fps; return capture.call(this, fps); }; });
 for (const scene of (exportOnly ? ['pavilion-v1'] : ['pavilion-v1', 'residence-9d09ab82'])) {
  await page.goto(`http://localhost:3000/editor?scene=${scene}`);
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 120000 });
  await expect(page.locator('.timeline-readout')).toContainText('30 fps');
  const group = page.getByRole('group', { name: 'Blockout comparison' });
  if (scene.startsWith('residence')) {
   await group.getByRole('button', { name: 'Fit splat blocks', exact: true }).click();
   await page.waitForFunction(() => Number(document.querySelector('canvas').dataset.blockoutBlocks) > 0, { timeout: 180000 });
  }
  for (const mode of (exportOnly ? [] : ['Blocks', 'Original'])) {
   await group.getByRole('button', { name: mode, exact: true }).click();
   await page.locator('canvas').focus();
   await page.keyboard.down('ArrowRight');
   const sample = await page.evaluate(() => new Promise(resolve => {
    const times = []; let previous = performance.now(); const start = previous;
    function tick(now) { if (now - start > 2000) times.push(now - previous); previous = now;
     if (now - start < 8000) requestAnimationFrame(tick);
     else { times.sort((a,b) => a-b); resolve({ fps: 1000 / (times.reduce((a,b)=>a+b,0)/times.length), p95ms: times[Math.floor(times.length*.95)], telemetry: {...document.querySelector('canvas').dataset} }); }
    } requestAnimationFrame(tick);
   }));
   await page.keyboard.up('ArrowRight');
   results.push({ scene, mode, fps: sample.fps, p95ms: sample.p95ms, renderFps: sample.telemetry.renderFps, renderScale: sample.telemetry.renderScale, renderer: sample.telemetry.renderer });
   console.log(JSON.stringify(results.at(-1)));
   await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  }
  if (scene === 'pavilion-v1') {
   await page.getByRole('button', { name: 'Export', exact: true }).click();
   await expect(page.getByRole('complementary', { name: 'Video export' })).toContainText('30 fps');
   const download = page.waitForEvent('download', { timeout: 60000 });
   await page.getByRole('button', { name: 'Export video', exact: true }).click();
   await (await download).saveAs('/private/tmp/flythru-30fps/export.webm');
   assert.equal(await page.evaluate(() => window.captureFps), 0, 'Capture requests are paced after rendering at the 30 FPS timeline rate');
  }
 }
 await mkdir('/private/tmp/flythru-30fps', { recursive: true });
 if (!exportOnly) await writeFile(`/private/tmp/flythru-30fps/${process.env.CHECK_LABEL || 'result'}.json`, JSON.stringify(results,null,2));
} finally { await browser.close(); }
