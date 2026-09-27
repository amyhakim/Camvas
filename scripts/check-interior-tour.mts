import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { pavilionInteriorShot } from '../src/features/camera/pavilion-interior-shot';
import { pavilionDoorwayShot } from '../src/features/camera/pavilion-doorway-shot';
const doorway = process.argv.includes('--doorway');
const shot = doorway ? pavilionDoorwayShot() : pavilionInteriorShot();
const directory = doorway ? '/private/tmp/flythru-doorway-tour' : '/private/tmp/flythru-interior-tour';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(shot => localStorage.setItem('showcam-project:v1:pavilion-v1', JSON.stringify({ format: 'showcam-project', version: 1, sceneId: 'pavilion-v1', name: 'Interior tour test', shot, actors: [] })), shot);
  await page.route('**/api/flight-plan', route => route.fulfill({ status: 503, json: { error: 'Disabled for local test' } }));
  await page.goto('http://localhost:3000/editor?scene=pavilion-v1');
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 90000 });
  await page.getByRole('button', { name: 'Original', exact: true }).click();
  await page.locator('#shot-camera').selectOption('showcam:authored');
  await page.getByRole('button', { name: 'Path', exact: true }).click();
  await mkdir(directory, { recursive: true });
  for (const t of doorway ? [0, 6, 14, 20, 28, 36, 44] : [0, 5, 15, 22]) {
    await page.getByLabel('Flight progress', { exact: true }).fill(String(t));
    await page.getByRole('button', { name: 'Close flight path', exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${directory}/${t}.png` });
    await page.getByRole('button', { name: 'Path', exact: true }).click();
  }
  if (!doorway) await page.getByRole('button', { name: 'Optimize path', exact: true }).click();
  await page.waitForTimeout(1500);
  console.log(JSON.stringify({ errors, clearance: await page.getByRole('region', { name: 'Drone path overview' }).innerText() }));
} finally { await browser.close(); }
