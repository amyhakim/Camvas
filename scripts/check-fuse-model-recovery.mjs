import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const document=JSON.parse(await readFile('productions/fuse-warmup/native-project.json','utf8'));
document.name='FUSE preserved user edit';
document.actors[0].model.uid=process.env.CURRENT_MODEL?document.actors[0].model.uid:'local-2d752d0c9fb75931e67afad7';
document.actors[0].name='My instructor';
const saved={format:'showcam-collection',version:1,name:document.name,scenes:[{id:'scene:fuse',name:'My gym scene',document}]};
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],modelRequests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/films/fuse-warmup/instructor.glb'))modelRequests.push(r.status());});
 await page.addInitScript(saved=>{localStorage.setItem('showcam-project:item:v1:fuse-warmup',JSON.stringify(saved));},saved);
 await page.goto('http://localhost:3000/editor?scene=fuse-gym&project=fuse-warmup&entry=scene%3Afuse');
 await page.waitForSelector('canvas[data-ready="true"]',{timeout:180000});
 if(process.env.EXPECT_MISSING){await page.getByText('This model was imported on another computer or browser. Import the .glb here to show it.',{exact:true}).first().waitFor({timeout:30000});console.log('Reproduced: saved earlier FUSE model ID fails in a fresh browser.');}
 else{
  await page.getByText('1 / 1 models ready',{exact:false}).waitFor({timeout:30000});
  assert.equal(await page.getByText(/This model was imported on another computer/).count(),0);
  const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('showcam-project:item:v1:fuse-warmup')));
  assert.deepEqual(actual,saved);assert.ok(modelRequests.includes(200));assert.deepEqual(errors,[]);
  await page.getByRole('slider',{name:/^(Timeline frame|Playback progress)$/}).fill('193');await page.waitForTimeout(800);
  await page.screenshot({path:'productions/fuse-warmup/output/editor-model-recovered.png'});
  const report={uid:document.actors[0].model.uid,freshBrowser:true,modelReady:true,savedEditsPreserved:true,modelRequests,errors};
  await writeFile(`productions/fuse-warmup/output/model-recovery${process.env.CURRENT_MODEL?'-current':''}.json`,JSON.stringify(report,null,2));console.log(report);
 }
}finally{await browser.close();}
