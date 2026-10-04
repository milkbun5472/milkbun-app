import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreClock} from './real-clock.mjs';
import {freshState,restoreState,cook,MAPS} from './world.mjs';
import {recoverGardenLife} from './real-life.mjs';
const at=(day,h,m=0)=>new Date(2026,9,day,h,m).getTime();
function writer(from){
 let s=restoreState({...freshState(),clock:restoreClock(null,14,from),day:14,map:'home',position:{...MAPS.home.spawn},herbs:17,mushrooms:4,companion:{...freshState().companion,map:'home',position:{x:3.7,z:4.45}}});
 s=cook(s,'roast');return {...s,lifeAt:from};
}
test('garden offline meals use the actual pantry once and never invent shared meals or materials',()=>{
 const from=at(5,18),s=writer(from),out=recoverGardenLife(s,at(5,19));
 assert.equal(out.pantry.length,0);assert.equal(out.herbs,17);assert.equal(out.mushrooms,3);assert.equal(out.tasted.length,0);assert.deepEqual(out.bond,s.bond);
 assert.equal(out.happenings.filter(x=>x.text?.includes('在家里吃了')).length,1);
 assert.deepEqual(recoverGardenLife(out,at(5,19)),out);
 const hungry=recoverGardenLife(out,at(6,9));assert.equal(hungry.pantry.length,0);assert.equal(hungry.happenings.filter(x=>x.text?.includes('在家里吃了')).length,1);
});
test('garden night routine walks home, sleeps through midnight and wakes on the actual morning',()=>{
 const s=writer(at(5,21));const night=recoverGardenLife(s,at(6,2));assert.equal(night.day,15);assert.equal(night.minute,120);assert.equal(night.companion.map,'home');assert.equal(night.sleep.companion,'dusk');
 const morning=recoverGardenLife(night,at(6,8));assert.equal(morning.day,15);assert.equal(morning.minute,480);assert.equal(morning.sleep.companion,null);assert.equal(morning.herbs,17);
});
test('legacy garden starts tracking now without fabricating offline actions',()=>{
 const s=writer(at(5,18));s.lifeAt=0;const out=recoverGardenLife(s,at(6,8));assert.equal(out.pantry.length,1);assert.deepEqual(out.companion,s.companion);assert.equal(out.happenings.length,s.happenings.length);
});
