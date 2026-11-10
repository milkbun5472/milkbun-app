import {CAT_APPROACH,isPostalCat,stepCatVisit} from './cat-visit.mjs?v=fg-cde9b8759c1380df';
import {visitorSeat,windowSeat,SHOP_CHAIR,SHOP_BENCH} from './furniture.mjs?v=fg-cde9b8759c1380df';
import {STORY_ACTIONS,normalizeStoryAction} from '../fairy-garden/story-actions.mjs?v=fg-cde9b8759c1380df';
import {createStoryPlayback} from './playback.mjs?v=fg-cde9b8759c1380df';
import {createNavigator,segmentIntersectsRect} from '../fairy-garden/navigation.mjs?v=fg-cde9b8759c1380df';
import {stepRoute} from '../fairy-garden/locomotion.mjs?v=fg-cde9b8759c1380df';
export const ENTRY={x:3.32,z:4.7};
export const SHOP_FURNITURE=[{id:'Counter',x:-1.45,z:1.15,w:3.93,d:1.04},{id:'SortTable',x:-2.25,z:-2.5,w:2.8,d:.85},SHOP_CHAIR,{id:'DisplayShelves',x:-4.2,z:0,w:.45,d:6},{id:'Mailbags',x:4.05,z:2.45,w:.85,d:.55}];
export const queuePoint=i=>({x:-1.45+(Math.floor(i/3)%6)*.84,z:2.2+(Math.floor(i/18)%2?2-i%3:i%3)*.85});
export const visitorPoint=visitorSeat;
export const unitSeat=u=>u.seated?(u.performanceSeat||u.seat||(u.kind==='staff'&&u.seatHeight?windowSeat():null)):null;
export function shopNavigation(hasBench=true){
 const obstacles=SHOP_FURNITURE.concat(hasBench?[SHOP_BENCH]:[]);
 const walkable=(x,z)=>x>=-4.25&&x<=4.45&&z>=-3.12&&z<=5.1&&!obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.24&&Math.abs(z-o.z)<o.d/2+.24);
 const clear=(a,b,_m,avoid=[])=>walkable(b.x,b.z)&&!obstacles.some(o=>segmentIntersectsRect(a,b,o,.24))&&avoid.every(o=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/(dx*dx+dz*dz||1)));const nearest=Math.hypot(a.x+dx*t-o.x,a.z+dz*t-o.z),start=Math.hypot(a.x-o.x,a.z-o.z),end=Math.hypot(b.x-o.x,b.z-o.z);return nearest>=o.r||(start<o.r&&end>start+1e-6&&nearest>=start-1e-6);});
 const find=createNavigator({shop:{radius:6,walkRegions:[{polygon:[{x:-4.25,z:-3.12},{x:4.45,z:5.1}]}]}},walkable,clear,walkable,{step:.18});
 return {obstacles,walkable,clear,find:(a,b,avoid=[])=>find(a,b,'shop',avoid)};
}
export function createShopFlow({onMeetEnd=()=>{},onEvent=()=>{}}={}){
 const units=new Map(),seen=new Set(),seenCats=new Set();let nav=shopNavigation(),data=null,clock=0,closing=null,meeting=null,playback=null,spawn=0,idlePair=null,idleSerial=0,sceneBeat=null,lastTalk=null,storyLampOff=false,itemSerial=0;
 const key=s=>s.kind==='staff'?'staff:'+s.id:'guest:'+s.key;
 const staffById=id=>id==null?null:units.get('staff:'+id);
 const actorById=id=>staffById(id)||[...units.values()].find(u=>u.kind==='guest'&&u.actorId===id);
 const staff=()=>[...units.values()].filter(u=>u.kind==='staff'&&u.phase!=='leaving');
 const meetingMember=u=>!!u&&!!meeting&&(u.key===meeting.staff||u.key===meeting.visitor);
 const pending=()=>[...units.values()].some(u=>u.kind==='guest'&&!u.visitor&&!isPostalCat(u)&&u.phase!=='leaving');
 function go(u,target){u.goal={x:target.x,z:target.z};u.path=nav.find(u.position,u.goal)||[];u.arrived=Math.hypot(u.position.x-target.x,u.position.z-target.z)<.08;u.blocked=0;}
 function returnHome(u){u.phase='working';u.taskAction=null;u.bubble=null;u.letter=false;u.seated=false;u.performanceSeat=null;u.nextIdle=clock+15;go(u,u.home);}
 function depart(u,letter=false){if(isPostalCat(u)&&u.phase.startsWith('cat-')){u.catLeaving=true;return;}if(u.phase==='leaving')return;u.phase='leaving';u.letter=isPostalCat(u)?false:letter;u.bubble=null;u.seated=false;go(u,ENTRY);}
 function clearSpeech(){for(const u of units.values())u.bubble=null;}
 function cancelIdle(){if(idlePair){for(const id of idlePair.ids){const u=staffById(id);if(u&&u.phase.startsWith('idle'))returnHome(u);}idlePair=null;}for(const u of staff())if(u.phase.startsWith('idle'))returnHome(u);}
 function reconcile(next){
  if(next.closed||next.phase!=='open')cancelIdle();
  data=next;nav=shopNavigation(next.decor.some(d=>d.builder==='bench'));const wanted=new Set();let qi=0,vi=0;
  for(const source of next.staff){const k=key(source);wanted.add(k);let u=units.get(k);
   if(!u){const home={x:source.x,z:source.seatHeight?.15:source.z};u={key:k,...source,kind:'staff',position:{...home},phase:'working',path:[],arrived:true,heading:source.yaw,goal:home,seated:!!source.seatHeight,nextIdle:clock+8+staff().length*3};units.set(k,u);}
   else{const changed=u.post!==source.post;Object.assign(u,source);u.seatHeight=source.seatHeight||null;if(changed&&meeting?.staff!==k){cancelIdle();u.seated=false;u.phase='working';go(u,{x:source.x,z:source.seatHeight?.15:source.z});}}
   u.home={x:source.x,z:source.seatHeight?.15:source.z};
  }
  const customers=next.closed||next.phase!=='open'?[]:next.customers;
  for(const source of customers){const k=key(source);if(source.done){const u=units.get(k);if(isPostalCat(u)){u.catLeaving=true;wanted.add(k);continue;}if(u&&u.phase!=='leaving'){if(source.got>0&&!source.miss){onEvent({kind:'stamp',id:source.key});const clerk=staff().find(a=>a.post==='柜台');if(clerk){clerk.serviceUntil=clock+1.1;if(clerk.phase.startsWith('idle'))returnHome(clerk);}}depart(u,source.got>0&&!source.miss);}continue;}
   wanted.add(k);let u=units.get(k);if(isPostalCat(source)&&seenCats.has(k)&&!u)continue;const seat=source.visitor&&next.decor.some(d=>d.builder==='bench')&&vi<2?visitorPoint(vi++,next.decor.find(d=>d.builder==='bench')?.level):null,target=isPostalCat(source)?CAT_APPROACH:seat||queuePoint(qi++);
   if(!u){u={...source,key:k,position:{...ENTRY},phase:'waiting-entry',path:[],heading:Math.PI,spawnAt:clock+spawn*.8,goal:target};spawn++;units.set(k,u);}else Object.assign(u,source,{key:k});u.seat=seat;u.target={x:target.x,z:target.z};
   if(u.phase!=='waiting-entry'&&u.phase!=='leaving'&&!u.phase.startsWith('cat-')&&!meetingMember(u)&&!u.performing&&!u.partnerMotion&&!u.seated&&Math.hypot((u.goal?.x||0)-target.x,(u.goal?.z||0)-target.z)>.1)go(u,target);
  }
  for(const [k,u]of units)if(!wanted.has(k)&&u.phase!=='leaving')depart(u,false);
  if(!meeting&&!closing){const c=customers.find(c=>c.visitor&&c.meet?.length&&c.meetCast?.staffId&&!c.meetSeen&&!seen.has(c.key));if(c)playMeet(c.id);}
  spawn=0;
 }
 const visiblePosition=u=>{const seat=unitSeat(u);return seat?{x:seat.seatX,z:seat.seatZ}:u.position;};
 function nearby(u,target,distance=.68,seatExit=null){target={...target,position:visiblePosition(target)};const offsets=[0,.18,.36].flatMap(extra=>{const d=distance+extra,q=d*Math.SQRT1_2;return [[d,0],[-d,0],[0,d],[0,-d],[q,q],[-q,q],[q,-q],[-q,-q]];});return offsets.map(([x,z])=>({x:target.position.x+x,z:target.position.z+z})).find(p=>nav.walkable(p.x,p.z)&&(!seatExit||Math.hypot(p.x-seatExit.x,p.z-seatExit.z)>.65)&&nav.find(u.position,p)?.length)||u.position;}
 function presentTarget(actor,id){const target=actorById(id);return target&&target!==actor&&!['leaving','waiting-entry'].includes(target.phase)?target:null;}
 function meetingPartner(actor){if(meeting?.phase!=='talk'||!meetingMember(actor))return null;return units.get(actor.key===meeting.staff?meeting.visitor:meeting.staff)||null;}
 function facePair(a,b,parallel=false){
  if(!a||!b||a===b||[a,b].some(u=>['leaving','waiting-entry'].includes(u.phase)))return;const ap=visiblePosition(a),bp=visiblePosition(b),dx=bp.x-ap.x,dz=bp.z-ap.z;if(Math.hypot(dx,dz)<.01)return;
  if(a.arrived&&!a.path.length)a.heading=parallel?b.heading:Math.atan2(dx,dz);
  if(!parallel&&b.arrived&&!b.path.length)b.heading=Math.atan2(-dx,-dz);
 }
 function finishBeat(){
  if(!sceneBeat)return;const a=units.get(sceneBeat.actor),b=units.get(sceneBeat.target);if(a){a.storyMotion=null;a.performing=false;a.taskAction=null;if(a.phase!=='leaving'&&['pat','hand','lamp','sweep'].includes(sceneBeat.action)&&Math.hypot(a.position.x-sceneBeat.start.x,a.position.z-sceneBeat.start.z)>.15)go(a,meetingMember(a)?sceneBeat.start:a.home||a.target||sceneBeat.start);if(sceneBeat.priorSeat&&Math.hypot(a.position.x-sceneBeat.start.x,a.position.z-sceneBeat.start.z)<.15)a.seated=true;}if(b)b.partnerMotion=null;sceneBeat=null;
 }
 function freeSeat(actor){
  const seats=[...(data?.decor.some(d=>d.builder==='bench')?[0,1].map(i=>visitorPoint(i,data.decor.find(d=>d.builder==='bench')?.level)):[]),windowSeat()];
  return seats.filter(p=>![...units.values()].some(u=>u!==actor&&u.phase!=='leaving'&&((u.seated&&Math.hypot(visiblePosition(u).x-p.seatX,visiblePosition(u).z-p.seatZ)<.65)||(u.performanceSeat&&Math.hypot(u.performanceSeat.seatX-p.seatX,u.performanceSeat.seatZ-p.seatZ)<.65)||(u.post==='看店'&&u.seated&&p.piece==='WindowStool')))).sort((a,b)=>Math.hypot(actor.position.x-a.x,actor.position.z-a.z)-Math.hypot(actor.position.x-b.x,actor.position.z-b.z))[0]||null;
 }
 function showBeat(beat){
  finishBeat();clearSpeech();const actor=actorById(beat.actorId||beat.speakerId),target=presentTarget(actor,beat.targetId);if(!actor)return;
  let action=normalizeStoryAction(beat.action,!!target&&target!==actor&&target.phase!=='leaving'),seat=null;
  if(action==='sit'){seat=freeSeat(actor);if(!seat)action='talk';}
  const priorSeat=actor.seated;sceneBeat={actor:actor.key,target:target?.key,action,start:{...actor.position},priorSeat,time:0,transferred:false};
  actor.performing=true;actor.storyMotion={action,progress:0,seconds:STORY_ACTIONS[action].seconds,stage:'approach',giverSide:actor.letterHand||'right'};
  if(action!=='talk'&&!STORY_ACTIONS[action].emotion){actor.seated=false;actor.performanceSeat=null;}
  actor.taskAction=action;actor.phase=closing?'performing':actor.phase;
  if(action==='tidy')go(actor,actor.home||actor.position);
  else if(action==='look')go(actor,{x:.15,z:-2.05});
  else if(action==='rest'){seat=data?.decor.some(d=>d.builder==='bench')?visitorPoint(0,data.decor.find(d=>d.builder==='bench')?.level):null;actor.performanceSeat=seat;go(actor,seat||{x:2.3,z:-1.2});}
  else if(action==='sit'){actor.performanceSeat=seat;go(actor,seat);}
  else if(['help','pat','hand'].includes(action)&&target&&target!==actor){go(actor,nearby(actor,target,action==='pat'?.60:action==='hand'?.56:.68));if(action==='pat'||action==='hand')target.partnerMotion={action,actor:actor.key,progress:0};}
  else if(action==='sweep'&&!nav.walkable(actor.position.x+Math.sin(actor.heading||0)*.5,actor.position.z+Math.cos(actor.heading||0)*.5))go(actor,{x:1.08,z:1.98});
  else if(action==='lamp'&&data?.decor.some(d=>d.builder==='lamp'))go(actor,{x:1.26,z:.18});
  if(action==='letter'||action==='hand'){const wasHolding=actor.letter;actor.letter=true;actor.letterId ||= wasHolding?'letter:'+actor.key:'story-letter:'+actor.key+':'+(++itemSerial);}
  if(action==='talk'&&lastTalk?.id===actor.id&&lastTalk.line!==beat.line){let h=0;for(const c of actor.id+'|'+beat.line+'|'+beat.text)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;actor.storyMotion.idle=h%5===0?'nod':h%5===1?'tilt':null;}
  lastTalk=action==='talk'?{id:actor.id,line:beat.line}:null;
 }
 function stepAction(dt){
  if(!sceneBeat)return;const a=units.get(sceneBeat.actor),b=units.get(sceneBeat.target);if(!a)return;
  if(STORY_ACTIONS[sceneBeat.action].target&&(!b||b.phase==='leaving')){if(b)b.partnerMotion=null;sceneBeat.action='talk';a.taskAction='talk';a.storyMotion={action:'talk',progress:0,seconds:0,stage:'hold'};}
  const m=a.storyMotion;if(!m)return;
  if(!a.arrived){m.stage='approach';return;}
  sceneBeat.time+=dt;m.progress=Math.min(1,sceneBeat.time/(m.seconds||2));m.stage=m.progress>=1?'hold':'acting';
  if(b&&b.partnerMotion)b.partnerMotion.progress=m.progress;
  if(sceneBeat.action==='hand'&&b&&!sceneBeat.transferred&&m.progress>=.52){sceneBeat.transferred=true;b.letter=true;b.letterId=a.letterId;b.letterHand=m.giverSide==='left'?'right':'left';a.letter=false;a.letterId=null;onEvent({kind:'paper',id:'story:'+a.key+':'+clock});}
  if(sceneBeat.action==='lamp')a.heading=Math.PI;
  if(sceneBeat.action==='lamp'&&m.progress>=.55&&data?.decor.some(d=>d.builder==='lamp'))storyLampOff=true;
 }
 function updateSpeech(){
  clearSpeech();const beat=playback?.beat;if(!beat)return;const speaker=actorById(beat.speakerId);if(speaker)speaker.bubble=beat.text;
  const actor=actorById(beat.actorId||beat.speakerId),target=presentTarget(actor,beat.targetId),action=sceneBeat?.action||'talk';
  if(action==='pat')facePair(actor,target,true);
  else if(!['tidy','look','rest','sit','sweep','lamp'].includes(action)){
   if(actor)facePair(actor,target||meetingPartner(actor));
   else if(meeting?.phase==='talk')facePair(units.get(meeting.staff),units.get(meeting.visitor));
  }
  if(actor?.arrived&&['rest','sit'].includes(sceneBeat?.action)&&actor.performanceSeat){actor.seated=true;actor.heading=actor.performanceSeat.heading||0;}
 }
 function playMeet(id){
  const c=data?.customers.find(c=>c.id===id),a=c&&staffById(c.meetCast?.staffId),b=c&&units.get('guest:'+c.key);if(!a||!b||b.phase==='leaving'||closing||meeting)return false;
  cancelIdle();seen.add(c.key);meeting={key:c.key,id,staff:a.key,visitor:b.key,phase:'approach',approaching:false};a.phase='meeting';go(a,a.home);return true;
 }
 function startMeetSpeech(){
  const c=data.customers.find(c=>c.id===meeting.id),a=units.get(meeting.staff),b=units.get(meeting.visitor);meeting.phase='talk';lastTalk=null;
  facePair(a,b);
  playback=createStoryPlayback({turns:c.meetTurns,lines:c.meet,onBeat:showBeat,onEnd:()=>{finishBeat();storyLampOff=false;clearSpeech();const done=meeting;if(a)returnHome(a);if(b&&b.phase!=='leaving'){b.performing=false;b.performanceSeat=null;b.seated=false;go(b,b.target);}meeting=null;playback=null;if(done)onMeetEnd(done.id,done.key);}});
 }
 function startTidying(){
  finishBeat();playback=null;clearSpeech();closing.phase='tidy';closing.time=0;
  for(const u of staff()){u.phase='tidy-return';u.seated=false;u.taskAction='tidy';u.letter=false;go(u,u.home);}
 }
 function startClosing(story={}){
  if(closing)return;cancelIdle();meeting=null;playback=null;closing={time:0,phase:'story'};clearSpeech();for(const u of units.values())if(u.kind==='guest')depart(u,false);else{u.phase='performing';u.path=[];u.arrived=true;u.seated=false;}
  const beats=story.turns?.length||story.lines?.length;
  if(beats)playback=createStoryPlayback({turns:story.turns,lines:story.lines,onBeat:showBeat,onEnd:startTidying});else startTidying();
 }
 function stepIdle(dt){
  if(closing||meeting||!data||data.ambient===false||data.closed||data.phase!=='open')return;
  if(idlePair){const pair=idlePair.ids.map(staffById);if(pair.some(u=>!u||u.phase==='leaving')||pending()&&pair.some(u=>u?.post==='柜台')){cancelIdle();return;}
   if(pair.every(u=>u.arrived)){idlePair.time+=dt;facePair(pair[0],pair[1]);for(const u of pair)u.taskAction='handover';pair[0].letter=idlePair.time<1.8;pair[1].letter=idlePair.time>=1.8;if(!idlePair.sounded&&idlePair.time>=1.8){idlePair.sounded=true;onEvent({kind:'paper',id:idlePair.ids.join(':')+':'+idleSerial});}if(idlePair.time>3.8)cancelIdle();}return;
  }
  const active=staff().find(u=>u.phase==='idle-walk'||u.phase==='idle-look');if(active){if(active.post==='柜台'&&pending()){returnHome(active);return;}if(active.arrived){active.phase='idle-look';active.idleTime=(active.idleTime||0)+dt;active.heading=active.idleYaw||0;if(active.idleTime>3.5)returnHome(active);}return;}
  const free=staff().filter(u=>u.phase==='working'&&u.arrived&&clock>u.nextIdle&&!(u.post==='柜台'&&pending()));if(!free.length)return;
  idleSerial++;const a=free[0],b=staff().find(u=>u!==a&&u.phase==='working'&&u.arrived&&!(u.post==='柜台'&&pending()));
  if(b&&idleSerial%2===0){const center={x:.75,z:-.3};idlePair={ids:[a.id,b.id],time:0};for(const [i,u]of [a,b].entries()){u.phase='idle-chat';u.seated=false;u.taskAction=null;go(u,{x:center.x+i*.7,z:center.z});}return;}
  const places=[{x:.15,z:-2.05,yaw:Math.PI},{x:2.1,z:-1.25,yaw:Math.PI},{x:3.65,z:2.8,yaw:.2}],to=places[(idleSerial-1)%places.length];a.phase='idle-walk';a.taskAction='look';a.seated=false;a.idleTime=0;a.idleYaw=to.yaw;go(a,to);
 }
 function step(dt){
  dt=Math.max(0,Math.min(.1,dt));clock+=dt;
  if(closing?.phase==='tidy'){closing.time+=dt;for(const u of staff()){if(u.phase==='tidy-return'&&u.arrived){u.phase='tidying';u.tidyTime=0;}if(u.phase==='tidying'){u.tidyTime+=dt;if(u.tidyTime>1.45)depart(u,false);}}}
  for(const [k,u]of units){
   if(u.phase==='waiting-entry'){if(clock<u.spawnAt||[...units.values()].some(v=>v!==u&&(v.phase==='leaving'||v.phase!=='waiting-entry'&&Math.hypot(v.position.x-ENTRY.x,v.position.z-ENTRY.z)<.75)))continue;u.phase='queuing';u.enteredAt=clock;onEvent({kind:'door',id:u.key+':in'});go(u,u.target);}
   if(!u.path.length&&!u.arrived&&u.goal&&u.phase!=='waiting-entry'&&u.phase!=='tidying'){u.blocked=(u.blocked||0)+dt;if(u.blocked>.7){u.path=nav.find(u.position,u.goal,[...units.values()].filter(v=>v!==u&&v.phase!=='waiting-entry').map(v=>({...visiblePosition(v),r:.55})))||[];u.blocked=0;}}
   if(u.path.length){const others=[...units.values()].filter(v=>v!==u&&v.phase!=='waiting-entry').map(v=>({...visiblePosition(v),r:.55})),next=stepRoute(u.position,u.path,dt,{walkSpeed:isPostalCat(u)?1.35:u.npcStyle==='rare_bride'?1.85:u.look?.npcFeature==='cane'?.8:u.visitor?1.05:1.3,clear:(a,b)=>nav.clear(a,b,'shop')&&others.every(v=>Math.hypot(b.x-v.x,b.z-v.z)>=.55||Math.hypot(a.x-v.x,a.z-v.z)<Math.hypot(b.x-v.x,b.z-v.z))}),stopped=u.path.length&&Math.hypot(next.position.x-u.position.x,next.position.z-u.position.z)<1e-5;u.position=next.position;if(next.heading!=null)u.heading=next.heading;
    if(next.blocked||stopped){u.blocked=(u.blocked||0)+dt;if(u.blocked>.7){u.path=nav.find(u.position,u.goal,others.map(o=>({...o,r:Math.min(.6,Math.max(.1,Math.hypot(o.x-u.position.x,o.z-u.position.z)-.025))})))||[];u.blocked=0;}}
    u.arrived=!u.path.length&&Math.hypot(u.position.x-u.goal.x,u.position.z-u.goal.z)<.12;
   }
   stepCatVisit(u,dt,{go});
   if(u.phase==='leaving'&&Math.hypot(u.position.x-ENTRY.x,u.position.z-ENTRY.z)<.65){onEvent({kind:'door',id:u.key+':out'});if(isPostalCat(u))seenCats.add(k);units.delete(k);continue;}
   if(u.arrived&&u.kind==='guest'&&u.seat&&!u.performing&&!(meeting?.phase==='talk'&&meetingMember(u))&&u.phase!=='leaving'){u.seated=true;u.heading=0;}
   if(u.arrived&&u.kind==='staff'&&u.phase==='working'){u.seated=!!u.seatHeight;u.heading=u.yaw;}
  }
  if(meeting){const a=units.get(meeting.staff),b=units.get(meeting.visitor);if(!a||!b||a.phase==='leaving'||b.phase==='leaving'){finishBeat();clearSpeech();if(a&&a.phase!=='leaving')returnHome(a);if(b&&b.phase!=='leaving'){b.performing=false;b.performanceSeat=null;b.seated=false;go(b,b.target);}meeting=null;playback=null;}else if(meeting.phase==='approach'&&b.arrived){if(!meeting.approaching){meeting.approaching=true;a.seated=false;go(a,nearby(a,b,.85,b.seated?b.position:null));}if(a.arrived)startMeetSpeech();}}
  if(playback){stepAction(dt);updateSpeech();const actor=actorById(playback.beat?.actorId||playback.beat?.speakerId);playback.step(dt,!actor||actor.arrived&&(!actor.storyMotion?.seconds||actor.storyMotion.progress>=1));}
  stepIdle(dt);
 }
 function resume(saved){
  for(const key of saved?.seenCats||[]){seenCats.add(key);const u=units.get(key);if(isPostalCat(u))units.delete(key);}
  for(const old of saved?.units||[]){const u=units.get(old.key);if(!u)continue;if(Number.isFinite(old.entryAge))u.enteredAt=clock-old.entryAge;
   if(isPostalCat(u)&&old.phase?.startsWith('cat-')){Object.assign(u,{position:{...old.position},phase:old.phase,catHeight:old.catHeight||0,catTime:old.catTime||0,catFrom:old.catFrom||null,catLeafDropped:!!old.catLeafDropped,path:[],arrived:true});continue;}
   if(!nav.walkable(old.position?.x,old.position?.z))continue;u.position={...old.position};if(isPostalCat(u)&&old.catLeafDropped)u.catLeafDropped=true;u.seated=!!old.seated;u.phase=old.phase==='waiting-entry'?'queuing':old.phase;u.spawnAt=0;
   if(u.kind==='staff'&&(u.phase.startsWith('idle')||['performing','tidying','tidy-return','meeting'].includes(u.phase)))returnHome(u);else go(u,old.goal||u.target||u.home||u.position);
  }
 }

 const performance=()=>playback?.beat?{kind:closing?'closing':'meet',index:playback.index,total:playback.total,text:playback.beat.text,speakerId:playback.beat.speakerId,actorId:playback.beat.actorId,action:sceneBeat?.action||'talk',progress:units.get(sceneBeat?.actor)?.storyMotion?.progress||0,stage:units.get(sceneBeat?.actor)?.storyMotion?.stage||'hold'}:null;
 return {units,reconcile,resume,step,playMeet,startClosing,nextBeat:()=>playback?.next(),skipStory:()=>playback?.finish(),finishClosing:()=>{finishBeat();closing=null;playback=null;storyLampOff=false;},get time(){return clock;},get storyLampOff(){return storyLampOff;},get closingDone(){return closing?.phase==='tidy'&&closing.time>1.45&&![...units.values()].some(u=>u.kind==='staff');},get lampProgress(){return closing?.phase==='tidy'?Math.min(1,closing.time/1.5):0;},get closing(){return !!closing;},get meeting(){return meeting;},get narration(){const beat=playback?.beat;return beat&&!actorById(beat.speakerId)?beat.text:'';},get performance(){return performance();},snapshot:()=>({clock,seenCats:[...seenCats],closing:!!closing,performance:performance(),idlePair:idlePair?.ids||null,meeting:meeting?{id:meeting.id,phase:meeting.phase,index:playback?.index||0}:null,units:[...units.values()].map(u=>({key:u.key,id:u.id,post:u.post,phase:u.phase,position:{...u.position},goal:u.goal,seated:!!u.seated,bubble:u.bubble||'',letter:!!u.letter,letterId:u.letterId||null,storyMotion:u.storyMotion||null,partnerMotion:u.partnerMotion||null,action:u.taskAction||'',walking:!!u.path.length,catLeafDropped:!!u.catLeafDropped,catHeight:u.catHeight||0,catTime:u.catTime||0,catFrom:u.catFrom||null,entryAge:Number.isFinite(u.enteredAt)?clock-u.enteredAt:null}))})};
}
