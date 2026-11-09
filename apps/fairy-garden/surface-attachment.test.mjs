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
   assert.ok(Math.abs(p.z-((pose<6?.12:.19)+.08*cloth.morphTargetInfluences[0]+.003))<1e-6);
  }
 }
 first.visible=second.visible=false;mount.update();assert.equal(pin.visible,false);mount.dispose();assert.equal(pin.parent,null);
});

test('整张工牌保持平面，避开网格采样之间的凸起，也避开跨过牌边的领口三角形',()=>{
 const model=new T.Group(),body=new T.Group();model.add(body);
 const shirt=new T.Mesh(new T.PlaneGeometry(.5,.8),new T.MeshBasicMaterial({side:T.DoubleSide}));shirt.position.set(0,.4,.12);shirt.userData.outfit='shirt';body.add(shirt);
 const ridge=new T.Mesh(new T.BoxGeometry(.006,.006,.008),new T.MeshBasicMaterial());ridge.position.set(.082,.505,.148);ridge.userData.outfit='collar';body.add(ridge);
 // All ridge corners fall between the old 5×7 ray sample lines.
 const pin=new T.Mesh(new T.PlaneGeometry(.13,.17,4,6)),mount=makeSurfaceAttachment(model,body,pin,()=>new T.Vector3(.1,.5,0));mount.update();assert.ok(mount.inspect().fitted);
 const pos=pin.geometry.attributes.position;
 for(let i=0;i<pos.count;i++)assert.ok(Math.abs(pos.getZ(i)-.155)<1e-6,'card must clear the entire raised ridge');
 for(let i=0;i<40;i++){
  const x=.04+i*.003,y=.50,ray=new T.Raycaster(new T.Vector3(x,y,1),new T.Vector3(0,0,-1)),card=ray.intersectObject(pin)[0],cloth=ray.intersectObjects([shirt,ridge])[0];
  if(card&&cloth)assert.ok(card.point.z-cloth.point.z>=.00299,'no part of the shirt may hide the card face');
 }
 const edgeGeometry=new T.BufferGeometry();edgeGeometry.setAttribute('position',new T.Float32BufferAttribute([.02,.501,.17,.036,.502,.17,.02,.503,.17],3));
 const edge=new T.Mesh(edgeGeometry,new T.MeshBasicMaterial({side:T.DoubleSide}));edge.userData.outfit='edge-collar';body.add(edge);mount.update();
 for(let i=0;i<pos.count;i++)assert.ok(Math.abs(pos.getZ(i)-.173)<1e-6,'the collar triangle crossing the card boundary must stay behind the whole face');
});
