import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,freshState,perform,restoreState,findPath,segmentClear,floorHeight,hitInteraction,exitToward,walkable} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
for(const map of ['neighbor1','neighbor2','neighbor3']){
test(map+' is entered through the existing neighbour door and every room is reachable',()=>{
 const door=MAPS.garden.exits[map];
 assert.deepEqual(door.target,MAPS.garden.sites[map].target);
 const hit=hitInteraction('garden',door.target);assert.equal(hit.kind,'door');assert.equal(hit.id,map);
 let s=freshState();s.position={...door.target};s=perform(s,'door',map);assert.equal(s.map,map);
 for(const target of [...Object.values(MAPS[map].sites).map(q=>q.target),MAPS[map].stations.travel]){
  const path=findPath(s.position,target,s.map);assert.ok(path?.length,JSON.stringify(target));let last=s.position;
  for(const next of path){assert.ok(segmentClear(last,next,s.map));last=next;}
 }
 assert.equal(floorHeight(map,MAPS[map].sites.bedroom.target),map==='neighbor1'?.5:.14);
 assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);
 s.position={...MAPS[map].stations.travel};s=perform(s,'travel');assert.equal(s.map,'garden');assert.deepEqual(s.position,door.target);
});
test(map+' companion follows in and out',()=>{
 let s=freshState();s.companion.mode='follow';s.position={...MAPS.garden.exits[map].target};s.companion.position={x:s.position.x+1,z:s.position.z+.3};s=perform(s,'door',map);
 const c=makeCompanionController();for(let n=0;n<1000&&s.companion.map!==map;n++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,map);assert.equal(exitToward('forest',map).to,'garden');
 assert.equal(restoreState(JSON.parse(JSON.stringify(s))).companion.map,map);
 s.position={...MAPS[map].stations.travel};s=perform(s,'travel');for(let n=0;n<1000&&s.companion.map!=='garden';n++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'garden');
});
}
test('attic chairs face the desk or tea table and beds remain separate from home sleep assignments',()=>{
 const m=MAPS.neighbor1;
 for(const q of m.furniture.filter(q=>q.kind==='chair'||q.kind==='armchair'&&q.x===3.5)){
  const target=m.furniture.find(p=>p.kind===(q.kind==='chair'?'desk':'roundtable')),dx=target.x-q.x,dz=target.z-q.z,h=q.heading||0;
  assert.ok((-Math.sin(h)*dx+Math.cos(h)*dz)/Math.hypot(dx,dz)>.9);
 }
 assert.equal(Object.keys(MAPS.home.beds).length,2);assert.ok(!m.interactions.some(q=>q.kind==='bed'));
});

test('tower arc bookcases face into the reading circle and keep their rotated corners blocked',()=>{
 const m=MAPS.neighbor2;
 for(const q of m.furniture.filter(q=>q.kind==='bookcase')){
  const dx=-3-q.x,dz=-.5-q.z,h=q.heading;
  assert.ok((-Math.sin(h)*dx+Math.cos(h)*dz)/Math.hypot(dx,dz)>.99);
  const footprint=m.obstacles.find(o=>o.kind==='bookcase'&&o.x===q.x);
  assert.equal(footprint.polygon.length,4);
  assert.equal(walkable(q.x,q.z,'neighbor2'),false);
  for(const p of footprint.polygon)assert.equal(walkable(p.x,p.z,'neighbor2'),false);
 }
 const diagonal=m.furniture.filter(q=>q.kind==='bookcase')[1];
 assert.equal(walkable(diagonal.x+.7,diagonal.z+.78,'neighbor2'),true,'empty corner beside a diagonal shelf stays usable');
 for(const a of m.plan.arches)for(const sign of [-1,1]){
  const x=a.x+sign*a.w/2*Math.cos(a.heading),z=a.z+sign*a.w/2*Math.sin(a.heading);
  for(const q of m.furniture)assert.ok(Math.abs(x-q.x)>q.w/2+.26||Math.abs(z-q.z)>q.d/2+.30,'arch overlaps '+q.kind);
 }
});

test('greenhouse supports match collision posts and tea chairs face one another',()=>{
 const m=MAPS.neighbor3;
 for(const p of m.plan.posts){
  assert.equal(walkable(p.x,p.z,'neighbor3'),false);
  for(const q of m.furniture)assert.ok(Math.abs(p.x-q.x)>q.w/2+p.r+.08||Math.abs(p.z-q.z)>q.d/2+p.r+.08,'post intersects '+q.kind);
 }
 const table=m.furniture.find(q=>q.kind==='roundtable');
 for(const q of m.furniture.filter(q=>q.kind==='armchair'&&q.x>0)){
  const dx=table.x-q.x,dz=table.z-q.z;
  assert.ok((-Math.sin(q.heading)*dx+Math.cos(q.heading)*dz)/Math.hypot(dx,dz)>.99);
 }
 assert.ok(!m.interactions.some(q=>['bed','garden','sow'].includes(q.kind)),'new room remains scenery, without shadow sleep or planting mechanics');
});
