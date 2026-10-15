import test from 'node:test';
import assert from 'node:assert/strict';
import {createScoop} from './scooping.mjs';
import {freshState,sealBottle,drawBottle,driftPick} from './world.mjs';
test('misses can retry; canceled lift never claims; one completed lift uses original bottle ledger once',()=>{
 let s=sealBottle(freshState(),'测试用来信');s={...s,day:s.bottles[0].openDay};const id=driftPick(s).id;
 const canceled=createScoop();assert.equal(canceled.release(2),false);assert.equal(canceled.release(NaN),false);assert.equal(canceled.release(.2),true);canceled.tick(.1,()=>{throw Error('too early');});assert.equal(s.bottles[0].taken,false);
 const scoop=createScoop();let calls=0;assert.equal(scoop.release(.2),true);assert.equal(scoop.release(.2),false);for(let i=0;i<50;i++)scoop.tick(.1,()=>{calls++;s=drawBottle(s);});assert.equal(calls,1);assert.equal(s.today.bottle,1);assert.equal(s.drifts[0].id,id);assert.equal(s.bottles[0].taken,true);
});
