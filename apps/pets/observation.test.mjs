import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreObservation,observedActor,observe,stopObservation} from './observation.mjs';
import {newPetEntry,restorePetState,snapshotPetState} from './state.mjs';
import {newTownLife} from './town-life.mjs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
import {readFileSync} from 'node:fs';
const world=createPetWorld(JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))));
test('observing another resident changes only camera identity, including after canonical save and reload',()=>{
 const pets=[];for(let i=0;i<2;i++){const p=newPetEntry({name:'宠物'+i,species:i?'dog':'cat'},pets,()=>.2+i*.1);p.town=newTownLife(i?'store':'home',{x:0,z:.5},i+1);pets.push(p);}
 const s=restorePetState({pets,activePetId:pets[0].id,resident:{id:'ta',town:newTownLife('cafe',{x:0,z:.5},71)}},world),before=structuredClone(s.pets);
 s.observation=restoreObservation(null,s.activePetId,s.pets.map(p=>p.id),'ta');const ta={id:'ta',name:'同行者',town:s.resident.town};
 assert.ok(observe(s.observation,'pet',pets[1].id,s.pets,ta));assert.equal(observedActor(s.observation,s.pets,ta).town.place,'store');
 assert.ok(observe(s.observation,'companion',null,s.pets,ta));assert.equal(observedActor(s.observation,s.pets,ta).town.place,'cafe');
 stopObservation(s.observation);s.observation.place='home';assert.equal(s.observation.resume,'companion');assert.equal(s.activePetId,pets[0].id);assert.deepEqual(s.pets,before);
 const saved=snapshotPetState(s,{position:s.position,room:null,outdoor:null,evening:false}),r=restorePetState(saved,world),view=restoreObservation(r.observation,r.activePetId,r.pets.map(p=>p.id),r.resident.id);assert.deepEqual(view,s.observation);assert.deepEqual(r.pets,before);
});
test('invalid targets and absent or changed companions fall back without selecting a pet',()=>{
 const pets=[{id:'cat',profile:{name:'猫'},town:newTownLife('home',{x:0,z:.5},1)}],v=restoreObservation({mode:'companion',petId:'lost',place:'moon'},'cat',['cat'],null);
 assert.equal(v.mode,'pet');assert.equal(v.petId,'cat');assert.equal(v.place,'home');assert.equal(observe(v,'pet','lost',pets,null),false);assert.equal(observe(v,'companion',null,pets,null),false);
 const r=restoreObservation({mode:'companion',companionId:'old'},'cat',['cat'],'new');assert.equal(r.companionId,'new');assert.equal(observedActor(r,pets,{id:'old',town:pets[0].town}),null);
});
