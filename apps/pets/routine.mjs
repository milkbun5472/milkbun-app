import {cancelOfflineSkill} from './skills.mjs?v=fg-eda307386ddebe83';
import {createHousehold} from './home-chores.mjs?v=fg-eda307386ddebe83';
import {homeUse} from './home-condition.mjs?v=fg-eda307386ddebe83';
import {choosePetRest} from './habits.mjs?v=fg-eda307386ddebe83';
import {RESIDENT_ACTS,residentGoalClear,residentStepClear,planResidentAct,rememberResidentAct} from './resident-choice.mjs?v=fg-eda307386ddebe83';
import {localRoute,nextRandom} from './autonomy.mjs?v=fg-eda307386ddebe83';
import {weather} from '../fairy-garden/world.mjs?v=fg-eda307386ddebe83';
import {workRoom} from './workplaces.mjs?v=fg-eda307386ddebe83';
import {realTime,dailyRoutine,workWindow} from '../fairy-garden/real-clock.mjs?v=fg-eda307386ddebe83';
import {createPetCare} from './care.mjs?v=fg-eda307386ddebe83';
import {createPetCareer} from './career.mjs?v=fg-eda307386ddebe83';
import {createTownLife,createTownNavigation} from './town-life.mjs?v=fg-eda307386ddebe83';
import {walkRoute} from './movement.mjs?v=fg-eda307386ddebe83';
import {HOME_PLACES,PET_STATIONS,petHomePlaces} from './home-navigation.mjs?v=fg-eda307386ddebe83';
const meals=['breakfast','lunch','dinner'];
const clamp=n=>Math.max(0,Math.min(100,n));
export function lifeOf(owner){return owner.life||(owner.life={at:0,marks:{},notes:[],wakeUntil:0});}
export function lifeNote(owner,time,text,key){const life=lifeOf(owner);if(life.marks.date!==time.date)life.marks={date:time.date};if(life.marks[key])return false;life.marks[key]=true;life.notes.push({at:time.at,text});life.notes=life.notes.slice(-12);return true;}
export function petRoutine(entry,time,career){
 const plan=dailyRoutine(time,entry.care.rng),life=lifeOf(entry),job=career.state.job;
 const scheduled=career.state.schedule.shift!=='none'&&workWindow(time,career.state.schedule).open;
 return {...plan,home:plan.home&&job?.phase!=='working'&&!(plan.id==='sleep'&&life.wakeUntil>time.at),work:scheduled&&!career.state.daily.closed&&!career.state.daily.rest,
  targetPoint:job?career.destinationPoint():null,target:job?(job.phase==='working'||workWindow(time,career.state.schedule).open&&!plan.home?career.destination():'home'):scheduled&&!career.state.daily.invited&&!career.state.daily.closed&&!career.state.daily.rest?workRoom(career.state.selected):plan.home&&life.wakeUntil<=time.at?'home':null};
}
export function startScheduledWork(entry,time,career,care){
 const life=lifeOf(entry),s=career.state;if(!petRoutine(entry,time,career).work||s.job||s.daily.invited||entry.town.place!==workRoom(s.selected))return null;
 if(life.marks.date!==time.date)life.marks={date:time.date};if(life.marks.workAttempt)return null;life.marks.workAttempt=true;
 const result=career.request('invite',{scheduled:true}, {care:care.state,room:entry.town.place,name:entry.profile.name});
 lifeNote(entry,time,entry.profile.name+(result.accepted?'到了'+career.summary().workplace.title+'，接下约好的一班。':'这次排班先歇歇：'+result.text),'work');return result;
}
// Offline routes use the same doors, collision map and footsteps as visible life.
function travelTo(town,target,budget,stop=null){const arrived=()=>town.state.place===target&&(!stop||Math.hypot(town.state.position.x-stop.x,town.state.position.z-stop.z)<.4);if(!target||arrived())return true;town.go(target,stop);for(let seconds=0;seconds<Math.min(600,budget)&&!arrived();seconds+=.1)town.tick(.1,{stayHome:true,position:town.state.position,heading:town.state.heading});return arrived();}
function homeMove(entry,target){const nav=createTownNavigation('home',entry.profile?.size||1),from=entry.town.position;
 const route=nav.path(from,target);if(!route?.length&&Math.hypot(from.x-target.x,from.z-target.z)>.15)return false;
 let p=from,heading=entry.town.heading;for(let i=0;route?.length&&i<3000;i++){const r=walkRoute(route,p,heading,.1,.7,q=>nav.walkable(q.x,q.z));p=r.position;heading=r.heading;}
 if(route?.length)return false;entry.town.position={...p};entry.town.heading=heading;entry.care.position={...p};return true;
}
function recoverResidentPastime(state,time,seconds){const owner=state.resident,town=owner.town;if(state.household?.task||!owner.id||town?.place!=='home'||town.phase!=='idle'||owner.activity?.kind==='sleep'||owner.activity?.kind==='meal'||state.pets.some(p=>p.care.helper||p.care.task?.target==='companion:'+owner.id))return;
 const period=dailyRoutine(time,owner.rng);if(period.id==='sleep'||['breakfast','lunch','dinner'].includes(period.id))return;
 const nav=createTownNavigation('home',1.4),position={...town.position},peers=state.pets.filter(p=>p.town.place==='home').map(p=>({position:p.town.position,size:p.profile.size})),clear=q=>residentGoalClear(q,peers);
 if(!owner.activity){const plan=planResidentAct(owner,{nav,position,context:{minute:time.minute,kind:weather(time.day,state.epoch||state.clock.anchor),pets:state.pets.some(p=>p.town.place==='home')},clear,randomRoute:random=>localRoute(nav,position,random,{radius:2.5,clear})},()=>nextRandom(owner));if(!plan)return;owner.activity=plan.activity;}
 const a=owner.activity;if(!RESIDENT_ACTS[a.kind])return;let budget=seconds,p={...position},heading=town.heading;
 if(a.phase==='walking'){const route=a.goal&&nav.walkable(a.goal.x,a.goal.z)?nav.path(p,a.goal):null;if(!route){owner.activity=null;return;}while(route.length&&budget>.1){const moved=walkRoute(route,p,heading,.1,.65,q=>nav.walkable(q.x,q.z));if(!residentStepClear(p,moved.position,peers)){town.position={...p};town.heading=heading;owner.position={...p};owner.heading=heading;owner.activity=null;return;}p=moved.position;heading=moved.heading;budget-=.1;}town.position={...p};town.heading=heading;owner.position={...p};owner.heading=heading;if(route.length)return;a.phase='doing';a.time=0;}
 a.time+=budget;if(a.time>=a.duration){rememberResidentAct(owner,a.kind,time.at);lifeNote(owner,time,'TA在家里'+RESIDENT_ACTS[a.kind].label+'。','activity:'+a.kind);owner.activity=null;owner.idle=0;}
}
function recoverChores(state,at,elapsed,automatic=false){if(!state.household||elapsed<60)return;const r=state.resident,period=dailyRoutine(realTime(state.clock,at),r.rng),c=createHousehold(state.household,{getRows:()=>state.pets,getActor:actor=>({id:r.id,name:r.name||'TA',position:r.town?.position,heading:r.heading,preferences:r.choices?.preferences?.scores,available:actor==='companion'&&!!r.id&&r.town?.place==='home'&&!['sleep','breakfast','lunch','dinner'].includes(period.id)&&!state.pets.some(p=>p.care.helper||p.care.task?.target==='companion:'+r.id)}),now:()=>at});if(c.state.task?.actor==='you'){c.cancel('你不在时先放下了收拾，东西留在实际位置。');return;}if(automatic&&c.state.task)return;if(automatic){c.state.wait=Math.max(0,c.state.wait-Math.min(elapsed,120));c.auto();}if(!c.state.task)return;r.activity=null;for(let t=0;t<Math.min(elapsed,120)&&c.state.task;t+=.1){c.tick(.1);const job=c.state.task;if(job){r.position={...job.position};r.heading=job.heading;r.town.position={...job.position};r.town.heading=job.heading;}}}
export function recoverPetLife(state,world,at=Date.now()){
 if(!state.clock)return state;
 const resident=state.resident,rl=lifeOf(resident),lead=state.pets.find(p=>p.life?.at&&at-p.life.at>=60000),choreElapsed=rl.at?Math.max(0,(at-rl.at)/1000):0;if(choreElapsed>=60&&resident.outing){resident.outing=null;if(resident.town){resident.town.goal=null;resident.town.stop=null;resident.town.phase=resident.town.place==='home'?'idle':'visit';resident.town.hold=0;}}if(lead&&state.neighborhood){state.neighborhood.meeting=null;const q=state.neighborhood.quest;if(q?.phase==='handoff'){q.phase='carrying';q.time=0;}if(state.neighborhood.event&&!state.neighborhood.event.done)state.neighborhood.event.time=0;}recoverChores(state,at,choreElapsed);
 for(const entry of state.pets){
  if(entry.life?.at&&at-entry.life.at>=60000)cancelOfflineSkill(entry.care);
  const life=lifeOf(entry),before=life.at,places=petHomePlaces(PET_STATIONS[state.pets.indexOf(entry)]);if(!before){life.at=at;continue;}if(at-before<60000)continue;
  let cursor=Math.max(before,at-3*86400000),time=realTime({...state.clock,day:state.clock.startDay},cursor);
  const care=createPetCare(entry.care,{real:true});entry.care=care.state;const career=createPetCareer(entry.career,{calendar:()=>time});
  const town=createTownLife(entry.town,{world,size:()=>entry.profile.size});
  while(cursor<at){const end=Math.min(at,cursor+900000),seconds=(end-cursor)/1000;time=realTime({...state.clock,day:state.clock.startDay},end);career.syncDay(care.state,time);
   care.state.satiety=clamp(care.state.satiety-seconds*.0015);care.state.energy=clamp(care.state.energy-seconds*.0006);
   const plan=petRoutine(entry,time,career),busy=state.household?.task?.petId===entry.id||care.state.helper||care.state.task&&care.state.task.source!=='self'||care.state.task?.socialId;
   if(!busy){travelTo(town,plan.target,seconds,plan.target==='outside'?plan.targetPoint:null);if(entry.town.place==='home'){
    if(care.state.task?.night&&(plan.id!=='sleep'||!plan.home)){care.finishNightRest();care.cancel();lifeNote(entry,time,entry.profile.name+'醒来，开始今天的小日子。','wake');}
    if(resident.town&&resident.town.place!=='home'&&plan.home&&!resident.activity){const rt=createTownLife(resident.town,{world,size:()=>1.4});travelTo(rt,'home',seconds);}
    if(resident.id&&resident.town?.place==='home'&&care.state.satiety<65&&care.state.bowl<25){const fed=care.request('feed',{source:'companion',actor:resident.id,name:resident.name||'TA'});if(fed.accepted){care.cancel();lifeNote(entry,time,(resident.name||'TA')+'给'+entry.profile.name+'的饭碗添了粮。','refill:'+plan.id);}}
    if((meals.includes(plan.id)||care.state.satiety<60)&&care.state.bowl>0&&care.state.satiety<85){const point=places.feeding;if(homeMove(entry,point)){
     const food=Math.min(care.state.bowl,(90-care.state.satiety)/.65);care.state.bowl-=food;homeUse(care.state,'eat',food);care.state.satiety=clamp(care.state.satiety+food*.65);care.state.mood=clamp(care.state.mood+2);care.record('自己走到饭碗边吃了一些粮。');lifeNote(entry,time,entry.profile.name+'自己到饭碗边吃过了。','meal:'+plan.id);care.cancel();
    }}
    if(plan.id==='sleep'&&plan.home){const available=['bed','sofa',...(career.state.inventory.box===1?['box']:[])],previous=care.state.task?.night?care.state.task:null,rest=previous&&available.includes(previous.place)?previous.place:choosePetRest(care.state,available,()=>nextRandom(care.state));if(homeMove(entry,places[rest])){care.state.energy=clamp(care.state.energy+seconds*.006);care.state.task={kind:'sleep',phase:'doing',time:Math.min(45,(previous?.time||0)+seconds),place:rest,source:'self',night:true};lifeNote(entry,time,entry.profile.name+'在'+({bed:'自己的窝里',sofa:'沙发边',box:'自己的小纸箱里'}[rest])+'睡下了。','sleep');}}

   }
   startScheduledWork(entry,time,career,care);
   if(career.state.job?.phase==='working'&&career.atDestination({room:entry.town.place,position:entry.town.position})){for(let i=0;i<Math.min(seconds,18);i++){const event=career.tick(1,{care:care.state,room:entry.town.place,offline:true,position:entry.town.position});if(event){lifeNote(entry,time,entry.profile.name+(career.state.job.profession==='courier'?'配送时遇到一件小事，留着等你拿主意。':'在店里遇到一件小事，留着等你拿主意。'),'work-choice:'+career.state.job.id+':'+career.state.job.index);break;}}}
   }
   if(entry===lead&&resident.id&&resident.town&&!state.pets.some(p=>p.care.helper)){
    const rp=dailyRoutine(time,resident.rng),awake=rp.id==='sleep'&&rl.wakeUntil>time.at;
    if(rp.home&&!awake){const rt=createTownLife(resident.town,{world,size:()=>1.4});travelTo(rt,'home',seconds);
     if(resident.town.place==='home'){if(meals.includes(rp.id)&&seconds>=8)lifeNote(resident,time,'TA在家里吃过'+({breakfast:'早餐',lunch:'午饭',dinner:'晚饭'})[rp.id]+'。',rp.id);if(rp.id==='sleep')lifeNote(resident,time,'TA回家休息了。','sleep');}
    }
   }
   if(entry===lead)recoverResidentPastime(state,time,seconds);
   cursor=end;
  }
  entry.care=care.snapshot();entry.career=career.snapshot();life.at=at;
 }
 // The resident's ordinary meals and sleep stay local; no shopping/model calls.
 const time=realTime(state.clock,at),plan=dailyRoutine(time,resident.rng);
 if(rl.at&&at-rl.at>=60000&&resident.id&&resident.town?.place==='home'&&!state.pets.some(p=>p.care.helper)){
  if(plan.id==='sleep'&&!(rl.wakeUntil>at))resident.activity={kind:'sleep',phase:'doing',goal:{x:-.65,z:.55},time:0,duration:86400};
  else if(resident.activity?.kind==='sleep')resident.activity=null;

 }
 recoverChores(state,at,choreElapsed,true);rl.at=Math.max(rl.at||0,at);return state;
}
