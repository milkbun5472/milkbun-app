import {createCovarianceRotation} from './covariance-rotation.mjs?v=fg-a18a22cf5c6cefbf';
import {fitRigid} from './rigid-fit.mjs?v=fg-a18a22cf5c6cefbf';
const anchorCache=new WeakMap();
function materialAnchors(data){let rows=anchorCache.get(data);if(rows)return rows;
 const a=data.anchors;rows=new Map(a.ids.map((id,j)=>[id,[id,a.side[j],a.weight[j],a.body.slice(j*3,j*3+3),a.bary.slice(j*3,j*3+3),a.offset[j],a.baseBody.slice(j*3,j*3+3),a.baseBary.slice(j*3,j*3+3),a.baseOffset[j]]]));anchorCache.set(data,rows);return rows;
}
// The sleeve follows the final naked-body surface in material coordinates.
// Only the shoulder attachment relaxes; the elbow path is never re-solved.
export function createSleeveEnvelope(T,dataPack,rest,entries,faces,core){
 const roots=new Map((dataPack.rootAnchors||[]).map(r=>[r[0],r])),rootPoint=new T.Vector3(),rootNormal=new T.Vector3();
 const points=materialAnchors(dataPack),P=new Float64Array(rest),N=new Float64Array(rest.length),weights=[0,0],bands=[0,0],v=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3();
 const g=dataPack.shoulder,solver=core.make(g.factor),main=entries.find(e=>e.row.name==='outfit_linen_cloth'),known=new Set(main.ids),restU=Float64Array.from(g.first.flatMap(i=>Array.from(main.row.rest.slice(i*3,i*3+3)))),X=new Float64Array(restU.length),target=new Float64Array(X.length),rot=new Float64Array(g.first.length*9),rhs=new Float64Array(g.unknown.length*3),isUnknown=new Set(g.unknown),rotation=createCovarianceRotation(),Q=new Float64Array(4),S=new Float64Array(9);
 const anchorP=new Float64Array(main.row.rest.length),anchorN=new Float64Array(anchorP.length),anchored=new Float64Array(anchorP.length/3);
// Preserve tangential cloth detail while enforcing its own material-side clearance.
 function contact(i,positions,k){if(!anchored[i])return;const p=i*3,nx=anchorN[p],ny=anchorN[p+1],nz=anchorN[p+2],distance=(positions[k]-anchorP[p])*nx+(positions[k+1]-anchorP[p+1])*ny+(positions[k+2]-anchorP[p+2])*nz;if(distance<.004){const d=(.004-distance)*anchored[i];positions[k]+=nx*d;positions[k+1]+=ny*d;positions[k+2]+=nz*d;}}
 function turn(i){S.fill(0);for(let k=g.ptr[i];k<g.ptr[i+1];k++){const j=g.col[k];for(let a=0;a<3;a++)for(let b=0;b<3;b++)S[a*3+b]+=(restU[i*3+a]-restU[j*3+a])*(X[i*3+b]-X[j*3+b]);}rotation(S,Q);const [x,y,zz,w]=Q;rot.set([1-2*(y*y+zz*zz),2*(x*y-zz*w),2*(x*zz+y*w),2*(x*y+zz*w),1-2*(x*x+zz*zz),2*(y*zz-x*w),2*(x*zz-y*w),2*(y*zz+x*w),1-2*(x*x+y*y)],i*9);
 }
// Inserts share the exact cloth seam, instead of taking a second arm transform.
 let sleevePositions=null;
 function finish(entry,positions){if(entry!==main){if(entry.row.name==='outfit_linen_cuff_patch'&&!entry.row.linear&&sleevePositions){for(const patch of dataPack.trimPatches){const fit=fitRigid(main.row.rest,sleevePositions,patch.anchors),rotation=new T.Quaternion(...fit.quaternion);for(let j=0;j<patch.ids.length;j++){a.fromArray(patch.residual[j]).applyQuaternion(rotation);for(let k=0;k<patch.anchors.length;k++)a.addScaledVector(v.fromArray(sleevePositions,patch.anchors[k]*3),patch.weights[j][k]);a.toArray(positions,patch.ids[j]*3);}}}return;}if(!weights.some(x=>x))return;sleevePositions=positions;for(let j=0;j<g.first.length;j++){const i=g.first[j];if(known.has(i)){X[j*3]=positions[i*3];X[j*3+1]=positions[i*3+1];X[j*3+2]=positions[i*3+2];}else entry.o.getVertexPosition(i,v).toArray(X,j*3);}target.set(X);
 for(let step=0;step<4;step++){for(const i of g.active)turn(i);for(let u=0;u<g.unknown.length;u++){const i=g.unknown[u];for(let a=0;a<3;a++){let sum=g.lam[u]*target[i*3+a];for(let k=g.ptr[i];k<g.ptr[i+1];k++){const j=g.col[k];for(let b=0;b<3;b++)sum+=.5*(rot[i*9+a*3+b]+rot[j*9+a*3+b])*(restU[i*3+b]-restU[j*3+b]);if(!isUnknown.has(j))sum+=target[j*3+a];}rhs[u*3+a]=sum;}}const solved=solver.solve(rhs);for(let u=0;u<g.unknown.length;u++){contact(g.first[g.unknown[u]],solved,u*3);const i=g.unknown[u];for(let k=0;k<3;k++)X[i*3+k]=solved[u*3+k];}}
 for(let j=0;j<g.inv.length;j++){const i=g.inv[j];if(!isUnknown.has(i)||!known.has(j))continue;const amount=weights[entry.row.rest[j*3]<0?0:1];for(let k=0;k<3;k++)positions[j*3+k]+=(X[i*3+k]-positions[j*3+k])*amount;}for(const i of entry.ids)contact(i,positions,i*3);
 }
 return {finish,dispose(){sleevePositions=null;},update(posed,bend){weights[0]=weights[1]=1;bands[0]=bend[0];bands[1]=bend[1];if(!weights.some(x=>x))return;P.set(posed);N.fill(0);for(let j=0;j<faces.length;j+=3){const x=faces[j],y=faces[j+1],z=faces[j+2];a.fromArray(P,x*3);b.fromArray(P,y*3).sub(a);c.fromArray(P,z*3).sub(a);b.cross(c);for(const i of [x,y,z]){N[i*3]+=b.x;N[i*3+1]+=b.y;N[i*3+2]+=b.z}}for(let j=0;j<N.length;j+=3)v.fromArray(N,j).normalize().toArray(N,j);},limit(entry,i,p){
  if(entry.row.name!=='outfit_linen_cloth')return;
  const r=points.get(i);let own=0;
  for(let k=0;k<4;k++)if([1,2,4,5].includes(entry.row.skinIndex[i*4+k]))own+=entry.row.skinWeight[i*4+k];
  const t=Math.max(0,Math.min(1,(own-.05)/.45)),blend=t*t*(3-2*t);
  anchored[i]=0;
  if(r&&blend){
   const amount=weights[r[1]]*r[2]*blend,band=bands[r[1]];
   a.set(0,0,0);normal.set(0,0,0);
   for(let k=0;k<3;k++){
    a.addScaledVector(v.fromArray(P,r[3][k]*3),r[4][k]*band);
    a.addScaledVector(v.fromArray(P,r[6][k]*3),r[7][k]*(1-band));
    normal.addScaledVector(v.fromArray(N,r[3][k]*3),r[4][k]*band);
    normal.addScaledVector(v.fromArray(N,r[6][k]*3),r[7][k]*(1-band));
   }
   normal.normalize();
   if(own>.1){a.toArray(anchorP,i*3);normal.toArray(anchorN,i*3);anchored[i]=blend;}
   a.addScaledVector(normal,r[5]*band+r[8]*(1-band));p.lerp(a,amount);
  }
  const root=roots.get(i);
  if(root){
   rootPoint.set(0,0,0);rootNormal.set(0,0,0);
   for(let k=0;k<3;k++){rootPoint.addScaledVector(v.fromArray(P,root[2][k]*3),root[3][k]);rootNormal.addScaledVector(v.fromArray(N,root[2][k]*3),root[3][k]);}
   rootNormal.normalize();
   if(anchored[i]){a.fromArray(anchorP,i*3).lerp(rootPoint,root[1]).toArray(anchorP,i*3);normal.fromArray(anchorN,i*3).lerp(rootNormal,root[1]).normalize().toArray(anchorN,i*3);}
   else{rootPoint.toArray(anchorP,i*3);rootNormal.toArray(anchorN,i*3);}
   anchored[i]=Math.max(anchored[i],root[1]);
   rootPoint.addScaledVector(rootNormal,root[4]);p.lerp(rootPoint,root[1]);
  }
 }};
}
