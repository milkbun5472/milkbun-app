import * as T from 'three';

// Fit once to the visible garment, then follow its real morph/skin triangles.
// A bone transform alone cannot keep a pin flush when sleeves or the torso bend.
export function makeSurfaceAttachment(model,carrier,mesh,origin){
 const attribute=mesh.geometry.attributes.position,flat=Array.from({length:attribute.count},(_,i)=>new T.Vector3().fromBufferAttribute(attribute,i));
 const ray=new T.Raycaster(),front=new T.Vector3(),p=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),weights=new T.Vector3();
 let signature='',anchors=[],fitted=false,fitScale=1;
 mesh.userData.surfaceAttachment=true;carrier.add(mesh);
 const visible=o=>{for(let n=o;n&&n!==model;n=n.parent)if(!n.visible)return false;return true;};
 function candidates(){const surfaces=[];model.traverse(o=>{if(o.isMesh&&!o.userData.surfaceAttachment&&visible(o)&&(o.userData.outfit||o.userData.skinBase))surfaces.push(o);});return surfaces;}
 function vertex(surface,index,target){surface.getVertexPosition(index,target);return surface.localToWorld(target);}
 function update(){
  model.updateMatrixWorld(true);const surfaces=candidates(),key=surfaces.map(o=>[o.uuid,o.geometry.uuid,...(o.morphTargetInfluences||[]).map((v,i)=>['seated','seatDrape'].some(k=>o.morphTargetDictionary?.[k]===i)?0:v)].join(',')).join('|');
  if(key!==signature){
   signature=key;anchors=[];fitted=false;mesh.position.copy(origin());mesh.quaternion.identity();mesh.scale.setScalar(1);
   for(const o of surfaces)if(o.isSkinnedMesh)o.computeBoundingSphere();
   front.set(0,0,1).transformDirection(carrier.matrixWorld);
   // Narrow torsos need a smaller pin. Keep all corners on the torso rather
   // than stretching an outer corner onto a sleeve or leaving it in the air.
   const torso=hit=>{if(!hit.object.isSkinnedMesh)return true;const o=hit.object,si=o.geometry.attributes.skinIndex,sw=o.geometry.attributes.skinWeight,index=o.skeleton.bones.indexOf(carrier);if(index<0)return false;let weight=0;for(const v of [hit.face.a,hit.face.b,hit.face.c])for(let k=0;k<4;k++)if(si.getComponent(v,k)===index)weight+=sw.getComponent(v,k)/3;return weight>.6;};
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
  }
  mesh.visible=fitted;if(!fitted)return;
  front.set(0,0,1).transformDirection(carrier.matrixWorld);
  for(let i=0;i<anchors.length;i++){
   const h=anchors[i];vertex(h.surface,h.indices[0],a);vertex(h.surface,h.indices[1],b);vertex(h.surface,h.indices[2],c);
   p.copy(a).multiplyScalar(h.weights.x).addScaledVector(b,h.weights.y).addScaledVector(c,h.weights.z);
   normal.subVectors(b,a).cross(c.clone().sub(a)).normalize();if(normal.dot(front)<0)normal.negate();p.addScaledVector(normal,.002);
   carrier.worldToLocal(p).sub(mesh.position);attribute.setXYZ(i,p.x,p.y,p.z);
  }
  attribute.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.updateMatrixWorld(true);
 }
 return {update,inspect:()=>({fitted,scale:fitScale,samples:anchors.length,surfaces:[...new Set(anchors.map(h=>h.surface.name))]}),dispose(){anchors=[];mesh.removeFromParent();}};
}
