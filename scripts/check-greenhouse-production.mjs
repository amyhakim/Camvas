import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const out='cinematics/greenhouse/output', key='showcam-project:item:v1:a-little-tending';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1600,height:1000}});page.setDefaultTimeout(30000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 window.audioStarts=[];
 const start=AudioBufferSourceNode.prototype.start;
 AudioBufferSourceNode.prototype.start=function(...args){window.audioStarts.push({duration:this.buffer?.duration,offset:args[1]??0});return start.apply(this,args);};
});
const canvas=page.locator('canvas');
const ready=()=>page.waitForSelector('canvas[data-ready="true"]',{timeout:180000});
const seek=async seconds=>{const frame=Math.round(seconds*30)+1;await page.getByRole('slider',{name:/^(Timeline frame|Playback progress)$/}).fill(String(frame));await expect(canvas).toHaveAttribute('data-frame',String(frame));await page.waitForTimeout(350);};
try{
 await page.goto('http://localhost:3000/');
 // Simulate the older incomplete starter with an existing user placement.
 await page.evaluate(k=>{
  localStorage.removeItem('showcam-greenhouse-production:v1');
  localStorage.setItem(k,JSON.stringify({format:'showcam-collection',version:1,name:'My greenhouse edit',scenes:[{id:'scene:greenhouse',name:'Hozy Greenhouse',document:{format:'showcam-project',version:1,sceneId:'hozy-greenhouse',name:'My greenhouse edit',shot:null,actors:[],placements:[{id:'greenhouse:capture',offset:[.01,0,0]}]}}]}));
 },key);
 await page.goto('http://localhost:3000/editor?scene=hozy-greenhouse&project=a-little-tending&entry=scene:greenhouse');await ready();
 await expect(canvas).toHaveAttribute('data-camera-source','showcam:authored');
 const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 assert.equal(saved.name,'My greenhouse edit');assert.deepEqual(saved.scenes[0].document.placements[0].offset,[.01,0,0]);
 assert.equal(saved.scenes[0].document.shot.settings.duration,15);assert.equal(saved.scenes[0].document.shot.marks.length,5);assert.equal(saved.scenes[0].document.audio[0].duration,15);
 const shots=[];
 for(const time of [0,4,7,9,11,13,15]){
  await seek(time);const camera=await canvas.getAttribute('data-camera-position');
  await page.getByRole('button',{name:'Focus view',exact:true}).click();await page.waitForTimeout(350);
  await page.screenshot({path:`${out}/native-production-${time}.png`});
  await page.getByRole('button',{name:'Focus view',exact:true}).click();
  shots.push({time,camera});
 }
 assert.notEqual(shots[0].camera,shots[2].camera);assert.equal(shots[2].camera,shots[3].camera);assert.notEqual(shots[3].camera,shots[6].camera);
 await page.getByRole('radio',{name:'Explore',exact:true}).check();
 await page.getByText('Scene objects',{exact:true}).click();
 const sprite=page.locator('.object-row').filter({hasText:'Garden sprite · animated avatar'});await sprite.focus();await sprite.press('Enter');
 await expect(sprite).toHaveAttribute('aria-pressed','true');
 await seek(0);const start=JSON.parse(await canvas.getAttribute('data-object-screen-positions')).find(o=>o.id==='greenhouse:sprite');
 await seek(7);const end=JSON.parse(await canvas.getAttribute('data-object-screen-positions')).find(o=>o.id==='greenhouse:sprite');
 assert.ok(Math.hypot(start.x-end.x,start.y-end.y)>.005,'Animated sprite must change position');
 await page.getByRole('button',{name:'Edit details',exact:true}).click();
 const x=page.getByLabel('X offset',{exact:true});await x.fill('0.12');await x.press('Enter');
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).scenes[0].document.placements.some(p=>p.id==='greenhouse:sprite'&&p.offset[0]===.12),key);
 await page.reload();await ready();
 const restored=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).scenes[0].document,key);assert.equal(restored.placements.find(p=>p.id==='greenhouse:sprite').offset[0],.12);
 const media=await page.evaluate(async()=>{const response=await fetch('/api/audio/builtin/greenhouse/file');const ctx=new AudioContext();const decoded=await ctx.decodeAudioData(await response.arrayBuffer());const data=decoded.getChannelData(0);const rms=Math.sqrt(data.reduce((s,x)=>s+x*x,0)/data.length);await ctx.close();return {status:response.status,duration:decoded.duration,rms};});
 assert.equal(media.status,200);assert.ok(Math.abs(media.duration-15)<.1&&media.rms>.001);
 await page.getByRole('button',{name:'Play timeline',exact:true}).click();await expect(canvas).not.toHaveAttribute('data-frame','1');await page.waitForFunction(()=>window.audioStarts.length>0);
 const audioStarts=await page.evaluate(()=>window.audioStarts);assert.ok(audioStarts.some(s=>Math.abs(s.duration-15)<.1));
 await page.getByRole('button',{name:'Pause timeline',exact:true}).click();
 await page.getByRole('button',{name:'Flight path',exact:true}).click();
 await expect(page.getByText('5 editable marks',{exact:false}).first()).toBeVisible();
 await page.screenshot({path:`${out}/native-flight-controls.png`});
 assert.deepEqual(errors,[]);
 const report={migrationPreservedEdits:true,animation:{start,end},cameraSamples:shots,placementSaved:true,audio:media,audioStarts,errors};
 await writeFile(`${out}/native-production-check.json`,JSON.stringify(report,null,2));console.log(report);
}catch(error){await page.screenshot({path:`${out}/native-production-failure.png`});console.log((await page.locator('body').innerText()).slice(-2200));throw error;}
finally{await browser.close();}
