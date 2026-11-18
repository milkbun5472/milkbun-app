import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as T from '../apps/fairy-garden/vendor/three.module.js';
import {decodeMotion} from '../apps/fairy-garden/avatar-motion/assets.mjs';
import {createNumericCore} from '../apps/fairy-garden/avatar-motion/numeric-core.mjs';
import {createSleeveEnvelope} from '../apps/fairy-garden/avatar-motion/sleeve-envelope.mjs';
import {applyOutfitMeshEdits} from '../apps/fairy-garden/outfit-mesh-edits.mjs';
import {fitRigid} from '../apps/fairy-garden/avatar-motion/rigid-fit.mjs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url));
const load=id=>decodeMotion(gunzipSync(file('apps/fairy-garden/avatar-motion/data/'+id+'.bin.gz')));
const core=()=>createNumericCore(file('apps/fairy-garden/avatar-motion/numeric-core.wasm'));
function fixture(){
 const rest=[0,0,0,1,0,0,0,1,0],row={name:'outfit_linen_cloth',rest:[.3,.5,.02,1,0,.02,0,1,.02],skinIndex:[1,0,0,0,1,0,0,0,1,0,0,0],skinWeight:[1,0,0,0,1,0,0,0,1,0,0,0]},entry={row,ids:[0,1,2],o:{getVertexPosition(i,v){return v.fromArray(row.rest,i*3);}}};
 const empty={ptr:[0],col:[],value:[]},factor={rhs:empty,L:empty,symmetricFactor:true,diagonal:[],permR:[],permC:[]};
 const data={anchors:{ids:[0],side:[0],weight:[1],body:[0,1,2],bary:[.2,.3,.5],offset:[.02],baseBody:[0,1,2],baseBary:[.2,.3,.5],baseOffset:[.02]},shoulder:{first:[],inv:[],unknown:[],active:[],ptr:[0],col:[],lam:[],factor},trimPatches:[]};
 return {rest,row,entry,data};
}

test('cloth material follows the complete body surface without altering body points or thickness',()=>{
 const {rest,entry,data}=fixture(),numeric=core(),envelope=createSleeveEnvelope(T,data,rest,[entry],[0,1,2],numeric),body=Float64Array.from(rest),p=new T.Vector3();
 for(const angle of [0,.3,1.2,2.4]){
  const transform=new T.Matrix4().compose(new T.Vector3(.2,-.1,.3),new T.Quaternion().setFromEuler(new T.Euler(angle,.4,-.2)),new T.Vector3(1,1,1));
  for(let i=0;i<3;i++)p.fromArray(rest,i*3).applyMatrix4(transform).toArray(body,i*3);
  const saved=body.slice();envelope.update(body,[angle/3,angle/3]);p.set(8,7,6);envelope.limit(entry,0,p);
  const expected=new T.Vector3(.3,.5,.02).applyMatrix4(transform);assert.ok(p.distanceTo(expected)<1e-12);assert.deepEqual(body,saved);
  const surface=new T.Vector3(.3,.5,0).applyMatrix4(transform);assert.ok(Math.abs(p.distanceTo(surface)-.02)<1e-12);
 }
 const allocated=numeric.allocatedBytes();envelope.dispose();createSleeveEnvelope(T,data,rest,[entry],[0,1,2],numeric).dispose();assert.equal(numeric.allocatedBytes(),allocated,'rebinding reuses the immutable shoulder factor');
});

test('arm ownership fades continuously at the shoulder instead of snapping cloth onto the arm',()=>{
 const f=fixture(),envelope=createSleeveEnvelope(T,f.data,f.rest,[f.entry],[0,1,2],core());envelope.update(f.rest,[1,1]);
 const points=[];for(const own of [.05-1e-8,.05,.05+1e-8,.1-1e-8,.1+1e-8]){f.row.skinWeight[0]=own;f.row.skinWeight[1]=1-own;const p=new T.Vector3(.3,.5,-.01);envelope.limit(f.entry,0,p);points.push(p);}
 assert.ok(points[0].distanceTo(points[2])<1e-10);assert.ok(points[3].distanceTo(points[4])<1e-8);envelope.dispose();
});

test('shoulder attachment follows its body patch even below the sleeve ownership threshold',()=>{
 const f=fixture();f.row.skinWeight[0]=.03;f.row.skinWeight[1]=.97;
 f.data.rootAnchors=[[0,1,[0,1,2],[.2,.3,.5],.02]];
 const envelope=createSleeveEnvelope(T,f.data,f.rest,[f.entry],[0,1,2],core()),posed=Float64Array.from(f.rest),v=new T.Vector3();
 for(const angle of [0,.7,1.9]){
  const matrix=new T.Matrix4().makeRotationX(angle);matrix.setPosition(.1,-.2,.3);
  for(let i=0;i<3;i++)v.fromArray(f.rest,i*3).applyMatrix4(matrix).toArray(posed,i*3);
  envelope.update(posed,[.5,.5]);const point=new T.Vector3(8,7,6);envelope.limit(f.entry,0,point);
  assert.ok(point.distanceTo(new T.Vector3(.3,.5,.02).applyMatrix4(matrix))<1e-12);
 }
 envelope.dispose();
});

test('cuff insert seams share the sleeve positions and retain their relief during rotation',()=>{
 const f=fixture(),anchors=[0,1,2];f.data.trimPatches=[{ids:[0,1],anchors,weights:[[1,0,0],[.2,.3,.5]],residual:[[0,0,0],[0,0,.01]]}];
 const envelope=createSleeveEnvelope(T,f.data,f.rest,[f.entry],[0,1,2],core()),transform=new T.Matrix4().compose(new T.Vector3(.2,.1,-.1),new T.Quaternion().setFromEuler(new T.Euler(.9,-.4,.3)),new T.Vector3(1,1,1)),main=Float64Array.from(f.row.rest),v=new T.Vector3();
 for(let i=0;i<3;i++)v.fromArray(f.row.rest,i*3).applyMatrix4(transform).toArray(main,i*3);
 envelope.update(f.rest,[1,1]);envelope.finish(f.entry,main);
 const patch={row:{name:'outfit_linen_cuff_patch'}},out=new Float64Array(6);envelope.finish(patch,out);
 assert.deepEqual(Array.from(out.slice(0,3)),Array.from(main.slice(0,3)));
 const expected=new T.Vector3();for(let i=0;i<3;i++)expected.addScaledVector(v.fromArray(f.row.rest,i*3),[.2,.3,.5][i]);expected.z+=.01;expected.applyMatrix4(transform);
 assert.ok(expected.distanceTo(v.fromArray(out,3))<1e-12);envelope.dispose();
});

test('packed linen envelope retains valid bindings, barycentric anchors and the original body/model',()=>{
 const data=load('linen'),body=load('body'),a=data.sleeveEnvelope.anchors,authored=JSON.parse(gunzipSync(file('art/fairy-garden/doll/motion/linen-envelope.json.gz')));
 assert.equal(data.binding.rest.length,13598*3);assert.equal(a.ids.length,6407);assert.equal(data.sleeveEnvelope.shoulder.unknown.length,1466);assert.ok(data.sleeveEnvelope.rootAnchors.length>0);
 for(let j=0;j<a.ids.length;j++){
  assert.ok(a.ids[j]>=0&&a.ids[j]<13598);assert.ok(a.weight[j]>=0&&a.weight[j]<=1);
  for(const [ids,weights]of [[a.body,a.bary],[a.baseBody,a.baseBary]]){let sum=0;for(let k=0;k<3;k++){assert.ok(ids[j*3+k]>=0&&ids[j*3+k]<body.mesh.position.length/3);assert.ok(weights[j*3+k]>=-1e-10);sum+=weights[j*3+k];}assert.ok(Math.abs(sum-1)<1e-12);}
 }
 for(const [key,path]of [['modelSha256','apps/fairy-garden/outfits/linen.glb'],['bodySha256','apps/fairy-garden/avatar-motion/data/body.bin.gz']])assert.equal(createHash('sha256').update(file(path)).digest('hex'),authored[key]);
 assert.equal(data.meshEdits.splitFaces[0].colorSlot,'cloth');assert.equal(data.binding.parts.find(r=>r.name==='outfit_linen_cuff_patch').meshId,6);
 assert.ok(data.binding.parts.some(r=>r.name==='outfit_linen_trim'&&r.linear),'belt corrections remain present');
});

test('authored face edits preserve skin, morph and UV channels while separating cuff color from belt',()=>{
 const scene=new T.Group(),g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,1,1,0],3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Array(16).fill(0),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(new Array(16).fill(.25),4));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));g.morphAttributes.position=[new T.Float32BufferAttribute(new Array(12).fill(.01),3)];g.setIndex([0,1,2,1,3,2]);
 const original=new T.SkinnedMesh(g,new T.MeshStandardMaterial());original.name='belt';original.userData={outfit:'linen',colorSlot:'trim'};scene.add(original);
 applyOutfitMeshEdits(scene,{splitFaces:[{name:'belt',vertices:4,triangles:2,faces:[0],target:'cuff',colorSlot:'cloth'}]});const cuff=scene.getObjectByName('cuff');
 assert.deepEqual(Array.from(original.geometry.index.array),[1,3,2]);assert.deepEqual(Array.from(cuff.geometry.index.array),[0,1,2]);assert.deepEqual(Array.from(g.index.array),[0,1,2,1,3,2]);
 for(const name of ['position','uv','skinIndex','skinWeight'])assert.deepEqual(cuff.geometry.attributes[name].array,g.attributes[name].array);
 assert.deepEqual(cuff.geometry.morphAttributes.position[0].array,g.morphAttributes.position[0].array);assert.equal(original.userData.colorSlot,'trim');assert.equal(cuff.userData.colorSlot,'cloth');assert.notEqual(cuff.material,original.material);
 assert.throws(()=>applyOutfitMeshEdits(scene,{removeFaces:[{name:'belt',vertices:4,triangles:2,faces:[0]}]}),/source mismatch/);
});

test('shared covariance rotation recovers rigid motions, including nearly flat source samples',()=>{
 const rest=[0,0,0,1,0,0,0,1,0,.2,.4,1e-10],ids=[0,1,2,3],v=new T.Vector3();
 for(const angle of [0,.3,1.7,Math.PI]){const q=new T.Quaternion().setFromEuler(new T.Euler(angle,-.4,.8)),posed=[];for(let i=0;i<4;i++)v.fromArray(rest,i*3).applyQuaternion(q).add(new T.Vector3(.1,.2,-.1)).toArray(posed,i*3);const fit=fitRigid(rest,posed,ids),actual=new T.Quaternion(...fit.quaternion);assert.ok(1-Math.abs(actual.dot(q))<1e-12);}
});
