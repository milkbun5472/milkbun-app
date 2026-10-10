import {localRoute,nextRandom} from './autonomy.mjs?v=fg-6941d9cc1b32d96f';
import {PET_NEIGHBORS,restoreNeighborBonds,restorePetMeeting,createPetFriends,syncFriendWork} from './pet-friends.mjs?v=fg-6941d9cc1b32d96f';
import {createTownLife,newTownLife,restoreTownLife,createTownNavigation,roomDoor} from './town-life.mjs?v=fg-6941d9cc1b32d96f';
import {careSummary} from './care.mjs?v=fg-6941d9cc1b32d96f';

import {createPetVisits,restorePetVisit} from './pet-visits.mjs?v=fg-6941d9cc1b32d96f';

export const NEIGHBORS=[
 {id:'baker',name:'阿棉',role:'面包师',shop:'bakery',spot:{x:-14,z:-.5},to:'florist',item:'给花店的面包袋',detail:'总惦记着街坊有没有好好吃饭。',look:{hair:'bob',hairColor:'#684b35',outfit:'cardigan',wardrobe:{cardigan:{cloth:'#c49667'}}}},
 {id:'florist',name:'青禾',role:'花店主',shop:'florist',spot:{x:-14,z:-13},to:'regular',item:'给咖啡店的一小束花',detail:'说话慢慢的，喜欢记住小动物的习惯。',look:{hair:'longpart',hairColor:'#443d32',outfit:'jacket',wardrobe:{jacket:{cloth:'#7e9b80'}}}},
 {id:'regular',name:'小榆',role:'咖啡店的常客',shop:'cafe',spot:{x:14,z:12},to:'baker',item:'给面包师的手写便条',detail:'爱散步，也爱张罗周末的小聚会。',look:{hair:'pixie',hairColor:'#9a7654',outfit:'suit',wardrobe:{suit:{cloth:'#a18599'}}}}
].concat(PET_NEIGHBORS);
const rainPoint=()=>{const d=roomDoor('cafe');return {x:d.x+1.2,z:d.z};};
const profile=id=>NEIGHBORS.find(n=>n.id===id),num=(v,max=1e15)=>Number.isFinite(v)?Math.max(0,Math.min(max,v)):0;
const text=v=>typeof v==='string'?v.slice(0,160):'',same=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<1.8;
// The real clock chooses a destination; the original route executor walks there.
// Reopening the town never relocates a neighbor to a completed appointment.
export function neighborSchedule(id,time,weather='晴日'){
 const n=profile(id);if(!n)return null;if(n.pet)return {place:n.place,point:{...n.position},activity:'在'+n.placeName+'等熟悉的小伙伴',gesture:'rest',awake:true,hours:''};const minute=time.minute;
 const early=id==='baker'?360:480,late=id==='baker'?1260:1320;
 const hours=id==='baker'?'06:00–21:00':'08:00–22:00';
 let place=n.shop,activity='',gesture='rest',awake=minute>=early&&minute<late;
 if(!awake)activity='已经收工休息';
 else if(minute>=720&&minute<780){activity='在店里吃午饭';gesture='eat';}
 else if(id==='baker'&&(minute<540||minute>=1080))activity=minute<540?'在面包店准备今天的面包':'在面包店收拾';
 else if(id==='florist'&&minute>=1140)activity='在花店整理花束';
 else if(id==='regular'&&(minute<600||minute>=1080)){activity='在咖啡店翻书';gesture='read';}
 else if(id==='regular'&&minute>=840){place='outside';activity='在小公园散步';}
 else {place='outside';activity=id==='regular'?'在咖啡店门口歇歇':id==='baker'?'在面包店门口照看小店':'在花店门口照看小店';}
 if(awake&&place==='outside'&&/雨|雪/.test(weather)){place=n.shop;activity='在'+(id==='baker'?'面包店':id==='florist'?'花店':'咖啡店')+'避雨雪';gesture=id==='regular'?'read':'rest';}
 const d=place==='outside'?null:roomDoor(place);
 const point=d?{x:d.x+(id==='regular'?0:1.2),z:d.z-(id==='regular'?.95:0)}:id==='regular'&&minute>=840?{x:7,z:19}:{...n.spot};
 return {place,point,activity,gesture,awake,hours};
}
export function restoreNeighborhood(raw,petIds=[],pets=[]){
 const neighbors=Object.fromEntries(NEIGHBORS.map((n,i)=>{const r=raw?.neighbors?.[n.id];return[n.id,{town:restoreTownLife(r?.town)||newTownLife(n.pet?n.place:'outside',n.spot,371+i*117),met:Object.fromEntries(petIds.filter(id=>r?.met?.[id]).map(id=>{const m=r.met[id];return[id,{...(n.pet?restoreNeighborBonds({[n.id]:m})[n.id]:{}),greetings:num(m.greetings,10000),favors:num(m.favors,10000),visits:num(m.visits,10000),events:num(m.events,10000),lastDate:text(m.lastDate),knownName:text(m.knownName),habit:text(m.habit),lastVisit:text(m.lastVisit),eventDate:text(m.eventDate)}];})),favors:Object.fromEntries(Object.entries(r?.favors||{}).filter(([id,d])=>petIds.includes(id)&&typeof d==='string').map(([id,d])=>[id,text(d)]))}];}));
 const q=raw?.quest,e=raw?.event,v=raw?.visit,m=raw?.meeting,sv=raw?.streetVisit;
 const meeting=restorePetMeeting({seq:raw?.petMeetingSeq,ball:raw?.friendBall,pending:raw?.petMeeting},petIds);const restored={version:3,petVisitSeq:Math.max(num(raw?.petVisitSeq,1e7),num(raw?.petVisit?.id,1e7)),petVisit:restorePetVisit(raw?.petVisit,petIds),neighbors,streetVisit:profile(sv?.neighborId)?.pet&&typeof sv?.tripId==='string'&&Number.isFinite(sv?.point?.x)&&Number.isFinite(sv?.point?.z)?{neighborId:sv.neighborId,tripId:sv.tripId,phase:['coming','staying','returning'].includes(sv.phase)?sv.phase:'returning',point:{x:sv.point.x,z:sv.point.z},at:num(sv.at)}:null,meeting:profile(m?.id)&&!profile(m.id).pet&&petIds.includes(m?.petId)&&['wait','wave'].includes(m?.kind)?{id:m.id,petId:m.petId,kind:m.kind,time:num(m.time,m.kind==='wave'?3:120)}:null,petMeetingSeq:meeting.seq,friendBall:meeting.ball,petMeeting:meeting.pending,quest:profile(q?.from)?.to&&petIds.includes(q?.petId)?{from:q.from,to:profile(q.from).to,petId:q.petId,phase:['carrying','handoff','returning'].includes(q.phase)?q.phase:'carrying',time:num(q.time,3),date:text(q.date)}:null,visit:profile(v?.id)&&!profile(v.id).pet?{id:v.id,petId:petIds.includes(v.petId)?v.petId:petIds[0],phase:['going','staying','returning'].includes(v.phase)?v.phase:'returning',time:num(v.time,180),date:text(v.date)}:null,event:profile(e?.host)&&!profile(e.host).pet&&petIds.includes(e?.petId)&&['meet','picnic'].includes(e?.id)?{id:e.id,host:e.host,petId:e.petId,date:text(e.date),place:e.place==='cafe'?'cafe':'outside',point:e.point&&Number.isFinite(e.point.x)&&Number.isFinite(e.point.z)?{x:e.point.x,z:e.point.z}:e.place==='cafe'?rainPoint():e.id==='meet'?{x:7,z:19}:{x:-9,z:15},time:num(e.time,20),done:e.done===true}:null,recent:Array.isArray(raw?.recent)?raw.recent.filter(x=>Number.isFinite(x.at)&&typeof x.text==='string').slice(-12).map(x=>({at:x.at,text:text(x.text),completed:x.completed===true})):[]};syncFriendWork(restored,pets);return restored;
}
export function weekendGathering(time,weather='晴日'){
 const rainy=/雨|雪/.test(weather),weekday=time.weekday;
 const event=weekday===6?{id:'meet',title:'周六遛宠物小聚',start:600,end:720,host:'regular',point:{x:7,z:19}}:weekday===0?{id:'picnic',title:'周日下午的小野餐',start:900,end:1020,host:'florist',point:{x:-9,z:15}}:null;
 if(!event)return {available:false,title:'下一次周末小聚',when:'周六 10:00–12:00 · 周日 15:00–17:00'};
 return {...event,date:time.date,place:rainy?'cafe':'outside',point:rainy?rainPoint():event.point,venue:rainy?'咖啡店门内避雨':'小公园',available:time.minute>=event.start&&time.minute<event.end,when:weekday===6?'周六 10:00–12:00':'周日 15:00–17:00'};
}
// Each participant gets a reachable place beside the host, rather than standing
// on the same root. Indoor arrivals still use the original room doorway.
export function gatheringSpot(event,who,world){const n=event.place==='outside'?world:createTownNavigation(event.place,1.4),offsets=event.place!=='outside'&&who==='pet'?[[-.9,0]]:who==='companion'?[[1.15,.1],[.8,-.8],[-.8,-.8]]:[[-1,.6],[-1.1,0],[0,1.1]];for(const[x,z]of offsets){const p={x:event.point.x+x,z:event.point.z+z};if(n.walkable(p.x,p.z)&&n.path(event.point,p))return p;}return {...event.point};}
// Relationships grow only from observed encounters. Route execution is shared
// with pets and TA; none of this module runs in the offline recovery writer.
export function createNeighborhood(state,{world,getRows,getActors=()=>[],getTime,getWeather=()=> '晴日',save=()=>true}){
 let routes=new Map(),changed=false;
 const bind=()=>{routes=new Map(NEIGHBORS.map(n=>[n.id,createTownLife(state.neighbors[n.id].town,{world,size:()=>n.pet?n.profile.size:1.4,actor:()=>({id:'neighbor:'+n.id,kind:n.pet?'pet':'person',species:n.species,size:n.pet?n.profile.size:1.4}),actors:getActors,onChange:()=>{changed=true;}})]));};bind();
 const friends=createPetFriends(state,{rows:getRows,getActors,now:()=>getTime().at,save,onRestore:bind});const guests=createPetVisits(state,{world,rows:getRows,getActors,now:()=>getTime().at,date:()=>getTime().date,save,onRestore:bind});let friendMotion=null;
 const row=id=>getRows().find(x=>x.entry.id===id),near=(id,p)=>!!p&&p.entry.town?.place===state.neighbors[id].town.place&&same(p.entry.town.position,state.neighbors[id].town.position);
 const free=p=>!!p&&!p.career.state.job&&!p.care.state.helper&&!p.care.state.task&&p.care.state.energy>=30&&p.care.state.satiety>=30;
 const memory=(id,p)=>state.neighbors[id].met[p.entry.id]||(state.neighbors[id].met[p.entry.id]={greetings:0,favors:0,visits:0,events:0,lastDate:'',knownName:'',habit:'',lastVisit:'',eventDate:''});
 const score=m=>m?m.greetings+m.favors*2+m.visits+m.events:0;
 function remember(id,p){const m=memory(id,p),facts=careSummary(p.care.state);m.knownName=p.entry.profile.name;m.habit=(Math.max(...Object.values(p.care.state.toys||{}))>=3?'爱玩'+facts.favoriteToy:'')||(Math.max(...Object.values(p.care.state.rests||{}))>=3?'爱在'+facts.favoriteRest+'休息':'');return m;}
 function log(message,completed=false){state.recent.push({at:getTime().at,text:message,completed});state.recent=state.recent.slice(-12);changed=true;}
 function replace(old){for(const k of Object.keys(state))delete state[k];Object.assign(state,old);changed=false;bind();}
 function transaction(fn){const before=structuredClone(state);changed=false;const result=fn();if(!result.accepted){replace(before);return result;}if(result.accepted){if(!save()){replace(before);return {accepted:false,text:'这件小事没有保存成功，请先重试保存。'};}}return result;}
 const no=message=>({accepted:false,text:message}),yes=message=>({accepted:true,text:message});
 function go(id,place,point=null){const r=routes.get(id),s=r.state;if(place==='outside'){if(s.place==='outside'&&Math.hypot(s.position.x-point.x,s.position.z-point.z)<.15)return; r.go(place,point);}else if(s.place!==place)r.go(place);else if(point&&r.nav().walkable(point.x,point.z)){s.target=place;s.phase='stroll';s.goal={...point};s.stop=null;s.hold=0;changed=true;}}
 function home(id){go(id,'outside',profile(id).spot);}
 const schedule=id=>neighborSchedule(id,getTime(),getWeather());
 const promised=id=>state.visit?.id===id||state.event?.host===id;
 const entrusted=id=>state.quest&&(state.quest.from===id||state.quest.to===id);
 const awake=id=>promised(id)||entrusted(id)||schedule(id).awake;
 function face(id,p){const t=state.neighbors[id].town;if(near(id,p)){const q=p.entry.town.position;t.heading=Math.atan2(q.x-t.position.x,q.z-t.position.z);}}
 function meet(id,p,kind='wave'){state.meeting={id,petId:p.entry.id,kind,time:kind==='wave'?3:120};face(id,p);changed=true;}
 function followSchedule(id,dt){const plan=schedule(id),t=state.neighbors[id].town;
  if(t.place!==plan.place){if(!t.goal||t.target!==plan.place)go(id,plan.place,plan.point);return;}
  const distance=Math.hypot(t.position.x-plan.point.x,t.position.z-plan.point.z);
  if(plan.awake&&plan.gesture==='rest'&&distance<2.2){if(t.goal&&t.phase==='stroll'&&t.target===plan.place&&Math.hypot(t.goal.x-plan.point.x,t.goal.z-plan.point.z)<2.2)return;if(!t.goal){t.idle+=dt;if(t.idle>=18){const r=routes.get(id),next=localRoute(r.nav(),t.position,()=>nextRandom(t),{radius:1.5,minDistance:.6,clear:q=>Math.hypot(q.x-plan.point.x,q.z-plan.point.z)<2});t.idle=0;if(next)go(id,plan.place,next.goal);}return;}}
  if(distance<.15){if(t.goal){t.goal=null;t.stop=null;t.phase='visit';t.target=plan.place;changed=true;}return;}
  if(!t.goal||t.target!==plan.place||t.phase==='stroll'&&Math.hypot(t.goal.x-plan.point.x,t.goal.z-plan.point.z)>.15)go(id,plan.place,plan.point);
 }
 function appearance(id){if(state.petVisit?.neighborId===id)return {gesture:'rest',activity:guests.facts(state.petVisit.petId).label,awake:true,hours:''};const plan=schedule(id),t=state.neighbors[id].town,m=state.meeting;
  if(state.streetVisit?.neighborId===id)return {gesture:'rest',activity:state.streetVisit.phase==='staying'?'在街边和你们打招呼':state.streetVisit.phase==='returning'?'正沿路回店里':'正从店门出来找你们',awake:true,hours:plan.hours};
  if(m?.id===id&&m.kind==='wave')return {gesture:'wave',progress:1-m.time/3,activity:'正和小家伙打招呼',awake:true,hours:plan.hours};
  if(promised(id))return {gesture:state.visit?.id===id&&state.visit.phase==='staying'?'sit':'rest',activity:state.visit?.id===id?'正在串门':'正在参加周末小聚',awake:true,hours:plan.hours};
  if(entrusted(id)||m?.id===id)return {gesture:'rest',activity:entrusted(id)?'等着交接小托付':'等小家伙走过来',awake:true,hours:plan.hours};
  const arrived=t.place===plan.place&&Math.hypot(t.position.x-plan.point.x,t.position.z-plan.point.z)<(plan.awake&&plan.gesture==='rest'?2.2:.2);
  return {...plan,gesture:arrived?plan.gesture:'rest',activity:arrived?plan.activity:'正去'+(plan.place==='outside'?plan.activity.replace(/^在/,''):world.building(plan.place)?.title||plan.place),awake:plan.awake};
 }
 function request(action,id,petId){if(action.startsWith('guest-'))return guests.request(action.slice(6),petId,id);if(state.petVisit)return no('先陪完来家里做客的宠物朋友，或送朋友回店里。');if(action.startsWith('pet-'))return friends.request(action.slice(4),petId,id);if(profile(id)?.pet)return no(profile(id).name+'喜欢一起待着或追球，打开它的小档案再邀请。');if(state.petMeeting)return no('先陪完正在进行的宠物相处。');const p=row(petId),n=profile(id),time=getTime();if(!p)return no('先选好同行的小家伙。');
  return transaction(()=>{
   if(action==='join'){
    const event=weekendGathering(time,getWeather());if(!event.available)return no('还没到小聚的时间，周末再来看看。');if(state.event||state.visit)return no('先陪完正在进行的小约定。');if(!free(p))return no('它正在忙或想先吃饭休息，晚点再出发。');if(state.quest?.petId===petId)return no('先把街坊托付的东西送好。');
    // recent is a bounded journal; the per-pet date is the authoritative guard.
    const m=memory(event.host,p);if(m.eventDate>=time.date)return no('今天已经一起参加过了。');
    state.meeting=null;state.event={id:event.id,host:event.host,petId,date:time.date,place:event.place,point:{...event.point},time:0,done:false};go(event.host,event.place,event.point);log('约好了参加'+event.title+'，正在等'+p.entry.profile.name+'走到现场。');return yes('小聚约好了，带它到'+event.venue+'；到场后一起待一会儿。');
   }
   if(action==='leave-event'){if(!state.event)return no('现在没有正在参加的小聚。');home(state.event.host);state.event=null;log('这次小聚先告一段落。');return yes('各自慢慢回去，下个周末再见。');}
   if(!n)return no('没有找到这位街坊。');
   if(['greet','accept','invite','find'].includes(action)&&!awake(id))return no(n.name+'已经收工休息了，日常见面时间是'+schedule(id).hours+'。');
   if(action==='find'){if(!free(p))return no('先让它忙完、吃饱休息好，再去找街坊。');if(promised(id)&&state.neighbors[id].town.goal)return yes(n.name+'正在赴约，沿路到约好的地方等。');meet(id,p,'wait');return yes(n.name+'停下来等它，沿路走过去见面。');}
   if(action==='greet'){if(!near(id,p))return no('先带它走到'+n.name+'身边，再打招呼。');if(p.care.state.task||p.career.state.job)return no('先让它忙完眼前的事。');const m=memory(id,p);if(m.lastDate>=time.date){meet(id,p);return yes(n.name+'今天已经和'+p.entry.profile.name+'打过招呼了。');}meet(id,p);m.greetings++;m.lastDate=time.date;remember(id,p);log(n.name+'认识了'+p.entry.profile.name+'，在街上打了招呼。',true);return yes(m.greetings===1?n.name+'记住了它叫'+m.knownName+'。':n.name+'认出了'+m.knownName+(m.habit?'，还记得它'+m.habit:'')+'。');}
   if(action==='accept'){if(state.quest)return no('先送完或还回手上的东西。');if(state.visit||state.event)return no('先陪完正在进行的小约定。');if(!near(id,p))return no('先走到'+n.name+'身边拿东西。');if(!free(p))return no('它现在想先忙自己的事，吃饱休息好再来。');if(state.neighbors[id].favors[petId]>=time.date)return no('今天已经帮过这位街坊了。');state.meeting=null;state.quest={from:id,to:n.to,petId,phase:'carrying',time:0,date:time.date};log(n.name+'把'+n.item+'交给'+p.entry.profile.name+'，等着实际送到。');return yes('拿好了'+n.item+'，送到'+profile(n.to).name+'身边再交给对方。');}
   if(action==='deliver'){const q=state.quest;if(!q||q.petId!==petId)return no('这只宠物手上没有街坊的托付。');const target=q.phase==='returning'?q.from:q.to;if(id!==target||!near(target,p))return no('先走到收东西的街坊身边。');if(p.care.state.task||p.career.state.job)return no('等它忙完，再把东西交过去。');if(q.phase==='returning'){state.quest=null;log('把'+profile(q.from).item+'还给了'+profile(target).name+'。');return yes('东西已经交还，下次再帮忙。');}state.meeting=null;face(id,p);q.phase='handoff';q.time=0;log('正把'+profile(q.from).item+'交到'+profile(target).name+'手里。');return yes(q.phase==='returning'?'东西已经还给原来的街坊。':'回到场景，看看它把东西交过去。');}
   if(action==='return'){if(!state.quest||state.quest.petId!==petId)return no('它手上没有需要还回的东西。');state.quest.phase='returning';state.quest.time=0;return yes('把东西带回'+profile(state.quest.from).name+'身边，再点「交还东西」。');}
   if(action==='invite'){const m=memory(id,p);if(score(m)<3)return no('再见几次，或帮它送一次东西，熟悉后就能串门。');if(m.lastVisit>=time.date)return no('今天已经约过串门了，改天再聚。');if(state.visit||state.event||state.quest)return no('先陪完正在进行的小约定。');if(!free(p))return no('它现在想先忙自己的事，晚点再请客。');m.lastVisit=time.date;state.meeting=null;state.visit={id,petId,phase:'going',time:0,date:time.date};go(id,'home');log('邀请'+n.name+'到家串门，对方正在沿街走过来。');return yes(n.name+'沿路来串门了，你也可以带它回家等一会儿。');}
   if(action==='end-visit'){if(state.visit?.id!==id)return no('这位街坊现在没有在串门。');state.visit.phase='returning';home(id);log('和'+n.name+'道别，它正在回到街上。');return yes('说好了下次再见。');}
   return no('这件事暂时还做不到。');
  });
 }
 function walkFriend(id,tripId,point){return transaction(()=>{const n=profile(id),r=routes.get(id);if(!n?.pet||state.streetVisit||state.petVisit||state.petMeeting||state.quest||state.event||state.visit)return no('朋友这会儿先忙自己的事。');const q=r.nav('outside').freePoint(point,world.building(r.state.place)?.approach||r.state.position,.6,true);if(!q||!r.go('outside',q,{manual:true}))return no('朋友暂时走不过来。');state.streetVisit={neighborId:id,tripId,phase:'coming',point:q,at:getTime().at};return yes(n.name+'准备从店门里走出来，和你们打个招呼。');});}
 function releaseWalkFriend(tripId){const v=state.streetVisit;if(!v||v.tripId!==tripId)return false;v.phase='returning';const n=profile(v.neighborId),r=routes.get(v.neighborId);if(r.state.place!==n.place)r.go(n.place,null,{manual:true});else if(r.state.phase==='exit')r.sync(n.place,r.state.position,r.state.heading,{manual:true});changed=true;return true;}
 function streetFriendTick(dt){const v=state.streetVisit;if(!v)return;const n=profile(v.neighborId),r=routes.get(v.neighborId);if(getTime().at-v.at>10*60000)v.phase='returning';if(v.phase==='returning'){if(r.state.place===n.place){r.sync(n.place,r.state.position,r.state.heading,{manual:true});state.streetVisit=null;changed=true;return;}if(r.state.target!==n.place||!r.state.goal)r.go(n.place,null,{manual:true});}const m=r.tick(dt,{group:true});if(v.phase==='staying'){const peer=getRows().filter(x=>x.entry.town.place==='outside').map(x=>x.entry.town.position).sort((a,b)=>Math.hypot(a.x-r.state.position.x,a.z-r.state.position.z)-Math.hypot(b.x-r.state.position.x,b.z-r.state.position.z))[0];if(peer&&same(peer,r.state.position))r.state.heading=Math.atan2(peer.x-r.state.position.x,peer.z-r.state.position.z);}if(v.phase==='coming'&&r.state.place==='outside'&&!r.state.goal){v.phase='staying';changed=true;}friendMotion={...(friendMotion||{}),friends:{...(friendMotion?.friends||{}),[n.id]:m.speed}};}
 function tick(dt){if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);const before=structuredClone(state);changed=false;
  for(const n of NEIGHBORS.filter(n=>!n.pet)){const held=entrusted(n.id)&&!promised(n.id)||state.meeting?.id===n.id||state.quest?.phase==='handoff'&&state.quest.to===n.id;if(!held&&!promised(n.id))followSchedule(n.id,dt);const r=routes.get(n.id);if(!held&&r.state.goal)r.tick(dt,{stayHome:true});}
  const meeting=state.meeting;if(meeting){const p=row(meeting.petId);meeting.time-=dt;if(!free(p)||!awake(meeting.id)||meeting.time<=0||meeting.kind==='wave'&&!near(meeting.id,p)){state.meeting=null;changed=true;}else face(meeting.id,p);}
  const q=state.quest;if(q){const p=row(q.petId),id=q.phase==='returning'?q.from:q.to;if(q.phase==='handoff'){if(near(id,p)&&free(p)){q.time+=dt;if(q.time>=3){remember(q.from,p).favors++;remember(q.to,p).favors++;state.neighbors[q.from].favors[q.petId]=getTime().date;state.quest=null;log(p.entry.profile.name+'真的送到了'+profile(id).name+'手里，这件小托付完成了。',true);}}else {q.phase='carrying';q.time=0;changed=true;}}}
  const v=state.visit;if(v){const t=state.neighbors[v.id].town;if(v.phase==='going'&&t.place==='home'&&!t.goal){v.phase='staying';v.time=0;log(profile(v.id).name+'走到家门里了，来陪大家坐一会儿。',true);const p=row(v.petId);if(near(v.id,p)&&!p.care.state.task){remember(v.id,p).visits++;changed=true;}}else if(v.phase==='staying'){v.time+=dt;if(v.time>=180){v.phase='returning';home(v.id);log(profile(v.id).name+'串门结束，正在回到街上。');}}else if(v.phase==='returning'&&t.place==='outside'&&!t.goal){state.visit=null;changed=true;}}
  const e=state.event;if(e){const time=getTime(),event=weekendGathering(time,getWeather()),r=routes.get(e.host);if(!event.available||e.date!==time.date||event.id!==e.id){home(e.host);state.event=null;log('这次周末小聚已经结束，街坊慢慢回去。');}else if(event.place!==e.place){e.place=event.place;e.point={...event.point};e.time=0;go(e.host,e.place,e.point);log('天气变了，小聚挪到了'+event.venue+'，等大家重新到场。');}else if(e.place==='cafe'&&r.state.place==='cafe'&&!r.state.goal&&Math.hypot(r.state.position.x-e.point.x,r.state.position.z-e.point.z)>.2){go(e.host,'cafe',e.point);}else if(!e.done){const p=row(e.petId);if(near(e.host,p)&&!r.state.goal&&free(p)){e.time+=dt;if(e.time>=20){const m=remember(e.host,p);m.events++;m.eventDate=time.date;e.done=true;log(p.entry.profile.name+'和'+profile(e.host).name+'一起参加了'+event.title+'。',true);}}else e.time=0;}}
  streetFriendTick(dt);if(changed&&!save()){replace(before);return;}const streetMotion=friendMotion?.friends?.[state.streetVisit?.neighborId]||0;const visiting=guests.tick(dt),idle=friends.tick(dt);friendMotion=visiting?{...idle,...visiting}:idle;if(state.streetVisit)friendMotion={...(friendMotion||{}),friends:{...(friendMotion?.friends||{}),[state.streetVisit.neighborId]:streetMotion}};
 }
 function summary(petId){const p=row(petId),time=getTime(),q=state.quest;return {petVisit:guests.facts(petId),petMeeting:state.petMeeting?.petId===petId?structuredClone(state.petMeeting):null,neighbors:NEIGHBORS.map(n=>{const s=state.neighbors[n.id],m=s.met[petId],friend=n.pet?friends.facts(petId).friends.find(x=>x.id===n.id):null,level=friend?friend.visits+(friend.play+friend.together)*2:score(m);const a=appearance(n.id),title=world.building(s.town.place)?.title||'小镇街区';return {...n,look:undefined,...a,town:structuredClone(s.town),near:near(n.id,p),familiarity:level,friend,relation:friend?friend.label:level>=6?'熟悉的街坊':level>=3?'可以串门的朋友':level?'见过面的街坊':'还没认识',memory:m&&level?{...m,knownName:p?.entry.profile.name||m.knownName}:null,place:s.town.place==='home'?'你家 · '+a.activity:title+' · '+a.activity,canInvite:n.pet?friend.visits>=2&&friend.homeDate<time.date&&!state.petVisit&&!state.streetVisit&&!state.petMeeting&&p?.entry.town.place==='home':a.awake&&level>=3&&(!m?.lastVisit||m.lastVisit<time.date)};}),meeting:state.meeting?structuredClone(state.meeting):null,quest:q?{...q,item:profile(q.from).item,petName:row(q.petId)?.entry.profile.name,toName:profile(q.phase==='returning'?q.from:q.to).name}:null,visit:state.visit?{...state.visit,name:profile(state.visit.id).name}:null,event:{...weekendGathering(time,getWeather()),joined:state.event?structuredClone(state.event):null},recent:structuredClone(state.recent).reverse(),local:true};}
 return {state,tick,request,summary,near,appearance,friends,guests,walkFriend,releaseWalkFriend,restore:replace,get friendMotion(){return friendMotion;},syncWork:()=>syncFriendWork(state,getRows()),reserves:petId=>state.petVisit?.petId===petId&&state.petVisit.phase!=='returning'||state.petMeeting?.petId===petId||state.quest?.petId===petId||state.event?.petId===petId||state.meeting?.petId===petId,target:id=>{const t=state.neighbors[id]?.town;if(state.visit?.id===id&&state.visit.phase!=='returning')return {place:'home',point:roomDoor('home')};if(state.event?.host===id)return {place:state.event.place,point:gatheringSpot(state.event,'pet',world)};return t?{place:t.place,point:t.place==='outside'?gatheringSpot({place:t.place,point:t.position},'pet',world):{...t.position}}:null;},snapshot:()=>structuredClone(state)};
}
