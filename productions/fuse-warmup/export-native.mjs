// Bake the authored procedural performance into a portable, editable actor clip.
export function exportInstructor(pc,instructor){
 const {root,pose}=instructor;pose(0);
 const entities=[];const visit=e=>{if(e.render)entities.push(e);e.children.forEach(visit);};visit(root);
 const doc={asset:{version:'2.0',generator:'FUSE original procedural instructor'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'FUSE performance',children:entities.map((_,i)=>i+1)}],meshes:[],materials:[],bufferViews:[],accessors:[],buffers:[{byteLength:0}],animations:[]};
 const chunks=[];let byteLength=0;
 function accessor(values,width,component=5126,target){
  const bytes=component===5125?new Uint32Array(values):new Float32Array(values);
  const bufferView=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:bytes.byteLength,...(target?{target}:{})});chunks.push(new Uint8Array(bytes.buffer));byteLength+=bytes.byteLength;
  const min=Array(width).fill(Infinity),max=Array(width).fill(-Infinity);values.forEach((v,i)=>{min[i%width]=Math.min(min[i%width],v);max[i%width]=Math.max(max[i%width],v);});
  const id=doc.accessors.length;doc.accessors.push({bufferView,componentType:component,count:values.length/width,type:({1:'SCALAR',3:'VEC3',4:'VEC4'})[width],min,max});return id;
 }
 const materials=new Map(),meshes=new Map();
 function material(m){if(materials.has(m))return materials.get(m);const id=doc.materials.length;materials.set(m,id);const linear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;doc.materials.push({name:m.name,pbrMetallicRoughness:{baseColorFactor:[...[m.diffuse.r,m.diffuse.g,m.diffuse.b].map(linear),1],metallicFactor:0,roughnessFactor:1-m.gloss}});return id;}
 function mesh(mi){const key=mi.mesh.id+':'+mi.material.id;if(meshes.has(key))return meshes.get(key);const p=[],n=[],idx=[];mi.mesh.getPositions(p);mi.mesh.getNormals(n);mi.mesh.getIndices(idx);const id=doc.meshes.length;meshes.set(key,id);doc.meshes.push({primitives:[{attributes:{POSITION:accessor(p,3,5126,34962),NORMAL:accessor(n,3,5126,34962)},indices:accessor(idx,1,5125,34963),material:material(mi.material)}]});return id;}
 const transform=e=>({translation:e.getPosition().toArray(),rotation:e.getRotation().toArray(),scale:e.enabled?e.getWorldTransform().getScale().toArray():[0,0,0]});
 const bounds=new pc.BoundingBox();let first=true;
 entities.forEach((e,i)=>{doc.nodes.push({name:`FUSE_part_${i}`,mesh:mesh(e.render.meshInstances[0]),...transform(e)});for(const mi of e.render.meshInstances){if(first){bounds.copy(mi.aabb);first=false;}else bounds.add(mi.aabb);}});
 const samples=entities.map(()=>({translation:[],rotation:[],scale:[]}));
 for(let f=0;f<=360;f++){pose(f/24);entities.forEach((e,i)=>{const values=transform(e),sample=samples[i],prior=sample.rotation.slice(-4);if(prior.length&&prior.reduce((sum,v,k)=>sum+v*values.rotation[k],0)<0)values.rotation=values.rotation.map(v=>-v);for(const path of Object.keys(sample))sample[path].push(...values[path]);});}
 const times=accessor(Array.from({length:361},(_,i)=>i/24),1),animation={name:'Warm welcome',channels:[],samplers:[]};
 samples.forEach((sample,i)=>{for(const path of Object.keys(sample)){const data=sample[path],width=path==='rotation'?4:3;if(!data.some((v,j)=>Math.abs(v-data[j%width])>1e-6))continue;const sampler=animation.samplers.length;animation.samplers.push({input:times,output:accessor(data,width),interpolation:'LINEAR'});animation.channels.push({sampler,target:{node:i+1,path}});}});
 // Soft, baked contact patches travel with the actor and remain below the planted sneakers.
 const shadowMaterial=doc.materials.length;doc.extensionsUsed=['KHR_materials_unlit'];
 doc.materials.push({name:'Soft shoe contact',extensions:{KHR_materials_unlit:{}},pbrMetallicRoughness:{baseColorFactor:[.04,.026,.017,1],metallicFactor:0,roughnessFactor:1},alphaMode:'BLEND',doubleSided:true});
 const sp=[],sn=[],sc=[],si=[],segments=40,rings=6;
 for(let r=0;r<=rings;r++)for(let k=0;k<segments;k++){const theta=k/segments*Math.PI*2,u=r/rings;sp.push(Math.cos(theta)*.14*u,.003,Math.sin(theta)*.18*u);sn.push(0,1,0);sc.push(1,1,1,.42*(1-u*u)**2);}
 for(let r=0;r<rings;r++)for(let k=0;k<segments;k++){const a=r*segments+k,b=r*segments+(k+1)%segments,c=a+segments,d=b+segments;si.push(a,c,b,b,c,d);}
 const shadowMesh=doc.meshes.length;doc.meshes.push({primitives:[{attributes:{POSITION:accessor(sp,3,5126,34962),NORMAL:accessor(sn,3,5126,34962),COLOR_0:accessor(sc,4,5126,34962)},indices:accessor(si,1,5125,34963),material:shadowMaterial}]});
 for(const side of [-1,1]){doc.nodes[0].children.push(doc.nodes.length);doc.nodes.push({name:'Contact patch '+side,mesh:shadowMesh,translation:[side*.205,0,.045]});}
 doc.animations.push(animation);doc.buffers[0].byteLength=byteLength;
 const json=new TextEncoder().encode(JSON.stringify(doc)),jsonLength=Math.ceil(json.length/4)*4,total=28+jsonLength+byteLength,out=new Uint8Array(total),view=new DataView(out.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);view.setUint32(12,jsonLength,true);view.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+jsonLength);out.set(json,20);view.setUint32(20+jsonLength,byteLength,true);view.setUint32(24+jsonLength,0x004e4942,true);let offset=28+jsonLength;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}
 pose(0);return {bytes:Array.from(out),height:bounds.halfExtents.y*2,center:bounds.center.toArray(),min:bounds.getMin().toArray(),nodes:entities.length,channels:animation.channels.length};
}
