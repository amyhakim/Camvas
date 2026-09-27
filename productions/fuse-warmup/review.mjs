import {chromium} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='http://localhost:3000/fuse-warmup';
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 if(process.argv[2]==='home'){
  await page.goto('http://localhost:3000/');const card=page.getByRole('link',{name:'Open FUSE Warm Welcome gym project'});await card.waitFor();assert.equal(await card.getAttribute('href'),'/fuse-warmup/index.html');await card.scrollIntoViewIfNeeded();await page.screenshot({path:'productions/fuse-warmup/output/home-project.png'});console.log('FUSE · Warm Welcome is visible in Your projects on http://localhost:3000/');
 }else{
 const range=await page.request.get(base+'/output/fuse-warmup.mp4',{headers:{Range:'bytes=0-99'}});assert.equal(range.status(),206);assert.equal((await range.body()).length,100);
 const suffix=await page.request.get(base+'/output/fuse-warmup.mp4',{headers:{Range:'bytes=-64'}});assert.equal(suffix.status(),206);assert.equal((await suffix.body()).length,64);
 const bad=await page.request.get(base+'/output/fuse-warmup.mp4',{headers:{Range:'bytes=999999999999-'}});assert.equal(bad.status(),416);
 const unknown=await page.request.get(base+'/not-a-file.txt');assert.equal(unknown.status(),404);
 await page.goto(base+'/watch.html');await page.locator('video').evaluate(v=>new Promise((r,j)=>{if(v.readyState>=1)r();else{v.onloadedmetadata=r;v.onerror=j;}}));
 const before=await page.locator('video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight}));assert.deepEqual(before,{duration:15,width:1920,height:1080});
 await page.locator('video').evaluate(async v=>{await v.play()});await page.waitForFunction(()=>document.querySelector('video').ended,{},{timeout:30000});
 const playback=await page.locator('video').evaluate(v=>({ended:v.ended,time:v.currentTime,error:v.error?.message??null,muted:v.muted,volume:v.volume,quality:{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames,corruptedVideoFrames:v.getVideoPlaybackQuality().corruptedVideoFrames}}));
 assert.equal(playback.ended,true);assert.equal(playback.error,null);assert.equal(playback.time,15);assert.equal(errors.length,0);
 await page.locator('video').evaluate(v=>{v.currentTime=1.33});await page.waitForTimeout(400);await page.screenshot({path:'productions/fuse-warmup/output/local-player.png'});
 const report={url:base+'/watch.html',rangeRequests:'passed (prefix, suffix, unsatisfiable)',metadata:before,playback,errors};await writeFile('productions/fuse-warmup/output/browser-playback.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }
}finally{await browser.close();}
