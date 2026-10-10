import * as T from 'three';
import {findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-337e28073d0dffaf';
import {stepRoute} from '../locomotion.mjs?v=fg-337e28073d0dffaf';
import {furniturePoint,furnitureSeat,HOME_PREP} from './home-catalog.mjs?v=fg-337e28073d0dffaf';
import {dailyTaskAt} from './daily-workflow.mjs?v=fg-337e28073d0dffaf';

export const TOGETHER_LABELS={hand:'牵手',hug:'拥抱',shoulder:'靠肩',read:'一起看书',meal:'一起吃饭',cook:'一起做饭'};
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),avoid=(p,r=.72)=>[{...p,r}];
function sofaPair(map,offset=.6){
 return map.furniture.filter(p=>p.kind==='sofa'&&!p.stored).flatMap(p=>[-1,1].flatMap(side=>{
  const approaches=[{x:-p.w/2-.6,z:.25},{x:p.w/2+.6,z:.25},{x:-offset*side,z:p.d/2+.75},{x:offset*side,z:p.d/2+.75}].map(q=>furniturePoint(p,q));
  return approaches.flatMap(a=>approaches.map(b=>({a:furnitureSeat(p,a,{x:-offset*side,z:.05}),b:furnitureSeat(p,b,{x:offset*side,z:.05})})));
 }));
}
export function togetherPlans(map,kind,from){
 let choices=[];
 if(['read','shoulder'].includes(kind))choices=sofaPair(map,kind==='shoulder'?.42:.6).map(q=>({a:q.a.approach,b:q.b.approach,seats:q}));
 else if(kind==='meal'){
  const tables=map.furniture.filter(p=>p.kind==='table'&&p.dining&&!p.stored),chairs=map.furniture.filter(p=>p.kind==='chair'&&!p.stored);
  for(const table of tables)for(const a of chairs)for(const b of chairs){if(a.id===b.id||gap(a,table)>2||gap(b,table)>2)continue;
   const chairSeat=p=>furnitureSeat(p,furniturePoint(p,{x:-.9,z:0}));const seats={a:chairSeat(a),b:chairSeat(b)};
   choices.push({a:seats.a.approach,b:seats.b.approach,seats});
  }
 }else if(kind==='cook'){
  const spot=map.spots.find(p=>p.action==='cook'),piece=map.furniture.find(p=>p.id===spot?.piece);
  if(spot&&piece){const b=furniturePoint(piece,{x:HOME_PREP.x-.19,z:piece.d/2+.25});choices.push({a:spot.target,b,heading:spot.heading,spot,piece});}
 }else{
  const center={x:(from.a.x+from.b.x)/2,z:(from.a.z+from.b.z)/2};
  for(const r of [0,1,2,3])for(let n=0;n<16;n++){
   const angle=n*Math.PI/8,c={x:center.x+Math.cos(angle)*r,z:center.z+Math.sin(angle)*r};
   const heading=kind==='hug'?angle:angle-Math.PI/2,s=Math.sin(angle),v=Math.cos(angle),distance=kind==='hug'?.34:.78;
   choices.push({a:{x:c.x-s*distance/2,z:c.z-v*distance/2},b:{x:c.x+s*distance/2,z:c.z+v*distance/2},heading});
  }
 }
 return choices.map(p=>{
  if(!walkable(p.a.x,p.a.z,'dayHome')||!walkable(p.b.x,p.b.z,'dayHome')||gap(p.a,p.b)<(kind==='hug'?.32:.75))return null;
  const aRoute=findPath(from.a,p.a,'dayHome',avoid(from.b));
  const bRoute=findPath(from.b,p.b,'dayHome',avoid(p.seats?.a||p.a,kind==='hug'?.30:.72));
  return aRoute&&bRoute?{...p,aRoute,bRoute,cost:gap(from.a,p.a)+gap(from.b,p.b)}:null;
 }).filter(Boolean).sort((a,b)=>a.cost-b.cost);
}
// Both participants use the existing navigation and original traveler rig. Nothing is saved.
export function createTogether({a,b,map,from,motion=()=>({}),onUpdate=()=>{},onStop=()=>{}}){
 let session=null,last='';
 const inspect=()=>session?{kind:session.kind,label:TOGETHER_LABELS[session.kind],phase:session.phase,a:{...session.a},b:{...session.b},seats:session.plan.seats||null,elapsed:session.elapsed,aTask:session.aTask,bTask:session.bTask}:null;
 function tell(){const s=inspect(),key=JSON.stringify(s&&[s.kind,s.phase]);if(key!==last){last=key;onUpdate(s);}}
 function stop(reason='已松开，继续各自做事。'){if(!session)return false;const s=session;session=null;last='';onStop({a:s.a,b:s.b,seats:s.plan.seats,reason});onUpdate(null);return true;}
 function start(kind){if(!TOGETHER_LABELS[kind])return {ok:false,reason:'这个互动还没有位置。'};
  if(session)stop();const origins=from(),plan=togetherPlans(map(),kind,origins)[0];
  if(!plan)return {ok:false,reason:kind==='cook'?'厨房前没有两个人能走到的位置。':['read','shoulder'].includes(kind)?'先摆一张能走到的双人沙发。':kind==='meal'?'餐桌旁需要两把能走到的空椅子。':'附近没有两个人能站稳的空地。'};
  session={kind,plan,a:{...origins.a},b:{...origins.b},phase:'walking-ta',elapsed:0,speed:0};tell();return {ok:true};
 }
 function pose(actor,at,seated,heading,time,moving,task,profile){actor.root.position.set(at.x,0,at.z);actor.root.rotation.y=heading;actor.animate(time,{moving,seated:!!seated,gesture:'rest',task,motion:profile,height:floorHeight('dayHome',at)+(seated?seated.rise+.05:0)});}
 function tick(dt,time){if(!session)return false;const s=session,p=s.plan;s.elapsed+=dt;
  const who=s.phase==='walking-ta'?'a':s.phase==='walking-you'?'b':null;
  if(who){const route=who==='a'?p.aRoute:p.bRoute,other=who==='a'?s.b:p.seats?.a||s.a;
   const step=stepRoute(s[who],route,dt,{speed:s.speed,walkSpeed:1.45*(motion()[who]?.walk||1),clear:(u,v)=>segmentClear(u,v,'dayHome',avoid(other,s.kind==='hug'?.30:.72))});s[who]=step.position;s.speed=step.speed;if(step.heading!=null)s[who].heading=step.heading;
   if(step.blocked){stop('两个人的路线被挡住了，可以换个位置再试。');return false;}
   if(!route.length){s.phase=who==='a'?'walking-you':'active';s.speed=0;s.elapsed=0;tell();}
  }
  const active=s.phase==='active',aSeated=p.seats&&s.phase!=='walking-ta'?p.seats.a:null,bSeated=active?p.seats?.b:null;
  const aa=aSeated||s.a,bb=bSeated||s.b;
  let ah=aSeated?.heading??(s.phase==='walking-ta'?s.a.heading||0:p.heading||0),bh=bSeated?.heading??(s.phase==='walking-you'?s.b.heading||0:p.heading||0);
  if(active&&s.kind==='hug'){ah=Math.atan2(bb.x-aa.x,bb.z-aa.z);bh=ah+Math.PI;}
  const daily=(who,kind)=>({daily:true,kind,elapsed:s.elapsed,progress:((s.elapsed*(motion()[who]?.tempo||1)+(motion()[who]?.phase||0))/(kind==='read'?9:kind==='eat'?5.5:7))%1});
  let at=null,bt=null;
  if(active&&['read','meal'].includes(s.kind)){at=daily('a',s.kind==='meal'?'eat':'read');bt=daily('b',s.kind==='meal'?'eat':'read');}
  if(active&&s.kind==='cook'){at=dailyTaskAt({action:'cook'},p.spot,map(),s.elapsed,{motion:motion().a});const target={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.handZ}),y:HOME_PREP.handY},contact={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.contactZ}),y:HOME_PREP.contactY};bt={...daily('b','prep'),target,contact};}
  s.aTask=at;s.bTask=bt;
  pose(a,aa,aSeated,ah,time,s.phase==='walking-ta',at,motion().a);pose(b,bb,bSeated,bh,time,s.phase==='walking-you',bt,motion().b);
  if(active&&s.kind==='hand'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
   const ap=a.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),bp=b.root.getObjectByName('Left_hand').getWorldPosition(new T.Vector3()),mid=ap.add(bp).multiplyScalar(.5);
   a.contactPose({right:mid});b.contactPose({left:mid});
  }
  if(active&&s.kind==='hug'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
   a.contactPose({lean:.10});b.contactPose({lean:.10});
   const chest=actor=>actor.root.getObjectByName('HeadAnchor').localToWorld(new T.Vector3(0,-1.45,.50));
   const targets=actor=>{const q=chest(actor),axis=new T.Vector3(.17,0,0).applyAxisAngle(new T.Vector3(0,1,0),actor.root.rotation.y);return {left:q.clone().add(axis),right:q.clone().sub(axis)};};
   a.contactPose(targets(b));b.contactPose(targets(a));
  }
  if(active&&s.kind==='shoulder'){const sign=Math.sign((bb.x-aa.x)*Math.cos(ah)-(bb.z-aa.z)*Math.sin(ah))||1;a.contactPose({lean:-sign*.10});b.contactPose({lean:sign*.22});}
  onUpdate({...inspect(),bSeat:bSeated,moving:s.phase!=='active'});return true;
 }
 return {start,stop,tick,inspect};
}
