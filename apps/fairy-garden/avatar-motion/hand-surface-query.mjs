import * as T from 'three';

// Query the rendered native hand, including dimension and material corrections.
// Keep the IK marker in its authored location; only the contact target is fitted.
export function createHandSurfaceQuery(body,canonical,readPosition){
 const g=body.geometry,index=g.index.array,regions={};
 for(const side of ['left','right']){
  const influence=g.getAttribute(side==='left'?'skinLeftForearmInfluence':'skinRightForearmInfluence'),points=new Map(),faces=[];
  for(let j=0;j<index.length;j+=3){
   const ids=[index[j],index[j+1],index[j+2]];
   if(!ids.every(i=>influence.getX(i)>.9&&canonical[i*3+1]<.46))continue;
   for(const i of ids)if(!points.has(i))points.set(i,new T.Vector3());
   faces.push(ids.map(i=>points.get(i)));
  }
  regions[side]={points,faces};
 }
 const triangle=new T.Triangle(),candidate=new T.Vector3();
 return (side,target)=>{
  const region=regions[side];if(!region?.faces.length)return null;
  body.updateWorldMatrix(true,false);
  for(const [i,p]of region.points){readPosition(i,p);p.applyMatrix4(body.matrixWorld);}
  let distance=Infinity,best=null;
  for(const face of region.faces){triangle.set(...face).closestPointToPoint(target,candidate);const d=candidate.distanceToSquared(target);if(d<distance){distance=d;if(!best)best=new T.Vector3();best.copy(candidate);}}
  return best;
 };
}
