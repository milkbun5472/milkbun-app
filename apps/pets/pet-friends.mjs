import {localRoute,nextRandom} from './autonomy.mjs?v=fg-87e36a9d89c69f3f';
import {createTownNavigation} from './town-life.mjs?v=fg-87e36a9d89c69f3f';
import {createActorNavigation} from './actor-spacing.mjs?v=fg-87e36a9d89c69f3f';
import {walkRoute,turnPet} from './movement.mjs?v=fg-87e36a9d89c69f3f';

// Stable street identities and their actual places, shared by work and visits.
export const PET_NEIGHBORS=[{id:'florist-cat',name:'小茉',species:'cat',pet:true,role:'花店里的奶茶猫',shop:'florist',spot:{x:0,z:.65},detail:'喜欢慢慢闻花，也喜欢安静的陪伴。',place:'florist',placeName:'花店',about:'花店里的奶茶猫，喜欢慢慢闻花，也喜欢安静的陪伴。',position:{x:0,z:.65},approaches:[{x:1,z:.7},{x:-1,z:.7}],profile:{species:'cat',name:'小茉',size:.9,weight:1,look:{id:'custom',base:'#eee1cb',patch:'#a98565'}}},
 {id:'bakery-dog',name:'可可',species:'dog',pet:true,role:'面包店的热情小狗',shop:'bakery',spot:{x:0,z:.35},detail:'闻到刚出炉的香味会摇尾巴，更喜欢一起追球。',place:'bakery',placeName:'面包店',about:'热情又有点冒失，熟悉以后会把小球滚过来。',position:{x:0,z:.35},approaches:[{x:1,z:.35},{x:-1,z:.35}],profile:{species:'dog',name:'可可',size:.9,weight:1,look:{id:'custom',base:'#f4e7d0',patch:'#cba779'}}},
 {id:'cafe-cat',name:'墨墨',species:'cat',pet:true,role:'咖啡店的慢热黑白猫',shop:'cafe',spot:{x:0,z:.35},detail:'先远远看你一眼，熟悉以后愿意一起安静待着。',place:'cafe',placeName:'咖啡店',about:'慢热的黑白猫，喜欢安静地陪着朋友看店里的日常。',position:{x:0,z:.35},approaches:[{x:1,z:.35},{x:-1,z:.35}],profile:{species:'cat',name:'墨墨',size:.85,weight:1,look:{id:'custom',base:'#f4eee4',patch:'#5c5756'}}}];
const neighbor=id=>PET_NEIGHBORS.find(x=>x.id===id);
const count=v=>Number.isFinite(v)?Math.floor(Math.max(0,Math.min(1e7,v))):0;
const sharedMemory=()=>({gifts:0,homeVisits:0,homeDate:'',favors:0,visits:0,events:0,lastDate:'',knownName:'',habit:'',lastVisit:'',eventDate:''});
const at=v=>Number.isFinite(v)?Math.max(0,Math.min(1e15,v)):0;
export function restoreNeighborBonds(raw,legacy){
 const bonds={};
 for(const f of PET_NEIGHBORS){const r=raw?.[f.id];if(r&&typeof r==='object')bonds[f.id]={...sharedMemory(),gifts:count(r.gifts),homeVisits:count(r.homeVisits),homeDate:typeof r.homeDate==='string'?r.homeDate.slice(0,10):'',greetings:count(r.greetings),together:count(r.together),play:count(r.play),work:count(r.work),firstDay:count(r.firstDay),lastDay:count(r.lastDay),lastAt:at(r.lastAt),recent:(Array.isArray(r.recent)?r.recent:[]).filter(x=>['greet','together','play','work','visit','gift'].includes(x?.kind)&&typeof x.text==='string').slice(-8).map(x=>({kind:x.kind,day:count(x.day),at:at(x.at),text:x.text.slice(0,160)}))};}
 if(!Object.hasOwn(bonds,'florist-cat')&&Number.isFinite(legacy?.day)&&Number.isFinite(legacy?.visits)&&legacy.visits>0)bonds['florist-cat']={...sharedMemory(),greetings:0,together:0,play:0,work:count(legacy.visits),firstDay:count(legacy.day),lastDay:count(legacy.day),lastAt:0,recent:[]};
 return bonds;
}
export function neighborBondView(bonds,id){const r=bonds?.[id],visits=(r?.greetings||0)+(r?.work||0),familiarity=visits+(r?.gifts||0)*2+((r?.together||0)+(r?.play||0)+(r?.homeVisits||0))*2;return {gifts:r?.gifts||0,homeVisits:r?.homeVisits||0,homeDate:r?.homeDate||'',known:visits>0||r?.together>0,greetings:r?.greetings||0,work:r?.work||0,together:r?.together||0,play:r?.play||0,visits,firstDay:r?.firstDay||0,lastDay:r?.lastDay||0,lastAt:r?.lastAt||0,label:familiarity>=12?'见到彼此会自在地待在一起':familiarity>=5?'慢慢熟悉了彼此':familiarity?'已经认识了，见面还会闻闻对方':'还没打过招呼',recent:structuredClone(r?.recent||[])};}
export function recordNeighborBond(bonds,id,kind,{day,at:stamp=0,name='它'}={}){
 const f=neighbor(id);if(!f||!['greet','together','play','work','gift'].includes(kind))return null;
 const r=bonds[id]||(bonds[id]={...sharedMemory(),greetings:0,together:0,play:0,work:0,firstDay:count(day),lastDay:0,lastAt:0,recent:[]});
 r[kind==='gift'?'gifts':kind==='greet'?'greetings':kind==='work'?'work':kind==='play'?'play':'together']++;r.lastDay=count(day);if(stamp)r.lastAt=at(stamp);
 const text=kind==='gift'?name+'把自己的小礼物送给了'+f.name+'，朋友凑近闻了闻。':kind==='work'?name+'在'+f.placeName+'工作时，和'+f.name+'打过了招呼。':kind==='greet'?name+'走到'+f.name+'身边，互相闻了闻，打过了招呼。':kind==='play'?name+'和'+f.name+'在'+f.placeName+'一起追过了小球。'+(f.id==='bakery-dog'?'可可先把球轻轻滚给了它。':f.id==='cafe-cat'?'墨墨追了两步，又蹲下来看球。':'小茉闻过小球，才跟着跑起来。'):name+'和'+f.name+'在'+f.placeName+'安静地待了一会儿。'+(f.id==='cafe-cat'?'墨墨看了一会儿，慢慢放松下来。':f.id==='bakery-dog'?'可可趴在旁边，偶尔闻闻面包香。':'小茉陪它闻了闻新来的花。');
 r.recent.push({kind,day:count(day),at:at(stamp),text});r.recent=r.recent.slice(-8);return text;
}
export function syncFriendWork(shared,rows){for(const row of rows){const legacy=row.career?.state?.florist?.friend||row.career?.florist?.friend;if(!legacy?.visits)continue;const id=row.entry?.id||row.id,met=shared.neighbors['florist-cat'].met,m=met[id]||(met[id]=restoreNeighborBonds(null,legacy)['florist-cat']);m.work=Math.max(m.work||0,count(legacy.visits));m.knownName=row.entry?.profile.name||row.profile?.name||m.knownName||'';}}
const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{x:p.x,z:p.z}:null;
const NPC_NAV=createTownNavigation('florist',.9);
const otherRounds=[{ball:{x:.3,z:.5},pet:{x:1,z:.5},friend:{x:-.4,z:.5}},{ball:{x:.4,z:0},pet:{x:1.1,z:0},friend:{x:-.35,z:0}}];
const playRounds=id=>id==='florist-cat'?PLAY_ROUNDS:otherRounds;
const PLAY_ROUNDS=[{ball:{x:.3,z:1.1},pet:{x:1,z:1.15},friend:{x:-.4,z:1.1}},{ball:{x:-.5,z:1.35},pet:{x:.2,z:1.45},friend:{x:-1.2,z:1.35}}];
export function restorePetMeeting(raw,ids=[]){const t=raw?.pending,f=neighbor(t?.neighborId);return {seq:Math.max(count(raw?.seq),count(t?.id)),ball:point(raw?.ball)&&createTownNavigation(f?.place||'florist',f?.profile.size||.9).walkable(raw.ball.x,raw.ball.z)?point(raw.ball):{x:.45,z:.8},pending:f&&count(t.id)>0&&ids.includes(t.petId)&&['greet','together','play'].includes(t.kind)&&['walking','doing'].includes(t.phase)&&point(t.goal)?{id:count(t.id),petId:t.petId,neighborId:f.id,kind:t.kind,phase:t.phase,time:Math.min(8,at(t.time)),round:Math.min(1,count(t.round)),goal:point(t.goal),startedAt:at(t.startedAt)}:null};}
const free=row=>row&&PET_NEIGHBORS.some(f=>f.place===row.entry.town.place)&&!row.career.state.job&&!row.care.state.helper&&(!row.care.state.task||row.care.state.task.source==='self'&&['watch','wander'].includes(row.care.state.task.kind))&&row.care.state.energy>=35&&row.care.state.satiety>=25&&row.care.state.mood>=30;
export function createPetFriends(shared,{rows,getActors=()=>[],now=()=>Date.now(),save=()=>true,onRestore=()=>{}}={}){
 // Access the same neighborhood ledger dynamically: the parent transaction may
 // replace nested records after a failed write.
 const state={};for(const [key,field]of Object.entries({seq:'petMeetingSeq',ball:'friendBall',pending:'petMeeting'}))Object.defineProperty(state,key,{enumerable:true,get:()=>shared[field],set:v=>{shared[field]=v;}});
 Object.defineProperty(state,'resident',{enumerable:true,get:()=>shared.neighbors[state.pending?.neighborId||'florist-cat'].town,set:v=>{shared.neighbors[state.pending?.neighborId||'florist-cat'].town=v;}});
 const navs=new Map(PET_NEIGHBORS.map(f=>[f.id,createActorNavigation(createTownNavigation(f.place,f.profile.size),{actor:()=>({id:'neighbor:'+f.id,kind:'pet',species:f.species,size:f.profile.size,place:f.place}),actors:getActors})]));
 const nav={path:(...a)=>navs.get(state.pending?.neighborId||'florist-cat').path(...a),walk:(...a)=>navs.get(state.pending?.neighborId||'florist-cat').walk(...a),freePoint:(...a)=>navs.get(state.pending?.neighborId||'florist-cat').freePoint(...a),clearPoint:(...a)=>navs.get(state.pending?.neighborId||'florist-cat').clearPoint(...a)};
 const bonds=row=>Object.fromEntries(PET_NEIGHBORS.map(f=>[f.id,shared.neighbors[f.id].met[row.entry.id]]));
 function record(row,kind){const id=state.pending?.neighborId||'florist-cat',holder=bonds(row),message=recordNeighborBond(holder,id,kind,{day:row.career.state.day,at:now(),name:row.entry.profile.name});const m=holder[id];m.knownName=row.entry.profile.name;shared.neighbors[id].met[row.entry.id]=m;shared.recent.push({at:now(),text:message});shared.recent=shared.recent.slice(-12);return message;}
 const idleRoutes=new Map();let route=[],routeId=0,friendRoute=[],friendDestination=null,friendGoal='';
 const find=id=>rows().find(x=>x.entry.id===id);
 const before=()=>({state:structuredClone(shared),pets:rows().map(x=>({id:x.entry.id,care:x.care.snapshot(),career:x.career.snapshot(),town:structuredClone(x.entry.town)}))});
 function restore(backup){for(const k of Object.keys(shared))delete shared[k];Object.assign(shared,backup.state);for(const p of backup.pets){const r=find(p.id);if(!r)continue;Object.assign(r.care.state,p.care);r.career.restore(p.career);Object.assign(r.entry.town,p.town);}route=[];routeId=0;friendRoute=[];friendGoal='';idleRoutes.clear();onRestore();}
 function persist(backup,result){if(!save()){restore(backup);return {accepted:false,text:'这次相处还没有保存成功，请先重试保存。'};}return result;}
 function cancel(petId){if(!state.pending||petId&&state.pending.petId!==petId)return {accepted:false,text:'它这会儿没有在找街坊朋友。'};const backup=before(),row=find(state.pending.petId);if(row){row.pet.motion?.setActionPose({});row.town.hold();}state.pending=null;route=[];return persist(backup,{accepted:true,text:'这次先各自歇歇，已经相处过的小事会保留。'});}
 function request(kind,petId,id='florist-cat'){
  if(kind==='stop')return cancel(petId);
  const f=neighbor(id),row=find(petId);if(!f||!['greet','together','play'].includes(kind))return {accepted:false,text:'先看看想找哪位街坊。'};
  if(shared.quest||shared.event||shared.visit||shared.petVisit)return {accepted:false,text:'先陪完正在进行的街坊小约定。'};
  if(state.pending)return {accepted:false,text:'先让这次相处做完，再找朋友。'};
  if(!row||row.entry.town.place!==f.place||shared.neighbors[id].town.place!==f.place)return {accepted:false,text:'先实际走进'+f.placeName+'，再去'+f.name+'身边。'};
  if(!free(row))return {accepted:false,text:'它还在忙，或想先吃饱休息好，等空下来再认识朋友。'};
  const bond=neighborBondView(bonds(row),id);if(kind!=='greet'&&bond.visits<2)return {accepted:false,text:'它们还在认识彼此，先慢慢打两次招呼。'};
  if(bond.lastAt&&now()-bond.lastAt<20*60000)return {accepted:false,text:'刚刚已经陪过朋友了，先各自玩一会儿，晚一点再来。'};
  const nav=row.town.nav(),goal=f.approaches.find(q=>nav.path(row.entry.town.position,q)?.length);
  if(!goal)return {accepted:false,text:'这会儿没有能走过去的位置，晚一点再试。'};
  const backup=before();shared.neighbors[id].town.goal=null;shared.neighbors[id].town.idle=0;if(row.care.state.task)row.care.cancel();row.home?.resetPose();row.town.sync(f.place,row.entry.town.position,row.entry.town.heading,{manual:true});if(id!=='florist-cat')state.ball={...playRounds(id)[0].ball};state.pending={id:++state.seq,petId,neighborId:id,kind,phase:'walking',time:0,round:0,goal:{...goal},startedAt:now()};route=[];routeId=0;
  return persist(backup,{accepted:true,text:row.entry.profile.name+'准备走过去'+(kind==='greet'?'和'+f.name+'打个招呼。':kind==='play'?'和'+f.name+'一起追小球。':'陪'+f.name+'待一会儿。')});
 }
 function moveFriend(goal,dt){const key=(state.pending?.neighborId||'florist-cat')+JSON.stringify(goal),r=state.resident;if(friendGoal!==key||friendDestination&&!nav.clearPoint(friendDestination)){friendDestination=nav.freePoint(goal,r.position);friendRoute=friendDestination?nav.path(r.position,friendDestination)||[]:[];friendGoal=key;}if(!friendDestination)return {arrived:false,speed:0};const moved=nav.walk(friendRoute,r.position,r.heading,dt,.63);r.position=moved.position;r.heading=moved.heading;const arrived=Math.hypot(r.position.x-friendDestination.x,r.position.z-friendDestination.z)<.02;if(!friendRoute.length&&!arrived)friendGoal='';return {arrived,speed:moved.speed};}
 function tick(dt,{paused=false,offline=false}={}){
  if(paused||!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,.05);
  if(!state.pending){if(offline)return null;const speeds={};for(const f of PET_NEIGHBORS){const r=shared.neighbors[f.id].town;if(shared.streetVisit?.neighborId===f.id||shared.petVisit?.neighborId===f.id||r.place!==f.place)continue;const n=navs.get(f.id),anchor=f.position;r.idle+=dt;if(!r.goal&&r.idle>=18){const backup=before(),next=localRoute(n,r.position,()=>nextRandom(r),{radius:1.1,minDistance:.5,clear:q=>Math.hypot(q.x-anchor.x,q.z-anchor.z)<1.6});r.idle=0;if(next){r.goal=next.goal;r.phase='stroll';if(!persist(backup,{accepted:true,changed:true}).accepted)return {friendSpeed:0};}}if(r.goal){const key=JSON.stringify(r.goal);let cached=idleRoutes.get(f.id);if(cached?.key!==key){cached={key,path:n.path(r.position,r.goal)||[]};idleRoutes.set(f.id,cached);}const path=cached.path,m=n.walk(path,r.position,r.heading,dt,.63);r.position=m.position;r.heading=m.heading;speeds[f.id]=m.speed;if(Math.hypot(r.position.x-r.goal.x,r.position.z-r.goal.z)<.02){r.goal=null;r.phase='visit';r.idle=0;}}else speeds[f.id]=0;}return {friendSpeed:speeds['florist-cat'],friends:speeds};}
  const t=state.pending,row=find(t.petId),f=neighbor(t.neighborId);
  if(offline||now()-t.startedAt>10*60000||!row||!free(row)){const r=cancel();return {...r,changed:true,cancelled:true};}
  const p=row.entry.town;if(t.phase==='doing'&&t.kind!=='play'&&Math.hypot(p.position.x-t.goal.x,p.position.z-t.goal.z)>.15){cancel();return {changed:true,cancelled:true};}
  if(t.phase==='walking'){
   const friend=moveFriend(f.position,dt);
   if(routeId!==t.id){route=row.town.nav().path(p.position,t.goal)||[];routeId=t.id;if(!route.length){cancel();return {changed:true,cancelled:true};}}
   const moved=(row.town.nav().walk?row.town.nav().walk(route,p.position,p.heading,dt,.7*row.pet.root.scale.x):walkRoute(route,p.position,p.heading,dt,.7*row.pet.root.scale.x,q=>row.town.nav().walkable(q.x,q.z)));p.position=moved.position;p.heading=moved.heading;
   if(!route.length&&friend.arrived){const backup=before();t.phase='doing';t.time=0;routeId=0;const r=persist(backup,{accepted:true,changed:true});if(!r.accepted)return r;}
   return {neighborId:t.neighborId,owned:true,speed:moved.speed,kind:t.kind,phase:t.phase,time:t.time,friendSpeed:friend.speed};
  }
  let speed=0,friendSpeed=0,ball=null,playDone=false;
  if(t.kind==='play'){
   const q=playRounds(t.neighborId)[t.round],key=t.id+':'+t.round;
   if(routeId!==key){const dest=row.town.nav().freePoint?.(q.pet,p.position)||q.pet;t.goal={...dest};route=row.town.nav().path(p.position,dest)||[];routeId=key;if(!route.length&&Math.hypot(p.position.x-dest.x,p.position.z-dest.z)>.02){cancel();return {changed:true,cancelled:true};}}
   const moved=(row.town.nav().walk?row.town.nav().walk(route,p.position,p.heading,dt,.75*row.pet.root.scale.x):walkRoute(route,p.position,p.heading,dt,.75*row.pet.root.scale.x,q=>row.town.nav().walkable(q.x,q.z)));p.position=moved.position;p.heading=moved.heading;speed=moved.speed;
   const m=moveFriend(q.friend,dt);friendSpeed=m.speed;const d=Math.hypot(state.ball.x-q.ball.x,state.ball.z-q.ball.z),step=Math.min(d,dt*.9);if(d){state.ball.x+=(q.ball.x-state.ball.x)*step/d;state.ball.z+=(q.ball.z-state.ball.z)*step/d;}ball={...state.ball};
   if(!route.length&&m.arrived&&Math.hypot(state.ball.x-q.ball.x,state.ball.z-q.ball.z)<.02){t.time+=dt;if(t.time>=1.5){if(t.round===0){const backup=before();t.round=1;t.time=0;routeId=0;const r=persist(backup,{accepted:true,changed:true});if(!r.accepted)return r;}else {t.time=8;playDone=true;}}}
  }else {if(t.kind==='together'){const dx=t.goal.x-f.position.x,dz=t.goal.z-f.position.z,d=Math.hypot(dx,dz)||1,m=moveFriend({x:f.position.x+dx/d*.08,z:f.position.z+dz/d*.08},dt);friendSpeed=m.speed;if(!m.arrived)return {neighborId:t.neighborId,owned:true,speed:0,friendSpeed,kind:t.kind,phase:t.phase,time:t.time};}p.heading=turnPet(p.heading,Math.atan2(state.resident.position.x-p.position.x,state.resident.position.z-p.position.z),dt).heading;state.resident.heading=turnPet(state.resident.heading,Math.atan2(p.position.x-state.resident.position.x,p.position.z-state.resident.position.z),dt).heading;t.time+=dt;}
  if(t.kind==='play'&&!playDone||t.time<(t.kind==='greet'?4:8))return {neighborId:t.neighborId,owned:true,speed,friendSpeed,ball,kind:t.kind,phase:t.phase,time:t.time};
  const backup=before(),text=record(row,t.kind);row.care.record(text,{type:'neighbor',peer:f.id,kind:t.kind});state.pending=null;row.town.hold();route=[];
  return persist(backup,{accepted:true,changed:true,completed:true,petId:row.entry.id,text});
 }
 function facts(petId){const row=find(petId);return {pending:state.pending?.petId===petId?structuredClone(state.pending):null,friends:PET_NEIGHBORS.map(f=>({...structuredClone(f),...neighborBondView(row?bonds(row):{},f.id),samePlace:row?.entry.town?.place===shared.neighbors[f.id].town.place})),recent:PET_NEIGHBORS.flatMap(f=>neighborBondView(row?bonds(row):{},f.id).recent.map(x=>({...x,neighborId:f.id,name:f.name}))).sort((a,b)=>b.at-a.at).slice(0,8)};}
 return {state,request,tick,cancel,facts,snapshot:()=>structuredClone(shared)};
}
