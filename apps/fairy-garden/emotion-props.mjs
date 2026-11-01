import {MITTEN_TAP_POINT} from './emotion-hands.mjs?v=fg-90b53e2779ab7a1c';
import * as T from 'three';
import {pointToolAt} from './reach-hand.mjs?v=fg-90b53e2779ab7a1c';

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
const PHONE_TILT=-Math.PI/3;
// 手机摆放与右手按屏幕共用同一个局部变换。
export function phoneTapTarget(model,leftWorld,tap=0,amount=1,handScale=1){
 const point=new T.Vector3(.035,.055,.019).multiplyScalar(amount).applyAxisAngle(new T.Vector3(1,0,0),PHONE_TILT).add(model.worldToLocal(leftWorld.clone()));
 point.sub(new T.Vector3(...MITTEN_TAP_POINT).applyAxisAngle(new T.Vector3(1,0,0),Math.PI).multiplyScalar(handScale));point.y+=.018*(1-tap);return model.localToWorld(point);
}
function makePhone(makeCanvas){
 const g=new T.Group();g.name='CompanionPhone';
 const frame=new T.Mesh(new T.BoxGeometry(.098,.168,.017),new T.MeshStandardMaterial({color:'#798b80',roughness:.7}));frame.position.set(.035,.035,0);g.add(frame);
 const canvas=makeCanvas(),ctx=canvas?.getContext('2d');let map=null;
 if(ctx){canvas.width=256;canvas.height=448;ctx.fillStyle='#f9f4e7';ctx.fillRect(0,0,256,448);ctx.fillStyle='#d8e4d5';ctx.fillRect(22,58,157,45);ctx.fillRect(65,132,168,57);ctx.fillStyle='#c8d5df';ctx.fillRect(22,220,160,42);ctx.fillStyle='#c5c4b5';for(let y=335;y<420;y+=29)for(let x=17;x<240;x+=25)ctx.fillRect(x,y,18,20);map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;}
 const screen=new T.Mesh(new T.PlaneGeometry(.083,.146),new T.MeshBasicMaterial({color:map?'#fff':'#f9f4e7',map}));screen.name='PhoneScreen';screen.position.set(.035,.035,.009);g.add(screen);
 const lens=new T.Mesh(new T.CylinderGeometry(.009,.009,.005,12),new T.MeshStandardMaterial({color:'#364b42',roughness:.3}));lens.rotation.x=Math.PI/2;lens.position.set(.01,.095,-.012);g.add(lens);
 const flash=new T.Mesh(new T.SphereGeometry(.027,12,8),new T.MeshBasicMaterial({color:'#fff8dc',transparent:true,opacity:.85}));flash.name='SelfieFlash';flash.position.set(.01,.095,-.022);flash.visible=false;g.add(flash);marker(g,'PhoneGrip');return g;
}
function makeUmbrella(){
 const g=new T.Group();g.name='CompanionUmbrella';const metal=new T.MeshStandardMaterial({color:'#a99d89',roughness:.8}),colors=['#a6bcb2','#dfc8bb'];
 const pole=new T.Mesh(new T.CylinderGeometry(.005,.005,.65,8),metal);pole.position.y=.31;g.add(pole);
 for(let panel=0;panel<8;panel++){
  const vertices=[],indices=[],segments=4,rings=5;
  for(let r=0;r<=rings;r++)for(let j=0;j<=segments;j++){const theta=(panel+j/segments)*Math.PI/4,rad=.42*r/rings,y=.67-.16*(r/rings)**1.7-(r===rings?.015*Math.sin(j/segments*Math.PI):0);vertices.push(Math.cos(theta)*rad,y,Math.sin(theta)*rad);}
  for(let r=0;r<rings;r++)for(let j=0;j<segments;j++){const a=r*(segments+1)+j,b=a+segments+1;indices.push(a,b,a+1,b,b+1,a+1);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();const cloth=new T.Mesh(geo,new T.MeshStandardMaterial({color:colors[panel%2],roughness:1,side:T.DoubleSide}));cloth.name='UmbrellaCanopy';g.add(cloth);
  const theta=panel*Math.PI/4,curve=new T.CatmullRomCurve3([new T.Vector3(0,.645,0),new T.Vector3(Math.cos(theta)*.24,.612,Math.sin(theta)*.24),new T.Vector3(Math.cos(theta)*.42,.503,Math.sin(theta)*.42)]);const rib=new T.Mesh(new T.TubeGeometry(curve,10,.0025,5,false),metal);rib.name='UmbrellaRib';g.add(rib);
 }
 marker(g,'UmbrellaGrip');return g;
}
function makeCookie(){
 const g=new T.Group();g.name='CompanionCookie';const mat=new T.MeshStandardMaterial({color:'#d6ab70',roughness:.95}),chipMat=new T.MeshStandardMaterial({color:'#795343',roughness:1});
 for(const bitten of [false,true]){
  const shape=new T.Shape();for(let i=0;i<=40;i++){const angle=i*Math.PI*2/40;let r=.057;if(bitten&&angle>.3&&angle<1.45)r=.031+.005*Math.cos(angle*24);const x=Math.cos(angle)*r,y=Math.sin(angle)*r;if(!i)shape.moveTo(x,y);else shape.lineTo(x,y);}shape.closePath();
  const part=new T.Group();part.name=bitten?'BittenCookie':'WholeCookie';part.position.y=.05;part.add(new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.014,bevelEnabled:true,bevelSize:.003,bevelThickness:.002,bevelSegments:1,steps:1}),mat));
  for(const [x,y] of [[-.02,.025],[.016,-.025],[-.03,-.015],[.02,.013]]){const chip=new T.Mesh(new T.SphereGeometry(.005,7,5),chipMat);chip.position.set(x,y,.017);chip.scale.z=.4;part.add(chip);}g.add(part);
 }marker(g,'CookieGrip');return g;
}
// 共用手部定位；每件道具等对应动作第一次出现才建，不占普通待机的几何与纹理。
export function makeEmotionProps(model,handPoint,{makeCanvas=()=>globalThis.document?.createElement('canvas')}={}){
 const props=new Map(),factories={flower:makeFlower,gift:makeGift,sign:()=>makeSign(makeCanvas),phone:()=>makePhone(makeCanvas),cookie:makeCookie,umbrella:makeUmbrella};
 return {update(pose){
  for(const [kind,create] of Object.entries(factories)){
   const amount=kind==='phone'?Math.max(pose?.phone||0,pose?.selfie||0):pose?.[kind]||0;let prop=props.get(kind);
   if(!prop&&amount>.001){prop=create();model.add(prop);props.set(kind,prop);}
   if(!prop)continue;prop.visible=amount>.001;if(!prop.visible)continue;
   if(kind==='gift'){
    const leftWorld=handPoint('left'),rightWorld=handPoint('right'),left=model.worldToLocal(leftWorld.clone()),right=model.worldToLocal(rightWorld.clone()),axis=right.clone().sub(left);
    pointToolAt(prop,model,leftWorld.clone().lerp(rightWorld,.5),null,.2);
    if(axis.lengthSq()>1e-12)prop.quaternion.setFromUnitVectors(new T.Vector3(1,0,0),axis.clone().normalize());
    prop.scale.set(axis.length()/.19,amount,amount);
   }else{
    pointToolAt(prop,model,handPoint(kind==='phone'&&!pose?.selfie?'left':'right'),null,.2);prop.scale.setScalar(amount);
    prop.rotation.z=kind==='flower'?-.12:(pose.signSway||0);
    if(kind==='phone'){prop.rotation.x=pose.selfie?-.2:PHONE_TILT;prop.rotation.y=pose.selfie?Math.PI:0;prop.getObjectByName('SelfieFlash').visible=(pose.selfieFlash||0)>.1;}
    if(kind==='umbrella'){prop.rotation.z=.15;const open=Number.isFinite(pose.umbrellaOpen)?pose.umbrellaOpen:1;for(const part of prop.children)if(['UmbrellaCanopy','UmbrellaRib'].includes(part.name)){const stretch=1+2.2*(1-open);part.scale.set(.09+.91*open,stretch,.09+.91*open);part.position.y=.67*(1-stretch);}}
    if(kind==='cookie'){prop.getObjectByName('WholeCookie').visible=(pose.bite||0)<.5;prop.getObjectByName('BittenCookie').visible=(pose.bite||0)>=.5;}
   }
  }
 }};
}
