import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = process.env.SHOWCAM_URL || 'http://localhost:3000';
const dir = '.impeccable/review';
await mkdir(dir, { recursive: true });
const manifest = JSON.parse(await readFile('public/scenes/pavilion.json', 'utf8'));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
const findings = [];
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas');
const pose = async () => (await canvas.getAttribute('data-camera-position')).split(',').map(Number);
const rotation = async () => await canvas.getAttribute('data-camera-rotation');
const distance = (a,b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v-b[i])**2, 0));
async function ready() {
  await page.waitForSelector('canvas[data-ready="true"]', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function frame(value) {
  await page.getByLabel('Timeline frame', { exact: true }).fill(String(value));
  await page.waitForFunction(frame => document.querySelector('canvas')?.dataset.frame === String(frame), value);
}
async function audit(name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  findings.push({name,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))});
}
async function capture(name) {
  await ready();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: no horizontal overflow`);
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
}

try {
  await page.goto(base);
  await ready();
  assert.equal(await page.locator('.live-canvas img').count(), 0, 'Live viewport has no reference-image backdrop');
  await capture('live-desktop');
  await audit('live-desktop'); console.log('Loaded and audited');
  // A real orbit changes the rendered camera pose.
  const initial = await pose();
  await page.mouse.move(700,420); await page.mouse.down(); await page.mouse.move(805,460,{steps:10}); await page.mouse.up();
  await page.waitForFunction(initial => { const p=document.querySelector('canvas')?.dataset.cameraPosition?.split(',').map(Number); return p && Math.abs(p[0]-initial[0])>.1; },initial);
  console.log('Orbit moved'); const orbited = await pose(); assert.ok(distance(initial,orbited)>.1);
  // Scroll zoom changes distance, not a still image transform.
  await page.mouse.wheel(0,-220);
  await page.waitForFunction(before => document.querySelector('canvas')?.dataset.cameraPosition !== before,orbited.map(v=>v.toFixed(4)).join(','));
  console.log('Zoom moved');
  // Real raycast selection in the clear center of the viewport.
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await ready();
  await page.mouse.click(705,540);
  await page.waitForFunction(() => document.querySelector('.inspector-identity h3')?.textContent !== 'Camera.002');
  console.log('Object clicked'); const picked = await page.locator('.inspector-identity h3').textContent();
  assert.ok(picked,'Raycast selected a real entity');
  await page.getByRole('button',{name:'Frame selected object',exact:true}).click();
  await page.waitForFunction(before => document.querySelector('canvas')?.dataset.cameraPosition !== before,initial.map(v=>v.toFixed(4)).join(','));
  // Once framed, selecting another entity must leave navigation under user control.
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.waitForFunction(expected => document.querySelector('canvas')?.dataset.cameraPosition === expected,initial.map(v=>v.toFixed(4)).join(','));
  const resetPose = await pose();
  await page.locator('.object-row').filter({hasText:'Camera.001'}).click();
  await ready();
  assert.ok(distance(await pose(),resetPose)<.002,'Selection does not re-run an earlier frame command');
  // Validate imported animation against source Blender samples at multiple times.
  await page.getByLabel('Shot camera',{exact:true}).selectOption('Camera.002');
  console.log('Shot selected'); const source = manifest.objects.find(o=>o.id==='Camera.002');
  const samples=[];
  for(const number of [1,125,250,374]) {
    await frame(number);
    const actual=await pose();
    const p=source.samples[Math.min(number-1,249)].position;
    const expected=[p[0],p[2],-p[1]];
    assert.ok(distance(actual,expected)<.002,`Blender frame ${number} matches: ${actual} vs ${expected}`);
    samples.push({frame:number,actual,expected});
  }
  await capture('live-shot');
  await frame(125);
  await frame(1);
  assert.ok(distance(await pose(),samples[0].expected)<.002,'Backward scrubbing restores the camera');
  await page.getByRole('button',{name:'Play timeline',exact:true}).click();
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.frame)>6);
  await page.getByRole('button',{name:'Pause timeline',exact:true}).click();
  assert.ok(distance(await pose(),samples[0].expected)>.01,'Playback moves the shot camera');
  // Fly mode supports both keyboard translation and pointer look.
  await page.getByRole('radio',{name:'Fly',exact:true}).check();
  await canvas.focus();
  const flyStart=await pose();
  await page.keyboard.down('KeyW');
  await page.waitForFunction(before => {const p=document.querySelector('canvas')?.dataset.cameraPosition?.split(',').map(Number);return p && Math.sqrt(p.reduce((sum,v,i)=>sum+(v-before[i])**2,0))>.15},flyStart);
  await page.keyboard.up('KeyW');
  const beforeLook=await rotation();
  await page.mouse.move(700,420); await page.mouse.down(); await page.mouse.move(745,438,{steps:8}); await page.mouse.up();
  assert.notEqual(await rotation(),beforeLook,'Fly pointer look rotates the camera');
  const beforeTouch=await pose();
  const moveButton=page.getByRole('button',{name:'Move forward',exact:true});
  await moveButton.hover(); await page.mouse.down();
  await page.waitForFunction(before => {const p=document.querySelector('canvas')?.dataset.cameraPosition?.split(',').map(Number);return p && Math.sqrt(p.reduce((sum,v,i)=>sum+(v-before[i])**2,0))>.08},beforeTouch);
  await page.mouse.up();
  await capture('live-fly');
  await page.getByRole('button',{name:'Reset view',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.goto(base); await ready();
  await capture('live-mobile'); await audit('live-mobile');
  await page.getByRole('radio',{name:'Fly',exact:true}).check();
  await capture('live-mobile-fly');
  await page.setViewportSize({width:1280,height:800});
  await page.goto(base); await ready();
  await capture('live-compact');
  assert.ok(await page.evaluate(()=>document.querySelector('.inspector').getBoundingClientRect().bottom < document.querySelector('.timeline-position').getBoundingClientRect().top),'Panels do not overlap');
  for (const mode of ['Orbit','Fly']) {
    await page.getByRole('radio',{name:mode,exact:true}).check();
    assert.ok(await page.evaluate(()=>Array.from(document.querySelectorAll('.side-panel')).every(panel=>panel.getBoundingClientRect().bottom+8 <= document.querySelector('.navigation-caption').getBoundingClientRect().top)),'Navigation captions stay below both panels');
    if (mode === 'Fly') await capture('live-compact-fly');
  }
  const report={raycastSelection:picked,animationSamples:samples,orbit:'passed',zoom:'passed',flyMovement:'passed',flyLook:'passed',movementButtons:'passed',errors,accessibility:findings};
  await writeFile(`${dir}/live-audit.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.deepEqual(errors,[],'No runtime errors');
  assert.equal(findings.flatMap(f=>f.violations).length,0,'No axe WCAG A/AA violations');
} finally { await browser.close(); }
