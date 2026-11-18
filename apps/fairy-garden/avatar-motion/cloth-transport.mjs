import {createClothTransportKernel,clothRotationReferences} from './cloth-transport-kernel.mjs?v=fg-0df7f556a307b66b';
import {fitRigid} from './rigid-fit.mjs?v=fg-0df7f556a307b66b';
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
export function install(q,{materialCuff=false}={}){const T=q.T,d=q.bodyBackedClothData;
const outfits=q.outfits;
let o=outfits[d.meshId];
if(!o)throw Error('DQ garment missing');
const g=o.geometry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight;
if(g.attributes.position.count*3!==d.rest.length)throw Error('DQ topology mismatch');
for(const k of Object.keys(d.dims))if(Math.abs(q.dimensionValues[k]-d.dims[k])>1e-8)throw Error('Cloth binding dimension mismatch');
const entries=[d,...(d.parts||[])].map(row=>{let mesh=outfits[row.meshId];
if(!mesh||mesh.geometry.attributes.position.count*3!==row.rest.length)throw Error('Garment part mismatch');
const sourceIds=row.ids||Array.from({length:mesh.geometry.attributes.position.count},(_,i)=>i),skin=mesh.geometry.attributes;
// Transport arm-influenced cloth and retain the authored waist corrections.
// Linear waist rows remove stray arm influences; skipping them moves belts.
const ids=row.linear?sourceIds:sourceIds.filter(i=>{for(let k=0;k<4;k++){const j=i*4+k;if([1,2,4,5].includes(row.skinIndex[j])&&Math.max(row.skinWeight[j],row.bentSkinWeight?.[j]||0)>0)return true;const bone=mesh.skeleton.bones[skin.skinIndex.getComponent(i,k)];if(/Arm$|Forearm$/.test(bone?.name||'')&&skin.skinWeight.getComponent(i,k)>0)return true;}return false;});
q.transportKernels??=new Map();let kernel=null;if(q.numericCore&&!row.linear&&ids.length){kernel=q.transportKernels.get(mesh.geometry);if(!kernel){kernel=createClothTransportKernel(q.numericCore,mesh);q.transportKernels.set(mesh.geometry,kernel)}kernel.configure(row,ids);}
return {row,o:mesh,g:mesh.geometry,weights:Float64Array.from(row.skinWeight),references:clothRotationReferences(row,mesh.skeleton.bones),ids,kernel};
});
const bodyPosed=new Float64Array(q.dimensionRest.length),virtualSI=d.skinIndex,virtualSW=d.skinWeight;
const linearPoint=new T.Vector3(),bodyToCloth=new T.Matrix4(),bodyNormalToCloth=new T.Matrix3();
const P=new T.Vector3(),N=new T.Vector3(),V=new T.Vector3(),R=new T.Quaternion(),D=new T.Quaternion(),C=new T.Quaternion(),trans=new T.Quaternion(),mat=new T.Matrix4(),mat3=new T.Matrix3();
const smooth01=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
const previous=q.applyLiveFair;
q.applyLiveFair=()=>{previous();
const activation=q.poseCurveCurrent.activation;
if(q.bodyBackedCuffUniforms)q.bodyBackedCuffUniforms.enabled.value=activation;
if(activation===0)return;
const start=performance.now(),feature=q.poseCurveCurrent.feature;
const straightLift=[0,6].map(k=>smooth01((Math.abs(feature[k+2])-.45)/.5)*(1-smooth01((Math.hypot(...feature.slice(k+3,k+6))-.15)/.65)));
o.skeleton.update();
const mats=o.skeleton.bones.map((_,i)=>new T.Matrix4().fromArray(o.skeleton.boneMatrices,i*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix)),virtual=mats.map(m=>m.clone());
if(q.posedBuffer)bodyPosed.set(q.posedBuffer);
else {for(const core of d.cores)for(const i of core.ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);for(const guide of d.cuffSurfaceGuides||[])for(const ids of guide.groups)for(const i of ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);for(const guide of d.sleeveSectionGuides||[])for(const core of guide.sections)for(const i of core.ids)q.body.getVertexPosition(i,P).toArray(bodyPosed,i*3);}
for(const core of d.cores){const fit=fitRigid(q.dimensionRest,bodyPosed,core.ids),rot=new T.Quaternion(...fit.quaternion),center=new T.Vector3(...fit.restCenter).applyQuaternion(rot),pos=new T.Vector3(...fit.posedCenter).sub(center);
virtual[core.bone].compose(pos,rot,new T.Vector3(1,1,1));
}const bodyRotation=new T.Quaternion().setFromRotationMatrix(mats[0]).normalize();
// Bent sections and cuffs share the arm's roll; torso-only frames twist the cloth.
// Fade in with elbow flexion to retain existing straight-arm and resting shapes.
const bentRoll=[3,9].map(k=>smooth01((Math.hypot(...feature.slice(k,k+3))-.15)/.45));
const armFrames=[1,4].map(b=>[b,b+1].map(i=>new T.Quaternion().setFromRotationMatrix(mats[i]).normalize()));
for(let side=0;
side<2;
side++){const fit=q.rigFit[side];
for(const [bone,anchor,axis]of [[side?4:1,new T.Vector3(...fit.shoulder),new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize()],[side?5:2,new T.Vector3(...d.cuffPlanes[side].center),(materialCuff&&d.name!=='outfit_linen_cloth'?new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize():new T.Vector3(...d.cuffPlanes[side].normal))]]){const old=virtual[bone],point=anchor.clone().applyMatrix4(old),targetAxis=axis.clone().transformDirection(old),frame=bone===(side?5:2)?new T.Quaternion().setFromRotationMatrix(virtual[side?4:1]).normalize():bodyRotation,armFrame=frame.clone().slerp(armFrames[side][bone===(side?5:2)?1:0],bentRoll[side]),referenceAxis=axis.clone().applyQuaternion(armFrame),swing=new T.Quaternion().setFromUnitVectors(referenceAxis,targetAxis).multiply(armFrame).normalize(),translation=point.sub(anchor.clone().applyQuaternion(swing));
virtual[bone].compose(translation,swing,new T.Vector3(1,1,1));
}}for(const guide of d.cuffSurfaceGuides||[]){const side=guide.side,upper=side?4:1,fore=upper+1,centers=guide.groups.map(ids=>{const c=new T.Vector3();for(const i of ids)c.addScaledVector(V.fromArray(bodyPosed,i*3),1/ids.length);return c}),rest=guide.groups.map(ids=>{const c=new T.Vector3();for(const i of ids)c.addScaledVector(V.fromArray(q.dimensionRest,i*3),1/ids.length);return c}),targetAxis=centers[2].clone().sub(centers[0]).normalize(),restAxis=rest[2].clone().sub(rest[0]).normalize(),frame=bodyRotation.clone().slerp(armFrames[side][1],bentRoll[side]),swing=sleeveRotation(T,restAxis,targetAxis,frame),translation=centers[1].clone().sub(rest[1].clone().applyQuaternion(swing));virtual[fore].compose(translation,swing,new T.Vector3(1,1,1));}if(q.bodyBackedCuffUniforms){for(let side=0;
side<2;
side++){const row=d.cuffPlanes[side],m=virtual[row.bone],center=new T.Vector3(...row.center).applyMatrix4(m),normal=new T.Vector3(...row.normal).transformDirection(m);
q.bodyBackedCuffUniforms[side?'right':'left'].value.set(normal.x,normal.y,normal.z,-normal.dot(center));
}}const sectionFrames=[[],[]];for(const guide of d.sleeveSectionGuides||[]){const centers=guide.sections.map(core=>{const c=new T.Vector3();for(const i of core.ids)c.addScaledVector(V.fromArray(bodyPosed,i*3),1/core.ids.length);return c});for(let j=0;j<centers.length;j++){const a=Math.max(0,j-1),b=Math.min(centers.length-1,j+1),axis=new T.Vector3(...guide.sections[b].center).sub(new T.Vector3(...guide.sections[a].center)).normalize(),target=centers[b].clone().sub(centers[a]).normalize(),frame=bodyRotation.clone().slerp(armFrames[guide.side][0].clone().slerp(armFrames[guide.side][1],smooth01((guide.sections[j].at-.10)/.12)),bentRoll[guide.side]),rotation=sleeveRotation(T,axis,target,frame);sectionFrames[guide.side].push({at:guide.sections[j].at,center:centers[j],rest:new T.Vector3(...guide.sections[j].center),rotation});}}const sectionPoint=new T.Vector3(),sectionNormal=new T.Vector3(),sectionCenter=new T.Vector3(),sectionRest=new T.Vector3(),sectionRotation=new T.Quaternion();
const qr=virtual.map(m=>new T.Quaternion().setFromRotationMatrix(m).normalize()),qd=virtual.map((m,i)=>{const e=m.elements,t=new T.Quaternion(e[12],e[13],e[14],0).multiply(qr[i]);
return [t.x*.5,t.y*.5,t.z*.5,t.w*.5]});
for(const entry of entries){const {row,o,g,ids}=entry,si=g.attributes.skinIndex,sw=g.attributes.skinWeight,virtualSI=row.skinIndex,virtualSW=entry.weights;
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
if(entry.kernel){const target=entry.kernel.deform(virtualSW,qr,qd,virtual,straightLift);if(row.followArms&&d.sleeveSectionGuides)for(const i of ids){P.fromArray(target.position,i*3);N.fromArray(target.normal,i*3);if(row.followArms&&d.sleeveSectionGuides){const side=row.rest[i*3]<0?0:1,bi=side?4:1,fit=q.rigFit[side],axis=new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize(),at=V.fromArray(row.rest,i*3).sub(new T.Vector3(...fit.shoulder)).dot(axis),plane=d.cuffPlanes[side],ct=V.fromArray(row.rest,i*3).sub(new T.Vector3(...plane.center)).dot(new T.Vector3(...plane.normal));let own=0;for(let k=0;k<4;k++)if(virtualSI[i*4+k]===bi||virtualSI[i*4+k]===bi+1)own+=virtualSW[i*4+k];const blend=smooth01((Math.hypot(...feature.slice(side?9:3,side?12:6))-.15)/.45)*smooth01((own-.15)/.55);if(blend){const frames=sectionFrames[side];let j=0;while(j<frames.length-2&&at>frames[j+1].at)j++;const a=frames[j],b=frames[j+1],t=Math.max(0,Math.min(1,(at-a.at)/(b.at-a.at)));sectionRotation.copy(a.rotation).slerp(b.rotation,t);sectionRest.copy(a.rest).lerp(b.rest,t);sectionCenter.copy(a.center).lerp(b.center,t);const cuff=smooth01((ct+.065)/.045);blendSleeveCuffFrame(sectionRest,sectionCenter,sectionRotation,virtual[bi+1],qr[bi+1],cuff,V);sectionPoint.fromArray(row.rest,i*3).sub(sectionRest).applyQuaternion(sectionRotation).add(sectionCenter);sectionNormal.fromArray(row.normal,i*3).applyQuaternion(sectionRotation);P.lerp(sectionPoint,blend);N.lerp(sectionNormal,blend).normalize();}}P.toArray(target.position,i*3);N.toArray(target.normal,i*3);}entry.kernel.finish(actual,bodyToCloth,bodyNormalToCloth,activation);continue;}
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

if(row.followArms&&d.sleeveSectionGuides){const side=row.rest[i*3]<0?0:1,bi=side?4:1,fit=q.rigFit[side],axis=new T.Vector3(...fit.wrist).sub(new T.Vector3(...fit.shoulder)).normalize(),at=V.fromArray(row.rest,i*3).sub(new T.Vector3(...fit.shoulder)).dot(axis),plane=d.cuffPlanes[side],ct=V.fromArray(row.rest,i*3).sub(new T.Vector3(...plane.center)).dot(new T.Vector3(...plane.normal));let own=0;for(let k=0;k<4;k++)if(virtualSI[i*4+k]===bi||virtualSI[i*4+k]===bi+1)own+=virtualSW[i*4+k];const blend=smooth01((Math.hypot(...feature.slice(side?9:3,side?12:6))-.15)/.45)*smooth01((own-.15)/.55);if(blend){const frames=sectionFrames[side];let j=0;while(j<frames.length-2&&at>frames[j+1].at)j++;const a=frames[j],b=frames[j+1],t=Math.max(0,Math.min(1,(at-a.at)/(b.at-a.at)));sectionRotation.copy(a.rotation).slerp(b.rotation,t);sectionRest.copy(a.rest).lerp(b.rest,t);sectionCenter.copy(a.center).lerp(b.center,t);const cuff=smooth01((ct+.065)/.045);blendSleeveCuffFrame(sectionRest,sectionCenter,sectionRotation,virtual[bi+1],qr[bi+1],cuff,V);sectionPoint.fromArray(row.rest,i*3).sub(sectionRest).applyQuaternion(sectionRotation).add(sectionCenter);sectionNormal.fromArray(row.normal,i*3).applyQuaternion(sectionRotation);P.lerp(sectionPoint,blend);N.lerp(sectionNormal,blend).normalize();}}
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
if(activation<1){o.getVertexPosition(i,V);
P.lerp(V,1-activation)}mat.invert();
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
}q.bodyBackedClothCurrent={milliseconds:performance.now()-start,vertices:entries.reduce((n,e)=>n+e.ids.length,0),parts:entries.map(e=>({name:e.row.name,vertices:e.ids.length}))};
};

}
