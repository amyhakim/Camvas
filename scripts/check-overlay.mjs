import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const out=(process.env.SHOWCAM_ARTIFACT_DIR || '.impeccable/review');await mkdir(out,{recursive:true});
const results=[];
try {
  for(const [name,width,height] of [['overlay-desktop',1440,900],['overlay-compact',1280,720],['overlay-mobile',390,844]]) {
    await page.setViewportSize({width,height});
    await page.goto(process.env.SHOWCAM_URL || 'http://localhost:3000');
    await page.waitForSelector('canvas[data-ready=true]',{timeout:60000});
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.app-header').count(),0,'Viewer has no top bar');
    const box=await page.locator('.live-canvas').boundingBox();
    assert.deepEqual(box,{x:0,y:0,width,height},'Scene fills the viewport');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight || document.documentElement.scrollWidth>innerWidth),false,'No page overflow');
    await page.screenshot({path:`${out}/${name}.png`});
    if(width<800) {
      assert.equal(await page.locator('.inspector').count(),0,'Mobile begins with unobstructed scene');
      await page.getByRole('button',{name:'Show inspector',exact:true}).click();
      const inspector=await page.locator('.inspector').boundingBox();
      const timeline=await page.locator('.timeline').boundingBox();
      assert.ok(inspector.height>200 && inspector.y+inspector.height<timeline.y,'Mobile inspector is readable above timeline');
      await page.screenshot({path:`${out}/${name}-inspector.png`});
      await page.getByRole('button',{name:'Show inspector',exact:true}).click();
    }
    const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    results.push({name,violations:a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))});
    console.log(`${name} checked`);
  }
  await page.getByRole('button',{name:'Reduce glass transparency',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-transparency'),'reduced');
  await page.getByRole('button',{name:'Enable glass transparency',exact:true}).click();
  assert.equal(await page.locator('html').getAttribute('data-transparency'),'full');
  await page.getByRole('link',{name:'Design system',exact:true}).click();
  await page.waitForURL('**/design-system');
  assert.deepEqual(errors,[]);
  assert.equal(results.flatMap(r=>r.violations).length,0);
  await writeFile(`${out}/overlay-audit.json`,JSON.stringify({errors,results},null,2));
  console.log(JSON.stringify({errors,results},null,2));
} finally {await browser.close();}
