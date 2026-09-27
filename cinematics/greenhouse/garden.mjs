// All renderer objects stay within this standalone cinematic viewport.
export function buildGarden(pc,app){
 const mat=(name,hex)=>{const m=new pc.StandardMaterial();m.name=name;m.diffuse.fromString(hex);m.gloss=.18;m.useSkybox=false;m.update();return m;};
 const clay=mat('Warm terracotta','#bb603c'),rim=mat('Terracotta rim','#d38555'),soil=mat('Potting soil','#30231d'),green=mat('Moss green canvas','#526841'),shirt=mat('Linen sleeves','#d6c89d'),boot=mat('Brown boots','#513324'),black=mat('Two dark eyes','#211d16'),leaf=mat('Sprout leaves','#7b9a3e'),brass=mat('Aged brass watering can','#ad9051'),waterMat=mat('Pale blue water','#aed9df');
 const group=(name,parent=app.root)=>{const e=new pc.Entity(name);parent.addChild(e);return e;};
 const mesh=(name,g,m,parent,pos=[0,0,0],scale=[1,1,1])=>{const e=group(name,parent);e.addComponent('render',{meshInstances:[new pc.MeshInstance(pc.Mesh.fromGeometry(app.graphicsDevice,g),m)],castShadows:false});e.setLocalPosition(...pos);e.setLocalScale(...scale);return e;};
 const box=(name,parent,m,p,s)=>mesh(name,new pc.BoxGeometry(),m,parent,p,s);
 const cone=(name,parent,m,p,r0,r1,h)=>mesh(name,new pc.ConeGeometry({baseRadius:r0,peakRadius:r1,height:h,heightSegments:1,capSegments:8}),m,parent,p);
 const sphere=(name,parent,m,p,s)=>mesh(name,new pc.SphereGeometry({latitudeBands:8,longitudeBands:12}),m,parent,p,s);
 const rod=(name,parent,m,a,b,r=.04)=>{const av=new pc.Vec3(...a),bv=new pc.Vec3(...b);const e=cone(name,parent,m,av.clone().add(bv).mulScalar(.5).toArray(),r,r,av.distance(bv));e.setLocalRotation(new pc.Quat().setFromDirections(pc.Vec3.UP,bv.sub(av).normalize()));return e;};
 const torus=(name,parent,m,p,r,t)=>mesh(name,new pc.TorusGeometry({ringRadius:r,tubeRadius:t,segments:16,sides:6}),m,parent,p);
 const sprite=group('ONE garden sprite');sprite.setLocalEulerAngles(0,45,0);
 const body=group('Body sway',sprite);
 box('Overalls',body,green,[0,.78,0],[.58,.67,.38]);
 box('Linen chest',body,shirt,[0,1.02,.005],[.54,.25,.36]);box('Bib',body,green,[0,.94,.205],[.35,.35,.06]);
 for(const x of [-.21,.21]){box('Overall strap',body,green,[x,1.04,.208],[.09,.29,.055]);sphere('Brass button',body,brass,[x,.99,.248],[.065,.065,.032]);}
 box('Bib pocket',body,green,[0,.83,.245],[.21,.15,.04]);
 const head=group('Nodding pot head',body);head.setLocalPosition(0,1.13,0);
 cone('Pot head',head,clay,[0,.27,0],.30,.40,.49);cone('Thick head rim',head,rim,[0,.53,0],.425,.425,.12);cone('Head soil',head,soil,[0,.596,0],.365,.365,.018);
 for(const x of [-.13,.13])sphere('Dark eye',head,black,[x,.29,.347],[.087,.119,.045]);
 rod('Sprout stalk',head,leaf,[0,.60,0],[.035,.88,0],.028);
 const l1=box('Left sprout leaf',head,leaf,[-.10,.82,0],[.25,.07,.13]);l1.setLocalEulerAngles(0,10,-28);
 const l2=box('Right sprout leaf',head,leaf,[.14,.88,0],[.27,.07,.14]);l2.setLocalEulerAngles(0,-10,25);
 const feet=[],legs=[];
 for(const x of [-.18,.18]){const e=group(x<0?'Left boot':'Right boot',sprite);legs.push(box('Articulated trouser leg',sprite,green,[x,.36,0],[.23,.36,.26]));box('Chunky boot',e,boot,[0,.13,.065],[.31,.26,.43]);box('Boot sole',e,soil,[0,.035,.065],[.33,.07,.45]);feet.push(e);}
 const arms=[group('Left arm',body),group('Right arm',body)];
 for(let i=0;i<2;i++){arms[i].setLocalPosition(i===0?-.36:.36,1.03,0);box('Sleeve',arms[i],shirt,[0,-.10,0],[.22,.26,.25]);box('Terracotta hand',arms[i],clay,[0,-.33,0],[.18,.22,.21]);}
 // Separate animatable prop, not fused into the sprite's geometry.
 const can=group('Watering can',sprite);cone('Can body',can,brass,[0,0,0],.20,.22,.34);cone('Can top',can,brass,[0,.17,0],.17,.17,.025);
 const handle=torus('Can handle',can,brass,[-.18,.08,0],.22,.036);handle.setLocalEulerAngles(90,0,0);
 rod('Can spout',can,brass,[.15,-.04,0],[.51,.21,0],.049);cone('Rose nozzle',can,brass,[.54,.23,0],.086,.086,.055).setLocalEulerAngles(0,0,-52);
 const nozzle=group('Water origin',can);nozzle.setLocalPosition(.57,.26,0);
 const pot=group('Separate flowerpot');pot.setPosition(3.43,1.84,6.70);cone('Flowerpot body',pot,clay,[0,.28,0],.25,.36,.56);cone('Flowerpot lip',pot,rim,[0,.54,0],.39,.39,.13);cone('Visible soil',pot,soil,[0,.61,0],.323,.323,.03);
 rod('Seedling',pot,leaf,[0,.63,0],[0,.89,0],.021);box('Seedling leaf',pot,leaf,[-.09,.78,0],[.20,.045,.09]).setLocalEulerAngles(0,0,-28);
 const flower=group('Small cream flower',pot);flower.setLocalPosition(0,.92,0);sphere('Flower center',flower,brass,[0,0,0],[.07,.07,.07]);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;sphere('Petal',flower,shirt,[Math.cos(a)*.075,Math.sin(a)*.075,0],[.1,.1,.05]);}
 // Invisible support is explicit, never derived as collision truth from the splat.
 const support=group('Invisible support plane y=1.84');support.setPosition(2.5,1.84,7.6);support.tags.add('support');support.addComponent('render',{type:'plane',enabled:false});support.setLocalScale(3,1,3);
 waterMat.emissive=new pc.Color(.16,.27,.30);waterMat.update();
 const droplets=Array.from({length:22},(_,i)=>sphere('Water droplet '+i,app.root,waterMat,[0,0,0],[.028,.061,.028]));
 const stream=Array.from({length:12},(_,i)=>cone('Water stream '+i,app.root,waterMat,[0,0,0],1,1,1));
 const shadowMat=mat('Soft contact shade','#1b2411');shadowMat.opacity=.20;shadowMat.blendType=pc.BLEND_NORMAL;shadowMat.depthWrite=false;shadowMat.update();
 const shadows=[sphere('Sprite contact',app.root,shadowMat,[0,0,0],[.85,.013,.63]),sphere('Flowerpot contact',app.root,shadowMat,[3.43,1.853,6.70],[.82,.014,.76])];
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
 const lerp=(a,b,x)=>a+(b-a)*x;
 const animate=t=>{
  const a=smooth((t-4.05)/.95),b=smooth((t-5.25)/.95);const travel=.32*(a+b);
  sprite.setPosition(2.047988+travel*.7071,1.84,8.082012-travel*.7071);
  // World-planted feet: each foot moves once, the root passes over it.
  for(let i=0;i<2;i++){const s=i===1?a:b,x=i===0?-.18:.18;feet[i].setLocalPosition(x+.64*s-travel,.13*Math.sin(Math.PI*s),0);const ankle=feet[i].getLocalPosition().clone().add(new pc.Vec3(0,.25,0)),hip=new pc.Vec3(x,.58,0);legs[i].setLocalPosition(hip.clone().add(ankle).mulScalar(.5));legs[i].setLocalScale(.23,hip.distance(ankle),.26);legs[i].setLocalRotation(new pc.Quat().setFromDirections(pc.Vec3.UP,hip.sub(ankle).normalize()));}
  body.setLocalPosition(0,.026*Math.sin(Math.PI*a)+.026*Math.sin(Math.PI*b),0);
  const lift=smooth((t-6.05)/.9)*(1-smooth((t-11)/1.15));const tip=smooth((t-7)/.65)*(1-smooth((t-10.55)/.65));
  can.setLocalPosition(.53+lift*.06,.61+lift*.53,.12);can.setLocalEulerAngles(0,0,-tip*39);
  arms[0].setLocalEulerAngles(0,0,4+Math.sin(t*1.3)*2);arms[1].setLocalEulerAngles(0,0,lerp(8,88,lift));
  const nod=Math.sin(Math.PI*Math.max(0,Math.min(1,(t-12.2)/1.35)));head.setLocalEulerAngles(nod*17,-18+2*Math.sin(t*.65),0);
  const active=t>=7.65&&t<10.78;const start=nozzle.getPosition();const end=new pc.Vec3(3.60,2.465,6.59);
  droplets.forEach((d,i)=>{d.enabled=active;if(active){const u=(i/22+t*1.8)%1;d.setPosition(lerp(start.x,end.x,u)+Math.sin(i*9+t*5)*.011,lerp(start.y,end.y,u)-.09*Math.sin(Math.PI*u),lerp(start.z,end.z,u));d.setLocalScale(.024,.043+.055*u,.024);}});
  const curve=u=>new pc.Vec3(lerp(start.x,end.x,u),lerp(start.y,end.y,u)-.09*Math.sin(Math.PI*u),lerp(start.z,end.z,u));
  stream.forEach((e,i)=>{e.enabled=active;if(active){const a=curve(i/12),b=curve((i+1)/12);e.setPosition(a.clone().add(b).mulScalar(.5));e.setLocalScale(.022,b.distance(a)+.004,.022);e.setRotation(new pc.Quat().setFromDirections(pc.Vec3.UP,b.sub(a).normalize()));}});
  const p=sprite.getPosition();shadows[0].setPosition(p.x,1.853,p.z);
  return {feet:feet.map(e=>e.getPosition().toArray()),water:active,nozzle:start.toArray(),pot:end.toArray(),sprite:p.toArray()};
 };
 return {animate,sprite,pot,can,support};
}
