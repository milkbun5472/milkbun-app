import * as T from 'three';
import {pointToolAt} from './reach-hand.mjs?v=fg-4311e66fca37852a';

// 一朵实际拿在手里的小花；第一次递花时才建，整页和悬浮共用。
export function makeEmotionProps(model,handPoint){
 const flower=new T.Group();flower.name='CompanionFlower';model.add(flower);flower.visible=false;
 const green=new T.MeshStandardMaterial({color:'#719a75',roughness:.9}),pink=new T.MeshStandardMaterial({color:'#eab3bf',roughness:.85}),gold=new T.MeshStandardMaterial({color:'#e5c77b',roughness:.8});
 const add=(geo,mat,x,y,z)=>{const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);flower.add(mesh);return mesh;};
 const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.045,0),new T.Vector3(.007,.07,0),new T.Vector3(-.012,.17,0)]);
 add(new T.TubeGeometry(curve,12,.006,6,false),green,0,0,0).name='FlowerStem';
 for(const sign of [-1,1]){const leaf=add(new T.SphereGeometry(.028,10,6),green,sign*.023,.04+sign*.015,0);leaf.scale.set(1,.38,.28);leaf.rotation.z=sign*.45;leaf.name='FlowerLeaf';}
 const petalGeo=new T.SphereGeometry(.032,12,8);
 for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,petal=add(petalGeo,pink,-.012+Math.cos(angle)*.029,.17+Math.sin(angle)*.029,.004);petal.scale.set(.8,1,.4);petal.rotation.z=angle-Math.PI/2;petal.name='FlowerPetal';}
 const center=add(new T.SphereGeometry(.019,12,8),gold,-.012,.17,.018);center.scale.z=.6;center.name='FlowerCenter';
 const grip=new T.Object3D();grip.name='FlowerGrip';flower.add(grip);
 return {update(pose){
  const amount=pose?.flower||0;flower.visible=amount>.001;if(!flower.visible)return;
  pointToolAt(flower,model,handPoint('right'),null,.2);
  flower.scale.setScalar(amount);flower.rotation.z=-.12;
 }};
}
