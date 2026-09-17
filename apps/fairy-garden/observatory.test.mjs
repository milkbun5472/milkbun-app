import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,freshState,perform,restoreState,findPath,segmentClear,floorHeight,hitInteraction,exitToward,walkable} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
const m=MAPS.oldTower,door=MAPS.garden.exits.oldTower;
test('old tower door now enters the observatory and all viewing positions are reachable',()=>{
 const hit=hitInteraction('garden',door.target);assert.equal(hit.kind,'door');assert.equal(hit.id,'oldTower');
 let s=freshState();s.position={...door.target};s.herbs=23;s=perform(s,'door','oldTower');assert.equal(s.map,'oldTower');
 for(const target of [...Object.values(m.sites).map(p=>p.target),m.stations.travel]){
  const path=findPath(s.position,target,s.map);assert.ok(path?.length,JSON.stringify(target));let prev=s.position;
  for(const p of path){assert.ok(segmentClear(prev,p,s.map));prev=p;}
 }
 s.position={...m.sites.charts.target};const restored=restoreState(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,s);assert.equal(restored.herbs,23);
 s.position={...m.stations.travel};s=perform(s,'travel');assert.equal(s.map,'garden');assert.deepEqual(s.position,door.target);
});
test('gallery can only be reached using its visible four steps, without height jumps through the rail',()=>{
 const q=m.plan.stairs,start={x:q.x,z:-2.1},end={x:q.x,z:-4.2};assert.ok(segmentClear(start,end,'oldTower'));
 let last=floorHeight('oldTower',start),rises=0;
 for(let z=start.z;z>=end.z;z-=.05){const h=floorHeight('oldTower',{x:q.x,z});assert.ok(h-last<=q.rise+.0001);if(h>last)rises++;last=h;}
 assert.equal(rises,q.count);assert.equal(last,m.plan.gallery.height);
 assert.equal(segmentClear({x:0,z:-3.3},{x:0,z:-4.8},'oldTower'),false);
 for(const p of [...m.furniture,...m.plan.posts])assert.equal(walkable(p.x,p.z,'oldTower'),false,'solid '+(p.kind||'pillar'));
 for(const q of m.plan.outerWalls)assert.equal(walkable(q.x,q.z,'oldTower'),false,'stone perimeter');
 assert.equal(walkable(11.5,0,'oldTower'),false);assert.ok(walkable(0,6.5,'oldTower'));
});
test('companion uses the existing map graph to follow into and out of the old tower',()=>{
 let s=freshState();s.companion.mode='follow';s.position={...door.target};s.companion.position={x:s.position.x+.7,z:s.position.z+.3};s=perform(s,'door','oldTower');
 const c=makeCompanionController();for(let i=0;i<1000&&s.companion.map!=='oldTower';i++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'oldTower');assert.equal(exitToward('forest','oldTower').to,'garden');
 assert.equal(restoreState(JSON.parse(JSON.stringify(s))).companion.map,'oldTower');
 s.position={...m.stations.travel};s=perform(s,'travel');for(let i=0;i<1000&&s.companion.map!=='garden';i++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'garden');
});
