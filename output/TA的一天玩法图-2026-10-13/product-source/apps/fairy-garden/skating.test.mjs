import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,advanceTime,restoreState,MAPS,lakeFrozen,onLakeIce,walkable,findPath,segmentClear,floorHeight,nextDay} from './world.mjs';
import {makeCompanionController,PERSONAL_SPACE} from './companion.mjs';
import {stepRoute} from './locomotion.mjs';
const winter=()=>{let s=freshState();for(let i=0;i<42;i++)s=advanceTime(s,1380-s.minute);return s;};
test('winter opens only the lake; island, creek and land obstacles still block both navigation caches',()=>{
 const s=winter(),p=MAPS.garden.lake.skateStart;assert.equal(s.day,43);assert.ok(lakeFrozen(s));
 assert.equal(walkable(p.x,p.z,'garden'),false);assert.ok(walkable(p.x,p.z,'garden',s));assert.equal(walkable(21,-2.7,'garden',s),false);assert.equal(walkable(22,8,'garden',s),false);assert.ok(walkable(18,8,'garden',s));
 const shore=MAPS.garden.lake.bottle.target;assert.equal(findPath(shore,p,'garden'),null);const path=findPath(shore,p,'garden',[],s);assert.ok(path?.length);let a=shore;for(const b of path){assert.ok(segmentClear(a,b,'garden',[],s));a=b;}
 assert.equal(findPath(shore,p,'garden'),null);assert.equal(floorHeight('garden',p,s),MAPS.garden.lake.iceHeight);assert.equal(floorHeight('garden',MAPS.garden.seats.pond,s),.31);
});
test('ice saves survive reload, both people return safely to shore on thaw, all collections remain',()=>{
 let s=winter();s.position={...MAPS.garden.lake.skateStart};s.companion={...s.companion,mode:'follow',position:{x:13,z:7.8}};s=restoreState(JSON.parse(JSON.stringify(s)));assert.ok(onLakeIce(s.map,s.position,s));assert.ok(onLakeIce(s.companion.map,s.companion.position,s));
 s.day=56;s.harvest=17;s.bottles=[{id:'existing',text:'保留',day:42,openDay:49,taken:false}];const out=nextDay(s);assert.equal(out.day,57);assert.equal(lakeFrozen(out),false);assert.ok(walkable(out.position.x,out.position.z));assert.ok(walkable(out.companion.position.x,out.companion.position.z));assert.ok(Math.hypot(out.position.x-out.companion.position.x,out.position.z-out.companion.position.z)>=PERSONAL_SPACE);assert.equal(out.harvest,17);assert.deepEqual(out.bottles,s.bottles);
});
test('shared ice locomotion accelerates, brakes and stops at the destination without overshooting',()=>{
 let route=[{x:12,z:5}],p={x:12,z:9},speed=0,speeds=[];for(let i=0;i<600&&route.length;i++){const result=stepRoute(p,route,.05,{speed,skating:true});p=result.position;speed=result.speed;speeds.push(speed);assert.ok(p.z>=5);}
 assert.equal(route.length,0);assert.deepEqual(p,{x:12,z:5});assert.ok(speeds[0]<speeds[10]);assert.ok(speeds.at(-2)<Math.max(...speeds));assert.equal(speed,0);
 const blocked=stepRoute(p,[{x:21,z:-2.7}],.1,{speed:2,skating:true,clear:()=>false});assert.equal(blocked.blocked,true);assert.deepEqual(blocked.position,p);
});
test('following companion enters lake on the shared winter routes and keeps personal space',()=>{
 let s=winter();s.position={x:12,z:5};s.companion={...s.companion,mode:'follow',position:{x:10.2,z:11.8}};const controller=makeCompanionController();
 for(let i=0;i<400;i++){s=controller.tick(s,.05,{allowCare:false}).state;const p=s.companion.position;assert.ok(walkable(p.x,p.z,'garden',s));assert.ok(Math.hypot(p.x-s.position.x,p.z-s.position.z)>=PERSONAL_SPACE-1e-5);}
 assert.ok(onLakeIce('garden',s.companion.position,s));assert.ok(Math.hypot(s.companion.position.x-s.position.x,s.companion.position.z-s.position.z)<1.5);
});
