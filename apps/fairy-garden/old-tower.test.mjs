import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,START,walkable,findPath,segmentClear,freshState,restoreState,hitInteraction} from './world.mjs';
import {createDistrictStream} from './district-stream.mjs';
const g=MAPS.garden,t=g.oldTower;
test('old tower is beyond the village, reached along the clear winding trail',()=>{
 assert.ok(g.sites.hall.target.z-t.door.z>30);
 assert.ok(t.trees.length>=70);assert.ok(t.trail.length>=7);
 for(const p of t.trail)assert.ok(walkable(p.x,p.z),'blocked trail '+JSON.stringify(p));
 for(let i=1;i<t.trail.length;i++)assert.ok(segmentClear(t.trail[i-1],t.trail[i]),'bend '+i);
 const path=findPath(START,t.door);assert.ok(path?.length);let prev=START;
 for(const p of path){assert.ok(segmentClear(prev,p));prev=p;}
 assert.equal(segmentClear(t.trail[1],t.door),false,'dense woodland prevents cutting straight through');
 assert.equal(walkable(t.x,t.z),false,'tower stonework is solid');
 for(const q of t.trees)assert.equal(walkable(q.x,q.z),false,'visible trunk');
 assert.equal(hitInteraction('garden',t.door).id,'oldTower');
});
test('northern expansion does not create walkable empty land outside the developed map',()=>{
 assert.equal(walkable(50,0),false);assert.equal(walkable(0,54),false);
 assert.ok(walkable(0,-41));assert.equal(walkable(0,-56),false);
 const s=freshState();s.position={...t.door};s.herbs=11;s.companion.mode='follow';s.companion.position={x:1,z:-42};
 const next=restoreState(JSON.parse(JSON.stringify(s)));assert.deepEqual(next.position,t.door);assert.equal(next.herbs,11);assert.deepEqual(next.companion.position,s.companion.position);
});
test('northern assets load near the trail and are released on returning to the village',async()=>{
 const disposed=[],stream=createDistrictStream({chunks:t.chunks,loadAsset:async asset=>({asset}),attach(){},detach(){},dispose:q=>disposed.push(q.asset)});
 await stream.prime(START,7);assert.deepEqual(stream.inspect().loaded,[]);
 await stream.prime(t.trail[2],7);assert.ok(stream.inspect().loaded.includes('northwood-edge'));
 await stream.prime(t.door,7);assert.ok(stream.inspect().loaded.includes('old-tower'));
 stream.update(START,7);assert.ok(!stream.inspect().loaded.includes('old-tower'));assert.ok(disposed.length>0);stream.close();
});

test('navigation grids handle an asymmetric region without allocating the whole radius',async()=>{
 const {createNavigator}=await import('./navigation.mjs');
 const maps={island:{radius:60,walkRegions:[{polygon:[{x:12,z:-50},{x:20,z:-50},{x:20,z:-40},{x:12,z:-40}]}]}};
 const sampled=new Set(),open=(x,z)=>{sampled.add(x.toFixed(3)+','+z.toFixed(3));return x>=12&&x<=20&&z>=-50&&z<=-40&&!(x>15&&x<16&&z<-43);};
 const clear=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.06);for(let i=0;i<=n;i++)if(!open(a.x+(b.x-a.x)*i/n,a.z+(b.z-a.z)*i/n))return false;return true;};
 const route=createNavigator(maps,open,clear)({x:13,z:-48},{x:19,z:-48},'island');
 assert.ok(route?.some(p=>p.z>=-43),'route uses the opening in the offset region');assert.ok(sampled.size<20000,'does not scan a radius-60 square');
});
