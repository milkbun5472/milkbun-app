import {MAPS,COMPANION_DESTINATIONS,ACTIVITIES,seasonOf,weather,exitToward,findPath,segmentClear,walkable,companionCare} from './world.mjs?v=fg-7b571cbd113377b9';
const activity=ACTIVITIES;
const timetables={
 gardener:[[420,'home'],[480,'flowers'],[600,'herbs'],[720,'study'],[840,'potion'],[1020,'glow'],[1200,'home']],
 explorer:[[420,'home'],[480,'herbs'],[660,'mushrooms'],[840,'flowers'],[960,'glow'],[1200,'home']],
 scholar:[[420,'home'],[480,'study'],[660,'pond'],[840,'potion'],[1080,'home']]
};
export function dailySchedule(s){const season=seasonOf(s.day),plan=s.seasonPlan?.season===season.index?s.seasonPlan.days.find(d=>d.day===season.day):null;const list=plan?[[420,'home'],...plan.activities.map((a,i)=>[[480,840,1080][i],a.id,a.note]),[1260,'home']]:timetables[s.companion.temperament];return list.map(([start,id,note])=>{if(!plan&&s.day%2===0&&id==='herbs')id='mushrooms';let adjusted=false;if(['细雨','细雪'].includes(weather(s.day,s.epoch))&&activity[id].map==='forest'){id='rain';adjusted=true;}return {start,id,...activity[id],note:adjusted?'雨雪天改在屋檐下活动。':note||''};});}
export function plannedActivity(s){const list=dailySchedule(s);return list.findLast(item=>s.minute>=item.start)||list[0];}
export const PERSONAL_SPACE=.58;
function followPoint(s){
 const p=s.position,c=s.companion,from=c.map===s.map?c.position:MAPS[s.map].spawn,d=Math.hypot(from.x-p.x,from.z-p.z);
 // Already comfortably nearby: stay on this side instead of choosing a new slot.
 if(c.map===s.map&&d>=PERSONAL_SPACE&&d<=1.05)return {...from};
 const angle=Math.atan2(from.z-p.z,from.x-p.x),avoid=[{...p,r:PERSONAL_SPACE}],candidates=[];
 for(const radius of [.85,1.1,1.4])for(let i=0;i<16;i++){const a=angle+i*Math.PI/8,q={x:p.x+Math.cos(a)*radius,z:p.z+Math.sin(a)*radius};if(walkable(q.x,q.z,s.map))candidates.push(q);}
 candidates.sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z));
 // The closest clear route wins. Never fall back to the player's exact location.
 for(const radius of [.85,1.1,1.4]){let best=null,length=Infinity;for(const q of candidates.filter(q=>Math.abs(Math.hypot(q.x-p.x,q.z-p.z)-radius)<.01)){const direct=Math.hypot(q.x-from.x,q.z-from.z);if(direct>=length)break;const path=findPath(from,q,s.map,avoid);if(!path)continue;let total=0,prev=from;for(const n of path){total+=Math.hypot(n.x-prev.x,n.z-prev.z);prev=n;}if(total<length){length=total;best=q;}}
 if(best)return best;}return {...from};
}
export function companionPlan(s){const c=s.companion;const seat=MAPS[s.map].seats?.[s.seat];if(c.mode==='follow'&&seat)return {id:'sit-together',map:s.map,target:seat.companion,label:'在池边陪你坐着',gesture:'sit',heading:seat.heading};if(c.mode==='wait')return {id:'wait',map:c.map,target:{...c.position},label:'留在这里等你',gesture:'rest'};if(c.mode==='goto')return {id:'goto:'+c.destination,...COMPANION_DESTINATIONS[c.destination||'home'],gesture:'rest'};if(c.mode==='follow')return {id:'follow',map:s.map,target:followPoint(s),label:c.map===s.map?'和你一起走':'正沿着小路来找你',gesture:'rest'};const plan=plannedActivity(s);if(plan.map===s.map&&Math.hypot(plan.target.x-s.position.x,plan.target.z-s.position.z)<.65){return {...plan,id:plan.id+'-aside',target:followPoint(s),label:'在一旁陪你',gesture:'rest'};}return plan;}
// One movement controller runs on both maps, including the map currently off screen.
// Paths are rebuilt after loading; only actual position and once-per-day help persist.
export function makeCompanionController(){
 let route=[],routeKey='',idle=0,finishedKey='',moving=false,gesture='rest',heading=0,status='准备出门',stuck=false,cooldown=0,cachedFollow=null;
 function reset(){route=[];routeKey='';idle=0;finishedKey='';moving=false;stuck=false;cachedFollow=null;}
 function tick(s,dt,{allowCare=true}={}){
  cooldown=Math.max(0,cooldown-dt);
  const c=s.companion,routine=c.mode==='follow'?null:c.mode==='routine'?plannedActivity(s):companionPlan(s),needsNear=c.mode==='follow'||routine.map===s.map&&Math.hypot(routine.target.x-s.position.x,routine.target.z-s.position.z)<.65;
  const choiceKey=c.mode==='follow'?'follow:'+String(s.seat):`${s.day}:${c.temperament}:${routine.id}:${routine.start}`;let plan;
  if(needsNear){if(!cachedFollow||cachedFollow.key!==choiceKey||cachedFollow.map!==s.map||cachedFollow.fromMap!==c.map||Math.hypot(s.position.x-cachedFollow.anchor.x,s.position.z-cachedFollow.anchor.z)>.25||stuck&&cooldown<=0)cachedFollow={key:choiceKey,plan:c.mode==='goto'?{...routine,target:followPoint(s)}:companionPlan(s),map:s.map,fromMap:c.map,anchor:{...s.position}};plan=cachedFollow.plan;}else{cachedFollow=null;plan=routine;}
  const cross=c.map!==plan.map,exit=cross?exitToward(c.map,plan.map):null;if(cross&&!exit){moving=false;status='这里还没有通往那里的小路';return {state:s,event:null};}const goal=cross?exit.target:plan.target,avoid=c.map===s.map?[{...s.position,r:PERSONAL_SPACE}]:[];
  const key=`${s.day}:${c.mode}:${c.temperament}:${plan.id}:${plan.map}:${goal.x.toFixed(1)}:${goal.z.toFixed(1)}`;
  if((key!==routeKey||stuck&&cooldown<=0)&&(c.mode!=='follow'||!route.length||cross||cooldown<=0)){cooldown=.65;routeKey=key;route=[];idle=0;stuck=false;const distance=Math.hypot(c.position.x-goal.x,c.position.z-goal.z);if(distance>.12){route=findPath(c.position,goal,c.map,avoid)||[];stuck=!route.length;}}
  let out=s,event=null;moving=route.length>0;gesture='rest';
  if(moving){let budget=Math.max(0,dt)*1.15,pos={...c.position};while(route.length&&budget>0){const q=route[0];if(!segmentClear(pos,q,c.map,avoid)){route=[];routeKey='';cooldown=0;cachedFollow=null;break;}const dx=q.x-pos.x,dz=q.z-pos.z,d=Math.hypot(dx,dz);if(d>.0001)heading=Math.atan2(dx,dz);if(d<=budget){pos={...q};route.shift();budget-=d;}else{pos.x+=dx/d*budget;pos.z+=dz/d*budget;budget=0;}}out={...s,companion:{...c,position:pos}};status=cross?`正在走向${MAPS[plan.map].name}`:`正去${plan.label}`;}
  else if(stuck){status='在原地等一条合适的小路';}
  else if(cross){out={...s,companion:{...c,map:exit.to,position:{...(exit.at||MAPS[exit.to].spawn)}}};routeKey='';status=`刚到${MAPS[plan.map].name}`;}
  else{idle+=dt;gesture=plan.gesture;if(Number.isFinite(plan.heading))heading=plan.heading;status=plan.label;if(plan.id==='follow'){status='在你身边';gesture='rest';}if(plan.id==='flowers'){heading=Math.PI;if(c.helpDay===s.day){status='在花圃旁看看新芽';gesture='rest';}}
   if(allowCare&&plan.id==='flowers'&&idle>=2.8&&finishedKey!==key){out=companionCare(s);finishedKey=key;if(out!==s)event=`${c.name}用自带的晨露照料了一朵月光花。`;}
  }
  return {state:out,event};
 }
 return {tick,reset,view:()=>({moving,gesture,heading,status,stuck})};
}
