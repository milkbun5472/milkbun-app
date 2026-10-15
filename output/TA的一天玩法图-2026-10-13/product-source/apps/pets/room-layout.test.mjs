import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ROOM_LAYOUTS,roomBounds,roomDoor,HOME_PLACES,PET_STATIONS,petHomePlaces,chorePlaces,HOME_DETAILS,upgradeRoomLayout} from './room-layout.mjs';
import {createHomeNavigation} from './home-navigation.mjs';import {createTownNavigation} from './town-life.mjs';import {RESIDENT_ACTS} from './resident-choice.mjs';
import {createPetCare} from './care.mjs';import {createHousehold,restoreHousehold} from './home-chores.mjs';import {restorePetState,snapshotPetState} from './state.mjs';import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
const world=createPetWorld(JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))));
test('four distinct pet stations and every resident activity have real paths across the larger room',()=>{
 const nav=createHomeNavigation(1.4),door=roomDoor('home');
 for(const station of PET_STATIONS){const p=petHomePlaces(station);for(const key of ['feeding','bed','box','sofa','window','rug']){assert.ok(nav.walkable(p[key].x,p[key].z),key+JSON.stringify(p[key]));assert.ok(nav.path(door,p[key]),key);}}
 for(const act of Object.values(RESIDENT_ACTS).filter(x=>x.point)){assert.ok(nav.walkable(act.point.x,act.point.z),act.label);assert.ok(nav.path(door,act.point),act.label);}
 const bowls=[HOME_PLACES.feeding,...PET_STATIONS.slice(1).map(s=>s.bowl)];for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)assert.ok(Math.hypot(bowls[i].x-bowls[j].x,bowls[i].z-bowls[j].z)>1.5);
 assert.ok(ROOM_LAYOUTS.home.scale.x*ROOM_LAYOUTS.home.scale.z>=2);
 for(const id of ['cafe','bakery','store','florist','alley'])for(const size of [.7,1.3,1.4]){const n=createTownNavigation(id,size),d=roomDoor(id);assert.ok(n.walkable(d.x,d.z),id);assert.ok(n.path(d,{x:0,z:.7}),id);}
});
test('each pet can actually finish water and bedding chores at its own expanded station',()=>{
 for(let i=0;i<4;i++){
  const care=createPetCare({satiety:50,bowl:100,energy:45,mood:100});care.request('rest',{restPlaces:['bed']});care.arrive();for(let k=0;k<100&&care.state.task;k++)care.tick(1,{home:true,idleAllowed:false});care.state.energy=90;for(let j=0;j<2;j++){care.request('drink');care.arrive();for(let k=0;k<100&&care.state.task;k++)care.tick(1,{home:true,idleAllowed:false});}care.state.position={...petHomePlaces(PET_STATIONS[i]).rug};
  const row={entry:{id:'pet-'+i,profile:{name:'家人'+i},town:{place:'home'},career:{balance:42,inventory:{}}},care},household=restoreHousehold(),engine=createHousehold(household,{getRows:()=>Array.from({length:i+1},(_,k)=>k===i?row:{entry:{id:'away-'+k,town:{place:'outside'}},care:createPetCare()}),getActor:()=>({available:true,id:'you',name:'你',position:{x:-.65,z:1.72}}),now:()=>1e12});
  for(const kind of ['water','bedding']){assert.equal(engine.request(kind,{petId:row.entry.id}).accepted,true,kind+i);for(let k=0;k<3000&&engine.state.task;k++)engine.tick(.1);assert.equal(engine.state.task,null,kind+i);assert.equal(engine.state.recent.at(-1).completed,true,kind+i);}
  assert.equal(care.state.condition.water,100);assert.equal(care.state.condition.bedding.bed,0);assert.equal(row.entry.career.balance,42);
 }
});
test('canonical writer reload keeps an old carry and its money/toy identity while updating only the tray destination once',()=>{
 const care=createPetCare({satiety:90,energy:100,position:{x:.25,z:.8}}),row={entry:{id:'pet-1',profile:{name:'团子'},town:{place:'home'},career:{balance:72,inventory:{}}},care},state=restoreHousehold(),engine=createHousehold(state,{getRows:()=>[row],getActor:()=>({available:true,id:'you',name:'你',position:{x:-.65,z:1.72}})});
 engine.request('toys',{petId:'pet-1'});for(let k=0;k<1000&&state.task?.phase!=='carry';k++)engine.tick(.1);assert.equal(state.task.picked,true);
 const pets=restorePetState({pets:[{id:'pet-1',configured:true,profile:{name:'团子'},care:care.snapshot(),career:{balance:72}}],activePetId:'pet-1'},world);
 pets.household=engine.snapshot();const saved=snapshotPetState(pets,{position:pets.position,room:'home',outdoor:null,evening:false});delete saved.roomLayoutVersion;
 // This old destination is the former writer's actual tray, not a new schema.
 saved.household.task.target={x:-.915,z:1.7};saved.household.task.goal={x:-.915,z:2.16};const before=structuredClone(saved),upgraded=restorePetState(saved,world);
 assert.deepEqual(saved,before);assert.equal(upgraded.career.balance,72);assert.equal(upgraded.household.task.picked,true);assert.deepEqual(upgraded.household.task.position,before.household.task.position);assert.deepEqual(upgraded.care.toyPlaces,before.care.toyPlaces);assert.deepEqual(upgraded.household.task.target,chorePlaces(0).toys.ball);
 assert.deepEqual(restorePetState(snapshotPetState(upgraded,{position:upgraded.position,room:'home',outdoor:null,evening:false}),world).household,upgraded.household);
});
test('old sleeping and window visits retain progress at the moved furniture, malformed old chores still restore safely',()=>{
 const care=createPetCare({satiety:90,energy:45,position:{x:-1.2,z:-.82}});care.request('rest',{restPlaces:['bed']});care.arrive();care.tick(3,{home:true,idleAllowed:false});const raw={care:care.snapshot(),town:{place:'home',position:{...care.state.position}},career:{balance:36},household:{task:{kind:'water'}}};
 const before=structuredClone(raw),r=restorePetState(raw,world);assert.deepEqual(raw,before);assert.equal(r.care.task.time,care.state.task.time);assert.deepEqual(r.care.position,{x:HOME_PLACES.bed.x,z:HOME_PLACES.bed.z});assert.equal(r.career.balance,36);assert.equal(r.household.task,null);assert.equal(upgradeRoomLayout(r),r);
 const invalid=upgradeRoomLayout({roomLayoutVersion:2,care:{}});assert.equal(invalid.roomLayoutVersion,2);assert.ok(HOME_DETAILS.bed.x< -2.5);assert.ok(roomBounds('home').maxZ>3.5);
});
