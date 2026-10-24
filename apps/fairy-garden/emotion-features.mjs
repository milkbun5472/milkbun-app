import * as T from 'three';
export const transientEmotionFace=pose=>pose?.wink>.08?'relax':pose?.tongue>.08?'happy':pose?.cry>.08?'sad':pose?.sing>.08?'happy':null;
// 使用原头部锚点和真实面部表面。只有吐舌／哭泣时才分配附属几何。
export function makeEmotionFeatures(model){
 const head=model.getObjectByName('HeadAnchor'),body=model.getObjectByName('DollBody');let tongue=null,tears=null,notes=null;const samples=new Map();let shapeKey="";
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
  if(pose?.sing&&!notes){
   notes=new T.Group();notes.name='CompanionNotes';head.add(notes);const mat=new T.MeshStandardMaterial({color:'#b49c76',roughness:.85});
   for(let i=0;i<3;i++){const note=new T.Group();note.userData.offset=i/3;const dot=new T.Mesh(new T.SphereGeometry(.075,10,8),mat);dot.scale.set(1,.65,.35);note.add(dot);const stem=new T.Mesh(new T.CylinderGeometry(.014,.014,.24,7),mat);stem.position.set(.052,.105,0);note.add(stem);const flag=new T.Mesh(new T.SphereGeometry(.07,10,8),mat);flag.position.set(.09,.21,0);flag.scale.set(.8,.4,.25);note.add(flag);notes.add(note);}
  }
  if(notes){notes.visible=(pose?.sing||0)>.001;if(notes.visible)for(const note of notes.children){const phase=((pose.notePhase||0)+note.userData.offset)%1;note.position.set(1.15+phase*.5,.05+phase*.8,.25);note.scale.setScalar(pose.sing*Math.sin(Math.PI*phase));}}
  if(tears){tears.visible=(pose?.cry||0)>.001;if(tears.visible){head.updateWorldMatrix(true,true);for(const drop of tears.children){const phase=((pose.tearPhase||0)+drop.userData.offset)%1,at=surface(drop.userData.side*.35,-.53-Math.min(.45,phase*.65));drop.position.copy(at).add(new T.Vector3(0,-Math.max(0,phase-.7)*.7,.025));drop.scale.set(.85,1.5+phase, .32);drop.material.opacity=pose.cry*(1-phase)*.9;}}}
 }};
}
