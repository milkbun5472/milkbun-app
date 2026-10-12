import * as T from 'three';

// Measure the posed pelvis, not the model origin or a wardrobe-wide box (which
// includes dangling hems and shoes). The same body morphs and knee rig are used
// by every outfit; the support sample is rebuilt when the hip/body changes.
export function makeSeatContact(root,model,rig,meshes){
 const body=meshes.find(m=>m.userData.skinBase),hip=rig.find(r=>r.label==='leftLeg')?.p;
 let signature='',samples=[];
 const point=new T.Vector3(),local=new T.Vector3(),frame=new T.Matrix4(),inverse=new T.Matrix4();
 function sample(){
  if(!body||!hip)return [];
  const pos=body.geometry.attributes.position,attrs=body.geometry.morphAttributes.position||[],weights=body.morphTargetInfluences||[];
  const dimensions=Object.entries(body.morphTargetDictionary||{}).filter(([key])=>!['seated','seatDrape'].includes(key));
  const key=[hip.position.toArray(),...dimensions.map(([,i])=>weights[i])].join(',');
  if(signature===key)return samples;
  signature=key;samples=[];frame.copy(model.matrixWorld).invert().multiply(body.matrixWorld);
  for(let i=0;i<pos.count;i++){
   point.fromBufferAttribute(pos,i);
   for(const [,index]of dimensions)if(weights[index]&&attrs[index])point.addScaledVector(new T.Vector3().fromBufferAttribute(attrs[index],i),weights[index]);
   point.applyMatrix4(frame);
   if(Math.abs(point.x)<Math.abs(hip.position.x)*2.1&&point.y>hip.position.y-.065&&point.y<hip.position.y+.035&&point.z<.04)samples.push(i);
  }
  return samples;
 }
 return {settle(surface,blend=1){
  // SkinnedMesh.updateMatrixWorld also refreshes its attached bind inverse.
  // updateWorldMatrix alone leaves yesterday's inverse when the root moves.
  root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);inverse.copy(root.matrixWorld).invert();let bottom=Infinity;
  for(const i of sample()){
   body.localToWorld(body.getVertexPosition(i,point));local.copy(point).applyMatrix4(inverse);
   if(local.z<-.02&&local.z>-.30)bottom=Math.min(bottom,point.y);
  }
  if(!Number.isFinite(bottom)||!Number.isFinite(surface))return;
  const shift=(surface-bottom)*blend;root.position.y+=shift;root.updateMatrixWorld(true);
  root.userData.seatContact={surface,bottom:bottom+shift,shift,samples:samples.length};
 }};
}
