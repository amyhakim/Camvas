import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const out='cinematics/greenhouse/output';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const key='showcam-project:item:v1:a-little-tending';
const ready=()=>page.waitForSelector('canvas[data-ready="true"]',{timeout:180000});
try{
 await page.goto('http://localhost:3000/');
 const card=page.getByRole('link').filter({has:page.getByRole('heading',{name:'A Little Tending',exact:true})});
 await expect(card).toHaveCount(1);await card.click();await ready();
 assert.match(page.url(),/editor\?scene=hozy-greenhouse&project=a-little-tending/);
 const canvas=page.locator('canvas');
 assert.ok(Number(await canvas.getAttribute('data-splats'))>0);
 assert.equal(await page.locator('iframe').count(),0);
 console.log('Native editor and splat loaded');
 await page.getByRole('radio',{name:'Explore',exact:true}).check();
 const before=await canvas.getAttribute('data-camera-position');
 await page.mouse.move(740,480);await page.mouse.down();await page.mouse.move(790,500,{steps:8});await page.mouse.up();
 await expect(canvas).not.toHaveAttribute('data-camera-position',before);
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.getByText('Scene objects',{exact:true}).click();
 const environment=page.locator('.object-row').filter({hasText:'Greenhouse Gaussian environment'});
 await environment.focus();await environment.press('Enter');
 await expect(environment).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Edit details',exact:true}).click();
 await page.screenshot({path:`${out}/native-editor.png`});
 console.log('Orbit and environment selection passed');
 const x=page.getByLabel('X offset',{exact:true});
 await x.fill('0.2');await x.press('Enter');
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).scenes[0].document.placements?.[0]?.offset[0]===.2,key);
 await page.reload();await ready();
 assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).scenes[0].document.placements[0].offset[0],key),.2);
 await page.goto('http://localhost:3000/cinematics/greenhouse');await ready();
 assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).scenes[0].document.placements[0].offset[0],key),.2);
 assert.deepEqual(errors,[]);
 const report={url:page.url(),nativeEditor:true,gaussianCount:Number(await canvas.getAttribute('data-splats')),orbit:true,environmentSelection:true,placementEditPersisted:true,legacyLinkPreservesEdits:true,errors};
 await writeFile(`${out}/native-editor-check.json`,JSON.stringify(report,null,2));console.log(report);
}catch(error){await page.screenshot({path:`${out}/native-editor-failure.png`});throw error;}
finally{await browser.close();}
