import * as T from 'three';
const regions=new WeakMap();
// The grip marker is invisible and smaller than the rendered palm. Use the
// original body's hand vertices, with the live morph and skin deformation.
export function handSurfaceBounds(model,grip,side){
 const body=model.getObjectByName('DollBody');if(!body?.isSkinnedMesh)return new T.Box3().setFromObject(grip,true);
 let region=regions.get(body);if(!region){const hands={left:[],right:[]},p=new T.Vector3(),attr=body.geometry.attributes.position;let authored;
  model.traverse(o=>{if(o.userData.elbowRig?.hands)authored=o.userData.elbowRig.hands;});
  for(const s of ['left','right']){const center=new T.Vector3(...(authored?.[s]||[s==='left'?-.275:.275,.40,0]));for(let i=0;i<attr.count;i++){p.fromBufferAttribute(attr,i);if(p.distanceToSquared(center)<.10**2)hands[s].push(i);}}
  regions.set(body,region=hands);
 }
 if(!region[side].length)return new T.Box3().setFromObject(grip,true);
 body.updateWorldMatrix(true,false);const bounds=new T.Box3(),p=new T.Vector3();for(const i of region[side]){body.getVertexPosition(i,p);body.localToWorld(p);bounds.expandByPoint(p);}return bounds;
}
