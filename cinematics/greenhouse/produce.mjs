import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
let ownedServer;
async function responds(url){try{return (await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(2500)})).ok}catch{return false}}
async function run(command,args,extra={}){const child=spawn(command,args,{cwd:root,stdio:'inherit',env:{...process.env,...extra}});const [code]=await once(child,'exit');if(code!==0)throw new Error(command+' exited '+code)}
try{
 let url='http://localhost:3000/greenhouse/index.html';
 if(!await responds(url)){
  url='http://localhost:3000/index.html';
  if(!await responds(url)){
   if(await responds('http://localhost:3000/'))throw new Error('Port 3000 is serving another project. Expose this folder as public/greenhouse in FlyThru, or stop that server.');
   ownedServer=spawn(process.execPath,['server.mjs'],{cwd:root,stdio:'inherit'});
   for(let n=0;n<30&&!await responds(url);n++)await new Promise(r=>setTimeout(r,100));
   if(!await responds(url))throw new Error('Could not start the cinematic on localhost:3000.');
  }
 }
 await run('python3',['audio.py']);
 await run(process.execPath,['capture.mjs','frames'],{CINEMATIC_URL:url});
 await run(process.execPath,['export.mjs']);
 await run('python3',['verify.py']);
 console.log('Complete: output/A-Little-Tending.mp4');
}finally{ownedServer?.kill('SIGTERM')}
