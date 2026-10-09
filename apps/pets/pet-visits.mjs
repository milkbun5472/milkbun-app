import {PET_NEIGHBORS,neighborBondView} from './pet-friends.mjs?v=fg-5c481c2e3871a814';
import {createTownLife} from './town-life.mjs?v=fg-5c481c2e3871a814';
import {furniturePoint} from './furnishings.mjs?v=fg-5c481c2e3871a814';

const find=id=>PET_NEIGHBORS.find(x=>x.id===id);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const phaseNames={going:'沿街来你家',welcome:'走到主人宠物身边',choice:'等你们安排怎么待着',play:'一起玩家里的球',quiet:'在安静角落陪着',guard:'留着各自舒服的空间',relax:'在家里歇歇',returning:'沿路回自己的小店'};
export function restorePetVisit(raw,ids=[]){
 if(!find(raw?.neighborId)||!ids.includes(raw?.petId)||!Number.isFinite(raw.id)||!phaseNames[raw.phase])return null;
 return {id:raw.id,neighborId:raw.neighborId,petId:raw.petId,phase:raw.phase,time:Math.max(0,Math.min(180,Number(raw.time)||0)),lastAt:Number.isFinite(raw.lastAt)?raw.lastAt:0,date:typeof raw.date==='string'?raw.date:'',done:raw.done===true,mode:['play','quiet','guard'].includes(raw.mode)?raw.mode:'',basePlay:Math.max(0,Number(raw.basePlay)||0),petPoint:raw.petPoint&&Number.isFinite(raw.petPoint.x)&&Number.isFinite(raw.petPoint.z)?{...raw.petPoint}:null};
}
export function createPetVisits(shared,{world,rows,getActors=()=>[],now=()=>Date.now(),date=()=>'',save=()=>true,onRestore=()=>{}}){
 const controllers=new Map();let petRoute=[],routeKey='';
 const row=id=>rows().find(x=>x.entry.id===id);
 const before=()=>({shared:structuredClone(shared),pets:rows().map(x=>({id:x.entry.id,care:x.care.snapshot(),career:x.career.snapshot(),town:structuredClone(x.entry.town)}))});
 const restore=b=>{for(const k of Object.keys(shared))delete shared[k];Object.assign(shared,b.shared);for(const x of b.pets){const p=row(x.id);if(p){Object.assign(p.care.state,x.care);p.career.restore(x.career);Object.assign(p.entry.town,x.town);p.home?.resetPose();}}controllers.clear();petRoute=[];routeKey='';onRestore();};
 function persist(b,r){if(!save()){restore(b);return {accepted:false,text:'这次串门没有保存成功，请先重试保存。'};}return r;}
 function controller(id){const definition=find(id),t=shared.neighbors[id].town;let c=controllers.get(id);if(c?.state!==t){c=createTownLife(t,{world,size:()=>definition.profile.size,actor:()=>({id:'neighbor:'+id,kind:'pet',species:definition.species,size:definition.profile.size}),actors:getActors});controllers.set(id,c);}return c;}
 const free=p=>p&&p.entry.town.place==='home'&&!p.career.state.job&&!p.care.state.helper&&(!p.care.state.task||p.care.state.task.source==='self'&&['wander','watch'].includes(p.care.state.task.kind))&&!p.care.state.task?.socialId&&!p.care.state.task?.target&&p.care.state.energy>=35&&p.care.state.satiety>=30;
 function log(text,completed=false){shared.recent.push({at:now(),text,completed});shared.recent=shared.recent.slice(-12);}
 function returning(){const t=shared.petVisit;if(!t)return;const p=row(t.petId);if(p&&held(p.entry.id)){p.town.hold();p.home?.resetPose();}t.phase='returning';t.time=0;controller(t.neighborId).go(find(t.neighborId).place,null,{manual:true});petRoute=[];routeKey='';}
 function held(id){const t=shared.petVisit;return t?.petId===id&&['welcome','choice','quiet','guard'].includes(t.phase);}
 function choose(mode,p,t){
  const c=controller(t.neighborId),g=c.state,nav=p.town.nav(),ball=p.care.state.toyPlaces.ball;
  if(mode==='play'){
   const r=p.home?.request('play',{toy:'ball',source:'self',deferSave:true});if(!r?.accepted)return r||{accepted:false,text:'先等家里的球准备好。'};
   t.basePlay=p.care.state.toys.ball;t.phase='play';t.petPoint=null;t.mode='play';
   const goal=c.nav().freePoint({x:ball.x-.85,z:ball.z},g.position);if(goal)c.walkTo(goal);
  }else{
   const anchor=mode==='guard'&&p.career.state.furnishings.sleep?furniturePoint(p.career.state,rows().indexOf(p)):p.home?.socialSpot(mode==='guard'?'bed':'rug')||{x:0,z:.8};
   const point=nav.freePoint(anchor,p.entry.town.position);if(!point)return {accepted:false,text:'这个角落现在没有能站下的位置，晚一点再试。'};
   const guest=c.nav().freePoint({x:point.x+(mode==='guard'?1.8:1.05),z:point.z+.35},g.position);if(!guest)return {accepted:false,text:'朋友暂时走不过来，换个空一点的地方再邀请。'};
   p.care.cancel();p.home?.resetPose();p.town.sync('home',p.entry.town.position,p.entry.town.heading,{manual:true});t.petPoint=point;petRoute=[];routeKey='';c.walkTo(guest);t.phase=mode;t.mode=mode;
  }
  t.time=0;return {accepted:true,text:mode==='play'?'朋友会跟着它一起追家里的球。':mode==='guard'?'让它守着自己的角落，朋友留出舒服的距离。':'一起去安静的角落坐一会儿。'};
 }
 function request(action,petId,id){const p=row(petId),t=shared.petVisit,n=find(id);
  if(action==='invite'){
   if(!n)return {accepted:false,text:'先看看想邀请哪位朋友。'};
   if(t||shared.streetVisit||shared.petMeeting||shared.quest||shared.visit||shared.event)return {accepted:false,text:'先陪完眼前的街坊约定。'};
   if(!free(p))return {accepted:false,text:'先实际回家、吃饱休息好，空下来再请朋友做客。'};
   const m=shared.neighbors[id].met[petId],bond=neighborBondView({[id]:m},id);if(bond.visits<2)return {accepted:false,text:'先在店里慢慢认识两次，再邀请它到家里。'};
   if(m?.homeDate>=date())return {accepted:false,text:'今天已经请过它了，改天再聚。'};
   const b=before();if(p.care.state.task)p.care.cancel();p.town.hold();const c=controller(id);c.go('home',null,{manual:true});m.homeDate=date();shared.petVisit={id:++shared.petVisitSeq,neighborId:id,petId,phase:'going',time:0,lastAt:now(),date:date(),done:false,mode:'',basePlay:0,petPoint:null};log('邀请'+n.name+'到家里做客，对方正沿街走来。');return persist(b,{accepted:true,text:n.name+'准备沿路来家里，你们可以在家等它。'});
  }
  if(!t||t.neighborId!==id||t.petId!==petId)return {accepted:false,text:'这位朋友现在没有来这只宠物家里做客。'};
  if(action==='end'){const b=before();returning();log('和'+n.name+'道别，它准备沿路回店里。');return persist(b,{accepted:true,text:'这次先告一段落，朋友沿路回去。'});}
  if(!['play','quiet','guard'].includes(action)||t.phase!=='choice')return {accepted:false,text:'先等大家走到家里见面，再安排这次相处。'};
  if(controller(id).state.place!=='home')return {accepted:false,text:'先等朋友实际走进家里。'};if(!free(p))return {accepted:false,text:'它现在想先忙自己的事，等空下来再陪朋友。'};
  const b=before(),r=choose(action,p,t);if(!r?.accepted){restore(b);return r;}return persist(b,r);
 }
 function movePet(p,t,dt){const target=t.petPoint;if(!target)return {arrived:true,speed:0};const key=t.id+':'+t.phase+JSON.stringify(target),nav=p.town.nav();if(key!==routeKey){const path=nav.path(p.entry.town.position,target);if(!path)return {arrived:false,speed:0};petRoute=path;routeKey=key;}const m=nav.walk(petRoute,p.entry.town.position,p.entry.town.heading,dt,.7*p.entry.profile.size);p.entry.town.position=m.position;p.entry.town.heading=m.heading;if(!petRoute.length&&distance(m.position,target)>.15)routeKey='';return {arrived:!petRoute.length&&distance(m.position,target)<.15,speed:m.speed};}
 function complete(p,t){if(t.done)return;const n=find(t.neighborId),m=shared.neighbors[n.id].met[p.entry.id];m.homeVisits=(m.homeVisits||0)+1;const text=p.entry.profile.name+'和'+n.name+'在家里'+(t.mode==='play'?'玩过自己的小球。':t.mode==='guard'?'各自留了舒服的空间；没有勉强分享自己的窝。':'安静陪着待了一会儿。');m.recent.push({kind:'visit',day:p.career.state.day,at:now(),text});m.recent=m.recent.slice(-8);log(text);p.care.record(text,{type:'neighbor',peer:n.id,kind:'together'});t.done=true;t.phase='relax';t.time=0;t.petPoint=null;p.town.hold();p.home?.resetPose();}
 function tick(dt){const t=shared.petVisit;if(!t||!Number.isFinite(dt)||dt<=0)return null;dt=Math.min(dt,.05);let b=null;const remember=()=>b||(b=before()),p=row(t.petId),n=find(t.neighborId),c=controller(n.id);if(now()-t.lastAt>=60000&&t.phase!=='returning'){remember();returning();log('离开了一阵，这次串门先结束，朋友沿路回去。');const r=persist(b,{accepted:true,changed:true});if(!r.accepted)return r;}t.lastAt=now();
  if(t.phase!=='returning'&&(!['going'].includes(t.phase)&&c.state.place!=='home'||!p||p.entry.town.place!=='home'||p.career.state.job||p.care.state.helper||p.care.state.energy<25||p.care.state.satiety<20)){remember();returning();log(n.name+'先回店里，让主人宠物忙完或休息。');const r=persist(b,{accepted:true,changed:true});if(!r.accepted)return r;}
  const moved=c.tick(dt,{group:true,stayHome:true});let speed=0;
  if(t.phase==='returning'){if(c.state.place===n.place&&!c.state.goal){remember();shared.petVisit=null;return persist(b,{accepted:true,changed:true});}return {neighborId:n.id,friendSpeed:moved.speed};}
  if(t.phase==='going'&&c.state.place==='home'&&!c.state.goal){const point=c.nav().freePoint({x:p.entry.town.position.x+1.1,z:p.entry.town.position.z+.3},c.state.position);if(!point)return {neighborId:n.id,friendSpeed:moved.speed};remember();c.walkTo(point);t.phase='welcome';t.time=0;t.petPoint={...p.entry.town.position};return persist(b,{accepted:true,changed:true,neighborId:n.id,petId:t.petId,owned:true,speed:0,friendSpeed:moved.speed});}
  if(t.phase==='welcome'&&c.state.place==='home'&&!c.state.goal){t.time+=dt;if(t.time>=3){remember();t.phase='choice';t.time=0;return persist(b,{accepted:true,changed:true,neighborId:n.id,petId:t.petId,owned:true,speed:0,friendSpeed:0,text:n.name+'已经到家了，打开街坊页安排分享小球、安静陪伴或留好各自的空间。'});}}
  if(['quiet','guard'].includes(t.phase)){const m=movePet(p,t,dt);speed=m.speed;if(m.arrived&&!c.state.goal){t.time+=dt;if(t.time>=8){remember();complete(p,t);return persist(b,{accepted:true,changed:true,completed:true,petId:t.petId,text:shared.recent.at(-1).text});}}}
  if(t.phase==='play'){
   if(p.care.state.toys.ball>t.basePlay){remember();complete(p,t);return persist(b,{accepted:true,changed:true,completed:true,petId:t.petId,text:shared.recent.at(-1).text});}
   if(p.care.state.task?.kind!=='play'){remember();returning();return persist(b,{accepted:true,changed:true});}
   const q=p.care.state.toyPlaces.ball;if(!c.state.goal&&q){const goal=c.nav().freePoint({x:q.x-.9,z:q.z+.3},c.state.position);if(goal&&distance(c.state.position,goal)>.25)c.walkTo(goal);}
  }
  if(['choice','relax'].includes(t.phase)){t.time+=dt;if(t.time>120){remember();returning();return persist(b,{accepted:true,changed:true});}}
  return {neighborId:n.id,petId:t.petId,owned:held(t.petId),speed,friendSpeed:moved.speed,kind:t.phase,phase:t.phase,time:t.time};
 }
 function facts(petId){const t=shared.petVisit;return t?{...structuredClone(t),name:find(t.neighborId).name,hostName:row(t.petId)?.entry.profile.name||'它',mine:t.petId===petId,label:phaseNames[t.phase],options:t.phase==='choice'?['play','quiet','guard']:[]}:null;}
 return {request,tick,held,facts};
}
