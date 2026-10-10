import * as T from 'three';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// Extend the existing hip rig at runtime. The original model, textures and
// standing shape stay intact; every outfit uses the same knee joints.
export function makeSeatedLegs(model,rig,meshes,morphs){
 const body=meshes.find(m=>m.userData.skinBase),joints=[],fabric=[];
 if(!body||!morphs)return {attach(){},fit(){},update(){},rests:[]};
 model.updateMatrixWorld(true);
 for(const {p,label}of rig){
  const hip=p.userData.bone;if(!label.endsWith('Leg')||!hip)continue;
  const at=p.position.clone();at.y*=.55;
  const knee=new T.Bone();knee.name=label.replace('Leg','Knee');
  const orientation=hip.getWorldQuaternion(new T.Quaternion()).invert().multiply(model.getWorldQuaternion(new T.Quaternion()));
  knee.position.copy(hip.worldToLocal(model.localToWorld(at.clone())));knee.quaternion.copy(orientation);hip.add(knee);
  model.updateMatrixWorld(true);
  const rows=[];const pos=body.geometry.attributes.position,indices=body.geometry.attributes.skinIndex,weights=body.geometry.attributes.skinWeight;
  const frame=new T.Matrix4().copy(model.matrixWorld).invert().multiply(body.matrixWorld);
  for(let i=0;i<pos.count;i++){
   const v=new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(frame);
   if(Math.abs(v.y-at.y)>.012)continue;
   let weight=0;for(let j=0;j<4;j++)if(body.skeleton.bones[indices.getComponent(i,j)]===hip)weight+=weights.getComponent(i,j);
   if(weight>.9)rows.push(i);
  }
  const local=new T.Quaternion().copy(hip.getWorldQuaternion(new T.Quaternion())).invert();
  const deltas={};for(const [key,index]of Object.entries(body.morphTargetDictionary||{})){
   if(!rows.length||!body.geometry.morphAttributes.position[index])continue;
   const delta=new T.Vector3(),attr=body.geometry.morphAttributes.position[index];
   for(const i of rows)delta.add(new T.Vector3().fromBufferAttribute(attr,i));
   delta.divideScalar(rows.length).applyMatrix3(new T.Matrix3().setFromMatrix4(frame));
   delta.sub(new T.Vector3().fromArray(morphs[label]?.[key]||[0,0,0])).applyQuaternion(local);
   deltas[key]=delta.toArray();
  }
  morphs[knee.name]=deltas;
  joints.push({hip,knee,at,hipPoint:p.position.clone(),hipRest:p.userData.rest,rest:orientation.clone(),inverse:knee.matrixWorld.clone().invert()});
 }
 function attach(mesh){
  if(!mesh.isSkinnedMesh||mesh.userData.seatedLegs)return;
  const geometry=mesh.geometry.clone(),indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,positions=geometry.attributes.position;
  if(!indices||!weights)return;
  const bones=[...mesh.skeleton.bones,...joints.map(j=>j.knee)],inverses=[...mesh.skeleton.boneInverses.map(m=>m.clone()),...joints.map(j=>j.inverse.clone())];
  const frame=new T.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
  const candidates=[],cloth=new Float32Array(positions.count*3),footwear=/_footwear|_shoes/.test(mesh.name);
  for(let i=0;i<positions.count;i++){
   const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(frame),row=[];
   
   for(let k=0;k<4;k++){
    const index=indices.getComponent(i,k),weight=weights.getComponent(i,k);if(!weight)continue;
    const joint=joints.find(j=>j.hip===bones[index]);
    if(!joint){row.push([index,weight]);continue;}
    const bend=footwear?1:smooth((joint.at.y-point.y+.03)/.06);
    if(bend<1)row.push([index,weight*(1-bend)]);
    if(bend>0)row.push([bones.indexOf(joint.knee),weight*bend]);
   }
   // Below the knee there is one leg influence. Preserve every original upper
   // body influence rather than replacing the authored hip blend.
   const combined=new Map();for(const [index,weight]of row)combined.set(index,(combined.get(index)||0)+weight);
   // The trouser inseam can carry both hips plus body. Both knees bend about
   // the same X axis while seated; share that bend at the seam to keep four
   // influences without discarding its original pelvis weights.
   if(combined.size>4){
    const knees=joints.map(j=>bones.indexOf(j.knee));
    if(knees.every(index=>combined.has(index))){
     const keep=knees[point.x<0?0:1],other=knees.find(index=>index!==keep);
     combined.set(keep,combined.get(keep)+combined.get(other));combined.delete(other);
    }
   }
   const influences=[...combined].filter(([,weight])=>weight>0);
   if(influences.length>4)throw Error('Knee binding exceeds four skin influences '+JSON.stringify({mesh:mesh.name,point:point.toArray(),influences:influences.map(([index,weight])=>[bones[index].name,weight])}));
   for(let k=0;k<4;k++){indices.setComponent(i,k,influences[k]?.[0]||0);weights.setComponent(i,k,influences[k]?.[1]||0);}
   const bodyWeight=influences.filter(([index])=>bones[index].name==='body').reduce((sum,[,weight])=>sum+weight,0);
   if(mesh.userData.outfit&&!footwear&&(point.y>joints[0].at.y-.01||bodyWeight>.4)&&point.y<joints[0].hipPoint.y+.04)candidates.push(i);
  }
  mesh.geometry=geometry;mesh.bind(new T.Skeleton(bones,inverses),mesh.bindMatrix);
  if(candidates.length){
   const values={...mesh.morphTargetDictionary},old=[...(mesh.morphTargetInfluences||[])];
   geometry.morphAttributes.position=[...(geometry.morphAttributes.position||[]),new T.Float32BufferAttribute(cloth,3)];
   geometry.morphAttributes.position.at(-1).name='seatDrape';mesh.updateMorphTargets();
   mesh.morphTargetDictionary={...values,seatDrape:geometry.morphAttributes.position.length-1};
   for(const index of Object.values(values))mesh.morphTargetInfluences[index]=old[index];
   fabric.push({mesh,candidates,attribute:geometry.morphAttributes.position.at(-1)});
  }
  mesh.userData.seatedLegs=true;
 }
 // Fit lower cloth against the posed surface after the real body morphs and
 // skeleton binding have been applied. Refit on a look change, never per frame.
 function fit(){
  const saved=joints.map(j=>[j.hip.quaternion.clone(),j.knee.quaternion.clone()]);
  for(const j of joints){j.hip.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2).multiply(j.hipRest);j.knee.quaternion.copy(j.rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI*7/18));}
  model.updateMatrixWorld(true);const inverse=model.matrixWorld.clone().invert();
  const floor=joints[0].hip.getWorldPosition(new T.Vector3()).applyMatrix4(inverse).y-.052;
  for(const {mesh,candidates,attribute}of fabric){
   const index=mesh.morphTargetDictionary.seatDrape,blend=mesh.morphTargetInfluences[index];mesh.morphTargetInfluences[index]=0;attribute.array.fill(0);
   const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
   for(const i of candidates){
    const point=mesh.getVertexPosition(i,new T.Vector3());mesh.localToWorld(point);point.applyMatrix4(inverse);
    const lift=Math.max(0,floor-point.y)*smooth((.14-point.z)/.06);if(!lift)continue;
    const skin=new T.Matrix4();skin.elements.fill(0);
    for(let k=0;k<4;k++){const bi=si.getComponent(i,k),weight=sw.getComponent(i,k);if(!weight)continue;const bone=new T.Matrix4().multiplyMatrices(mesh.skeleton.bones[bi].matrixWorld,mesh.skeleton.boneInverses[bi]);for(let n=0;n<16;n++)skin.elements[n]+=bone.elements[n]*weight;}
    const matrix=new T.Matrix4().multiplyMatrices(inverse,skin).multiply(mesh.bindMatrix);
    const delta=new T.Vector3(0,lift,0).applyMatrix3(new T.Matrix3().setFromMatrix4(matrix).invert());attribute.setXYZ(i,delta.x,delta.y,delta.z);
   }
   attribute.needsUpdate=true;mesh.morphTargetInfluences[index]=blend;
  }
  joints.forEach((j,i)=>{j.hip.quaternion.copy(saved[i][0]);j.knee.quaternion.copy(saved[i][1]);});model.updateMatrixWorld(true);
 }
 for(const mesh of meshes)attach(mesh);
 return {attach,fit,rests:joints.map(j=>[j.knee,j.rest]),update(blend){for(const joint of joints)joint.knee.quaternion.copy(joint.rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI*7/18*blend));}};
}
