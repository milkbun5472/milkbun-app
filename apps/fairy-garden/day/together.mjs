import * as T from 'three';
import './social.js?v=fg-d74ba995b6579beb';
import {findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-d74ba995b6579beb';
import {stepRoute} from '../locomotion.mjs?v=fg-d74ba995b6579beb';
import {furniturePoint,furnitureSeat,HOME_PREP} from './home-catalog.mjs?v=fg-d74ba995b6579beb';
import {pairProgress} from './motion-profile.mjs?v=fg-d74ba995b6579beb';
import {dailyTaskAt} from './daily-workflow.mjs?v=fg-d74ba995b6579beb';
import {INTIMATE,createIntimate} from './intimate.mjs?v=fg-d74ba995b6579beb';


import {pairSpacing,pairContact,nearHand,bonePoint,shoulderPose,hugPose} from './pair-pose.mjs?v=fg-d74ba995b6579beb';

export const TOGETHER_LABELS=globalThis.CharDaySocial.labels;
const mapId=m=>m.id||m.renderer;
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),avoid=(p,r=.72)=>[{...p,r}];
function sofaPair(map,offset=.6,leaner=null){
 return map.furniture.filter(p=>['sofa','bench'].includes(p.kind)&&!p.stored).flatMap(p=>[-1,1].flatMap(side=>{
  const approaches=[{x:-p.w/2-.6,z:.25},{x:p.w/2+.6,z:.25},{x:-offset*side,z:p.d/2+.75},{x:offset*side,z:p.d/2+.75}].map(q=>furniturePoint(p,q));
  return approaches.flatMap(a=>approaches.map(b=>({a:furnitureSeat(p,a,{x:-offset*side,z:.05+(leaner==='a'?.12:0)}),b:furnitureSeat(p,b,{x:offset*side,z:.05+(leaner==='b'?.12:0)})})));
 }));
}
const clearance=(kind,distance)=>Math.min(INTIMATE[kind]?.48:.72,(distance||INTIMATE[kind]?.distance||(kind==='hug'?.34:.78))-.08);
function pairFormation(center,heading,spacing){return {a:{x:center.x-Math.cos(heading)*spacing/2,z:center.z+Math.sin(heading)*spacing/2},b:{x:center.x+Math.cos(heading)*spacing/2,z:center.z-Math.sin(heading)*spacing/2}};}
// Admission and continuing walks use the same actual feet paths and turn sweep.
function pairWalkRoute(map,at,heading,spacing,round=0){
 const id=mapId(map),center={x:(at.a.x+at.b.x)/2,z:(at.a.z+at.b.z)/2};
 const directions=(map.wander||[]).map(q=>({x:q.x-center.x,z:q.z-center.z})).filter(q=>Math.hypot(q.x,q.z)>1);
 for(let n=0;n<8;n++){const angle=(n+round)*Math.PI/4;directions.push({x:Math.sin(angle)*2.6,z:Math.cos(angle)*2.6});}
 for(const dir of directions){
  const length=Math.hypot(dir.x,dir.z),nextHeading=Math.atan2(dir.x,dir.z),placed=pairFormation(center,nextHeading,spacing),delta=Math.atan2(Math.sin(nextHeading-heading),Math.cos(nextHeading-heading));
  if(!Array.from({length:17},(_,i)=>pairFormation(center,heading+delta*i/16,spacing)).every(q=>['a','b'].every(w=>walkable(q[w].x,q[w].z,id)))||!['a','b'].every(w=>segmentClear(at[w],placed[w],id)))continue;
  for(const distance of [2.6,1.8,1,.6]){const step=Math.min(distance,length),goal={x:center.x+dir.x/length*step,z:center.z+dir.z/length*step},next=pairFormation(goal,nextHeading,spacing);
   if(['a','b'].every(w=>segmentClear(placed[w],next[w],id)))return {heading:nextHeading,route:[goal]};
  }
 }
 return null;
}
export function togetherPlans(map,kind,from,{initiator='b',distance=null}={}){
 let choices=[];
 if(['shoulder','closer','wait','rest','cuddle'].includes(kind)||(['read','feed'].includes(kind)&&map.furniture.some(p=>['sofa','bench'].includes(p.kind))))choices=sofaPair(map,distance?distance/2:kind==='cuddle'||kind==='shoulder'?.32:kind==='feed'?.32:kind==='closer'?.345:.37,['shoulder','cuddle'].includes(kind)?initiator:null).map(q=>({a:q.a.approach,b:q.b.approach,seats:q}));
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
   const heading=['hug','back-hug','dance'].includes(kind)?angle:angle-Math.PI/2,s=Math.sin(angle),v=Math.cos(angle),spacing=distance||INTIMATE[kind]?.distance||(kind==='hug'?.29:kind==='stretch'?1.8:kind==='walk'?.61:kind==='hand'?.61:.78);
   const plan={a:{x:c.x-s*spacing/2,z:c.z-v*spacing/2},b:{x:c.x+s*spacing/2,z:c.z+v*spacing/2},heading};
   if(kind==='back-hug'&&initiator==='b')plan.heading+=Math.PI;
   if(['hug','back-hug'].includes(kind)){const lateral=kind==='hug'?.22:.20;plan.a.x-=Math.cos(plan.heading)*lateral/2;plan.a.z+=Math.sin(plan.heading)*lateral/2;plan.b.x+=Math.cos(plan.heading)*lateral/2;plan.b.z-=Math.sin(plan.heading)*lateral/2;}
   const room=['kiss','kiss-forehead','kiss-cheek','forehead','dance'].includes(kind);
   if(!room||Array.from({length:16},(_,i)=>{const t=i*Math.PI/8,rad=kind==='kiss-forehead'?.95:.75;return walkable(c.x+Math.sin(t)*rad,c.z+Math.cos(t)*rad,mapId(map));}).every(Boolean))choices.push(plan);
  }
 }
 return choices.map(p=>{
  if(!walkable(p.a.x,p.a.z,mapId(map))||!walkable(p.b.x,p.b.z,mapId(map))||gap(p.seats?.a||p.a,p.seats?.b||p.b)<(distance?distance-.03:kind==='hug'?.32:INTIMATE[kind]?.distance?INTIMATE[kind].distance-.02:(INTIMATE[kind]?.seated||kind==='feed')?.60:['shoulder','hand','walk'].includes(kind)?.58:.65))return null;
  if((kind==='walk'||INTIMATE[kind]?.tour)&&!pairWalkRoute(map,p,p.heading,distance||INTIMATE[kind]?.distance||.61))return null;
  const aRoute=findPath(from.a,p.a,mapId(map),avoid(from.b));
  const bRoute=findPath(from.b,p.b,mapId(map),avoid(p.seats?.a||p.a,clearance(kind,distance)));
  return aRoute&&bRoute?{...p,aRoute,bRoute,cost:gap(from.a,p.a)+gap(from.b,p.b)}:null;
 }).filter(Boolean).sort((a,b)=>a.cost-b.cost);
}
// Both participants use the existing navigation and original traveler rig. Nothing is saved.
export function createTogether({a,b,map,from,motion=()=>({}),pair=()=>({}),visibility=()=>0,kitchen=()=>null,onUpdate=()=>{},onStop=()=>{}}){
 let session=null,last='';
 const cup=new T.Group();cup.name='TogetherCup';cup.visible=false;a.root.add(cup);
 const material=new T.MeshStandardMaterial({color:'#d6e7df',roughness:.75});
 const bowl=new T.Mesh(new T.CylinderGeometry(.065,.05,.13,16),material);bowl.position.y=.055;cup.add(bowl);
 const handle=new T.Mesh(new T.TorusGeometry(.04,.012,8,16),material);handle.position.set(.06,.055,0);cup.add(handle);
 const tea=new T.Mesh(new T.CylinderGeometry(.054,.054,.007,16),new T.MeshStandardMaterial({color:'#a78055'}));tea.position.y=.122;cup.add(tea);
 const style=who=>({style:'gentle',delay:.35,reach:1.1,lean:.1,sway:.008,phase:0,...pair()[who]});
 const intimate=createIntimate({a,b,map,style});
 const contact=pairContact;
 a.root.userData.pairWho='ta';b.root.userData.pairWho='me';
 const inspect=()=>session?{kind:session.kind,label:TOGETHER_LABELS[session.kind],phase:session.phase,a:{...session.a},b:{...session.b},seats:session.plan.seats||null,intimate:intimate.inspect(),contact:session.contact||null,initiator:session.initiator,tour:session.tour?{moving:session.tour.moving,round:session.tour.round}:null,elapsed:session.elapsed,automatic:session.automatic,styles:{a:style('a'),b:style('b')},aTask:session.aTask,bTask:session.bTask}:null;
 function tell(){const s=inspect(),key=JSON.stringify(s&&[s.kind,s.phase]);if(key!==last){last=key;onUpdate(s);}}
 function stop(reason='已松开，继续各自做事。'){if(!session)return false;const s=session;session=null;cup.visible=false;intimate.hide();last='';onStop({a:s.a,b:s.b,seats:s.plan.seats?{a:s.phase==='walking-ta'?null:s.plan.seats.a,b:s.phase==='active'?s.plan.seats.b:null}:null,reason,automatic:s.automatic});onUpdate(null);return true;}
 function start(kind,{automatic=false,initiator='b'}={}){if(!TOGETHER_LABELS[kind])return {ok:false,reason:'这个互动还没有位置。'};
  if(session)stop();initiator=initiator==='a'?'a':'b';const origins=from(),plan=togetherPlans(map(),kind,origins,{initiator,distance:pairSpacing(kind,a,b)}).map(p=>({...p,viewCost:p.cost+visibility({...p,kind})})).sort((a,b)=>a.viewCost-b.viewCost)[0];
  if(!plan)return {ok:false,reason:kind==='cook'?'厨房前没有两个人能走到的位置。':['read','shoulder','cuddle'].includes(kind)?'先摆一张能走到的双人沙发或长椅。':kind==='meal'?'餐桌旁需要两把能走到的空椅子。':kind==='feed'?'先留一张能走近的餐桌或双人座位。':'附近没有两个人能站稳的空地。'};
  session={kind,automatic,initiator,plan,a:{...origins.a},b:{...origins.b},phase:'walking-ta',elapsed:0,speed:0,clearance:clearance(kind,pairSpacing(kind,a,b)),tour:kind==='walk'||INTIMATE[kind]?.tour?{moving:false,wait:0,round:0}:null};tell();return {ok:true};
 }
 function pose(actor,at,seated,heading,time,moving,task,profile,gesture='rest',progress=0,dt=.025){actor.root.position.set(at.x,0,at.z);const turn=Math.atan2(Math.sin(heading-actor.root.rotation.y),Math.cos(heading-actor.root.rotation.y));actor.root.rotation.y+=T.MathUtils.clamp(turn,-4*dt,4*dt);actor.animate(time,{moving,seated:!!seated,seatPose:seated?.pose,gesture,progress,task,motion:profile,height:floorHeight(mapId(map()),at)+(seated?seated.rise+.05:0)});}
 function walkTogether(s,dt){
  const tour=s.tour,id=mapId(map()),center={x:(s.a.x+s.b.x)/2,z:(s.a.z+s.b.z)/2},spacing=pairSpacing(s.kind,a,b),formation=(c,h)=>pairFormation(c,h,spacing);
  const clear=(next)=>['a','b'].every(w=>walkable(next[w].x,next[w].z,id)&&segmentClear(s[w],next[w],id));
  if(!tour.moving){tour.wait-=dt;if(tour.wait>0)return;
   const next=pairWalkRoute(map(),s,tour.heading??s.plan.heading,spacing,tour.round);
   if(!next){tour.wait=2;return;}
   tour.heading??=s.plan.heading;tour.targetHeading=next.heading;tour.route=next.route;tour.speed=0;tour.moving=true;tour.round++;
  }
  const turn=Math.atan2(Math.sin(tour.targetHeading-tour.heading),Math.cos(tour.targetHeading-tour.heading));
  if(Math.abs(turn)>.001){const heading=tour.heading+T.MathUtils.clamp(turn,-1.8*dt,1.8*dt),next=formation(center,heading);if(!clear(next)){tour.moving=false;tour.wait=2;return;}tour.heading=heading;s.a={...next.a,heading};s.b={...next.b,heading};return;}
  const step=stepRoute(center,tour.route,dt,{speed:tour.speed,walkSpeed:1.25*Math.min(motion().a?.walk||1,motion().b?.walk||1),clear:(u,v)=>{const before=formation(u,tour.heading),after=formation(v,tour.heading);return ['a','b'].every(w=>segmentClear(before[w],after[w],id));}}),next=formation(step.position,tour.heading);tour.speed=step.speed;
  s.a={...next.a,heading:tour.heading};s.b={...next.b,heading:tour.heading};if(step.blocked||!tour.route.length){tour.moving=false;tour.wait=1.4;}
 }
 function tick(dt,time){if(!session)return false;const s=session,p=s.plan;s.elapsed+=dt;
  const who=s.phase==='walking-ta'?'a':s.phase==='walking-you'?'b':null;
  if(who){const route=who==='a'?p.aRoute:p.bRoute,other=who==='a'?s.b:p.seats?.a||s.a;
   const step=stepRoute(s[who],route,dt,{speed:s.speed,walkSpeed:1.45*(motion()[who]?.walk||1),clear:(u,v)=>segmentClear(u,v,mapId(map()),avoid(other,s.clearance))});s[who]=step.position;s.speed=step.speed;if(step.heading!=null)s[who].heading=step.heading;
   if(step.blocked){stop('两个人的路线被挡住了，可以换个位置再试。');return false;}
   if(!route.length){s.phase=who==='a'?'walking-you':'turning';s.speed=0;s.elapsed=0;tell();}
  }
  if(s.phase==='active'&&s.tour)walkTogether(s,dt);
  const active=s.phase==='active',aSeated=p.seats&&s.phase!=='walking-ta'?p.seats.a:null,bSeated=active||s.phase==='turning'?p.seats?.b:null;
  const aa=aSeated||s.a,bb=bSeated||s.b;
  let ah=aSeated?.heading??(s.phase==='walking-ta'?s.a.heading||0:p.heading||0),bh=bSeated?.heading??(s.phase==='walking-you'?s.b.heading||0:p.heading||0);
  if((active||s.phase==='turning')&&(['hug','look','cup','pat','kiss-forehead','kiss-cheek','kiss','forehead','dance'].includes(s.kind)||s.kind==='feed'&&!p.seats)){ah=s.kind==='hug'||s.kind==='dance'?p.heading:Math.atan2(p.b.x-p.a.x,p.b.z-p.a.z);bh=ah+Math.PI;}
  const daily=(who,kind)=>({daily:true,kind,elapsed:s.elapsed,progress:((s.elapsed*(motion()[who]?.tempo||1)+(motion()[who]?.phase||0))/(kind==='read'?9:kind==='eat'?5.5:7))%1});
  let at=null,bt=null;
  if(active&&['read','meal','drink'].includes(s.kind)){const kind={read:'read',meal:'eat',drink:'drink'}[s.kind];at=daily('a',kind);bt=daily('b',kind);}

  if(active&&s.kind==='cook'){at=dailyTaskAt({action:'cook'},p.spot,map(),s.elapsed,{motion:motion().a});const target={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.handZ}),y:HOME_PREP.handY},contact={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.contactZ}),y:HOME_PREP.contactY};bt={...daily('b','prep'),target,contact};}
  const cooking=kitchen(),job=cooking?.job;
  if(active&&job?.kind===s.kind){const stage=globalThis.CharDayKitchen.cookingStage(job,cooking.elapsed);
   if(s.kind==='meal'){const courses=job.courses||[{recipeId:job.recipeId}],course=courses[Math.min(courses.length-1,Math.floor(cooking.elapsed/2.7))],r=globalThis.CharDayKitchen.recipe(course.recipeId);at={...at,kind:r?.food==='drink'?'drink':'eat',recipeId:r?.id};bt={...bt,kind:at.kind,recipeId:r?.id};}
   if(s.kind==='cook'){const method=stage.method,passive=stage.index===2||stage.index===1&&['bake','steam','brew'].includes(method);at=passive?null:{...at,recipeId:job.recipeId,method,stage:stage.index};bt=passive?null:{...bt,recipeId:job.recipeId,method,stage:stage.index};}
  }
  s.aTask=at;s.bTask=bt;
  if(s.tour){ah=s.tour.heading??p.heading;bh=ah;}
  const gesture=active&&s.kind==='stretch'?'stretch':'rest',progress=(s.elapsed/4)%1;
  pose(a,aa,aSeated,ah,time,s.phase==='walking-ta'||!!s.tour?.moving,at,motion().a,gesture,progress,dt);pose(b,bb,bSeated,bh,time,s.phase==='walking-you'||!!s.tour?.moving,bt,motion().b,gesture,(progress+.12)%1,dt);
  if(s.phase==='turning'&&[ [a,ah],[b,bh] ].every(([actor,heading])=>Math.abs(Math.atan2(Math.sin(heading-actor.root.rotation.y),Math.cos(heading-actor.root.rotation.y)))<.001)){s.phase='active';s.elapsed=0;tell();}
  if(active&&s.kind==='browse'){for(const [actor,at,offset] of [[a,aa,0],[b,bb,.8]]){const local=new T.Vector3(at.x,0,at.z).sub(new T.Vector3(p.piece.x,0,p.piece.z)).applyAxisAngle(new T.Vector3(0,1,0),-(p.piece.heading||0)),point=furniturePoint(p.piece,{x:local.x,z:p.piece.d/2-.08}),target=new T.Vector3(point.x,.96+Math.sin(s.elapsed+offset)*.05,point.z);actor.contactPose({[nearHand(actor,target)]:target});}}
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
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);const as=nearHand(a,b.root.position),bs=nearHand(b,a.root.position),mid=bonePoint(a,as==='left'?'Left_hand':'Right_hand').add(bonePoint(b,bs==='left'?'Left_hand':'Right_hand')).multiplyScalar(.5);
   mid.y=Math.min(bonePoint(a,as+'Arm')?.y||mid.y+.16,bonePoint(b,bs+'Arm')?.y||mid.y+.16)-.16;mid.add(new T.Vector3(Math.sin(ah)*.04,0,Math.cos(ah)*.04));const contacts=[];contact(a,{[as]:mid},pa,contacts);contact(b,{[bs]:mid},pb,contacts);s.contact={contacts};
  }
  if(active&&s.kind==='hug')s.contact=hugPose(a,b,pa,pb);
  if(active&&s.kind==='shoulder'){const leaning=s.initiator==='a'?a:b,holder=leaning===a?b:a;s.contact=shoulderPose(holder,leaning,leaning===a?pa:pb,{holderProgress:holder===a?pa:pb});}
  if(active&&s.kind==='closer'){a.contactPose({lean:0});b.contactPose({lean:0});}
  if(active&&INTIMATE[s.kind]){const result=intimate.tick(s);if(!p.seats&&!s.tour){s.a={...s.a,x:a.root.position.x,z:a.root.position.z};s.b={...s.b,x:b.root.position.x,z:b.root.position.z};}if(result?.ok===false){stop(result.reason);return false;}}
  onUpdate({...inspect(),bSeat:bSeated,moving:s.phase!=='active'||!!s.tour?.moving});return true;
 }
 return {start,stop,tick,inspect};
}
