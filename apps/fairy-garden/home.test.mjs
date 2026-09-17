import test from 'node:test';import assert from 'node:assert/strict';
import {MAPS,freshState,restoreState,perform,targetFor,arrangeSleep,sleepPose,wakeSleeper,findPath,segmentClear,walkable,advanceTime} from './world.mjs';
import {makeCompanionController} from './companion.mjs';
const arrived=(id='dawn')=>({...freshState(),map:'home',position:{...MAPS.home.beds[id].approach.player},companion:{...freshState().companion,map:'home',mode:'routine',position:{x:0,z:3.8}}});
const settle=s=>{const c=makeCompanionController();for(let i=0;i<1000;i++)s=c.tick(s,.1).state;return {s,c};};
test('two double beds in different rooms, all doorways and furniture paths are navigable',()=>{
 const beds=Object.values(MAPS.home.beds);assert.equal(beds.length,2);assert.ok(beds.every(b=>b.w>=2.4&&b.d>=2.8));assert.ok(Math.abs(beds[0].x-beds[1].x)>6);
 for(const b of beds)for(const who of ['player','companion']){const p=b.approach[who],path=findPath(MAPS.home.spawn,p,'home');assert.ok(path?.length,b.label+' '+who);let last=MAPS.home.spawn;for(const q of path){assert.ok(segmentClear(last,q,'home'));last=q;}assert.equal(walkable(b.x,b.z,'home'),false);}
 assert.equal(walkable(-2,-4,'home'),false);assert.ok(findPath(beds[0].approach.player,beds[1].approach.player,'home')?.length);
});
test('together and separate arrangements actually route the companion to the selected bedroom and preserve safe save coordinates',()=>{
 for(const id of ['dawn','dusk'])for(const mode of ['together','separate']){let s=perform(arrived(id),'bed',id,mode);assert.equal(s.sleep.player,id);assert.equal(s.sleep.companion,mode==='together'?id:id==='dawn'?'dusk':'dawn');const result=settle(s);s=result.s;assert.equal(result.c.view().gesture,'sleep');assert.ok(sleepPose(s));assert.ok(sleepPose(s,'companion'));assert.notEqual(sleepPose(s).x,sleepPose(s,'companion').x);assert.ok(walkable(s.position.x,s.position.z,'home'));assert.deepEqual(restoreState(JSON.parse(JSON.stringify(s))),s);}
});
test('companion can sleep alone while the player explores; waking only one person preserves the other',()=>{
 let s=perform(arrived(),'bed','dawn','companion');assert.equal(s.sleep.player,null);s=settle(s).s;assert.ok(sleepPose(s,'companion'));s={...s,map:'forest',position:MAPS.forest.spawn};s=settle(s).s;assert.equal(s.companion.map,'home');assert.ok(sleepPose(s,'companion'));const mode=s.companion.mode;s=wakeSleeper(s,'companion');assert.equal(sleepPose(s,'companion'),null);assert.equal(s.companion.mode,mode);
 s=perform(arrived(),'bed','dawn','together');s=wakeSleeper(s);assert.equal(s.sleep.player,null);assert.equal(s.sleep.companion,'dawn');
});
test('sleeping overnight keeps the arrangement; invalid input and old saves cannot create a broken or remote bed pose',()=>{
 let s=perform(arrived(),'bed','dawn','together');s=perform(s,'rest');assert.equal(s.day,2);assert.equal(s.sleep.player,'dawn');assert.ok(sleepPose(s));s=advanceTime(s,960);assert.equal(s.day,3);assert.equal(s.sleep.companion,'dawn');
 const old=arrived();delete old.sleep;assert.deepEqual(restoreState(old).sleep,{player:null,companion:null});assert.deepEqual(restoreState({...old,sleep:{player:'__proto__',companion:'constructor'}}).sleep,{player:null,companion:null});assert.equal(arrangeSleep(old,'__proto__','together'),old);assert.equal(arrangeSleep({...old,map:'garden'},'dawn','together').sleep,undefined);assert.equal(restoreState({...old,position:{x:0,z:3},sleep:{player:'dawn',companion:'dusk'}}).sleep.player,null);
});
