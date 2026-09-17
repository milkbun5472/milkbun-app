import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,freshState,perform,restoreState,findPath,segmentClear,floorHeight,hitInteraction,exitToward} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
test('attic is entered through the existing neighbour door and every room is reachable',()=>{
 const door=MAPS.garden.exits.neighbor1;
 assert.deepEqual(door.target,MAPS.garden.sites.neighbor1.target);
 const hit=hitInteraction('garden',door.target);assert.equal(hit.kind,'door');assert.equal(hit.id,'neighbor1');
 let s=freshState();s.position={...door.target};s=perform(s,'door','neighbor1');assert.equal(s.map,'neighbor1');
 for(const target of [...Object.values(MAPS.neighbor1.sites).map(q=>q.target),MAPS.neighbor1.stations.travel]){
  const path=findPath(s.position,target,s.map);assert.ok(path?.length,JSON.stringify(target));let last=s.position;
  for(const next of path){assert.ok(segmentClear(last,next,s.map));last=next;}
 }
 assert.equal(floorHeight('neighbor1',MAPS.neighbor1.sites.bedroom.target),.5);
 assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);
 s.position={...MAPS.neighbor1.stations.travel};s=perform(s,'travel');assert.equal(s.map,'garden');assert.deepEqual(s.position,door.target);
});
test('companion uses the shared door graph to follow into the attic and back',()=>{
 let s=freshState();s.companion.mode='follow';s.position={...MAPS.garden.exits.neighbor1.target};s.companion.position={x:s.position.x+1,z:s.position.z+.3};s=perform(s,'door','neighbor1');
 const c=makeCompanionController();for(let n=0;n<1000&&s.companion.map!=='neighbor1';n++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'neighbor1');assert.equal(exitToward('forest','neighbor1').to,'garden');
 assert.equal(restoreState(JSON.parse(JSON.stringify(s))).companion.map,'neighbor1');
 s.position={...MAPS.neighbor1.stations.travel};s=perform(s,'travel');for(let n=0;n<1000&&s.companion.map!=='garden';n++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'garden');
});
test('attic chairs face the desk or tea table and beds remain separate from home sleep assignments',()=>{
 const m=MAPS.neighbor1;
 for(const q of m.furniture.filter(q=>q.kind==='chair'||q.kind==='armchair'&&q.x===3.5)){
  const target=m.furniture.find(p=>p.kind===(q.kind==='chair'?'desk':'roundtable')),dx=target.x-q.x,dz=target.z-q.z,h=q.heading||0;
  assert.ok((-Math.sin(h)*dx+Math.cos(h)*dz)/Math.hypot(dx,dz)>.9);
 }
 assert.equal(Object.keys(MAPS.home.beds).length,2);assert.ok(!m.interactions.some(q=>q.kind==='bed'));
});
