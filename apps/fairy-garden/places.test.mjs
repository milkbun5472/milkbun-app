import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,START,freshState,restoreState,restoreCompanion,findPath,walkable,floorHeight,groundPoint,perform,targetFor,exitToward} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
import {createMapLoader,disposeMap} from './map-loader.mjs';
test('home can be entered, slept in, restored and left without spending inventory or relocating to village gate',()=>{
 let s={...freshState(),position:targetFor({map:'garden'},'enter'),herbs:21,harvest:8};
 s=perform(s,'enter');assert.equal(s.map,'home');assert.equal(s.day,1);assert.equal(s.herbs,21);
 assert.deepEqual(restoreState(s),s);assert.ok(findPath(s.position,MAPS.home.stations.rest,'home'));
 s=perform({...s,position:MAPS.home.stations.rest},'rest');assert.equal(s.day,2);assert.equal(s.map,'home');assert.equal(s.harvest,8);
 s=perform({...s,position:MAPS.home.stations.travel},'travel');assert.equal(s.map,'garden');assert.deepEqual(s.position,MAPS.garden.stations.enter);
 assert.equal(walkable(0,3.1,'home'),false);assert.equal(walkable(-1.8,-1.55,'home'),false);assert.equal(walkable(0,1,'home'),true);
 assert.deepEqual(restoreCompanion({map:'home',position:{x:50,z:50}}).position,MAPS.home.spawn);
});
test('new destinations remain reachable and heights match bridge decking and the curved hill',()=>{
 for(const [map,from]of [['garden',START],['forest',MAPS.forest.spawn]])for(const site of Object.values(MAPS[map].sites))assert.ok(findPath(from,site.target,map)?.length,site.label);
 assert.equal(walkable(11.5,3,'garden'),false);assert.equal(walkable(10,3,'garden'),true);assert.equal(floorHeight('garden',{x:10,z:3}),.38);
 assert.equal(floorHeight('home',{x:0,z:1}),.14);assert.equal(floorHeight('forest',{x:0,z:-6}),.98);assert.equal(floorHeight('forest',{x:0,z:-3}),.08);
 assert.ok(floorHeight('forest',MAPS.forest.sites.wishingTree.target)>.3);
});
test('a following companion uses the same home doorway in both directions, including indirect forest routes',()=>{
 assert.equal(exitToward('forest','home').to,'garden');assert.equal(exitToward('garden','home').id,'enter');
 const c=makeCompanionController();let s={...freshState(),map:'home',position:{x:0,z:1.3}};s.companion={...s.companion,mode:'follow',position:{...MAPS.garden.stations.enter}};
 for(let i=0;i<200;i++)s=c.tick(s,.1).state;assert.equal(s.companion.map,'home');
 s={...s,map:'garden',position:{x:-4.6,z:4.2},companion:{...s.companion,position:{...MAPS.home.stations.travel}}};c.reset();
 s=c.tick(s,.1).state;assert.equal(s.companion.map,'garden');assert.deepEqual(s.companion.position,MAPS.garden.stations.enter);
});
test('a failed additive scene frees partial geometry and keeps the previous active map for retry',async()=>{
 let disposed=0,fail=true,attached=0;const base=()=>({children:[],add(o){this.children.push(o);},traverse(fn){fn({geometry:{dispose(){disposed++;}}});for(const c of this.children)c.traverse(fn);}});
 const loader=createMapLoader({maps:{a:{asset:'a'},b:{renderer:'woods',decorAssets:['tree','missing']}},loadAsset:async url=>{if(url==='missing'&&fail)throw Error('offline');return base();},factories:{woods:()=>({root:base()})},attach(){attached++;},detach(){}});
 await loader.ensure('a');await assert.rejects(loader.ensure('b'));assert.equal(disposed,2);assert.equal(attached,1);assert.deepEqual(Object.keys(loader.views),['a']);
 fail=false;await loader.ensure('b');loader.keep('b');assert.deepEqual(Object.keys(loader.views),['b']);assert.equal(loader.views.b.root.children.length,2);
});

test('screen rays land on the visible bridge, hill and indoor floor instead of the flat ground below',()=>{
 for(const [map,p]of [['garden',{x:10,z:3.05}],['forest',{x:0,z:-4.9}],['home',{x:0,z:1}]]){const y=floorHeight(map,p),hit=groundPoint(map,{x:p.x+10,y:y+12,z:p.z+16},{x:-10,y:-12,z:-16});assert.ok(Math.hypot(hit.x-p.x,hit.z-p.z)<.001,map);assert.ok(Math.abs(hit.y-y)<.001);}
});

test('shared scene shadow materials release once along with their textures',()=>{
 let released=0;const texture={isTexture:true,dispose(){released++;}},depth={map:texture,dispose(){released++;}},material={map:texture,dispose(){released++;}},geometry={dispose(){released++;}};
 disposeMap({traverse(fn){for(let i=0;i<3;i++)fn({geometry,material,customDepthMaterial:depth});}});assert.equal(released,4);
});
