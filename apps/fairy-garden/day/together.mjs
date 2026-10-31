import * as T from 'three';
import './social.js?v=fg-90b53e2779ab7a1c';
import {findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-90b53e2779ab7a1c';
import {stepRoute} from '../locomotion.mjs?v=fg-90b53e2779ab7a1c';
import {furniturePoint,furnitureSeat,HOME_PREP} from './home-catalog.mjs?v=fg-90b53e2779ab7a1c';
import {pairProgress} from './motion-profile.mjs?v=fg-90b53e2779ab7a1c';
import {dailyTaskAt} from './daily-workflow.mjs?v=fg-90b53e2779ab7a1c';
import {createKitchenPair} from './kitchen-pair.mjs?v=fg-90b53e2779ab7a1c';
import {INTIMATE,createIntimate} from './intimate.mjs?v=fg-90b53e2779ab7a1c';
import {REST_PAIRS,sofaPairs,restPlans,restKindFor,createRestPair} from './rest-pair.mjs?v=fg-90b53e2779ab7a1c';


import {pairSize,headPoint,pairSpacing,pairContact,nearHand,bonePoint,shoulderPose,hugPose} from './pair-pose.mjs?v=fg-90b53e2779ab7a1c';

export const TOGETHER_LABELS=globalThis.CharDaySocial.labels;
const mapId=m=>m.id||m.renderer;
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),avoid=(p,r=.72)=>[{...p,r}];
const clearance=(kind,distance)=>Math.min(INTIMATE[kind]?.48:.72,(distance||INTIMATE[kind]?.distance||(kind==='hug'?.34:kind==='hand'||kind==='walk'?.61:.78))-.08);
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
// Stand beside TA where they already are. Only a blocked formation can ask
// them to take a small step; the camera never chooses a different meeting place.
function standingPlans(map,kind,from,{distance,initiator}){
 const id=mapId(map),spacing=distance||INTIMATE[kind]?.distance||(kind==='hug'?.29:kind==='stretch'?1.8:kind==='walk'||kind==='hand'?.61:.78),bearing=Math.atan2(from.b.x-from.a.x,from.b.z-from.a.z),choices=[];
 for(const shift of [0,.25,.5,.8])for(let offset=0;offset<(shift?8:1);offset++)for(let n=0;n<16;n++){
  const angle=bearing+(n%2?-1:1)*Math.ceil(n/2)*Math.PI/8,heading=['hug','back-hug','dance'].includes(kind)?angle:angle-Math.PI/2,at={x:from.a.x+Math.sin(offset*Math.PI/4)*shift,z:from.a.z+Math.cos(offset*Math.PI/4)*shift};
  const plan={a:{...at},b:{x:at.x+Math.sin(angle)*spacing,z:at.z+Math.cos(angle)*spacing},heading,local:!from.a.seat&&!from.a.bed,anchor:'a',hostShift:shift,retain:shift===0&&!from.a.seat&&!from.a.bed?{a:true}:null};
  if(kind==='back-hug'&&initiator==='b')plan.heading+=Math.PI;
  if(['hug','back-hug'].includes(kind)){const lateral=kind==='hug'?.22:.20;plan.b.x+=Math.cos(plan.heading)*lateral;plan.b.z-=Math.sin(plan.heading)*lateral;}
  if(!segmentClear(plan.a,plan.b,id))continue;
  // Slow dance uses only this arc of the actual feet, rather than demanding
  // an empty circle around every stationary kiss or hug.
  if(kind==='dance'){
   const center={x:(plan.a.x+plan.b.x)/2,z:(plan.a.z+plan.b.z)/2};
   if(!['a','b'].every(w=>Array.from({length:33},(_,i)=>{const t=(i/32*2-1)*.55,dx=plan[w].x-center.x,dz=plan[w].z-center.z;return segmentClear(plan[w],{x:center.x+dx*Math.cos(t)+dz*Math.sin(t),z:center.z+dz*Math.cos(t)-dx*Math.sin(t)},id);}).every(Boolean)))continue;
  }
  choices.push(plan);
 }
 return choices;
}
function walkingPlans(kind,from,distance){
 const middle={x:(from.a.x+from.b.x)/2,z:(from.a.z+from.b.z)/2},spacing=distance||INTIMATE[kind]?.distance||.61,choices=[];
 for(const r of [0,1,2,3])for(let n=0;n<16;n++){const angle=n*Math.PI/8,center={x:middle.x+Math.cos(angle)*r,z:middle.z+Math.sin(angle)*r},heading=angle-Math.PI/2;choices.push({...pairFormation(center,heading,spacing),heading});}
 return choices;
}
const seatRank=p=>p.restKind==='sit-pat'&&!(p.seats?.a&&p.seats?.b)?1:0;
const planOrder=(a,b)=>Number(!!b.local)-Number(!!a.local)||seatRank(a)-seatRank(b)||(a.anchor&&b.anchor?(a.hostShift||0)-(b.hostShift||0):0)||(a.viewCost??a.cost)-(b.viewCost??b.cost);
export function togetherPlans(map,kind,from,{initiator='b',distance=null,lead='ta',moment=null,prepX=HOME_PREP.x,automatic=false,tableSeats=null}={}){
 const contextual=restPlans(map,kind,from,{distance:distance||(restKindFor(kind,from)==='lie-hug'?null:kind==='closer'?.69:.66),automatic});let choices=[];
 if(kind==='feed'&&tableSeats?.a){
  const seat=tableSeats.a,heading=seat.heading||0;
  for(const side of [-1,1])for(const forward of [.24,.08,-.08])for(const spacing of [.60,.66,.74]){const at=furniturePoint({x:seat.x,z:seat.z,heading},{x:side*spacing,z:forward});choices.push({a:{...from.a},b:at,seats:{a:seat,b:null},mealSeats:tableSeats,tableMeal:true,poseCost:(spacing-.60)*24+Math.abs(forward-.24)*12,retain:{a:true},heading:Math.atan2(seat.x-at.x,seat.z-at.z),local:true,preserveHost:true});}
 }else if(REST_PAIRS[kind])choices=contextual;
 else if(['shoulder','closer','wait','rest','cuddle'].includes(kind)||(['read','feed'].includes(kind)&&map.furniture.some(p=>['sofa','bench'].includes(p.kind))))choices=sofaPairs(map,distance?distance/2:kind==='cuddle'||kind==='shoulder'?.32:kind==='feed'?.32:kind==='closer'?.345:.37,['shoulder','cuddle'].includes(kind)?initiator:null).map(q=>({a:q.a.approach,b:q.b.approach,seats:q}));
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
   if(from.a.seat&&chairs.some(c=>c.id===from.a.seat.piece)&&a.id!==from.a.seat.piece)continue;const keep=from.a.seat?.piece===a.id;choices.push({a:keep?{...from.a}:seats.a.approach,b:seats.b.approach,seats,mealSeats:seats,retain:keep?{a:true}:null,preserveHost:keep,table:table.id});
  }
 }else if(kind==='cook'){
  const spot=map.spots.find(p=>p.action==='cook'),piece=map.furniture.find(p=>p.id===spot?.piece);
  if(spot&&piece){if(moment){const open=['pass','bowl','wipe','taste','taste-me'].includes(moment),x=open?-.1:moment==='guide'?prepX:globalThis.CharDayKitchen.KITCHEN_ANCHORS.cook.x,z=piece.d/2+(open?.85:.18),spacing=distance||.70,chef=lead==='me'?'b':'a',right=moment==='guide'?(chef==='a'?'a':'b'):chef;
   const left=right==='a'?'b':'a',offset=['steady','stir'].includes(moment)?-spacing/2:0,pair={[right]:furniturePoint(piece,{x:x+offset+spacing/2,z}),[left]:furniturePoint(piece,{x:x+offset-spacing/2,z})};choices.push({...pair,lead,heading:spot.heading,spot,piece,moment});
  }else{const b=furniturePoint(piece,{x:HOME_PREP.x-.19,z:piece.d/2+.25});choices.push({a:lead==='me'?b:spot.target,b:lead==='me'?spot.target:b,lead,heading:spot.heading,spot,piece});}}
 }else if(kind==='browse'){
  const spot=map.spots.find(s=>s.id==='produce'),piece=map.furniture.find(p=>p.id===spot?.furniture);
  if(spot&&piece)for(const side of [-1,1])choices.push({a:{x:spot.target.x-side*.48,z:spot.target.z+.16},b:{x:spot.target.x+side*.48,z:spot.target.z+.16},heading:spot.heading,spot,piece});
 }else choices=kind==='walk'||INTIMATE[kind]?.tour?walkingPlans(kind,from,distance):standingPlans(map,kind,from,{distance,initiator});
 if(!REST_PAIRS[kind]&&!tableSeats)choices.unshift(...contextual);
 const valid=[],validate=p=>{
  if(p.seats&&kind==='pat')p.restKind='sit-pat';if(p.seats?.a&&p.seats?.b&&kind==='hand')p.restKind='sit-hand';
  if(!walkable(p.a.x,p.a.z,mapId(map))||!walkable(p.b.x,p.b.z,mapId(map))||gap(p.seats?.a||p.a,p.seats?.b||p.b)<(distance?distance-.03:kind==='hug'?.32:INTIMATE[kind]?.distance?INTIMATE[kind].distance-.02:REST_PAIRS[kind]?.posture==='lie'?.20:(INTIMATE[kind]?.seated||kind==='feed')?.60:['shoulder','hand','walk'].includes(kind)?.58:.65))return null;
  if((kind==='walk'||INTIMATE[kind]?.tour)&&!pairWalkRoute(map,p,p.heading,distance||INTIMATE[kind]?.distance||.61))return null;
  if(p.anchor&&!segmentClear(from.a,p.a,mapId(map),avoid(from.b)))return null;
  let aRoute=p.retain?.a?[]:findPath(from.a,p.a,mapId(map),avoid(from.b)),bRoute=p.retain?.b?[]:findPath(from.b,p.b,mapId(map),avoid(p.seats?.a||p.a,clearance(kind,distance))),stageRoute=null;
  // Vacate the occupied station before changing roles; both routes keep normal collision checks.
  if(kind==='cook'&&!aRoute){for(let n=0;n<32;n++){const angle=n*Math.PI/8,r=1.1+Math.floor(n/16)*.7,c={x:from.b.x+Math.sin(angle)*r,z:from.b.z+Math.cos(angle)*r};if(gap(c,p.a)<.9||gap(c,p.b)<.9||!walkable(c.x,c.z,mapId(map)))continue;
   const away=findPath(from.b,c,mapId(map),avoid(from.a)),ar=findPath(from.a,p.a,mapId(map),avoid(c)),br=findPath(c,p.b,mapId(map),avoid(p.a,clearance(kind,distance)));if(away&&ar&&br){stageRoute=away;aRoute=ar;bRoute=br;break;}}
  }
  return aRoute&&bRoute?{...p,aRoute,bRoute,stageRoute,cost:gap(from.a,p.a)+gap(from.b,p.b)+(stageRoute?2:0)+(p.poseCost||0)}:null;
 };
 for(const p of choices){if(p.anchor&&valid.some(q=>q.anchor&&q.hostShift<p.hostShift))break;const plan=validate(p);if(plan)valid.push(plan);}
 return valid.sort(planOrder);
}
// Both participants use the existing navigation and original traveler rig. Nothing is saved.
export function createTogether({a,b,map,from,motion=()=>({}),pair=()=>({}),visibility=()=>0,kitchen=()=>null,onUpdate=()=>{},onStop=()=>{},onKitchenMoment=()=>{}}){
 let session=null,last='';
 const cup=new T.Group();cup.name='TogetherCup';cup.visible=false;a.root.add(cup);
 const material=new T.MeshStandardMaterial({color:'#d6e7df',roughness:.75});
 const bowl=new T.Mesh(new T.CylinderGeometry(.065,.05,.13,16),material);bowl.position.y=.055;cup.add(bowl);
 const handle=new T.Mesh(new T.TorusGeometry(.04,.012,8,16),material);handle.position.set(.06,.055,0);cup.add(handle);
 const tea=new T.Mesh(new T.CylinderGeometry(.054,.054,.007,16),new T.MeshStandardMaterial({color:'#a78055'}));tea.position.y=.122;cup.add(tea);
 const style=who=>({style:'gentle',delay:.35,reach:1.1,lean:.1,sway:.008,phase:0,...pair()[who]});
 const intimate=createIntimate({a,b,map,style,kitchen}),restPair=createRestPair({a,b}),kitchenPair=createKitchenPair({a,b,kitchen});
 const contact=pairContact,actorsFor=who=>who==='a'?a:b;
 a.root.userData.pairWho='ta';b.root.userData.pairWho='me';
 const inspect=()=>session?{moment:session.moment?{...session.moment,phase:session.phase,contacts:kitchenPair.inspect()}:null,kind:session.kind,label:TOGETHER_LABELS[session.kind],phase:session.phase,a:{...session.a},b:{...session.b},seats:session.plan.seats?(session.renderSeats||session.plan.seats):null,beds:session.phase==='active'?session.renderBeds||session.plan.beds||null:null,mealSeats:session.plan.mealSeats||null,tableMeal:!!session.plan.tableMeal,posture:session.plan.posture||'stand',local:!!session.plan.local,intimate:session.restContact||intimate.inspect(),contact:session.contact||null,initiator:session.initiator,lead:session.plan.lead,tour:session.tour?{moving:session.tour.moving,round:session.tour.round}:null,elapsed:session.elapsed,automatic:session.automatic,styles:{a:style('a'),b:style('b')},aTask:session.aTask,bTask:session.bTask}:null;
 function tell(){const s=inspect(),key=JSON.stringify(s&&[s.kind,s.phase]);if(key!==last){last=key;onUpdate(s);}}
 function stop(reason='已松开，继续各自做事。'){if(!session)return false;const s=session;session=null;cup.visible=false;intimate.hide();kitchenPair.hide(true);last='';onStop({a:s.a,b:s.b,seats:s.plan.seats?{a:s.phase==='walking-ta'?null:(s.renderSeats||s.plan.seats).a,b:s.phase==='active'?(s.renderSeats||s.plan.seats).b:null}:null,beds:s.phase==='active'?s.renderBeds||s.plan.beds||null:null,preserveHost:!!s.plan.preserveHost,reason,automatic:s.automatic});onUpdate(null);return true;}
 function start(kind,{automatic=false,initiator='b',lead='ta',moment=null}={}){if(!TOGETHER_LABELS[kind])return {ok:false,reason:'这个互动还没有位置。'};
  initiator=moment==='taste-me'?'a':initiator==='a'?'a':'b';const origins=session?{a:{...session.a,seat:session.phase==='active'?(session.renderSeats||session.plan.seats)?.a:null,bed:session.phase==='active'?session.plan.beds?.a:null},b:{...session.b,seat:session.phase==='active'?(session.renderSeats||session.plan.seats)?.b:null,bed:session.phase==='active'?session.plan.beds?.b:null}}:from(),piece=map().furniture.find(p=>p.id===map().spots.find(q=>q.action==='cook')?.piece),surface=moment==='guide'&&piece?kitchenPair.operationPoint({plan:{piece}},'prep'):null,prepX=surface?(surface.x-piece.x)*Math.cos(piece.heading||0)-(surface.z-piece.z)*Math.sin(piece.heading||0):HOME_PREP.x,spacing=moment?moment==='wipe'?pairSize(a).radius+pairSize(b).radius+.075:moment.startsWith('taste')?pairSize(a).radius+pairSize(b).radius+.17:['guide','stir','steady'].includes(moment)?Math.max(.60,pairSize(a).width*.5+pairSize(b).width*.5+.16):Math.max(.70,pairSpacing('hand',a,b)||.70):kind==='pat'&&(origins.a.seat||origins.b.seat)?pairSpacing('sit-pat',a,b):pairSpacing(restKindFor(kind,origins)||kind,a,b),plan=togetherPlans(map(),kind,origins,{initiator,lead,distance:spacing,moment,prepX,automatic,tableSeats:kind==='feed'&&kitchen()?.job?.kind==='meal'?(session?.plan.mealSeats||session?.plan.seats):null}).map(p=>({...p,viewCost:p.cost+visibility({...p,kind})})).sort(planOrder)[0];
  if(!plan){if(session)stop('这个动作暂时没有合适位置，先按你的选择停下来。');return {ok:false,reason:REST_PAIRS[kind]?.posture==='lie'?'先留一张两侧能走到的双人床。':REST_PAIRS[kind]?.posture==='sit'?'身旁没有能坐近的空位，留一张双人沙发或长椅就可以。':kind==='cook'?'厨房前没有两个人能走到的位置。':['read','shoulder','cuddle'].includes(kind)?'先摆一张能走到的双人沙发或长椅。':kind==='meal'?'餐桌旁需要两把能走到的空椅子。':kind==='feed'?'先留一张能走近的餐桌或双人座位。':'附近没有两个人能站稳的空地。'};}
  if(session)stop();const progress=kitchen()?.progress;session={kind,...(moment?{moment:{id:globalThis.crypto.randomUUID(),jobId:kitchen()?.job?.id,kind:moment,sourceId:moment==='pass'?progress?.table?.items.find(q=>q.zone==='basket')?.id:null,ingredient:moment.startsWith('taste')?progress?.table?.items.find(q=>['pan','plate'].includes(q.zone)&&globalThis.CharDayKitchen.tableReady(q,globalThis.CharDayKitchen.recipe(kitchen()?.job?.recipeId)?.method))?.ingredient:null}}:{}),automatic,initiator,plan,...(plan.tableMeal?{mealJobId:kitchen()?.job?.id}:{}),renderSeats:{a:origins.a.seat||null,b:origins.b.seat||null},a:{...origins.a},b:{...origins.b},phase:plan.stageRoute?'walking-stage-b':'walking-ta',elapsed:0,speed:0,clearance:clearance(kind,spacing),tour:kind==='walk'||INTIMATE[kind]?.tour?{moving:false,wait:0,round:0}:null};tell();return {ok:true};
 }
 function pose(actor,at,seated,heading,time,moving,task,profile,gesture='rest',progress=0,dt=.025,lying=null){actor.root.position.set(at.x,0,at.z);const turn=Math.atan2(Math.sin(heading-actor.root.rotation.y),Math.cos(heading-actor.root.rotation.y));actor.root.rotation.y+=T.MathUtils.clamp(turn,-4*dt,4*dt);actor.animate(time,{moving,sleepPose:lying,seated:!!seated,seatPose:seated?.pose,gesture,progress,task,motion:profile,height:floorHeight(mapId(map()),at)+(seated?seated.rise+.05:0)});}
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
 function tick(dt,time){if(!session)return false;const s=session,p=s.plan;if(s.mealJobId&&s.mealJobId!==kitchen()?.job?.id){stop('这一桌已经收好了。');return false;}if(s.moment&&s.moment.jobId!==kitchen()?.job?.id){stop('这一份已经收起了。');return false;}s.elapsed+=dt;
  const who=s.phase==='walking-ta'?'a':['walking-you','walking-stage-b'].includes(s.phase)?'b':null;
  if(who){const route=s.phase==='walking-stage-b'?p.stageRoute:who==='a'?p.aRoute:p.bRoute,other=who==='a'?s.b:p.seats?.a||s.a;
   const step=stepRoute(s[who],route,dt,{speed:s.speed,walkSpeed:1.45*(motion()[who]?.walk||1),clear:(u,v)=>segmentClear(u,v,mapId(map()),avoid(other,s.clearance))});s[who]=step.position;s.speed=step.speed;if(step.heading!=null)s[who].heading=step.heading;
   if(step.blocked){stop('两个人的路线被挡住了，可以换个位置再试。');return false;}
   if(!route.length){s.phase=s.phase==='walking-stage-b'?'walking-ta':who==='a'?'walking-you':'turning';s.speed=0;s.elapsed=0;tell();}
  }
  if(s.phase==='active'&&s.tour)walkTogether(s,dt);
  const active=s.phase==='active',seatAt=(who,goal)=>{if(!goal){s.renderSeats[who]=null;return null;}const old=s.renderSeats[who];if(!old||old.piece!==goal.piece)return s.renderSeats[who]={...goal};const step=Math.min(1,dt*7);return s.renderSeats[who]={...goal,x:old.x+(goal.x-old.x)*step,z:old.z+(goal.z-old.z)*step};},aSeated=seatAt('a',p.seats&&(p.retain?.a||s.phase!=='walking-ta')?p.seats.a:null),bSeated=seatAt('b',active||s.phase==='turning'||p.retain?.b?p.seats?.b:null);
  const aa=aSeated||s.a,bb=bSeated||s.b;
  let ah=aSeated?.heading??(s.phase==='walking-ta'?s.a.heading||0:p.heading||0),bh=bSeated?.heading??(s.phase==='walking-you'?s.b.heading||0:p.heading||0);
  if(s.moment&&['pass','bowl','wipe','taste','taste-me'].includes(s.moment.kind)){ah=Math.atan2(p.b.x-p.a.x,p.b.z-p.a.z);bh=ah+Math.PI;}
  if(!p.seats&&(active||s.phase==='turning')&&(['hug','look','cup','pat','kiss-forehead','kiss-cheek','kiss','forehead','dance'].includes(s.kind)||s.kind==='feed'&&!p.seats)){ah=s.kind==='hug'||s.kind==='dance'?p.heading:Math.atan2(p.b.x-p.a.x,p.b.z-p.a.z);bh=ah+Math.PI;}
  const daily=(who,kind)=>({daily:true,kind,elapsed:s.elapsed,progress:((s.elapsed*(motion()[who]?.tempo||1)+(motion()[who]?.phase||0))/(kind==='read'?9:kind==='eat'?5.5:7))%1});
  let at=null,bt=null;
  if(active&&['read','meal','drink'].includes(s.kind)){const kind={read:'read',meal:'eat',drink:'drink'}[s.kind];at=daily('a',kind);bt=daily('b',kind);}

  if(active&&s.kind==='cook'){at=dailyTaskAt({action:'cook'},p.spot,map(),s.elapsed,{motion:motion().a});const target={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.handZ}),y:HOME_PREP.handY},contact={...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.contactZ}),y:HOME_PREP.contactY};bt={...daily('b','prep'),target,contact};}
  const cooking=kitchen(),job=cooking?.job;
  if(active&&job?.kind===s.kind){const stage=globalThis.CharDayKitchen.cookingStage(job,job.cooking?cooking.progress:cooking.elapsed);
   if(s.kind==='meal'){const courses=job.courses||[{recipeId:job.recipeId}],course=courses[Math.min(courses.length-1,Math.floor(cooking.elapsed/2.7))],r=globalThis.CharDayKitchen.recipe(course.recipeId);at={...at,kind:r?.food==='drink'?'drink':'eat',recipeId:r?.id,dish:course};bt={...bt,kind:at.kind,recipeId:r?.id,dish:course};}
   if(s.kind==='cook'){const method=stage.method,passive=stage.index===2||stage.index===1&&['bake','steam','brew'].includes(method);
    if(job.cooking){const chefWho=job.cooking.lead==='me'?'b':'a',prepWho=chefWho==='a'?'b':'a',chef=dailyTaskAt({action:'cook'},p.spot,map(),s.elapsed,{motion:motion()[chefWho]}),prep={...daily(prepWho,'prep'),target:{...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.handZ}),y:HOME_PREP.handY},contact:{...furniturePoint(p.piece,{x:HOME_PREP.x,z:HOME_PREP.contactZ}),y:HOME_PREP.contactY}};
     const task=stage.index===0?prep:chef,elapsed=job.cooking.mode==='hands'&&stage.who==='me'?stage.progress.work*.48:s.elapsed,working=stage.index<2&&!stage.passive?{...task,elapsed,recipeId:job.recipeId,method,stage:stage.index}:null;at=(stage.index===0?prepWho:chefWho)==='a'?working:null;bt=(stage.index===0?prepWho:chefWho)==='b'?working:null;
     if(stage.tabletop){const prepTask=stage.progress.table.items.some(q=>['basket','board'].includes(q.zone))?{...prep,elapsed:s.elapsed,recipeId:job.recipeId,method,stage:0}:null,chefTask=stage.progress.table.items.some(q=>q.zone==='pan')?{...chef,elapsed:s.elapsed,recipeId:job.recipeId,method,stage:1}:null;at=prepWho==='a'?prepTask:chefTask;bt=prepWho==='b'?prepTask:chefTask;}
    }else{at=passive?null:{...at,recipeId:job.recipeId,method,stage:stage.index};bt=passive?null:{...bt,recipeId:job.recipeId,method,stage:stage.index};}}
  }
  if(s.moment&&!['steady','guide','stir'].includes(s.moment.kind))at=bt=null;
  if(active&&s.moment){const kind=s.moment.kind,worker=job?.cooking?.lead==='me'?'b':'a',helper=kind==='guide'?worker:worker==='a'?'b':'a';
   if(['pass','bowl'].includes(kind))at=bt={kind:'kitchen-help',supportHeight:0};
   if(['guide','stir','steady'].includes(kind)){const surface=kitchenPair.operationPoint(s,kind==='guide'?'prep':'pan',actorsFor(helper)),actor=actorsFor(helper);const shoulder=bonePoint(actor,'rightArm'),height=Math.max(0,surface.y-(shoulder.y-actor.root.position.y)-floorHeight(mapId(map()),s[helper])-.035);const support={kind:'kitchen-help',supportHeight:height};if(helper==='a')at=support;else bt=support;}
   if(kind==='wipe'||kind.startsWith('taste')){const giver=kind==='taste-me'?'a':kind==='wipe'?'a':'b',receiver=giver==='a'?b:a,actor=actorsFor(giver),surface=headPoint(receiver,[kind==='wipe'?.62:0,kind==='wipe'?-.75:-.42,kind==='wipe'?.90:.99]),shoulder=bonePoint(actor,'rightArm'),height=Math.max(0,surface.y-(shoulder.y-actor.root.position.y)-floorHeight(mapId(map()),s[giver])-.05);const support={kind:'kitchen-help',supportHeight:height};if(giver==='a')at=support;else bt=support;}
  }
  if(active&&p.tableMeal){const giver=s.initiator==='a'?a:b,receiver=giver===a?b:a,who=giver===a?'a':'b',mouth=headPoint(receiver,[0,-.42,.99]),shoulder=bonePoint(giver,'rightArm'),support={kind:'kitchen-help',supportHeight:Math.max(0,mouth.y-(shoulder.y-giver.root.position.y)-floorHeight(mapId(map()),s[who])-.05)};if(who==='a')at=support;else bt=support;}
  s.aTask=at;s.bTask=bt;
  if(p.tableMeal&&!bSeated){bh=Math.atan2(aa.x-bb.x,aa.z-bb.z);}
  if(s.tour){ah=s.tour.heading??p.heading;bh=ah;}
  const gesture=active&&s.kind==='stretch'?'stretch':'rest',progress=(s.elapsed/4)%1;
  const lying=who=>{const q=p.beds?.[who];if(!q||!active)return null;const roll=(p.restKind||s.kind)==='lie-hug'?(who==='a'?-1:1)*.72*pairProgress(s.elapsed,style(who)):0;return (s.renderBeds||=( {} ))[who]={...q,roll};};
  pose(a,aa,aSeated,ah,time,s.phase==='walking-ta'&&!p.retain?.a||!!s.tour?.moving,at,motion().a,gesture,progress,dt,lying('a'));pose(b,bb,bSeated,bh,time,['walking-you','walking-stage-b'].includes(s.phase)&&!p.retain?.b||!!s.tour?.moving,bt,motion().b,gesture,(progress+.12)%1,dt,lying('b'));
  if(s.phase==='turning'&&[ [a,ah],[b,bh] ].every(([actor,heading])=>Math.abs(Math.atan2(Math.sin(heading-actor.root.rotation.y),Math.cos(heading-actor.root.rotation.y)))<.001)){s.phase='active';s.elapsed=0;tell();}
  if(active&&s.kind==='browse'){for(const [actor,at,offset] of [[a,aa,0],[b,bb,.8]]){const local=new T.Vector3(at.x,0,at.z).sub(new T.Vector3(p.piece.x,0,p.piece.z)).applyAxisAngle(new T.Vector3(0,1,0),-(p.piece.heading||0)),point=furniturePoint(p.piece,{x:local.x,z:p.piece.d/2-.08}),target=new T.Vector3(point.x,.96+Math.sin(s.elapsed+offset)*.05,point.z);actor.contactPose({[nearHand(actor,target)]:target});}}
  const pa=pairProgress(s.elapsed,style('a')),pb=pairProgress(s.elapsed,style('b'));
  if(active&&!p.restKind&&s.kind==='look'){
   a.contactPose({lean:Math.sin(s.elapsed*.7+style('a').phase)*style('a').sway});
   b.contactPose({lean:Math.sin(s.elapsed*.7+style('b').phase)*style('b').sway});
  }
  if(active&&!p.restKind&&s.kind==='cup'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);
   const ap=a.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),bp=b.root.getObjectByName('Left_hand').getWorldPosition(new T.Vector3()),mid=ap.clone().add(bp).multiplyScalar(.5);mid.y+=.10;
   contact(a,{right:mid},pa);contact(b,{left:mid},pb);
   const giver=a.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3()),receiver=b.root.getObjectByName('Left_hand').getWorldPosition(new T.Vector3());
   const exchange=Math.min(pa,pb);cup.visible=true;cup.position.copy(a.root.worldToLocal(giver.lerp(receiver,exchange>.97?Math.min(1,(s.elapsed-3)/2):0)));cup.rotation.y=-a.root.rotation.y;
   cup.userData.holder=exchange>.97&&s.elapsed>=5?'me':'ta';
  }
  if(active&&!p.restKind&&s.kind==='hand'){
   a.root.updateMatrixWorld(true);b.root.updateMatrixWorld(true);const as=nearHand(a,b.root.position),bs=nearHand(b,a.root.position),mid=bonePoint(a,as==='left'?'Left_hand':'Right_hand').add(bonePoint(b,bs==='left'?'Left_hand':'Right_hand')).multiplyScalar(.5);
   mid.y=Math.min(bonePoint(a,as+'Arm')?.y||mid.y+.16,bonePoint(b,bs+'Arm')?.y||mid.y+.16)-.16;mid.add(new T.Vector3(Math.sin(ah)*.04,0,Math.cos(ah)*.04));const contacts=[];contact(a,{[as]:mid},pa,contacts);contact(b,{[bs]:mid},pb,contacts);s.contact={contacts};
  }
  if(active&&!p.restKind&&s.kind==='hug')s.contact=hugPose(a,b,pa,pb);
  if(active&&!p.restKind&&s.kind==='shoulder'){const leaning=s.initiator==='a'?a:b,holder=leaning===a?b:a;s.contact=shoulderPose(holder,leaning,leaning===a?pa:pb,{holderProgress:holder===a?pa:pb});}
  if(active&&!p.restKind&&s.kind==='closer'){a.contactPose({lean:0});b.contactPose({lean:0});}
  if(active&&(REST_PAIRS[s.kind]||p.restKind))s.restContact=restPair.tick(s,pa,pb);
  if(active&&INTIMATE[s.kind]&&!REST_PAIRS[s.kind]&&!p.restKind){const result=intimate.tick(s);if(!p.seats&&!s.tour){s.a={...s.a,x:a.root.position.x,z:a.root.position.z};s.b={...s.b,x:b.root.position.x,z:b.root.position.z};}if(result?.ok===false){stop(result.reason);return false;}}
  kitchenPair.dust(cooking?.progress);
  if(active&&s.moment){const kind=s.moment.kind;let result;
   if(kind.startsWith('taste')){result=intimate.tick({...s,kind:'feed'});const contact=intimate.inspect();s.contact=contact;s.moment.contact=contact?.spoonDistance;result={done:s.elapsed>=5&&contact?.spoonDistance<.06&&(contact?.contacts||[]).every(c=>c.error<.06),reason:s.elapsed>12&&contact?.spoonDistance>=.09?'这一口还没递到嘴边，换个位置再试。':result?.reason};}
   else{result=kitchenPair.tick(s);s.contact=result?.diagnostics;}
   if(result?.done){const completed={...s.moment};onKitchenMoment(completed);start('cook',{lead:kitchen()?.job?.cooking?.lead||'ta'});return true;}
   if(result?.reason){const reason=result.reason;start('cook',{lead:kitchen()?.job?.cooking?.lead||'ta'});onUpdate({...inspect(),notice:reason});return true;}
  }else if(!s.moment)kitchenPair.hide();
  onUpdate({...inspect(),bSeat:bSeated,moving:s.phase!=='active'||!!s.tour?.moving});return true;
 }
 const furnitureKey=()=>JSON.stringify(map().furniture.map(p=>[p.id,p.x,p.z,p.heading,p.stored]));
 function pauseState(){return session?structuredClone({map:mapId(map()),furnitureKey:furnitureKey(),session}):null;}
 function restore(saved){if(!saved?.session||saved.map!==mapId(map())||saved.furnitureKey!==furnitureKey()||!TOGETHER_LABELS[saved.session.kind])return false;const copy=structuredClone(saved.session);if(!['a','b'].every(w=>walkable(copy[w].x,copy[w].z,mapId(map()))))return false;session=copy;last='';tell();return true;}
 return {start,stop,tick,inspect,pauseState,restore,dispose(){stop();kitchenPair.dispose();}};
}
