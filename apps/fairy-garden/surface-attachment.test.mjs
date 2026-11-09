import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('./vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeSurfaceAttachment}=await import('./surface-attachment.mjs');
test('胸前挂件贴可见衣面，随蒙皮/形变/转身移动，换衣后重新贴合',()=>{
 const model=new T.Group(),body=new T.Bone();model.add(body);body.name='body';
 function shirt(z,name){const g=new T.PlaneGeometry(.7,.8,8,8);g.translate(0,.4,z);const n=g.attributes.position.count;
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(new Uint16Array(n*4),4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(Array.from({length:n*4},(_,i)=>i%4===0?1:0),4));
  g.morphAttributes.position=[g.attributes.position.clone()];for(let i=0;i<n;i++)g.morphAttributes.position[0].setZ(i,z+.08);
  const m=new T.SkinnedMesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=name;m.userData.outfit=name;model.add(m);model.updateMatrixWorld(true);m.bind(new T.Skeleton([body]));m.updateMorphTargets();return m;
 }
 const first=shirt(.12,'shirt'),second=shirt(.19,'jacket');second.visible=false;
 const pin=new T.Mesh(new T.PlaneGeometry(.13,.17,4,6)),mount=makeSurfaceAttachment(model,body,pin,()=>new T.Vector3(.1,.5,0));
 for(let pose=0;pose<12;pose++){
  if(pose===6){first.visible=false;second.visible=true;}const cloth=pose<6?first:second;
  body.rotation.set(pose*.03,pose*.21,pose*.02);cloth.morphTargetInfluences[0]=pose%3*.3;model.position.set(pose*.1,-pose*.04,pose*.02);mount.update();
  assert.ok(mount.inspect().fitted);assert.deepEqual(mount.inspect().surfaces,[cloth.name]);
  for(let i=0;i<pin.geometry.attributes.position.count;i++){
   const p=pin.localToWorld(new T.Vector3().fromBufferAttribute(pin.geometry.attributes.position,i));body.worldToLocal(p);
   assert.ok(Math.abs(p.z-((pose<6?.12:.19)+.08*cloth.morphTargetInfluences[0]+.002))<1e-6);
  }
 }
 first.visible=second.visible=false;mount.update();assert.equal(pin.visible,false);mount.dispose();assert.equal(pin.parent,null);
});
