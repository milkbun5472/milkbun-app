import * as T from 'three';
import './social.js?v=fg-f9a3c901abadb37b';
import {findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-f9a3c901abadb37b';
import {stepRoute} from '../locomotion.mjs?v=fg-f9a3c901abadb37b';
import {furniturePoint,furnitureSeat,HOME_PREP} from './home-catalog.mjs?v=fg-f9a3c901abadb37b';
import {pairProgress} from './motion-profile.mjs?v=fg-f9a3c901abadb37b';
import {dailyTaskAt} from './daily-workflow.mjs?v=fg-f9a3c901abadb37b';
import {INTIMATE,createIntimate} from './intimate.mjs?v=fg-f9a3c901abadb37b';


export const TOGETHER_LABELS=globalThis.CharDaySocial.labels;
const mapId=m=>m.id||m.renderer;
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),avoid=(p,r=.72)=>[{...p,r}];
function sofaPair(map,offset=.6){
 return map.furniture.filter(p=>['sofa','bench'].includes(p.kind)&&!p.stored).flatMap(p=>[-1,1].flatMap(side=>{
  const approaches=[{x:-p.w/2-.6,z:.25},{x:p.w/2+.6,z:.25},{x:-offset*side,z:p.d/2+.75},{x:offset*side,z:p.d/2+.75}].map(q=>furniturePoint(p,q));
  return approaches.flatMap(a=>approaches.map(b=>({a:furnitureSeat(p,a,{x:-offset*side,z:.05}),b:furnitureSeat(p,b,{x:offset*side,z:.05})})));
 }));
}
const clearance=kind=>kind==='hug'?.30:INTIMATE[kind]?Math.min(.48,(INTIMATE[kind].distance||.58)-.06):.72;
export function togetherPlans(map,kind,from,{initiator='b'}={}){
 let choices=[];
 if(['shoulder','closer','wait','rest','cuddle'].includes(kind)||(['read','feed'].includes(kind)&&map.furniture.some(p=>['sofa','bench'].includes(p.kind))))choices=sofaPair(map,kind==='cuddle'?.36:kind==='feed'?.32:['shoulder','closer'].includes(kind)?.42:.6).map(q=>({a:q.a.approach,b:q.b.approach,seats:q}));
 else if(kind==='feed'){
  for(const table of map.furniture.filter(p=>p.kind==='table'&&!p.stored))for(const side of [-1,1]){
   const a=furniturePoint(table,{x:-.32,z:side*(table.d/2+.85)}),b=furniturePoint(table,{x:.32,z:side*(table.d/2+.85)});choices.push({a,b,piece:table});
   const sideA=furniturePoint(table,{x:side*(table.w/2+.65),z:-.32}),sideB=furniturePoint(table,{x:side*(table.w/2+.65),z:.32});choices.push({a:sideA,b:sideB,piece:table});
  }
 }
 else if(['meal','drink','read'].includes(kind)){
  const tables=map.furniture.filter(p=>p.kind==='table'&&(mapId(map)!=='dayHome'||p.dining)&&!p.stored),chairs=map.furniture.filter(p=>p.kind==='chair'&&!p.stored);
  for(const table of tables)for(const a of chairs)for(const b of chairs){if(a.id===b.id||gap(a,table)>2||gap(b,table)>2)continue;
   const chairSeat=p=>furnitureSeat(p,furniturePoint(p,{x:-.9,z:0}));const seats={a:chairSeat(a),b:chairSeat(b)};
   choices.push({a:seats.a.approach,b:seats.b.approach,seats});
  }
 }else if(kind==='cook'){
  const spot=map.spots.find(p=>p.action==='cook'),piece=map.furniture.find(p=>p.id===spot?.piece);
  if(spot&&piece){const b=furniturePoint(piece,{x:HOME_PREP.x-.19,z:piece.d/2+.25});choices.push({a:spot.target,b,heading:spot.heading,spot,piece});}
 }else if(kind==='stretch'){
  const spot=map.spots.find(s=>s.id==='stretch');if(spot)choices.push({a:{x:spot.target.x-.9,z:spot.target.z},b:{x:spot.target.x+.9,z:spot.target.z},heading:spot.heading});
 }else if(kind==='browse'){
  const spot=map.spots.find(s=>s.id==='produce'),piece=map.furniture.find(p=>p.id===spot?.furniture);
  if(spot&&piece)for(const side of [-1,1])choices.push({a:{x:spot.target.x-side*.48,z:spot.target.z+.16},b:{x:spot.target.x+side*.48,z:spot.target.z+.16},heading:spot.heading,spot,piece});
 }else{
  const center={x:(from.a.x+from.b.x)/2,z:(from.a.z+from.b.z)/2};
  for(const r of [0,1,2,3])for(let n=0;n<16;n++){
   const angle=n*Math.PI/8,c={x:center.x+Math.cos(angle)*r,z:center.z+Math.sin(angle)*r};
   const heading=['hug','back-hug','dance'].includes(kind)?angle:angle-Math.PI/2,s=Math.sin(angle),v=Math.cos(angle),distance=INTIMATE[kind]?.distance||(kind==='hug'?.34:kind==='stretch'?1.8:kind==='walk'?1.1:.78);
   const plan={a:{x:c.x-s*distance/2,z:c.z-v*distance/2},b:{x:c.x+s*distance/2,z:c.z+v*distance/2},heading};
   if(kind==='back-hug'&&initiator==='b')plan.heading+=Math.PI;
   const room=['kiss','kiss-forehead','kiss-cheek','forehead','dance'].includes(kind);
   if(!room||Array.from({length:16},(_,i)=>{const t=i*Math.PI/8,rad=kind==='kiss-forehead'?.95:.75;return walkable(c.x+Math.sin(t)*rad,c.z+Math.cos(t)*rad,mapId(map));}).every(Boolean))choices.push(plan);
  }
 }
 return choices.map(p=>{
  if(!walkable(p.a.x,p.a.z,mapId(map))||!walkable(p.b.x,p.b.z,mapId(map))||gap(p.a,p.b)<(kind==='hug'?.32:INTIMATE[kind]?.distance?INTIMATE[kind].distance-.02:INTIMATE[kind]?.seated?.60:.75))return null;
  const aRoute=findPath(from.a,p.a,mapId(map),avoid(from.b));
  const bRoute=findPath(from.b,p.b,mapId(map),avoid(p.seats?.a||p.a,clearance(kind)));
  return aRoute&&bRoute?{...p,aRoute,bRoute,cost:gap(from.a,p.a)+gap(from.b,p.b)}:null;
 }).filter(Boolean).sort((a,b)=>a.cost-b.cost);
}
// Both participants use the existing navigation and original traveler rig. Nothing is saved.
export function createTogether({a,b,map,from,motion=()=>({}),pair=()=>({}),visibility=()=>0,onUpdate=()=>{},onStop=()=>{}}){
 let session=null,last='';
 const cup=new T.Group();cup.name='TogetherCup';cup.visible=false;a.root.add(cup);
 const material=new T.MeshStandardMaterial({color:'#d6e7df',roughness:.75});
 const bowl=new T.Mesh(new T.CylinderGeometry(.065,.05,.13,16),material);bowl.position.y=.055;cup.add(bowl);
 const handle=new T.Mesh(new T.TorusGeometry(.04,.012,8,16),material);handle.position.set(.06,.055,0);cup.add(handle);
 const tea=new T.Mesh(new T.CylinderGeometry(.054,.054,.007,16),new T.MeshStandardMaterial({color:'#a78055'}));tea.position.y=.122;cup.add(tea);
 const style=who=>pair()[who]||{style:'gentle',delay:.35,reach:1.1,lean:.1,sway:.008,phase:0};
 const intimate=createIntimate({a,b,map,style});
 const contact=(actor,targets,progress,lean=0)=>{actor.root.updateMatrixWorld(true);const adjusted={lean};for(const side of ['left','right'])if(targets[side]){const hand=actor.root.getObjectByName(side==='left'?'Left_hand':'Right_hand');adjusted[side]=hand.getWorldPosition(new T.Vector3()).lerp(targets[side],progress);}actor.contactPose(adjusted);};
 const inspect=()=>session?{kind:session.kind,label:TOGETHER_LABELS[session.kind],phase:session.phase,a:{...session.a},b:{...session.b},seats:session.plan.seats||null,intimate:intimate.inspect(),initiator:session.initiator,tour:session.tour?{moving:session.tour.moving,round:session.tour.round}:null,elapsed:session.elapsed,automatic:session.automatic,styles:{a:style('a'),b:style('b')},aTask:session.aTask,bTask:session.bTask}:null;
 function tell(){const s=inspect(),key=JSON.stringify(s&&[s.kind,s.phase]);if(key!==last){last=key;onUpdate(s);}}
 function stop(reason='已松开，继续各自做事。'){if(!session)return false;const s=session;session=null;cup.visible=false;intimate.hide();last='';onStop({a:s.a,b:s.b,seats:s.plan.seats?{a:s.phase==='walking-ta'?null:s.plan.seats.a,b:s.phase==='active'?s.plan.seats.b:null}:null,reason,automatic:s.automatic});onUpdate(null);return true;}
 function start(kind,{automatic=false,initiator='b'}={}){if(!TOGETHER_LABELS[kind])return {ok:false,reason:'这个互动还没有位置。'};
  if(session)stop();initiator=initiator==='a'?'a':'b';const origins=from(),plan=togetherPlans(map(),kind,origins,{initiator}).map(p=>({...p,viewCost:p.cost+visibility({...p,kind})})).sort((a,b)=>a.viewCost-b.viewCost)[0];
  if(!plan)return {ok:false,reason:kind==='cook'?'厨房前没有两个人能走到的位置。':['read','shoulder','cuddle'].includes(kind)?'先摆一张能走到的双人沙发或长椅。':kind==='meal'?'餐桌旁需要两把能走到的空椅子。':kind==='feed'?'先留一张能走近的餐桌或双人座位。':'附近没有两个人能站稳的空地。'};
  session={kind,automatic,initiator,plan,a:{...origins.a},b:{...origins.b},phase:'walking-ta',elapsed:0,speed:0,tour:kind==='walk'||INTIMATE[kind]?.tour?{moving:false,wait:0,round:0}:null};tell();return {ok:true};
 }
 function pose(actor,at,seated,heading,time,moving,task,profile,gesture='rest',progress=0){actor.root.position.set(at.x,0,at.z);actor.root.rotation.y=heading;actor.animate(time,{moving,seated:!!seated,seatPose:seated?.pose,gesture,progress,task,motion:profile,height:floorHeight(mapId(map()),at)+(seated?seated.rise+.05:0)});}
 function walkTogether(s,dt){
  const tour=s.tour,id=mapId(map());
  if(!tour.moving){tour.wait-=dt;if(tour.wait>0)return;
   const centers=map().wander||[],center={x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2};
   const directions=centers.map(q=>({x:q.x-center.x,z:q.z-center.z})).filter(q=>Math.hypot(q.x,q.z)>1);
   for(let n=0;n<8;n++){const angle=(n+tour.round)*Math.PI/4;directions.push({x:Math.sin(angle),z:Math.cos(angle)});}
   for(const dir of directions){const length=Math.hypot(dir.x,dir.z),d={x:dir.x/length*Math.min(2.6,length),z:dir.z/length*Math.min(2.6,length)},aa={x:s.a.x+d.x,z:s.a.z+d.z},bb={x:s.b.x+d.x,z:s.b.z+d.z};
    if(Math.hypot(d.x,d.z)<.8||!walkable(aa.x,aa.z,id)||!walkable(bb.x,bb.z,id)||!segmentClear(s.a,aa,id,avoid(s.b,clearance(s.kind)))||!segmentClear(s.b,bb,id,avoid(s.a,clearance(s.kind))))continue;
    tour.aRoute=[aa];tour.bRoute=[bb];tour.aSpeed=tour.bSpeed=0;tour.moving=true;tour.round++;break;
   }if(!tour.moving){tour.wait=2;return;}
  }
  for(const who of ['a','b']){const step=stepRoute(s[who],tour[who+'Route'],dt,{speed:tour[who+'Speed'],walkSpeed:1.25*Math.min(motion().a?.walk||1,motion().b?.walk||1),clear:(u,v)=>segmentClear(u,v,id,avoid(s[who==='a'?'b':'a'],clearance(s.kind)))});s[who]=step.position;tour[who+'Speed']=step.speed;if(step.heading!=null)s[who].heading=step.heading;if(step.blocked){tour.moving=false;tour.wait=2;break;}}
  if(!tour.aRoute.length&&!tour.bRoute.length){tour.moving=false;tour.wait=1.4;}
 }
 function tick(dt,time){if(!session)return false;const s=session,p=s.plan;s.elapsed+=dt;
  const who=s.phase==='walking-ta'?'a':s.phase==='walking-you'?'b':null;
  if(who){const route=who==='a'?p.aRoute:p.bRoute,other=who==='a'?s.b:p.seats?.a||s.a;
   const step=stepRoute(s[who],route,dt,{speed:s.speed,walkSpeed:1.45*(motion()[who]?.walk||1),clear:(u,v)=>segmentClear(u,v,mapId(map()),avoid(other,clearance(s.kind)))});s[who]=step.position;s.speed=step.speed;if(step.heading!=null)s[who].heading=step.heading;
   if(step.blocked){stop('两个人的路线被挡住了，可以换个位置再试。');return false;}
   if(!route.length){s.phase=who==='a'?'walking-you':'active';s.speed=0;s.elapsed=0;tell();}
  }
  if(s.phase==='active'&&s.tour)walkTogether(s,dt);
  const active=s.phase==='active',aSeated=p.seats&&s.phase!=='walking-ta'?p.seats.a:null,bSeated=active?p.seats?.b:null;
  const aa=aSeated||s.a,bb=bSeated||s.b;
  let ah=aSeated?.heading??(s.phase==='walking-ta'?s.a.heading||0:p.heading||0),bh=bSeated?.heading??(s.phase==='walking-you'?s.b.heading||0:p.heading||0);
  if(active&&(['hug','look','cup','pat','kiss-forehead','kiss-cheek','kiss','forehead','feed','dance'].includes(s.kind))){ah=Math.atan2(bb.x-aa.x,bb.z-aa.z);bh=ah+Math.PI;}
  const daily=(who,kind)=>({daily:true,kind,elapsed:s.elapsed,progress:((s.elapsed*(motion()[who]?.tempo||1)+(motion()[who]?.phase||0))/(kind==='read'?9:kind==='eat'?5.5:7))%1});
  let at=null,bt=null;
  if(active&&['read','meal','drink'].includes(s.kind)){const kind={read:'read',meal:'eat',drink:'drink'}[s.kind];at=daily('a',kind);bt=daily('b',kind);}

  if(active&&s.kind==='cook'){at=dailyTaskAt({action:'cook'},p.spot,map(),s.elapsed,{motion:motion().a});const target={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.handZ}),y:HOME_PREP.handY},contact={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.contactZ}),y:HOME_PREP.contactY};bt={...daily('b','prep'),target,contact};}
  s.aTask=at;s.bTask=bt;
  if(s.tour?.moving){ah=s.a.heading??ah;bh=s.b.heading??bh;}
  const gesture=active&&s.kind==='stretch'?'stretch':'rest',progress=(s.elapsed/4)%1;
  pose(a,aa,aSeated,ah,time,s.phase==='walking-ta'||!!s.tour?.moving,at,motion().a,gesture,progress);pose(b,bb,bSeated,bh,time,s.phase==='walking-you'||!!s.tour?.moving,bt,motion().b,gesture,(progress+.12)%1);
  if(active&&s.kind==='browse'){const z=p.piece.z+p.piece.d/2-.08;a.contactPose({right:new T.Vector3(aa.x+.08,.96+Math.sin(s.elapsed)*.05,z)});b.contactPose({left:new T.Vector3(bb.x-.08,.96+Math.sin(s.elapsed+.8)*.05,z)});}
  const pa=pairProgress(s.elapsed,style('a')),pb=pairProgress(s.elapsed,style('b'));
  if(active&&s.kind==='look'){
   a.contactPose({lean:Math.sin(s.elapsed*.7+style('a').phase)*style('a').sway});
   b.contactPose({lean:Math.sin(s.elapsed*.7+style('b').phase)*style('b').sway});
  }
  if(active&&s.kind==='cup'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
   const ap=a.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),bp=b.root.getObjectByName('Left_hand').getWorldPosition(new T.Vector3()),mid=ap.clone().add(bp).multiplyScalar(.5);mid.y+=.10;
   contact(a,{right:mid},pa);contact(b,{left:mid},pb);
   const giver=a.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),receiver=b.root.getObjectByName('Left_hand').getWorldPosition(new T.Vector3());
   const exchange=Math.min(pa,pb);cup.visible=true;cup.position.copy(a.root.worldToLocal(giver.lerp(receiver,exchange>.97?Math.min(1,(s.elapsed-3)/2):0)));cup.rotation.y=-a.root.rotation.y;
   cup.userData.holder=exchange>.97&&s.elapsed>=5?'me':'ta';
  }
  if(active&&s.kind==='hand'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
   const ap=a.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),bp=b.root.getObjectByName('Left_hand').getWorldPosition(new T.Vector3()),mid=ap.add(bp).multiplyScalar(.5);
   contact(a,{right:mid},pa,style('a').sway*Math.sin(s.elapsed));contact(b,{left:mid},pb,style('b').sway*Math.sin(s.elapsed+.5));
  }
  if(active&&s.kind==='hug'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
   a.contactPose({lean:style('a').lean*pa});b.contactPose({lean:style('b').lean*pb});
   const chest=actor=>actor.root.getObjectByName('HeadAnchor').localToWorld(new T.Vector3(0,-1.45,.50));
   const targets=actor=>{const q=chest(actor),axis=new T.Vector3(.17,0,0).applyAxisAngle(new T.Vector3(0,1,0),actor.root.rotation.y);return {left:q.clone().add(axis),right:q.clone().sub(axis)};};
   contact(a,targets(b),pa,style('a').lean*pa);contact(b,targets(a),pb,style('b').lean*pb);
  }
  if(active&&['shoulder','closer'].includes(s.kind)){const sign=Math.sign((bb.x-aa.x)*Math.cos(ah)-(bb.z-aa.z)*Math.sin(ah))||1;a.contactPose({lean:-sign*style('a').lean*pa});b.contactPose({lean:sign*style('b').lean*pb});}
  if(active&&INTIMATE[s.kind]){const result=intimate.tick(s);if(!p.seats&&!s.tour){s.a={...s.a,x:a.root.position.x,z:a.root.position.z};s.b={...s.b,x:b.root.position.x,z:b.root.position.z};}if(result?.ok===false){stop(result.reason);return false;}}
  onUpdate({...inspect(),bSeat:bSeated,moving:s.phase!=='active'||!!s.tour?.moving});return true;
 }
 return {start,stop,tick,inspect};
}
