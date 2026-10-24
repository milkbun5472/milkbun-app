import * as T from 'three';
// A few small local particles, built lazily; they follow the actual posed hands/head.
export function makeWeatherEffects(model,handPoint){
 const groups=new Map(),head=model.getObjectByName('HeadAnchor');
 function create(kind){
  const group=new T.Group();group.name='CompanionWeather-'+kind;model.add(group);
  const count=kind==='snow'?5:kind==='breath'?3:kind==='wind'?3:6;
  for(let i=0;i<count;i++){
   const mat=new T.MeshStandardMaterial({color:kind==='rain'||kind==='dry'||kind==='sweat'?'#a9c9d5':'#f9f7ef',transparent:true,opacity:.8,roughness:.8,depthWrite:false});
   let geo;
   if(kind==='wind'){
    const curve=new T.CatmullRomCurve3([new T.Vector3(-.18,0,0),new T.Vector3(0,.025,0),new T.Vector3(.18,0,0)]);geo=new T.TubeGeometry(curve,12,.003,5,false);
   }else if(kind==='snow')geo=new T.OctahedronGeometry(.014,0);
   else geo=new T.SphereGeometry(kind==='breath'?.025:.007,10,7);
   const mesh=new T.Mesh(geo,mat);group.add(mesh);
  }
  return group;
 }
 return {update(pose){
  const kind=pose?.weatherEffect,amount=pose?.weatherAmount||0,p=pose?.weatherPhase||0;
  for(const [name,g]of groups)g.visible=name===kind&&amount>.001;
  if(!kind||amount<=.001)return;
  let group=groups.get(kind);if(!group){group=create(kind);groups.set(kind,group);}group.visible=true;
  const hand=model.worldToLocal(handPoint('left').clone());
  const mouth=head?model.worldToLocal(head.localToWorld(new T.Vector3(.05,-.9,1.05))):new T.Vector3(0,1,.2);
  for(let i=0;i<group.children.length;i++){
   const m=group.children[i],phase=(p*2+i/group.children.length)%1;
   m.scale.setScalar(1);m.material.opacity=amount*.8;
   if(kind==='rain'){
    m.position.copy(hand).add(new T.Vector3((i-2.5)*.019,.28*(1-phase)+.025,.018*Math.sin(i*2)));m.scale.set(.65,2,.65);m.material.opacity*=Math.sin(Math.PI*phase);
   }else if(kind==='snow'){
    const fall=Math.min(1,Math.max(0,(p-.12-i*.035)/.34)),melt=Math.max(0,(p-.55)/.22);
    m.position.copy(hand).add(new T.Vector3(.04+Math.sin(i*2)*.055+.02*Math.sin(p*9+i)*(1-fall),.025+.32*(1-fall),.025+Math.cos(i*2)*.035));m.rotation.set(p*3,i+p*2,p*2);m.scale.setScalar(Math.max(0,1-melt));
   }else if(kind==='breath'){
    m.position.copy(mouth).add(new T.Vector3((i-1)*.025+phase*.035,phase*.035,.035+phase*.15));m.scale.set(1+phase*2,.65+phase,.65+phase*2);m.material.opacity=amount*(1-phase)*.4;
   }else if(kind==='sweat'){
    const at=head?model.worldToLocal(head.localToWorld(new T.Vector3(1,.15-phase*.65,.8))):mouth;
    m.position.copy(at);m.scale.set(.7,1.4,.6);m.material.opacity=amount*(1-phase)*.65;m.visible=i<2;
   }else if(kind==='wind'){
    m.position.set(-.25+phase*.5,.48+i*.16,.3);m.material.opacity=amount*Math.sin(Math.PI*phase)*.55;
   }else{
    m.position.copy(hand).add(new T.Vector3((i-2.5)*.025*(1+phase),.08-phase*.18,.08+phase*.05));m.material.opacity=amount*(1-phase)*.65;
   }
  }
 }};
}
