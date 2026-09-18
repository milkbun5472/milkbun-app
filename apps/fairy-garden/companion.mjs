import {stepRoute} from './locomotion.mjs?v=fg-6f142a58585918a8';
import {seatsOf,nightMarketDay,festivalDay,lakeFrozen,MAPS,COMPANION_DESTINATIONS,ACTIVITIES,seasonOf,weather,exitToward,findPath,segmentClear,walkable,companionCare,companionMillHelp,noteHappening,opened,addMiss,onLakeIce,missWanting,missGaveUp,workSpot,walkSpeedFor,starLive,starOther,restoreStar,STAR_SPOTS,destinationOf,noteBond,guideStep,guideTarget,marketDay,areaSpots,areaPick} from './world.mjs?v=fg-6f142a58585918a8';
const activity=ACTIVITIES;
// ⚠️原来这儿是三张按「性格」分的表（爱照料植物／爱探索／喜欢安静研究）。
//   那三档换个角色照样成立——正是「换个角色还照样成立的就是写坏了」，v69.55 撤掉。
//   日程一律由模型按【他自己的人设】排（generateSeason 那一枪）；这一张只是排不出来时的
//   【地板】，一眼看得出是「今天还没排上」，不假装那是他的性格。
// ⚠️'flowers' 那一格不能省：他每天顺手帮你浇一次花（companionCare）是从第一版就有的。
//   地板表里没有它＝没配线路的人打开游戏，他从此再也不浇花了——这种悄悄没掉的东西最坏。
//   它不是「性格」，是家门口那件唯一的杂活。
// ⚠️她 2026-09-17 截图：「他这个行动都不会干别的」。原来这张地板表是【钉死的四格】，
//   没一起排过这一季的话，他一年到头就是 起床／浇花／走走／回屋前——
//   而这个世界里有二十几处地方可去。
// ⚠️这仍旧是【地板】，不是他的性格：挑哪几处只看【今天是第几天】（加存档号），
//   同一天进来几次都一样，也一个字不编他喜欢什么。真正照着他的人设排的那一份，
//   还是季节手册里那一枪（generateSeason）——这张表只是在那之前别让日子长得一模一样。
// ⚠️她 2026-09-18：「把新加的场景的动作交互也补上吧」。原来这儿是【手抄的一串 id】，
//   于是 codex 每长出一处地方，这张表就漏一处：水磨工坊的 workshop 早就在 ACTIVITIES 里、
//   companionMillHelp 也早就写好了，可地板表里没有它，他从来没被排去过一次。
//   现在这串照 ACTIVITIES 长——那一张才是「这个世界里他能去的地方」的唯一一份
//   （施工规则/one-public-mechanism.md）。以后那边加一处，这边不用改一个字。
// ⚠️三根钉子不进池子：起床/天黑那两格是 home，早上那件杂活是 flowers，
//   rain 是雨雪天的落脚处、不是一件可以排的事。
const FLOOR_NAILS=new Set(['home','flowers','rain']);
// 路还没打开的那几处不排：排了他也只会走到封口前面，然后「在原地等一条合适的小路」。
const reachable=(id,s)=>{const need=activity[id].opensWith;return !need||opened(s,need);};
// 集市只在集市日排（不是集市日摊子空着，他去了也只是站在空摊前）
// 夜市不进抽签池：一季只有那两晚，而且得是天黑那一格——floorDay 在那两天直接把它钉在最后一格
// 这一格【今天成不成立】。⚠️原来「集市日才逛集市」是写死在下面那一行里的一个从句，
//   再来一格带季节的（冰面）就得在那儿再挂一个——收成一张表，那一行只问一句。
//   ⚠️为什么在这儿而不是跟着活动走：判据（marketDay／lakeFrozen）住在 world.mjs，
//     而 rules.js 是它的上游，看不见它们。这儿是唯一同时看得见两边的地方。
const ACTIVITY_WHEN={market:s=>marketDay(s.day),ice:s=>lakeFrozen(s),
 // 「回自己屋里」只有住在村里的人成立：同行者跟你同住，他没有「自己那间屋」
 indoors:s=>!!(s.companion&&s.companion.home)};
const inSeason=(id,s)=>!ACTIVITY_WHEN[id]||ACTIVITY_WHEN[id](s);
// ⚠️fair／festival 不进池子是另一回事：它们不靠抽签，到日子直接插进傍晚那一格（见下面）。
const floorPool=s=>Object.keys(activity).filter(id=>!FLOOR_NAILS.has(id)&&id!=='fair'&&id!=='festival'&&reachable(id,s)&&inSeason(id,s));
const pickFloor=(seed,n,s)=>{const pool=floorPool(s),out=[];
 let h=2166136261;for(const ch of String(seed)){h=Math.imul(h^ch.charCodeAt(0),16777619);}
 for(let i=0;i<n&&pool.length;i++){h=Math.imul(h^(h>>>13),16777619)>>>0;out.push(pool.splice(h%pool.length,1)[0]);}
 return out;};
// 起床在屋前、早上那件杂活、天黑回屋前是三根钉子；中间那三格每天不一样。
// ⚠️'flowers' 那一格不许动（下面那条注释说的就是它）。
const floorDay=s=>{const [a,b,c]=pickFloor(String(s.epoch)+':floor:'+s.day,3,s);
 return [[420,'home'],[480,'flowers'],[660,a],[900,b],[1140,festivalDay(s.day)?'festival':nightMarketDay(s.day)?'fair':c],[1260,'home']];};
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
 // 真的进屋里去。⚠️那三间屋的内部地图 id 就是房子 id（connectInterior 那一处定的），
 //   所以这一句不用另存一张「谁住哪间屋对应哪张图」的表。
 if(plan.id==='indoors'&&MAPS[h])
  return {...plan,map:h,target:{...MAPS[h].spawn},label:'在'+MAPS[h].name+'里'};
 return {...plan,target:spread(who.charId,plan.target,plan.map)};}
// 下雨下雪那天，没有遮头的那几格都挪到檐下。
// ⚠️这三格例外是【本来就有遮头】的：屋前那一格就是檐下，浇花是自家门口那件杂活
//   （第一版就有，见上面那条），rain 自己就是目的地。
// ⚠️原来这条只挪林地那几格——于是下雨天他照样坐在小桥上、逛集市，
//   而「补好屋顶就能进去躲雨」这件事从此没有下文。说错了就删掉重写，不挂「除非」。
// 他跟着村子一起走快了，但快不过【那座桥容得下的步子】。
// ⚠️2.0 往上他上不了小岛：芦苇桥只有 1.45 宽，一步迈得太大，那一段就过不去，
//   他会站在桥头「等一条合适的小路」——codex 那条小岛测试正好钉住了这件事，
//   以后谁想再调快，先让那条测试过。
const COMPANION_TOP=1.8;
// 集市和夜市的摊子有棚，雨天照常
const DRY_IN_RAIN=new Set(['home','flowers','rain','market','fair','festival','indoors']);
// ⚠️邻居这一天走的是【另一条分支】，不过上面那个池子——所以池子那边的门
//   （集市日才逛集市）原来对邻居不生效：同行者非集市日不去，邻居天天去。
//   这儿显式过同一道 inSeason，不许两套说法。
const NEIGHBOR_DAY=[[420,'home'],[540,'walk'],[780,'market'],[1020,'indoors'],[1200,'home']];
// 三个邻居别整齐划一地同时出门：按 charId 把时刻各错开一点
const shiftBy=id=>{let h=0;for(const ch of String(id||''))h=(h*31+ch.charCodeAt(0))>>>0;return (h%5)*18;};
export function dailySchedule(s){const season=seasonOf(s.day),who=s.companion,
 plan=who&&who.home?null:(s.seasonPlan?.season===season.index?s.seasonPlan.days.find(d=>d.day===season.day):null);
 const shift=who&&who.home?shiftBy(who.charId):0;
 const list0=plan?[[420,'home'],...plan.activities.map((a,i)=>[[480,840,1080][i],a.id,a.note]),[1260,'home']]
  :(who&&who.home?NEIGHBOR_DAY.map(([t,id])=>[t+shift,inSeason(id,s)?id:'walk']):floorDay(s));
 // 夜市那两晚（一季一回的节日）：一起排的那一季不知道这一天有夜市，天黑那一格改去逛夜市；邻居那两晚是摊主，游戏那头安排
 const list=plan&&festivalDay(s.day)?list0.map(([t,id,note])=>t===1080?[t,'festival','今晚是换季的灯会。']:[t,id,note])
  :plan&&nightMarketDay(s.day)?list0.map(([t,id,note])=>t===1080?[t,'fair','今晚村里有夜市。']:[t,id,note]):list0;
 return list.map(([start,id,note])=>{let adjusted=false;
 // 一起排这一季的时候模型不知道哪几条路还封着（normalizePlan 只认「这个世界里有没有这处地方」）。
 // 排到封着的那一处就换成屋前——不换的话他会走到封口前面站一整天，界面上只有一句
 // 「在原地等一条合适的小路」，看着就是坏了。
 if(!reachable(id,s)){id='home';note='那条路还没打开，今天先待在屋前。';}
 if(['细雨','细雪'].includes(weather(s.day,s.epoch))&&!MAPS[activity[id].map].interior&&!DRY_IN_RAIN.has(id)){id='rain';adjusted=true;}return {start,id,...activity[id],note:adjusted?'雨雪天改在屋檐下活动。':note||''};})
 // ⚠️下雨天露天那几格全被挪到檐下，连着三行「在屋檐下听雨」看着像坏了。
 //   挨着的重复格并成一格：读的人只问「这会儿该在哪儿」，早的那一格本来就管到下一格。
 .filter((item,i,all)=>i===0||all[i-1].id!==item.id);}
// 修好的地方改了他这一格去哪儿（旧塔补好了，雨天就去塔檐下，不再是自家屋檐）。
// ⚠️和 homeFor 一个道理，必须写在 plannedActivity 这一处：tick 在 mode==='routine'
//   时【绕开 companionPlan 直接用 plannedActivity】，写在 companionPlan 里，
//   他最常见的那个模式一次都读不到——这一课这一季已经栽过两次了。
const worksFor=(s,plan)=>{const spot=workSpot(s,plan.id);return spot?{...plan,...spot}:plan;};
// 一起转星仪的时候，他去另一头（她在楼下转，他就上台上看；反过来也一样）。
// ⚠️和 homeFor／worksFor 同一个道理，必须写在 plannedActivity 这一处：
//   tick 在 mode==='routine' 时【绕开 companionPlan 直接用 plannedActivity】——
//   写在 companionPlan 里，他最常见的那个模式一次都读不到。这一课这一季栽过三次了。
function starFor(s){
 if(!starLive(s))return null;
 const key=starOther(restoreStar(s.star).role),site=MAPS.oldTower.sites[STAR_SPOTS[key]];
 if(!site)return null;
 return {id:'star:'+key,map:'oldTower',target:{...site.target},
  label:key==='watch'?'在台上替你看光':'在楼下替你转铜环',gesture:'read'};
}
// 一格时间＝一小片地方，不是一个点（她 2026-09-18：「圈出一个活动范围」）。
// ⚠️和 homeFor／worksFor／starFor 同一个道理，必须写在 plannedActivity 这一处：
//   tick 在 mode==='routine' 时【绕开 companionPlan 直接用 plannedActivity】。
//   这一课这一季栽过四次了，这是第五处要挂在这儿的东西。
// ⚠️这一带只有一处可待（室外大半都是）就原样返回：不许为了热闹编一个动作出来。
const AREA_STOPS=3;
// 站在那一件旁边，那句话怎么说。⚠️认不出来的一律「待着」——不许为了好看编一个动作。
const AREA_VERB={rest:'待着',sit:'坐着',read:'翻着东西',gather:'翻找',water:'浇水',stir:'忙着'};
// ⚠️id 一个字都不许改：tick 里有 plan.id==='flowers'／'museum'、
//   ['workshop','workshop-aside'].includes(plan.id) 这几处判断——改了 id 就是
//   「他到了水磨工坊却再也不帮忙照看材料了」这种悄悄没掉的东西（最坏的一种）。
//   「换了地方」挂在 spot 上，下面路线键那边显式带上它。
function areaFor(s,plan,start,end){
 const spots=areaSpots(plan.map,plan.target,plan.reach);
 if(spots.length<2)return plan;
 const who=s.companion?.charId||s.partnerId||'';
 // ⚠️这一格【本来那个点】必须留着，而且排第一：有几件活儿是钉死在那个点上的——
 //   companionMillHelp 要他站进长工作台 1.25 米内才算帮上忙，companionCare 也一样。
 //   只按范围抽的话，他哪天没抽到那儿，那件活儿就今天没做，而且不报任何错。
 //   这正是「他从此再也不浇花了」那一种悄悄没掉的东西（最坏的一种）。
 const home={key:'plan:'+plan.id,label:'',target:{...plan.target},gesture:plan.gesture};
 const rest=spots.filter(q=>Math.hypot(q.target.x-plan.target.x,q.target.z-plan.target.z)>1.2);
 const picks=[home,...areaPick(s,who,rest,String(s.epoch)+':area:'+s.day+':'+start+':'+plan.id,AREA_STOPS-1)];
 // 这一格从 start 到 end，均分给挑中的那几处；停在哪一处只看【现在几点】，
 // 所以同一天同一时刻进来几次都一样（重开不瞬移，也不用在存档里记状态）。
 const span=Math.max(1,end-start),at=picks[Math.min(picks.length-1,
  Math.floor((Math.max(start,Math.min(end-1,s.minute))-start)/span*picks.length))];
 return at.label?{...plan,spot:at.key,target:{...at.target},gesture:at.gesture,
  label:'在'+at.label+'那儿'+(AREA_VERB[at.gesture]||'待着')}:plan;
}
export function plannedActivity(s){const star=starFor(s);if(star)return star;
 const list=dailySchedule(s);
 const i=list.findLastIndex(item=>s.minute>=item.start),at=i<0?0:i;
 const start=list[at].start,end=at+1<list.length?list[at+1].start:1440;
 return homeFor(s,areaFor(s,worksFor(s,list[at]),start,end));}
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
// 他带路（她 2026-09-18）：先走到该去的地方站着等她。⚠️跟「来找你」一样走 wants 那条路，
//   四种模式都认；递东西那一站没有地方，他就走到她身边。
function guideIntent(s){
 if(MAPS.home.beds[s.sleep?.companion])return null;
 const step=guideStep(s);if(!step)return null;
 const at=guideTarget(s,step);
 // 站在那一处旁边，别站在她要用的点上（她走过去要站的就是那个点）
 const beside=at?[[.8,.45],[-.8,.45],[.8,-.45],[0,.9],[-.8,-.45]].map(([dx,dz])=>({x:at.target.x+dx,z:at.target.z+dz})).find(p=>walkable(p.x,p.z,at.map,s))||at.target:null;
 return {id:'guide:'+step.id,map:at?at.map:s.map,label:'在这儿等你，带你看看',gesture:'rest',fixed:beside};
}
export function guidePlan(s){const intent=guideIntent(s);if(!intent)return null;const {fixed,...rest}=intent;return {...rest,target:fixed||followPoint(s)};}
export function companionPlan(s){const b=MAPS.home.beds[s.sleep?.companion];if(b)return {id:'sleep:'+s.sleep.companion,map:'home',target:b.approach.companion,label:'在'+b.label+'休息',gesture:'sleep',heading:0};const miss=missPlan(s);if(miss)return miss;const guide=guidePlan(s);if(guide)return guide;const c=s.companion;const seat=seatsOf(s.map)[s.seat];if(c.mode==='follow'&&seat)return {id:'sit-together',map:s.map,target:seat.companion,label:seat.label||'在池边陪你坐着',gesture:'sit',heading:seat.heading};if(c.mode==='wait')return {id:'wait',map:c.map,target:{...c.position},label:'留在这里等你',gesture:'rest'};if(c.mode==='goto')return {id:'goto:'+c.destination,gesture:'rest',...(destinationOf(s,c.destination)||COMPANION_DESTINATIONS.home)};if(c.mode==='follow')return {id:'follow',map:s.map,target:followPoint(s),label:c.map===s.map?'和你一起走':'正沿着小路来找你',gesture:'rest'};const plan=plannedActivity(s);if(plan.map===s.map&&Math.hypot(plan.target.x-s.position.x,plan.target.z-s.position.z)<.65){return {...plan,id:plan.id+'-aside',target:followPoint(s),label:'在一旁陪你',gesture:'rest'};}return plan;}
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
  const c=s.companion,sleeping=!!MAPS.home.beds[s.sleep?.companion],wants=autonomous?null:(missIntent(s)||guideIntent(s)),routine=wants?{...wants,target:s.position}:(sleeping?companionPlan(s):c.mode==='follow'?null:c.mode==='routine'?plannedActivity(s):companionPlan(s)),needsNear=!sleeping&&(!!wants||c.mode==='follow'||routine.map===s.map&&Math.hypot(routine.target.x-s.position.x,routine.target.z-s.position.z)<.65);
  const choiceKey=wants?'miss:'+s.day:c.mode==='follow'?'follow:'+String(s.seat):`${s.day}:${routine.id}:${routine.spot||''}:${routine.start}`;let plan;
  if(needsNear){if(!cachedFollow||cachedFollow.key!==choiceKey||cachedFollow.map!==s.map||cachedFollow.fromMap!==c.map||Math.hypot(s.position.x-cachedFollow.anchor.x,s.position.z-cachedFollow.anchor.z)>.25||stuck&&cooldown<=0)cachedFollow={key:choiceKey,plan:c.mode==='goto'?{...routine,target:followPoint(s)}:companionPlan(s),map:s.map,fromMap:c.map,anchor:{...s.position}};plan=cachedFollow.plan;}else{cachedFollow=null;plan=routine;}
  const cross=c.map!==plan.map,exit=cross?exitToward(c.map,plan.map):null;if(cross&&!exit){moving=false;status='这里还没有通往那里的小路';return {state:s,event:null};}const goal=cross?exit.target:plan.target,avoid=c.map===s.map?[{...s.position,r:PERSONAL_SPACE}]:[];
  const key=`${s.day}:${c.mode}:${plan.id}:${plan.spot||''}:${plan.map}:${goal.x.toFixed(1)}:${goal.z.toFixed(1)}`;
  if((key!==routeKey||stuck&&cooldown<=0)&&(c.mode!=='follow'||!route.length||cross||cooldown<=0)){cooldown=.65;routeKey=key;route=[];idle=0;stuck=false;const distance=Math.hypot(c.position.x-goal.x,c.position.z-goal.z);if(distance>.12){route=findPath(c.position,goal,c.map,avoid,s)||[];stuck=!route.length;}}
  let out=s,event=null;moving=route.length>0;gesture='rest';
  if(moving){const step=stepRoute(c.position,route,dt,{speed,skating:onLakeIce(c.map,c.position,s),walkSpeed:Math.min(COMPANION_TOP,walkSpeedFor(c.map)*.79),iceSpeed:3.05,clear:(a,b)=>segmentClear(a,b,c.map,avoid,s)});speed=step.speed;if(step.heading!==null)heading=step.heading;if(step.blocked){routeKey='';cooldown=0;cachedFollow=null;}out={...s,companion:{...c,position:step.position}};status=cross?`正在走向${MAPS[plan.map].name}`:`正去${plan.label}`;}
  else if(stuck){status='在原地等一条合适的小路';}
  else if(cross){out={...s,companion:{...c,map:exit.to,position:{...(exit.at||MAPS[exit.to].spawn)}}};routeKey='';status=`刚到${MAPS[plan.map].name}`;}
  else{idle+=dt;gesture=plan.gesture;if(Number.isFinite(plan.heading))heading=plan.heading;status=plan.label;if(plan.id==='follow'){status='在你身边';gesture='rest';}if(plan.id==='miss'){status='像是有话要说';gesture='rest';}if(plan.id.startsWith('guide:')){status='在这儿等你';gesture='rest';}if(plan.id==='flowers'){heading=Math.PI;if(c.helpDay===s.day){status='在花圃旁看看新芽';gesture='rest';}}
   if(allowCare&&!autonomous&&plan.id==='flowers'&&idle>=2.8&&finishedKey!==key){out=companionCare(s);finishedKey=key;if(out!==s)event=`${c.name}用自带的晨露照料了一朵月光花。`;}
   // 并肩坐下来了：相处册记一笔（同一天只记一次，坐一下午不是坐了四十次）
   if(!autonomous&&plan.id==='sit-together'&&idle>=2.8&&finishedKey!==key){finishedKey=key;out=noteBond(s,'sit','和你并肩'+(plan.label||'坐了一会儿'));}
   if(!autonomous&&['workshop','workshop-aside'].includes(plan.id)&&idle>=2.8&&finishedKey!==key){out=companionMillHelp(s);if(out!==s){finishedKey=key;event=c.name+'帮忙照看了工坊里的材料。';}}
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
