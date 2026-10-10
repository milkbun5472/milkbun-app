import {autonomousWork} from './work-autonomy.mjs?v=fg-6e803a8b66fac295';
import {collectJournal} from './weekly-journal.mjs?v=fg-6e803a8b66fac295';
import {cancelOfflineTogether} from './together.mjs?v=fg-6e803a8b66fac295';
import {cancelOfflineSkill} from './skills.mjs?v=fg-6e803a8b66fac295';
import {createHousehold} from './home-chores.mjs?v=fg-6e803a8b66fac295';
import {homeUse} from './home-condition.mjs?v=fg-6e803a8b66fac295';
import {choosePetRest} from './habits.mjs?v=fg-6e803a8b66fac295';
import {RESIDENT_ACTS,residentGoalClear,residentStepClear,planResidentAct,rememberResidentAct} from './resident-choice.mjs?v=fg-6e803a8b66fac295';
import {localRoute,nextRandom} from './autonomy.mjs?v=fg-6e803a8b66fac295';
import {townEnvironment} from './environment.mjs?v=fg-6e803a8b66fac295';
import {workRoom,petWorkplace} from './workplaces.mjs?v=fg-6e803a8b66fac295';
import {realTime,dailyRoutine,workWindow} from '../fairy-garden/real-clock.mjs?v=fg-6e803a8b66fac295';
import {createPetCare} from './care.mjs?v=fg-6e803a8b66fac295';
import {petWorkStation} from './work-station.mjs?v=fg-6e803a8b66fac295';
import {furniturePoint} from './furnishings.mjs?v=fg-6e803a8b66fac295';
import {createPetCareer} from './career.mjs?v=fg-6e803a8b66fac295';
import {createTownLife,createTownNavigation} from './town-life.mjs?v=fg-6e803a8b66fac295';
import {walkRoute} from './movement.mjs?v=fg-6e803a8b66fac295';
import {HOME_PLACES,PET_STATIONS,petHomePlaces} from './home-navigation.mjs?v=fg-6e803a8b66fac295';
const meals=['breakfast','lunch','dinner'];
const offlineThreshold=entry=>autonomousWork(entry.career?.job)?1000:60000;
const clamp=n=>Math.max(0,Math.min(100,n));
export function lifeOf(owner){return owner.life||(owner.life={at:0,marks:{},notes:[],wakeUntil:0});}
export function lifeNote(owner,time,text,key){const life=lifeOf(owner);if(life.marks.date!==time.date)life.marks={date:time.date};if(life.marks[key])return false;life.marks[key]=true;life.notes.push({at:time.at,text});life.notes=life.notes.slice(-12);return true;}
export function petRoutine(entry,time,career){
 const plan=dailyRoutine(time,entry.care.rng),life=lifeOf(entry),job=career.state.job;
 const returning=!job&&entry.town.place!=='home'&&(career.state.parcels.queue.some(b=>b.source!=='shopping'&&b.phase==='carrying')||career.state.daily.closed&&entry.care.energy<25);
 const scheduled=!petWorkplace(career.state.selected).temporary&&career.state.schedule.shift!=='none'&&workWindow(time,career.state.schedule).open;
 return {...plan,returning,home:(plan.home||returning)&&job?.phase!=='working'&&!(plan.id==='sleep'&&life.wakeUntil>time.at),work:scheduled&&!career.state.daily.closed&&!career.state.daily.rest,
  targetPoint:job?career.destinationPoint():null,target:job?(autonomousWork(job)&&job.phase!=='tired'||job.phase==='working'||workWindow(time,career.state.schedule).open&&!plan.home?career.destination():'home'):returning?'home':scheduled&&!career.state.daily.invited&&!career.state.daily.closed&&!career.state.daily.rest?workRoom(career.state.selected):plan.home&&life.wakeUntil<=time.at?'home':null};
}
export function startScheduledWork(entry,time,career,care){
 const life=lifeOf(entry),s=career.state;if(!petRoutine(entry,time,career).work||s.job||s.daily.invited||entry.town.place!==workRoom(s.selected))return null;
 if(life.marks.date!==time.date)life.marks={date:time.date};if(life.marks.workAttempt)return null;life.marks.workAttempt=true;
 const result=career.request('invite',{scheduled:true}, {care:care.state,room:entry.town.place,name:entry.profile.name});
 lifeNote(entry,time,entry.profile.name+(result.accepted?'到了'+career.summary().workplace.title+'，接下约好的一班。':'这次排班先歇歇：'+result.text),'work');return result;
}
// Offline routes use the same doors, collision map and footsteps as visible life.
function travelTo(town,target,budget,stop=null){const arrived=()=>town.state.place===target&&(!stop||Math.hypot(town.state.position.x-stop.x,town.state.position.z-stop.z)<.15);if(!target||arrived())return {arrived:true,seconds:0};town.go(target,stop);let seconds=0;for(;seconds<Math.min(600,budget)&&!arrived();){if(stop&&town.state.place===target&&!town.state.goal)town.go(target,stop);const dt=Math.min(.1,budget-seconds);town.tick(dt,{stayHome:true,position:town.state.position,heading:town.state.heading});seconds+=dt;}return {arrived:arrived(),seconds};}
function recoverWork(entry,town,career,care,budget,time){
 while(budget>0&&career.state.job){const job=career.state.job,automatic=autonomousWork(job);
  if(!automatic&&job.phase!=='working')break;
  if(job.phase!=='tired'){const trip=travelTo(town,career.destination(),budget,career.destinationPoint());budget-=trip.seconds;if(!trip.arrived)break;}
  const dt=Math.min(1,budget);if(dt<=0)break;
  const event=career.tick(dt,{care:care.state,room:entry.town.place,offline:true,position:entry.town.position,name:entry.profile.name});budget-=dt;
  if(event?.automatic&&event.action){lifeNote(entry,time,entry.profile.name+'自己上班：'+event.text,'work:'+job.id+':'+job.index+':'+job.choices.length+':'+(job.investigation?.conclusion||'')+':'+event.action);if(event.finished||event.stopped){travelTo(town,'home',budget);break;}}
  else if(event?.event&&!event.automatic){lifeNote(entry,time,entry.profile.name+(job.profession==='courier'?'配送时遇到一件小事，留着等你拿主意。':'在店里遇到一件小事，留着等你拿主意。'),'work-choice:'+job.id+':'+job.index);break;}
 }
}
function homeMove(entry,target){const nav=createTownNavigation('home',entry.profile?.size||1),from=entry.town.position;
 const route=nav.path(from,target);if(!route?.length&&Math.hypot(from.x-target.x,from.z-target.z)>.15)return false;
 let p=from,heading=entry.town.heading;for(let i=0;route?.length&&i<3000;i++){const r=walkRoute(route,p,heading,.1,.7,q=>nav.walkable(q.x,q.z));p=r.position;heading=r.heading;}
 if(route?.length)return false;entry.town.position={...p};entry.town.heading=heading;entry.care.position={...p};return true;
}
function recoverResidentPastime(state,time,seconds){const owner=state.resident,town=owner.town;if(state.household?.task||!owner.id||town?.place!=='home'||town.phase!=='idle'||owner.activity?.kind==='sleep'||owner.activity?.kind==='meal'||state.pets.some(p=>p.care.helper||p.care.task?.target==='companion:'+owner.id))return;
 const period=dailyRoutine(time,owner.rng);if(period.id==='sleep'||['breakfast','lunch','dinner'].includes(period.id))return;
 const nav=createTownNavigation('home',1.4),position={...town.position},peers=state.pets.filter(p=>p.town.place==='home').map(p=>({position:p.town.position,size:p.profile.size})),clear=q=>residentGoalClear(q,peers);
 if(!owner.activity){const plan=planResidentAct(owner,{nav,position,context:{minute:time.minute,kind:townEnvironment(time,state.epoch||state.clock.anchor).kind,pets:state.pets.some(p=>p.town.place==='home')},clear,randomRoute:random=>localRoute(nav,position,random,{radius:2.5,clear})},()=>nextRandom(owner));if(!plan)return;owner.activity=plan.activity;}
 const a=owner.activity;if(!RESIDENT_ACTS[a.kind])return;let budget=seconds,p={...position},heading=town.heading;
 if(a.phase==='walking'){const route=a.goal&&nav.walkable(a.goal.x,a.goal.z)?nav.path(p,a.goal):null;if(!route){owner.activity=null;return;}while(route.length&&budget>.1){const moved=walkRoute(route,p,heading,.1,.65,q=>nav.walkable(q.x,q.z));if(!residentStepClear(p,moved.position,peers)){town.position={...p};town.heading=heading;owner.position={...p};owner.heading=heading;owner.activity=null;return;}p=moved.position;heading=moved.heading;budget-=.1;}town.position={...p};town.heading=heading;owner.position={...p};owner.heading=heading;if(route.length)return;a.phase='doing';a.time=0;}
 a.time+=budget;if(a.time>=a.duration){rememberResidentAct(owner,a.kind,time.at);lifeNote(owner,time,'TA在家里'+RESIDENT_ACTS[a.kind].label.replace(/^在家里/,'')+'。','activity:'+a.kind);owner.activity=null;owner.idle=0;}
}
function recoverChores(state,at,elapsed,automatic=false){if(!state.household||elapsed<60)return;const r=state.resident,period=dailyRoutine(realTime(state.clock,at),r.rng),c=createHousehold(state.household,{getRows:()=>state.pets,getActor:actor=>({id:r.id,name:r.name||'TA',position:r.town?.position,heading:r.heading,preferences:r.choices?.preferences?.scores,available:actor==='companion'&&!!r.id&&r.town?.place==='home'&&!['sleep','breakfast','lunch','dinner'].includes(period.id)&&!state.pets.some(p=>p.care.helper||p.care.task?.target==='companion:'+r.id)}),now:()=>at});if(c.state.task?.actor==='you'){c.cancel('你不在时先放下了收拾，东西留在实际位置。');return;}if(automatic&&c.state.task)return;if(automatic){c.state.wait=Math.max(0,c.state.wait-Math.min(elapsed,120));c.auto();}if(!c.state.task)return;r.activity=null;for(let t=0;t<Math.min(elapsed,120)&&c.state.task;t+=.1){c.tick(.1);const job=c.state.task;if(job){r.position={...job.position};r.heading=job.heading;r.town.position={...job.position};r.town.heading=job.heading;}}}
export function recoverPetLife(state,world,at=Date.now()){
 cancelOfflineTogether(state,at);
 if(!state.clock)return state;
 const resident=state.resident,rl=lifeOf(resident),lead=state.pets.find(p=>p.life?.at&&at-p.life.at>=offlineThreshold(p)),choreElapsed=rl.at?Math.max(0,(at-rl.at)/1000):0;if(choreElapsed>=60&&resident.outing){resident.outing=null;if(resident.town){resident.town.goal=null;resident.town.stop=null;resident.town.phase=resident.town.place==='home'?'idle':'visit';resident.town.hold=0;}}if(lead&&state.neighborhood){state.neighborhood.meeting=null;const q=state.neighborhood.quest;if(q?.phase==='handoff'){q.phase='carrying';q.time=0;}if(state.neighborhood.event&&!state.neighborhood.event.done)state.neighborhood.event.time=0;}recoverChores(state,at,choreElapsed);
 for(const entry of state.pets){
  if(entry.life?.at&&at-entry.life.at>=60000)cancelOfflineSkill(entry.care);
  const life=lifeOf(entry),before=life.at,places=petHomePlaces(PET_STATIONS[state.pets.indexOf(entry)]);if(!before){life.at=at;continue;}if(at-before<offlineThreshold(entry))continue;
  let cursor=Math.max(before,at-3*86400000),time=realTime({...state.clock,day:state.clock.startDay},cursor);
  const care=createPetCare(entry.care,{real:true,now:()=>time.at});entry.care=care.state;const career=createPetCareer(entry.career,{getProfile:()=>entry.profile,calendar:()=>time,workStation:job=>petWorkStation(job,town.nav(workRoom(job?.profession)),entry.town.place===workRoom(job?.profession)?entry.town.position:null,{moving:!!entry.town.goal})});
  const town=createTownLife(entry.town,{world,size:()=>entry.profile.size});
  while(cursor<at){const end=Math.min(at,cursor+900000),seconds=(end-cursor)/1000;time=realTime({...state.clock,day:state.clock.startDay},end);career.syncDay(care.state,time);
   care.state.satiety=clamp(care.state.satiety-seconds*.0015);care.state.energy=clamp(care.state.energy-seconds*.0006);
   const plan=petRoutine(entry,time,career),busy=state.household?.task?.petId===entry.id||care.state.helper||care.state.task&&care.state.task.source!=='self'||care.state.task?.socialId;
   if(!busy){if(care.state.task?.night&&(plan.id!=='sleep'||!plan.home)){care.finishNightRest();care.cancel();lifeNote(entry,time,entry.profile.name+'醒来，开始今天的小日子。','wake');}const trip=travelTo(town,plan.target,seconds,plan.targetPoint);const workBudget=Math.max(0,seconds-trip.seconds);if(entry.town.place==='home'){
    if(resident.town&&resident.town.place!=='home'&&plan.home&&!resident.activity){const rt=createTownLife(resident.town,{world,size:()=>1.4});travelTo(rt,'home',seconds);}
    if(resident.id&&resident.town?.place==='home'&&care.state.satiety<65&&care.state.bowl<25){const fed=care.request('feed',{source:'companion',actor:resident.id,name:resident.name||'TA'});if(fed.accepted){care.cancel();lifeNote(entry,time,(resident.name||'TA')+'给'+entry.profile.name+'的饭碗添了粮。','refill:'+plan.id);}}
    if((meals.includes(plan.id)||care.state.satiety<60)&&care.state.bowl>0&&care.state.satiety<85){const point=places.feeding;if(homeMove(entry,point)){
     const food=Math.min(care.state.bowl,(90-care.state.satiety)/.65);care.state.bowl-=food;homeUse(care.state,'eat',food);care.state.satiety=clamp(care.state.satiety+food*.65);care.state.mood=clamp(care.state.mood+2);care.record('自己走到饭碗边吃了一些粮。');lifeNote(entry,time,entry.profile.name+'自己到饭碗边吃过了。','meal:'+plan.id);care.cancel();
    }}
    if(plan.id==='sleep'&&plan.home){const available=['bed','sofa',...(career.state.inventory.box===1?['box']:[]),...(career.state.furnishings.sleep?['own']:[])],previous=care.state.task?.night?care.state.task:null,rest=previous&&available.includes(previous.place)?previous.place:choosePetRest(care.state,available,()=>nextRandom(care.state));if(homeMove(entry,rest==='own'?furniturePoint(career.state,state.pets.indexOf(entry)):places[rest])){care.state.energy=clamp(care.state.energy+seconds*.006);care.state.task={kind:'sleep',phase:'doing',time:Math.min(45,(previous?.time||0)+seconds),place:rest,source:'self',night:true};lifeNote(entry,time,entry.profile.name+'在'+({bed:'自己的窝里',sofa:'沙发边',box:'自己的小纸箱里',own:'自己摆好的小窝里'}[rest])+'睡下了。','sleep');}}

   }
   startScheduledWork(entry,time,career,care);
   recoverWork(entry,town,career,care,workBudget,time);
   }
   if(entry===lead&&resident.id&&resident.town&&!state.pets.some(p=>p.care.helper)){
    const rp=dailyRoutine(time,resident.rng),awake=rp.id==='sleep'&&rl.wakeUntil>time.at;
    if(rp.home&&!awake){const rt=createTownLife(resident.town,{world,size:()=>1.4});travelTo(rt,'home',seconds);
     if(resident.town.place==='home'){if(meals.includes(rp.id)&&seconds>=8)lifeNote(resident,time,'TA在家里吃过'+({breakfast:'早餐',lunch:'午饭',dinner:'晚饭'})[rp.id]+'。',rp.id);if(rp.id==='sleep')lifeNote(resident,time,'TA回家休息了。','sleep');}
    }
   }
   if(entry===lead)recoverResidentPastime(state,time,seconds);
   collectJournal(state,time.at);
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
