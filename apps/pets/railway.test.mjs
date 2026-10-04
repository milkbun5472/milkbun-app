import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPetWorld} from '../../art/pet-career/world-navigation.mjs';
import {restorePetState,snapshotPetState,petEntry} from './state.mjs';
import {arrivePetStation} from './railway.mjs';
import {restoreObservation} from './observation.mjs';
const layout=JSON.parse(readFileSync(new URL('../../art/pet-career/outside.json',import.meta.url))),world=createPetWorld(layout);
test('southern town station connects every door and keeps passengers off the rails',()=>{
 assert.ok(world.walkable(layout.station.target.x,layout.station.target.z));
 for(const start of [layout.spawn,...layout.buildings.map(b=>b.approach)]){const route=world.path(start,layout.station.target);assert.ok(route?.length);let last=start;for(const p of route){assert.ok(world.segmentClear(last,p));last=p;}}
 assert.equal(world.walkable(0,41),false);
 for(const id of ['station-bench','station-sign']){const p=layout.props.find(p=>p.id===id);assert.equal(world.walkable(p.x,p.z),false);}
});
test('train landing uses the real writer shape and preserves household work, bags, records and positions',()=>{
 const state=restorePetState({configured:true,position:layout.spawn,town:{place:'outside',position:layout.spawn},profile:{name:'团子'},career:{balance:123}},world);
 state.pets.push(petEntry({configured:true,profile:{name:'栗子',species:'dog'},town:{place:'home',position:{x:-.28,z:.55}}},'pet-2'));
 const written=snapshotPetState(state,{position:layout.spawn,room:null,outdoor:null,evening:true}),landed=arrivePetStation(written,world,layout.station);
 assert.deepEqual(landed.pets,written.pets);assert.deepEqual(landed.resident,written.resident);assert.deepEqual(landed.social,written.social);assert.equal(landed.evening,true);
 assert.equal(landed.room,null);assert.equal(landed.map,'outside');assert.equal(landed.observation.mode,'fixed');assert.deepEqual(landed.observation.street.pan,layout.station.target);
 const restored=restoreObservation(landed.observation,landed.activePetId,landed.pets.map(p=>p.id),'');assert.deepEqual(restored.street.pan,layout.station.target);
 assert.deepEqual(written.position,layout.spawn,'landing does not mutate the saved input');
});
