// The tailored coat is one continuous cloth mesh across the shoulder.
export function bindCoatSleeves(q,entries,cuffs){
 const T=q.T,vec=()=>new T.Vector3(),smooth=x=>{x=Math.min(1,Math.max(0,x));return x*x*(3-2*x);};
 const guides=cuffs.map((c,side)=>{
  const start=vec().fromArray(q.rigFit[side].shoulder),end=vec().fromArray(c.center),axis=end.clone().sub(start).normalize();
  return {start,end,axis,normal:vec().fromArray(c.normal).normalize(),length:start.distanceTo(end),a:vec(),b:vec(),bend:vec(),chord:vec(),swing:new T.Quaternion(),fore:new T.Quaternion()};
 });
 const p=vec(),v=vec(),target=vec(),center=vec(),bodyPoint=vec(),delta=vec(),rotation=new T.Quaternion(),matrix=new T.Matrix4(),skin=new T.Matrix3();
 // Measure both fabric rims in the same cuff plane. The original coat
 // opening slopes around the wrist; the shirt edge has a different slope.
 function rimProfile(row,side,ids){
  const g=guides[side],u=vec().set(0,0,1).cross(g.normal).normalize(),v=vec().crossVectors(g.normal,u);
  const top=new Float64Array(24).fill(-Infinity),radii=new Float64Array(24),step=2*Math.PI/top.length;
  const phase=offset=>(Math.atan2(offset.dot(v),offset.dot(u))+Math.PI)/step;
  for(const i of ids){
   const offset=p.fromArray(row.rest,3*i).sub(g.end),h=offset.dot(g.normal);
   if(h<-.035||h>.025||offset.lengthSq()>.085**2)continue;
   const j=Math.floor(phase(offset))%top.length;
   top[j]=Math.max(top[j],h);
   if(h>-.017)radii[j]=Math.max(radii[j],Math.sqrt(Math.max(0,offset.lengthSq()-h*h)));
  }
  const typicalRadius=radii.reduce((sum,r)=>sum+r,0)/Math.max(1,radii.filter(r=>r>0).length);
  const profile=(offset,radius=false)=>{
   const f=phase(offset)-.5,j=Math.floor(f);
   let sum=0,w=0;
   for(let k=j-1;k<=j+2;k++){
    const bin=(k+top.length)%top.length,h=radius?radii[bin]:top[bin];if(!Number.isFinite(h))continue;
    const weight=Math.exp(-((f-k)**2));sum+=h*weight;w+=weight;
   }
   return w?sum/w:0;
  };
  profile.typicalRadius=typicalRadius;
  return profile;
 }
 const jacket=entries.find(({row})=>row.name==='outfit_heritage_cloth');
 const outer=jacket&&guides.map((_,side)=>rimProfile(jacket.row,side,jacket.ids));
 const pieces=entries.filter(({row})=>row.followArms&&!row.linear).map(({o,row,ids})=>{
  const shirt=row.name==='outfit_argyle_trim';
  const points=[],profiles=jacket&&guides.map((_,side)=>rimProfile(row,side,ids));
  for(const i of ids){
   p.fromArray(row.rest,3*i);const side=Number(p.x>0),g=guides[side];
   if(Math.abs(p.x)<Math.abs(g.start.x)-.04||p.y<g.end.y-.075)continue;
   const t=Math.min(1,Math.max(0,v.copy(p).sub(g.start).dot(g.axis)/g.length));
   let own=0;
   for(let j=i*4;j<i*4+4;j++)if([1,2,4,5].includes(row.skinIndex[j]))own+=row.skinWeight[j];

   const x=Math.abs(p.x);
   const shoulder=smooth((p.y-g.start.y+.14)/.095)*smooth((x-Math.abs(g.start.x)+.016)/.060);
   // The robe has a continuous side panel below the sleeve. Blend the
   // cloth across the armhole even on vertices assigned to the torso.
   const outside=x-Math.abs(g.start.x);
   const across=smooth((outside+.032)/.112);
   const above=smooth((p.y-g.start.y+.19)/.15);
   const armhole=row.name==='outfit_bamboo_cloth'?above*smooth((outside+.04)/.04)*(1-smooth((outside-.012)/.085)):0;
   if(own<.005&&!armhole&&!shirt)continue;
   if(shirt&&x<Math.abs(g.start.x)-.003)continue;
   const original=Math.max(smooth(own),shoulder);
   const sleeve=original+(across-original)*armhole;
   const influence=shirt?1:own<.005?armhole:1;
   const gather=4*sleeve*(1-sleeve)*smooth((g.start.y-.04-p.y)/.09);
   const depth=-v.copy(p).sub(g.end).dot(center.fromArray(cuffs[side].normal));
   const cuff=smooth(1-depth/.096);
   if(depth<.04&&(row.name==='outfit_heritage_trim'||row.name==='outfit_heritage_cloth')){
    const trim=row.name==='outfit_heritage_trim',rim=smooth((.04-depth)/.03);
    v.copy(p).sub(g.end);
    const measured=profiles[side](v);
    const clothRadius=outer[side](v,true),sourceRadius=profiles[side](v,true);
    p.addScaledVector(g.normal,((trim ? .010 : -.003)-measured+(trim ? 1.6*(-depth-measured) : 0))*rim);
    if(sourceRadius>.001){
     const coatRadius=Math.max(outer[side].typicalRadius,clothRadius);
     const scale=(coatRadius-(trim ? .0065+.005*smooth((measured+depth)/.018) : 0))/sourceRadius;
     p.addScaledVector(v.addScaledVector(g.normal,depth),(scale-1)*rim);
    }
   }
   const cap=armhole*smooth((p.y-g.start.y+.08)/.08)*(1-cuff);
   points.push({i,side,depth,t,sleeve,cuff,gather,influence,cap,p:p.clone(),radial:p.clone().sub(v.copy(g.start).lerp(g.end,t))});
  }
  const openings=shirt?guides.map((_,side)=>points.filter(n=>n.side===side&&Math.abs(n.depth)<.012)):null;
  return {o,points,openings};
 });
 return (amount,frames)=>{
  if(!amount)return;
  guides.forEach((g,side)=>{
   const upper=side?4:1;
   g.a.copy(g.start).applyMatrix4(frames[upper]);g.b.copy(g.end).applyMatrix4(frames[upper+1]);
   const elbow=vec().fromArray(q.rigFit[side].elbow);
   const at=elbow.distanceTo(g.start)/g.length;
   g.bend.copy(elbow).applyMatrix4(frames[upper]).sub(v.copy(g.a).lerp(g.b,at));
   g.chord.copy(g.b).sub(g.a).normalize();g.swing.setFromUnitVectors(g.axis,g.chord);
   // Match the forearm opening without winding the lengthwise cloth grain
   // around the arm when the hand turns inside the cuff.
   p.fromArray(cuffs[side].normal).normalize();
   v.copy(p).transformDirection(frames[upper+1]);
   g.fore.setFromUnitVectors(p.applyQuaternion(g.swing),v).multiply(g.swing).normalize();
   // Hide the forearm up to the inside of the white cuff, whose outer
   // lip is 0.010 beyond the coat's original coverage plane.
   const plane=q.bodyBackedCuffUniforms?.[side?'right':'left']?.value;
   if(jacket&&plane)plane.w-=.010*amount;
   if(pieces[0]?.openings&&plane)plane.w+=.050*amount;
  });
  for(const {o,points,openings} of pieces){
   const attr=o.geometry.attributes,transform=new T.Matrix4().copy(o.matrixWorld).invert().multiply(q.body.matrixWorld);
   o.skeleton.update();
   const bones=o.skeleton.bones.map((_,i)=>new T.Matrix3().setFromMatrix4(matrix.fromArray(o.skeleton.boneMatrices,16*i).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix)));
   // A short sleeve opens on the bent arm. Centre its unrolled rim on
   // the existing fitted opening and taper the correction to the shoulder.
   const shifts=openings?.map((rim,side)=>{
    const g=guides[side],offset=vec(),pivot=vec();
    for(const n of rim){
     o.getVertexPosition(n.i,v);pivot.add(v);
     center.copy(g.a).lerp(g.b,n.t);
     p.copy(n.radial).applyQuaternion(g.swing).add(center).applyMatrix4(transform);
     offset.add(v.sub(p));
    }
    const count=Math.max(1,rim.length);
    return {offset:offset.divideScalar(count),pivot:pivot.divideScalar(count),
     turn:g.fore.clone().multiply(g.swing.clone().invert())};
   });
   for(const n of points){
    const g=guides[n.side],i=n.i;
    if(shifts){
     // Keep the short sleeve round between its anchored root and opening.
     const rim=shifts[n.side];
     center.copy(g.a).lerp(g.b,n.t);
     bodyPoint.copy(n.radial).applyQuaternion(g.swing).add(center).applyMatrix4(transform)
      .addScaledVector(rim.offset,smooth(n.t));
     rotation.identity().slerp(rim.turn,.72*smooth(1-n.depth/.15));
     bodyPoint.sub(rim.pivot).applyQuaternion(rotation).add(rim.pivot);
    }else{
     rotation.copy(g.swing).slerp(g.fore,n.cuff);
     center.copy(g.a).lerp(g.b,n.t).addScaledVector(g.bend,1.15*n.t*(1-n.t));
     // The opening uses one rigid frame for its centre and its perimeter.
     center.lerp(v.copy(n.p).sub(n.radial).sub(g.end).applyQuaternion(g.fore).add(g.b),n.cuff);
     target.copy(n.radial).applyQuaternion(rotation).add(center);
     bodyPoint.copy(n.p).applyMatrix4(frames[0]).sub(g.a);
     target.sub(g.a);
     const radius=bodyPoint.length()*(1-n.sleeve)+target.length()*n.sleeve;
     bodyPoint.lerp(target,n.sleeve);
     // Keep some of the cloth volume on the inside of the lifting shoulder.
     const preserve=.16+.84*n.cap;
     bodyPoint.setLength(bodyPoint.length()*(1-preserve)+preserve*radius).add(g.a);
     bodyPoint.y+=.018*n.cap;
     bodyPoint.y+=.025*n.gather;
     bodyPoint.applyMatrix4(transform);
    }
    o.getVertexPosition(i,v);delta.copy(bodyPoint).sub(v).multiplyScalar(amount*n.influence);
    skin.elements.fill(0);
    for(let j=0;j<4;j++){
     const w=attr.skinWeight.getComponent(i,j);if(!w)continue;
     const e=bones[attr.skinIndex.getComponent(i,j)].elements;
     for(let k=0;k<9;k++)skin.elements[k]+=w*e[k];
    }
    if(Math.abs(skin.determinant())<1e-8)continue;
    delta.applyMatrix3(skin.invert()).add(v.fromBufferAttribute(attr.position,i));
    attr.position.setXYZ(i,delta.x,delta.y,delta.z);
   }
   attr.position.needsUpdate=true;
  }
 };
}
