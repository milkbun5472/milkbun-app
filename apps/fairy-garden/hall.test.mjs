import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,freshState,restoreState,perform,targetFor,exitFor,exitToward,findPath,walkable,segmentClear} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
test('public hall and upstairs use shared exits, preserve inventory and return to the same doorway',()=>{
 let s={...freshState(),herbs:23,position:targetFor({map:'garden'},'door','hall')};
 for(const [kind,id,to]of [['door','hall','hall'],['door','upstairs','dormitory'],['travel',null,'hall'],['travel',null,'garden']]){
  const e=exitFor(s.map,kind,id);assert.ok(e);assert.ok(findPath(s.position,e.target,s.map));s=perform({...s,position:e.target},kind,id);assert.equal(s.map,to);assert.equal(s.herbs,23);assert.equal(s.day,1);assert.deepEqual(s.position,e.at||MAPS[to].spawn);assert.deepEqual(restoreState(s),s);
 }
 assert.deepEqual(s.position,MAPS.garden.exits.hall.target);assert.equal(exitFor('garden','door','enter'),null);assert.equal(exitFor('garden','door','__proto__'),null);assert.equal(perform(freshState(),'door','hall').map,'garden');
});
test('every room, stair and hall destination is reachable without cutting through furniture',()=>{
 for(const id of ['hall','dormitory']){const m=MAPS[id];for(const p of [m.spawn,...Object.values(m.sites).map(s=>s.target),...Object.entries(m.exits).map(([k,e])=>e.target||m.stations[k])]){
  assert.ok(walkable(p.x,p.z,id),id+JSON.stringify(p));const path=findPath(m.spawn,p,id);assert.ok(path?.length,id+JSON.stringify(p));let prev=m.spawn;for(const step of path){assert.ok(segmentClear(prev,step,id));prev=step;}
 }for(const o of m.obstacles)assert.equal(walkable(o.x,o.z,id),false);}
});
test('following companion crosses both floors and can return from upstairs to home',()=>{
 assert.equal(exitToward('garden','dormitory').to,'hall');assert.equal(exitToward('dormitory','home').to,'hall');assert.deepEqual(exitToward('hall','dormitory').target,MAPS.hall.exits.upstairs.target);
 let s={...freshState(),map:'dormitory',position:{x:3,z:1.7}};s.companion={...s.companion,mode:'follow',position:MAPS.garden.exits.hall.target};const c=makeCompanionController();
 for(let i=0;i<700;i++)s=c.tick(s,.1).state;assert.equal(s.companion.map,'dormitory');assert.ok(Math.hypot(s.position.x-s.companion.position.x,s.position.z-s.companion.position.z)<1.6);
 s={...s,map:'home',position:{x:0,z:2}};c.reset();for(let i=0;i<1000;i++)s=c.tick(s,.1).state;assert.equal(s.companion.map,'home');
});

test('diagonal routes cannot clip a rectangle corner between sample points',()=>{assert.equal(segmentClear({x:-6.96,z:3.12},{x:-6.72,z:3.36},'garden'),false);});
