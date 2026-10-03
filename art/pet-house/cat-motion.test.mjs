import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sampleFoot,solveLimb,floorHeight} from './cat-motion.mjs';
import {normalizeCatLook,CAT_PALETTES} from './cat-dye.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const rig=JSON.parse(readFileSync(new URL('./cat-rig.json',import.meta.url)));

test('feet lift only in swing and touch down with continuous position and velocity',()=>{
 const e=1e-6;
 for(let p=0;p<rig.duty;p+=.01)assert.equal(sampleFoot(p,rig).height,0);
 for(const p of [rig.duty,1]){
  const a=sampleFoot(p-e,rig),b=sampleFoot(p,rig),c=sampleFoot(p+e,rig);
  assert.ok(Math.abs(a.forward-c.forward)<1e-5);
  assert.ok(Math.abs((b.forward-a.forward)/e-(c.forward-b.forward)/e)<1e-4);
  assert.ok(a.height<1e-9&&c.height<1e-9);
 }
 assert.ok(sampleFoot((1+rig.duty)/2,rig).height>.04);
});
test('IK preserves actual leg lengths and the rest pose; impossible goals stay finite',()=>{
 for(const l of Object.values(rig.legs)){
  const upper=distance(l.root,l.knee),lower=distance(l.knee,l.ankle);
  const rest=solveLimb(l.root,l.ankle,l.knee,upper,lower);
  assert.ok(distance(rest.knee,l.knee)<1e-6);assert.ok(distance(rest.ankle,l.ankle)<1e-6);
  for(const ankle of [l.ankle.map((v,i)=>v+(i===1?.04:0)),[10,10,10],l.root]){
   const pose=solveLimb(l.root,ankle,l.knee,upper,lower);
   assert.ok([...pose.knee,...pose.ankle].every(Number.isFinite));
   assert.ok(Math.abs(distance(l.root,pose.knee)-upper)<1e-6);
   assert.ok(Math.abs(distance(pose.knee,pose.ankle)-lower)<1e-6);
  }
 }
});
test('contact surface agrees with the authored rug top and wood floor',()=>{
 assert.ok(Math.abs(floorHeight(0,.54)-.106)<1e-9);
 assert.equal(floorHeight(2,.54),.04);
 assert.equal(floorHeight(0,2),.04);
});
test('fur looks accept palettes and valid custom colours and reject broken saved values',()=>{
 for(const p of CAT_PALETTES){const v=normalizeCatLook(p);assert.equal(v.id,p.id==='original'?'original':'custom');}
 for(const v of [null,{}, {base:'red',patch:'#ffffff'}, {base:'#ffffff',patch:'url(x)'},false])assert.equal(normalizeCatLook(v).id,'original');
 assert.deepEqual(normalizeCatLook({base:'#ABCDEF',patch:'#123456'}),{id:'custom',base:'#ABCDEF',patch:'#123456'});
});
test('the exported cat contains a skin and all runtime bones; original source remains recorded',()=>{
 const buffer=readFileSync(new URL('./cat.glb',import.meta.url));
 assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(8),buffer.length);
 const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString());
 assert.equal(gltf.skins.length,1);
 for(const name of Object.keys(rig.bones))assert.ok(gltf.nodes.some(n=>n.name===name));
 assert.equal(gltf.skins[0].joints.length,18);
 const report=JSON.parse(readFileSync(new URL('./asset-report.json',import.meta.url)));
 assert.equal(report.catBytes,buffer.length);assert.equal(report.roomBytes,readFileSync(new URL('./room.glb',import.meta.url)).length);
 assert.equal(report.catSourceSha256,'404fae1c8f47baf08e7c0f64597295fc8a6f12cfcf8d0324dc65bd40b89f5f7b');
});
