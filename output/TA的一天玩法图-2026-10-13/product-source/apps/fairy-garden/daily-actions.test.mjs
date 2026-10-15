import test from 'node:test';import assert from 'node:assert/strict';
import {freshState,perform,targetFor,restoreState,giveMoonFlower,flowerGiftError} from './world.mjs';
test('harvested moonflowers are handed over once by the real writer, preserved by restore',()=>{
 const act=(s,k)=>perform({...s,position:targetFor(s,k)},k);
 let s=act(freshState(),'well');for(let i=0;i<4;i++)s=act(s,'garden');assert.equal(s.harvest,3);
 s.companion={...s.companion,map:s.map,position:{x:s.position.x+.9,z:s.position.z}};
 const next=giveMoonFlower(s);assert.equal(next.harvest,2);assert.equal(s.harvest,3);const loaded=restoreState(JSON.parse(JSON.stringify(next)));assert.equal(loaded.harvest,2);assert.match(loaded.happenings.at(-1).text,/月光花/);
});
test('distance, seats, sleep and empty inventory prevent consuming a gift',()=>{
 let s=freshState();assert.ok(flowerGiftError(s));assert.equal(giveMoonFlower(s),s);
 s={...s,harvest:1};s.companion={...s.companion,position:{x:100,z:100}};assert.equal(giveMoonFlower(s),s);
 s.companion={...s.companion,position:{...s.position}};s.seat='pond';assert.equal(giveMoonFlower(s),s);
});
