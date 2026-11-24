import {bindRobeArmhole} from './robe-armhole.mjs?v=fg-1b632cf8aa8b2311';
import {bindCoatSleeves} from './coat-sleeves.mjs?v=fg-1b632cf8aa8b2311';
import {academyForearmCores} from './academy-sleeve-samples.mjs?v=fg-1b632cf8aa8b2311';
import {bindAcademySleeve} from './academy-sleeve-weights.mjs?v=fg-1b632cf8aa8b2311';
import {createSleeveEase} from './sleeve-ease.mjs?v=fg-1b632cf8aa8b2311';
import {createSleeveEnvelope} from './sleeve-envelope.mjs?v=fg-1b632cf8aa8b2311';
import {createClothTransportKernel,clothRotationReferences} from './cloth-transport-kernel.mjs?v=fg-1b632cf8aa8b2311';
import {fitRigid} from './rigid-fit.mjs?v=fg-1b632cf8aa8b2311';
// Transport a material direction with the arm, then align it to the body surface.
// The reference contains axial roll that a direction-only reconstruction cannot recover.
export function sleeveRotation(T,restAxis,posedAxis,reference){
 return new T.Quaternion().setFromUnitVectors(restAxis.clone().applyQuaternion(reference),posedAxis).multiply(reference).normalize();
}
// Blend the frame, not two rotated surface points: position averaging shrinks
// the sleeve section when the forearm and cuff turn in different directions.
export function blendSleeveCuffFrame(restCenter,center,rotation,cuffMatrix,cuffRotation,amount,scratch){
 center.lerp(scratch.copy(restCenter).applyMatrix4(cuffMatrix),amount);
 rotation.slerp(cuffRotation,amount);
}
// Match the arm interpolation when a garment-specific pose is interrupted.
export function advanceClothPoseBlend(current,amount,poseBlend){
 const target=Math.max(0,Math.min(1,amount||0)),next=current+(target-current)*poseBlend;
 return Math.abs(next-target)<1e-6?target:next;
}
export {advanceClothPoseBlend as advancePhoneCuffBlend};
export function garmentVertexIds(row, count) {
 const ids=row.ids || Array.from({length:count},(_,i)=>i);
 if(row.name!=='outfit_bamboo_trim' || !row.ids)return ids;
 const included=new Set(ids);
 for(let i=0;i<count;i++){
  for(let k=4*i;k<4*i+4;k++){
   if((row.skinIndex[k]===2 || row.skinIndex[k]===5) && row.skinWeight[k]>.99)included.add(i);
  }
 }
 return [...included];
}
// Bind once in the fitted rest pose. Keep the material correspondences fixed
// throughout the gesture, including when the bent arm passes near the torso.
function bindCheerSleeves(q,entries){
 const rest=q.dimensionRest, influence=q.body.geometry.attributes.skinArmInfluence;
 const T=q.T, cell=.04, grid=new Map(), seen=new Set();
 const key=(x,y,z)=>x+','+y+','+z;
 for(let i=0;i<rest.length/3;i++){
  if(influence.getX(i)<.1)continue;
  const k=3*i,x=rest[k],y=rest[k+1],z=rest[k+2],point=key(x,y,z);
  if(seen.has(point))continue;
  seen.add(point);
  const bucket=key(Math.floor(x/cell),Math.floor(y/cell),Math.floor(z/cell));
  if(!grid.has(bucket))grid.set(bucket,[]);
  grid.get(bucket).push(i);
 }
 // Evaluate signed fabric clearance in the fitted body's rest geometry.
 // Tangential offsets retain stripes, folds and the original fabric cut.
 const normals=new Float64Array(rest.length),index=q.body.geometry.index.array;
 const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let j=0;j<index.length;j+=3){
  a.fromArray(rest,index[j]*3);
  b.fromArray(rest,index[j+1]*3).sub(a);
  c.fromArray(rest,index[j+2]*3).sub(a);b.cross(c);
  for(let t=j;t<j+3;t++){const k=index[t]*3;normals[k]+=b.x;normals[k+1]+=b.y;normals[k+2]+=b.z;}
 }
 const neighborhoods=new Map();
 function nearby(cx,cy,cz){
  const k=key(cx,cy,cz);
  if(!neighborhoods.has(k)){
   const candidates=[];
   for(let a=cx-2;a<=cx+2;a++)for(let b=cy-2;b<=cy+2;b++)for(let c=cz-2;c<=cz+2;c++){
    const bucket=grid.get(key(a,b,c));
    if(bucket)candidates.push(...bucket);
   }
   neighborhoods.set(k,candidates);
  }
  return neighborhoods.get(k);
 }
 for(const entry of entries){
  const {row,ids}=entry;
  if(!row.followArms||row.linear)continue;
  const anchors=new Map();
  for(const id of ids){
   let own=0;
   for(let k=4*id;k<4*id+4;k++)if([1,2,4,5].includes(row.skinIndex[k]))own+=row.skinWeight[k];
   if(own<=.05)continue;
   const k=3*id,x=row.rest[k],y=row.rest[k+1],z=row.rest[k+2];
   const cx=Math.floor(x/cell),cy=Math.floor(y/cell),cz=Math.floor(z/cell);
   const nearest=[];
   for(const i of nearby(cx,cy,cz)){
     const j=3*i,dx=x-rest[j],dy=y-rest[j+1],dz=z-rest[j+2],distance=dx*dx+dy*dy+dz*dz;
     if(distance>.08**2||nearest.length===4&&distance>=nearest[3].distance)continue;
     nearest.push({i,dx,dy,dz,distance});nearest.sort((l,r)=>l.distance-r.distance);nearest.length=Math.min(4,nearest.length);
   }
   if(!nearest.length)continue;
   let total=0;for(const p of nearest){p.weight=1/(.000025+p.distance)**2;total+=p.weight;}
   // Allow extra ease for the robe and sweatshirt. Where a sleeve
   // cuts into skin, restore a small lining clearance at that same point.
   const ease=/^outfit_(bamboo|berry)_/.test(row.name)?.032:.021;
   for(const p of nearest){
    p.weight/=total;
    a.fromArray(normals,p.i*3).normalize();
    const clearance=p.dx*a.x+p.dy*a.y+p.dz*a.z;
    const hem=clearance<.003?.003-clearance:-.72*Math.max(0,clearance-ease);
    p.dx+=a.x*hem;p.dy+=a.y*hem;p.dz+=a.z*hem;
   }
   // The cuff rim and skin coverage plane already share a fitted frame.
   const plane=q.bodyBackedClothData.cuffPlanes[x<0?0:1];
   const depth=plane.normal.reduce((sum,n,j)=>sum+n*(plane.center[j]-row.rest[k+j]),0);
   const t=Math.max(0,Math.min(1,depth/.04));
   anchors.set(id,{nearest,own:own*t*t*(3-2*t)});
  }
  entry.cheerAnchors=anchors;
 }
 const target=new T.Vector3(),offset=new T.Vector3(),center=new T.Vector3(),matrix=new T.Matrix3();
 return (entry,id,point,amount)=>{
  if(!amount||!q.posedBuffer)return;
  const anchor=entry.cheerAnchors?.get(id);if(!anchor)return;
  target.set(0,0,0);
  for(const p of anchor.nearest){
   offset.set(p.dx,p.dy,p.dz);
   const radius=offset.length();
   offset.applyMatrix3(matrix.fromArray(q.poseLinear,p.i*9)).setLength(radius);
   center.fromArray(q.posedBuffer,p.i*3).add(offset);
   target.addScaledVector(center,p.weight);
  }
  point.lerp(target,amount*anchor.own);
 };
}
export function install(q,{materialCuff=false,envelope=null}={}){const T=q.T,d=q.bodyBackedClothData;
const outfits=q.outfits;
let o=outfits[d.meshId];
if(!o)throw Error('DQ garment missing');
const g=o.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
if(g.attributes.position.count*3!==d.rest.length)throw Error('DQ topology mismatch');
for(const k of Object.keys(d.dims))if(Math.abs(q.dimensionValues[k]-d.dims[k])>1e-8)throw Error('Cloth binding dimension mismatch');
const entries=[d,...(d.parts||[])].map(row=>{let mesh=outfits[row.meshId];
if(!mesh||mesh.geometry.attributes.position.count*3!==row.rest.length)throw Error('Garment part mismatch');
// The cross-collar sash and ties occupy a separate waist-only mesh.
if(row.name==='outfit_bamboo_accent'){
 const weights=new Float64Array(row.skinWeight.length);
 for(let i=0;i<weights.length;i+=4)weights[i]=1;
 row={...row,linear:true,followArms:false,bentSkinWeight:null,
  skinIndex:new Uint16Array(weights.length),skinWeight:weights};
}
const sourceIds=garmentVertexIds(row,mesh.geometry.attributes.position.count),skin=mesh.geometry.attributes;
// Transport arm-influenced cloth and retain the authored waist corrections.
// Linear waist rows remove stray arm influences; skipping them moves belts.
const ids=row.linear?sourceIds:sourceIds.filter(i=>{// Include torso-weighted outer shoulder cloth in the pose correction.
if(envelope && row===d){
 const side=row.rest[i*3]<0?0:1, shoulder=q.rigFit[side].shoulder;
 if(Math.abs(row.rest[i*3])-Math.abs(shoulder[0])>-.018 && row.rest[i*3+1]>shoulder[1]-.002)return true;
}
for(let k=0;k<4;k++){const j=i*4+k;if([1,2,4,5].includes(row.skinIndex[j])&&Math.max(row.skinWeight[j],row.bentSkinWeight?.[j]||0)>0)return true;const bone=mesh.skeleton.bones[skin.skinIndex.getComponent(i,k)];if(/Arm$|Forearm$/.test(bone?.name||'')&&skin.skinWeight.getComponent(i,k)>0)return true;}return false;});
// Keep the knitted cuff and shoulder seam at their authored radii. Take
// fullness out of the sleeve between them in the local arm cross-section.
if (ids.length && /^outfit_berry_(left|right)_sleeve$/.test(row.name)) {
 // Use the actual geometry side; mesh labels may follow the camera convention.
 const sign=Math.sign(row.rest[ids[0]*3]);
 const fitSide=sign<0?0:1;
 const cuff=new T.Vector3(...d.cuffPlanes[fitSide].center);
 const shoulder=new T.Vector3(...q.rigFit[fitSide].shoulder);
 const axis=cuff.clone().sub(shoulder),length=axis.length();axis.normalize();
 const radial=new T.Vector3(),source=row.rest;
 row={...row,rest:source.slice()};
 for(const i of ids){
  radial.fromArray(source,i*3).sub(shoulder);
  const along=radial.dot(axis),fraction=Math.max(0,Math.min(1,along/length));
  const reduction=.16*Math.sin(Math.PI*fraction)**2;
  radial.addScaledVector(axis,-along).multiplyScalar(-reduction);
  row.rest[i*3]+=radial.x;row.rest[i*3+1]+=radial.y;row.rest[i*3+2]+=radial.z;
 }
}
q.transportKernels??=new Map();let kernel=null;if(q.numericCore&&!row.linear&&ids.length){kernel=q.transportKernels.get(mesh.geometry);if(!kernel){kernel=createClothTransportKernel(q.numericCore,mesh);q.transportKernels.set(mesh.geometry,kernel)}kernel.configure(row,ids);}
return {row,o:mesh,g:mesh.geometry,weights:Float64Array.from(row.skinWeight),references:clothRotationReferences(row,mesh.skeleton.bones),ids,kernel};
});
const bodyPosed=new Float64Array(q.dimensionRest.length),virtualSI=d.skinIndex,virtualSW=d.skinWeight;
const linearPoint=new T.Vector3(),bodyToCloth=new T.Matrix4(),bodyNormalToCloth=new T.Matrix3();
const P=new T.Vector3(),N=new T.Vector3(),V=new T.Vector3(),R=new T.Quaternion(),D=new T.Quaternion(),C=new T.Quaternion(),trans=new T.Quaternion(),mat=new T.Matrix4(),mat3=new T.Matrix3();
const smooth01=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
if(envelope&&!q.numericCore)throw Error('Sleeve envelope requires the shared motion core');
q.sleeveEnvelope?.dispose();
const sleeveEnvelope=q.sleeveEnvelope=envelope?createSleeveEnvelope(T,envelope,q.dimensionRest,entries,q.body.geometry.index.array,q.numericCore,q.body.geometry.attributes.skinArmInfluence.array):null;
const cheerGarment=/^outfit_(bamboo|heritage|argyle|berry)_/.test(d.name);
const followBody=cheerGarment?bindCheerSleeves(q,entries):null;
const vestShirt=d.name==='outfit_argyle_trim';
const coatFit=['outfit_heritage_cloth','outfit_bamboo_cloth'].includes(d.name)||vestShirt?bindCoatSleeves(q,vestShirt?entries.filter(e=>e.row===d):entries,d.cuffPlanes):null;
const robeArmhole=d.name==='outfit_bamboo_cloth'?bindRobeArmhole(q,entries.find(e=>e.row===d),d.cuffPlanes):null;
const fitEase=d.name==='outfit_heritage_cloth'?null:createSleeveEase(T,entries,d.name==='outfit_bamboo_cloth'?d.cuffPlanes:null);
const academyFit=/^outfit_(argyle|berry|linen)_/.test(d.name)?bindAcademySleeve(q,entries,d.cuffPlanes):null;
const previous=q.applyLiveFair;
q.applyLiveFair=()=>{robeArmhole?.restore();previous();
const activation=sleeveEnvelope?1:q.poseCurveCurrent.activation;
if(q.bodyBackedCuffUniforms)q.bodyBackedCuffUniforms.enabled.value=activation;
if(activation===0)return;
const start=performance.now(),feature=q.poseCurveCurrent.feature;
const straightLift=[0,6].map(k=>smooth01((Math.abs(feature[k+2])-.45)/.5)*(1-smooth01((Math.hypot(...feature.slice(k+3,k+6))-.15)/.65)));
o.skeleton.update();
const mats=o.skeleton.bones.map((_,i)=>new T.Matrix4().fromArray(o.skeleton.boneMatrices,i*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix)),virtual=mats.map(m=>m.clone());
if(q.posedBuffer)bodyPosed.set(q.posedBuffer);
else if(sleeveEnvelope){for(let i=0;i<bodyPosed.length/3;i++)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);}
else {for(const core of d.cores)for(const i of core.ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);for(const guide of d.cuffSurfaceGuides||[])for(const ids of guide.groups)for(const i of ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);for(const guide of d.sleeveSectionGuides||[])for(const core of guide.sections)for(const i of core.ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);}
for(const core of d.cores){const fit=fitRigid(q.dimensionRest,bodyPosed,core.ids),rot=new T.Quaternion(...fit.quaternion),center=new T.Vector3(...fit.restCenter).applyQuaternion(rot),pos=new T.Vector3(...fit.posedCenter).sub(center);
virtual[core.bone].compose(pos,rot,new T.Vector3(1,1,1));
}const bodyRotation=new T.Quaternion().setFromRotationMatrix(mats[0]).normalize();
// Bent sections and cuffs share the arm's roll; torso-only frames twist the cloth.
// Fade in with elbow flexion to retain existing straight-arm and resting shapes.
const bentRoll=[3,9].map(k=>smooth01((Math.hypot(...feature.slice(k,k+3))-.15)/.45));
const armFrames=[1,4].map(b=>[b,b+1].map(i=>new T.Quaternion().setFromRotationMatrix(mats[i]).normalize()));
// During the cheer, use the fitted bare-arm surface rotation as the roll
// reference. The skeleton alone cannot represent the posed mesh deformation.
const academyFrames=(academyFit||coatFit)&&q.cheerSleeveBlend?virtual.map(m=>m.clone()):null;
const cheerFit=cheerGarment?q.cheerSleeveBlend:0;
if(cheerFit){
 for(const core of d.cores){
  const bone=core.bone;
  if(![1,2,4,5].includes(bone))continue;
  const side=bone>=4?1:0,segment=bone-(side?4:1);
  const surfaceRotation=new T.Quaternion().setFromRotationMatrix(virtual[bone]).normalize();
  armFrames[side][segment].slerp(surfaceRotation,cheerFit);
 }
}
function fitSleeveFrames(frames,rollFrames,useArmAxis){
 for(let side=0;side<2;side++){
  const fit=q.rigFit[side],upper=side?4:1,cuff=d.cuffPlanes[side];
  const armAxis=new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize();
  for(let segment=0;segment<2;segment++){
   const matrix=frames[upper+segment],axis=segment&&!useArmAxis?new T.Vector3(...cuff.normal):armAxis;
   const anchor=new T.Vector3(...(segment?cuff.center:fit.shoulder)),center=anchor.clone().applyMatrix4(matrix);
   const targetAxis=axis.clone().transformDirection(matrix);
   const frame=segment?new T.Quaternion().setFromRotationMatrix(frames[upper]).normalize():bodyRotation.clone();
   frame.slerp(rollFrames[side][segment],bentRoll[side]);
   const rotation=sleeveRotation(T,axis,targetAxis,frame);
   matrix.compose(center.sub(anchor.applyQuaternion(rotation)),rotation,new T.Vector3(1,1,1));
  }
 }
}
fitSleeveFrames(virtual,armFrames,materialCuff&&d.name!=='outfit_linen_cloth');
if(academyFrames){
 for(let side=0;side<2;side++){
  const ids=academyForearmCores[side];
  if(!q.posedBuffer)for(const i of ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);
  const fit=fitRigid(q.dimensionRest,bodyPosed,ids),rotation=new T.Quaternion(...fit.quaternion);
  const shift=new T.Vector3(...fit.posedCenter).sub(new T.Vector3(...fit.restCenter).applyQuaternion(rotation));
  academyFrames[side?5:2].compose(shift,rotation,new T.Vector3(1,1,1));
 }
 fitSleeveFrames(academyFrames,[1,4].map(b=>[b,b+1].map(i=>new T.Quaternion().setFromRotationMatrix(mats[i]).normalize())),false);
}
for(const guide of d.cuffSurfaceGuides||[]){const side=guide.side,upper=side?4:1,fore=upper+1,centers=guide.groups.map(ids=>{const c=new T.Vector3();for(const i of ids)c.addScaledVector(V.fromArray(bodyPosed,i*3),1/ids.length);return c}),rest=guide.groups.map(ids=>{const c=new T.Vector3();for(const i of ids)c.addScaledVector(V.fromArray(q.dimensionRest,i*3),1/ids.length);return c}),targetAxis=centers[2].clone().sub(centers[0]).normalize(),restAxis=rest[2].clone().sub(rest[0]).normalize(),frame=bodyRotation.clone().slerp(armFrames[side][1],bentRoll[side]),swing=sleeveRotation(T,restAxis,targetAxis,frame),translation=centers[1].clone().sub(rest[1].clone().applyQuaternion(swing));virtual[fore].compose(translation,swing,new T.Vector3(1,1,1));}sleeveEnvelope?.update(bodyPosed,bentRoll,q.rigFit,mats[0],mats,feature,q.outwardSleeveBlend||0);
if(q.bodyBackedCuffUniforms){for(let side=0;
side<2;
side++){const row=d.cuffPlanes[side],m=virtual[row.bone],center=new T.Vector3(...row.center).applyMatrix4(m),normal=new T.Vector3(...row.normal).transformDirection(m);
if(academyFrames){
 const weight=q.cheerSleeveBlend,ref=academyFrames[row.bone];
 center.lerp(new T.Vector3(...row.center).applyMatrix4(ref),weight);
 normal.lerp(new T.Vector3(...row.normal).transformDirection(ref),weight).normalize();
}
q.bodyBackedCuffUniforms[side?'right':'left'].value.set(normal.x,normal.y,normal.z,-normal.dot(center));
}}const sectionFrames=[[],[]];for(const guide of d.sleeveSectionGuides||[]){const centers=guide.sections.map(core=>{const c=new T.Vector3();for(const i of core.ids)c.addScaledVector(V.fromArray(bodyPosed,i*3),1/core.ids.length);return c});for(let j=0;j<centers.length;j++){const a=Math.max(0,j-1),b=Math.min(centers.length-1,j+1),axis=new T.Vector3(...guide.sections[b].center).sub(new T.Vector3(...guide.sections[a].center)).normalize(),target=centers[b].clone().sub(centers[a]).normalize(),frame=bodyRotation.clone().slerp(armFrames[guide.side][0].clone().slerp(armFrames[guide.side][1],smooth01((guide.sections[j].at-.10)/.12)),bentRoll[guide.side]),rotation=sleeveRotation(T,axis,target,frame);
 if(cheerFit){
  const fit=fitRigid(q.dimensionRest,bodyPosed,guide.sections[j].ids);
  const surfaceFrame=new T.Quaternion(...fit.quaternion);
  rotation.slerp(sleeveRotation(T,axis,target,surfaceFrame),cheerFit);
 }
 sectionFrames[guide.side].push({at:guide.sections[j].at,center:centers[j],rest:new T.Vector3(...guide.sections[j].center),rotation});}}const sectionPoint=new T.Vector3(),sectionNormal=new T.Vector3(),sectionCenter=new T.Vector3(),sectionRest=new T.Vector3(),sectionRotation=new T.Quaternion();
const legacyPoint=new T.Vector3(),legacyNormal=new T.Vector3();
function blendSectionCuff(row,i,bi,cuff){
 sectionPoint.fromArray(row.rest,i*3).sub(sectionRest).applyQuaternion(sectionRotation).add(sectionCenter);
 sectionNormal.fromArray(row.normal,i*3).applyQuaternion(sectionRotation);
 sectionPoint.lerp(V.fromArray(row.rest,i*3).applyMatrix4(virtual[bi+1]),cuff);
 sectionNormal.lerp(V.fromArray(row.normal,i*3).transformDirection(virtual[bi+1]),cuff).normalize();
 const amount=Math.max(q.phoneCuffBlend||0,cheerFit||0);if(!amount)return;
 legacyPoint.copy(sectionPoint);legacyNormal.copy(sectionNormal);
 blendSleeveCuffFrame(sectionRest,sectionCenter,sectionRotation,virtual[bi+1],qr[bi+1],cuff,V);
 sectionPoint.fromArray(row.rest,i*3).sub(sectionRest).applyQuaternion(sectionRotation).add(sectionCenter).lerp(legacyPoint,1-amount);
 sectionNormal.fromArray(row.normal,i*3).applyQuaternion(sectionRotation).lerp(legacyNormal,1-amount).normalize();
}
const qr=virtual.map(m=>new T.Quaternion().setFromRotationMatrix(m).normalize()),qd=virtual.map((m,i)=>{const e=m.elements,t=new T.Quaternion(e[12],e[13],e[14],0).multiply(qr[i]);
return [t.x*.5,t.y*.5,t.z*.5,t.w*.5]});
for(const entry of entries){const {row,o,g,ids}=entry,entryActivation=sleeveEnvelope&&row.linear?q.poseCurveCurrent.activation:activation,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,virtualSI=row.skinIndex,virtualSW=entry.weights;
if(row.bentSkinWeight){const feature=q.poseCurveCurrent.feature,factors=[3,9].map(k=>{const a=Math.hypot(...feature.slice(k,k+3));
let t=Math.max(0,Math.min(1,(a-row.bendRange[0])/(row.bendRange[1]-row.bendRange[0])));
return t*t*(3-2*t)});
for(const i of ids){const blend=factors[row.rest[i*3]<0?0:1];
for(let k=0;
k<4;
k++){const j=i*4+k;
virtualSW[j]=row.skinWeight[j]+blend*(row.bentSkinWeight[j]-row.skinWeight[j]);
}}q.clothBendBlend=factors;
}
// Straight elevated arms carry the sleeve as one shaft; only the shoulder attachment blends into the torso.
// Use existing smooth anatomical ownership, preserving authored geometry and complete cuffs.
if(row.followArms){for(const i of ids){
 const side=row.rest[i*3]<0?0:1,upper=side?4:1,fore=upper+1,f=straightLift[side];if(!f)continue;
 let own=0,body=0;for(let k=0;k<4;k++){const b=virtualSI[i*4+k],w=virtualSW[i*4+k];if(b===upper||b===fore)own+=w;if(b===0)body+=w}
 if(own<=.05)continue;
 const arm=(own+body)*smooth01((own-.05)/.45);
 for(let k=0;k<4;k++){const j=i*4+k,b=virtualSI[j];let target=virtualSW[j];if(b===0)target=own+body-arm;else if(b===upper)target=0;else if(b===fore)target=arm;virtualSW[j]+=f*(target-virtualSW[j])}
}}
for(const i of ids){let sum=0;for(let k=0;k<4;k++)sum+=virtualSW[i*4+k];if(Math.abs(sum-1)>1e-6)throw Error('Lost garment influence: '+row.name+' vertex '+i+' sum '+sum)}
q.straightLift=straightLift;
o.skeleton.update();
bodyToCloth.copy(o.matrixWorld).invert().multiply(q.body.matrixWorld);bodyNormalToCloth.getNormalMatrix(bodyToCloth);
const actual=o.skeleton.bones.map((_,i)=>new T.Matrix4().fromArray(o.skeleton.boneMatrices,i*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix));
if(entry.kernel){const target=entry.kernel.deform(virtualSW,qr,qd,virtual,straightLift);if(cheerFit||sleeveEnvelope||row.followArms&&d.sleeveSectionGuides)for(const i of ids){P.fromArray(target.position,i*3);N.fromArray(target.normal,i*3);if(row.followArms&&d.sleeveSectionGuides){const side=row.rest[i*3]<0?0:1,bi=side?4:1,fit=q.rigFit[side],axis=new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize(),at=V.fromArray(row.rest,i*3).sub(new T.Vector3(...fit.shoulder)).dot(axis),plane=d.cuffPlanes[side],ct=V.fromArray(row.rest,i*3).sub(new T.Vector3(...plane.center)).dot(new T.Vector3(...plane.normal));let own=0;for(let k=0;k<4;k++)if(virtualSI[i*4+k]===bi||virtualSI[i*4+k]===bi+1)own+=virtualSW[i*4+k];const blend=smooth01((Math.hypot(...feature.slice(side?9:3,side?12:6))-.15)/.45)*smooth01((own-.15)/.55)*(sleeveEnvelope?0:1);if(blend){const frames=sectionFrames[side];let j=0;while(j<frames.length-2&&at>frames[j+1].at)j++;const a=frames[j],b=frames[j+1],t=Math.max(0,Math.min(1,(at-a.at)/(b.at-a.at)));sectionRotation.copy(a.rotation).slerp(b.rotation,t);sectionRest.copy(a.rest).lerp(b.rest,t);sectionCenter.copy(a.center).lerp(b.center,t);blendSectionCuff(row,i,bi,smooth01((ct+.065)/.045));P.lerp(sectionPoint,blend);N.lerp(sectionNormal,blend).normalize();}}if(cheerFit)followBody(entry,i,P,cheerFit);
sleeveEnvelope?.limit(entry,i,P);P.toArray(target.position,i*3);N.toArray(target.normal,i*3);}sleeveEnvelope?.finish(entry,target.position);entry.kernel.finish(actual,bodyToCloth,bodyNormalToCloth,entryActivation);continue;}
for(const i of ids){const ref=qr[entry.references[i]];
R.set(0,0,0,0);
D.set(0,0,0,0);
mat.elements.fill(0);
for(let k=0;
k<4;
k++){const j=virtualSI[i*4+k],w=virtualSW[i*4+k],r=qr[j],dd=qd[j],z=w*(r.dot(ref)<0?-1:1);
R.x+=z*r.x;
R.y+=z*r.y;
R.z+=z*r.z;
R.w+=z*r.w;
D.x+=z*dd[0];
D.y+=z*dd[1];
D.z+=z*dd[2];
D.w+=z*dd[3];
const actualBone=si.getComponent(i,k),actualWeight=sw.getComponent(i,k);
for(let h=0;
h<16;
h++)mat.elements[h]+=actualWeight*actual[actualBone].elements[h]}const norm=R.length();
R.set(R.x/norm,R.y/norm,R.z/norm,R.w/norm);
D.set(D.x/norm,D.y/norm,D.z/norm,D.w/norm);
const dot=R.dot(D);
D.set(D.x-R.x*dot,D.y-R.y*dot,D.z-R.z*dot,D.w-R.w*dot);
C.copy(R).conjugate();
trans.copy(D).multiply(C);
P.fromArray(row.rest,i*3).applyQuaternion(R).add(V.set(trans.x*2,trans.y*2,trans.z*2));
N.fromArray(row.normal,i*3).applyQuaternion(R);
if(row.followArms){const f=straightLift[row.rest[i*3]<0?0:1];if(f){linearPoint.set(0,0,0);for(let k=0;k<4;k++){const weight=virtualSW[i*4+k];if(weight)linearPoint.addScaledVector(V.fromArray(row.rest,i*3).applyMatrix4(virtual[virtualSI[i*4+k]]),weight)}P.lerp(linearPoint,f)}}

if(row.followArms&&d.sleeveSectionGuides){const side=row.rest[i*3]<0?0:1,bi=side?4:1,fit=q.rigFit[side],axis=new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize(),at=V.fromArray(row.rest,i*3).sub(new T.Vector3(...fit.shoulder)).dot(axis),plane=d.cuffPlanes[side],ct=V.fromArray(row.rest,i*3).sub(new T.Vector3(...plane.center)).dot(new T.Vector3(...plane.normal));let own=0;for(let k=0;k<4;k++)if(virtualSI[i*4+k]===bi||virtualSI[i*4+k]===bi+1)own+=virtualSW[i*4+k];const blend=smooth01((Math.hypot(...feature.slice(side?9:3,side?12:6))-.15)/.45)*smooth01((own-.15)/.55)*(sleeveEnvelope?0:1);if(blend){const frames=sectionFrames[side];let j=0;while(j<frames.length-2&&at>frames[j+1].at)j++;const a=frames[j],b=frames[j+1],t=Math.max(0,Math.min(1,(at-a.at)/(b.at-a.at)));sectionRotation.copy(a.rotation).slerp(b.rotation,t);sectionRest.copy(a.rest).lerp(b.rest,t);sectionCenter.copy(a.center).lerp(b.center,t);blendSectionCuff(row,i,bi,smooth01((ct+.065)/.045));P.lerp(sectionPoint,blend);N.lerp(sectionNormal,blend).normalize();}}
if(cheerFit)followBody(entry,i,P,cheerFit);
sleeveEnvelope?.limit(entry,i,P);
if(row.linear){P.set(0,0,0);
N.set(0,0,0);
for(let k=0;
k<4;
k++){const w=virtualSW[i*4+k];
if(!w)continue;
const m=actual[virtualSI[i*4+k]];
P.addScaledVector(V.fromArray(row.rest,i*3).applyMatrix4(m),w);
mat3.setFromMatrix4(m);
N.addScaledVector(V.fromArray(row.normal,i*3).applyMatrix3(mat3),w);
}N.normalize();
}if(!row.linear){P.applyMatrix4(bodyToCloth);N.applyMatrix3(bodyNormalToCloth).normalize();}
if(entryActivation<1){o.getVertexPosition(i,V);
P.lerp(V,1-entryActivation)}mat.invert();
P.applyMatrix4(mat);
mat3.setFromMatrix4(mat);
N.applyMatrix3(mat3).normalize();
for(let k=0;
k<(o.morphTargetInfluences?.length||0);
k++){const w=o.morphTargetInfluences[k];
if(!w)continue;
let attr=g.morphAttributes.position?.[k];
if(attr)P.addScaledVector(V.fromBufferAttribute(attr,i),-w);
attr=g.morphAttributes.normal?.[k];
if(attr)N.addScaledVector(V.fromBufferAttribute(attr,i),-w)}g.attributes.position.setXYZ(i,P.x,P.y,P.z);
g.attributes.normal.setXYZ(i,N.x,N.y,N.z)}g.attributes.position.needsUpdate=true;
g.attributes.normal.needsUpdate=true;
}if(academyFit&&academyFrames)academyFit(q.cheerSleeveBlend,academyFrames);
if(coatFit&&academyFrames)coatFit(q.cheerSleeveBlend,academyFrames);
fitEase?.(q.cheerSleeveBlend);
robeArmhole?.fit([0,6].map(k=>smooth01((Math.hypot(...feature.slice(k,k+3))-.35)/.65)*activation),academyFrames||virtual);
q.bodyBackedClothCurrent={milliseconds:performance.now()-start,vertices:entries.reduce((n,e)=>n+e.ids.length,0),parts:entries.map(e=>({name:e.row.name,vertices:e.ids.length}))};
};

}
