// A visit is a visible, disposable scene session. It has no save or chat writer.
import {MAPS,findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-90b53e2779ab7a1c';
import {PERSONAL_SPACE} from '../companion.mjs?v=fg-90b53e2779ab7a1c';
import {stepRoute} from '../locomotion.mjs?v=fg-90b53e2779ab7a1c';
import {furniturePoint,furnitureSeat,usesFor} from './home-catalog.mjs?v=fg-90b53e2779ab7a1c';
import {dailyTaskAt} from './daily-workflow.mjs?v=fg-90b53e2779ab7a1c';
import {CHORES,chorePlans,chorePose} from './chores.mjs?v=fg-90b53e2779ab7a1c';
const HOBBIES=globalThis.CharDayHomeHobbies.activities;
const activities={read:{action:'read',label:'看书'},drink:{action:'tea',label:'喝水'},eat:{action:'meal',label:'用餐'},rest:{action:'rest',label:'休息'},...Object.fromEntries(Object.entries(HOBBIES).map(([kind,p])=>[kind,{action:kind,label:p.label}])),...CHORES};
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clearance=PERSONAL_SPACE+.16;
function automaticActivities(action){
 const first={read:'read',meal:'eat',tea:'drink'}[action]||'rest';
 return [...new Set([first,'walk','drink','rest'])];
}
export const visitorAvoid=ta=>ta?[{x:ta.x,z:ta.z,r:clearance}]:[];
function reachable(from,to,ta,map){const avoid=ta?[{x:ta.x,z:ta.z,r:Math.min(clearance,gap(from,ta)*.85)}]:[];return walkable(to.x,to.z,map.id||map.renderer)&&(!ta||gap(to,ta)>=clearance)&&findPath(from,to,map.id||map.renderer,avoid);}
export function visitSeats(map,occupied){
 const pieces=map.furniture.filter(p=>['sofa','chair','bench'].includes(p.kind));
 return pieces.flatMap(p=>{
  const shared=occupied?.piece===p.id;if(shared&&!['sofa','bench'].includes(p.kind))return [];
  const offsets=['sofa','bench'].includes(p.kind)?[-.6,.6]:[0];
  return offsets.flatMap(x=>{
   const at=furnitureSeat(p,null,{x,z:p.kind==='sofa'?.05:0});if(occupied&&gap(at,occupied)<clearance)return [];
   const approaches=[{x:-p.w/2-.6,z:.25},{x:p.w/2+.6,z:.25},{x,z:p.d/2+.7}].map(q=>furniturePoint(p,q));
   return approaches.map(approach=>({seat:{...furnitureSeat(p,approach,{x,z:p.kind==='sofa'?.05:0}),rise:p.seat??.45},shared}));
  });
 }).sort((a,b)=>Number(b.shared)-Number(a.shared));
}
export function activitySeat(map,seat,kind){
 const p=map.furniture.find(p=>p.id===seat?.piece),action=activities[kind]?.action;
 if(!p||!action)return false;
 if(kind==='rest')return ['sofa','chair','bench'].includes(p.kind);
 if(map.id!=='dayHome'&&map.renderer!=='dayHome')return kind!=='eat'||map.furniture.some(t=>t.kind==='table'&&gap(t,seat)<Math.hypot(t.w,t.d)/2+1);
 if(!usesFor(p).includes(action))return false;
 return kind!=='eat'||map.furniture.some(t=>t.dining&&gap(t,seat)<Math.hypot(t.w,t.d)/2+1);
}
export function chooseVisitSeat(map,from,occupied,ta,kind=null){
 const choices=visitSeats(map,occupied).filter(q=>!kind||activitySeat(map,q.seat,kind)).map(q=>({...q,route:reachable(from,q.seat.approach,ta,map)})).filter(q=>q.route);
 return choices.sort((a,b)=>Number(b.shared)-Number(a.shared)||gap(a.seat,ta||from)-gap(b.seat,ta||from))[0]||null;
}
export function visitNear(from,ta,map=MAPS.dayHome){
 if(!ta)return null;
 const choices=[];for(const distance of [1.05,1.4,1.8])for(let n=0;n<16;n++){const a=n*Math.PI/8,to={x:ta.x+Math.cos(a)*distance,z:ta.z+Math.sin(a)*distance},route=reachable(from,to,ta,map);if(route)choices.push({to,route});}
 return choices.sort((a,b)=>gap(from,a.to)-gap(from,b.to))[0]||null;
}
export function createSceneVisit({avatar,ta,motion=()=>null,onChange=()=>{},choice='auto',following=()=>false,choreVisual={hide(){},update(){}},map=()=>MAPS.dayHome}){
 let chore=null,hobbySpot=null,followWait=0,followSide=1;
 const isFollowing=()=>present&&control==='auto'&&following()&&!leaving;
 let present=false,position={...MAPS.dayHome.spawn},route=[],speed=0,yaw=0,seat=null,pendingSeat=null,bed=null,leaving=false,controlled=null,notice='',last='',activity=null,pendingActivity=null,dwell=0,task=null,control=choice==='manual'||Object.hasOwn(activities,choice)?'manual':'auto',manualAction=Object.hasOwn(activities,choice)?choice:'manual',autoWait=8,autoIndex=0;
 const inspect=()=>({map:map().id||map().renderer,present,position:{...position},heading:yaw,bed:bed?{...bed}:null,lying:!!bed,route:route.map(q=>({...q})),seated:!!seat,seat:seat?{...seat}:null,busy:controlled?controlled.moving:route.length>0,interaction:controlled?.kind||null,interactionPhase:controlled?.phase||null,leaving,notice,activity,pendingActivity,control,manualAction,following:isFollowing(),task,chore:chore?{...chore,route:undefined,elapsed:dwell,finished:dwell>=chore.duration}:null,choreContact:avatar.root.userData.chore,dailyAction:avatar.root.userData.dailyAction,motion:motion(),visible:avatar.root.visible,visualPosition:avatar.root.position.toArray(),leg:avatar.root.getObjectByName?.('leftLeg')?.rotation.x});
 function tell(text){if(text!==undefined)notice=present&&control==='auto'?'自动 · '+text:text;const info=inspect(),key=JSON.stringify([present,info.busy,info.seated,info.interaction,info.interactionPhase,leaving,notice,activity,pendingActivity,control,manualAction]);if(key!==last){last=key;onChange(info);}}
 function halt(){chore=null;hobbySpot=null;choreVisual.hide();route=[];speed=0;leaving=false;seat=pendingSeat=bed=null;activity=pendingActivity=task=null;dwell=0;}
 function go(to,nextSeat=null,nextActivity=null){
  const next=reachable(position,to,ta(),map());if(!next){tell('这里暂时走不过去，换个空位试试。');return false;}
  seat=bed=null;activity=null;task=null;dwell=0;pendingSeat=nextSeat;pendingActivity=nextActivity;route=next;speed=0;
  if(!route.length){seat=pendingSeat;activity=pendingActivity;pendingSeat=pendingActivity=null;}tell(seat?'已坐下，可以聊聊。':'正在走过去…');return true;
 }
 function join({automatic=false,arrival=false,restore=null}={}){
  if(restore){control=restore.control;manualAction=restore.manualAction||'manual';}followWait=0;controlled=null;chore=null;choreVisual.hide();
  present=true;leaving=false;seat=pendingSeat=bed=null;activity=pendingActivity=task=null;dwell=0;position={...map().spawn};
  if(automatic||arrival){const free=visitNear(position,ta(),map());if(!free){present=false;tell('小家暂时没有能站稳的空位，整理好通道后可以再进来。');return false;}position={...free.to};}
  const host=ta();if(host)followSide=((position.x-host.x)*Math.cos(host.heading||0)-(position.z-host.z)*Math.sin(host.heading||0))<0?-1:1;
  avatar.root.visible=true;
  // An arriving visitor uses the existing doorway, then gives it back.
  avatar.root.position.set(position.x,floorHeight(map().id||map().renderer,position),position.z);
  autoWait=automatic?0:8;autoIndex=0;
  if(control==='manual'){if(activities[manualAction])perform(manualAction);else tell('手动控制中，点空地或选动作。');}
  else{const free=visitNear(position,ta(),map());if(free)go(free.to);else tell('已走进来，点空地可以走动。');}return true;
 }
 function stand(){halt();tell('手动控制中，点空地或选动作。');return true;}
 function perform(kind,point){
  hobbySpot=null;
  if(!CHORES[kind]){chore=null;choreVisual.hide();}
  if(kind==='stand'||kind==='manual')return stand();
  if(kind==='walk')return point&&Number.isFinite(point.x)&&Number.isFinite(point.z)?go(point):false;
  if(kind==='sit'){const q=chooseVisitSeat(map(),position,ta()?.seat,ta());if(!q){tell('没有能走到的空座位，可以站着陪一会儿。');return false;}return go(q.seat.approach,q.seat);}
  if(CHORES[kind]){
   const plan=chorePlans(map(),kind,position,ta())[0];if(!plan){tell('没有能走到的对应家具，先布置好再来。');return false;}
   const ok=go(plan.at,null,kind);if(ok){chore=plan;yaw=plan.heading;tell('正在走去'+CHORES[kind].label+'的位置…');}return ok;
  }
  if(HOBBIES[kind]){
   const choices=map().spots.filter(p=>p.action===kind&&(!p.seat||ta()?.seat?.piece!==p.piece)).map(spot=>({spot,route:reachable(position,spot.target,ta(),map())})).filter(p=>p.route).sort((a,b)=>gap(position,a.spot.target)-gap(position,b.spot.target));
   const selected=choices[0]?.spot;if(!selected){tell('这个兴趣角暂时没有空位，先摆好家具、留出通道再来。');return false;}
   const ok=go(selected.target,selected.seat||null,kind);if(ok){hobbySpot=selected;tell('正在走去'+HOBBIES[kind].label+'的位置…');}return ok;
  }
  if(activities[kind]){
   if(seat&&activitySeat(map(),seat,kind)){activity=kind;task=null;dwell=0;tell('你在'+activities[kind].label+'，TA继续自己的安排。');return true;}
   const q=chooseVisitSeat(map(),position,ta()?.seat,ta(),kind);
   if(!q){tell(kind==='eat'?'餐桌旁没有能走到的空椅子，布置好桌椅再来用餐。':'没有能走到的空座位，先在旁边陪一会儿。');return false;}
   const ok=go(q.seat.approach,q.seat,kind);if(ok)tell('正在走去'+activities[kind].label+'的位置…');return ok;
  }
  if(kind==='near'){const q=visitNear(position,ta(),map());if(!q){tell('TA旁边暂时没有能走到的空位。');return false;}return go(q.to);}
  if(kind==='leave'){if(!go(map().spawn))return false;if(!route.length){close('已离开，继续看看TA的一天。');return true;}leaving=true;tell('正在走到门口…');return true;}
  return false;
 }
 function act(kind,point){
  if(!present||!['auto','manual','stand','walk','sit','near','leave',...Object.keys(activities)].includes(kind))return false;
  if(kind==='walk'&&(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z)))return false;
  // The user's command revokes every pending automatic decision immediately,
  // including an unavailable destination. Only an explicit auto command re-arms it.
  if(kind==='auto'){control='auto';manualAction='manual';halt();autoWait=0;followWait=0;tell(isFollowing()?'会跟着TA走，随时可以手动接管。':'会自己找空位活动，随时可以手动接管。');return true;}
  control='manual';manualAction=kind==='leave'?'manual':kind;
  leaving=false;route=[];pendingSeat=pendingActivity=null;speed=0;
  // Keep a usable current seat when switching its activity; failed commands stop
  // the old activity rather than allowing the automatic plan to finish later.
  const ok=perform(kind,point);if(!ok){halt();tell();}else tell();return ok;
 }
 function stroll(){
  for(const radius of [1.6,2.4])for(let n=0;n<16;n++){
   const angle=(n+autoIndex*3)*Math.PI/8,to={x:position.x+Math.cos(angle)*radius,z:position.z+Math.sin(angle)*radius};
   if(reachable(position,to,ta(),map())&&go(to)){tell('在这里走一走。');return true;}
  }return false;
 }
 function automatic(){
  autoWait=32+(motion()?.habit||12)*1.5+(motion()?.phase||0)*3;
  const choices=automaticActivities(ta()?.action);
  for(let n=0;n<choices.length;n++){
   const kind=choices[autoIndex++%choices.length];
   if(kind==='walk'?stroll():perform(kind))return;
  }
  tell('暂时没有能走到的空位，先歇一会儿。');
 }
 function follow(dt){
  followWait-=Math.max(0,dt);if(followWait>0)return;followWait=.25;
  const host=ta();if(!host)return;const id=map().id||map().renderer,heading=host.heading||0,forward={x:Math.sin(heading),z:Math.cos(heading)},side={x:Math.cos(heading),z:-Math.sin(heading)};
  if(!host.moving&&gap(position,host)<1.05){if(route.length){route=[];speed=0;}return;}
  const choices=[];
  for(const sign of [followSide,-followSide])for(const trailing of [host.moving?.15:0,.55,.9]){
   const to={x:host.x+side.x*.79*sign-forward.x*trailing,z:host.z+side.z*.79*sign-forward.z*trailing},next=reachable(position,to,host,map());
   if(next)choices.push({to,next,sign,cost:gap(position,to)*.2+(sign===followSide?0:.5)+trailing});
  }
  // A narrow doorway can use a trailing position; actual navigation decides it.
  for(const d of [1,1.4]){const to={x:host.x-forward.x*d,z:host.z-forward.z*d},next=reachable(position,to,host,map());if(next)choices.push({to,next,sign:followSide,cost:gap(position,to)*.2+1.8});}
  const plan=choices.sort((a,b)=>a.cost-b.cost)[0];if(!plan)return;
  if(gap(position,plan.to)<.08)return;
  followSide=plan.sign;route=plan.next;seat=pendingSeat=bed=null;activity=pendingActivity=task=null;dwell=0;tell('跟着TA走，点空地可以手动接管。');
 }
 function close(text=''){chore=null;choreVisual.hide();present=false;leaving=false;controlled=null;route=[];seat=pendingSeat=bed=null;activity=pendingActivity=task=null;avatar.root.visible=false;tell(text);}
 function tick(dt,time){
  if(!present||controlled)return;
  let moving=route.length>0;
  const profile=motion();
  const tracking=isFollowing();if(tracking){follow(dt);moving=route.length>0;}
  if(control==='auto'&&!tracking&&(activity==='read'||pendingActivity==='read')&&ta()?.action!=='read'){halt();autoWait=0;moving=false;}
  if(control==='auto'&&!tracking&&!moving){autoWait-=Math.max(0,dt);if(autoWait<=0){automatic();moving=route.length>0;}}
  if(moving){const step=stepRoute(position,route,dt,{speed,walkSpeed:tracking?Math.max(1.45*(profile?.walk||1),(ta()?.walkSpeed||1.6)*(gap(position,ta())>1.3?1.2:1)):1.45*(profile?.walk||1),clear:(a,b)=>segmentClear(a,b,map().id||map().renderer,ta()?[{...ta(),r:Math.min(clearance,gap(position,ta())*.85)}]:[])});position=step.position;speed=step.speed;if(step.heading!==null){const turn=Math.atan2(Math.sin(step.heading-yaw),Math.cos(step.heading-yaw));yaw=tracking?yaw+Math.max(-3.2*dt,Math.min(3.2*dt,turn)):step.heading;}
   if(step.blocked){
    const next=chore&&reachable(position,chore.at,ta(),map());
    if(next?.length){route=next;speed=0;pendingActivity=chore.kind;tell('通道里有人，换一条路去做家务。');}
    else{pendingSeat=pendingActivity=null;leaving=false;chore=null;choreVisual.hide();tell('路线被挡住了，点另一块空地再走。');}
   }
   else if(!route.length){if(leaving){close('已离开，继续看看TA的一天。');return;}seat=pendingSeat;activity=pendingActivity;pendingSeat=pendingActivity=null;dwell=0;tell(activity?'你在'+activities[activity].label+'，TA继续自己的安排。':seat?'已坐到空位上，可以聊聊。':'已走到位置，点空地可以走动。');}
  }
  moving=route.length>0;
  if(!moving)dwell+=dt;
  if(chore){const piece=map().furniture.find(p=>p.id===chore.piece&&!p.stored);if(!piece){halt();tell('家具已收起，先停下家务。');}}
  if(hobbySpot){const current=map().spots.find(s=>s.id===hobbySpot.id&&s.piece===hobbySpot.piece);if(!current){halt();tell('兴趣家具已经收起了，先停下这个动作。');}else if(gap(current.target,hobbySpot.target)>.01||current.heading!==hobbySpot.heading){perform(activity||pendingActivity||manualAction);return;}}
  const action=activities[activity]?.action;task=action&&(hobbySpot||seat)?dailyTaskAt({action},hobbySpot||{action,piece:seat.piece,seat},map(),dwell,{moving,motion:profile,personal:true,position,actor:avatar}):null;
  const at=seat||position;avatar.root.position.set(at.x,0,at.z);avatar.root.rotation.y=seat?.heading??yaw;
  if(!moving&&chore)avatar.root.rotation.y=chore.heading;
  else if(!moving&&hobbySpot)avatar.root.rotation.y=hobbySpot.heading||0;
  else if(!moving&&!seat){const other=ta();if(other)avatar.root.rotation.y=tracking&&other.moving?other.heading:Math.atan2(other.x-at.x,other.z-at.z);}
  avatar.animate(time,{moving,sleepPose:!moving?bed:null,seated:!!seat,seatPose:seat?.pose,task,motion:profile,gesture:task?({read:'read',drink:'tea',eat:'eat'}[task.kind]||'rest'):'rest',height:floorHeight(map().id||map().renderer,at)+(seat?seat.rise+.05:0),...chorePose(chore,dwell,moving,position)});
  choreVisual.update(chore,dwell,moving||!!chore&&gap(position,chore.at)>.22);if(chore&&dwell>=chore.duration&&activity){activity=null;tell(CHORES[chore.kind].label+'完成了，可以继续选动作。');}
 }
 function pauseState(){
  const copy=s=>{if(!s)return null;const p=map().furniture.find(p=>p.id===s.piece),h=p?.heading||0,dx=s.x-(p?.x||0),dz=s.z-(p?.z||0);return {...s,local:{x:dx*Math.cos(h)-dz*Math.sin(h),z:dx*Math.sin(h)+dz*Math.cos(h)}};};
  return structuredClone({map:map().id||map().renderer,present,position,route,speed,yaw,bed,seat:copy(seat),pendingSeat:copy(pendingSeat),leaving,activity,pendingActivity,dwell,control,manualAction,autoWait,autoIndex,notice,chore,hobbySpot:hobbySpot?{id:hobbySpot.id,piece:hobbySpot.piece}:null});
 }
 function restore(saved){
  if(!saved?.present||saved.map!==(map().id||map().renderer)||!walkable(saved.position.x,saved.position.z,map().id||map().renderer))return false;
  halt();controlled=null;present=true;position={...saved.position};yaw=saved.yaw||0;control=saved.control==='manual'?'manual':'auto';manualAction=saved.manualAction||'manual';autoWait=saved.autoWait??8;autoIndex=saved.autoIndex||0;dwell=saved.dwell||0;notice=saved.notice||'';
  const seatAt=s=>{const p=map().furniture.find(p=>p.id===s?.piece);return p?.hobby?map().spots.find(q=>q.piece===p.id&&q.seat)?.seat||null:p?{...furnitureSeat(p,s.approach,s.local),rise:p.seat??.45}:null;};
  bed=saved.bed&&map().furniture.some(p=>p.kind==='bed'&&!p.stored&&p.id===saved.bed.piece)?{...saved.bed}:null;seat=seatAt(saved.seat);pendingSeat=seatAt(saved.pendingSeat);activity=saved.activity;pendingActivity=saved.pendingActivity;leaving=!!saved.leaving;
  if(saved.route?.length){const destination=saved.route.at(-1),path=reachable(position,destination,ta(),map());route=path||[];speed=route.length?saved.speed||0:0;}
  if(saved.chore){const p=chorePlans(map(),saved.chore.kind,position,ta()).find(p=>p.piece===saved.chore.piece);if(p)chore=p;else activity=pendingActivity=null;}
  if(saved.hobbySpot){hobbySpot=map().spots.find(p=>p.id===saved.hobbySpot.id&&p.piece===saved.hobbySpot.piece)||null;if(!hobbySpot)activity=pendingActivity=null;}
  if(!seat&&!route.length&&pendingSeat){seat=pendingSeat;activity=pendingActivity;pendingSeat=pendingActivity=null;}
  avatar.root.visible=true;autoWait=Math.max(autoWait,bed?12:0);tick(0,0);tell();return true;
 }
 avatar.root.visible=false;return {join,act,close,tick,inspect,pauseState,restore,
  setChoice(choice){control=Object.hasOwn(activities,choice)||choice==='manual'?'manual':'auto';manualAction=Object.hasOwn(activities,choice)?choice:'manual';halt();},
  takeControl(){control='manual';manualAction='manual';route=[];pendingSeat=pendingActivity=null;speed=0;leaving=false;tell();},
  control(info){if(!info.automatic){control='manual';manualAction='manual';}chore=null;choreVisual.hide();controlled=info;activity=pendingActivity=task=null;dwell=0;position={...info.b};seat=info.bSeat||null;bed=info.beds?.b||null;route=[];tell(info.kind==='travel'?'一起走向门口，去下一站…':info.phase!=='active'?'正在走到互动位置…':(info.automatic?'TA先靠近 · ':'')+info.label+'中，可以随时结束。');},
  release(info){controlled=null;autoWait=12;if(info){position={...info.b};seat=info.seats?.b||null;bed=info.beds?.b||null;}tell(info?.reason||'继续各自活动。');}
 };
}

export const createHomeVisit=createSceneVisit;
