import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,START,findPath,walkable,segmentClear,hitInteraction,floorHeight,freshState,restoreState,perform,targetFor} from './world.mjs';
test('six distinct building plans share their actual footprints with navigation',()=>{
 const plans=MAPS.garden.architecture;assert.equal(new Set(Object.values(plans).map(p=>p.style)).size,6);
 for(const [id,b]of Object.entries(plans)){
  assert.ok(walkable(b.door.x,b.door.z),'door blocked '+id);assert.ok(findPath(START,b.door),'unreachable '+id);
  for(const part of b.parts){assert.equal(walkable(part.x,part.z),false,'walk through '+id+'/'+part.id);assert.ok(MAPS.garden.obstacles.some(o=>o.x===part.x&&o.z===part.z&&o.w===part.w&&o.d===part.d&&o.r===part.r));}
 }
 assert.equal(plans.home.parts.length,2);assert.equal(plans.neighbor2.parts[0].r,1.35);assert.ok(plans.hall.parts[0].w>plans.home.parts[0].w*2);
});
test('well, flowerbeds, doorways, steps and seats remain usable beside new exterior volumes',()=>{
 const targets=[...Object.values(MAPS.garden.stations),...Object.values(MAPS.garden.sites).map(s=>s.target),MAPS.garden.seats.pond];
 for(const target of targets){const route=findPath(START,target);assert.ok(route?.length,JSON.stringify(target));let prior=START;for(const p of route){assert.ok(segmentClear(prior,p));prior=p;}}
 assert.equal(floorHeight('garden',MAPS.garden.stations.enter),.18);assert.equal(floorHeight('garden',MAPS.garden.museum.door),.22);
 for(const [kind,id,map]of [['enter',undefined,'home'],['door','hall','hall'],['door','museum','museum']]){let s=freshState();s=perform({...s,position:targetFor(s,kind,id)},kind,id);assert.equal(s.map,map);s=perform({...s,position:MAPS[map].stations.travel},'travel');assert.equal(s.map,'garden');assert.ok(walkable(s.position.x,s.position.z));}
});
test('saves caught inside an added wing recover to a walkable point without changing game progress',()=>{
 const original={...freshState(),day:31,herbs:27,position:{x:-10.35,z:4.3}};const restored=restoreState(original);assert.ok(walkable(restored.position.x,restored.position.z));assert.equal(restored.day,31);assert.equal(restored.herbs,27);assert.deepEqual(restored.notes,original.notes);assert.deepEqual(restoreState(restored),restored);
});
