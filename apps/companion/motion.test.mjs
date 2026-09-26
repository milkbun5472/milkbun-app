import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MOODS,DUR,moodBase,accent} from './motion.mjs';
test('all ten moods rest on the ground and use valid occasional actions',()=>{
 assert.equal(Object.keys(MOODS).length,10);
 for(const [face,m] of Object.entries(MOODS)){
  assert.ok(m.every>=13);
  for(const k of m.acts)assert.ok(DUR[k]>0);
  for(let t=0;t<120;t+=.1){const b=moodBase(face,t);assert.equal(b.y,0);assert.ok(Math.abs(b.tilt)<=.05);assert.ok(Math.abs(b.yaw)<.2);}
 }
});
test('accents settle at both ends without a jump or sharp velocity change',()=>{
 for(const k of ['hop','jolt','nod','sigh','stomp','turn','shy','land']){
  for(const p of [0,1])for(const v of Object.values(accent(k,p)))assert.ok(Math.abs(v)<1e-10,k);
  for(const p of [.0001,.9999])for(const v of Object.values(accent(k,p)))assert.ok(Math.abs(v)<.00001,k);
  for(let p=0;p<=1;p+=.001)for(const v of Object.values(accent(k,p)))assert.ok(Number.isFinite(v)&&Math.abs(v)<=.23,k);
 }
});
