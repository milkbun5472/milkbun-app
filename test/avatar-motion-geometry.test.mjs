import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../apps/fairy-garden/vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c)}});
const T=await import('three'),{createClothNormalUpdater,disposeClothNormalGeometry}=await import('../apps/fairy-garden/avatar-motion/cloth-normals.mjs'),{createCachedMotionUpdate}=await import('../apps/fairy-garden/avatar-motion/pose-cache.mjs');
function fixture(){
 const root=new T.Group(),a=new T.Bone(),b=new T.Bone();root.add(a);a.add(b);b.position.x=.5;
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,1,1,0],3));g.setAttribute('normal',new T.Float32BufferAttribute([0,0,1,0,0,1,0,0,1,0,0,1],3));g.setIndex([0,1,2,1,3,2]);g.setAttribute('skinIndex',new T.Uint16BufferAttribute([0,1,0,0,1,0,0,0,0,1,0,0,1,0,0,0],4));g.setAttribute('skinWeight',new T.Uint16BufferAttribute([65535,0,0,0,65535,0,0,0,32768,32767,0,0,65535,0,0,0],4,true));
 g.morphTargetsRelative=true;g.morphAttributes.position=[new T.Int16BufferAttribute([0,0,0,0,0,6000,0,0,-3000,0,2000,10000],3,true)];g.morphAttributes.normal=[new T.Int16BufferAttribute([0,2000,-1000,2000,0,-2000,0,-1000,-500,1000,3000,-1000],3,true)];
 const mesh=new T.SkinnedMesh(g,new T.MeshBasicMaterial());root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new T.Skeleton([a,b]));mesh.updateMorphTargets();return {root,a,b,mesh};
}
function reference(mesh){
 const g=mesh.geometry,posed=[],joined=Array.from({length:4},()=>new T.Vector3()),p=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3();mesh.skeleton.update();for(let i=0;i<4;i++)posed.push(mesh.getVertexPosition(i,new T.Vector3()));
 for(let k=0;k<g.index.count;k+=3){const ids=[0,1,2].map(j=>g.index.getX(k+j));a.copy(posed[ids[1]]).sub(posed[ids[0]]);b.copy(posed[ids[2]]).sub(posed[ids[0]]);a.cross(b);for(const i of ids)joined[i].add(a);}
 const mats=mesh.skeleton.bones.map((_,i)=>new T.Matrix4().fromArray(mesh.skeleton.boneMatrices,i*16).premultiply(mesh.bindMatrixInverse).multiply(mesh.bindMatrix));
 return joined.flatMap((n,i)=>{const m=new T.Matrix4();m.elements.fill(0);for(let k=0;k<4;k++){const bone=mats[g.attributes.skinIndex.getComponent(i,k)],w=g.attributes.skinWeight.getComponent(i,k);for(let j=0;j<16;j++)m.elements[j]+=bone.elements[j]*w;}p.copy(n).applyMatrix3(new T.Matrix3().setFromMatrix4(m).invert()).normalize();p.addScaledVector(a.fromBufferAttribute(g.morphAttributes.normal[0],i),-mesh.morphTargetInfluences[0]);return p.toArray();});
}
test('cloth normals decode normalized skin weights and compressed morph attributes',()=>{
 const f=fixture(),update=createClothNormalUpdater(f.mesh,new Float32Array(4).fill(1),Int32Array.from([0,1,2,3]),4);
 for(const angle of [0,.6,1.5])for(const weight of [-.2,.3,.9]){f.b.rotation.y=angle;f.mesh.morphTargetInfluences[0]=weight;f.root.updateMatrixWorld(true);const expected=reference(f.mesh);update(1);expected.forEach((v,i)=>assert.ok(Math.abs(v-f.mesh.geometry.attributes.normal.array[i])<2e-7));}
});
test('pose cache follows geometry, morphs and binding, while reusing world placement',()=>{
 const f=fixture(),q={body:f.mesh,bindingGeneration:1};let calls=0;
 const apply=createCachedMotionUpdate(q,()=>{calls++;q.poseCurveCurrent={calls};f.mesh.geometry.attributes.position.needsUpdate=true});
 apply();q.poseCurveCurrent={incorrect:true};apply();assert.equal(calls,1);assert.equal(q.poseCurveCurrent.calls,1);
 f.root.position.y=3;f.root.updateMatrixWorld(true);apply();assert.equal(calls,1);
 f.b.rotation.x=.3;apply();assert.equal(calls,2);f.mesh.morphTargetInfluences[0]=.2;apply();assert.equal(calls,3);
 f.mesh.geometry.attributes.position.needsUpdate=true;apply();assert.equal(calls,4);q.bindingGeneration++;apply();assert.equal(calls,5);apply.invalidate();apply();assert.equal(calls,6);
 q.phoneCuffBlend=.5;apply();assert.equal(calls,7);apply();assert.equal(calls,7);q.phoneCuffBlend=0;apply();assert.equal(calls,8);
});

test('WASM normals match the independent posed-surface reference and JS path',async()=>{
 const {readFile}=await import('node:fs/promises'),{createNumericCore}=await import('../apps/fairy-garden/avatar-motion/numeric-core.mjs'),core=createNumericCore(await readFile(new URL('../apps/fairy-garden/avatar-motion/numeric-core.wasm',import.meta.url)));
 const f=fixture(),mask=new Float32Array(4).fill(1),weld=Int32Array.from([0,1,2,3]),update=createClothNormalUpdater(f.mesh,mask,weld,4,core),bytes=core.allocatedBytes();
 for(const angle of [0,.6,1.5])for(const weight of [-.2,.3,.9]){f.b.rotation.y=angle;f.mesh.morphTargetInfluences[0]=weight;f.root.updateMatrixWorld(true);const expected=reference(f.mesh);update(1);expected.forEach((v,i)=>assert.ok(Math.abs(v-f.mesh.geometry.attributes.normal.array[i])<2e-7));}
 createClothNormalUpdater(f.mesh,mask,weld,4,core);assert.equal(core.allocatedBytes(),bytes,'rebinding does not allocate another kernel buffer');disposeClothNormalGeometry(core,f.mesh.geometry);createClothNormalUpdater(f.mesh,mask,weld,4,core);assert.equal(core.allocatedBytes(),bytes,'disposed character buffers are reused');
 const js=createClothNormalUpdater(f.mesh,mask,weld,4);f.mesh.geometry.attributes.normal.array.fill(.25);js(.3);const expected=Array.from(f.mesh.geometry.attributes.normal.array);f.mesh.geometry.attributes.normal.array.fill(.25);update(.3);expected.forEach((v,i)=>assert.ok(Math.abs(v-f.mesh.geometry.attributes.normal.array[i])<2e-7));
});

test('body pose kernel matches scalar skin transforms, including changed attributes and reused matrices',async()=>{
 const {readFile}=await import('node:fs/promises'),{createNumericCore}=await import('../apps/fairy-garden/avatar-motion/numeric-core.mjs'),{createBodyPoseKernel}=await import('../apps/fairy-garden/avatar-motion/body-pose-kernel.mjs');
 const core=createNumericCore(await readFile(new URL('../apps/fairy-garden/avatar-motion/numeric-core.wasm',import.meta.url))),f=fixture(),g=f.mesh.geometry;
 // The body channels are ordinary Float32 (compressed clothing is tested above).
 for(const name of ['skinWeight']){const old=g.attributes[name];g.setAttribute(name,new T.Float32BufferAttribute(Array.from({length:old.count*old.itemSize},(_,i)=>old.getComponent(Math.floor(i/old.itemSize),i%old.itemSize)),old.itemSize))}
 g.morphAttributes.position=g.morphAttributes.position.map(attr=>new T.Float32BufferAttribute(Array.from({length:attr.count*3},(_,i)=>attr.getComponent(Math.floor(i/3),i%3)),3));
 const kernel=createBodyPoseKernel(core,g,2),base=core.allocatedBytes();
 for(const angle of [0,.5,1.2]){f.b.rotation.x=angle;f.root.updateMatrixWorld(true);f.mesh.skeleton.update();const mats=f.mesh.skeleton.bones.map((_,i)=>new T.Matrix4().fromArray(f.mesh.skeleton.boneMatrices,i*16).premultiply(f.mesh.bindMatrixInverse).multiply(f.mesh.bindMatrix));
  for(const reuse of [false,true]){g.attributes.position.setZ(0,reuse?.01:0);const result=kernel.apply(mats,[.35],reuse);for(let i=0;i<4;i++){const source=new T.Vector3().fromBufferAttribute(g.attributes.position,i).addScaledVector(new T.Vector3().fromBufferAttribute(g.morphAttributes.position[0],i),.35),M=new T.Matrix4();M.elements.fill(0);for(let j=0;j<4;j++){const m=mats[g.attributes.skinIndex.getComponent(i,j)],w=g.attributes.skinWeight.getComponent(i,j);for(let k=0;k<16;k++)M.elements[k]+=m.elements[k]*w}const expected=source.applyMatrix4(M);assert.ok(expected.distanceTo(new T.Vector3().fromArray(result.buffer,i*3))<1e-12);const A=new T.Matrix3().fromArray(result.linear,i*9),inverse=new T.Matrix3().fromArray(result.inverse,i*9),identity=A.multiply(inverse);identity.elements.forEach((v,k)=>assert.ok(Math.abs(v-(k%4===0?1:0))<1e-12));}}
 }
 kernel.dispose();const next=createBodyPoseKernel(core,g,2);assert.equal(core.allocatedBytes(),base);
 let refreshed=null;next.setViewCallback(view=>{refreshed=view});const old=refreshed.buffer,extra=core.memory.buffer.byteLength+8,ptr=core.reserve(extra);assert.equal(old.length,0);assert.equal(refreshed.buffer.length,12);core.release(ptr,extra);next.dispose();
});

test('batched surface constraints agree with independent per-point queries after refits',async()=>{
 const {readFile}=await import('node:fs/promises'),{createNumericCore}=await import('../apps/fairy-garden/avatar-motion/numeric-core.mjs'),{makeSurfaceQuery}=await import('../apps/fairy-garden/avatar-motion/surface-query.mjs'),core=createNumericCore(await readFile(new URL('../apps/fairy-garden/avatar-motion/numeric-core.wasm',import.meta.url)));
 const sphere=new T.SphereGeometry(.15,20,14),p=sphere.attributes.position,normal=sphere.attributes.normal,count=p.count+300,P=new Float64Array(count*3),N=new Float64Array(count*3),faces=Array.from({length:sphere.index.count/3},(_,i)=>Array.from(sphere.index.array.slice(i*3,i*3+3))),ids=[];
 P.set(p.array);N.set(normal.array);for(let i=0;i<300;i++){const theta=i*2.39996,z=1-2*(i+.5)/300,v=new T.Vector3(Math.sqrt(1-z*z)*Math.cos(theta),Math.sqrt(1-z*z)*Math.sin(theta),z),j=p.count+i;v.clone().multiplyScalar(.15+Math.sin(i*8.3)*.012).toArray(P,j*3);v.negate().toArray(N,j*3);ids.push(j)}
 const weights=new Float64Array(count).fill(1),js=makeSurfaceQuery(P,faces,N,weights),wasm=makeSurfaceQuery(P,faces,N,weights,core),a=new Float64Array(ids.length*4),b=new Float64Array(a.length);
 for(let pass=0;pass<3;pass++){if(pass)for(let i=0;i<P.length;i+=3){P[i]+=.001*Math.sin(P[i+1]*21);P[i+2]-=.001}js.refit(pass===0);wasm.refit(pass===0);const ca=js.queryConstraints(ids,.02,a),cb=wasm.queryConstraints(ids,.02,b);assert.ok(ca>50);assert.equal(cb,ca);for(let i=0;i<ca*4;i++)assert.ok(Math.abs(a[i]-b[i])<1e-12,`${i}: ${a[i]} vs ${b[i]}`);}
 wasm.dispose();js.dispose();sphere.dispose();
});

test('garment transport kernel preserves DQ motion, native blend and compressed morph offsets',async()=>{
 const {readFile}=await import('node:fs/promises'),{createNumericCore}=await import('../apps/fairy-garden/avatar-motion/numeric-core.mjs'),{createClothTransportKernel}=await import('../apps/fairy-garden/avatar-motion/cloth-transport-kernel.mjs'),core=createNumericCore(await readFile(new URL('../apps/fairy-garden/avatar-motion/numeric-core.wasm',import.meta.url)));
 const f=fixture(),g=f.mesh.geometry,originalP=new Float32Array(g.attributes.position.array),originalN=new Float32Array(g.attributes.normal.array),row={rest:Array.from(originalP),normal:Array.from(originalN),skinIndex:Array.from(g.attributes.skinIndex.array),followArms:true},weights=Float64Array.from({length:16},(_,i)=>g.attributes.skinWeight.getComponent(i>>2,i%4)),kernel=createClothTransportKernel(core,f.mesh),rotations=[new T.Quaternion().setFromEuler(new T.Euler(.3,-.4,.2)),new T.Quaternion().setFromEuler(new T.Euler(-.2,.7,-.3))],virtual=rotations.map((q,i)=>new T.Matrix4().compose(new T.Vector3(i*.2,.1,-.05),q,new T.Vector3(1,1,1))),dual=virtual.map((m,i)=>{const e=m.elements,q=new T.Quaternion(e[12],e[13],e[14],0).multiply(rotations[i]);return q.toArray().map(x=>x*.5)}),transform=new T.Matrix4().compose(new T.Vector3(.1,-.15,.2),new T.Quaternion().setFromEuler(new T.Euler(.1,.2,-.1)),new T.Vector3(.9,1.1,1.05)),normalTransform=new T.Matrix3().getNormalMatrix(transform);
 row.skinWeight=Array.from(weights);kernel.configure(row,[0,1,2,3]);f.b.rotation.x=.55;f.mesh.morphTargetInfluences[0]=.3;f.root.updateMatrixWorld(true);f.mesh.skeleton.update();const actual=f.mesh.skeleton.bones.map((_,i)=>new T.Matrix4().fromArray(f.mesh.skeleton.boneMatrices,i*16).premultiply(f.mesh.bindMatrixInverse).multiply(f.mesh.bindMatrix));
 for(const activation of [0,.27,1])for(const lift of [0,.65]){
  g.attributes.position.array.set(originalP);g.attributes.normal.array.set(originalN);const expected=[];
  for(let i=0;i<4;i++){
   let best=0;for(let k=1;k<4;k++)if(weights[i*4+k]>weights[i*4+best])best=k;const ref=rotations[row.skinIndex[i*4+best]],R=new T.Quaternion(0,0,0,0),D=new T.Quaternion(0,0,0,0),M=new T.Matrix4();M.elements.fill(0);
   for(let k=0;k<4;k++){const j=row.skinIndex[i*4+k],w=weights[i*4+k],q=rotations[j],s=w*(q.dot(ref)<0?-1:1);for(const [n,c]of ['x','y','z','w'].entries()){R[c]+=q[c]*s;D[c]+=dual[j][n]*s}for(let n=0;n<16;n++)M.elements[n]+=actual[j].elements[n]*w;}
   const len=R.length();for(const c of ['x','y','z','w']){R[c]/=len;D[c]/=len}const dot=R.dot(D);for(const c of ['x','y','z','w'])D[c]-=R[c]*dot;const t=D.clone().multiply(R.clone().conjugate()),P=new T.Vector3().fromArray(row.rest,i*3).applyQuaternion(R).add(new T.Vector3(t.x,t.y,t.z).multiplyScalar(2)),N=new T.Vector3().fromArray(row.normal,i*3).applyQuaternion(R),linear=new T.Vector3();
   for(let k=0;k<4;k++)linear.addScaledVector(new T.Vector3().fromArray(row.rest,i*3).applyMatrix4(virtual[row.skinIndex[i*4+k]]),weights[i*4+k]);P.lerp(linear,lift).applyMatrix4(transform);N.applyMatrix3(normalTransform).normalize();P.lerp(f.mesh.getVertexPosition(i,new T.Vector3()),1-activation);M.invert();P.applyMatrix4(M);N.applyMatrix3(new T.Matrix3().setFromMatrix4(M)).normalize();P.addScaledVector(new T.Vector3().fromBufferAttribute(g.morphAttributes.position[0],i),-.3);N.addScaledVector(new T.Vector3().fromBufferAttribute(g.morphAttributes.normal[0],i),-.3);expected.push([P,N]);
  }
  kernel.deform(weights,rotations,dual,virtual,[lift,lift]);kernel.finish(actual,transform,normalTransform,activation);for(let i=0;i<4;i++){assert.ok(expected[i][0].distanceTo(new T.Vector3().fromBufferAttribute(g.attributes.position,i))<3e-7);assert.ok(expected[i][1].distanceTo(new T.Vector3().fromBufferAttribute(g.attributes.normal,i))<3e-7);}
 }
 kernel.dispose();
});

test('head clearance preserves authored shoulder translations and removes only its own offsets',async()=>{
 const {install}=await import('../apps/fairy-garden/avatar-motion/head-clearance.mjs'),root=new T.Group(),names=['body','neck','leftArm','leftForearm','rightArm','rightForearm'],bones=names.map(name=>{const bone=new T.Bone();bone.name=name;root.add(bone);return bone}),g=new T.BufferGeometry(),R=[-.1,2,0,.1,2,0,0,2,.1,-.2,.5,0,.2,.5,0];
 g.setAttribute('position',new T.Float32BufferAttribute(R,3));g.setAttribute('normal',new T.Float32BufferAttribute(Array.from({length:5},()=>[0,1,0]).flat(),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,4,0,0,0],4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:5},()=>[1,0,0,0]).flat(),4));g.setIndex([0,1,2]);const body=new T.SkinnedMesh(g,new T.MeshBasicMaterial());root.add(body);root.updateMatrixWorld(true);body.bind(new T.Skeleton(bones));body.morphTargetInfluences=[];
 const q={T,body,dimensionRest:R,beforePose:[],applyLiveFair(){},applyPoseCurve(){root.updateMatrixWorld(true);body.skeleton.update();q.poseCurveCurrent={feature:new Array(12).fill(0)}}};install(q);
 for(const shift of [new T.Vector3(.02,.03,-.04),new T.Vector3(-.01,.04,.07)]){bones[2].position.copy(shift);bones[4].position.copy(shift).multiplyScalar(-1);q.applyLiveFair();assert.ok(bones[2].position.distanceTo(shift)<1e-12);for(const reset of q.beforePose)reset();assert.ok(bones[2].position.distanceTo(shift)<1e-12);assert.ok(bones[4].position.distanceTo(shift.clone().negate())<1e-12);}
});
