import * as T from 'three';
import {pointToolAt} from './reach-hand.mjs?v=fg-6f2fd4e26924293d';

const marker=(group,name,x=0)=>{const o=new T.Object3D();o.name=name;o.position.x=x;group.add(o);};
function makeFlower(){
 const flower=new T.Group();flower.name='CompanionFlower';flower.visible=false;
 const green=new T.MeshStandardMaterial({color:'#719a75',roughness:.9}),pink=new T.MeshStandardMaterial({color:'#eab3bf',roughness:.85}),gold=new T.MeshStandardMaterial({color:'#e5c77b',roughness:.8});
 const add=(geo,mat,x,y,z)=>{const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);flower.add(mesh);return mesh;};
 const curve=new T.CatmullRomCurve3([new T.Vector3(0,-.045,0),new T.Vector3(.007,.07,0),new T.Vector3(-.012,.17,0)]);
 add(new T.TubeGeometry(curve,12,.006,6,false),green,0,0,0).name='FlowerStem';
 for(const sign of [-1,1]){const leaf=add(new T.SphereGeometry(.028,10,6),green,sign*.023,.04+sign*.015,0);leaf.scale.set(1,.38,.28);leaf.rotation.z=sign*.45;leaf.name='FlowerLeaf';}
 const petalGeo=new T.SphereGeometry(.032,12,8);
 for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,petal=add(petalGeo,pink,-.012+Math.cos(angle)*.029,.17+Math.sin(angle)*.029,.004);petal.scale.set(.8,1,.4);petal.rotation.z=angle-Math.PI/2;petal.name='FlowerPetal';}
 const center=add(new T.SphereGeometry(.019,12,8),gold,-.012,.17,.018);center.scale.z=.6;center.name='FlowerCenter';
 const grip=new T.Object3D();grip.name='FlowerGrip';flower.add(grip);
 return flower;
}

function makeGift(){
 const gift=new T.Group();gift.name='CompanionGift';
 const paper=new T.MeshStandardMaterial({color:'#b9c9b6',roughness:.9}),ribbon=new T.MeshStandardMaterial({color:'#f4ded0',roughness:.8});
 const box=(w,h,d,mat,x,y,z)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);gift.add(m);return m;};
 box(.19,.12,.13,paper,0,.05,0).name='GiftBox';box(.204,.026,.144,paper,0,.12,0);
 box(.026,.148,.146,ribbon,0,.058,0);box(.208,.15,.024,ribbon,0,.058,0);
 for(const side of [-1,1]){const bow=new T.Mesh(new T.TorusGeometry(.024,.006,6,16),ribbon);bow.position.set(side*.024,.152,0);bow.rotation.set(Math.PI/2,side*.35,0);bow.scale.set(1,.62,1);gift.add(bow);}
 marker(gift,'GiftGripLeft',-.095);marker(gift,'GiftGripRight',.095);return gift;
}
function makeSign(makeCanvas){
 const sign=new T.Group();sign.name='CompanionSign';
 const wood=new T.MeshStandardMaterial({color:'#b99b7d',roughness:.9}),stick=new T.Mesh(new T.CylinderGeometry(.008,.008,.17,8),wood);stick.position.y=.045;sign.add(stick);
 const canvas=makeCanvas(),ctx=canvas?.getContext('2d');let map=null;
 if(ctx){
  canvas.width=768;canvas.height=416;ctx.fillStyle='#fff8e8';ctx.fillRect(0,0,768,416);
  ctx.strokeStyle='#b5beaa';ctx.lineWidth=14;ctx.strokeRect(18,18,732,380);
  ctx.fillStyle='#526450';ctx.font='bold 190px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('想你',384,215);
  map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 }
 const board=new T.Mesh(new T.PlaneGeometry(.26,.141),new T.MeshBasicMaterial({map,color:map?'#ffffff':'#fff8e8',side:T.DoubleSide}));
 board.position.set(0,.183,.011);board.name='SignPaper';board.userData.text='想你';sign.add(board);marker(sign,'SignGrip');return sign;
}
// 共用手部定位；每件道具等对应动作第一次出现才建，不占普通待机的几何与纹理。
export function makeEmotionProps(model,handPoint,{makeCanvas=()=>globalThis.document?.createElement('canvas')}={}){
 const props=new Map(),factories={flower:makeFlower,gift:makeGift,sign:()=>makeSign(makeCanvas)};
 return {update(pose){
  for(const [kind,create] of Object.entries(factories)){
   const amount=pose?.[kind]||0;let prop=props.get(kind);
   if(!prop&&amount>.001){prop=create();model.add(prop);props.set(kind,prop);}
   if(!prop)continue;prop.visible=amount>.001;if(!prop.visible)continue;
   if(kind==='gift'){
    const leftWorld=handPoint('left'),rightWorld=handPoint('right'),left=model.worldToLocal(leftWorld.clone()),right=model.worldToLocal(rightWorld.clone()),axis=right.clone().sub(left);
    pointToolAt(prop,model,leftWorld.clone().lerp(rightWorld,.5),null,.2);
    if(axis.lengthSq()>1e-12)prop.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),axis.clone().normalize());
    prop.scale.set(axis.length()/.19,amount,amount);
   }else{
    pointToolAt(prop,model,handPoint('right'),null,.2);prop.scale.setScalar(amount);
    prop.rotation.z=kind==='flower'?-.12:(pose.signSway||0);
   }
  }
 }};
}
