import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,findPath,segmentClear,walkable,floorHeight,freshState,restoreState} from './world.mjs';
test('expanded interior outlines retain usable routes to every destination and exit',()=>{
 for(const name of ['home','hall','dormitory','museum']){
  const m=MAPS[name],o=m.plan.outline,area=Math.abs(o.reduce((n,a,i)=>{const b=o[(i+1)%o.length];return n+a.x*b.z-b.x*a.z;},0))/2;
  assert.ok(area>180,name+' floor area');assert.ok(o.length>4,name+' shaped footprint');
  const targets=[...Object.values(m.sites).map(s=>s.target),...Object.values(m.exits).map(e=>e.target).filter(Boolean),m.stations.travel];
  for(const target of targets){assert.ok(walkable(target.x,target.z,name),name+JSON.stringify(target));const path=findPath(m.spawn,target,name);assert.ok(path?.length,name);let last=m.spawn;for(const p of path){assert.ok(segmentClear(last,p,name));last=p;}}
  for(const a of m.plan.arches)for(const sign of [-1,1])assert.equal(walkable(a.x+sign*a.w/2,a.z,name),false,'arch posts collide');
 }
 assert.equal(walkable(9,7,'home'),false,'outside recessed foyer');
 assert.equal(floorHeight('home',MAPS.home.beds.dawn.approach.player),.5);
});
test('prior indoor layout relocates safely without changing possessions or sleep assignment',()=>{
 // Captured from b8284a8 freshState + perform(bed, dawn, separate), without user data.
 const old={"version":9,"layout":2,"epoch":"initial","seat":null,"sleep":{"player":"dawn","companion":"dusk"},"look":{},"seeds":[],"notes":[],"shards":[],"vein":[],"things":[],"made":[],"collection":[],"bottles":[],"drifts":[],"miss":{"score":0,"day":0,"since":1,"cameAt":0},"quests":[],"fixtures":{"pathLamp":false},"deeds":0,"magic":{"seeds":0,"seedSeason":-1,"planted":false,"growth":0,"wateredDay":0,"flowers":0,"discovered":false,"lamps":0},"today":{"bed":1},"journal":[],"map":"home","day":43,"minute":480,"water":0,"blooms":0,"herbs":21,"mushrooms":0,"potions":0,"harvest":0,"sand":0,"stones":0,"depth":0,"picked":[],"position":{"x":-3.62,"z":-1.35},"companion":{"name":"同行者","mode":"routine","map":"home","position":{"x":3.62,"z":-1.35},"helpDay":0,"destination":"home","look":{}}};
 const next=restoreState(old);assert.equal(next.herbs,21);assert.equal(next.day,43);assert.deepEqual(next.sleep,old.sleep);
 assert.deepEqual(next.position,MAPS.home.beds.dawn.approach.player);assert.deepEqual(next.companion.position,MAPS.home.beds.dusk.approach.companion);
 assert.deepEqual(restoreState(JSON.parse(JSON.stringify(next))),next);assert.equal(old.interiorLayout,undefined);
 assert.doesNotThrow(()=>restoreState({...old,sleep:{player:'__proto__',companion:'constructor'}}));
});
test('gallery arch feet clear the full cabinet cornices and leave access to displays',()=>{
 const m=MAPS.museum;
 for(const a of m.plan.arches)for(const side of [-1,1])for(const d of Object.values(m.displays)){
  const q=d.cabinet,x=a.x+side*a.w/2;
  // Actual foot half-depth .185, cornice overhang .11 plus visible clearance .12.
  assert.ok(Math.abs(x-q.x)>q.w/2+.26||Math.abs(a.z-q.z)>q.d/2+.415,'arch foot intersects '+d.label);
 }
 for(const d of Object.values(m.displays))assert.ok(findPath(m.spawn,d.target,'museum')?.length);
});
test('freestanding arch columns do not overlap home or public hall furniture',()=>{
 for(const id of ['home','hall'])for(const a of MAPS[id].plan.arches)for(const side of [-1,1])for(const q of MAPS[id].furniture)
  assert.ok(Math.abs(a.x+side*a.w/2-q.x)>q.w/2+.26||Math.abs(a.z-q.z)>q.d/2+.30,id+' arch intersects '+q.kind);
});
