// Original procedural character. Metres, Y up, facing +Z. Fixed-length two-bone IK.
export function makeInstructor(pc,app){
 const root=new pc.Entity('ONE instructor');app.root.addChild(root);
 const mat=(name,hex,gloss=.2)=>{const m=new pc.StandardMaterial();m.name=name;m.diffuse.fromString(hex);m.gloss=gloss;m.useMetalness=true;m.metalness=0;m.update();return m;};
 const skin=mat('Warm skin','#b77a52'),shirt=mat('Charcoal training jersey','#30383c'),shorts=mat('Teal performance shorts','#168e90'),white=mat('Ivory sneaker knit','#eee9db'),sole=mat('Rubber soles','#c6ccc6'),hair=mat('Espresso hair','#272321'),black=mat('Brows and pupils','#201d1a'),eye=mat('Eyes','#faf5e9'),mouth=mat('Smile','#6c3028');
 const geom=new Map();
 function box(name,size,r,material,parent=root){
  const key=[...size,r].join(',');let mesh=geom.get(key);
  if(!mesh){const pos=[],norm=[],ind=[],n=6;
   for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const u=(axis+1)%3,v=(axis+2)%3,base=pos.length/3;
    for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const p=[0,0,0];p[axis]=sign*size[axis]/2;p[u]=(i/n-.5)*size[u];p[v]=(j/n-.5)*size[v];const c=p.map((a,k)=>Math.max(-size[k]/2+r,Math.min(size[k]/2-r,a)));const d=p.map((a,k)=>a-c[k]);const l=Math.hypot(...d);pos.push(...c.map((a,k)=>a+d[k]/l*r));norm.push(...d.map(a=>a/l));}
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=base+j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;ind.push(...(sign>0?[a,b,c,b,d,c]:[a,c,b,b,c,d]));}
   }mesh=pc.createMesh(app.graphicsDevice,pos,{normals:norm,indices:ind});geom.set(key,mesh);
  }const e=new pc.Entity(name);e.addComponent('render',{meshInstances:[new pc.MeshInstance(mesh,material)],castShadows:true});parent.addChild(e);return e;
 }
 const sphere=(name,size,material,parent=root)=>{const e=new pc.Entity(name);e.addComponent('render',{type:'sphere',material});e.setLocalScale(...size);parent.addChild(e);return e;};
 const node=(name,parent=root)=>{const e=new pc.Entity(name);parent.addChild(e);return e;};
 const torso=node('Torso');const chest=box('Athletic shirt',[.47,.48,.265],.075,shirt,torso);chest.setLocalPosition(0,.235,0);
 const hem=box('Shirt hem',[.385,.045,.248],.016,shirt,torso);hem.setLocalPosition(0,.015,0);
 const badge=box('Teal chest detail',[.065,.016,.007],.003,shorts,torso);badge.setLocalPosition(-.13,.34,.136);
 const neck=sphere('Neck',[.15,.17,.15],skin,torso);neck.setLocalPosition(0,.51,0);
 const head=node('Expressive head',torso);head.setLocalPosition(0,.64,0);
 box('Face',[.265,.315,.25],.073,skin,head);
 const cap=box('Short sculpted hair',[.277,.125,.256],.052,hair,head);cap.setLocalPosition(0,.127,-.014);
 const tuft=box('Hair sweep',[.20,.064,.16],.028,hair,head);tuft.setLocalPosition(-.025,.19,.005);tuft.setLocalEulerAngles(0,0,-7);
 const eyelids=[];
 for(const s of [-1,1]){
  const ear=sphere('Ear',[.06,.09,.06],skin,head);ear.setLocalPosition(s*.14,-.01,-.005);
  const e=sphere('Eye white',[.065,.045,.024],eye,head);e.setLocalPosition(s*.057,.028,.118);
  const lid=box('Blink eyelid',[.069,.047,.013],.012,skin,head);lid.setLocalPosition(s*.057,.028,.138);lid.enabled=false;eyelids.push(lid);
  const p=sphere('Pupil',[.026,.030,.015],black,head);p.setLocalPosition(s*.057,.027,.13);
  const glint=sphere('Catchlight',[.008,.009,.006],eye,head);glint.setLocalPosition(s*.057-.004,.034,.138);
  const brow=box('Friendly eyebrow',[.072,.015,.018],.006,hair,head);brow.setLocalPosition(s*.06,.073,.121);brow.setLocalEulerAngles(0,0,-s*8);
 }
 const nose=box('Nose',[.049,.052,.059],.022,skin,head);nose.setLocalPosition(0,-.015,.137);
 for(let i=0;i<9;i++){const x=(i-4)*.011,y=-.083+.022*(x/.044)**2;const m=box('Smile',[.016,.012,.014],.005,mouth,head);m.setLocalPosition(x,y,.123);m.setLocalEulerAngles(0,0,(i-4)*9);}
 const teeth=box('Smile teeth',[.055,.009,.009],.003,eye,head);teeth.setLocalPosition(0,-.076,.132);
 const pelvis=box('Shorts waistband',[.39,.155,.27],.035,shorts);
 const limbs=[],feet=[];
 for(const s of [-1,1]){
  const shoe=node('Planted sneaker');shoe.setLocalPosition(s*.205,.068,.065);shoe.setLocalEulerAngles(0,s*7,0);
  const outsole=box('Soft white sole',[.158,.05,.32],.025,sole,shoe);outsole.setLocalPosition(0,-.043,0);
  const upper=box('White sneaker',[.15,.105,.285],.04,white,shoe);upper.setLocalPosition(0,.02,-.003);
  for(let j=0;j<3;j++){const lace=box('Lace',[.095,.01,.016],.004,eye,shoe);lace.setLocalPosition(0,.076,-.04+j*.031);}
  const sock=box('Ankle sock',[.10,.09,.115],.025,white);sock.setLocalPosition(s*.205,.155,-.025);
  feet.push(shoe);
  const thigh=box('Teal shorts leg',[.202,.30,.23],.036,shorts),lower=box('Calf',[.12,.35,.13],.048,skin),knee=sphere('Knee',[.137,.14,.14],skin);
  const upperLeg=box('Lower thigh',[.149,.23,.16],.049,skin);
  const shoulderJoint=sphere('Rounded shoulder',[.21,.21,.22],shirt),sleeve=box('Shirt sleeve',[.19,.215,.207],.046,shirt),arm=box('Upper arm',[.13,.245,.145],.045,skin),forearm=box('Forearm',[.105,.25,.115],.043,skin),elbow=sphere('Elbow',[.116,.12,.12],skin);
  const hand=node('Hand');box('Palm',[.087,.10,.043],.016,skin,hand).setLocalPosition(0,.043,0);
  const fingers=[];
  for(let j=0;j<4;j++){const digit=node('Finger',hand);digit.setLocalPosition((j-1.5)*.022,.083,0);const len=[.061,.078,.073,.057][j];const f=box('Finger phalanx',[.02,len,.026],.009,skin,digit);f.setLocalPosition(0,len/2,0);fingers.push(digit);}
  const thumb=node('Thumb',hand);thumb.setLocalPosition(-s*.055,.035,.025);box('Thumb',[.034,.102,.036],.015,skin,thumb).setLocalPosition(0,.044,0);
  limbs.push({s,thigh,upperLeg,lower,knee,shoulderJoint,sleeve,arm,forearm,elbow,hand,fingers,thumb});
 }
 const V=a=>new pc.Vec3(...a),mix=(a,b,u)=>a.map((v,i)=>v+(b[i]-v)*u),add=(a,b)=>a.map((v,i)=>v+b[i]);
 function segment(e,a,b,length=null){const d=V(b).sub(V(a)),len=d.length();e.setLocalPosition(...mix(a,b,.5));e.setLocalRotation(new pc.Quat().setFromDirections(pc.Vec3.UP,d.normalize()));if(length)e.setLocalScale(1,len/length,1);}
 function ik(a,b,l1,l2,pole){const d=V(b).sub(V(a)),len=Math.min(d.length(),l1+l2-.0001);d.normalize();let p=V(pole);p.sub(d.clone().mulScalar(p.dot(d))).normalize();const along=(l1*l1-l2*l2+len*len)/(2*len),out=Math.sqrt(Math.max(0,l1*l1-along*along));return V(a).add(d.mulScalar(along)).add(p.mulScalar(out)).toArray();}
 const smooth=(a,b,t)=>{const x=Math.max(0,Math.min(1,(t-a)/(b-a)));return x*x*(3-2*x);};
 function squat(t,start){return smooth(start,start+1.14,t)*(1-smooth(start+1.48,start+2.85,t));}
 function pose(t){
  const q=squat(t,5)+squat(t,8);const breathe=.006*Math.sin(t*2.2)*(1-q);const hip=[.012*Math.sin(t*1.8)*q,.91-.355*q+breathe,-.23*q];
  eyelids.forEach(l=>l.enabled=[2.9,7.88,11.5,14.1].some(b=>Math.abs(t-b)<.055));
  pelvis.setLocalPosition(...hip);torso.setLocalPosition(...add(hip,[0,.07,0]));torso.setLocalEulerAngles(14*q,0,0);head.setLocalEulerAngles(-11*q,3*Math.sin(t*1.3)*(1-q),-3*(1-q));
  const ang=14*q*Math.PI/180;const body=(x,y,z)=>add(add(hip,[0,.07,0]),[x,y*Math.cos(ang)-z*Math.sin(ang),y*Math.sin(ang)+z*Math.cos(ang)]);
  const reach=smooth(3.05,4.7,t)*(1-smooth(11,11.85,t));const wave=smooth(.2,.72,t)*(1-smooth(2.3,3,t));const thumbs=smooth(11.75,12.55,t);
  for(const l of limbs){const {s}=l;const h=add(hip,[s*.14,-.015,0]),ankle=[s*.205,.17,-.026],k=ik(h,ankle,.40,.385,[s*.18,0,1]);
   segment(l.thigh,h,mix(h,k,.76),.30);segment(l.upperLeg,mix(h,k,.49),k,.23);segment(l.lower,k,ankle,.35);l.knee.setLocalPosition(...k);
   const shoulder=body(s*.25,.435,0);let wrist=body(s*.36,-.03,.045);
   l.shoulderJoint.setLocalPosition(...body(s*.222,.419,0));
   wrist=mix(wrist,body(s*.245,.41,.51),reach);
   if(s<0)wrist=mix(wrist,body(-.51+.044*Math.sin(t*10),.70,.10),wave);
   if(s<0)wrist=mix(wrist,body(-.37,.39,.32),thumbs);
   const e=ik(shoulder,wrist,.285,.27,[s, -.28, -.12]);
   segment(l.sleeve,shoulder,mix(shoulder,e,.67),.215);segment(l.arm,mix(shoulder,e,.25),e,.245);segment(l.forearm,e,wrist,.25);l.elbow.setLocalPosition(...e);
   l.hand.setLocalPosition(...wrist);
   const restQ=new pc.Quat().setFromDirections(pc.Vec3.UP,V(wrist).sub(V(e)).normalize());
   const gestureQ=new pc.Quat().setFromEulerAngles(65*reach,-15*thumbs,s<0?wave*(8+17*Math.sin(t*10))-8*thumbs:6);
   l.hand.setLocalRotation(new pc.Quat().slerp(restQ,gestureQ,Math.min(1,reach+(s<0?wave+thumbs:0))));
   for(let j=0;j<4;j++)l.fingers[j].setLocalEulerAngles(s<0?thumbs*112:12,0,(j-1.5)*(s<0?wave*7:2));
   l.thumb.setLocalEulerAngles(0,0,s*(50*(1-thumbs)*(1-wave)+wave*40));
  }
  return {q,hip,feet:feet.map(f=>f.getLocalPosition().toArray()),head:head.getPosition().toArray()};
 }
 return {root,pose};
}
