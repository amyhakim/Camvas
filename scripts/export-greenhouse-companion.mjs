// Bake only the added garden geometry. The source Gaussian capture is never converted or rewritten.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
let data;
try {
 const page=await browser.newPage();
 await page.goto('http://localhost:3000/greenhouse/index.html?capture');
 await page.waitForFunction(()=>window.ready,{},{timeout:180000});
 data=await page.evaluate(()=>{
  const {app,garden}=window.cine;
  garden.animate(0);
  const roots=[garden.sprite,garden.can,garden.pot,...app.root.children.filter(e=>/^(Water droplet|Water stream|Sprite contact|Flowerpot contact)/.test(e.name))];
  const entities=[],nodes=[],meshes=[],materials=[],materialIds=new Map();
  const ids=new Map([[garden.sprite,'greenhouse:sprite'],[garden.can,'greenhouse:watering-can'],[garden.pot,'greenhouse:flowerpot']]);
  for(const e of roots){
   if(/^Water (droplet|stream)/.test(e.name))ids.set(e,'greenhouse:water');
   if(e.name==='Sprite contact')ids.set(e,'greenhouse:sprite');
   if(e.name==='Flowerpot contact')ids.set(e,'greenhouse:flowerpot');
  }
  const pose=(e,world=false)=>{
   const p=world?e.getPosition():e.getLocalPosition(),q=world?e.getRotation():e.getLocalRotation(),s=world?e.getWorldTransform().getScale():e.getLocalScale();
   return {translation:[p.x,p.y,p.z],rotation:[q.x,q.y,q.z,q.w],scale:e.enabled?[s.x,s.y,s.z]:[.000001,.000001,.000001]};
  };
  const visit=(e,world=false)=>{
   const index=nodes.length;entities.push({e,world});
   const node={name:`${e.name} ${index}`,...pose(e,world)};
   if(ids.has(e))node.extras={entityId:ids.get(e)};
   nodes.push(node);
   if(e.render){
    node.mesh=meshes.length;
    meshes.push(e.render.meshInstances.map(instance=>{
     const m=instance.material;
     if(!materialIds.has(m)){
      materialIds.set(m,materials.length);
      const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
      materials.push({name:m.name,pbrMetallicRoughness:{baseColorFactor:[linear(m.diffuse.r),linear(m.diffuse.g),linear(m.diffuse.b),m.opacity],metallicFactor:0,roughnessFactor:.85},emissiveFactor:[m.emissive.r,m.emissive.g,m.emissive.b],...(m.opacity<1?{alphaMode:'BLEND'}:{}),doubleSided:true});
     }
     const positions=[],normals=[],uvs=[],indices=[];
     instance.mesh.getPositions(positions);instance.mesh.getNormals(normals);instance.mesh.getUvs(0,uvs);instance.mesh.getIndices(indices);
     return {positions,normals,uvs,indices,material:materialIds.get(m)};
    }));
   }
   const children=e.children.filter(c=>c!==garden.can);
   if(children.length)node.children=children.map(c=>visit(c));
   return index;
  };
  const rootIndices=roots.map(e=>visit(e,e===garden.can));
  const times=[0,...Array.from({length:451},(_,i)=>i/30+1/24)];
  const samples=times.map(time=>{garden.animate(Math.max(0,time-1/24));return entities.map(({e,world})=>pose(e,world));});
  return {nodes,meshes,materials,rootIndices,times,samples};
 });
} finally {await browser.close();}
const gltf={asset:{version:'2.0',generator:'FlyThru garden companion baker'},scene:0,scenes:[{nodes:data.rootIndices}],nodes:data.nodes,meshes:[],materials:data.materials,buffers:[{byteLength:0}],bufferViews:[],accessors:[],animations:[]};
const chunks=[];let length=0;
function accessor(values,type,integer=false){
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[type];
 const array=integer?new Uint32Array(values):new Float32Array(values);
 const bytes=Buffer.from(array.buffer);const pad=(4-length%4)%4;if(pad){chunks.push(Buffer.alloc(pad));length+=pad;}
 const view=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:length,byteLength:bytes.length});chunks.push(bytes);length+=bytes.length;
 const min=Array(components).fill(Infinity),max=Array(components).fill(-Infinity);
 values.forEach((v,i)=>{min[i%components]=Math.min(min[i%components],v);max[i%components]=Math.max(max[i%components],v);});
 const index=gltf.accessors.length;gltf.accessors.push({bufferView:view,componentType:integer?5125:5126,count:values.length/components,type,min,max});return index;
}
for(const mesh of data.meshes)gltf.meshes.push({primitives:mesh.map(p=>({attributes:{POSITION:accessor(p.positions,'VEC3'),NORMAL:accessor(p.normals,'VEC3'),...(p.uvs.length?{TEXCOORD_0:accessor(p.uvs,'VEC2')}:{})},indices:accessor(p.indices,'SCALAR',true),material:p.material}))});
const animation={name:'Two steps, water, and satisfied nod',samplers:[],channels:[]};
const input=accessor(data.times,'SCALAR');
data.nodes.forEach((_,node)=>{
 for(const path of ['translation','rotation','scale']){
  const values=data.samples.map(sample=>sample[node][path]);
  if(!values.some(v=>v.some((n,i)=>Math.abs(n-values[0][i])>1e-7)))continue;
  // Keep quaternion signs continuous across samples.
  if(path==='rotation')for(let i=1;i<values.length;i++)if(values[i].reduce((sum,v,k)=>sum+v*values[i-1][k],0)<0)values[i]=values[i].map(v=>-v);
  const sampler=animation.samplers.length;
  animation.samplers.push({input,output:accessor(values.flat(),path==='rotation'?'VEC4':'VEC3'),interpolation:'LINEAR'});
  animation.channels.push({sampler,target:{node,path}});
 }
});
gltf.animations.push(animation);gltf.buffers[0].byteLength=length;
const binary=Buffer.concat(chunks),raw=Buffer.from(JSON.stringify(gltf));
const json=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);
const header=Buffer.alloc(12);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+json.length+8+binary.length,8);
const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);
const bh=Buffer.alloc(8);bh.writeUInt32LE(binary.length);bh.writeUInt32LE(0x004e4942,4);
await writeFile('cinematics/greenhouse/assets/garden-animation.glb',Buffer.concat([header,jh,json,bh,binary]));
console.log({nodes:gltf.nodes.length,meshes:gltf.meshes.length,channels:animation.channels.length,bytes:header.readUInt32LE(8)});
