import * as pc from './vendor/playcanvas.mjs';
import {buildGarden} from './garden.mjs';
const canvas=document.querySelector('canvas');
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:false,preserveDrawingBuffer:true,deviceTypes:['webgl2']}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.scene.ambientLight=new pc.Color(.56,.59,.50);
app.scene.gsplat.splatBudget=2000000;
const camera=new pc.Entity('Cinematic camera');camera.addComponent('camera',{fov:36,nearClip:.1,farClip:200,clearColor:new pc.Color(.5568627,.7058824,.7058824)});camera.camera.toneMapping=pc.TONEMAP_LINEAR;app.root.addChild(camera);
const sun=new pc.Entity('Warm character key');sun.addComponent('light',{type:'directional',color:new pc.Color(1,.85,.64),intensity:1.65,castShadows:false});sun.setEulerAngles(-48,-35,0);app.root.addChild(sun);
const asset=new pc.Asset('Hozy Greenhouse — Elias Duda','gsplat',{url:'./assets/scene.ply'});app.assets.add(asset);
await new Promise((resolve,reject)=>{asset.ready(resolve);asset.once('error',reject);app.assets.load(asset)});
const environment=new pc.Entity('Static source environment');environment.setEulerAngles(0,0,180);environment.addComponent('gsplat',{asset});app.root.addChild(environment);
function cameraAt(p,t,fov=36){camera.setPosition(...p);camera.lookAt(new pc.Vec3(...t));camera.camera.fov=fov;}
cameraAt([14.14423,7.12267,15.44213],[-.96874,2.59504,-2.33603]);
const garden=buildGarden(pc,app);
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const blend=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u);
function seek(t){
 const push=.25*smooth(t/4)+.75*smooth((t-4)/3);const widen=smooth((t-11)/4);const u=push*(1-.83*widen);
 cameraAt(blend([15.3,8.4,19.9],[11.5,6.7,15.9],u),blend([.3,3.2,.7],[2.0,2.9,4.7],u),36);
 window.pose=garden.animate(t);document.querySelector('#time').value=t;document.querySelector('#clock').textContent=t.toFixed(2)+' / 15s';
}
app.start();
window.cine={app,pc,camera,environment,cameraAt,garden,seek,async settle(){await new Promise(r=>setTimeout(r,300));await new Promise(r=>app.once('postrender',r));},project(p){const v=camera.camera.worldToScreen(new pc.Vec3(...p));return [v.x,v.y,v.z];}};
seek(0);
let playing=false,time=0;const audio=new Audio('./assets/mix.wav');document.querySelector('#play').onclick=()=>{playing=!playing;if(playing){time=Number(document.querySelector('#time').value);if(time>=15)time=0;audio.currentTime=time;audio.play().catch(()=>{});}else audio.pause();};
document.querySelector('#time').oninput=e=>{playing=false;audio.pause();seek(Number(e.target.value));};
app.on('update',dt=>{if(playing){time=Math.min(15,time+dt);seek(time);if(time===15){playing=false;audio.pause();}}});
await window.cine.settle();window.ready=true;document.querySelector('#clock').textContent='Ready';
if(new URLSearchParams(location.search).has('capture'))document.body.classList.add('capture');
