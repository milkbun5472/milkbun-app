import test from 'node:test';import assert from 'node:assert/strict';
import {createDistrictStream} from './district-stream.mjs';
import {freshState,restoreState,MAPS,START,findPath,walkable,villagePoint} from './world.mjs';
const flush=()=>new Promise(r=>setImmediate(r));
test('district streaming loads nearby artwork, retains through a hysteresis margin and releases distant artwork',async()=>{
 const calls=[],released=[],attached=[],chunks=[{id:'a',x:0,z:0,radius:2,asset:'a'},{id:'b',x:45,z:0,radius:2,asset:'b'}];
 const s=createDistrictStream({chunks,loadAsset:async u=>(calls.push(u),{id:u}),attach:r=>attached.push(r.id),detach(){},dispose:r=>released.push(r.id)});
 await s.prime({x:0,z:0},5);assert.deepEqual(calls,['a']);s.update({x:14,z:0},5);assert.deepEqual(released,[]);s.update({x:45,z:0},5);await flush();assert.deepEqual(released,['a']);assert.deepEqual(s.inspect().loaded,['b']);s.close();assert.deepEqual(released,['a','b']);
});
test('late district downloads cannot reattach after leaving a map; failures retry without a request storm',async()=>{
 let resolve,requests=0,clock=0,fail=true;const released=[];const chunks=[{id:'a',x:0,z:0,radius:2,asset:'a'}];
 const late=createDistrictStream({chunks,loadAsset:()=>new Promise(r=>resolve=r),attach(){assert.fail('late attach');},detach(){},dispose:r=>released.push(r)});
 late.update({x:0,z:0},5);late.close();resolve('late');await flush();assert.deepEqual(released,['late']);
 const retry=createDistrictStream({chunks,now:()=>clock,loadAsset:async()=>{requests++;if(fail)throw Error('offline');return {};},attach(){},detach(){},dispose(){}});
 retry.update({x:0,z:0},5);await flush();for(let i=0;i<50;i++)retry.update({x:0,z:0},5);assert.equal(requests,1);clock=5001;fail=false;retry.update({x:0,z:0},5);await flush();assert.deepEqual(retry.inspect().loaded,['a']);retry.close();
});
test('expanded districts preserve house dimensions, connected doors and navigable lawns',()=>{
 assert.equal(MAPS.garden.radius,32);assert.deepEqual(START,{x:-12.6,z:9.2});
 assert.ok(Math.hypot(MAPS.garden.sites.home.target.x-MAPS.garden.sites.hall.target.x,MAPS.garden.sites.home.target.z-MAPS.garden.sites.hall.target.z)>20);
 for(const site of Object.values(MAPS.garden.sites))assert.ok(findPath(START,site.target),'unreachable '+site.label);
 assert.ok(walkable(0,3));assert.ok(walkable(-5,5));assert.equal(MAPS.garden.obstacles[5].w,3.5);assert.equal(MAPS.garden.obstacles[6].w,6.8);
});
test('v69.43 outdoor save positions migrate once while collections, date and indoor bed positions survive',()=>{
 // v69.43 freshState writer uses version 8, no layout field, and these outdoor positions.
 const old={...freshState(),position:{x:-4.6,z:4.2},companion:{...freshState().companion,position:{x:-3.5,z:4.3}},day:47,herbs:19};delete old.layout;
 const next=restoreState(old);assert.deepEqual(next.position,START);assert.deepEqual(next.companion.position,villagePoint(old.companion.position,'home'));assert.equal(next.day,47);assert.equal(next.herbs,19);assert.deepEqual(restoreState(next),next);
 const seated=restoreState({...old,seat:'pond',position:{x:3.65,z:5.15}});assert.equal(seated.seat,'pond');assert.deepEqual(seated.position,{x:11.65,z:10.15});
 const indoor=restoreState({...old,map:'home',position:{...MAPS.home.beds.dawn.approach.player},sleep:{player:'dawn',companion:null}});assert.equal(indoor.sleep.player,'dawn');assert.deepEqual(indoor.position,MAPS.home.beds.dawn.approach.player);
});
