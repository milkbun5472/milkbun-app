import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../apps/fairy-garden/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three');
const {sleeveRotation,blendSleeveCuffFrame,advancePhoneCuffBlend}=await import('../apps/fairy-garden/avatar-motion/cloth-transport.mjs');
const {clothRotationReferences,createClothTransportKernel}=await import('../apps/fairy-garden/avatar-motion/cloth-transport-kernel.mjs');

test('sleeve stripes keep arm roll even when the sleeve axis does not change',()=>{
 const axis=new T.Vector3(0,1,0),stripe=new T.Vector3(1,0,0);
 for(const turn of [-2,-.8,0,.8,2]){
  const arm=new T.Quaternion().setFromAxisAngle(axis,turn);
  const sleeve=sleeveRotation(T,axis,axis,arm);
  assert.ok(stripe.clone().applyQuaternion(sleeve).distanceTo(stripe.clone().applyQuaternion(arm))<1e-12);
 }
});

test('adjacent sleeve vertices do not split when upper-arm and forearm weights exchange dominance',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {createNumericCore}=await import('../apps/fairy-garden/avatar-motion/numeric-core.mjs');
 const core=createNumericCore(await readFile(new URL('../apps/fairy-garden/avatar-motion/numeric-core.wasm',import.meta.url)));
 const bones=['body','rightArm','rightForearm'].map(name=>Object.assign(new T.Bone(),{name}));
 const g=new T.BufferGeometry(),rest=[.2,.6,0,.2,.6,0],normal=[0,0,1,0,0,1],skinIndex=[0,1,2,0,0,1,2,0];
 const skinWeight=[1/3,1/3+.001,1/3-.001,0,1/3,1/3-.001,1/3+.001,0];
 g.setAttribute('position',new T.Float32BufferAttribute(rest,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(skinWeight,4));
 const mesh=new T.SkinnedMesh(g,new T.MeshBasicMaterial());mesh.bind(new T.Skeleton(bones));
 const row={rest,normal,skinIndex,skinWeight,followArms:true};assert.deepEqual([...clothRotationReferences(row,bones)],[1,1]);
 const rotations=[0,2*Math.PI/3,4*Math.PI/3].map(a=>new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),a));
 const matrices=rotations.map(q=>new T.Matrix4().makeRotationFromQuaternion(q));
 const kernel=createClothTransportKernel(core,mesh);kernel.configure(row,[0,1]);
 const out=kernel.deform(skinWeight,rotations,rotations.map(()=>[0,0,0,0]),matrices,[0,0]);
 const a=new T.Vector3().fromArray(out.position,0),b=new T.Vector3().fromArray(out.position,3);
 assert.ok(a.distanceTo(b)<.005,'near-identical weights must not create a sleeve spike');
 const expected=new T.Vector3(...rest.slice(0,3)).applyQuaternion(rotations[1]);
 assert.ok(a.distanceTo(expected)<.003);assert.ok(b.distanceTo(expected)<.003);kernel.dispose();
});

test('bent sleeve follows the sampled arm axis continuously through raised and inward poses',()=>{
 const rest=new T.Vector3(0,1,0),stripe=new T.Vector3(1,0,0);
 let previous;
 for(let i=0;i<=240;i++){
  const bend=i/240*2.2,arm=new T.Quaternion().setFromEuler(new T.Euler(-bend,.75*bend,.25*bend));
  const axis=rest.clone().applyQuaternion(arm).applyAxisAngle(new T.Vector3(1,0,0),.08);
  const rotation=sleeveRotation(T,rest,axis,arm),point=stripe.clone().applyQuaternion(rotation);
  assert.ok(rest.clone().applyQuaternion(rotation).distanceTo(axis)<1e-12);
  assert.ok(Math.abs(point.length()-1)<1e-12);
  if(previous)assert.ok(point.distanceTo(previous)<.03,'circumferential seam must not flip');
  previous=point;
 }
});


test('cuff transition keeps an arm-sized section round through large bends',()=>{
 const restCenter=new T.Vector3(.1,.2,-.03),startCenter=new T.Vector3(.2,.4,.1),start=new T.Quaternion();
 for(const angle of [.5,Math.PI/2,2.2])for(const amount of [0,.25,.5,.75,1]){
  const end=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),matrix=new T.Matrix4().compose(new T.Vector3(.08,-.02,.1),end,new T.Vector3(1,1,1));
  const center=startCenter.clone(),rotation=start.clone();
  blendSleeveCuffFrame(restCenter,center,rotation,matrix,end,amount,new T.Vector3());
  for(let j=0;j<32;j++){
   const radius=new T.Vector3(Math.cos(j*Math.PI/16)*.04,0,Math.sin(j*Math.PI/16)*.04),point=radius.clone().applyQuaternion(rotation).add(center);
   assert.ok(Math.abs(point.distanceTo(center)-.04)<1e-12,'rotation blending must preserve sleeve radius');
   if(amount===0)assert.ok(point.distanceTo(radius.clone().add(startCenter))<1e-12);
   if(amount===1)assert.ok(point.distanceTo(radius.clone().add(restCenter).applyMatrix4(matrix))<1e-12,'cuff endpoint must stay on its authored forearm transform');
  }
 }
});


test('phone cuff correction stays off for half raises and fades out with the bones',()=>{
 for(const phone of [undefined,0])assert.equal(advancePhoneCuffBlend(0,phone,.4),0);
 let amount=0;for(let i=0;i<40;i++)amount=advancePhoneCuffBlend(amount,1,.4);assert.equal(amount,1);
 const first=advancePhoneCuffBlend(amount,0,.4);assert.equal(first,.6);
 amount=first;for(let i=0;i<40;i++){const next=advancePhoneCuffBlend(amount,undefined,.4);assert.ok(next<=amount);assert.ok(next>=0);amount=next;}assert.equal(amount,0);
});
