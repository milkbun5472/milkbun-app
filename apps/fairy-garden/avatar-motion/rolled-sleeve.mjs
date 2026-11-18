import {fitRigid} from './rigid-fit.mjs?v=fg-3bfd551167cb8a02';

const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};

// A rolled cuff spans a region, rather than just the plane of its opening.
// Fit that region to the material it actually surrounds; a distal wrist fit
// over-rotates it at the elbow. Keep the authored cuff rigid and let the
// continuous DQ sleeve join it, without applying a second section bend.
export function createRolledSleeve(T,data,rigFit,rest,entries){
 const point=new T.Vector3(),closest=new T.Vector3(),candidate=new T.Vector3(),delta=new T.Vector3();
 function nearest(p,centers,out){
  let best=Infinity;
  for(let j=0;j<centers.length-1;j++){
   const a=centers[j],b=centers[j+1];delta.copy(b).sub(a);
   const t=Math.max(0,Math.min(1,candidate.copy(p).sub(a).dot(delta)/Math.max(delta.lengthSq(),1e-20)));
   candidate.copy(a).addScaledVector(delta,t);const distance=candidate.distanceToSquared(p);
   if(distance<best){best=distance;out.copy(candidate)}
  }
  return Math.sqrt(best);
 }
 const arms=data.sleeveSectionGuides.map(guide=>{
  const side=guide.side,fit=rigFit[side],shoulder=new T.Vector3(...fit.shoulder),axis=new T.Vector3(...fit.wrist).sub(shoulder),span=axis.length();axis.normalize();
  const anchor=new T.Vector3(...data.cuffPlanes[side].center),at=anchor.clone().sub(shoulder).dot(axis);
  const ids=Array.from(new Set(guide.sections.filter(s=>Math.abs(s.at-at)<span*.108).flatMap(s=>Array.from(s.ids))));
  if(ids.length<3)throw Error('Missing rolled cuff material anchors');
  return {side,span,anchor,ids,sections:guide.sections,rest:guide.sections.map(s=>new T.Vector3(...s.center)),posed:guide.sections.map(()=>new T.Vector3()),amount:0};
 });
 const bindings=new Map();
 for(const entry of entries){
  const row=entry.row;if(!row.followArms)continue;
  const weights=new Float64Array(row.rest.length/3),limits=new Float64Array(weights.length);
  for(const i of entry.ids){
   const side=row.rest[i*3]<0?0:1,upper=side?4:1;let own=0,fore=0;
   for(let k=0;k<4;k++){const b=row.skinIndex[i*4+k],w=row.skinWeight[i*4+k];if(b===upper||b===upper+1)own+=w;if(b===upper+1)fore+=w}
   // Fully forearm-bound vertices form the authored roll. Never squeeze it.
   weights[i]=.65*smooth((own-.1)/.5)*(1-smooth((fore-.7)/.3));
   if(!weights[i])continue;
   const arm=arms[side],radius=nearest(point.fromArray(row.rest,i*3),arm.rest,closest);
   limits[i]=Math.max(arm.span*.135,radius)+arm.span*.04;
  }
  bindings.set(entry,{weights,limits});
 }
 return {
  update(posed,virtual,bend,phone){
   for(const arm of arms){
    const amount=arm.amount=bend[arm.side]*(1-phone);if(!amount)continue;
    for(let j=0;j<arm.sections.length;j++){const ids=arm.sections[j].ids,c=arm.posed[j].set(0,0,0);for(const i of ids)c.addScaledVector(point.fromArray(posed,i*3),1/ids.length)}
    const fore=arm.side?5:2,fit=fitRigid(rest,posed,arm.ids),rotation=new T.Quaternion(...fit.quaternion);
    const target=arm.anchor.clone().sub(new T.Vector3(...fit.restCenter)).applyQuaternion(rotation).add(new T.Vector3(...fit.posedCenter));
    const center=arm.anchor.clone().applyMatrix4(virtual[fore]).lerp(target,amount),turn=new T.Quaternion().setFromRotationMatrix(virtual[fore]).slerp(rotation,amount);
    virtual[fore].compose(center.sub(arm.anchor.clone().applyQuaternion(turn)),turn,new T.Vector3(1,1,1));
   }
  },
  limit(entry,i,p){
   const binding=bindings.get(entry);if(!binding)return;
   const arm=arms[entry.row.rest[i*3]<0?0:1],weight=binding.weights[i]*arm.amount;if(!weight)return;
   const distance=nearest(p,arm.posed,closest),limit=binding.limits[i];
   // Only recover excessive DQ drift; retain the original radial allowance
   // and extra cloth ease, rather than projecting the sleeve onto naked skin.
   if(distance>limit)p.lerp(closest.add(delta.copy(p).sub(closest).multiplyScalar(limit/distance)),weight);
  }
 };
}
