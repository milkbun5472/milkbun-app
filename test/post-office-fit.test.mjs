import test from 'node:test';
import assert from 'node:assert/strict';
import {clipFitPolygon,CLOTH_WAIST,CLOTH_HEM,drapeFitVertex,clothLevels} from '../apps/post-office/npc-fit.mjs';
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
test('hanging cloth joins the waist exactly, then ends in a level hem instead of following the pelvis',()=>{
 const ring=[[-.13,.45,0],[0,.45,.1],[.13,.45,0],[0,.45,-.1]].map(p=>({p,n:[p[0]*7,-.2,p[2]*9],w:[1,0,0]})),original=structuredClone(ring);
 for(const vertex of ring){
  assert.deepEqual(drapeFitVertex(vertex,CLOTH_WAIST,{cx:0,cz:0}),vertex);
  const hem=drapeFitVertex(vertex,CLOTH_HEM,{cx:0,cz:0});
  assert.equal(hem.p[1],CLOTH_HEM);assert.equal(hem.n[1],0);assert.equal(hem.w,vertex.w);
  assert.ok(Math.hypot(hem.p[0],hem.p[2])>=Math.hypot(vertex.p[0],vertex.p[2]));
 }
 assert.deepEqual(ring,original);
});
test('short inner shirts and long outer coats share every row in their overlap',()=>{
 const shirt=clothLevels(CLOTH_HEM),coat=clothLevels(.235);
 assert.deepEqual(coat.filter(y=>y>=CLOTH_HEM),shirt);
 assert.equal(coat.at(-1),.235);assert.equal(shirt.at(-1),CLOTH_HEM);
 assert.ok(coat.length<=8&&shirt.length<=5,'cloth subdivision stays within the mobile geometry budget');
});
