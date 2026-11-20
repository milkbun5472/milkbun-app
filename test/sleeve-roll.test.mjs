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

test('cross-collar cuff trim includes every forearm-owned vertex from the live binding',async()=>{
 const {garmentVertexIds}=await import('../apps/fairy-garden/avatar-motion/cloth-transport.mjs');
 const {readFileSync}=await import('node:fs');
 const {gunzipSync}=await import('node:zlib');
 const {decodeMotion}=await import('../apps/fairy-garden/avatar-motion/assets.mjs');
 const data=readFileSync(new URL('../apps/fairy-garden/avatar-motion/data/bamboo.bin.gz',import.meta.url));
 const row=decodeMotion(gunzipSync(data)).binding.parts.find(p=>p.name==='outfit_bamboo_trim');
 const ids=garmentVertexIds(row,row.rest.length/3),included=new Set(ids);
 assert.equal(ids.length,included.size);
 assert.ok(row.ids.every(i=>included.has(i)));
 for(let i=0;i<row.rest.length/3;i++)for(let k=i*4;k<i*4+4;k++){
  if([2,5].includes(row.skinIndex[k])&&row.skinWeight[k]>.99)assert.ok(included.has(i));
 }
});

test('cheering closes a split material seam and takes up stretched sleeve fabric',async()=>{
 const {createSleeveEase}=await import('../apps/fairy-garden/avatar-motion/sleeve-ease.mjs');
 const rest=[.1,.6,0,.12,.6,0,.1,.62,0,.12,.6,0,.12,.62,0,.1,.62,0];
 const g=new T.BufferGeometry();
 const si=new Uint16Array(24),sw=new Float32Array(24);
 for(let i=0;i<6;i++){si[i*4]=1;sw[i*4]=1;}
 g.setAttribute('position',new T.Float32BufferAttribute(rest,3));
 g.setAttribute('skinIndex',new T.Uint16BufferAttribute(si,4));
 g.setAttribute('skinWeight',new T.Float32BufferAttribute(sw,4));
 g.setIndex([0,1,2,3,4,5]);
 const o=new T.SkinnedMesh(g),bones=[new T.Bone(),new T.Bone()];
 bones.forEach(b=>o.add(b));o.bind(new T.Skeleton(bones));
 const fit=createSleeveEase(T,[{row:{followArms:true,rest,skinIndex:si,skinWeight:sw},o}]);
 const pos=g.attributes.position;pos.setX(1,.15);pos.setX(3,.16);
 const before=pos.array.slice();fit(0);assert.deepEqual(pos.array,before);
 fit(1);
 assert.ok(Math.abs(pos.getX(1)-pos.getX(3))<1e-7);
 assert.ok(pos.getX(1)-pos.getX(0)<before[3]-before[0]);
});

test('shared cheer sleeve samples and forearm cores match the academy outfit',async()=>{
 const {readFileSync}=await import('node:fs');
 const {gunzipSync}=await import('node:zlib');
 const {decodeMotion}=await import('../apps/fairy-garden/avatar-motion/assets.mjs');
 const {academySleeveSamples,academyForearmCores}=await import('../apps/fairy-garden/avatar-motion/academy-sleeve-samples.mjs');
 const data=readFileSync(new URL('../apps/fairy-garden/avatar-motion/data/academy.bin.gz',import.meta.url));
 const {binding}=decodeMotion(gunzipSync(data));
 assert.deepEqual(academyForearmCores,[2,5].map(bone=>binding.cores.find(c=>c.bone===bone).ids));
 const sleeve=binding.parts.find(r=>r.name==='outfit_academy_right_sleeve'),cells=new Map();
 for(let i=0;i<sleeve.rest.length/3;i++){
  const xyz=sleeve.rest.slice(i*3,i*3+3),key=xyz.map(v=>Math.round(v/.006)).join(',');
  const cell=cells.get(key)||{sum:[0,0,0,0,0],count:0};cells.set(key,cell);
  cell.count++;xyz.forEach((v,j)=>cell.sum[j]+=v);
  for(let j=i*4;j<i*4+4;j++){
   const bone=sleeve.skinIndex[j];
   if(bone===4||bone===5)cell.sum[bone-1]+=sleeve.bentSkinWeight[j];
  }
 }
 assert.deepEqual(academySleeveSamples,Array.from(cells.values(),({sum,count})=>sum.map((v,j)=>Math.round(v/count*(j<3?10000:1000))||0)));
});

test('argyle and cross-collar armhole linings follow the torso and share the original dye slot',async()=>{
 const {readFileSync}=await import('node:fs');
 for(const [outfit,slot] of [['argyle','trim'],['bamboo','cloth']]){
  const bytes=readFileSync(new URL('../apps/fairy-garden/outfits/'+outfit+'.glb',import.meta.url));
  const size=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+size)),bin=bytes.subarray(28+size);
  const original=doc.nodes.find(n=>n.name==='outfit_'+outfit+'_'+slot);
  const source=doc.meshes[original.mesh],skin=doc.skins[original.skin];
  for(const side of ['left','right']){
   const node=doc.nodes.find(n=>n.name==='outfit_'+outfit+'_side_'+side);
   const mesh=doc.meshes[node.mesh],primitive=mesh.primitives[0];
   assert.equal(node.skin,original.skin);assert.equal(node.extras.colorSlot,slot);
   assert.equal(primitive.material,source.primitives[0].material);
   assert.deepEqual(mesh.extras.targetNames,source.extras.targetNames);
   assert.equal(primitive.targets.length,source.primitives[0].targets.length);
   const joints=doc.accessors[primitive.attributes.JOINTS_0],weights=doc.accessors[primitive.attributes.WEIGHTS_0];
   const jo=doc.bufferViews[joints.bufferView].byteOffset,wo=doc.bufferViews[weights.bufferView].byteOffset;
   for(let i=0;i<joints.count;i++){
    assert.equal(doc.nodes[skin.joints[bin.readUInt16LE(jo+8*i)]].name,'body');
    assert.deepEqual([0,1,2,3].map(k=>bin.readFloatLE(wo+16*i+4*k)),[1,0,0,0]);
   }
  }
 }
});
