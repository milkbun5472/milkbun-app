import {stepRoute} from './locomotion.mjs?v=fg-c1d3b16f6a1d9306';
import {MAPS,COMPANION_DESTINATIONS,ACTIVITIES,seasonOf,weather,exitToward,findPath,segmentClear,walkable,companionCare,noteHappening,addMiss,onLakeIce,missWanting,missGaveUp,workSpot} from './world.mjs?v=fg-c1d3b16f6a1d9306';
const activity=ACTIVITIES;
// ⚠️原来这儿是三张按「性格」分的表（爱照料植物／爱探索／喜欢安静研究）。
//   那三档换个角色照样成立——正是「换个角色还照样成立的就是写坏了」，v69.55 撤掉。
//   日程一律由模型按【他自己的人设】排（generateSeason 那一枪）；这一张只是排不出来时的
//   【地板】，一眼看得出是「今天还没排上」，不假装那是他的性格。
// ⚠️'flowers' 那一格不能省：他每天顺手帮你浇一次花（companionCare）是从第一版就有的。
//   地板表里没有它＝没配线路的人打开游戏，他从此再也不浇花了——这种悄悄没掉的东西最坏。
//   它不是「性格」，是家门口那件唯一的杂活。
const FALLBACK=[[420,'home'],[480,'flowers'],[720,'walk'],[1080,'home']];
// 邻居的「家」是他自己那间屋：⚠️不改这一句的话，三个邻居全会挤在你家门口。
function spread(id,target,map){
 let h=0;for(const ch of String(id||''))h=(h*31+ch.charCodeAt(0))>>>0;
 const a=(h%8)/8*Math.PI*2,r=.55+((h>>3)%3)*.22;
 const p={x:target.x+Math.cos(a)*r,z:target.z+Math.sin(a)*r};
 return walkable(p.x,p.z,map)?p:target;
}
function homeFor(s,plan){const who=s.companion;if(!who||!who.home)return plan;
 const h=who.home,site=MAPS.garden.sites[h];
 // 邻居的「家」是他自己那间屋：不改这一句的话，三个邻居全会挤在你家门口
 if(site&&['home','rain'].includes(plan.id))
  return {...plan,map:'garden',target:spread(who.charId,site.target,'garden'),label:'在'+site.label+'门前'};
 return {...plan,target:spread(who.charId,plan.target,plan.map)};}
// 下雨下雪那天，没有遮头的那几格都挪到檐下。
// ⚠️这三格例外是【本来就有遮头】的：屋前那一格就是檐下，浇花是自家门口那件杂活
//   （第一版就有，见上面那条），rain 自己就是目的地。
// ⚠️原来这条只挪林地那几格——于是下雨天他照样坐在小桥上、逛集市，
//   而「补好屋顶就能进去躲雨」这件事从此没有下文。说错了就删掉重写，不挂「除非」。
const DRY_IN_RAIN=new Set(['home','flowers','rain']);
const NEIGHBOR_DAY=[[420,'home'],[540,'walk'],[780,'market'],[1020,'bridge'],[1200,'home']];
// 三个邻居别整齐划一地同时出门：按 charId 把时刻各错开一点
const shiftBy=id=>{let h=0;for(const ch of String(id||''))h=(h*31+ch.charCodeAt(0))>>>0;return (h%5)*18;};
export function dailySchedule(s){const season=seasonOf(s.day),who=s.companion,
 plan=who&&who.home?null:(s.seasonPlan?.season===season.index?s.seasonPlan.days.find(d=>d.day===season.day):null);
 const shift=who&&who.home?shiftBy(who.charId):0;
 const list=plan?[[420,'home'],...plan.activities.map((a,i)=>[[480,840,1080][i],a.id,a.note]),[1260,'home']]
  :(who&&who.home?NEIGHBOR_DAY.map(([t,id])=>[t+shift,id]):FALLBACK);return list.map(([start,id,note])=>{let adjusted=false;if(['细雨','细雪'].includes(weather(s.day,s.epoch))&&!MAPS[activity[id].map].interior&&!DRY_IN_RAIN.has(id)){id='rain';adjusted=true;}return {start,id,...activity[id],note:adjusted?'雨雪天改在屋檐下活动。':note||''};});}
// 修好的地方改了他这一格去哪儿（旧塔补好了，雨天就去塔檐下，不再是自家屋檐）。
// ⚠️和 homeFor 一个道理，必须写在 plannedActivity 这一处：tick 在 mode==='routine'
//   时【绕开 companionPlan 直接用 plannedActivity】，写在 companionPlan 里，
//   他最常见的那个模式一次都读不到——这一课这一季已经栽过两次了。
const worksFor=(s,plan)=>{const spot=workSpot(s,plan.id);return spot?{...plan,...spot}:plan;};
export function plannedActivity(s){const list=dailySchedule(s);return homeFor(s,worksFor(s,list.findLast(item=>s.minute>=item.start)||list[0]));}
export const PERSONAL_SPACE=.58;
function followPoint(s){
 const p=s.position,c=s.companion,from=c.map===s.map?c.position:MAPS[s.map].spawn,d=Math.hypot(from.x-p.x,from.z-p.z);
 // Already comfortably nearby: stay on this side instead of choosing a new slot.
 if(c.map===s.map&&d>=PERSONAL_SPACE&&d<=1.05)return {...from};
 const angle=Math.atan2(from.z-p.z,from.x-p.x),avoid=[{...p,r:PERSONAL_SPACE}],candidates=[];
 for(const radius of [.85,1.1,1.4])for(let i=0;i<16;i++){const a=angle+i*Math.PI/8,q={x:p.x+Math.cos(a)*radius,z:p.z+Math.sin(a)*radius};if(walkable(q.x,q.z,s.map,s))candidates.push(q);}
 candidates.sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z));
 // Prefer a nearby clear slot; search around obstacles only when no direct slot is reachable.
 // Do not run a full A* for every candidate every frame along a concave shore.
 for(const radius of [.85,1.1,1.4]){const nearby=candidates.filter(q=>Math.abs(Math.hypot(q.x-p.x,q.z-p.z)-radius)<.01);
  for(const q of nearby)if(segmentClear(from,q,s.map,avoid,s))return q;
  for(const q of nearby)if(findPath(from,q,s.map,avoid,s))return q;
 }return {...from};
}
// 他自己要来找她的那一版计划。⚠️只此一份：companionPlan 和 tick 都来问它——
//   ⚠️tick 在 mode==='routine' 时【绕开 companionPlan 直接用 plannedActivity】，
//     所以只改 companionPlan 的话，他最常处的那个模式里永远不会来（2026-09-17 实机抓到）。
function missIntent(s){
 if(MAPS.home.beds[s.sleep?.companion]||!missWanting(s)||missGaveUp(s))return null;
 return {id:'miss',map:s.map,label:'找你说句话',gesture:'rest'};
}
export function missPlan(s){const intent=missIntent(s);return intent?{...intent,target:followPoint(s)}:null;}
export function companionPlan(s){const b=MAPS.home.beds[s.sleep?.companion];if(b)return {id:'sleep:'+s.sleep.companion,map:'home',target:b.approach.companion,label:'在'+b.label+'休息',gesture:'sleep',heading:0};const miss=missPlan(s);if(miss)return miss;const c=s.companion;const seat=MAPS[s.map].seats?.[s.seat];if(c.mode==='follow'&&seat)return {id:'sit-together',map:s.map,target:seat.companion,label:'在池边陪你坐着',gesture:'sit',heading:seat.heading};if(c.mode==='wait')return {id:'wait',map:c.map,target:{...c.position},label:'留在这里等你',gesture:'rest'};if(c.mode==='goto')return {id:'goto:'+c.destination,...COMPANION_DESTINATIONS[c.destination||'home'],gesture:'rest'};if(c.mode==='follow')return {id:'follow',map:s.map,target:followPoint(s),label:c.map===s.map?'和你一起走':'正沿着小路来找你',gesture:'rest'};const plan=plannedActivity(s);if(plan.map===s.map&&Math.hypot(plan.target.x-s.position.x,plan.target.z-s.position.z)<.65){return {...plan,id:plan.id+'-aside',target:followPoint(s),label:'在一旁陪你',gesture:'rest'};}return plan;}
// One movement controller runs on both maps, including the map currently off screen.
// Paths are rebuilt after loading; only actual position and once-per-day help persist.
export function makeCompanionController(){
 let speed=0;
 let route=[],routeKey='',idle=0,finishedKey='',moving=false,gesture='rest',heading=0,status='准备出门',stuck=false,cooldown=0,cachedFollow=null;
 function reset(){speed=0;route=[];routeKey='';idle=0;finishedKey='';moving=false;stuck=false;cachedFollow=null;}
 // ⚠️autonomous＝这一位是邻居，不是跟你在一起的那个：
 //   「来找你说话」「去馆里看你留下的东西」「帮你浇花」都是【你和他之间】的事，
 //   邻居跟着做就荒唐了（三个人排队来找你说话）。走路那一段照旧共用。
 function tick(s,dt,{allowCare=true,autonomous=false}={}){
  cooldown=Math.max(0,cooldown-dt);
  const c=s.companion,sleeping=!!MAPS.home.beds[s.sleep?.companion],wants=autonomous?null:missIntent(s),routine=wants?{...wants,target:s.position}:(sleeping?companionPlan(s):c.mode==='follow'?null:c.mode==='routine'?plannedActivity(s):companionPlan(s)),needsNear=!sleeping&&(!!wants||c.mode==='follow'||routine.map===s.map&&Math.hypot(routine.target.x-s.position.x,routine.target.z-s.position.z)<.65);
  const choiceKey=wants?'miss:'+s.day:c.mode==='follow'?'follow:'+String(s.seat):`${s.day}:${routine.id}:${routine.start}`;let plan;
  if(needsNear){if(!cachedFollow||cachedFollow.key!==choiceKey||cachedFollow.map!==s.map||cachedFollow.fromMap!==c.map||Math.hypot(s.position.x-cachedFollow.anchor.x,s.position.z-cachedFollow.anchor.z)>.25||stuck&&cooldown<=0)cachedFollow={key:choiceKey,plan:c.mode==='goto'?{...routine,target:followPoint(s)}:companionPlan(s),map:s.map,fromMap:c.map,anchor:{...s.position}};plan=cachedFollow.plan;}else{cachedFollow=null;plan=routine;}
  const cross=c.map!==plan.map,exit=cross?exitToward(c.map,plan.map):null;if(cross&&!exit){moving=false;status='这里还没有通往那里的小路';return {state:s,event:null};}const goal=cross?exit.target:plan.target,avoid=c.map===s.map?[{...s.position,r:PERSONAL_SPACE}]:[];
  const key=`${s.day}:${c.mode}:${plan.id}:${plan.map}:${goal.x.toFixed(1)}:${goal.z.toFixed(1)}`;
  if((key!==routeKey||stuck&&cooldown<=0)&&(c.mode!=='follow'||!route.length||cross||cooldown<=0)){cooldown=.65;routeKey=key;route=[];idle=0;stuck=false;const distance=Math.hypot(c.position.x-goal.x,c.position.z-goal.z);if(distance>.12){route=findPath(c.position,goal,c.map,avoid,s)||[];stuck=!route.length;}}
  let out=s,event=null;moving=route.length>0;gesture='rest';
  if(moving){const step=stepRoute(c.position,route,dt,{speed,skating:onLakeIce(c.map,c.position,s),walkSpeed:1.15,iceSpeed:3.05,clear:(a,b)=>segmentClear(a,b,c.map,avoid,s)});speed=step.speed;if(step.heading!==null)heading=step.heading;if(step.blocked){routeKey='';cooldown=0;cachedFollow=null;}out={...s,companion:{...c,position:step.position}};status=cross?`正在走向${MAPS[plan.map].name}`:`正去${plan.label}`;}
  else if(stuck){status='在原地等一条合适的小路';}
  else if(cross){out={...s,companion:{...c,map:exit.to,position:{...(exit.at||MAPS[exit.to].spawn)}}};routeKey='';status=`刚到${MAPS[plan.map].name}`;}
  else{idle+=dt;gesture=plan.gesture;if(Number.isFinite(plan.heading))heading=plan.heading;status=plan.label;if(plan.id==='follow'){status='在你身边';gesture='rest';}if(plan.id==='miss'){status='像是有话要说';gesture='rest';}if(plan.id==='flowers'){heading=Math.PI;if(c.helpDay===s.day){status='在花圃旁看看新芽';gesture='rest';}}
   if(allowCare&&!autonomous&&plan.id==='flowers'&&idle>=2.8&&finishedKey!==key){out=companionCare(s);finishedKey=key;if(out!==s)event=`${c.name}用自带的晨露照料了一朵月光花。`;}
   if(!autonomous&&plan.id==='museum'&&idle>=2.8&&finishedKey!==key){finishedKey=key;
    const kept=(s.collection||[])[0];
    if(kept){out=noteHappening(addMiss(s,'kept'),'world',c.name+'在馆里站了一会儿，看的是「'+kept.name+'」');
     event=`${c.name}去馆里看了看你留下的东西。`;}
    else {out=noteHappening(s,'world',c.name+'去馆里转了一圈，架子还空着');event=`${c.name}去了馆里，架子上还什么都没有。`;}}
  }
  return {state:out,event};
 }
 return {tick,reset,view:()=>({moving,gesture,heading,status,stuck})};
}
