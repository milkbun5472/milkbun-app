
export function install(q){
 const T=q.T,o=q.body,g=o.geometry,d=q.neckAreaData,groups=d.groups,F=d.faces,n=groups.length,lookup=new Int32Array(g.attributes.position.count).fill(-1),SI=g.attributes.skinIndex.array,SW=g.attributes.skinWeight.array,R=q.dimensionRest;
 groups.forEach((ids,c)=>ids.forEach(i=>lookup[i]=c));
 const wf=F.map(f=>f.map(i=>lookup[i])),P=new Float64Array(n*3),Q=new Float64Array(n*3),delta=new Float64Array(n*3),count=new Float64Array(n),norms=new Float64Array(F.length*3),sizes=new Float64Array(F.length),oldN=new Float64Array(n*3),newN=new Float64Array(n*3),mats=o.skeleton.bones.map(()=>new T.Matrix4()),mix=groups.map(()=>new T.Matrix3()),v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),norm=new T.Vector3(),M=new T.Matrix4(),inv=new T.Matrix3(),quat=new T.Quaternion();
 const cross=(p,i,j,k,out)=>{v.fromArray(p,i*3);a.fromArray(p,j*3).sub(v);b.fromArray(p,k*3).sub(v);out.crossVectors(a,b);};
 const restNormals=F.map(f=>{v.fromArray(R,f[0]*3);a.fromArray(R,f[1]*3).sub(v);b.fromArray(R,f[2]*3).sub(v);return new T.Vector3().crossVectors(a,b)});restNormals.forEach((x,i)=>sizes[i]=x.length());
 function normals(pos,out){out.fill(0);for(const f of d.normalFaces){cross(pos,...f,norm);for(const i of f){out[i*3]+=norm.x;out[i*3+1]+=norm.y;out[i*3+2]+=norm.z}}}
 const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
 const previous=q.applyLiveFair;
 q.applyLiveFair=()=>{
  previous();const start=performance.now(),feature=q.poseCurveCurrent.feature,active=[0,6].map(k=>1-smooth((Math.hypot(...feature.slice(k+3,k+6))-.03)/.15));if(!active.some(Boolean))return;
  for(let i=0;i<mats.length;i++)mats[i].fromArray(o.skeleton.boneMatrices,i*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);
  for(let j=0;j<n;j++){const i=groups[j][0];o.getVertexPosition(i,v);v.toArray(P,j*3);M.elements.fill(0);for(let k=0;k<4;k++){const e=mats[SI[i*4+k]].elements,w=SW[i*4+k];for(let z=0;z<16;z++)M.elements[z]+=w*e[z]}mix[j].setFromMatrix4(M)}Q.set(P);
  for(let j=0;j<wf.length;j++){norm.set(0,0,0);for(const i of wf[j])norm.add(v.copy(restNormals[j]).applyMatrix3(mix[i]));norm.normalize().toArray(norms,j*3)}
  let iterations=0,violations=0;
  for(let step=0;step<d.iterations;step++){
   delta.fill(0);count.fill(0);let num=0;
   for(let j=0;j<wf.length;j++){const f=wf[j];if(!active[d.side[f[0]]])continue;cross(Q,...f,c);norm.fromArray(norms,j*3);const C=c.dot(norm)-d.ratio*sizes[j];if(C>=-1e-7*sizes[j])continue;num++;const grads=[];let den=0;for(let k=0;k<3;k++){const i=f[k],u=f[(k+1)%3],w=f[(k+2)%3];v.fromArray(Q,u*3).sub(a.fromArray(Q,w*3)).cross(norm);const grad=[v.x,v.y,v.z];grads.push(grad);if(d.free[i])den+=v.lengthSq()}const lambda=-C/Math.max(den,1e-20);for(let k=0;k<3;k++){const i=f[k];if(!d.free[i])continue;for(let z=0;z<3;z++)delta[i*3+z]+=lambda*grads[k][z];count[i]++}}
   if(!step)violations=num;if(!num)break;iterations++;
   for(let i=0;i<n;i++){if(!count[i])continue;for(let z=0;z<3;z++)Q[i*3+z]+=.7*delta[i*3+z]/count[i];v.fromArray(Q,i*3).sub(a.fromArray(P,i*3));const length=v.length();if(length>d.cap)v.multiplyScalar(d.cap/length);v.add(a).toArray(Q,i*3)}
  }
  for(let i=0;i<n;i++)for(let k=0;k<3;k++)Q[i*3+k]=P[i*3+k]+(Q[i*3+k]-P[i*3+k])*active[d.side[i]];
  let max=0,changed=0;for(let i=0;i<n;i++)max=Math.max(max,v.fromArray(Q,i*3).sub(a.fromArray(P,i*3)).length());
  if(max>1e-14){normals(P,oldN);normals(Q,newN);for(let j=0;j<n;j++){if(!d.free[j])continue;v.fromArray(Q,j*3).sub(a.fromArray(P,j*3));const move=v.clone();a.fromArray(oldN,j*3).normalize();b.fromArray(newN,j*3).normalize();quat.setFromUnitVectors(a,b);if(move.lengthSq()>1e-28)changed+=groups[j].length;
    for(const i of groups[j]){inv.copy(mix[j]).invert();v.copy(move).applyMatrix3(inv);g.attributes.position.setXYZ(i,g.attributes.position.getX(i)+v.x,g.attributes.position.getY(i)+v.y,g.attributes.position.getZ(i)+v.z);q.readMorphedNormal(i,v);v.applyMatrix3(mix[j]);a.copy(v).applyQuaternion(quat).sub(v).applyMatrix3(inv);g.attributes.normal.setXYZ(i,g.attributes.normal.getX(i)+a.x,g.attributes.normal.getY(i)+a.y,g.attributes.normal.getZ(i)+a.z)}
   }g.attributes.position.needsUpdate=true;g.attributes.normal.needsUpdate=true;}
  q.poseCurveCurrent.neckArea={maxDelta:max,changed,violations,iterations,milliseconds:performance.now()-start};
  if(q.neckAreaTrace)q.poseCurveCurrent.neckArea.deltas=groups.flatMap((_,i)=>{const dx=Q[i*3]-P[i*3],dy=Q[i*3+1]-P[i*3+1],dz=Q[i*3+2]-P[i*3+2];return Math.hypot(dx,dy,dz)>1e-14?[[i,dx,dy,dz]]:[]});
 };

}
