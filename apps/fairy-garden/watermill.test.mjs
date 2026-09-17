import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,freshState,perform,restoreState,findPath,segmentClear,hitInteraction,exitToward,walkable} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
const m=MAPS.watermill,door=MAPS.garden.exits.watermill;
function route(a,b,map){const path=findPath(a,b,map);assert.ok(path?.length,JSON.stringify({a,b,map}));let prev=a;for(const p of path){assert.ok(segmentClear(prev,p,map),JSON.stringify({prev,p,map}));prev=p;}assert.ok(Math.hypot(prev.x-b.x,prev.z-b.z)<.4);}
test('lake shore connects to the mill; stream, building and trees stay solid',()=>{
 route(MAPS.garden.sites.lakeEast.target,door.target,'garden');
 const q=MAPS.garden.watermill;assert.deepEqual(q.creek[0],MAPS.garden.lake.creek.at(-1));
 for(const p of q.approach)assert.ok(walkable(p.x,p.z,'garden'),JSON.stringify(p));
 for(const p of [...q.parts,...q.trees,...q.creek])assert.equal(walkable(p.x,p.z,'garden'),false);
 assert.equal(walkable(50,0,'garden'),false);
});
test('mill shares doors and save format; every workshop viewing position is accessible',()=>{
 const hit=hitInteraction('garden',door.target);assert.equal(hit.kind,'door');assert.equal(hit.id,'watermill');
 let s=freshState();s.position={...door.target};s.herbs=23;s=perform(s,'door','watermill');assert.equal(s.map,'watermill');
 for(const target of [...Object.values(m.sites).map(p=>p.target),m.stations.travel])route(s.position,target,s.map);
 for(const q of m.furniture)assert.equal(walkable(q.x,q.z,'watermill'),false,q.kind);
 s.position={...m.sites.workbench.target};assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);
 s.position={...m.stations.travel};s=perform(s,'travel');assert.equal(s.map,'garden');assert.deepEqual(s.position,door.target);assert.equal(s.herbs,23);
});
test('companion follows through the shared mill door graph in both directions',()=>{
 let s=freshState();s.companion.mode='follow';s.position={...door.target};s.companion.position={x:s.position.x+.7,z:s.position.z};s=perform(s,'door','watermill');
 const c=makeCompanionController();for(let i=0;i<1000&&s.companion.map!=='watermill';i++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'watermill');assert.equal(exitToward('forest','watermill').to,'garden');
 s.position={...m.stations.travel};s=perform(s,'travel');for(let i=0;i<1000&&s.companion.map!=='garden';i++)s=c.tick(s,.1).state;
 assert.equal(s.companion.map,'garden');
});
