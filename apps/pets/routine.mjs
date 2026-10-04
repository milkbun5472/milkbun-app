import {realTime,dailyRoutine,workWindow} from '../fairy-garden/real-clock.mjs?v=fg-c5ca36428fa98b69';
import {createPetCare} from './care.mjs?v=fg-c5ca36428fa98b69';
import {createPetCareer} from './career.mjs?v=fg-c5ca36428fa98b69';
import {createTownLife,createTownNavigation} from './town-life.mjs?v=fg-c5ca36428fa98b69';
import {walkRoute} from './movement.mjs?v=fg-c5ca36428fa98b69';
import {HOME_PLACES,PET_STATIONS,petHomePlaces} from './home-navigation.mjs?v=fg-c5ca36428fa98b69';
const meals=['breakfast','lunch','dinner'];
const clamp=n=>Math.max(0,Math.min(100,n));
export function lifeOf(owner){return owner.life||(owner.life={at:0,marks:{},notes:[],wakeUntil:0});}
export function lifeNote(owner,time,text,key){const life=lifeOf(owner);if(life.marks.date!==time.date)life.marks={date:time.date};if(life.marks[key])return false;life.marks[key]=true;life.notes.push({at:time.at,text});life.notes=life.notes.slice(-12);return true;}
export function petRoutine(entry,time,career){
 const plan=dailyRoutine(time,entry.care.rng),life=lifeOf(entry),job=career.state.job;
 const scheduled=career.state.schedule.shift!=='none'&&workWindow(time,career.state.schedule).open;
 return {...plan,home:plan.home&&job?.phase!=='working'&&!(plan.id==='sleep'&&life.wakeUntil>time.at),work:scheduled&&!career.state.daily.closed&&!career.state.daily.rest,
  target:job?(job.phase==='working'||workWindow(time,career.state.schedule).open&&!plan.home?job.profession:'home'):scheduled&&!career.state.daily.invited&&!career.state.daily.closed&&!career.state.daily.rest?career.state.selected:plan.home&&life.wakeUntil<=time.at?'home':null};
}
export function startScheduledWork(entry,time,career,care){
 const life=lifeOf(entry),s=career.state;if(!petRoutine(entry,time,career).work||s.job||s.daily.invited||entry.town.place!==s.selected)return null;
 if(life.marks.date!==time.date)life.marks={date:time.date};if(life.marks.workAttempt)return null;life.marks.workAttempt=true;
 const result=career.request('invite',{}, {care:care.state,room:entry.town.place,name:entry.profile.name});
 lifeNote(entry,time,entry.profile.name+(result.accepted?'到了'+career.summary().workplace.title+'，接下约好的一班。':'这次排班先歇歇：'+result.text),'work');return result;
}
// Offline routes use the same doors, collision map and footsteps as visible life.
function travelTo(town,target,budget){if(!target||town.state.place===target)return true;town.go(target);for(let seconds=0;seconds<Math.min(600,budget)&&town.state.place!==target;seconds+=.1)town.tick(.1,{stayHome:true,position:town.state.position,heading:town.state.heading});return town.state.place===target;}
function homeMove(entry,target){const nav=createTownNavigation('home',entry.profile?.size||1),from=entry.town.position;
 const route=nav.path(from,target);if(!route?.length&&Math.hypot(from.x-target.x,from.z-target.z)>.15)return false;
 let p=from,heading=entry.town.heading;for(let i=0;route?.length&&i<3000;i++){const r=walkRoute(route,p,heading,.1,.7,q=>nav.walkable(q.x,q.z));p=r.position;heading=r.heading;}
 if(route?.length)return false;entry.town.position={...p};entry.town.heading=heading;entry.care.position={...p};return true;
}
export function recoverPetLife(state,world,at=Date.now()){
 if(!state.clock)return state;
 const resident=state.resident,rl=lifeOf(resident);
 for(const entry of state.pets){
  const life=lifeOf(entry),before=life.at,places=petHomePlaces(PET_STATIONS[state.pets.indexOf(entry)]);if(!before||at<=before){life.at=at;continue;}if(at-before<60000)continue;
  let cursor=Math.max(before,at-3*86400000),time=realTime({...state.clock,day:state.clock.startDay},cursor);
  const care=createPetCare(entry.care,{real:true});entry.care=care.state;const career=createPetCareer(entry.career,{calendar:()=>time});
  const town=createTownLife(entry.town,{world,size:()=>entry.profile.size});
  while(cursor<at){const end=Math.min(at,cursor+900000),seconds=(end-cursor)/1000;time=realTime({...state.clock,day:state.clock.startDay},end);career.syncDay(care.state,time);
   care.state.satiety=clamp(care.state.satiety-seconds*.0015);care.state.energy=clamp(care.state.energy-seconds*.0006);
   const plan=petRoutine(entry,time,career),busy=care.state.helper||care.state.task&&care.state.task.source!=='self'||care.state.task?.socialId;
   if(!busy){travelTo(town,plan.target,seconds);if(entry.town.place==='home'){
    if(resident.town&&resident.town.place!=='home'&&plan.home&&!resident.activity){const rt=createTownLife(resident.town,{world,size:()=>1.4});travelTo(rt,'home',seconds);}
    if(resident.id&&resident.town?.place==='home'&&care.state.satiety<65&&care.state.bowl<25){const fed=care.request('feed',{source:'companion',actor:resident.id,name:'TA'});if(fed.accepted){care.cancel();lifeNote(entry,time,'TA给'+entry.profile.name+'的饭碗添了粮。','refill:'+plan.id);}}
    if((meals.includes(plan.id)||care.state.satiety<60)&&care.state.bowl>0&&care.state.satiety<85){const point=places.feeding;if(homeMove(entry,point)){
     const food=Math.min(care.state.bowl,(90-care.state.satiety)/.65);care.state.bowl-=food;care.state.satiety=clamp(care.state.satiety+food*.65);care.state.mood=clamp(care.state.mood+2);care.record('自己走到饭碗边吃了一些粮。');lifeNote(entry,time,entry.profile.name+'自己到饭碗边吃过了。','meal:'+plan.id);care.cancel();
    }}
    if(plan.id==='sleep'&&plan.home){if(homeMove(entry,places.bed)){care.state.energy=clamp(care.state.energy+seconds*.006);care.state.task={kind:'sleep',phase:'doing',time:0,place:'bed',source:'self',night:true};lifeNote(entry,time,entry.profile.name+'回到窝里睡下了。','sleep');}}
    else if(care.state.task?.night){care.cancel();lifeNote(entry,time,entry.profile.name+'醒来，开始今天的小日子。','wake');}
   }
   startScheduledWork(entry,time,career,care);
   if(career.state.job?.phase==='working'&&entry.town.place===career.state.job.profession){for(let i=0;i<Math.min(seconds,18);i++){const event=career.tick(1,{care:care.state,room:entry.town.place,offline:true});if(event){lifeNote(entry,time,entry.profile.name+'在店里遇到一件小事，留着等你拿主意。','work-choice:'+career.state.job.id+':'+career.state.job.index);break;}}}
   }
   if(entry===state.pets[0]&&resident.id&&resident.town&&!state.pets.some(p=>p.care.helper)){
    const rp=dailyRoutine(time,resident.rng),awake=rp.id==='sleep'&&rl.wakeUntil>time.at;
    if(rp.home&&!awake){const rt=createTownLife(resident.town,{world,size:()=>1.4});travelTo(rt,'home',seconds);
     if(resident.town.place==='home'){if(meals.includes(rp.id)&&seconds>=8)lifeNote(resident,time,'TA在家里吃过'+({breakfast:'早餐',lunch:'午饭',dinner:'晚饭'})[rp.id]+'。',rp.id);if(rp.id==='sleep')lifeNote(resident,time,'TA回家休息了。','sleep');}
    }
   }
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
 rl.at=at;return state;
}
