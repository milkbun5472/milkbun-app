import {createNavigator,segmentIntersectsRect} from '../fairy-garden/navigation.mjs?v=fg-b149ac3dbf94ecd5';
import {stepRoute} from '../fairy-garden/locomotion.mjs?v=fg-b149ac3dbf94ecd5';
export const ENTRY={x:3.32,z:4.7};
export const SHOP_FURNITURE=[{id:'Counter',x:-1.45,z:1.15,w:3.93,d:1.04},{id:'SortTable',x:-2.25,z:-2.5,w:2.8,d:.85},{id:'WindowStool',x:3,z:-.6,w:.58,d:.6},{id:'DisplayShelves',x:-4.2,z:0,w:.45,d:6},{id:'Mailbags',x:4.05,z:2.45,w:.85,d:.55}];
export const queuePoint=i=>({x:-1.45+(Math.floor(i/3)%6)*.84,z:2.2+(Math.floor(i/18)%2?2-i%3:i%3)*.85});
export const visitorPoint=i=>({x:2.7+(i%2? .48:-.48),z:-1.7,seatX:2.7+(i%2?.48:-.48),seatZ:-2.6});
export function shopNavigation(hasBench=true){
 const obstacles=SHOP_FURNITURE.concat(hasBench?[{id:'Bench',x:2.7,z:-2.6,w:2.25,d:.65}]:[]);
 const walkable=(x,z)=>x>=-4.25&&x<=4.45&&z>=-3.12&&z<=5.1&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.24&&Math.abs(z-o.z)<o.d/2+.24);
 const clear=(a,b,_m,avoid=[])=>walkable(b.x,b.z)&&!obstacles.some(o=>segmentIntersectsRect(a,b,o,.24))&&avoid.every(o=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/(dx*dx+dz*dz||1)));const nearest=Math.hypot(a.x+dx*t-o.x,a.z+dz*t-o.z),start=Math.hypot(a.x-o.x,a.z-o.z),end=Math.hypot(b.x-o.x,b.z-o.z);return nearest>=o.r||(start<o.r&&end>start+1e-6&&nearest>=start-1e-6);});
 const find=createNavigator({shop:{radius:6,walkRegions:[{polygon:[{x:-4.25,z:-3.12},{x:4.45,z:5.1}]}]}},walkable,clear,walkable,{step:.18});
 return {obstacles,walkable,clear,find:(a,b,avoid=[])=>find(a,b,'shop',avoid)};
}
export function createShopFlow({onMeetEnd=()=>{}}={}){
 const units=new Map(),seen=new Set();let nav=shopNavigation(),data=null,clock=0,closing=null,meeting=null,spawn=0;
 const key=s=>s.kind==='staff'?'staff:'+s.id:'guest:'+s.key;
 function go(u,target){u.goal={x:target.x,z:target.z};u.path=nav.find(u.position,u.goal)||[];u.arrived=Math.hypot(u.position.x-target.x,u.position.z-target.z)<.08;u.blocked=0;}
 function depart(u,letter=false){if(u.phase==='leaving')return;u.phase='leaving';u.letter=letter;u.seated=false;go(u,ENTRY);}
 function reconcile(next){data=next;nav=shopNavigation(next.decor.some(d=>d.builder==='bench'));const wanted=new Set();let qi=0,vi=0;
  for(const source of next.staff){const k=key(source);wanted.add(k);let u=units.get(k);if(!u){u={key:k,...source,kind:'staff',position:{x:source.x,z:source.seatHeight ? .15 : source.z},phase:'working',path:[],arrived:true,heading:source.yaw,goal:{x:source.x,z:source.seatHeight ? .15 : source.z},seated:!!source.seatHeight};units.set(k,u);}else {const changed=u.post!==source.post;Object.assign(u,source);u.seatHeight=source.seatHeight||null;if(changed&&meeting?.staff!==k){u.seated=false;u.phase='working';go(u,{x:source.x,z:source.seatHeight ? .15 : source.z});}}u.home={x:source.x,z:source.seatHeight ? .15 : source.z};}
  const customers=next.closed||next.phase!=='open'?[]:next.customers;
  for(const source of customers){const k=key(source);if(source.done){const u=units.get(k);if(u)depart(u,source.got>0&&!source.miss);continue;}wanted.add(k);let u=units.get(k);const seat=source.visitor&&next.decor.some(d=>d.builder==='bench')&&vi<2?visitorPoint(vi++):null,target=seat||queuePoint(qi++);
   if(!u){u={...source,key:k,position:{...ENTRY},phase:'waiting-entry',path:[],heading:Math.PI,spawnAt:clock+spawn*.8,goal:target};spawn++;units.set(k,u);}
   else Object.assign(u,source,{key:k});u.seat=seat;u.target={x:target.x,z:target.z};
   if(u.phase!=='waiting-entry'&&u.phase!=='leaving'&&!u.seated&&(Math.hypot((u.goal?.x||0)-target.x,(u.goal?.z||0)-target.z)>.1))go(u,target);
  }
  for(const [k,u]of units)if(!wanted.has(k)&&u.phase!=='leaving')depart(u,false);
  if(!meeting&&!closing){const c=customers.find(c=>c.visitor&&c.meet?.length&&c.meetCast?.staffId&&!c.meetSeen&&!seen.has(c.key));if(c)playMeet(c.id);}
  spawn=0;
 }
 function playMeet(id){const c=data?.customers.find(c=>c.id===id),staff=c&&units.get('staff:'+c.meetCast?.staffId),visitor=c&&units.get('guest:'+c.key);if(!staff||!visitor||visitor.phase==='leaving'||closing||meeting)return false;
  seen.add(c.key);meeting={key:c.key,id,staff:staff.key,visitor:visitor.key,phase:'approach',time:0,index:0,turns:c.meetTurns?.length?c.meetTurns:c.meet.map(text=>({text,speakerId:null}))};staff.phase='meeting';staff.seated=false;go(staff,{x:1.25,z:-1.6});return true;
 }
 function startClosing(){if(closing)return;meeting=null;closing={time:0};for(const u of units.values()){u.bubble=null;if(u.kind==='staff'){u.phase='tidying';u.seated=false;u.path=[];u.arrived=true;}else depart(u,false);}}
 function step(dt){dt=Math.max(0,Math.min(.1,dt));clock+=dt;
  if(closing){closing.time+=dt;if(closing.time>1.45)for(const u of units.values())if(u.kind==='staff'&&u.phase==='tidying')depart(u,false);}
  for(const [k,u]of units){
   if(u.phase==='waiting-entry'){if(clock<u.spawnAt||[...units.values()].some(v=>v!==u&&(v.phase==='leaving'||v.phase!=='waiting-entry'&&Math.hypot(v.position.x-ENTRY.x,v.position.z-ENTRY.z)<.75)))continue;u.phase='queuing';go(u,u.target);}
   if(!u.path.length&&!u.arrived&&u.goal&&u.phase!=='waiting-entry'&&u.phase!=='tidying'){u.blocked=(u.blocked||0)+dt;if(u.blocked>.7){u.path=nav.find(u.position,u.goal,[...units.values()].filter(v=>v!==u&&v.phase!=='waiting-entry').map(v=>({...v.position,r:.55})))||[];u.blocked=0;}}
   if(u.path.length){const others=[...units.values()].filter(v=>v!==u&&v.phase!=='waiting-entry').map(v=>({...v.position,r:.55}));
    const next=stepRoute(u.position,u.path,dt,{walkSpeed:u.visitor?1.05:1.3,clear:(a,b)=>nav.clear(a,b,'shop')&&others.every(v=>Math.hypot(b.x-v.x,b.z-v.z)>=.55||Math.hypot(a.x-v.x,a.z-v.z)<Math.hypot(b.x-v.x,b.z-v.z))});const stopped=u.path.length&&Math.hypot(next.position.x-u.position.x,next.position.z-u.position.z)<1e-5;u.position=next.position;if(next.heading!=null)u.heading=next.heading;
    if(next.blocked||stopped){u.blocked=(u.blocked||0)+dt;if(u.blocked>.7){u.path=nav.find(u.position,u.goal,others.map(o=>({...o,r:Math.min(.6,Math.max(.1,Math.hypot(o.x-u.position.x,o.z-u.position.z)-.025))})))||[];u.blocked=0;}}
    u.arrived=!u.path.length&&Math.hypot(u.position.x-u.goal.x,u.position.z-u.goal.z)<.12;
   }
   if(u.arrived&&u.phase==='leaving'){units.delete(k);continue;}
   if(u.arrived&&u.kind==='guest'&&u.seat&&u.phase!=='leaving'){u.seated=true;u.heading=0;}
   if(u.arrived&&u.kind==='staff'&&u.phase==='working'){u.seated=!!u.seatHeight;u.heading=u.yaw;}
  }
  if(meeting){const a=units.get(meeting.staff),b=units.get(meeting.visitor);if(!a||!b||b.phase==='leaving'){if(a){a.bubble=null;a.phase='working';go(a,a.home);}meeting=null;}else if(meeting.phase==='approach'&&a.arrived&&b.arrived){meeting.phase='talk';meeting.time=0;}
   else if(meeting.phase==='talk'){a.heading=Math.atan2(b.position.x-a.position.x,b.position.z-a.position.z);b.heading=Math.atan2(a.position.x-b.position.x,a.position.z-b.position.z);const line=meeting.turns[meeting.index];if(!line){a.bubble=b.bubble=null;a.phase='working';go(a,a.home);const id=meeting.id,key=meeting.key;meeting=null;onMeetEnd(id,key);}else{a.bubble=b.bubble=null;const speaker=line.speakerId===a.id?a:line.speakerId===b.actorId?b:null;if(speaker)speaker.bubble=line.text;meeting.narration=speaker?'':line.text;meeting.time+=dt;if(meeting.time>Math.min(6,1.5+line.text.length*.045)){meeting.index++;meeting.time=0;}}}
  }
 }
 function resume(saved){for(const old of saved?.units||[]){const u=units.get(old.key);if(!u||!nav.walkable(old.position?.x,old.position?.z))continue;u.position={...old.position};u.seated=!!old.seated;u.phase=old.phase==='waiting-entry'?'queuing':old.phase;u.spawnAt=0;go(u,old.goal||u.target||u.home||u.position);}}
 return {units,reconcile,resume,step,finishClosing:()=>{closing=null;},playMeet,startClosing,get closingDone(){return !!closing&&closing.time>1.45&&![...units.values()].some(u=>u.kind==='staff');},get lampProgress(){return closing?Math.min(1,closing.time/1.5):0;},get closing(){return !!closing;},get meeting(){return meeting;},get narration(){return meeting?.narration||'';},snapshot:()=>({clock,closing:!!closing,meeting:meeting?{id:meeting.id,phase:meeting.phase,index:meeting.index}:null,units:[...units.values()].map(u=>({key:u.key,id:u.id,post:u.post,phase:u.phase,position:{...u.position},goal:u.goal,seated:!!u.seated,bubble:u.bubble||'',walking:!!u.path.length}))})};
}
