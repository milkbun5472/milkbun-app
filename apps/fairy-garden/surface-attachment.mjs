import * as T from 'three';

const CLEARANCE=.003;
// A card stays flat. Its supporting garment triangles follow the live skin,
// while the whole face clears folds/collars, including between grid samples.
export function makeSurfaceAttachment(model,carrier,mesh,origin){
 const attribute=mesh.geometry.attributes.position,flat=Array.from({length:attribute.count},(_,i)=>new T.Vector3().fromBufferAttribute(attribute,i));
 const ray=new T.Raycaster(),front=new T.Vector3(),p=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),weights=new T.Vector3();
 let signature='',anchors=[],envelope=[],fitted=false,fitScale=1,slopes=[0,0];
 mesh.userData.surfaceAttachment=true;carrier.add(mesh);
 const visible=o=>{for(let n=o;n&&n!==model;n=n.parent)if(!n.visible)return false;return true;};
 function candidates(){const surfaces=[];model.traverse(o=>{if(o.isMesh&&!o.userData.surfaceAttachment&&visible(o)&&(o.userData.outfit||o.userData.skinBase))surfaces.push(o);});return surfaces;}
 function vertex(surface,index,target){surface.getVertexPosition(index,target);return surface.localToWorld(target);}
 const descendant=bone=>{for(let b=bone;b;b=b.parent)if(b===carrier)return true;return false;};
 function torsoWeight(o,v){if(!o.isSkinnedMesh)return 1;const si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight;let weight=0;for(let k=0;k<4;k++)if(descendant(o.skeleton.bones[si.getComponent(v,k)]))weight+=sw.getComponent(v,k);return weight;}
 function insideTriangle(points,box){
  let polygon=points;
  for(const [axis,edge,sign]of [['x',box[0],1],['x',box[1],-1],['y',box[2],1],['y',box[3],-1]]){
   const next=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],da=(a[axis]-edge)*sign,db=(b[axis]-edge)*sign;if(da>=0)next.push(a);if((da>=0)!==(db>=0))next.push(a.clone().lerp(b,da/(da-db)));}polygon=next;if(!polygon.length)break;
  }return polygon;
 }
 function collectEnvelope(surfaces,box){
  envelope=[];
  for(const surface of surfaces){
   const attr=surface.geometry.attributes.position,index=surface.geometry.index,points=[],torso=[];
   for(let i=0;i<attr.count;i++){vertex(surface,i,p);points.push(carrier.worldToLocal(p.clone()).sub(mesh.position));torso.push(torsoWeight(surface,i));}
   const faces=[],used=new Set();
   for(let i=0;i<(index?.count||attr.count);i+=3){const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),tri=ids.map(v=>points[v]);if(ids.reduce((n,v)=>n+torso[v],0)/3<=.6||Math.max(...tri.map(p=>p.z))<-.08||!insideTriangle(tri,box).length)continue;faces.push(ids);ids.forEach(v=>used.add(v));}
   if(faces.length)envelope.push({surface,faces,used:[...used],points});
  }
 }
 function update(){
  model.updateMatrixWorld(true);const surfaces=candidates(),key=surfaces.map(o=>[o.uuid,o.geometry.uuid,...(o.morphTargetInfluences||[]).map((v,i)=>['seated','seatDrape'].some(k=>o.morphTargetDictionary?.[k]===i)?0:v)].join(',')).join('|');
  if(key!==signature){
   signature=key;anchors=[];fitted=false;mesh.position.copy(origin());mesh.quaternion.identity();mesh.scale.setScalar(1);
   for(const o of surfaces)if(o.isSkinnedMesh)o.computeBoundingSphere();
   front.set(0,0,1).transformDirection(carrier.matrixWorld);
   // Narrow torsos need a smaller pin. Keep all corners on the torso rather
   // than stretching an outer corner onto a sleeve or leaving it in the air.
   const torso=hit=>[hit.face.a,hit.face.b,hit.face.c].reduce((n,v)=>n+torsoWeight(hit.object,v),0)/3>.6;
   for(const scale of [1,.9,.8,.7,.6]){
    anchors=[];fitScale=scale;
    for(const point of flat){
     const at=point.clone().multiplyScalar(scale).add(mesh.position);at.z=2;carrier.localToWorld(at);ray.set(at,front.clone().negate());
     const hit=ray.intersectObjects(surfaces,false).find(h=>h.face&&carrier.worldToLocal(h.point.clone()).z>-.08&&torso(h));
     if(!hit){anchors=[];break;}
     const {object,face}=hit;vertex(object,face.a,a);vertex(object,face.b,b);vertex(object,face.c,c);T.Triangle.getBarycoord(hit.point,a,b,c,weights);
     anchors.push({surface:object,indices:[face.a,face.b,face.c],weights:weights.clone()});
    }
    if(anchors.length===flat.length)break;
   }
   fitted=anchors.length===flat.length;
   if(fitted){const xs=flat.map(p=>p.x*fitScale),ys=flat.map(p=>p.y*fitScale);collectEnvelope(surfaces,[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)]);}
  }
  mesh.visible=fitted;if(!fitted)return;
  const points=[];let xx=0,yy=0,xz=0,yz=0;
  for(let i=0;i<anchors.length;i++){
   const h=anchors[i];vertex(h.surface,h.indices[0],a);vertex(h.surface,h.indices[1],b);vertex(h.surface,h.indices[2],c);
   p.copy(a).multiplyScalar(h.weights.x).addScaledVector(b,h.weights.y).addScaledVector(c,h.weights.z);
   carrier.worldToLocal(p).sub(mesh.position);points.push(p.clone());const x=flat[i].x*fitScale,y=flat[i].y*fitScale;xx+=x*x;yy+=y*y;xz+=x*p.z;yz+=y*p.z;
  }
  const sx=xx?xz/xx:0,sy=yy?yz/yy:0;slopes=[sx,sy];let height=-Infinity;
  const xs=flat.map(p=>p.x*fitScale),ys=flat.map(p=>p.y*fitScale),box=[Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)];
  for(const group of envelope){
   for(const i of group.used){vertex(group.surface,i,p);group.points[i].copy(carrier.worldToLocal(p).sub(mesh.position));}
   for(const face of group.faces)for(const p of insideTriangle(face.map(i=>group.points[i]),box))height=Math.max(height,p.z-sx*p.x-sy*p.y);
  }
  for(const p of points)height=Math.max(height,p.z-sx*p.x-sy*p.y);
  height+=CLEARANCE*Math.hypot(sx,sy,1);
  for(let i=0;i<flat.length;i++){const x=flat[i].x*fitScale,y=flat[i].y*fitScale;attribute.setXYZ(i,x,y,height+sx*x+sy*y);}
  attribute.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.updateMatrixWorld(true);
 }
 return {update,inspect:()=>({fitted,scale:fitScale,samples:anchors.length,clearance:CLEARANCE,slopes,surfaces:[...new Set(anchors.map(h=>h.surface.name))]}),dispose(){anchors=[];envelope=[];mesh.removeFromParent();}};
}
