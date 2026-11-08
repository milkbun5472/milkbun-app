import test from 'node:test';
import assert from 'node:assert/strict';
import {clipFitPolygon} from '../apps/post-office/npc-fit.mjs';
const blend=(a,b,t)=>({p:a.p.map((v,i)=>v+(b.p[i]-v)*t),w:a.w+(b.w-a.w)*t});
test('Float32 roundoff at the fully weighted arm boundary preserves the original triangle',()=>{
 const tri=[{p:[0,0],w:1.00000003},{p:[1,0],w:.99999997},{p:[0,1],w:1}];
 assert.deepEqual(clipFitPolygon(tri,v=>1-v.w,blend),tri);
});
test('a hem crossing is clipped continuously with interpolated positions and original influence',()=>{
 const tri=[{p:[0,.4],w:0},{p:[1,.5],w:.5},{p:[0,.6],w:1}],out=clipFitPolygon(tri,v=>.52-v.p[1],blend);
 assert.equal(out.length,4);assert.ok(out.every(v=>v.p[1]<=.520001&&v.w>=0&&v.w<=1));
 const edge=out.filter(v=>Math.abs(v.p[1]-.52)<1e-9);assert.equal(edge.length,2);assert.ok(edge.every(v=>Math.abs(v.w-.6)<1e-9));
 assert.equal(clipFitPolygon(tri,v=>.3-v.p[1],blend).length,0);
});
