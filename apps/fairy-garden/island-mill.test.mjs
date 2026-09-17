import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,NODES,normalizePlan,missTaken,freshState,perform,advanceTime,nextDay,restoreState,fillVein,takeShard,castSpell,actionError,findPath,walkable,floorHeight,onLakeIce,millAction,companionMillHelp,floatIslandLight,islandLightError} from './world.mjs';
import {MILL_RECIPES,millRemaining,activeWaterLights,gameMinute} from './workshop.mjs';
import {makeCompanionController} from './companion.mjs';
function stocked(){let s=freshState();for(let i=0;i<3;i++){for(const kind of ['herb','mushroom']){const n=NODES.find(n=>n.kind===kind);s=perform({...s,map:n.map,position:{x:n.x,z:n.z+.48}},'gather',n.id);}s=nextDay(s);}return perform({...s,map:'garden',position:MAPS.garden.stations.well},'well');}
function mill(s){return {...s,map:'watermill',position:{...MAPS.watermill.stations.mill}};}
function island(){let s=takeShard(fillVein(freshState(),[{kind:'sense',text:'记着湖水温度的碎片'}]),1);s={...s,spells:['sense']};s=castSpell(s,'sense',s.shards[0].id,'reedBridge');return {...s,map:'garden',position:{...MAPS.garden.seats.island},companion:{...s.companion,mode:'follow',position:{...MAPS.garden.lake.reedBridge.approach}}};}
test('real gathering supplies two independent batches; loading and collection cannot duplicate outputs',()=>{
 let s=mill(stocked()),before=s;s=millAction(s,'powder');assert.equal(s.mushrooms,before.mushrooms-2);assert.equal(millAction(s,'powder'),s);assert.equal(millAction(s,'powder',true),s);s=millAction(s,'dew');assert.equal(Object.keys(s.workshop.jobs).length,2);
 assert.equal(millAction({...s,map:'garden'},'powder',true).sand,s.sand);assert.equal(millAction(s,'__proto__'),s);
 s=restoreState(JSON.parse(JSON.stringify(s)));assert.equal(millRemaining(s,'powder'),120);s=advanceTime(s,119);assert.equal(millAction(s,'powder',true),s);s=advanceTime(s,1);assert.equal(millRemaining(s,'powder'),0);
 const result=millAction(s,'powder',true);assert.equal(result.sand,s.sand+3);assert.equal(millAction(result,'powder',true),result);assert.equal(millRemaining(result,'powder'),null);
});
test('sleeping completes production and restoration derives output from the recipe, not saved reward fields',()=>{
 let s=mill(stocked());s=millAction(s,'dew');assert.equal(millRemaining(s,'dew'),180);s=nextDay(s);const raw=JSON.parse(JSON.stringify(s));raw.workshop.jobs.dew.output={potions:999};s=restoreState(raw);s=millAction(s,'dew',true);assert.equal(s.potions,2);
 assert.deepEqual(restoreState(freshState()).workshop,{jobs:{},helpDay:0});
});
test('companion helps only after actually arriving, once a day, and the shortened batch survives reload',()=>{
 let s=missTaken(millAction(mill(stocked()),'dew'));assert.equal(companionMillHelp(s),s);s={...s,companion:{...s.companion,map:'watermill',mode:'routine',position:{x:-1.8,z:1.8}},position:{x:0,z:4},seasonPlan:normalizePlan({days:Array.from({length:14},(_,i)=>({day:i+1,activities:[{id:'workshop'},{id:'walk'},{id:'home'}]}))},s.day),minute:480};
 const ctl=makeCompanionController();for(let i=0;i<200;i++)s=ctl.tick(s,.1).state;
 assert.equal(s.workshop.jobs.dew.helper,s.companion.name);assert.equal(s.workshop.helpDay,s.day);assert.equal(companionMillHelp(s),s);
 const saved=restoreState(JSON.parse(JSON.stringify(s)));assert.equal(saved.workshop.jobs.dew.end,s.workshop.jobs.dew.end);
});
test('island seating shares the original sit action, respects opening, and walks both people to distinct reachable slots',()=>{
 assert.match(actionError(freshState(),'sit','island'),/留感咒/);let s=island();assert.equal(actionError(s,'sit','island'),'');
 assert.ok(findPath(MAPS.garden.lake.reedBridge.approach,s.position,'garden',[],s));s=perform(s,'sit','island');assert.equal(s.seat,'island');
 const ctl=makeCompanionController();for(let i=0;i<300;i++)s=ctl.tick(s,.1).state;
 assert.equal(ctl.view().gesture,'sit');assert.ok(Math.hypot(s.position.x-s.companion.position.x,s.position.z-s.companion.position.z)>.58);
 assert.ok(walkable(s.companion.position.x,s.companion.position.z,'garden',s));assert.equal(floorHeight('garden',s.position,s),.68);assert.equal(onLakeIce('garden',s.position,{...s,day:43}),false);
 assert.equal(restoreState(JSON.parse(JSON.stringify(s))).seat,'island');
 let pond={...freshState(),map:'forest',position:{...MAPS.forest.seats.pond}};pond=perform(pond,'sit');assert.equal(pond.seat,'pond');
});
test('water lights use game time and persist; no repeated clicks or saved future lights',()=>{
 let s=island();assert.match(islandLightError(s),/坐下来/);s=perform(s,'sit','island');s=floatIslandLight(s);assert.equal(activeWaterLights(s).length,1);assert.equal(floatIslandLight(s),s);
 s=restoreState(JSON.parse(JSON.stringify(s)));assert.equal(activeWaterLights(s).length,1);s=advanceTime(s,30);s=floatIslandLight(s);assert.equal(activeWaterLights(s).length,2);s=advanceTime(s,90);assert.equal(activeWaterLights(s).length,1);assert.equal(activeWaterLights({...s,waterLights:[{at:gameMinute(s)+30}]}).length,0);
});
test('a companion who arrived before materials were added still helps once the batch starts',()=>{
 let s=missTaken(mill(stocked()));s={...s,position:{x:0,z:4},minute:480,companion:{...s.companion,map:'watermill',mode:'routine',position:{...MAPS.watermill.stations.mill}},seasonPlan:normalizePlan({days:Array.from({length:14},(_,i)=>({day:i+1,activities:[{id:'workshop'},{id:'walk'},{id:'home'}]}))},s.day)};
 const ctl=makeCompanionController();for(let i=0;i<40;i++)s=ctl.tick(s,.1).state;assert.equal(s.workshop.helpDay,0);
 s={...millAction(mill(s),'powder'),position:{x:0,z:4}};for(let i=0;i<10;i++)s=ctl.tick(s,.1).state;assert.equal(s.workshop.jobs.powder.helper,s.companion.name);
});
