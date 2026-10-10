import * as T from 'three';
// Props and hands share the real placed surface; cancellation hides them in the same frame.
export function createChoreVisual(avatar){
 const root=new T.Group();root.name='FurnitureChore';avatar.root.add(root);
 const mat=color=>new T.MeshStandardMaterial({color,roughness:.8});
 const cloth=new T.Mesh(new T.BoxGeometry(.23,.025,.17),mat('#efb2a2'));cloth.name='ChoreCloth';root.add(cloth);
 const can=new T.Group();can.name='ChoreWateringCan';root.add(can);
 can.add(new T.Mesh(new T.CylinderGeometry(.10,.09,.17,14),mat('#aec9b7')));
 const spout=new T.Mesh(new T.CylinderGeometry(.024,.038,.18,10),mat('#aec9b7'));spout.rotation.z=-Math.PI/3;spout.position.set(.13,.03,0);can.add(spout);
 const plate=new T.Mesh(new T.CylinderGeometry(.13,.13,.025,20),mat('#f4efda'));plate.name='ChorePlate';root.add(plate);
 const water=new T.Mesh(new T.CylinderGeometry(.009,.009,1,6),new T.MeshBasicMaterial({color:'#b5e1e6',transparent:true,opacity:.65}));water.name='ChoreWater';root.add(water);
 function hide(){root.visible=false;avatar.root.userData.chore=null;}
 function update(plan,elapsed,moving){
  hide();if(!plan||moving||elapsed>=plan.duration)return;
  root.visible=true;cloth.visible=['wipe-table','tidy-bed','wash-dishes'].includes(plan.kind);can.visible=plan.kind==='water-plant';plate.visible=plan.kind==='wash-dishes';water.visible=['water-plant','wash-dishes'].includes(plan.kind);
  const q=new T.Vector3(plan.target.x,plan.target.y,plan.target.z),wave=Math.sin(elapsed*2.2)*.07;
  if(plan.kind==='water-plant'){q.y+=.3;q.x-=.10;}else q.x+=wave;
  avatar.contactPose({right:q,lean:plan.kind==='tidy-bed'?.12:.05});avatar.root.updateMatrixWorld(true);
  const hand=avatar.root.getObjectByName('Right_hand').getWorldPosition(new T.Vector3());
  cloth.position.copy(root.worldToLocal(q.clone()));cloth.rotation.y=-avatar.root.rotation.y;
  can.position.copy(root.worldToLocal(hand));can.rotation.set(0,-avatar.root.rotation.y,-.3);
  plate.position.copy(root.worldToLocal(new T.Vector3(plan.target.x,plan.target.y-.04,plan.target.z)));
  if(water.visible){const source=plan.kind==='water-plant'?hand.clone().add(new T.Vector3(.16,0,0)):new T.Vector3(plan.target.x,1.20,plan.target.z-.06),end=new T.Vector3(plan.target.x,plan.kind==='water-plant'?.42:1,plan.target.z),length=source.distanceTo(end);water.position.copy(root.worldToLocal(source.clone().add(end).multiplyScalar(.5)));water.quaternion.copy(avatar.root.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),source.clone().sub(end).normalize())));water.scale.y=length;}
  avatar.root.userData.chore={kind:plan.kind,piece:plan.piece,elapsed,target:plan.target,contact:hand.distanceTo(q)};
 }
 hide();return {update,hide};
}
