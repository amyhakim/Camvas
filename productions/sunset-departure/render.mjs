import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const mode=process.argv[2]||'blocking';
const base=resolve('productions/sunset-departure');
const width=mode==='final'?1920:mode==='platform'?1440:960,height=mode==='final'?1080:mode==='platform'?1000:540;
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR: '+e.message);});page.on('console',msg=>{if(msg.type()==='error')console.log(msg.text());});
try{
 if(mode==='platform'){
  const checks={};
  await page.goto('http://localhost:3000/');
  await page.getByRole('link',{name:'Last Light cinematic'}).waitFor();checks.homeLink=true;
  await page.locator('a').filter({has:page.getByRole('heading',{name:'Last Light',exact:true})}).waitFor();checks.savedProjectCard=true;
  await page.getByRole('heading',{name:'Last Light',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:resolve(base,'delivery/platform-project-library.png')});
  await page.locator('a').filter({has:page.getByRole('heading',{name:'Last Light',exact:true})}).click();
  await page.waitForURL(/project=last-light-cinematic/);checks.namedProject=true;
  await page.waitForSelector('canvas[data-ready="true"]',{timeout:120000});
  console.log('Native ready '+await page.locator('canvas').first().evaluate(e=>JSON.stringify(e.dataset)));
  await page.getByRole('radio',{name:'Camera view',exact:true}).check();
  await page.getByLabel('Active camera',{exact:true}).selectOption('last-light:camera');
  await page.getByRole('slider',{name:/^(Timeline frame|Playback progress)$/}).fill('181');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.frame==='181');
  await page.waitForFunction(()=>Number(document.querySelector('canvas')?.dataset.drawCalls)>100);
  await page.waitForTimeout(2000);
  console.log('Native at frame 181 '+await page.locator('canvas').first().evaluate(e=>JSON.stringify(e.dataset)));
  await page.screenshot({path:resolve(base,'delivery/platform-editor.png')});checks.nativeScene=true;
  await page.getByRole('slider',{name:/^(Timeline frame|Playback progress)$/}).fill('391');
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.frame==='391');
  await page.waitForTimeout(1000);
  await page.screenshot({path:resolve(base,'delivery/platform-driving.png')});checks.nativeTimeline=true;
  await page.goto('http://localhost:3000/cinematics/last-light?view=scene');
  const live=page.frameLocator('iframe');await live.locator('canvas').waitFor();
  await live.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(1200);
  await live.getByRole('button',{name:'Pause',exact:true}).click();
  checks.livePlayback=Number(await live.locator('#seek').inputValue())>.3;
  await page.screenshot({path:resolve(base,'delivery/platform-live-scene.png')});
  await page.goto('http://localhost:3000/cinematics/last-light');
  const playback=await page.evaluate(async()=>{
   const v=document.querySelector('video');v.muted=true;
   await v.play();await new Promise((resolve,reject)=>{v.onended=resolve;v.onerror=()=>reject(Error('Video playback failed'));setTimeout(()=>reject(Error('Video playback timed out')),25000);});
   return {duration:v.duration,width:v.videoWidth,height:v.videoHeight,ended:v.ended,frames:v.getVideoPlaybackQuality().totalVideoFrames,dropped:v.getVideoPlaybackQuality().droppedVideoFrames};
  });checks.playback=playback;
  await page.screenshot({path:resolve(base,'delivery/platform-finished-film.png')});
  await writeFile(resolve(base,'delivery/platform-verification.json'),JSON.stringify({url:'http://localhost:3000/cinematics/last-light',checks,errors},null,2));
  console.log(JSON.stringify({checks,errors}));
  if(errors.length||!checks.livePlayback||!playback.ended||playback.width!==1920||playback.height!==1080||playback.duration!==15)throw Error('Platform verification failed');
 }else{
 await page.goto('http://localhost:3000/films/last-light/index.html?capture');
 await page.waitForFunction(()=>window.productionReady,{timeout:60000});
 await page.evaluate(()=>document.fonts.ready);
 if(mode==='export'){
  const result=await page.evaluate(async()=>{
   const {exportGLB}=await import('./export-glb.js');const data=exportGLB();
   let binary='';for(let i=0;i<data.bytes.length;i+=16384)binary+=String.fromCharCode(...data.bytes.subarray(i,i+16384));
   return {base64:btoa(binary),nodes:data.nodes,meshes:data.meshes,channels:data.channels};
  });
  await writeFile(resolve('public/scenes/last-light.glb'),Buffer.from(result.base64,'base64'));
  console.log(JSON.stringify({nodes:result.nodes,meshes:result.meshes,channels:result.channels}));
  process.exitCode=0;
 }else{
 const out=resolve(base,mode==='final'?'frames':'preview');await mkdir(out,{recursive:true});
 const frames=mode==='stills'?[0,48,78,96,110,125,140,155,167,180,192,216,240,288,336,359]:Array.from({length:mode==='final'?360:180},(_,i)=>i*(mode==='final'?1:2));
 const states=[];
 for(let i=0;i<frames.length;i++){
  const state=await page.evaluate(frame=>window.renderFrame(frame),frames[i]);states.push(state);
  await page.screenshot({path:resolve(out,mode==='stills'?`still-${String(frames[i]).padStart(3,'0')}.png`:`${String(i).padStart(4,'0')}.png`),timeout:60000});
  if(i%24===0)console.log(`${mode}: ${i+1}/${frames.length} time=${state.time.toFixed(2)} shot=${state.shot}`);
 }
 await writeFile(resolve(base,`${mode}-audit.json`),JSON.stringify({mode,width,height,errors,states},null,2));
 if(errors.length)throw new Error(errors.join('\n'));
 console.log('Completed '+mode);
 }
 }
}catch(error){await page.screenshot({path:resolve(base,'delivery/check-failure.png')});console.log((await page.locator('body').innerText()).slice(-3500));throw error;}finally{await browser.close();}
