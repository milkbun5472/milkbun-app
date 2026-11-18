
export function install(q){
const T=q.T,o=q.body,g=o.geometry,d=q.jointFlowData,SI=g.attributes.skinIndex.array,SW=g.attributes.skinWeight.array,R=q.dimensionRest,groups=d.groups,n=groups.length,lookup=new Int32Array(g.attributes.position.count).fill(-1),fixed=new Set(d.fixed),mats=o.skeleton.bones.map(()=>new T.Matrix4()),mix=new T.Matrix4(),inv=new T.Matrix3(),mat3=new T.Matrix3(),v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),normal=new T.Vector3(),quat=new T.Quaternion(),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
groups.forEach((ids,c)=>ids.forEach(i=>lookup[i]=c));
const P=new Float64Array(n*3),Q=new Float64Array(n*3),beforeN=new Float64Array(n*3),afterN=new Float64Array(n*3),oldRaw=new Float64Array(g.attributes.position.count*3),vertexMove=new Float64Array(g.attributes.position.count*3);
const arms=d.arms.map((arm,s)=>{const S=new T.Vector3(...q.rigFit[s].shoulder),E=new T.Vector3(...q.rigFit[s].elbow),D=new T.Vector3(...q.rigFit[s].wrist).sub(S).normalize(),weights=arm.ids.map((i,k)=>smooth((arm.owner[k]-.7)/.28)*smooth((v.fromArray(R,i*3).sub(S).dot(D)-.045)/.05));return {...arm,a:[1,4][s],S,E,D,weights}});
for(const arm of arms){arm.flowInput=new Float64Array(arm.ids.length*3);arm.flow=q.numericCore.makeJointFlow(arm.ids.length);}
function skin(i){mix.elements.fill(0);for(let k=0;k<4;k++){const w=SW[i*4+k],e=mats[SI[i*4+k]].elements;for(let j=0;j<16;j++)mix.elements[j]+=w*e[j]}}
function normals(pos,out){out.fill(0);for(const f of d.normalFaces){v.fromArray(pos,f[0]*3);a.fromArray(pos,f[1]*3).sub(v);b.fromArray(pos,f[2]*3).sub(v);normal.crossVectors(a,b);for(const c of f){out[c*3]+=normal.x;out[c*3+1]+=normal.y;out[c*3+2]+=normal.z}}}
const last=[],cachedP=[],cachedN=[];let cacheValid=false;
function applyCache(){q.applyPoseAttributeDeltas(cachedP,cachedN)}
const previous=q.applyLiveFair;q.applyLiveFair=()=>{
 previous();const started=performance.now(),feature=q.poseCurveCurrent.feature,acts=[0,6].map(k=>smooth((Math.hypot(...feature.slice(k+3,k+6))-.03)/.15));if(!acts.some(Boolean)){q.posedBuffer=null;q.poseCurveCurrent.jointFlow={maxDelta:0,active:false};return}
 const key=[];for(let j=0;j<mats.length;j++){mats[j].fromArray(o.skeleton.boneMatrices,j*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);key.push(...mats[j].elements)}key.push(...o.morphTargetInfluences);q.beginPosedBuffer(mats);
 if(cacheValid&&key.every((x,i)=>Math.abs(x-last[i])<1e-12)){applyCache();q.poseCurveCurrent.jointFlow={...q.jointFlowLast,cacheHit:true};return}last.splice(0,last.length,...key);cachedP.length=0;cachedN.length=0;cacheValid=false;
 for(const c of d.context){v.set(0,0,0);for(const i of groups[c]){a.fromArray(q.posedBuffer,i*3);v.addScaledVector(a,1/groups[c].length)}v.toArray(P,c*3)}Q.set(P);vertexMove.fill(0);const sideMax=[0,0],k1=[0,0,0],k2=[0,0,0],k3=[0,0,0],k4=[0,0,0];let maxDelta=0;
 for(let side=0;side<2;side++){
  if(!acts[side])continue;const arm=arms[side],rv=feature.slice(side*6+3,side*6+6),theta=Math.hypot(...rv),axis=new T.Vector3(...rv).multiplyScalar(1/theta),planes=new Float64Array(33*3),rx0=rv[0],ry0=rv[1],rz0=rv[2],dt=1/16;
  for(let j=0;j<=16*2;j++){quat.setFromAxisAngle(axis,theta*j/(16*4));arm.D.clone().applyQuaternion(quat).toArray(planes,j*3)}

  for(let k=0;k<arm.ids.length;k++){
   const i=arm.ids[k],weight=arm.weights[k]*acts[side];if(weight===0)continue;let x=R[i*3],y=R[i*3+1],z=R[i*3+2],rx=x,ry=y,rz=z;
   for(let j=0;j<arm.inverseDelta.length;j++){const w=o.morphTargetInfluences[j];if(!w)continue;const p=arm.inverseDelta[j],c=g.morphAttributes.position[j].array;x+=w*p[k*3];y+=w*p[k*3+1];z+=w*p[k*3+2];rx+=w*c[i*3];ry+=w*c[i*3+1];rz+=w*c[i*3+2]}
   q.transformRawPosePoint(i,rx,ry,rz,v);v.toArray(oldRaw,i*3);x-=arm.E.x;y-=arm.E.y;z-=arm.E.z;
   arm.flowInput[k*3]=x;arm.flowInput[k*3+1]=y;arm.flowInput[k*3+2]=z;
  }
  const flowed=arm.flow(arm.flowInput,planes,rv,d.width);
  for(let k=0;k<arm.ids.length;k++){
   const i=arm.ids[k],weight=arm.weights[k]*acts[side];if(weight===0)continue;const x=flowed[k*3],y=flowed[k*3+1],z=flowed[k*3+2];
   v.set(x+arm.E.x,y+arm.E.y,z+arm.E.z).applyMatrix4(mats[arm.a]);const dx=(v.x-oldRaw[i*3])*weight,dy=(v.y-oldRaw[i*3+1])*weight,dz=(v.z-oldRaw[i*3+2])*weight;vertexMove[i*3]+=dx;vertexMove[i*3+1]+=dy;vertexMove[i*3+2]+=dz;sideMax[side]=Math.max(sideMax[side],Math.hypot(dx,dy,dz))
  }
 }
 maxDelta=Math.max(...sideMax);if(maxDelta<1e-5){q.jointFlowLast={maxDelta:0,numericalResidual:maxDelta,active:false,milliseconds:performance.now()-started};q.poseCurveCurrent.jointFlow=q.jointFlowLast;cacheValid=true;return}
 for(const c of d.targets)for(const i of groups[c])for(let k=0;k<3;k++)Q[c*3+k]+=vertexMove[i*3+k]/groups[c].length;
 normals(P,beforeN);normals(Q,afterN);let fairMax=0;
 for(const c of d.targets){if(fixed.has(c))continue;v.fromArray(Q,c*3).sub(a.fromArray(P,c*3));const delta=v.clone();a.fromArray(beforeN,c*3).normalize();b.fromArray(afterN,c*3).normalize();quat.setFromUnitVectors(a,b);
  for(const i of groups[c]){mat3.fromArray(q.poseLinear,i*9);inv.fromArray(q.poseInverse,i*9);v.copy(delta).applyMatrix3(inv);if(v.lengthSq()>1e-28)cachedP.push([i,v.x,v.y,v.z]);q.readMorphedNormal(i,v);v.applyMatrix3(mat3);a.copy(v).applyQuaternion(quat).sub(v).applyMatrix3(inv);if(a.lengthSq()>1e-28)cachedN.push([i,a.x,a.y,a.z])}
 }
 applyCache();cacheValid=true;q.jointFlowLast={maxDelta,fairMax,sideMax,vertices:cachedP.length,active:true,milliseconds:performance.now()-started};q.poseCurveCurrent.jointFlow=q.jointFlowLast;
};
}
