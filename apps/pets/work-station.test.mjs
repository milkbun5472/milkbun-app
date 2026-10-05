import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {petWorkStation} from './work-station.mjs';
import {createPetCareer} from './career.mjs';
import {createPetCare} from './care.mjs';
import {createTownLife,newTownLife,roomDoor} from './town-life.mjs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
import {restorePetState,snapshotPetState,projectActivePet} from './state.mjs';
import {recoverPetLife} from './routine.mjs';
import {restoreClock} from '../fairy-garden/real-clock.mjs';
const world=createPetWorld(JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),shops=['bakery','florist','store','cafe','alley'];
function setup(profession,{size=1,species='cat',weight=1.25,actors=()=>[],saved}={}){
 const town=createTownLife(saved?.town||newTownLife(profession,roomDoor(profession),17),{world,size:()=>size,actor:()=>({id:'pet-1',kind:'pet',species,size,weight}),actors});
 const care=createPetCare(saved?.care||{energy:100,satiety:90,mood:100,rng:1});
 const career=createPetCareer(saved?.career||{selected:profession,rng:1},{workStation:job=>petWorkStation(job,town.nav(profession),town.state.place===profession?town.state.position:null)});
 const ctx=()=>({care:care.state,room:town.state.place,position:town.state.position});
 return {town,care,career,ctx};
}
function walkToWork(f){
 const {town,career}=f;assert.equal(town.go(career.destination(),career.destinationPoint(),{manual:true}),true);
 for(let i=0;i<800&&!career.atDestination(f.ctx());i++){
  const before=career.state.job.time;town.tick(.1,{stayHome:true,position:town.state.position,heading:town.state.heading});
  if(!career.atDestination(f.ctx())){career.tick(.1,f.ctx());assert.equal(career.state.job.time,before,'door/travel cannot earn work time');}
 }
 assert.ok(career.atDestination(f.ctx()));assert.ok(distance(town.state.position,roomDoor(town.state.place))>1.5);
}
test('both pet sizes really walk from each of five shop doors and between all three work stages before earning work',()=>{
 for(const profession of shops)for(const species of ['cat','dog'])for(const size of [1,1.3]){
  const f=setup(profession,{species,size});assert.equal(f.career.request('invite',{},f.ctx()).accepted,true);const door={...f.town.state.position};
  f.career.tick(1,f.ctx());assert.equal(f.career.state.job.time,0);assert.equal(f.career.atDestination(f.ctx()),false);
  for(let stage=0;stage<3;stage++){
   const before={...f.town.state.position};walkToWork(f);assert.ok(distance(before,f.town.state.position)>.3);
   for(let i=0;i<14&&f.career.state.job.phase==='working';i++)f.career.tick(1,f.ctx());
   assert.equal(f.career.state.job.phase,'choice');assert.ok(distance(f.town.state.position,door)>1.5);
   const event=f.career.summary().event;assert.equal(f.career.request('choose',{eventId:event.id,choice:event.options[0].id},f.ctx()).accepted,true);
  }
  assert.equal(f.career.state.job.phase,'ready');assert.equal(f.career.state.balance,0);
  if(profession==='alley'){const e=f.career.summary().event;if(e)f.career.request('choose',{eventId:e.id,choice:'leave'},f.ctx());}
  const finish=f.career.request('finish',{},f.ctx());assert.equal(finish.accepted,true);const wage=f.career.state.balance;assert.ok(wage>0);assert.equal(f.career.request('finish',{},f.ctx()).accepted,false);assert.equal(f.career.state.balance,wage);
 }
});
test('a real pending route and job survive a writer round trip without earning time at the door',()=>{
 const f=setup('bakery');f.career.request('invite',{},f.ctx());f.town.go('bakery',f.career.destinationPoint(),{manual:true});for(let i=0;i<12;i++)f.town.tick(.1,{stayHome:true,position:f.town.state.position});
 const saved=JSON.parse(JSON.stringify({town:f.town.state,care:f.care.snapshot(),career:f.career.snapshot()})),g=setup('bakery',{saved});
 assert.equal(g.career.state.job.id,f.career.state.job.id);assert.equal(g.career.state.job.time,0);
 for(let i=0;i<800&&!g.career.atDestination(g.ctx());i++)g.town.tick(.1,{stayHome:true,position:g.town.state.position});
 assert.ok(g.career.atDestination(g.ctx()));assert.equal(g.career.state.job.time,0);g.career.tick(1,g.ctx());assert.equal(g.career.state.job.time,1);
});
test('an occupied work spot uses a reachable alternative; a full work area waits and earns nothing',()=>{
 const normal=setup('bakery');normal.career.request('invite',{},normal.ctx());const p=normal.career.destinationPoint();
 const other={id:'ta',kind:'person',size:1.6,place:'bakery',position:p};const f=setup('bakery',{actors:()=>[other]});f.career.request('invite',{},f.ctx());const q=f.career.destinationPoint();assert.ok(q);assert.ok(distance(p,q)>=.8);walkToWork(f);
 const blocked=setup('bakery',{actors:()=>[{...other,size:30}]});blocked.career.request('invite',{},blocked.ctx());assert.equal(blocked.career.destinationPoint(),null);assert.equal(blocked.career.atDestination(blocked.ctx()),false);for(let i=0;i<60;i++)blocked.career.tick(1,blocked.ctx());assert.equal(blocked.career.state.job.time,0);assert.equal(blocked.career.state.balance,0);
});
test('offline recovery walks to the same actual work spot, waits for a choice and preserves the job and birthday',()=>{
 const at=new Date('2026-10-04T21:07:00').getTime(),s=restorePetState({configured:true,profile:{name:'团子',species:'dog'},room:'bakery',outdoor:{position:world.building('bakery').approach},care:{energy:100,satiety:90,mood:100,rng:1}},world,{at,random:()=>.5}),entry=s.pets[0];
 s.clock=restoreClock(null,1,at);entry.town=newTownLife('bakery',roomDoor('bakery'),17);entry.life.at=at;
 const f=setup('bakery');assert.equal(f.career.request('invite',{},f.ctx()).accepted,true);entry.career=f.career.snapshot();entry.care=f.care.snapshot();projectActivePet(s);
 const archive=snapshotPetState(s,{position:s.position,room:'bakery',outdoor:s.outdoor,evening:true}),birthday=entry.birth.birthday,id=entry.career.job.id;
 const restored=restorePetState(JSON.parse(JSON.stringify(archive)),world,{at});recoverPetLife(restored,world,at+120000);
 const pet=restored.pets[0];assert.equal(pet.career.job.id,id);assert.equal(pet.career.job.phase,'choice');assert.equal(pet.career.balance,0);assert.equal(pet.birth.birthday,birthday);assert.ok(distance(pet.town.position,roomDoor('bakery'))>1.5);
 const after=structuredClone(pet.career);recoverPetLife(restored,world,at+120000);assert.deepEqual(pet.career,after);
});

test('offline work crosses a real shop doorway before continuing to its indoor station',()=>{
 for(const profession of shops){
  const at=new Date('2026-10-04T21:07:00').getTime(),s=restorePetState({configured:true,profile:{name:'团子',species:'dog',size:1.3},room:'home',care:{energy:100,satiety:90,mood:100,rng:1}},world,{at,random:()=>.5}),entry=s.pets[0];
  s.clock=restoreClock(null,1,at);entry.town=newTownLife('home',{x:.25,z:.8},17);entry.life.at=at;
  const f=setup(profession);assert.equal(f.career.request('invite',{},f.ctx()).accepted,true);entry.career=f.career.snapshot();entry.care=f.care.snapshot();projectActivePet(s);
  const archive=snapshotPetState(s,{position:s.position,room:'home',outdoor:s.outdoor,evening:true}),restored=restorePetState(JSON.parse(JSON.stringify(archive)),world,{at});recoverPetLife(restored,world,at+120000);
  const pet=restored.pets[0];assert.equal(pet.town.place,profession);assert.ok(distance(pet.town.position,roomDoor(profession))>1.5);assert.equal(pet.career.job.phase,'choice');assert.equal(pet.career.balance,0);
 }
});

test('a large dog can use the narrow cafe passage beside a real person without crossing either body or furniture',()=>{
 const door=roomDoor('cafe'),other={id:'ta',kind:'person',size:1.6,place:'cafe',position:{x:door.x+1.3,z:door.z-.2}},f=setup('cafe',{species:'dog',size:1.3,actors:()=>[other]});
 assert.equal(f.career.request('invite',{},f.ctx()).accepted,true);assert.ok(f.town.nav().path(f.town.state.position,f.career.destinationPoint()));walkToWork(f);assert.ok(distance(f.town.state.position,other.position)>1.05);
});
test('a genuinely blocked doorway retains zero progress and resumes the same job after the person moves',()=>{
 const door=roomDoor('store'),other={id:'ta',kind:'person',size:1.6,place:'store',position:{x:door.x+1.3,z:door.z-.2}},f=setup('store',{species:'dog',size:1.3,actors:()=>[other]});
 assert.equal(f.career.request('invite',{},f.ctx()).accepted,true);const id=f.career.state.job.id;assert.equal(f.town.nav().path(f.town.state.position,f.career.destinationPoint()),null);assert.equal(f.town.go('store',f.career.destinationPoint()),false);
 for(let i=0;i<18;i++)f.career.tick(1,f.ctx());assert.equal(f.career.state.job.time,0);other.place='outside';for(let i=0;i<5;i++)f.town.tick(.1,{stayHome:true,position:f.town.state.position});assert.ok(f.town.nav().path(f.town.state.position,f.career.destinationPoint()));walkToWork(f);assert.equal(f.career.state.job.id,id);f.career.tick(1,f.ctx());assert.equal(f.career.state.job.time,1);
});

test('a companion can leave through an occupied shop doorway without trapping the working pet or crossing it',()=>{
 for(const profession of shops){
  const door=roomDoor(profession),person=newTownLife(profession,{x:door.x+1.3,z:door.z-.2},19),dog={id:'pet-1',kind:'pet',species:'dog',size:1.3,weight:1.25,place:profession,position:door};
  const town=createTownLife(person,{world,size:()=>1.6,actor:()=>({id:'ta',kind:'person',size:1.6}),actors:()=>[dog]});assert.equal(town.go('home'),true);
  for(let i=0;i<1200&&person.place===profession;i++)town.tick(.1,{stayHome:true,position:person.position,heading:person.heading});
  assert.equal(person.place,'outside',profession+' door must allow a real safe alternate exit');
 }
});

test('the finer indoor grid still walks outward from an old shared doorstep overlap',()=>{
 for(const profession of shops){
  const door=roomDoor(profession),other={id:'pet-2',kind:'pet',species:'dog',size:1,place:profession,position:door},f=setup(profession,{size:1.3,actors:()=>[other]});
  assert.equal(f.career.request('invite',{},f.ctx()).accepted,true);walkToWork(f);assert.ok(distance(f.town.state.position,door)>1.5);
 }
});

test('a clear established alternate work stance remains stable when the original preferred spot opens',()=>{
 const initial=setup('bakery');initial.career.request('invite',{},initial.ctx());const anchor=initial.career.destinationPoint(),other={id:'ta',kind:'person',size:1.6,place:'bakery',position:anchor},f=setup('bakery',{actors:()=>[other]});
 f.career.request('invite',{},f.ctx());walkToWork(f);f.career.tick(1,f.ctx());const standing={...f.town.state.position};other.place='outside';assert.deepEqual(f.career.destinationPoint(),standing);assert.equal(f.career.atDestination(f.ctx()),true);f.career.tick(1,f.ctx());assert.equal(f.career.state.job.time,2);
});
