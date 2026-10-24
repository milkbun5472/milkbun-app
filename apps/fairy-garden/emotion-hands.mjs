import * as T from 'three';
import {pointToolAt} from './reach-hand.mjs?v=fg-32f56e8e0d66a403';
export const POINT_FINGER_TIP=[-.025,.02,.095];
export const handScaleOf=look=>.9+.1*Number(look?.dims?.build||1);
const ball=(group,mat,r,x,y,z,scale=[1,1,1])=>{const o=new T.Mesh(new T.SphereGeometry(r,12,8),mat);o.position.set(x,y,z);o.scale.set(...scale);group.add(o);return o;};
const finger=(group,mat,points,r=.012)=>{const g=new T.Group();g.userData.finger=true;group.add(g);const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));g.add(new T.Mesh(new T.TubeGeometry(curve,14,r,8,false),mat));for(const p of [points[0],points.at(-1)])ball(g,mat,r,...p);return g;};
// 现役身体是连在前臂上的圆手套。手势期间只替换手掌末端，手腕仍用原骨架。
export function handStyle(pose,side){
 if(pose?.heart)return 'heart';if(side==='left')return null;
 if(pose?.thumb)return 'thumb';if(pose?.pinch)return 'pinch';if(pose?.poke||pose?.phone)return 'point';return null;
}
export function makeEmotionHands(model,handPoint){
 const groups=new Map(),mat=new T.MeshStandardMaterial({color:'#f2cbb4',roughness:.92});
 function make(style,side){
  const g=new T.Group();g.name='CompanionHand-'+side+'-'+style;model.add(g);
  ball(g,mat,.043,0,0,0,[.9,1,.75]).name='GesturePalm';const sign=side==='left'?-1:1;
  if(style==='heart'){
   finger(g,mat,[[0,.012,0],[-sign*.018,.052,0],[-sign*.056,.054,0],[-sign*.066,.019,0]]).name='HeartIndex';
   finger(g,mat,[[0,-.012,.008],[-sign*.025,-.03,.015],[-sign*.066,-.055,.01]],.013).name='HeartThumb';
   for(let i=0;i<3;i++)ball(g,mat,.014,sign*(.012+i*.008),-.014+i*.01,.026,[.8,1.5,.8]);
  }else if(style==='thumb'){
   for(let i=0;i<4;i++)ball(g,mat,.013,-.026+i*.017,0,.026,[.85,1.55,.8]);
   finger(g,mat,[[-.029,-.01,.004],[-.045,.025,.004],[-.043,.078,.005]],.016).name='RaisedThumb';
  }else{
   for(let i=0;i<3;i++)ball(g,mat,.013,-.005+i*.016,-.005,.024,[.75,1.5,.9]);
   if(style==='point'){
    finger(g,mat,[[-.025,.018,.006],[-.025,.02,.045],POINT_FINGER_TIP],.012).name='PointIndex';
    finger(g,mat,[[.032,-.015,.002],[.024,-.025,.035],[.009,-.009,.047]],.014);
   }else{
    const index=finger(g,mat,[[-.025,.018,0],[-.035,.025,.052],[-.012,.02,.096]],.012);index.name='PinchIndex';
    const thumb=finger(g,mat,[[.029,-.02,0],[.035,-.013,.047],[.009,.003,.09]],.014);thumb.name='PinchThumb';
   }
  }
  return g;
 }
 return {update(pose,look={}){
  mat.color.set(look.skin||'#f2cbb4');for(const g of groups.values())g.visible=false;
  for(const side of ['left','right']){
   const style=handStyle(pose,side);if(!style)continue;const key=side+'-'+style;let g=groups.get(key);if(!g){g=make(style,side);groups.set(key,g);}
   g.visible=true;pointToolAt(g,model,handPoint(side),null,.1);
   const amount=Math.max(pose.heart||0,pose.thumb||0,pose.poke||0,pose.pinch||0,pose.phone||0);g.traverse(o=>{if(o.userData.finger)o.scale.setScalar(amount);});
   g.scale.setScalar(handScaleOf(look));
   if(pose.phone)g.rotation.x=Math.PI/2;
   if(style==='pinch'){g.getObjectByName('PinchIndex').rotation.y=.16*(pose.pinchTap||0);g.getObjectByName('PinchThumb').rotation.y=-.12*(pose.pinchTap||0);}
  }
 }};
}
