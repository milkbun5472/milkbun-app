import * as T from 'three';
export const transientEmotionFace=pose=>pose?.wink>.08?'relax':pose?.tongue>.08?'happy':pose?.cry>.08?'sad':null;
// 使用原头部锚点和真实面部表面。只有吐舌／哭泣时才分配附属几何。
export function makeEmotionFeatures(model){
 const head=model.getObjectByName('HeadAnchor'),body=model.getObjectByName('DollBody');let tongue=null,tears=null;const samples=new Map();let shapeKey="";
 const sample=(x,y)=>{
  const key=x+","+y;if(samples.has(key))return samples.get(key).clone();
  const origin=head.localToWorld(new T.Vector3(x,y,3)),dir=new T.Vector3(0,0,-1).transformDirection(head.matrixWorld),ray=new T.Raycaster(origin,dir);
  const hit=body?.isMesh?ray.intersectObject(body,false)[0]:null;const point=hit?head.worldToLocal(hit.point):new T.Vector3(x,y,.87);samples.set(key,point.clone());return point;
 };
 const surface=(x,y)=>{const low=Math.floor(y/.05)*.05,high=low+.05;return sample(x,low).lerp(sample(x,high),(y-low)/.05);};
 return {update(pose){
  if(!head)return;const key=(body?.morphTargetInfluences||[]).join(",");if(key!==shapeKey){shapeKey=key;samples.clear();}
  if(pose?.tongue&&!tongue){tongue=new T.Mesh(new T.SphereGeometry(.13,16,10),new T.MeshStandardMaterial({color:'#dc8f99',roughness:.8}));tongue.name='CompanionTongue';head.add(tongue);}
  if(tongue){tongue.visible=(pose?.tongue||0)>.001;if(tongue.visible){head.updateWorldMatrix(true,true);const at=surface(.025,-.84);tongue.position.copy(at).add(new T.Vector3(0,-.045,.025));tongue.scale.set(1,.65*pose.tongue,.34);}}
  if(pose?.cry&&!tears){
   tears=new T.Group();tears.name='CompanionTears';head.add(tears);
   for(const side of [-1,1])for(let i=0;i<2;i++){const drop=new T.Mesh(new T.SphereGeometry(.045,10,8),new T.MeshStandardMaterial({color:'#9cc9df',transparent:true,opacity:.8,roughness:.22}));drop.userData.side=side;drop.userData.offset=i*.5;drop.name='TearDrop';tears.add(drop);}
  }
  if(tears){tears.visible=(pose?.cry||0)>.001;if(tears.visible){head.updateWorldMatrix(true,true);for(const drop of tears.children){const phase=((pose.tearPhase||0)+drop.userData.offset)%1,at=surface(drop.userData.side*.35,-.53-Math.min(.45,phase*.65));drop.position.copy(at).add(new T.Vector3(0,-Math.max(0,phase-.7)*.7,.025));drop.scale.set(.85,1.5+phase, .32);drop.material.opacity=pose.cry*(1-phase)*.9;}}}
 }};
}
