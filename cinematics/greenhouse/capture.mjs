import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const root=fileURLToPath(new URL('.',import.meta.url)).replace(/\/$/,'');
const mode=process.argv[2]||'scout';
const errors=[];const samples=[];
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:process.platform==='darwin'?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}),args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
try{
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});
const url=process.env.CINEMATIC_URL||'http://localhost:3000/greenhouse/index.html';
if(mode==='home'){
 await page.goto('http://localhost:3000/');
 const card=page.getByRole('link').filter({has:page.getByRole('heading',{name:'A Little Tending',exact:true})});
 await card.waitFor();await card.scrollIntoViewIfNeeded();
 await page.screenshot({path:`${root}/output/project-home.png`});
 await card.click();await page.waitForSelector('canvas[data-ready="true"]',{timeout:180000});
 const iframe=await page.locator('iframe').count();
 const report={url:page.url(),cardVisible:true,iframe,errors};
 if(iframe!==0||!page.url().includes('scene=hozy-greenhouse')||errors.length)throw new Error('Home project navigation failed');
 await writeFile(`${root}/output/home-check.json`,JSON.stringify(report,null,2));console.log(report);
}else if(mode==='playback'){
 await page.goto(url.replace('index.html','watch.html'));
 await page.waitForFunction(()=>document.querySelector('video').readyState>=2);
 const info=await page.evaluate(async()=>{const v=document.querySelector('video');v.muted=true;await v.play();return {duration:v.duration,width:v.videoWidth,height:v.videoHeight};});
 await page.waitForFunction(()=>document.querySelector('video').currentTime>8);
 await page.screenshot({path:`${root}/output/browser-playback.png`});
 await page.waitForFunction(()=>document.querySelector('video').ended,{},{timeout:60000});
 const end=await page.evaluate(()=>{const v=document.querySelector('video');return {time:v.currentTime,ended:v.ended,error:v.error,quality:v.getVideoPlaybackQuality().toJSON?.()||{totalVideoFrames:v.getVideoPlaybackQuality().totalVideoFrames,droppedVideoFrames:v.getVideoPlaybackQuality().droppedVideoFrames}}});
 await writeFile(`${root}/output/browser-playback.json`,JSON.stringify({url:page.url(),info,end,errors},null,2));
 console.log(JSON.stringify({info,end,errors}));
 if(info.duration!==15||info.width!==1920||info.height!==1080||!end.ended||end.error||errors.length)throw new Error('Browser playback verification failed');
}else{
await page.goto(url+'?capture');await page.waitForFunction(()=>window.ready,{},{timeout:180000});
await mkdir(`${root}/output`,{recursive:true});
if(mode==='scout'){
 await page.screenshot({path:`${root}/output/scout.png`});
 console.log(await page.evaluate(()=>({renderer:window.cine.app.graphicsDevice.renderer,project:[[-4,2,6],[0,2,6],[4,2,6],[4,2,2],[0,2,2]].map(p=>({p,screen:window.cine.project(p)}))})));
}else{
 const times=mode==='frames'?Array.from({length:360},(_,i)=>i/24):[0,4,5,6,7,8,9,10,11,12,13,14.958333];
 const encoder=mode==='frames'?spawn('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','image2pipe','-vcodec','png','-framerate','24','-i','pipe:0','-vf','fade=t=in:st=0:d=0.5,fade=t=out:st=14.4:d=0.6','-an','-c:v','libx264','-preset','slow','-crf','17','-pix_fmt','yuv420p','-r','24','-movflags','+faststart',`${root}/output/picture.mp4`],{stdio:['pipe','inherit','inherit']}):null;
 const encoded=encoder?once(encoder,'exit'):null;
 await mkdir(`${root}/output/${mode}`,{recursive:true});
 for(let i=0;i<times.length;i++){
  await page.evaluate(async t=>{window.cine.seek(t);await window.cine.settle();},times[i]);
  samples.push(await page.evaluate(t=>({time:t,...window.pose,camera:window.cine.camera.getPosition().toArray(),sourceMatrix:Array.from(window.cine.environment.getWorldTransform().data)}),times[i]));
  const png=await page.screenshot({type:'png'});
  if(encoder){if(!encoder.stdin.write(png))await once(encoder.stdin,'drain');if(i===216)await writeFile(`${root}/output/preview.png`,png);}
  else await writeFile(`${root}/output/${mode}/${String(i).padStart(4,'0')}.png`,png);
  if(i%24===0)console.log(`${i+1}/${times.length} at ${times[i]}s`);
 }
 if(encoder){encoder.stdin.end();const [code]=await encoded;if(code!==0)throw new Error('FFmpeg encoding failed: '+code);}
}
await writeFile(`${root}/output/${mode}-inspection.json`,JSON.stringify({url,errors,samples},null,2));
if(errors.length)throw new Error(errors.join('\n'));
}
}finally{await browser.close()}
