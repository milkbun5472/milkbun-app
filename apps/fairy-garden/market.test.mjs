import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,freshState,restoreState,findPath,segmentClear,walkable,hitInteraction} from './world.mjs';
const garden=MAPS.garden;
test('market stalls, their visit fronts and hall route share the real layout',()=>{
 assert.deepEqual(garden.sites.market.target,{x:-.7,z:-6.75});
 for(const q of garden.market.stalls){
  assert.equal(walkable(q.x,q.z,'garden'),false,q.id);
  const hit=hitInteraction('garden',q);assert.equal(hit.kind,'visit');assert.equal(hit.id,q.id);
  const target=garden.sites[q.id].target;assert.ok(walkable(target.x,target.z,'garden'),q.id);
  for(const start of [garden.sites.square.target,garden.sites.home.target,garden.sites.market.target]){
   const path=findPath(start,target,'garden');assert.ok(path?.length,q.id);let prev=start;
   for(const p of path){assert.ok(segmentClear(prev,p,'garden'),q.id);prev=p;}
  }
 }
 assert.ok(segmentClear({x:-1,z:0},garden.exits.hall.target,'garden'),'wide central aisle reaches the hall');
 for(const p of garden.market.poles)assert.equal(walkable(p.x,p.z,'garden'),false);
 for(const p of [{x:-.7,z:-5.9},{x:-2.3,z:-6.55}])assert.ok(walkable(p.x,p.z,'garden'),'retired counter has no invisible collider');
});
test('new stall footprints safely relocate a previous outdoor save without losing its contents',()=>{
 const s=freshState();s.position={x:-4.7,z:-6.7};s.herbs=17;s.water=2;
 const saved=JSON.parse(JSON.stringify(s)),restored=restoreState(saved);
 assert.ok(walkable(restored.position.x,restored.position.z,'garden'));
 assert.equal(restored.herbs,17);assert.equal(restored.water,2);
 assert.equal(restored.day,s.day);
});
test('market is a separate streamed exterior district, not a replacement for home or hall',()=>{
 const c=garden.chunks.find(c=>c.id==='market');assert.ok(c.asset.includes('village-market.glb'));
 assert.ok(garden.chunks.find(c=>c.id==='hall'));assert.ok(garden.chunks.find(c=>c.id==='home'));
 assert.equal(garden.market.stalls.length,4);
});
