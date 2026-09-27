import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  const file=url.pathname==='/engine.mjs'?path.resolve(root,'vendor/playcanvas.mjs'):path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
  if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{const s=await stat(file);res.writeHead(200,{'Content-Type':({'html':'text/html','mjs':'text/javascript','json':'application/json','png':'image/png','wav':'audio/wav'})[file.split('.').pop()]||'application/octet-stream','Content-Length':s.size});createReadStream(file).pipe(res);}catch{res.writeHead(404).end();}
}).listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log('Greenhouse: http://localhost:'+Number(process.env.PORT||3000)));
