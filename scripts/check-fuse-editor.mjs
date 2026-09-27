import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,ignoreDefaultArgs:['--mute-audio'],args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.audioProbes=[];const connect=AudioNode.prototype.connect;
 AudioNode.prototype.connect=function(destination,...args){if(destination instanceof AudioDestinationNode){const a=this.context.createAnalyser();connect.call(this,a);connect.call(a,destination);window.audioProbes.push(a);return destination;}return connect.call(this,destination,...args);};
});
try{
 await page.goto('http://localhost:3000/');
 const card=page.getByRole('link').filter({has:page.getByRole('heading',{name:'FUSE · Warm Welcome',exact:true})});
 await card.waitFor();const href=await card.getAttribute('href');assert.match(href,/^\/editor\?scene=fuse-gym&project=fuse-warmup/);await card.click();
 await page.waitForURL('**/editor?**');console.log('Opened native editor',page.url());
 await page.waitForSelector('canvas[data-ready="true"]',{timeout:180000});
 await page.waitForFunction(()=>document.querySelector('#shot-camera')?.value==='showcam:authored',{timeout:30000});
 await page.waitForTimeout(4000);
 assert.equal(await page.getByText(/no body parts could be identified/).count(),0);
 assert.equal(await page.locator('iframe').count(),0);
 const project=await page.evaluate(()=>JSON.parse(localStorage.getItem('showcam-project:item:v1:fuse-warmup')).scenes[0].document);
 assert.equal(project.actors.length,1);assert.equal(project.audio.length,1);assert.equal(project.shot.settings.duration,15);
 await page.screenshot({path:'productions/fuse-warmup/output/editor-opening.png'});
 console.log('Opening screenshot and project tracks',project.actors[0].model);
 const timeline=page.getByRole('slider',{name:/^(Timeline frame|Playback progress)$/});
 for(const [label,seconds] of [['wave',1.5],['squat-one',6.4],['squat-two',9.4],['thumbs-up',13.5]]){await timeline.fill(String(Math.round(seconds*30)+1));await page.waitForTimeout(900);await page.screenshot({path:`productions/fuse-warmup/output/editor-${label}.png`});}
 await timeline.fill('31');await page.getByRole('button',{name:'Play timeline',exact:true}).click();
 await page.waitForFunction(()=>window.audioProbes.some(a=>{const d=new Float32Array(a.fftSize);a.getFloatTimeDomainData(d);return d.some(x=>Math.abs(x)>.001);}),undefined,{timeout:20000});
 console.log('Music signal verified');
 await page.waitForFunction(()=>Number(document.querySelector('input[aria-label="Timeline frame"],input[aria-label="Playback progress"]')?.value)>=450,undefined,{timeout:45000});
 console.log('Full native timeline playback completed');
 const poses=await page.locator('canvas[data-ready="true"]').getAttribute('data-actor-poses');
 // Verify opening the same native project preserves user changes.
 await page.evaluate(()=>{const key='showcam-project:item:v1:fuse-warmup',p=JSON.parse(localStorage.getItem(key));p.name='FUSE saved edit';p.scenes[0].document.name=p.name;localStorage.setItem(key,JSON.stringify(p));});
 await page.goto('http://localhost:3000/');await page.getByRole('heading',{name:'FUSE saved edit',exact:true}).waitFor();
 const report={href,actors:project.actors.length,clip:project.actors[0].motions[0],cameraMarks:project.shot.marks.length,audio:project.audio[0].source.name,musicSignal:true,fullTimelinePlayback:true,savedEditsPreserved:true,poses:JSON.parse(poses),errors};
 await page.close();
 const fresh=await browser.newContext();const direct=await fresh.newPage();await direct.goto('http://localhost:3000'+href);await direct.waitForSelector('canvas[data-ready="true"]',{timeout:180000});await direct.waitForFunction(()=>document.querySelector('#shot-camera')?.value==='showcam:authored');assert.equal(await direct.getByText('Project assets could not load.').count(),0);report.freshDirectLink=true;await fresh.close();
 assert.deepEqual(errors,[]);await writeFile('productions/fuse-warmup/output/editor-verification.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
