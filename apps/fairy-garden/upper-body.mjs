import * as T from 'three';
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
// Articulate above the hips. The face is skinned, while hair is attached to
// HeadAnchor: both must follow the same neck joint. Legs and shoes stay planted.
export function makeUpperBody(model,rig,meshes,morphs){
 const body=model.getObjectByName('body'),anchor=model.getObjectByName('HeadAnchor'),skin=meshes.find(m=>m.userData.skinBase);
 if(!body?.isBone||!anchor||!skin||!morphs)return {reset(){},apply(){},suspend(){return {};},resume(){},rests:[]};
 model.updateMatrixWorld(true);
 const neck=new T.Bone();neck.name='neck';const at=new T.Vector3(0,.735,-.01302);neck.position.copy(body.worldToLocal(model.localToWorld(at.clone())));body.add(neck);model.updateMatrixWorld(true);
 morphs.neck={height:[0,.25,0]};
 const geometry=skin.geometry.clone(),indices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight,positions=geometry.attributes.position,bones=[...skin.skeleton.bones,neck],inverses=[...skin.skeleton.boneInverses.map(m=>m.clone()),neck.matrixWorld.clone().invert()],bodyIndex=bones.indexOf(body),neckIndex=bones.indexOf(neck);
 for(let i=0;i<positions.count;i++){
  const blend=smooth((positions.getY(i)-.70)/.06),row=new Map();
  for(let k=0;k<4;k++){const bi=indices.getComponent(i,k),w=weights.getComponent(i,k);if(!w)continue;if(bi===bodyIndex){row.set(bi,(row.get(bi)||0)+w*(1-blend));row.set(neckIndex,(row.get(neckIndex)||0)+w*blend);}else row.set(bi,(row.get(bi)||0)+w);}
  const entries=[...row].filter(([,w])=>w>0);if(entries.length>4)throw Error('Neck exceeds four skin influences');for(let k=0;k<4;k++){indices.setComponent(i,k,entries[k]?.[0]||0);weights.setComponent(i,k,entries[k]?.[1]||0);}
 }
 skin.geometry=geometry;skin.bind(new T.Skeleton(bones,inverses),skin.bindMatrix);
 const arms=rig.filter(r=>r.label.endsWith('Arm')).flatMap(({p})=>[p,p.userData.bone]).filter(Boolean),driven=[body,anchor,...arms];
 let saved=null,angles={lean:0,tilt:0,turn:0,nod:0};
 function reset(){if(!saved)return;for(const [o,pos,q]of saved){o.position.copy(pos);if(o===body||o===anchor)o.quaternion.copy(q);else o.quaternion.premultiply(saved.waist.clone().invert());}neck.quaternion.identity();saved=null;angles={lean:0,tilt:0,turn:0,nod:0};}
 function apply(pose){const next={...angles};for(const key of Object.keys(next))if(pose[key]!=null)next[key]+=pose[key];reset();angles=next;if(!Object.values(next).some(x=>x))return;
  saved=driven.map(o=>[o,o.position.clone(),o.quaternion.clone()]);const waist=new T.Quaternion().setFromEuler(new T.Euler(next.tilt,next.turn,next.lean)),nod=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),next.nod),pivot=body.position.clone();saved.waist=waist;
  for(const o of driven){o.position.sub(pivot).applyQuaternion(waist).add(pivot);o.quaternion.premultiply(waist);}
  neck.quaternion.copy(nod);const original=saved.find(([o])=>o===anchor)[1],neckPoint=at.clone();neckPoint.y+=original.y-.94833;
  // Anchor is in DollRig space, neck is in the rotated body frame.
  anchor.position.copy(original).sub(neckPoint).applyQuaternion(nod).add(neckPoint).sub(pivot).applyQuaternion(waist).add(pivot);anchor.quaternion.copy(saved.find(([o])=>o===anchor)[2]).premultiply(nod).premultiply(waist);
  model.updateWorldMatrix(true,true);
 }
 return {reset,apply,suspend(){const pose={...angles};reset();return pose;},resume(pose){apply(pose);},rests:[[body,body.quaternion.clone()],[neck,new T.Quaternion()]]};
}
