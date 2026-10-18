import {residentRoomForm} from './resident-workroom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {restoreResidentWork,createResidentWork} from './resident-work.mjs';
import {workKey,workEvent,restoreWorkLife} from './resident-work-life.mjs';
import {deriveResidentPreferences} from './resident-choice.mjs';
import {createTownLife,newTownLife} from './town-life.mjs';
import {restoreNeighborhood,createNeighborhood} from './neighborhood.mjs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
const world=createPetWorld(JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))));
function fixture({raw,people=false,persona='安静，细心，有耐心，喜欢读书'}={}){
 const state=restoreResidentWork(raw,'ta'),body=newTownLife('home',{x:0,z:2.4},77),person={id:'ta',name:'阿澄',persona};let at=new Date(2026,9,19,9).getTime(),fail=false,neighborhood,obstacles=[];
 const context={preferences:deriveResidentPreferences(person).scores,pets:[],viewerPlace:'home'};
 const actors=()=>[...obstacles,{id:'companion:ta',kind:'person',size:1.6,place:body.place,position:body.position},...Object.entries(neighborhood?.state.neighbors||{}).map(([id,n])=>({id:'neighbor:'+id,kind:'person',size:1.6,place:n.town.place,position:n.town.position}))];
 const town=createTownLife(body,{world,size:()=>1.4,roomVariant:()=>residentRoomForm(state),actor:()=>({id:'companion:ta',kind:'person',size:1.6}),actors});
 const engine=createResidentWork(state,{town,world,person,getContext:()=>context,now:()=>at,save:()=>!fail});
 if(people){neighborhood=createNeighborhood(restoreNeighborhood(null,[]),{world,getRows:()=>[],getActors:actors,getTime:()=>({at,date:[new Date(at).getFullYear(),String(new Date(at).getMonth()+1).padStart(2,'0'),String(new Date(at).getDate()).padStart(2,'0')].join('-'),minute:new Date(at).getHours()*60+new Date(at).getMinutes(),weekday:new Date(at).getDay()}),getWorkActivity:()=>engine.peerPlan(),getWorkroomForm:()=>residentRoomForm(state),save:()=>!fail});context.neighbors=neighborhood.state.neighbors;context.neighborFree=id=>neighborhood.canWorkMeet(id);}
 const f={state,body,town,engine,context,set obstacles(v){obstacles=v;},get at(){return at;},set at(v){at=v;},set fail(v){fail=v;},neighborhood,step(dt=.1){at+=dt*1000;const r=engine.tick(dt,at);neighborhood?.tick(dt);return r;},drive(test,max=20000){for(let i=0;i<max;i++){if(test())return;i%100===0&&assert.ok(Number.isFinite(at));f.step();}assert.fail('native activity did not finish '+JSON.stringify({shift:state.shift,life:state.life,body}));},setup(role='writer',extra={}){assert.ok(engine.request('configure',{slot:'primary',role,days:[0,1,2,3,4,5,6],start:540,end:720,...extra}).accepted);},complete(){assert.ok(engine.request('trial').accepted);f.drive(()=>!state.shift);return structuredClone(state);},nextDay(){engine.releaseLeisure();at+=86400000;state.fatigue=0;state.at=at;}};return f;
}
test('old canonical human work archives gain an isolated life record; another owner receives none of its people or career choices',()=>{
 const f=fixture();f.setup();f.complete();const saved=structuredClone(f.state),again=restoreResidentWork(saved,'ta');assert.deepEqual(again.life,saved.life);assert.ok(again.life.projects.writer);const other=restoreResidentWork(saved,'another');assert.equal(other.life.events.length,0);assert.equal(other.life.after,null);assert.equal(other.balance,0);assert.deepEqual(restoreWorkLife({paths:{x:{mode:'invalid'}},careStyle:'invalid'}).paths,{});
});
test('three real shifts produce a project with preparation, production, revisions and delivery plus the choices actually made',()=>{
 const f=fixture();f.setup();assert.ok(f.engine.request('trial').accepted);f.drive(()=>f.engine.view().life.pending);const event=f.engine.view().life.pending;const before=structuredClone(f.state.life);f.fail=true;assert.equal(f.engine.request('work-choice',{id:event.id,option:event.options[0].id}).accepted,false);assert.deepEqual(f.state.life,before);f.fail=false;assert.ok(f.engine.request('work-choice',{id:event.id,option:event.options[0].id}).accepted);assert.equal(f.engine.request('work-choice',{id:event.id,option:event.options[0].id}).accepted,false);f.drive(()=>!f.state.shift);
 for(let i=0;i<2;i++){f.nextDay();f.complete();}const w=f.state.works[0],p=f.state.life.projects.writer;assert.equal(p.done,3);assert.equal(w.steps.length,4);assert.ok(w.process.some(x=>x.id===event.id));assert.equal(p.history.filter(h=>h.id.endsWith(':trial')).length,3);assert.equal(f.state.earned,36);assert.ok(Object.values(f.state.life.bonds).some(x=>x.contacts>0));
});
test('the same unresolved work event follows different personality and energy preferences and remains resolved after reopening',()=>{
 const f=fixture();f.setup();f.engine.request('trial');f.drive(()=>f.engine.view().life.pending);const a=structuredClone(f.state),b=structuredClone(f.state),s=a.shift,t=b.shift;
 const outgoing=deriveResidentPreferences({persona:'热情外向，喜欢探索，喜欢帮忙，温柔有耐心'}).scores,quiet=deriveResidentPreferences({persona:'喜欢安静独处，谨慎，慢生活，不喜欢社交'}).scores;
 b.fatigue=90;workEvent(a,s,outgoing,f.at,{automatic:true});workEvent(b,t,quiet,f.at,{automatic:true});assert.notEqual(a.life.events[0].selected,b.life.events[0].selected);const again=restoreResidentWork(a,'ta');const count=again.life.bonds[again.life.events[0].peer].contacts;workEvent(again,again.shift,outgoing,f.at,{automatic:true});assert.equal(again.life.bonds[again.life.events[0].peer].contacts,count);
});
test('work acquaintances use the original neighbor route and record a meeting only after both actually stand together',()=>{
 const f=fixture({people:true});const petBonds=structuredClone(f.neighborhood.state.neighbors.baker.met);assert.ok(f.engine.request('meet-colleague',{peer:'baker'}).accepted);assert.equal(f.state.life.bonds.baker.meets,0);const begin={...f.body.position};f.step();assert.notDeepEqual(f.body.position,begin);assert.equal(f.state.life.bonds.baker.meets,0);f.drive(()=>!f.state.life.meeting);assert.equal(f.state.life.bonds.baker.meets,1);const n=f.neighborhood.state.neighbors.baker.town;assert.equal(f.body.place,n.place);assert.ok(Math.hypot(f.body.position.x-n.position.x,f.body.position.z-n.position.z)<3.2);assert.deepEqual(f.neighborhood.state.neighbors.baker.met,petBonds);
});
test('a work partner physically comes to the actual workroom without interrupting a pet appointment',()=>{
 const f=fixture({people:true});f.setup('doctor');f.engine.request('trial');f.drive(()=>f.state.shift?.phase==='work');assert.ok(f.engine.request('invite-colleague',{peer:'regular'}).accepted);const start={...f.neighborhood.state.neighbors.regular.town.position};assert.equal(f.state.life.bonds.regular.meets,0);f.drive(()=>f.state.life.contact?.phase==='done');assert.equal(f.state.life.bonds.regular.meets,1);assert.notDeepEqual(f.neighborhood.state.neighbors.regular.town.position,start);assert.equal(f.neighborhood.state.neighbors.regular.town.place,'workroom');
});
test('after work purchases require real shop arrival, spend the human wage once, roll back a failed write, then visibly return home',()=>{
 const f=fixture();f.setup();for(let i=0;i<3;i++){f.complete();f.nextDay();}f.engine.request('care-style',{kind:'flowers'});f.complete();assert.equal(f.state.balance,48);assert.equal(f.state.life.after.kind,'flowers');f.drive(()=>f.state.life.after.phase==='shopping'&&f.state.life.after.time>=4.7);assert.equal(f.body.place,'florist');const before=structuredClone(f.state);f.fail=true;for(let i=0;i<5;i++)f.step();assert.equal(f.state.balance,before.balance);assert.equal(f.state.ledger.length,before.ledger.length);f.fail=false;f.drive(()=>f.state.life.after.purchased);assert.equal(f.state.balance,36);assert.equal(f.state.gifts.filter(x=>x.source==='TA收工后顺路准备').length,0);f.drive(()=>f.state.life.after.phase==='done');assert.equal(f.body.place,'home');assert.equal(f.state.ledger.filter(x=>x.title==='顺路带一束花').length,1);assert.equal(f.state.gifts.filter(x=>x.source==='TA收工后顺路准备').length,1);
});
test('an explicit after-work response waits for home presence and finishes the actual scene before its record',()=>{
 const f=fixture();f.setup();f.complete();assert.equal(f.state.life.after.phase,'waiting');f.context.viewerPlace='outside';assert.equal(f.engine.request('after-response',{kind:'listen'}).accepted,false);f.context.viewerPlace='home';assert.ok(f.engine.request('after-response',{kind:'listen'}).accepted);assert.ok(!f.state.notes.some(x=>x.kind==='afterwork'));f.drive(()=>f.state.life.after.phase==='done');assert.ok(f.state.notes.some(x=>x.kind==='afterwork'&&x.text.includes('你听TA')));
});
test('career paths unlock from actual shifts, a private shop pays its setup once and uses the native business workroom',()=>{
 const f=fixture();f.setup('barista');f.engine.request('care-style',{kind:'none'});assert.equal(f.engine.request('career-direction',{mode:'mentor'}).accepted,false);for(let i=0;i<12;i++){f.complete();f.nextDay();}assert.equal(f.state.skills.barista.shifts,12);assert.ok(f.engine.request('career-direction',{mode:'selective'}).accepted);assert.ok(f.engine.request('career-direction',{mode:'independent',name:'阿澄的咖啡小铺'}).accepted);assert.equal(f.state.balance,24);assert.ok(f.engine.request('career-direction',{mode:'steady'}).accepted);assert.ok(f.engine.request('career-direction',{mode:'independent'}).accepted);assert.equal(f.state.balance,24);assert.ok(f.engine.request('trial').accepted);f.drive(()=>f.state.shift?.phase==='work');assert.equal(f.body.place,'workroom');assert.equal(f.state.shift.contract.form,'business');assert.equal(f.state.shift.contract.title,'阿澄的咖啡小铺');assert.equal(f.state.shift.skillKey,'barista');
});
test('a rest period keeps both contracts and blocks automatic offline attendance until its local calendar date',()=>{
 const f=fixture();f.setup();f.engine.request('automatic',{enabled:true});f.engine.request('career-rest',{days:3});assert.equal(f.engine.request('trial').accepted,false);const pause=f.state.life.pauseUntil;f.at=pause-60000;f.engine.recover(f.at);assert.equal(f.state.ledger.length,0);assert.equal(f.state.primary.role,'writer');f.engine.request('career-resume');f.at=new Date(2026,9,22,10).getTime();f.state.at=f.at;f.step();assert.ok(f.state.shift);
});
test('offline work advances projects and work correspondence locally without inventing visits, gifts, companionship or mentor meetings',()=>{
 const f=fixture();f.setup('doctor');f.engine.request('automatic',{enabled:true});f.at=new Date(2026,9,19,18).getTime();assert.ok(f.engine.recover(f.at).accepted);assert.equal(f.state.ledger.filter(x=>x.kind==='income').length,1);assert.ok(f.state.life.events[0].selected);assert.ok(Object.values(f.state.life.bonds).every(x=>x.meets===0));assert.ok(!f.state.notes.some(x=>['colleague','care','mentor','afterwork'].includes(x.kind)));assert.equal(f.state.life.contact,null);const balance=f.state.balance;f.engine.recover(f.at);assert.equal(f.state.balance,balance);
});

test('an occupied remote work target chooses a reachable clear spot without throwing or counting work at the door',()=>{
 const f=fixture();f.setup('doctor');const blocker={id:'visitor',kind:'person',size:1.6,place:'workroom',position:{x:-1.5,z:-.48}};f.obstacles=[blocker];f.engine.request('trial');assert.doesNotThrow(()=>f.step());assert.equal(f.state.shift.worked,0);f.drive(()=>f.state.shift?.phase==='work');assert.equal(f.body.place,'workroom');assert.ok(Math.hypot(f.body.position.x-blocker.position.x,f.body.position.z-blocker.position.z)>=.77);assert.ok(f.town.nav().walkable(f.body.position.x,f.body.position.z));
});
test('a fully occupied resting area waits, records no false rest, and resumes only after a real walk when it clears',()=>{
 const f=fixture();f.setup();f.complete();f.town.sync('home',{x:0,z:3.1},0,{manual:true});f.obstacles=[[-.65,-.1],[-1.3,.55],[0,.55],[-.65,1.2]].map(([x,z],i)=>({id:'dog-'+i,kind:'pet',species:'dog',size:1.3,weight:1.2,place:'home',position:{x,z}}));
 for(let i=0;i<400;i++)assert.equal(!!f.step().seated,false);assert.equal(f.state.life.after.phase,'waiting');assert.equal(f.state.life.after.time,0);assert.ok(!f.state.notes.some(n=>n.kind==='afterwork'));assert.deepEqual(f.body.position,{x:0,z:3.1});
 f.obstacles=[];f.drive(()=>f.state.life.after.phase==='doing');assert.ok(Math.hypot(f.body.position.x,f.body.position.z-3.1)>1);assert.ok(!f.state.notes.some(n=>n.kind==='afterwork'));f.drive(()=>f.state.life.after.phase==='done');assert.equal(f.state.notes.filter(n=>n.kind==='afterwork').length,1);
});
test('working, greeting and arriving turn at the same physical rate as walking instead of snapping the body',()=>{
 const f=fixture({people:true});f.setup('doctor');f.engine.request('trial');let maximum=0,invited=false;
 while(f.state.shift){const old=f.body.heading;f.step();const delta=Math.abs(Math.atan2(Math.sin(f.body.heading-old),Math.cos(f.body.heading-old)));maximum=Math.max(maximum,delta);assert.ok(delta<=.300001,'body yaw jumped '+delta);if(!invited&&f.state.shift?.phase==='work'){assert.ok(f.engine.request('invite-colleague',{peer:'regular'}).accepted);invited=true;}}
 assert.ok(maximum>.1);assert.equal(f.state.life.bonds.regular.meets,1);
});
test('the clinic remains the same room for a colleague leaving after the meeting and after the shift ends',()=>{
 const f=fixture({people:true});f.setup('doctor');f.engine.request('trial');f.drive(()=>f.state.shift?.phase==='work');f.engine.request('invite-colleague',{peer:'regular'});f.drive(()=>f.state.life.contact?.phase==='done');const peer=f.neighborhood.state.neighbors.regular.town;let walked=0,last={...peer.position};
 for(let i=0;i<2200&&peer.place==='workroom';i++){f.step();if(peer.place==='workroom'){const nav=f.town.nav('workroom');assert.ok(nav.walkable(peer.position.x,peer.position.z),'visitor crossed clinic furniture');walked+=Math.hypot(peer.position.x-last.x,peer.position.z-last.z);last={...peer.position};}}
 assert.notEqual(peer.place,'workroom');assert.ok(walked>1);f.drive(()=>!f.state.shift);assert.equal(residentRoomForm(f.state),'clinic');assert.equal(residentRoomForm(restoreResidentWork(f.state,'ta')),'clinic');f.engine.releaseLeisure();f.setup('barista');assert.equal(residentRoomForm(f.state),'clinic');
});

test('changing an unaccompanied rest into sharing actually walks to the company space before the new sitting timer',()=>{
 const f=fixture();f.setup();f.complete();f.drive(()=>f.state.life.after.phase==='doing');const old={...f.body.position};assert.ok(f.engine.request('after-response',{kind:'listen'}).accepted);f.drive(()=>f.state.life.after.phase==='doing');assert.ok(Math.hypot(old.x-f.body.position.x,old.z-f.body.position.z)>.4);assert.ok(!f.state.notes.some(n=>n.kind==='afterwork'));f.drive(()=>f.state.life.after.phase==='done');assert.equal(f.state.notes.filter(n=>n.kind==='afterwork').length,1);
});

test('the arriving work partner turns toward the worker smoothly before the actual conversation finishes',()=>{
 const f=fixture({people:true});f.setup('doctor');f.engine.request('trial');f.drive(()=>f.state.shift?.phase==='work');assert.ok(f.engine.request('invite-colleague',{peer:'regular'}).accepted);const t=f.neighborhood.state.neighbors.regular.town;let checked=0;
 for(let i=0;i<4000&&f.state.life.contact?.phase!=='done';i++){const old=t.heading,place=t.place;f.step();if(place===t.place){const delta=Math.abs(Math.atan2(Math.sin(t.heading-old),Math.cos(t.heading-old)));assert.ok(delta<=.300001,'colleague yaw jumped '+delta);}if(f.state.life.contact?.phase==='talking'&&f.state.life.contact.time>2){const heading=Math.atan2(f.body.position.x-t.position.x,f.body.position.z-t.position.z);assert.ok(Math.abs(Math.atan2(Math.sin(heading-t.heading),Math.cos(heading-t.heading)))<.3);checked++;}}
 assert.ok(checked>0);assert.equal(f.state.life.bonds.regular.meets,1);
});
