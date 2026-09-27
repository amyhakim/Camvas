import {chromium} from '@playwright/test';
import {readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const dir=resolve('productions/fuse-warmup');
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--no-sandbox']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e)});page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
try{
 await page.goto('http://localhost:3000/fuse-warmup/index.html'+(process.env.FUSE_ASSET?'?asset='+process.env.FUSE_ASSET:''));
 await page.waitForFunction(()=>window.ready,{},{timeout:180000});
 await page.locator('[data-ui]').evaluateAll(els=>els.forEach(e=>e.style.display='none'));
 if(process.argv[2]==='survey'){
  const views=[[[0,0,3],[0,0,-3]],[[0,0,-3],[0,0,3]],[[0,0,0],[3,0,0]],[[0,0,0],[-3,0,0]]];
  for(let i=0;i<views.length;i++){await page.evaluate(v=>window.setView(...v),views[i]);await page.waitForTimeout(1500);await page.screenshot({path:`${dir}/preview/survey-${i}.jpg`});}
 }else if(['preview','final'].includes(process.argv[2])){
  const final=process.argv[2]==='final',fps=final?24:12,width=final?1920:1280,height=final?1080:720,name=final?'fuse-warmup':'blocking-preview';
  await page.setViewportSize({width,height});await page.evaluate(([w,h])=>app.setCanvasResolution(pc.RESOLUTION_FIXED,w,h),[width,height]);
  const encoder=spawn('ffmpeg',['-hide_banner','-loglevel','warning','-y','-f','image2pipe','-framerate',String(fps),'-i','pipe:0','-i',`${dir}/assets/music-final.wav`,'-map','0:v:0','-map','1:a:0','-c:v','libx264','-preset','slow','-crf',final?'17':'22','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-ar','48000','-t','15','-movflags','+faststart','-metadata','title=FUSE — Warm welcome','-metadata','comment=Gym: Immersive Lens / CC BY 4.0. Original procedural instructor and original 110 BPM score.',`${dir}/output/${name}.partial.mp4`],{stdio:['pipe','ignore','inherit']});
  const done=once(encoder,'close');const audit=[];
  for(let i=0;i<15*fps;i++){
   const t=i/fps;
   const pose=await page.evaluate(t=>window.setTime(t),t);
   await page.waitForTimeout(final?85:70);
   await page.evaluate(()=>new Promise(r=>app.once('frameend',()=>app.once('frameend',r))));
   const frame=await page.screenshot({type:'png'});
   if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');
   const bounds=await page.evaluate(()=>{let min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const c of instructor.root.findComponents('render'))for(const mi of c.meshInstances){const b=mi.aabb;for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const p=new pc.Vec3(b.center.x+x*b.halfExtents.x,b.center.y+y*b.halfExtents.y,b.center.z+z*b.halfExtents.z);const s=camera.camera.worldToScreen(p);min=[Math.min(min[0],s.x),Math.min(min[1],s.y)];max=[Math.max(max[0],s.x),Math.max(max[1],s.y)];}}return {min,max,camera:camera.getPosition().toArray()};});
   audit.push({frame:i,time:t,...pose,...bounds});
   if(i%fps===0){console.log(`${name}: ${i}/${15*fps}`);await writeFile(`${dir}/preview/${name}-${String(i/fps).padStart(2,'0')}.png`,frame);}
   if(final&&i===32)await writeFile(`${dir}/output/preview-frame.png`,frame);
  }
  encoder.stdin.end();const [code]=await done;if(code!==0)throw Error('FFmpeg failed '+code);
  await rename(`${dir}/output/${name}.partial.mp4`,`${dir}/output/${name}.mp4`);
  await writeFile(`${dir}/output/${name}-audit.json`,JSON.stringify({fps,width,height,errors,frames:audit},null,2));
  console.log('Export complete');
 }else if(process.argv[2]==='blocking'){
  for(const t of [0,1.4,4.5,6.35,9.4,13.5]){await page.evaluate(t=>window.setTime(t),t);await page.waitForTimeout(700);await page.screenshot({path:`${dir}/preview/blocking-${t}.jpg`});}
 }else{
  const config=JSON.parse(await readFile(`${dir}/views.json`,'utf8'));
  for(let i=0;i<config.length;i++){await page.evaluate(v=>window.setView(...v),config[i]);await page.waitForTimeout(1000);await page.screenshot({path:`${dir}/preview/view-${i}.jpg`});}
 }
}finally{await browser.close();}
