import * as T from 'three';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// Fitted sleeves can arrive after the elbow rig was authored. Bind those
// surfaces to the same elbow as the skin, preserving their standing shape,
// material, UVs and body morphs. Cached outfit geometry is never mutated.
export function makeBentArms(model,rig,meshes){
 model.updateMatrixWorld(true);
 const arms=rig.filter(({p})=>p.userData.forearm).map(({p,label})=>{
  const upper=p.userData.bone,lower=p.userData.forearm,hand=model.getObjectByName(label==='leftArm'?'Left_hand':'Right_hand');
  const shoulder=model.worldToLocal(upper.getWorldPosition(new T.Vector3())),wrist=model.worldToLocal(hand.getWorldPosition(new T.Vector3()));
  return {side:label.startsWith('left')?'left':'right',upper,lower,shoulder,axis:wrist.sub(shoulder)};
 });
 function attach(mesh){
  const arm=arms.find(a=>a.side===mesh.userData.sleeveSide);
  if(!mesh.isSkinnedMesh||!arm||mesh.userData.bentArms)return;
  const geometry=mesh.geometry.clone(),indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,positions=geometry.attributes.position;
  const bones=[...mesh.skeleton.bones],inverses=mesh.skeleton.boneInverses.map(m=>m.clone());
  const upper=bones.indexOf(arm.upper);let lower=bones.indexOf(arm.lower);
  if(lower<0){lower=bones.length;bones.push(arm.lower);inverses.push(arm.lower.matrixWorld.clone().invert());}
  const frame=new T.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
  for(let i=0;i<positions.count;i++){
   const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(frame);
   const bend=smooth((point.sub(arm.shoulder).dot(arm.axis)/arm.axis.lengthSq()-.40)/.24),row=new Map();let total=0;
   for(let k=0;k<4;k++){const index=indices.getComponent(i,k),weight=weights.getComponent(i,k);if(index===upper||index===lower)total+=weight;else if(weight)row.set(index,(row.get(index)||0)+weight);}
   if(total*(1-bend)>0)row.set(upper,total*(1-bend));if(total*bend>0)row.set(lower,total*bend);
   if(row.size>4)throw Error('Sleeve binding exceeds four skin influences: '+mesh.name);
   const values=[...row];for(let k=0;k<4;k++){indices.setComponent(i,k,values[k]?.[0]||0);weights.setComponent(i,k,values[k]?.[1]||0);}
  }
  mesh.geometry=geometry;mesh.bind(new T.Skeleton(bones,inverses),mesh.bindMatrix);mesh.userData.bentArms=true;
 }
 meshes.forEach(attach);return {attach};
}
