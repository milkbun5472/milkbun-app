
export function install(q){
  const T=q.T,d=q.bodyBackedClothData,changed=Object.keys(d.dims).some(k=>Math.abs(d.dims[k]-q.dimensionValues[k])>1e-12);
  if(!changed){q.bodyBackedDimensionReport={baselineExact:true,parts:[],cuffs:[]};return;}
  q.doll.root.updateMatrixWorld(true);
  const referenceParts=new Map([d,...(d.parts||[])].map(row=>[row.meshId,row.rest.slice()])),basePlanes=structuredClone(d.cuffPlanes),cache=new Map(),report={baselineExact:false,parts:[],cuffs:[]};
  const temp=new T.Vector3(),p=new T.Vector3(),n=new T.Vector3(),oldN=new T.Vector3(),newN=new T.Vector3();
  for(const row of [d,...(d.parts||[])]){
    let result=cache.get(row.meshId);
    if(!result){
      const mesh=q.outfits[row.meshId];
      if(!mesh||mesh.geometry.attributes.position.count*3!==row.rest.length)throw Error('Dimension adapter topology mismatch: '+row.name);
      const g=mesh.geometry,weights=mesh.morphTargetInfluences||[],oldWeights=row.referenceMorphWeights;
      if(!oldWeights||oldWeights.length!==weights.length)throw Error('Dimension adapter morph baseline mismatch');
      const M=q.body.matrixWorld.clone().invert().multiply(mesh.matrixWorld),P=[],N=[];
      for(let i=0;i<g.attributes.position.count;i++){
        p.fromBufferAttribute(g.attributes.position,i);oldN.fromBufferAttribute(g.attributes.normal,i);newN.copy(oldN);
        for(let j=0;j<weights.length;j++){
          const a=g.morphAttributes.position?.[j],normal=g.morphAttributes.normal?.[j];
          if(a&&weights[j])p.addScaledVector(temp.fromBufferAttribute(a,i),weights[j]);
          if(normal){temp.fromBufferAttribute(normal,i);oldN.addScaledVector(temp,oldWeights[j]);newN.addScaledVector(temp,weights[j]);}
        }
        p.applyMatrix4(M).toArray(P,i*3);oldN.transformDirection(M);newN.transformDirection(M);
        n.fromArray(row.normal,i*3).add(newN).sub(oldN).normalize().toArray(N,i*3);
      }
      result={P,N};cache.set(row.meshId,result);report.parts.push({name:row.name,vertices:g.attributes.position.count});
    }
    row.rest=result.P;row.normal=result.N;
  }
  for(let side=0;side<2;side++){
    const bone=side?5:2,ids=[];
    const seen=new Set();for(const row of [d,...(d.parts||[])]){if(seen.has(row.meshId))continue;seen.add(row.meshId);for(let i=0;i<row.rest.length/3;i++){let w=0;for(let j=0;j<4;j++)if(row.skinIndex[i*4+j]===bone)w+=row.skinWeight[i*4+j];if(w>.999999)ids.push({i,rest:referenceParts.get(row.meshId),next:row.rest});}}
    if(ids.length<30)throw Error('Incomplete cuff dimension anchors');
    const x=new T.Vector3(),y=new T.Vector3();
    for(const {i,rest,next} of ids){x.add(temp.fromArray(rest,i*3));y.add(temp.fromArray(next,i*3));}x.multiplyScalar(1/ids.length);y.multiplyScalar(1/ids.length);
    const cov=Array(9).fill(0),cross=Array(9).fill(0);
    for(const {i,rest,next} of ids){p.fromArray(rest,i*3).sub(x);n.fromArray(next,i*3).sub(y);for(let a=0;a<3;a++)for(let b=0;b<3;b++){cov[a*3+b]+=p.getComponent(a)*p.getComponent(b);cross[a*3+b]+=n.getComponent(a)*p.getComponent(b);}}
    const A=new T.Matrix3().set(...cross).multiply(new T.Matrix3().set(...cov).invert()),det=A.determinant();
    if(!Number.isFinite(det)||det<=.1)throw Error('Degenerate cuff dimension transform');
    const translation=y.clone().sub(x.clone().applyMatrix3(A)),center=new T.Vector3(...basePlanes[side].center).applyMatrix3(A).add(translation),normal=new T.Vector3(...basePlanes[side].normal).applyMatrix3(A.clone().invert().transpose()).normalize();
    Object.assign(d.cuffPlanes[side],{center:center.toArray(),normal:normal.toArray()});report.cuffs.push({bone,vertices:ids.length,determinant:det});
  }
  for(const guide of d.sleeveSectionGuides||[]){const fit=q.rigFit[guide.side],shoulder=new T.Vector3(...fit.shoulder),axis=new T.Vector3(...fit.wrist).sub(shoulder).normalize();for(const section of guide.sections){const center=new T.Vector3();for(const i of section.ids)center.addScaledVector(temp.fromArray(q.dimensionRest,i*3),1/section.ids.length);section.center=center.toArray();section.at=center.sub(shoulder).dot(axis);}}
  d.dims={...q.dimensionValues};q.bodyBackedDimensionReport=report;

}
