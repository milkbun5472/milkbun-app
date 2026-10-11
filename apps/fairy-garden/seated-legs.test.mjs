import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeSeatedLegs}=await import('./seated-legs.mjs');
function doll(){
 const model=new T.Group(),bones=['body','leftLeg','rightLeg'].map(name=>{const b=new T.Bone();b.name=name;b.position.set(name==='leftLeg'?-.075:name==='rightLeg'?.075:0,.3,0);model.add(b);return b;});
 const rig=bones.slice(1).map(b=>({label:b.name,p:{position:b.position.clone(),userData:{bone:b,rest:b.quaternion.clone()}}}));
 function mesh(name,points,indices=points.map(()=>1),outfit=false){
  const g=new T.BufferGeometry();g.morphTargetsRelative=true;g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices.flatMap(i=>[i,0,0,0]),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(points.flatMap(()=>[1,0,0,0]),4));
  const m=new T.SkinnedMesh(g,new T.MeshBasicMaterial());m.name=name;if(outfit)m.userData.outfit='fixture';else m.userData.skinBase='#abcdef';model.add(m);model.updateMatrixWorld(true);m.bind(new T.Skeleton(bones));return m;
 }
 const body=mesh('DollBody',[[-.075,.035,.025],[-.075,.165,.025],[.075,.035,.025],[.075,.165,.025]],[1,1,2,2]);
 const morphs={leftLeg:{},rightLeg:{}};return {model,bones,rig,body,mesh,morphs};
}
const vertices=(model,m)=>{model.updateMatrixWorld(true);return Array.from({length:m.geometry.attributes.position.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()));};
test('膝盖增加后站立顶点不变，坐下后上腿向前、下腿向下且左右独立',()=>{
 const d=doll(),before=vertices(d.model,d.body),original=d.body.geometry,seat=makeSeatedLegs(d.model,d.rig,[d.body],d.morphs);
 seat.fit();seat.update(0);assert.notEqual(d.body.geometry,original);vertices(d.model,d.body).forEach((v,i)=>assert.ok(v.distanceTo(before[i])<1e-7));
 for(const r of d.rig)r.p.userData.bone.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);
 seat.update(1);const posed=vertices(d.model,d.body);
 assert.ok(posed[0].y<posed[1].y-.09&&posed[0].z>posed[1].z+.02,'小腿向下，不再将整条腿水平抬起');
 assert.ok(posed[0].y>.1&&posed[0].y<.24);assert.ok(Math.abs(posed[0].x+.075)<1e-6);assert.ok(Math.abs(posed[2].x-.075)<1e-6);
});
test('鞋筒跨过膝盖高度时仍保持整只鞋的形状，不把鞋筒当腿折弯',()=>{
 const d=doll(),shoe=d.mesh('outfit_fixture_footwear',[[-.075,.03,-.08],[-.075,.20,.06],[-.11,.12,.02]],undefined,true),before=vertices(d.model,shoe),seat=makeSeatedLegs(d.model,d.rig,[d.body,shoe],d.morphs);
 for(const r of d.rig)r.p.userData.bone.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2);seat.update(1);const after=vertices(d.model,shoe);
 for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)assert.ok(Math.abs(after[i].distanceTo(after[j])-before[i].distanceTo(before[j]))<1e-6);
});
test('膝盖以下仍跟躯干的裙摆坐下折到坐面，站起来恢复原形',()=>{
 const d=doll(),skirt=d.mesh('outfit_fixture',[[-.12,.11,-.08],[.12,.12,-.08],[-.12,.24,.03]],[0,0,0],true),before=vertices(d.model,skirt),seat=makeSeatedLegs(d.model,d.rig,[d.body,skirt],d.morphs);
 seat.fit();const index=skirt.morphTargetDictionary.seatDrape;assert.ok(index>=0);skirt.morphTargetInfluences[index]=1;
 vertices(d.model,skirt).slice(0,2).forEach(v=>assert.ok(v.y>=.2479));
 skirt.morphTargetInfluences[index]=0;vertices(d.model,skirt).forEach((v,i)=>assert.ok(v.distanceTo(before[i])<1e-7));
});
