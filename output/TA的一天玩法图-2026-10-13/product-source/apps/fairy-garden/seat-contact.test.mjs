import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeSeatContact}=await import('./seat-contact.mjs');
test('坐高按实际后臀表面校正，前倾与四朝向不丢接触且连续校正不累积漂移',()=>{
 for(const heading of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const tilt of [0,.025,.2,-Math.PI/2]){
  const parent=new T.Group(),root=new T.Group(),model=new T.Group(),hip=new T.Bone();parent.add(root);root.add(model);model.add(hip);parent.rotation.y=heading;model.rotation.x=tilt;hip.position.y=.3;
  const geometry=new T.BoxGeometry(.18,.06,.12);geometry.translate(0,.29,-.06);const count=geometry.attributes.position.count;geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(count*4),4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:count*4},(_,i)=>i%4===0?1:0),4));
  const body=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());body.userData.skinBase=true;model.add(body);parent.updateMatrixWorld(true);body.bind(new T.Skeleton([hip]));const seat=makeSeatContact(root,model,[{label:'leftLeg',p:{position:new T.Vector3(.075,.3,0)}}],[body]);
  for(let frame=0;frame<100;frame++){
   root.position.y=.31+Math.sin(frame)*.004;seat.settle(.53);let bottom=Infinity;for(let i=0;i<count;i++){if(geometry.attributes.position.getZ(i)>-.02)continue;const v=body.localToWorld(body.getVertexPosition(i,new T.Vector3()));bottom=Math.min(bottom,v.y);}
   assert.ok(Math.abs(bottom-.53)<1e-6,JSON.stringify({heading,tilt,frame,bottom,contact:root.userData.seatContact}));assert.ok(Math.abs(root.position.y)<1);assert.ok(root.matrixWorld.elements.every(Number.isFinite));
  }
  geometry.dispose();body.material.dispose();
 }
});
