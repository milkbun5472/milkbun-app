import * as T from 'three';
// One factory for discoveries and displays. Templates share immutable geometry/materials.
const templates=new Map();
export function makeCurio(form){
 if(templates.has(form))return templates.get(form).clone(true);
 const g=new T.Group();g.name='well-curio:'+form;g.userData.curio=form;
 const mat=(color,glow=0)=>new T.MeshStandardMaterial({color,roughness:.62,metalness:.12,emissive:color,emissiveIntensity:glow});
 const cream=mat('#edd9ae'),gold=mat('#bf915a'),dark=mat('#614b47'),light=mat(form==='seed'?'#bd91e1':form==='thread'?'#c8e99c':'#a7dfe2',.35);
 const mesh=(geo,m,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
 const tube=(points,r,m)=>mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),60,r,7,false),m);
 if(form==='shell'){
  const pts=[];for(let i=0;i<=80;i++){const a=i/80*Math.PI*4.4,r=.035+i/80*.25;pts.push(new T.Vector3(Math.cos(a)*r,.3+Math.sin(a)*r,.06-i/80*.06));}tube(pts,.062,cream);
  const lip=mesh(new T.TorusGeometry(.13,.035,8,24),gold,.22,.17,.015);lip.rotation.y=.7;
  mesh(new T.SphereGeometry(.09,12,8),light,.22,.17,.025);
 }else if(form==='seed'){
  const body=mesh(new T.SphereGeometry(.24,18,14),light,0,.3,0);body.scale.set(.85,1.2,.85);
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,pts=[];for(let j=0;j<=12;j++){const t=j/12;pts.push(new T.Vector3(Math.cos(a+t)*Math.sin(t*Math.PI)*.24,.06+t*.53,Math.sin(a+t)*Math.sin(t*Math.PI)*.24));}tube(pts,.016,gold);}
  const leaf=mesh(new T.SphereGeometry(.1,12,8),mat('#a5be88'),.08,.61,0);leaf.scale.set(1.8,.28,.65);leaf.rotation.z=.5;
 }else if(form==='thread'){
  mesh(new T.CylinderGeometry(.12,.12,.27,16),dark,0,.22,0);
  for(const y of [.08,.37])mesh(new T.CylinderGeometry(.22,.22,.045,20),gold,0,y,0);
  for(let j=0;j<7;j++){const o=mesh(new T.TorusGeometry(.145,.017,6,24),light,0,.11+j*.035,0);o.rotation.x=Math.PI/2;}
  tube([new T.Vector3(.15,.25,0),new T.Vector3(.35,.2,.05),new T.Vector3(.28,.08,.25),new T.Vector3(.05,.075,.3)],.018,light);
 }else if(form==='relic'){
  const o=mesh(new T.BoxGeometry(.43,.31,.3),dark,0,.22,0);o.rotation.y=.15;
  mesh(new T.BoxGeometry(.47,.07,.34),gold,0,.4,0).rotation.y=.15;
  mesh(new T.TorusGeometry(.075,.017,6,20),gold,.015,.23,.17);
  mesh(new T.SphereGeometry(.038,10,8),light,.015,.23,.18);
 }else{
  const o=mesh(new T.CylinderGeometry(.29,.32,.1,6),mat('#819ba5'),0,.27,0);o.rotation.x=Math.PI/2;
  mesh(new T.TorusGeometry(.17,.015,6,32),light,0,.27,.065);
  const pts=[[-.1,.27,.075],[0,.41,.075],[.1,.27,.075],[0,.14,.075],[-.1,.27,.075]].map(a=>new T.Vector3(...a));tube(pts,.014,light);
 }
 templates.set(form,g);return g.clone(true);
}
