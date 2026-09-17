import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,START,inPolygon,walkable,segmentClear,findPath,floorHeight,freshState,restoreState,sealBottle,drawBottle,driftError,BOTTLE_DAYS,perform,targetFor} from './world.mjs';
test('the concave lake, river and bridge share one navigable shoreline',()=>{
 const lake=MAPS.garden.lake;assert.ok(lake.shore.length>60);assert.ok(inPolygon(14,1,lake.shore));assert.equal(walkable(14,1),false);assert.equal(walkable(21,-2.7),false);
 // The eastern tongue is land, although it lies inside the lake's bounding rectangle.
 assert.ok(walkable(18,4));assert.ok(walkable(18,8));assert.equal(walkable(25,8.5),false);assert.equal(segmentClear({x:6,z:2},{x:29,z:2}),false);
 for(const p of [lake.bottle.target,...lake.outlooks,MAPS.garden.seats.pond,MAPS.garden.seats.pond.companion,MAPS.garden.stations.travel,MAPS.garden.sites.bridge.target]){assert.ok(walkable(p.x,p.z),JSON.stringify(p));const route=findPath(START,p);assert.ok(route?.length,'unreachable '+JSON.stringify(p));let prev=START;for(const next of route){assert.ok(segmentClear(prev,next));prev=next;}}
 assert.equal(floorHeight('garden',MAPS.garden.seats.pond),.31);assert.equal(floorHeight('garden',MAPS.garden.sites.bridge.target),.38);
 assert.deepEqual(targetFor(freshState(),'bottle'),lake.bottle.target);
});
test('pickup uses the existing bottle writer, daily allowance and archive after reload',()=>{
 let state=sealBottle(freshState(),'给未来湖边的自己');// Move game days through the existing rest transaction.
 for(let i=0;i<BOTTLE_DAYS;i++)state=perform({...state,map:'garden',position:{...MAPS.garden.stations.rest}},'rest');
 state={...state,map:'garden',position:{...MAPS.garden.lake.bottle.target}};const before=state.bottles[0].text;state=drawBottle(state);assert.equal(state.today.bottle,1);assert.equal(state.drifts[0].text,before);assert.ok(driftError(restoreState(state)));assert.equal(drawBottle(state),state);
 state=perform({...state,position:{...MAPS.garden.stations.rest}},'rest');assert.equal(driftError(state),'');
});
test('expanding water recovers submerged saves but keeps seats, contents and indoor beds',()=>{
 const base=sealBottle({...freshState(),day:7,herbs:12},'湖边的瓶子');const restored=restoreState({...base,position:{x:14,z:1}});assert.ok(walkable(restored.position.x,restored.position.z));assert.deepEqual(restored.bottles,base.bottles);assert.equal(restored.herbs,12);assert.equal(restored.day,7);
 const seated=restoreState({...base,seat:'pond',position:{x:11.65,z:10.15}});assert.equal(seated.seat,'pond');assert.deepEqual(seated.position,{x:11.65,z:10.15});assert.deepEqual(restoreState(seated),seated);
 const indoor=restoreState({...base,map:'home',position:MAPS.home.beds.dawn.approach.player,sleep:{player:'dawn',companion:null}});assert.equal(indoor.sleep.player,'dawn');
});
