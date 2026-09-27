/* Bake the editable entity hierarchy into a portable glTF 2.0 binary animation. */
export function exportGLB(){
 const {app,evaluate,car,actor,camera}=window.production;
 const pc=window.pc;
 evaluate(0);
 const entities=[];
 function visit(e){if(e.light)return;entities.push(e);for(const c of e.children)visit(c);}
 for(const e of app.root.children)visit(e);
 const ids=new Map(entities.map((e,i)=>[e,i]));
 const doc={asset:{version:'2.0',generator:'Last Light / PlayCanvas authored scene',copyright:'Car visual reference: Renderbricks, CC BY 4.0. Procedural scene and animation: Last Light production.'},extensionsUsed:['KHR_materials_unlit'],scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[],cameras:[],bufferViews:[],accessors:[],buffers:[{byteLength:0}],animations:[]};
 const chunks=[];let byteLength=0;
 function accessor(values,width,component=5126,target){
  const bytes=component===5125?new Uint32Array(values):new Float32Array(values);
  const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.byteLength,...(target?{target}:{})});chunks.push(new Uint8Array(bytes.buffer));byteLength+=bytes.byteLength;
  const min=Array(width).fill(Infinity),max=Array(width).fill(-Infinity);
  values.forEach((v,i)=>{min[i%width]=Math.min(min[i%width],v);max[i%width]=Math.max(max[i%width],v);});
  const a=doc.accessors.length;doc.accessors.push({bufferView:view,componentType:component,count:values.length/width,type:({1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'})[width],min,max});return a;
 }
 const materials=new Map(),meshes=new Map();
 function material(m){
  if(materials.has(m))return materials.get(m);
  const id=doc.materials.length;materials.set(m,id);
  const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
  const sky=m.name==='Peach sky';
  doc.materials.push({name:m.name,pbrMetallicRoughness:{baseColorFactor:[...(sky?[.80,.61,.46]:[m.diffuse.r,m.diffuse.g,m.diffuse.b]).map(linear),m.opacity],metallicFactor:m.metalness||0,roughnessFactor:1-m.gloss},emissiveFactor:sky?[0,0,0]:[m.emissive.r,m.emissive.g,m.emissive.b].map(linear),...(sky?{extensions:{KHR_materials_unlit:{}},doubleSided:false}:{}),...(m.opacity<1?{alphaMode:'BLEND',doubleSided:true}:{})});return id;
 }
 function mesh(instance){
  const key=instance.mesh.id+':'+instance.material.id;if(meshes.has(key))return meshes.get(key);
  const p=[],n=[],idx=[];instance.mesh.getPositions(p);instance.mesh.getNormals(n);instance.mesh.getIndices(idx);
  if(instance.material.name==='Peach sky'){for(let i=0;i<n.length;i++)n[i]*=-1;for(let i=0;i<idx.length;i+=3)[idx[i+1],idx[i+2]]=[idx[i+2],idx[i+1]];}
  const id=doc.meshes.length;meshes.set(key,id);doc.meshes.push({primitives:[{attributes:{POSITION:accessor(p,3,5126,34962),NORMAL:accessor(n,3,5126,34962)},indices:accessor(idx,1,5125,34963),material:material(instance.material)}]});return id;
 }
 const stable=new Map([[car,'last-light:car'],[actor,'last-light:driver'],[camera,'last-light:camera']]);
 for(const e of entities){
  const node={name:`${e.name}__${ids.get(e)}`,translation:e.getLocalPosition().toArray(),rotation:e.getLocalRotation().toArray(),scale:e.enabled?e.getLocalScale().toArray():[0,0,0]};
  const children=e.children.filter(c=>ids.has(c)).map(c=>ids.get(c));if(children.length)node.children=children;
  if(e.render)node.mesh=mesh(e.render.meshInstances[0]);
  if(e===camera){node.camera=0;doc.cameras.push({name:'Last Light — edited sequence',type:'perspective',perspective:{yfov:43*Math.PI/180,aspectRatio:16/9,znear:.06,zfar:500}});}
  if(stable.has(e))node.extras={entityId:stable.get(e)};
  doc.nodes.push(node);
 }
 // Group all environment meshes under one selectable plain-data entity.
 const environment=doc.nodes.length;doc.nodes.push({name:'Quiet coast',children:app.root.children.filter(e=>ids.has(e)&&!stable.has(e)).map(e=>ids.get(e)),extras:{entityId:'last-light:coast'}});
 doc.scenes[0].nodes=[ids.get(car),ids.get(actor),ids.get(camera),environment];
 const paths=['translation','rotation','scale'];
 const samples=entities.map(()=>({translation:[],rotation:[],scale:[]}));
 for(let f=0;f<=360;f++){
  evaluate(Math.max(0,f-1)/24);
  entities.forEach((e,i)=>{samples[i].translation.push(...e.getLocalPosition().toArray());samples[i].rotation.push(...e.getLocalRotation().toArray());samples[i].scale.push(...(e.enabled?e.getLocalScale().toArray():[0,0,0]));});
 }
 const times=accessor(Array.from({length:361},(_,i)=>i/24),1),animation={name:'Last Light — 15 second performance',channels:[],samplers:[]};
 samples.forEach((sample,i)=>{for(const path of paths){const data=sample[path],width=path==='rotation'?4:3;if(!data.some((v,j)=>Math.abs(v-data[j%width])>1e-6))continue;
  const sampler=animation.samplers.length;animation.samplers.push({input:times,output:accessor(data,width),interpolation:'STEP'});animation.channels.push({sampler,target:{node:i,path}});
 }});
 doc.animations.push(animation);doc.buffers[0].byteLength=byteLength;
 const json=new TextEncoder().encode(JSON.stringify(doc)),jsonLength=Math.ceil(json.length/4)*4,total=12+8+jsonLength+8+byteLength;
 const out=new Uint8Array(total),view=new DataView(out.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jsonLength);out.set(json,20);
 view.setUint32(20+jsonLength,byteLength,true);view.setUint32(24+jsonLength,0x004e4942,true);let offset=28+jsonLength;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
 evaluate(0);
 return {bytes:out,nodes:doc.nodes.length,meshes:doc.meshes.length,channels:animation.channels.length};
}
