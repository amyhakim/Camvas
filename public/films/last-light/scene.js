/* LAST LIGHT. Editable deterministic PlayCanvas scene; metres, Y-up, front +X.
 * Reference: Renderbricks / LEGO 10252 Volkswagen Beetle, CC BY 4.0.
 * This independent approximation has explicit articulated geometry, not a splat conversion.
 */
const pc = window.pc;
const params = new URLSearchParams(location.search);
if (params.has('capture')) document.body.classList.add('capture');
const canvas = document.querySelector('canvas');
const app = new pc.Application(canvas, {graphicsDeviceOptions:{antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'}});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = 1;
app.scene.ambientLight = new pc.Color(.35,.43,.51);
app.scene.exposure = 1.1;
app.scene.fog.type = pc.FOG_LINEAR;
app.scene.fog.color = new pc.Color(.91,.68,.47);
app.scene.fog.start = 45; app.scene.fog.end = 185;
const root=app.root;
const mats={};
function mat(name,hex,rough=.4,metal=0,emission=0){
 const m=new pc.StandardMaterial();m.name=name;
 const c=new pc.Color().fromString(hex);m.diffuse=c;m.useMetalness=true;m.metalness=metal;m.gloss=1-rough;
 m.specular=new pc.Color(.55,.55,.55);
 if(emission){m.emissive=c.clone();m.emissiveIntensity=emission;}
 m.update();mats[name]=m;return m;
}
const turquoise=mat('Turquoise ABS','#168f9e',.26), aqua=mat('Turquoise highlights','#20a3ad',.29), darkAqua=mat('Turquoise seams','#126575',.4);
const ivory=mat('Warm ivory plastic','#f2ead0',.34), rubber=mat('Soft charcoal tires','#202c31',.73), chrome=mat('Satin trim','#bdcecd',.25,.62), black=mat('Dark fittings','#23343b',.42);
const red=mat('Coral cooler','#d54535',.3), tan=mat('Saddle upholstery','#b17743',.52), yellow=mat('Golden character plastic','#efba59',.38), shirt=mat('Sun faded coral shirt','#eb654c',.46), pants=mat('Indigo shorts','#354c68',.48);
const eye=mat('Face ink','#292f33',.7), sand=mat('Apricot sand','#d4b581',.95), road=mat('Warm paved coastal lane','#756f64',.92), ocean=mat('Turquoise ocean','#4b9599',.3), foam=mat('Ivory wave crests','#d0dbca',.55), grass=mat('Dune grass','#7d9270',.7);
const glass=mat('Pale blue glazing','#8ababc',.16);glass.opacity=.16;glass.blendType=pc.BLEND_NORMAL;glass.depthWrite=false;glass.update();
const lamp=mat('Headlamp lens','#fff1c0',.2,0,.18), tail=mat('Tail lights','#cf4430',.24,0,.15);
const meshes=new Map();
function roundMesh(w,h,d,r=.025){
 const key=[w,h,d,r].join();if(meshes.has(key))return meshes.get(key);
 const half=[w/2,h/2,d/2],positions=[],normals=[],indices=[];
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const u=(axis+1)%3,v=(axis+2)%3,start=positions.length/3;
  const a=[-half[u],-half[u]+r,half[u]-r,half[u]],b=[-half[v],-half[v]+r,half[v]-r,half[v]];
  for(let j=0;j<4;j++)for(let i=0;i<4;i++){
   const p=[0,0,0];p[axis]=sign*half[axis];p[u]=a[i];p[v]=b[j];
   const q=p.map((x,k)=>Math.max(-half[k]+r,Math.min(half[k]-r,x)));
   const n=p.map((x,k)=>x-q[k]),len=Math.hypot(...n);for(let k=0;k<3;k++){n[k]/=len;p[k]=q[k]+n[k]*r;}
   positions.push(...p);normals.push(...n);
  }
  for(let j=0;j<3;j++)for(let i=0;i<3;i++){const a=start+j*4+i,b=a+1,c=a+4,d=c+1;if(sign>0)indices.push(a,b,c,b,d,c);else indices.push(a,c,b,b,c,d);}
 }
 const mesh=new pc.Mesh(app.graphicsDevice);mesh.setPositions(positions);mesh.setNormals(normals);mesh.setIndices(indices);mesh.update(pc.PRIMITIVE_TRIANGLES);meshes.set(key,mesh);return mesh;
}
function group(name,parent=root,x=0,y=0,z=0){const e=new pc.Entity(name);parent.addChild(e);e.setLocalPosition(x,y,z);return e;}
function box(name,pos,size,material,parent=root,r=.025){const e=group(name,parent,...pos);const mesh=roundMesh(...size,Math.min(r,...size.map(v=>v*.24)));e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)],castShadows:true,receiveShadows:true});return e;}
function primitive(name,type,pos,size,material,parent=root,rot=[0,0,0]){const e=group(name,parent,...pos);e.addComponent('render',{type,material,castShadows:true,receiveShadows:true});e.setLocalScale(...size);e.setLocalEulerAngles(...rot);return e;}
function cyl(name,pos,radius,height,material,parent=root,rot=[0,0,0]){return primitive(name,'cylinder',pos,[radius*2,height,radius*2],material,parent,rot);}
function stud(parent,x,y,z,material=turquoise){cyl('Moulded stud',[x,y,z],.068,.04,material,parent);}
function beam(name,a,b,width,material,parent=root){const mid=a.map((v,i)=>(v+b[i])/2),e=box(name,mid,[width,Math.hypot(...a.map((v,i)=>v-b[i])),width],material,parent,.01);const q=new pc.Quat().setFromDirections(pc.Vec3.UP,new pc.Vec3(...b.map((v,i)=>v-a[i])).normalize());e.setLocalRotation(q);return e;}
function light(name,type,color,intensity,rot,pos,shadow=false){const e=group(name,root,...pos);e.addComponent('light',{type,color:new pc.Color(...color),intensity,castShadows:shadow,shadowResolution:4096,shadowDistance:55,shadowBias:.12,normalOffsetBias:.025,shadowType:pc.SHADOW_PCF5,range:25});e.setEulerAngles(...rot);return e;}
light('Low golden sun','directional',[1,.76,.46],2.1,[28,-115,0],[0,9,0],true);
light('Open sky fill','directional',[.58,.78,1],.8,[55,45,0],[0,8,0]);
light('Soft front reflection','directional',[1,.88,.68],.6,[25,160,0],[0,9,0]);

// A quiet little coastline. Only the driver is a character.
box('Sand landscape',[40,-.21,6],[260,.4,28],sand,root,.02);
box('Coastal road',[45,-.035,2.2],[200,.08,6],road,root,.015);
const lineMat=mat('Sun bleached road paint','#d4c7a1',.8);
for(let x=-40;x<130;x+=5.5)box('Broken centre stripe',[x,.011,3.0],[2.2,.014,.085],lineMat,root,.005);
box('Ocean',[50,-.11,-60],[260,.14,102],ocean,root,.01);
// Long irregular terraces make a graphic, calm shoreline.
for(let i=0;i<45;i++){
 const x=-55+i*4.8,z=-8.3-Math.sin(i*.54)*.65;
 box('Wet shoreline tile',[x,-.026,z],[4.95,.045,2.1],matCached('Wet sand','#bba984'),root,.01);
 box('Shorebreak foam',[x,.001,z-.95],[4.9,.04,.11+(.5+.5*Math.sin(i*2.3))*.22],foam,root,.01);
}
function matCached(name,c){return mats[name]||mat(name,c,.78);}
for(let i=0;i<160;i++){
 const x=-90+rand(i+1)*230,z=-11-rand(i+400)*85;
 box('Flat ocean glint',[x,-.027,z],[.8+rand(i+41)*5,.015,.025+rand(i+77)*.07],i%5===0?ivory:foam,root,.004);
}
function rand(n){const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);}
for(let i=0;i<60;i++){
 const x=-25+rand(i+601)*120,z= i%2 ? 5.8+rand(i+102)*8 : -3.8-rand(i+102)*2.3;
 if(Math.abs(x)<5)continue;
 const g=group('Three-blade dune grass',root,x,0,z);
 for(let j=0;j<3;j++){const e=box('Grass blade',[(j-1)*.09,.18,0],[.04,.36,.055],grass,g,.006);e.setLocalEulerAngles(j*7,20*j,(j-1)*17);}
 if(i%4===0)box('Sandstone pebble',[x+.4,.075,z+.2],[.3,.16,.24],matCached('Pale dune stones','#c8b38d'),root,.05);
}
// A seamless procedural sky dome avoids a finite backdrop edge at camera cuts.
const skyCanvas=document.createElement('canvas');skyCanvas.width=8;skyCanvas.height=1024;
const skyCtx=skyCanvas.getContext('2d'),gradient=skyCtx.createLinearGradient(0,0,0,1024);
gradient.addColorStop(0,'#668b9a');gradient.addColorStop(.35,'#b8c5c0');gradient.addColorStop(.48,'#e5b393');gradient.addColorStop(.53,'#eac099');gradient.addColorStop(1,'#dba785');
skyCtx.fillStyle=gradient;skyCtx.fillRect(0,0,8,1024);
const skyTexture=new pc.Texture(app.graphicsDevice,{mipmaps:false});skyTexture.setSource(skyCanvas);
// An independently generated studio-sky reflection gives bevels an ABS-plastic sheen.
const envCanvas=document.createElement('canvas');envCanvas.width=512;envCanvas.height=256;
const ec=envCanvas.getContext('2d'),eg=ec.createLinearGradient(0,0,0,256);
eg.addColorStop(0,'#8faaa9');eg.addColorStop(.45,'#c3d1cb');eg.addColorStop(.52,'#816d58');eg.addColorStop(1,'#433f38');ec.fillStyle=eg;ec.fillRect(0,0,512,256);
ec.fillStyle='#fff5df';ec.fillRect(90,47,63,42);ec.fillStyle='#b6d9e8';ec.fillRect(350,50,65,50);
const envTexture=new pc.Texture(app.graphicsDevice,{mipmaps:false,projection:pc.TEXTUREPROJECTION_EQUIRECT});envTexture.setSource(envCanvas);
const lightingSource=pc.EnvLighting.generateLightingSource(envTexture,{size:64});
app.scene.envAtlas=pc.EnvLighting.generateAtlas(lightingSource,{size:256,numReflectionSamples:64,numAmbientSamples:64});
app.scene.skyboxIntensity=.55;
const sky=mat('Peach sky','#ffffff',1);sky.useLighting=false;sky.useFog=false;sky.emissive=new pc.Color(1,1,1);sky.emissiveMap=skyTexture;sky.diffuse=new pc.Color(0,0,0);sky.cull=pc.CULLFACE_NONE;sky.update();
const skyDome=primitive('Seamless sky dome','sphere',[0,0,0],[440,440,440],sky);skyDome.render.castShadows=false;skyDome.render.receiveShadows=false;
const sunMat=mat('Warm sunset disc','#ffdc8f',1,0,1.4);sunMat.useLighting=false;sunMat.update();
sunMat.useFog=false;sunMat.update();
const sun=primitive('Setting sun','sphere',[148,8,-56],[14,14,14],sunMat);sun.render.castShadows=false;

const car=group('CAR — animated world root');
const suspension=group('BODY — suspension',car);
box('Chassis',[0,.53,0],[3.45,.2,1.52],black,suspension);
box('Cabin floor',[-.1,.55,0],[1.8,.12,1.68],darkAqua,suspension);
for(const side of [-1,1]){
 box('Running board',[-.12,.60,side*1.0],[1.56,.12,.23],black,suspension);
 box('Ivory sill trim',[-.1,.73,side*.94],[1.68,.065,.09],ivory,suspension);
}
for(const x of [-1.57,-1.32,-1.07])for(const z of [-.37,0,.37])stud(suspension,x,1.325,z,aqua);
// Hood and rear deck are stepped tiles, preserving the Beetle's domed silhouette.
for(const [x,y,w,len] of [[1.35,.91,1.63,1.25],[1.33,1.07,1.48,1.16],[1.25,1.20,1.24,.98],[1.12,1.30,.96,.7],[-1.45,.94,1.61,1.09],[-1.43,1.10,1.48,.98],[-1.31,1.23,1.24,.79]]){
 box('Stepped body plate',[x,y,0],[len,.17,w],turquoise,suspension,.045);
}
for(let x=.87;x<1.7;x+=.24)for(const z of [-.36,0,.36])stud(suspension,x,1.397-(x>1.45?.23:x>1.3?.12:0),z,aqua);
for(const side of [-1,1]){
 // Rear quarter panels join the roof to the deck.
 box('Rear quarter lower',[-.95,1.01,side*.79],[.56,.47,.26],turquoise,suspension);
 box('Rear quarter upper',[-.88,1.40,side*.78],[.30,.45,.15],aqua,suspension);
 for(const axle of [-1.25,1.25]){
  for(let k=0;k<10;k++){
   const angle=(k+.5)*Math.PI/10;
   const e=box('Brick wheel arch',[axle+Math.cos(angle)*.54,.50+Math.sin(angle)*.54,side*.91],[.205,.17,.33],k%3===0?aqua:turquoise,suspension,.025);
   e.setLocalEulerAngles(0,0,angle*180/Math.PI-90);
  }
 }
 box('Front bumper',[2.02,.67,side*.49],[.15,.15,.88],chrome,suspension);
 box('Rear bumper',[-2.00,.67,side*.49],[.15,.15,.88],chrome,suspension);
 cyl('Headlamp chrome bezel',[1.92,1.14,side*.65],.215,.12,chrome,suspension,[0,0,90]);
 cyl('Round headlamp lens',[1.998,1.14,side*.65],.177,.025,lamp,suspension,[0,0,90]);
 box('Amber indicator',[2.006,.91,side*.66],[.04,.085,.19],matCached('Amber signals','#eab34e'),suspension,.018);
 box('Rear ruby lamp',[-1.979,.97,side*.67],[.055,.2,.16],tail,suspension,.023);
}
box('Hood centre seam',[1.37,1.395,0],[.59,.014,.019],darkAqua,suspension,.002);
box('Front registration',[2.117,.66,0],[.025,.135,.48],ivory,suspension,.01);
box('Rear registration',[-2.11,.66,0],[.025,.135,.48],ivory,suspension,.01);
// Separate rotating wheels; ivory annulus plus metallic hub reads as whitewalls.
const wheels=[];
for(const x of [-1.25,1.25])for(const side of [-1,1]){
 const wheel=group('WHEEL '+x+' '+side,car,x,.475,side*.95);wheels.push(wheel);
 cyl('Tire',[0,0,0],.475,.29,rubber,wheel,[90,0,0]);
 cyl('Whitewall',[0,0,side*.155],.367,.021,ivory,wheel,[90,0,0]);
 cyl('Wheel alloy centre',[0,0,side*.173],.253,.029,chrome,wheel,[90,0,0]);
 cyl('Hubcap',[0,0,side*.20],.161,.055,ivory,wheel,[90,0,0]);
 for(let i=0;i<12;i++){
  const a=i*Math.PI/6;const e=box('Tread block',[Math.cos(a)*.463,Math.sin(a)*.463,0],[.08,.03,.24],black,wheel,.009);e.setLocalEulerAngles(0,0,a*180/Math.PI-90);
 }
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cyl('Hub bolt',[Math.cos(a)*.203,Math.sin(a)*.203,side*.201],.022,.025,black,wheel,[90,0,0]);}
}
// Open-window cabin: the single driver remains readable once seated.
for(const side of [-1,1]){
 beam('Front windscreen pillar',[.71,1.19,side*.78],[.37,1.96,side*.67],.09,ivory,suspension);
 beam('Rear sloped pillar',[-1.38,1.26,side*.71],[-.83,1.94,side*.67],.15,turquoise,suspension);
 box('Window upper rail',[-.23,1.98,side*.70],[1.25,.095,.1],ivory,suspension);
 box('Window rear post',[-.76,1.65,side*.78],[.07,.58,.09],turquoise,suspension);
}
beam('Windshield lower frame',[.73,1.29,-.78],[.73,1.29,.78],.075,ivory,suspension);
beam('Windshield top frame',[.38,1.96,-.68],[.38,1.96,.68],.07,ivory,suspension);
const windshield=box('Transparent windscreen',[.56,1.62,0],[.028,.73,1.35],glass,suspension,.002);windshield.setLocalEulerAngles(0,0,25);
box('Cream roof main',[-.27,2.035,0],[1.38,.13,1.48],ivory,suspension,.055);
box('Cream roof upper',[-.27,2.105,0],[1.09,.06,1.22],ivory,suspension,.025);
box('Rear glass',[-1.075,1.65,0],[.035,.51,1.27],glass,suspension,.002).setLocalEulerAngles(0,0,-36);
for(const z of [-.43,.43]){
 box('Seat cushion',[-.30,.86,z],[.59,.15,.54],tan,suspension,.055);
 box('Seat back',[-.62,1.12,z],[.14,.56,.54],tan,suspension,.045).setLocalEulerAngles(0,0,-8);
}
box('Dashboard',[.60,1.22,0],[.24,.13,1.41],black,suspension);
cyl('Steering column',[.19,1.15,.43],.045,.29,black,suspension,[0,0,66]);
const steer=primitive('Steering wheel','torus',[.09,1.28,.43],[.33,.33,.33],black,suspension,[0,0,65]);
const door=group('DRIVER DOOR — hinged at front',suspension,.68,0,.84);
function doorParts(parent,side){
 box('Turquoise door panel',[-.62,1.025,0],[1.20,.52,.15],turquoise,parent,.03);
 box('Door lower brick course',[-.62,.82,side*.083],[1.16,.085,.027],aqua,parent,.008);
 box('Door upper ledge',[-.62,1.30,0],[1.23,.06,.18],ivory,parent,.012);
 box('Door inner lining',[-.62,1.09,-side*.09],[1.04,.30,.03],tan,parent,.009);
 box('Door exterior handle',[-1.04,1.25,side*.118],[.18,.048,.045],chrome,parent,.01);
 box('Door brick joint',[-.62,1.047,side*.077],[1.14,.009,.007],darkAqua,parent,.001);
 box('Door vertical brick joint',[-.66,.934,side*.078],[.009,.17,.007],darkAqua,parent,.001);
 beam('Door window rear frame',[-1.20,1.32,0],[-1.20,1.94,-side*.05],.055,turquoise,parent);
 beam('Door window top',[-1.20,1.95,-side*.05],[-.33,1.95,-side*.08],.052,ivory,parent);
 beam('Door window front',[-.33,1.95,-side*.08],[0,1.32,0],.055,ivory,parent);
 box('Wing mirror stalk',[-.05,1.40,side*.15],[.05,.05,.22],chrome,parent,.007);
 box('Wing mirror',[-.05,1.45,side*.27],[.13,.16,.07],chrome,parent,.025);
}
doorParts(door,1);const passenger=group('Passenger door',suspension,.68,0,-.84);doorParts(passenger,-1);
// Roof cargo: cream/yellow surfboard with green stripe, red cooler with pale lid.
for(const x of [-.71,.25]){
 box('Roof rack crossbar',[x,2.21,0],[.08,.075,1.72],chrome,suspension,.012);
 for(const z of [-.65,.65])box('Rack foot',[x,2.14,z],[.12,.15,.12],black,suspension,.015);
}
const board=group('Roof surfboard',suspension,-.08,2.30,-.43);board.setLocalEulerAngles(0,-5,0);
const boardMat=mat('Surfboard golden rail','#e7bd4f',.36),green=mat('Surfboard sea green stripe','#81aa76',.35);
box('Surfboard centre',[0,0,0],[2.64,.11,.52],boardMat,board,.05);
box('Surfboard ivory deck',[0,.045,0],[2.43,.035,.39],ivory,board,.016);
box('Surfboard stripe',[0,.067,0],[2.44,.014,.095],green,board,.005);
for(const x of [-1.34,1.34])box('Squared rounded board tip',[x,0,0],[.25,.09,.34],boardMat,board,.04);
box('Surfboard fin',[-.96,.17,0],[.23,.26,.055],ivory,board,.012);
const cooler=group('RED COOLER',suspension,-.28,2.49,.41);
box('Red cooler body',[0,0,0],[.69,.43,.57],red,cooler,.035);
box('Cooler white lid',[0,.24,0],[.74,.09,.62],ivory,cooler,.02);
for(const x of [-.22,0,.22])for(const z of [-.17,.17])stud(cooler,x,.303,z,ivory);
box('Cooler latch',[.355,.09,0],[.045,.12,.08],chrome,cooler,.009);
for(const z of [-.30,.30])box('Cooler handle',[0,.07,z],[.25,.10,.055],ivory,cooler,.015);
for(const x of [-.66,.40])box('Cargo leather strap',[x,2.39,-.42],[.065,.03,.62],tan,suspension,.004);

// ONE articulated brick character. Joint pivots are explicit editable entities.
const actor=group('CHARACTER — sole driver');
actor.setLocalScale(.82,.82,.82);
const pelvis=group('Pelvis',actor,0,.75,0);
box('Shorts',[0,0,0],[.34,.23,.39],pants,pelvis,.025);
const torso=group('Torso pivot',actor,0,.89,0);
box('Coral torso',[0,.20,0],[.36,.44,.48],shirt,torso,.035);
box('Shirt hem',[.185,.01,0],[.025,.065,.46],ivory,torso,.003);
for(let j=0;j<3;j++)box('Shirt button',[.188,.16+j*.09,0],[.01,.025,.025],ivory,torso,.002);
const head=group('Head pivot',torso,0,.52,0);
box('Square smiling head',[0,.13,0],[.36,.36,.36],yellow,head,.04);
box('Hair cap',[-.025,.33,0],[.38,.12,.38],matCached('Chocolate hair','#513c30'),head,.03);
box('Hair swept fringe',[.167,.285,-.07],[.04,.09,.22],mats['Chocolate hair'],head,.01);
for(const z of [-.085,.085])box('Eye',[.184,.17,z],[.012,.045,.028],eye,head,.006);
box('Smile',[.185,.067,0],[.015,.02,.115],eye,head,.006);
for(const z of [-.058,.058])box('Smile corner',[.185,.082,z],[.015,.025,.02],eye,head,.004);
box('Nose',[.204,.116,0],[.055,.045,.048],yellow,head,.009);
const arms=[],legs=[],feet=[];
for(const side of [-1,1]){
 const a=group('Shoulder '+side,torso,0,.37,side*.29);
 box('Sleeve',[0,-.075,0],[.23,.21,.22],shirt,a,.025);
 box('Forearm',[0,-.255,0],[.17,.20,.17],yellow,a,.022);
 box('Hand',[0,-.383,0],[.21,.15,.19],yellow,a,.025);arms.push(a);
 const l=group('Hip '+side,actor,0,.69,side*.12);
 box('Thigh',[0,-.145,0],[.20,.29,.20],pants,l,.018);
 const knee=group('Knee '+side,l,0,-.29,0);
 box('Shin',[0,-.145,0],[.18,.29,.18],yellow,knee,.016);
 feet.push(box('Ivory sneaker',[.065,-.34,0],[.32,.10,.22],ivory,knee,.022));legs.push({hip:l,knee});
}
// Deterministic dust is enabled only after departure.
const dust=[];const dustMat=mat('Light sandy dust','#d3ba8e',1);
for(let i=0;i<28;i++){const e=box('Blocky dust '+i,[0,0,0],[1,1,1],dustMat,root,.04);e.render.castShadows=false;dust.push(e);}

const camera=group('CAMERA — four authored shots');camera.addComponent('camera',{fov:43,nearClip:.06,farClip:500,clearColor:new pc.Color(.91,.72,.55),toneMapping:pc.TONEMAP_ACES,gammaCorrection:pc.GAMMA_SRGB});
const finish=new pc.CameraFrame(app,camera.camera);
finish.rendering.samples=4;finish.rendering.toneMapping=pc.TONEMAP_ACES;
finish.ssao.type=pc.SSAOTYPE_COMBINE;finish.ssao.intensity=.34;finish.ssao.radius=1.1;finish.ssao.power=1.8;finish.ssao.samples=24;
finish.bloom.intensity=.012;finish.bloom.blurLevel=5;
finish.grading.enabled=true;finish.grading.contrast=1.06;finish.grading.saturation=.96;
finish.vignette.intensity=.16;finish.vignette.inner=.6;finish.vignette.outer=1.6;
finish.update();
app.start();app.autoRender=false;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
function blend(a,b,t){return a.map((v,i)=>mix(v,b[i],t));}
function driveDistance(t){const u=Math.max(0,t-9);return u<2 ? .7*u*u : 2.8+2.8*(u-2);}
function setCam(pos,target,fov){camera.setPosition(...pos);camera.lookAt(new pc.Vec3(...target));camera.camera.fov=fov;}
function evaluate(time){
 const t=clamp(time,0,359/24),a=Math.floor((t+1e-6)*12)/12; // character holds on twos
 const travel=driveDistance(a);car.setPosition(travel,0,0);
 const bounce=t>=7.6&&t<9?Math.sin((t-7.6)*14)*.041*Math.exp(-(t-7.6)*2.9):t>=9?Math.sin(a*19)*.009:0;
 suspension.setLocalPosition(0,bounce,0);suspension.setLocalEulerAngles(0,0,t>=9?-.65*Math.sin(a*4):0);
 const doorAngle=82*smooth((a-3.75)/.65)*(1-smooth((a-7.12)/.62));door.setLocalEulerAngles(0,doorAngle,0);
 for(const w of wheels)w.setLocalEulerAngles(0,0,-travel/.475*180/Math.PI);
 // Run in, settle at handle, pull, step over sill, tuck knees, sit, pull door shut.
 let pos,yaw=0,lean=0,arm0=0,arm1=0,hip0=0,hip1=0,knee0=0,knee1=0;
 if(a<3.35){
  const u=clamp(a/3.35),x=mix(-11,-.76,u),z=mix(2.55,1.25,smooth(u));
  const phase=a*Math.PI*4.4;pos=[x,.022+Math.abs(Math.sin(phase))*.038,z];yaw=9;lean=-7;
  const stride=Math.sin(phase)*29;hip0=stride;hip1=-stride;arm0=-stride*.95;arm1=stride*.95;
  knee0=Math.max(0,-Math.sin(phase))*32;knee1=Math.max(0,Math.sin(phase))*32;
 }else if(a<4.45){
  pos=[-.76,0,1.25];yaw=mix(9,90,smooth((a-3.35)/.28));arm1=-105*smooth((a-3.45)/.26)*(1-smooth((a-3.94)/.28));lean=-5;
 }else if(a<6.9){
  const cross=smooth((a-5.08)/1.15),settle=smooth((a-6.23)/.67),rise=smooth((a-4.45)/.63);
  pos=[mix(-.76,-.29,cross),.50*rise-.11*settle,mix(1.25,.43,cross)];
  yaw=mix(90,0,smooth((a-5.28)/.85));lean=-38*rise*(1-settle);arm0=-42;arm1=-48;
  hip0=-(105-15*settle)*smooth((a-4.45)/.63);hip1=-(105-15*settle)*smooth((a-4.65)/.58);
  knee0=(105-15*settle)*smooth((a-4.45)/.63);knee1=(105-15*settle)*smooth((a-4.65)/.58);
 }else{
  pos=[-.29+travel,.39+bounce,.43];yaw=0;hip0=hip1=-90;knee0=knee1=90;arm0=-62;arm1=-62;
  // Brief reach toward door before returning both hands to steering.
  if(a<7.75)arm1=-62+38*Math.sin(clamp((a-6.9)/.85)*Math.PI);
 }
 actor.setPosition(...pos);actor.setEulerAngles(0,yaw,0);torso.setLocalEulerAngles(0,0,lean);
 arms[0].setLocalEulerAngles(0,0,-arm0);arms[1].setLocalEulerAngles(0,0,-arm1);
 legs[0].hip.setLocalEulerAngles(0,0,-hip0);legs[1].hip.setLocalEulerAngles(0,0,-hip1);
 legs[0].knee.setLocalEulerAngles(0,0,-knee0);legs[1].knee.setLocalEulerAngles(0,0,-knee1);
 if(a<4.45){
  // Set the lowest sole to road height every held pose; avoid floating running feet.
  const low=Math.min(...feet.map(f=>f.render.meshInstances[0].aabb.getMin().y));
  pos[1]+=.014-low;actor.setPosition(...pos);
 }
 head.setLocalEulerAngles(0,a<3.35?-12:a<4.5?0:0,0);
 if(t<3){const u=smooth(t/3);setCam(blend([5.5,1.9,7.5],[4.4,1.7,6.5],u),[-.35,1.08,.1],43);}
 else if(t<7){const u=smooth((t-3)/4);setCam(blend([.8,2.3,7.3],[.4,2.2,6.4],u),[-.28,1.15,.25],41);}
 else if(t<10){const u=smooth((t-7)/3);setCam([travel+3.1,1.72,4.45], [travel-.12,1.05,.25],mix(42,45,u));}
 else{const u=smooth((t-10)/5),d=driveDistance(t);setCam([d-mix(5.8,12.3,u),mix(1.9,4.4,u),mix(5.8,9.5,u)],[d+mix(.4,4,u),mix(1.05,1.4,u),mix(-.35,-3.2,u)],mix(43,48,u));}
 for(let i=0;i<dust.length;i++){
  const age=((a-9.15-i*.071)%1.65+1.65)%1.65,spawn=a-age;
  const active=a>9.2+i*.025&&spawn>=9.05;dust[i].enabled=active;
  if(active){const size=(.08+age*.16)*(1-age/2.1);dust[i].setLocalScale(size,size*.83,size);dust[i].setPosition(driveDistance(spawn)-1.6-age*.52,.13+age*.21,((i%2)?1:-1)*(.91+age*.2));dust[i].setEulerAngles(i*31+age*22,i*63,i*19);}
 }
 const bounds=e=>{const b=e.render.meshInstances[0].aabb;return {min:b.getMin().toArray(),max:b.getMax().toArray()};};
 return {time:t,characterCount:1,character:pos,carX:travel,doorDegrees:doorAngle,wheelDegrees:-travel/.475*180/Math.PI,shot:t<3?1:t<7?2:t<10?3:4,feet:feet.map(bounds),head:bounds(head.children[0]),hair:bounds(head.children[1])};
}
window.production={app,evaluate,car,actor,door,camera,metadata:{title:'LAST LIGHT',duration:15,fps:24,frames:360,width:1920,height:1080,characters:1}};
window.renderFrame=async frame=>{const state=evaluate(frame/24);app.renderNextFrame=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return state;};
let playing=false,elapsed=0;
const soundtrack=document.querySelector('#soundtrack'),playButton=document.querySelector('#play'),soundButton=document.querySelector('#sound'),audioStatus=document.querySelector('#audio-status');
if(params.has('capture'))soundtrack.preload='none';
playButton.onclick=async()=>{
 playing=!playing;playButton.textContent=playing?'Pause':'Play';
 if(!playing){soundtrack.pause();return;}
 audioStatus.textContent='';soundtrack.currentTime=elapsed;
 try{await soundtrack.play();if(!playing)soundtrack.pause();}
 catch{playing=false;playButton.textContent='Play';audioStatus.textContent='Sound could not start. Press Play to retry.';}
};
soundButton.onclick=()=>{soundtrack.muted=!soundtrack.muted;soundButton.textContent=soundtrack.muted?'Sound off':'Sound on';soundButton.setAttribute('aria-label',soundtrack.muted?'Unmute soundtrack':'Mute soundtrack');};
document.querySelector('#seek').oninput=e=>{elapsed=Number(e.target.value);soundtrack.currentTime=elapsed;evaluate(elapsed);app.renderNextFrame=true;};
app.on('update',()=>{if(playing){elapsed=soundtrack.currentTime%15;evaluate(elapsed);app.renderNextFrame=true;}document.querySelector('#seek').value=elapsed;document.querySelector('#time').textContent=elapsed.toFixed(2)+' / 15s';});
window.addEventListener('resize',()=>{app.resizeCanvas();app.renderNextFrame=true;});
evaluate(0);app.renderNextFrame=true;window.productionReady=true;
