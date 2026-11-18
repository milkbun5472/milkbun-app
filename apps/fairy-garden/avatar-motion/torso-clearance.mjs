import {makeSurfaceQuery} from './surface-query.mjs?v=fg-aafbc8d2b09d9fb6';
export function install(q){
const T=q.T,o=q.body,g=o.geometry,R=q.dimensionRest,C=q.dimensionCanonicalRest,F=g.index.array,SI=g.attributes.skinIndex.array,SW=g.attributes.skinWeight.array,d=q.jointFlowData,n=g.attributes.position.count,smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x)},P=new Float64Array(n*3),N=new Float64Array(n*3),v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),norm=new T.Vector3(),cp=new T.Vector3(),bary=new T.Vector3(),tri=new T.Triangle();
const owner=[1,4].map(bone=>Float64Array.from({length:n},(_,i)=>{let w=0;for(let k=0;k<4;k++)if(SI[i*4+k]===bone||SI[i*4+k]===bone+1)w+=SW[i*4+k];return w}));
const bodyFaces=[];for(let j=0;j<F.length;j+=3){const ids=[F[j],F[j+1],F[j+2]];if(ids.every(i=>owner[0][i]+owner[1][i]<.05&&C[i*3+1]>.40&&C[i*3+1]<.72))bodyFaces.push(ids)}
const probes=[0,1].map(side=>{const S=new T.Vector3(...q.rigFit[side].shoulder),D=new T.Vector3(...q.rigFit[side].wrist).sub(S).normalize(),ids=[];for(let i=0;i<n;i++){const t=v.fromArray(R,i*3).sub(S).dot(D);if(owner[side][i]>.55&&t>-.02&&t<.20)ids.push(i)}return ids});
const skinM=o.skeleton.bones.map(()=>new T.Matrix4());
function geometry(){for(let j=0;j<skinM.length;j++)skinM[j].fromArray(o.skeleton.boneMatrices,j*16).premultiply(o.bindMatrixInverse).multiply(o.bindMatrix);if(!q.posedBuffer)throw Error('Missing posed geometry');P.set(q.posedBuffer);initializeNormals();}

const rawN=new Float64Array(n*3),faceNormals=new Float64Array(F.length),changedFaces=[[],[]],changedVertices=[new Set(),new Set()],normalDirty=[false,false];let treeNeedsFull=true;
for(let j=0;j<F.length;j+=3)for(let side=0;side<2;side++){const w=owner[side];if(w[F[j]]!==w[F[j+1]]||w[F[j]]!==w[F[j+2]]){changedFaces[side].push(j);for(let k=0;k<3;k++)changedVertices[side].add(F[j+k])}}
const affectedVertices=[...new Set([...changedVertices[0],...changedVertices[1]])];changedVertices[0]=[...changedVertices[0]];changedVertices[1]=[...changedVertices[1]];
function faceArea(j){const k=F[j]*3,h=F[j+1]*3,l=F[j+2]*3,ax=P[h]-P[k],ay=P[h+1]-P[k+1],az=P[h+2]-P[k+2],bx=P[l]-P[k],by=P[l+1]-P[k+1],bz=P[l+2]-P[k+2];return [ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx]}
function initializeNormals(){rawN.fill(0);for(let j=0;j<F.length;j+=3){const area=faceArea(j);for(let k=0;k<3;k++){faceNormals[j+k]=area[k];for(let t=0;t<3;t++)rawN[F[j+t]*3+k]+=area[k]}}for(let i=0;i<n;i++){const k=i*3,l=Math.hypot(rawN[k],rawN[k+1],rawN[k+2])||1;N[k]=rawN[k]/l;N[k+1]=rawN[k+1]/l;N[k+2]=rawN[k+2]/l}normalDirty.fill(false);treeNeedsFull=true}
function translateNormals(side){for(const j of changedFaces[side]){const area=faceArea(j);for(let k=0;k<3;k++){const delta=area[k]-faceNormals[j+k];faceNormals[j+k]=area[k];for(let t=0;t<3;t++)rawN[F[j+t]*3+k]+=delta}}normalDirty[side]=true}
function normalsFromCurrent(){for(let side=0;side<2;side++)if(normalDirty[side]){for(const i of changedVertices[side]){const k=i*3,l=Math.hypot(rawN[k],rawN[k+1],rawN[k+2])||1;N[k]=rawN[k]/l;N[k+1]=rawN[k+1]/l;N[k+2]=rawN[k+2]/l}normalDirty[side]=false}}

P.set(R);const bodyOwner=Float64Array.from(owner[0],(v,i)=>v+owner[1][i]),surface=makeSurfaceQuery(P,bodyFaces,N,bodyOwner,q.numericCore),hit=new Float64Array(8),constraints=probes.map(ids=>new Float64Array(ids.length*4));
q.torsoSurface?.dispose();q.torsoSurface=surface;
function tree(){surface.refit(treeNeedsFull);treeNeedsFull=false;return surface}

const previous=q.applyLiveFair;let lastKey=null,lastOffsets=null,lastStats=null;const cachedNormals=[],fixed=new Set(q.dimensionData.kept.map(x=>x[0])),boneIds=['leftArm','rightArm'].map(name=>o.skeleton.bones.findIndex(b=>b.name===name));
const appliedOffsets=boneIds.map(()=>new T.Vector3());
function clearOffsets(){for(let side=0;side<2;side++){o.skeleton.bones[boneIds[side]].position.sub(appliedOffsets[side]);appliedOffsets[side].set(0,0,0)}q.armTorsoOffsets=null;}
function place(offsets){const saved=q.poseCurveCurrent;q.armTorsoOffsets=offsets;for(let side=0;side<2;side++){const bone=o.skeleton.bones[boneIds[side]],delta=new T.Vector3(...offsets[side]).applyMatrix3(new T.Matrix3().setFromMatrix4(o.matrixWorld));delta.applyMatrix3(new T.Matrix3().setFromMatrix4(bone.parent.matrixWorld.clone().invert()));bone.position.add(delta);appliedOffsets[side].copy(delta)}q.applyPoseCurve();q.updatePosedBoneTranslations();q.poseCurveCurrent={...q.poseCurveCurrent,...saved};for(const [i,x,y,z]of cachedNormals)g.attributes.normal.setXYZ(i,g.attributes.normal.getX(i)+x,g.attributes.normal.getY(i)+y,g.attributes.normal.getZ(i)+z);if(cachedNormals.length)g.attributes.normal.needsUpdate=true}

q.beforePose.push(clearOffsets);
q.applyLiveFair=()=>{
 clearOffsets();previous();const started=performance.now(),key=[...o.skeleton.boneMatrices,...o.morphTargetInfluences];
 if(lastKey&&key.every((x,i)=>Math.abs(x-lastKey[i])<1e-12)){if(lastOffsets.some(x=>Math.hypot(...x)>0))place(lastOffsets);q.poseCurveCurrent.torsoClearance={...lastStats,cacheHit:true};return}
 if([0,1].every(side=>Math.hypot(...q.poseCurveCurrent.feature.slice(side*6+3,side*6+6))<.03)){lastKey=key;lastOffsets=[[0,0,0],[0,0,0]];lastStats={bodyOffsets:lastOffsets,iterations:0,constraints:0,milliseconds:performance.now()-started};q.poseCurveCurrent.torsoClearance=lastStats;return}
 geometry();const initialNormals=new Float64Array(N);cachedNormals.length=0;const shifts=[new T.Vector3(),new T.Vector3()];let constraintsCount=0,iterations=0;
 for(let step=0;step<6;step++){
  normalsFromCurrent();const root=tree();let moved=false;
  for(let side=0;side<2;side++){
   const rv=q.poseCurveCurrent.feature.slice(side*6+3,side*6+6);if(Math.hypot(...rv)<.03)continue;
   const list=constraints[side],count=surface.queryConstraints(probes[side],.015,list);constraintsCount+=count;
   let dx=0,dy=0,dz=0;for(let pass=0;pass<12;pass++)for(let i=0;i<count;i++){const k=i*4,nx=list[k],ny=list[k+1],nz=list[k+2],need=list[k+3],residual=need+.0005*smooth(need/.001)-(nx*dx+ny*dy+nz*dz);if(residual>0){dx+=nx*residual;dy+=ny*residual;dz+=nz*residual}}const delta=new T.Vector3(dx,dy,dz);

   if(delta.length()<1e-7)continue;const old=shifts[side].clone();shifts[side].add(delta);if(shifts[side].length()>.025)shifts[side].setLength(.025);delta.copy(shifts[side]).sub(old);for(let i=0;i<n;i++){const w=owner[side][i];P[i*3]+=w*delta.x;P[i*3+1]+=w*delta.y;P[i*3+2]+=w*delta.z}translateNormals(side);moved=true;
  }
  if(!moved)break;iterations++;
 }
 if(shifts.some(s=>s.length()>0)){normalsFromCurrent();const quat=new T.Quaternion(),M=new T.Matrix4(),A=new T.Matrix3(),inv=new T.Matrix3();for(const i of affectedVertices){if(fixed.has(i))continue;a.fromArray(initialNormals,i*3);b.fromArray(N,i*3);if(a.dot(b)>1-1e-12)continue;quat.setFromUnitVectors(a,b);A.fromArray(q.poseLinear,i*9);inv.fromArray(q.poseInverse,i*9);q.readMorphedNormal(i,v);v.applyMatrix3(A);a.copy(v).applyQuaternion(quat).sub(v).applyMatrix3(inv);cachedNormals.push([i,a.x,a.y,a.z])}place(shifts.map(s=>s.toArray()))}
 lastKey=key;lastOffsets=shifts.map(s=>s.toArray());lastStats={bodyOffsets:lastOffsets,iterations,constraints:constraintsCount,milliseconds:performance.now()-started};q.poseCurveCurrent.torsoClearance=lastStats;
};

}
