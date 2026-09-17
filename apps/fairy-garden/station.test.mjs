import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,START,walkable,findPath,segmentClear,floorHeight,freshState,restoreState,hitInteraction} from './world.mjs';
import {createDistrictStream} from './district-stream.mjs';
const g=MAPS.garden,s=g.station;
test('southern station connects to the museum and home without moving their entrances',()=>{
 assert.ok(s.target.z-g.museum.door.z>19);
 for(let i=0;i<s.approach.length;i++){
  const p=s.approach[i];assert.ok(walkable(p.x,p.z));
  if(i)assert.ok(segmentClear(s.approach[i-1],p),'paved bend '+i);
 }
 for(const start of [START,g.museum.door,s.approach.at(-1)]){
  const path=findPath(start,s.target);assert.ok(path?.length);let previous=start;
  for(const p of path){assert.ok(segmentClear(previous,p));previous=p;}
 }
 assert.ok(walkable(s.target.x,s.target.z));assert.equal(hitInteraction('garden',s.target).id,'railway');
 assert.equal(floorHeight('garden',s.target),s.platform.height);
 assert.equal(floorHeight('garden',s.step),s.step.height);
});
test('every station prop has a visible corresponding solid footprint, while paths stay open',()=>{
 for(const p of [s.booth,...s.benches,...s.posts,...s.planters,s.luggage,s.fence,s.track,...s.trees])assert.equal(walkable(p.x,p.z),false,JSON.stringify(p));
 for(const tree of s.trees)assert.ok(Math.min(...s.track.points.map(p=>Math.hypot(p.x-tree.x,p.z-tree.z)))>2.6,'tree clears rails');
 assert.equal(segmentClear(s.target,{x:s.target.x,z:46}),false,'visible track fence blocks crossing');
 assert.ok(walkable(0,35.5));assert.equal(walkable(20,40),false);assert.equal(walkable(0,54),false);
 const save=freshState();save.position={...s.target};save.herbs=17;save.companion.mode='follow';save.companion.position={x:1.7,z:40.65};
 const restored=restoreState(JSON.parse(JSON.stringify(save)));assert.deepEqual(restored.position,s.target);assert.equal(restored.herbs,17);assert.deepEqual(restored.companion.position,save.companion.position);
});
test('station scenery stays lazy at home, loads when approached and unloads after returning',async()=>{
 const disposed=[],stream=createDistrictStream({chunks:s.chunks,loadAsset:async asset=>({asset}),attach(){},detach(){},dispose:q=>disposed.push(q.asset)});
 await stream.prime(START,7);assert.deepEqual(stream.inspect().loaded,[]);
 await stream.prime(s.approach[2],7);assert.ok(stream.inspect().loaded.includes('station-lane'));
 await stream.prime(s.target,7);assert.ok(stream.inspect().loaded.includes('station'));
 stream.update(START,7);assert.ok(!stream.inspect().loaded.includes('station'));assert.ok(disposed.length);stream.close();
});
