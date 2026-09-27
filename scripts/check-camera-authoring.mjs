import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const base = `${(process.env.SHOWCAM_URL || 'http://localhost:3000').split('?')[0]}/?scene=pavilion-v1`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const dir = `${process.env.SHOWCAM_ARTIFACT_DIR || '.impeccable/review'}/camera-authoring`; await mkdir(dir,{recursive:true});
const canvas = page.locator('canvas');
const pose = () => canvas.getAttribute('data-camera-position');
async function ready() { await page.waitForSelector('canvas[data-ready="true"]',{timeout:60000}); await page.evaluate(()=>document.fonts.ready); }
async function seek(frame) { await page.getByLabel('Timeline frame',{exact:true}).fill(String(frame)); await page.waitForFunction(f=>document.querySelector('canvas')?.dataset.frame === String(f),frame); }
async function capture(name) {
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});
}
async function pathFits() {
  await page.waitForFunction(() => {
    const canvas=document.querySelector('canvas');
    if (!canvas?.dataset.pathScreenBounds) return false;
    const p=JSON.parse(canvas.dataset.pathScreenBounds), rect=canvas.getBoundingClientRect();
    return p.left*rect.width+rect.left > document.querySelector('.object-browser').getBoundingClientRect().right
      && p.right*rect.width+rect.left < document.querySelector('.inspector').getBoundingClientRect().left
      && p.bottom*rect.height+rect.top < document.querySelector('.timeline-position').getBoundingClientRect().top
      && p.top*rect.height+rect.top > document.querySelector('.viewport-tools').getBoundingClientRect().bottom;
  });
}
const audits=[];
try {
  await page.goto(base); await ready();
  await page.getByRole('button',{name:'Show details',exact:true}).click();
  await page.getByRole('button',{name:'Edit details',exact:true}).click();
  await page.getByRole('button',{name:'Camera move',exact:true}).click();
  await page.getByRole('radio',{name:'Shot',exact:true}).check();
  await expect(page.getByRole('button',{name:'Generate move',exact:true})).toBeDisabled();
  await page.getByRole('combobox',{name:'Subject',exact:true}).selectOption('Group');
  await page.getByRole('combobox',{name:'Camera move',exact:true}).selectOption('orbit-90-left');
  await page.getByRole('button',{name:'Generate move',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.cameraSource==='showcam:authored');
  assert.equal(await page.getByLabel('Shot camera',{exact:true}).inputValue(),'showcam:authored');
  console.log('Generated draft');
  const start = await pose(); await seek(73); const middle = await pose(); await seek(145); const end = await pose();
  assert.notEqual(start,middle); assert.notEqual(middle,end);
  await seek(1); assert.equal(await pose(),start,'Backward seeking returns to identical draft pose');
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.frame)>5);
  await page.getByRole('button',{name:'Pause timeline',exact:true}).click();
  await seek(1);
  console.log('Playback and scrubbing verified');
  await page.getByText('Edit camera marks',{exact:true}).click();
  await page.getByRole('combobox',{name:'Camera mark',exact:true}).selectOption('2');
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.frame) > 1);
  const markFrame=Number(await canvas.getAttribute('data-frame'));
  const originalMark=await pose();
  const originalX=Number(await page.getByLabel('X · m',{exact:true}).inputValue());
  await page.getByLabel('X · m',{exact:true}).fill(String(originalX+2));
  await page.waitForFunction(before=>document.querySelector('canvas')?.dataset.cameraPosition!==before,originalMark);
  assert.equal(Number(await canvas.getAttribute('data-frame')),markFrame);
  await page.getByLabel('Mark lens · mm',{exact:true}).fill('85');
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.cameraFov)<15);
  await page.getByRole('checkbox',{name:'Keep subject centered'}).uncheck();
  await expect(page.getByLabel('pan · °',{exact:true})).toBeEnabled();
  await page.getByText('Edit camera marks',{exact:true}).click();
  await page.getByLabel('Duration · s',{exact:true}).fill('0');
  await page.getByRole('button',{name:'Regenerate move',exact:true}).click();
  await expect(page.locator('.shot-authoring').getByRole('alert')).toContainText('Duration must');
  await page.getByLabel('Duration · s',{exact:true}).fill('20');
  await page.getByRole('button',{name:'Regenerate move',exact:true}).click();
  assert.equal(await page.getByLabel('Timeline frame',{exact:true}).getAttribute('max'),'481');
  await seek(481); assert.notEqual(await pose(),start);
  // The original Blender clip remains independently selectable and bit-for-bit sourced from the GLB.
  await page.getByLabel('Shot camera',{exact:true}).selectOption('Camera.002'); await seek(125);
  const manifest=JSON.parse(await readFile('public/scenes/pavilion.json','utf8'));
  const p=manifest.objects.find(o=>o.id==='Camera.002').samples[124].position;
  const actual=(await pose()).split(',').map(Number), expected=[p[0],p[2],-p[1]];
  assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<.002),'Imported Blender camera preserved');
  await page.getByLabel('Shot camera',{exact:true}).selectOption('showcam:authored');
  await page.getByRole('combobox',{name:'Subject',exact:true}).selectOption('Group');
  await page.getByLabel('Duration · s',{exact:true}).fill('6');
  await page.getByRole('button',{name:'Regenerate move',exact:true}).click();
  await expect(page.locator('.shot-error')).toHaveCount(0);
  await expect(page.locator('.draft-clip .clip-duration')).toHaveText('6 s');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.frame==='1');
  await page.getByRole('button',{name:'Path',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Flight path'})).toBeVisible();
  await page.getByRole('button',{name:'Show in scene',exact:true}).click();
  await expect(page.getByRole('radio',{name:'Explore',exact:true})).toBeChecked();
  await page.locator('.inspector').evaluate(el=>el.scrollTop=0);
  await pathFits();
  await capture('desktop');
  audits.push({name:'desktop',violations:(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations});
  await page.setViewportSize({width:1280,height:720}); await pathFits(); await capture('compact');
  assert.ok(await page.evaluate(()=>document.querySelector('.inspector').getBoundingClientRect().bottom < document.querySelector('.timeline-position').getBoundingClientRect().top),'Inspector stays above timeline');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('combobox',{name:'Subject',exact:true}).selectOption('Group.001');
  await page.getByRole('button',{name:'Regenerate move',exact:true}).click();
  await expect(page.locator('.inspector')).toHaveCount(0);
  await page.getByRole('button',{name:'Show details',exact:true}).click();
  await page.getByRole('button',{name:'Edit details',exact:true}).click();
  await page.getByRole('button',{name:'Camera move',exact:true}).click();
  await expect(page.locator('.shot-draft > p')).toContainText('Group.001');
  await page.locator('.inspector').evaluate(el=>el.scrollTop=0);
  await capture('mobile-editor');
  await page.getByRole('button',{name:'Preview',exact:true}).click();
  await expect(page.locator('.inspector')).toHaveCount(0);
  await page.getByRole('button',{name:'Pause timeline',exact:true}).click();
  await seek(1);
  await capture('mobile');
  audits.push({name:'mobile',violations:(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations});
  await page.getByRole('button',{name:'Show details',exact:true}).click();
  await page.getByRole('button',{name:'Edit details',exact:true}).click();
  await page.getByRole('button',{name:'Camera move',exact:true}).click();
  await page.getByRole('button',{name:'Discard draft',exact:true}).click();
  assert.equal(await page.getByLabel('Shot camera',{exact:true}).inputValue(),'Camera.002');
  assert.equal(await page.locator('.draft-clip').count(),0);
  await writeFile(`${dir}/audit.json`,JSON.stringify({errors,audits,checks:['subject bounds','generate','scrub','play','mark edits','lens','tracking','invalid duration','long duration','Blender source preserved','path toggle','mobile generation','discard']},null,2));
  assert.deepEqual(errors,[],'No runtime errors');
  assert.ok(audits.every(a=>a.violations.length===0),'Accessibility checks pass');
  console.log('Camera authoring: all interaction and accessibility checks passed.');
} finally { await browser.close(); }
