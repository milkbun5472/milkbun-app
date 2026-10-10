// A visit is a visible, disposable scene session. It has no save or chat writer.
import {MAPS,findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-163c7f71112cb39b';
import {PERSONAL_SPACE} from '../companion.mjs?v=fg-163c7f71112cb39b';
import {stepRoute} from '../locomotion.mjs?v=fg-163c7f71112cb39b';
import {furniturePoint,furnitureSeat,usesFor} from './home-catalog.mjs?v=fg-163c7f71112cb39b';
import {dailyTaskAt} from './daily-workflow.mjs?v=fg-163c7f71112cb39b';
import {CHORES,chorePlans} from './chores.mjs?v=fg-163c7f71112cb39b';
const activities={read:{action:'read',label:'看书'},drink:{action:'tea',label:'喝水'},eat:{action:'meal',label:'用餐'},rest:{action:'rest',label:'休息'},...CHORES};
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clearance=PERSONAL_SPACE+.16;
const automaticActivities=['read','walk','drink','rest'];
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
 const choices=[];for(const distance of [1.05,1.4,1.8])for(let n=0;n<16;n++){const a=n*Math.PI/8,to={x:ta.x+Math.cos(a)*distance,z:ta.z+Math.sin(a)*distance},route=reachable(from,to,ta,map);if(route)choices.push({to,route});}
 return choices.sort((a,b)=>gap(from,a.to)-gap(from,b.to))[0]||null;
}
export function createSceneVisit({avatar,ta,motion=()=>null,onChange=()=>{},choice='auto',choreVisual={hide(){},update(){}},map=()=>MAPS.dayHome}){
 let chore=null;
 let present=false,position={...MAPS.dayHome.spawn},route=[],speed=0,yaw=0,seat=null,pendingSeat=null,leaving=false,controlled=null,notice='',last='',activity=null,pendingActivity=null,dwell=0,task=null,control=choice==='manual'||Object.hasOwn(activities,choice)?'manual':'auto',manualAction=Object.hasOwn(activities,choice)?choice:'manual',autoWait=8,autoIndex=0;
 const inspect=()=>({map:map().id||map().renderer,present,position:{...position},route:route.map(q=>({...q})),seated:!!seat,seat:seat?{...seat}:null,busy:controlled?controlled.moving:route.length>0,interaction:controlled?.kind||null,interactionPhase:controlled?.phase||null,leaving,notice,activity,pendingActivity,control,manualAction,task,chore:chore?{...chore,route:undefined,elapsed:dwell,finished:dwell>=chore.duration}:null,choreContact:avatar.root.userData.chore,dailyAction:avatar.root.userData.dailyAction,motion:motion(),visible:avatar.root.visible,visualPosition:avatar.root.position.toArray(),leg:avatar.root.getObjectByName?.('leftLeg')?.rotation.x});
 function tell(text){if(text!==undefined)notice=present&&control==='auto'?'自动 · '+text:text;const info=inspect(),key=JSON.stringify([present,info.busy,info.seated,info.interaction,info.interactionPhase,leaving,notice,activity,pendingActivity,control,manualAction]);if(key!==last){last=key;onChange(info);}}
 function halt(){chore=null;choreVisual.hide();route=[];speed=0;leaving=false;seat=pendingSeat=null;activity=pendingActivity=task=null;dwell=0;}
 function go(to,nextSeat=null,nextActivity=null){
  const next=reachable(position,to,ta(),map());if(!next){tell('这里暂时走不过去，换个空位试试。');return false;}
  seat=null;activity=null;task=null;dwell=0;pendingSeat=nextSeat;pendingActivity=nextActivity;route=next;speed=0;
  if(!route.length){seat=pendingSeat;activity=pendingActivity;pendingSeat=pendingActivity=null;}tell(seat?'已坐下，可以聊聊。':'正在走过去…');return true;
 }
 function join({automatic=false,arrival=false,restore=null}={}){
  if(restore){control=restore.control;manualAction=restore.manualAction||'manual';}controlled=null;chore=null;choreVisual.hide();
  present=true;leaving=false;seat=pendingSeat=null;activity=pendingActivity=task=null;dwell=0;position={...map().spawn};
  if(automatic||arrival){const free=visitNear(position,ta(),map());if(!free){present=false;tell('小家暂时没有能站稳的空位，整理好通道后可以再进来。');return false;}position={...free.to};}
  avatar.root.visible=true;
  // An arriving visitor uses the existing doorway, then gives it back.
  avatar.root.position.set(position.x,floorHeight(map().id||map().renderer,position),position.z);
  autoWait=automatic?0:8;autoIndex=Math.floor(motion()?.phase||0);
  if(control==='manual'){if(activities[manualAction])perform(manualAction);else tell('手动控制中，点空地或选动作。');}
  else{const free=visitNear(position,ta(),map());if(free)go(free.to);else tell('已走进来，点空地可以走动。');}return true;
 }
 function stand(){halt();tell('手动控制中，点空地或选动作。');return true;}
 function perform(kind,point){
  if(!CHORES[kind]){chore=null;choreVisual.hide();}
  if(kind==='stand'||kind==='manual')return stand();
  if(kind==='walk')return point&&Number.isFinite(point.x)&&Number.isFinite(point.z)?go(point):false;
  if(kind==='sit'){const q=chooseVisitSeat(map(),position,ta()?.seat,ta());if(!q){tell('没有能走到的空座位，可以站着陪一会儿。');return false;}return go(q.seat.approach,q.seat);}
  if(CHORES[kind]){
   const plan=chorePlans(map(),kind,position,ta())[0];if(!plan){tell('没有能走到的对应家具，先布置好再来。');return false;}
   const ok=go(plan.at,null,kind);if(ok){chore=plan;yaw=plan.heading;tell('正在走去'+CHORES[kind].label+'的位置…');}return ok;
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
  if(kind==='auto'){control='auto';manualAction='manual';halt();autoWait=0;tell('会自己找空位活动，随时可以手动接管。');return true;}
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
  for(let n=0;n<automaticActivities.length;n++){
   const kind=automaticActivities[autoIndex++%automaticActivities.length];
   if(kind==='walk'?stroll():perform(kind))return;
  }
  tell('暂时没有能走到的空位，先歇一会儿。');
 }
 function close(text=''){chore=null;choreVisual.hide();present=false;leaving=false;controlled=null;route=[];seat=pendingSeat=null;activity=pendingActivity=task=null;avatar.root.visible=false;tell(text);}
 function tick(dt,time){
  if(!present||controlled)return;
  let moving=route.length>0;
  const profile=motion();
  if(control==='auto'&&!moving){autoWait-=Math.max(0,dt);if(autoWait<=0){automatic();moving=route.length>0;}}
  if(moving){const step=stepRoute(position,route,dt,{speed,walkSpeed:1.45*(profile?.walk||1),clear:(a,b)=>segmentClear(a,b,map().id||map().renderer,ta()?[{...ta(),r:Math.min(clearance,gap(position,ta())*.85)}]:[])});position=step.position;speed=step.speed;if(step.heading!==null)yaw=step.heading;
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
  const action=activities[activity]?.action;task=seat&&action?dailyTaskAt({action},{action,piece:seat.piece,seat},map(),dwell,{moving,motion:profile,personal:true}):null;
  const at=seat||position;avatar.root.position.set(at.x,0,at.z);avatar.root.rotation.y=seat?.heading??yaw;
  if(!moving&&chore)avatar.root.rotation.y=chore.heading;
  else if(!moving&&!seat){const other=ta();if(other)avatar.root.rotation.y=Math.atan2(other.x-at.x,other.z-at.z);}
  avatar.animate(time,{moving,seated:!!seat,seatPose:seat?.pose,task,motion:profile,gesture:task?{read:'read',drink:'tea',eat:'eat'}[task.kind]:'rest',height:floorHeight(map().id||map().renderer,at)+(seat?seat.rise+.05:0)});
  choreVisual.update(chore,dwell,moving||!!chore&&gap(position,chore.at)>.22);if(chore&&dwell>=chore.duration&&activity){activity=null;tell(CHORES[chore.kind].label+'完成了，可以继续选动作。');}
 }
 avatar.root.visible=false;return {join,act,close,tick,inspect,
  setChoice(choice){control=Object.hasOwn(activities,choice)||choice==='manual'?'manual':'auto';manualAction=Object.hasOwn(activities,choice)?choice:'manual';halt();},
  control(info){if(!info.automatic){control='manual';manualAction='manual';}chore=null;choreVisual.hide();controlled=info;activity=pendingActivity=task=null;dwell=0;position={...info.b};seat=info.bSeat||null;route=[];tell(info.kind==='travel'?'一起走向门口，去下一站…':info.phase!=='active'?'正在走到互动位置…':info.label+'中，可以随时结束。');},
  release(info){controlled=null;autoWait=12;if(info){position={...info.b};seat=info.seats?.b||null;}tell(info?.reason||'继续各自活动。');}
 };
}

export const createHomeVisit=createSceneVisit;
