import * as T from 'three';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
const SEATED_KNEE=Math.PI*5/18; // Let the shoes hang forward of a supported pelvis.
export const WORK_SEATED_HIP=.20;
const WORK_SEATED_KNEE=Math.PI/9;
// Conservative extent of the posed trousers. A 2:1 rise returns the cotton
// smoothly to the torso above the lap. Prefix/suffix maxima keep fitting
// O(n log n + m log n), rather than scanning the denim for every cloth vertex.
function lapExtent(points){
 const rows=points.slice().sort((a,b)=>a[0]-b[0]),before=[],after=[];
 for(let i=0;i<rows.length;i++)before[i]=Math.max(before[i-1]??-Infinity,rows[i][1]+2*rows[i][0]);
 for(let i=rows.length-1;i>=0;i--)after[i]=Math.max(after[i+1]??-Infinity,rows[i][1]);
 return y=>{let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid][0]<y)lo=mid+1;else hi=mid;}return Math.max((before[lo-1]??-Infinity)-2*y,after[lo]??-Infinity);};
}
// Extend the existing hip rig at runtime. The original model, textures and
// standing shape stay intact; every outfit uses the same knee joints.
export function makeSeatedLegs(model,rig,meshes,morphs){
 const body=meshes.find(m=>m.userData.skinBase),joints=[],fabric=[];let fittedAngle=null,work=false,fittedWork=null,straight=false,fittedStraight=null;
 if(!body||!morphs)return {attach(){},fit(){},setWork(){},setStraight(){},needsFit(){return false;},update(){},rests:[]};
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
  const cotton=!!mesh.userData.continuousCottonVersion;
  const geometry=mesh.geometry.clone(),indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,positions=geometry.attributes.position;
  if(!indices||!weights)return;
  const bones=[...mesh.skeleton.bones,...joints.map(j=>j.knee)],inverses=[...mesh.skeleton.boneInverses.map(m=>m.clone()),...joints.map(j=>j.inverse.clone())];
  const frame=new T.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
  let kneeAngle=SEATED_KNEE;const candidates=[],cloth=new Float32Array(positions.count*3),footwear=/_footwear|_shoes/.test(mesh.name);
  for(let i=0;i<positions.count;i++){
   const point=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(frame),row=[];
   if(footwear&&point.y>.12&&point.z<-.14)kneeAngle=Math.PI*3/20;

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
   if(mesh.userData.outfit&&!footwear&&(cotton||(point.y>joints[0].at.y-.01||bodyWeight>.4)&&point.y<joints[0].hipPoint.y+.04))candidates.push(i);
  }
  mesh.geometry=geometry;mesh.bind(new T.Skeleton(bones,inverses),mesh.bindMatrix);
  if(candidates.length){
   const values={...mesh.morphTargetDictionary},old=[...(mesh.morphTargetInfluences||[])];
   geometry.morphAttributes.position=[...(geometry.morphAttributes.position||[]),new T.Float32BufferAttribute(cloth,3)];
   geometry.morphAttributes.position.at(-1).name='seatDrape';mesh.updateMorphTargets();
   mesh.morphTargetDictionary={...values,seatDrape:geometry.morphAttributes.position.length-1};
   for(const index of Object.values(values))mesh.morphTargetInfluences[index]=old[index];
   fabric.push({mesh,candidates,attribute:geometry.morphAttributes.position.at(-1)});
   if(cotton)mesh.userData.seatDrapeAllPoses=true;
  }
  mesh.userData.seatedLegs=true;if(footwear)mesh.userData.seatKneeAngle=kneeAngle;
 }
 // Fit lower cloth against the posed surface after the real body morphs and
 // skeleton binding have been applied. Refit on a look change, never per frame.
 // Chunky rear cuffs need a more open knee to clear the seat underside.
 function angle(){let a=work?WORK_SEATED_KNEE:SEATED_KNEE;for(const mesh of meshes){if(!mesh.userData.seatKneeAngle)continue;let visible=true;for(let o=mesh;o;o=o.parent)visible&&=o.visible;if(visible)a=Math.min(a,work&&mesh.userData.seatKneeAngle<SEATED_KNEE?Math.PI/18:mesh.userData.seatKneeAngle);}return a;}
 function fit(){
  const bend=straight?0:angle();fittedAngle=bend;fittedWork=work;fittedStraight=straight;
  const saved=joints.map(j=>[j.hip.quaternion.clone(),j.knee.quaternion.clone()]);
  for(const j of joints){j.hip.quaternion.setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2+(work?WORK_SEATED_HIP:0)).multiply(j.hipRest);j.knee.quaternion.copy(j.rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),bend));}
  model.updateMatrixWorld(true);const inverse=model.matrixWorld.clone().invert();
  const floor=joints[0].hip.getWorldPosition(new T.Vector3()).applyMatrix4(inverse).y-.052;
  for(const {mesh,candidates,attribute}of fabric){
   const index=mesh.morphTargetDictionary.seatDrape,blend=mesh.morphTargetInfluences[index],seated=mesh.morphTargetDictionary.seated,previous=mesh.morphTargetInfluences[seated];if(seated!=null)mesh.morphTargetInfluences[seated]=1;mesh.morphTargetInfluences[index]=0;attribute.array.fill(0);
   // The separate cotton shell has no authored seated morph: fit its hem over
   // the real raised denim, including body sliders. Gather the lower front
   // at the waist before fitting its depth: pushing a standing-length hem
   // straight forward makes a flat apron. Keep the upper torso untouched.
   const lap=[];
   if(mesh.userData.seatDrapeAllPoses){
    for(const under of meshes){if(under.userData.outfit!==mesh.userData.outfit||under===mesh||under.userData.sleeveSide||/_footwear|_shoes/.test(under.name))continue;
     for(let i=0;i<under.geometry.attributes.position.count;i++){const v=under.localToWorld(under.getVertexPosition(i,new T.Vector3())).applyMatrix4(inverse);lap.push([v.y,v.z,Math.abs(v.x)]);}
    }
   }
   const frontAt=lapExtent(lap),sideAt=lapExtent(lap.map(v=>[v[0],v[2]]));
   const top=lap.reduce((y,v)=>Math.max(y,v[0]),-Infinity);
   let hem=Infinity;
   if(lap.length)for(const i of candidates){const v=mesh.localToWorld(mesh.getVertexPosition(i,new T.Vector3())).applyMatrix4(inverse);hem=Math.min(hem,v.y);}
   const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
   for(const i of candidates){
    const point=mesh.getVertexPosition(i,new T.Vector3());mesh.localToWorld(point);point.applyMatrix4(inverse);
    let lift=Math.max(0,floor-point.y)*smooth((.14-point.z)/.06),forward=0,side=0;
    if(lap.length){
     // Smooth compression preserves ring order and the sewn hem thickness.
     // Front and side weights retain the round shirt outline and long back.
     const gather=Math.max(0,top-.022-hem)*smooth((top+.12-point.y)/(top+.12-hem))*smooth((point.z+.10)/.12);
     lift=Math.max(lift,gather);
     const y=point.y+lift,front=frontAt(y);
     forward=Math.max(0,front+.018-point.z*.85)*smooth((point.z+.005)/.115);
     side=Math.sign(point.x)*Math.max(0,sideAt(y)+.014-Math.abs(point.x)*.95)*smooth(Math.abs(point.x)/.14);
    }
    if(!lift&&!forward&&!side)continue;
    const skin=new T.Matrix4();skin.elements.fill(0);
    for(let k=0;k<4;k++){const bi=si.getComponent(i,k),weight=sw.getComponent(i,k);if(!weight)continue;const bone=new T.Matrix4().multiplyMatrices(mesh.skeleton.bones[bi].matrixWorld,mesh.skeleton.boneInverses[bi]);for(let n=0;n<16;n++)skin.elements[n]+=bone.elements[n]*weight;}
    const matrix=new T.Matrix4().multiplyMatrices(inverse,skin).multiply(mesh.bindMatrix);
    const delta=new T.Vector3(side,lift,forward).applyMatrix3(new T.Matrix3().setFromMatrix4(matrix).invert());attribute.setXYZ(i,delta.x,delta.y,delta.z);
   }
   attribute.needsUpdate=true;mesh.morphTargetInfluences[index]=blend;if(seated!=null)mesh.morphTargetInfluences[seated]=previous;
  }
  joints.forEach((j,i)=>{j.hip.quaternion.copy(saved[i][0]);j.knee.quaternion.copy(saved[i][1]);});model.updateMatrixWorld(true);
 }
 for(const mesh of meshes)attach(mesh);
 return {attach,fit,setWork:value=>{work=!!value;},setStraight:value=>{straight=!!value;},needsFit:()=>fittedAngle!==(straight?0:angle())||fittedWork!==work||fittedStraight!==straight,rests:joints.map(j=>[j.knee,j.rest]),update(blend){const bend=angle();for(const joint of joints)joint.knee.quaternion.copy(joint.rest).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),bend*blend));}};
}
