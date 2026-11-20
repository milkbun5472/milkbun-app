
export function install(q){
const T=q.T,o=q.body,g=o.geometry,d=q.elbowMetricData,solver=q.numericCore.make(d),groups=d.contextGroups,n=groups.length,P=new Float64Array(n*3),Q=new Float64Array(n*3),before=new Float64Array(n*3),after=new Float64Array(n*3),SI=g.attributes.skinIndex.array,SW=g.attributes.skinWeight.array,v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),normal=new T.Vector3(),quat=new T.Quaternion(),mats=o.skeleton.bones.map(()=>new T.Matrix4()),M=new T.Matrix4(),mat=new T.Matrix3(),inv=new T.Matrix3(),smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)};
function normals(pos,out){out.fill(0);for(const f of d.normalFaces){v.fromArray(pos,f[0]*3);a.fromArray(pos,f[1]*3).sub(v);b.fromArray(pos,f[2]*3).sub(v);normal.crossVectors(a,b);for(const c of f){out[c*3]+=normal.x;out[c*3+1]+=normal.y;out[c*3+2]+=normal.z}}}
function skin(i){mat.fromArray(q.poseLinear,i*9);inv.fromArray(q.poseInverse,i*9)}
const cachedP=[],cachedN=[];let lastKey=null,lastStats=null;
function apply(){q.applyPoseAttributeDeltas(cachedP,cachedN)}
const previous=q.applyLiveFair;q.applyLiveFair=()=>{previous();const started=performance.now(),flow=q.poseCurveCurrent.jointFlow,sideMax=flow?.active?flow.sideMax:[0,0],strength=sideMax.map((x,side)=>smooth((x-1e-6)/.004)*smooth((Math.hypot(...q.poseCurveCurrent.feature.slice(side*6+3,side*6+6))-.03)/.15));if(!strength.some(Boolean))return;
const key=[...o.skeleton.boneMatrices,...o.morphTargetInfluences];if(lastKey&&key.every((x,i)=>Math.abs(x-lastKey[i])<1e-12)){apply();q.poseCurveCurrent.elbowMetric={...lastStats,cacheHit:true};return}
for(let j=0;j<mats.length;j++)mats[j].fromArray(o.skeleton.boneMatrices,j*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);for(let c=0;c<n;c++){v.set(0,0,0);for(const i of groups[c]){a.fromArray(q.posedBuffer,i*3);v.addScaledVector(a,1/groups[c].length)}v.toArray(P,c*3)}Q.set(P);const answer=solver.solve(P);let max=0;
for(let j=0;j<d.free.length;j++){const c=d.free[j],mask=d.regions[0][j]*strength[0]+d.regions[1][j]*strength[1];for(let k=0;k<3;k++)Q[c*3+k]+=(answer[j*3+k]-P[c*3+k])*mask;max=Math.max(max,v.fromArray(Q,c*3).sub(a.fromArray(P,c*3)).length())}const scale=Math.min(1,d.cap/Math.max(max,1e-20));if(scale<1)for(const c of d.free)for(let k=0;k<3;k++)Q[c*3+k]=P[c*3+k]+(Q[c*3+k]-P[c*3+k])*scale;
normals(P,before);normals(Q,after);cachedP.length=0;cachedN.length=0;
for(const c of d.free){v.fromArray(Q,c*3).sub(a.fromArray(P,c*3));const change=v.clone();a.fromArray(before,c*3).normalize();b.fromArray(after,c*3).normalize();quat.setFromUnitVectors(a,b);for(const i of groups[c]){skin(i);v.copy(change).applyMatrix3(inv);cachedP.push([i,v.x,v.y,v.z]);q.readMorphedNormal(i,v);v.applyMatrix3(mat);a.copy(v).applyQuaternion(quat).sub(v).applyMatrix3(inv);cachedN.push([i,a.x,a.y,a.z])}}
apply();lastKey=key;lastStats={maxDelta:max*scale,uncappedMax:max,strength,groups:d.free.length,milliseconds:performance.now()-started};q.poseCurveCurrent.elbowMetric=lastStats;
};
}
