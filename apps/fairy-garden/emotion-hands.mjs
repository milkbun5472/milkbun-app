import * as T from 'three';
import {pointToolAt} from './reach-hand.mjs?v=fg-bf2a8f69e3079bf5';
// Rounded mitten silhouettes share their actual pad with the screen-contact solver.
export const MITTEN_TAP_POINT=[-.018,.077,0];
export const handScaleOf=look=>.9+.1*Number(look?.dims?.build||1);
export function handStyle(pose,side){
 if(side==='left')return pose?.selfie?'peace':null;
 if(pose?.peace)return 'peace';
 if(pose?.thumb)return 'thumb';if(pose?.pinch)return 'pinch';if(pose?.poke||pose?.phone)return 'point';return null;
}
// A single smooth clay surface, rather than separate knuckles and finger tubes.
// Blend rounded volumes, then contour them once when this gesture is first used.
function makeMittenGeometry(kind){
 const forms=kind==='pinch'?[[0,-.014,0,.043,.034,.035]]:[[0,-.005,0,.043,.046,.035]];
 if(kind==='peace')forms.push([-.024,.053,0,.016,.038,.026],[.021,.053,0,.016,.038,.026]);
 if(kind==='thumb')forms.push([-.034,.047,0,.021,.043,.026]);
 if(kind==='point')forms.push([-.018,.042,0,.022,.035,.027]);
 if(kind==='pinch')forms.push([-.028,.026,.016,.021,.029,.026],[.027,.006,.023,.021,.019,.026]);
 const field=(x,y,z)=>{let d=1;for(const [cx,cy,cz,rx,ry,rz]of forms){const v=(Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz)-1)*Math.min(rx,ry,rz),h=Math.max(.012-Math.abs(d-v),0)/.012;d=Math.min(d,v)-h*h*.003;}if(kind==='pinch'){const gap=(Math.hypot((x-.021)/.019,(y-.036)/.014)-1)*.014;d=Math.max(d,-gap);}return d;};
 const step=.005,n=39,origin=[-.095,-.075,-.095],values=new Float32Array(n*n*n),positions=[],normals=[];
 const at=(x,y,z)=>origin.map((v,i)=>v+[x,y,z][i]*step),index=(x,y,z)=>(x*n+y)*n+z;
 for(let x=0;x<n;x++)for(let y=0;y<n;y++)for(let z=0;z<n;z++)values[index(x,y,z)]=field(...at(x,y,z));
 const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]],edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 const normal=p=>{const h=.0001;return new T.Vector3(field(p.x+h,p.y,p.z)-field(p.x-h,p.y,p.z),field(p.x,p.y+h,p.z)-field(p.x,p.y-h,p.z),field(p.x,p.y,p.z+h)-field(p.x,p.y,p.z-h)).normalize();};
 for(let x=0;x<n-1;x++)for(let y=0;y<n-1;y++)for(let z=0;z<n-1;z++){
  const p=corners.map(([dx,dy,dz])=>new T.Vector3(...at(x+dx,y+dy,z+dz))),v=corners.map(([dx,dy,dz])=>values[index(x+dx,y+dy,z+dz)]);
  if(v.every(d=>d>=0)||v.every(d=>d<0))continue;
  for(const t of tetra){const points=[];for(const [a,b]of edges){const i=t[a],j=t[b];if((v[i]<0)===(v[j]<0))continue;points.push(p[i].clone().lerp(p[j],v[i]/(v[i]-v[j])));}
   if(points.length<3)continue;const center=points.reduce((c,p)=>c.add(p),new T.Vector3()).divideScalar(points.length),up=normal(center),u=points[0].clone().sub(center).normalize(),axis=new T.Vector3().crossVectors(up,u);
   points.sort((a,b)=>Math.atan2(a.clone().sub(center).dot(axis),a.clone().sub(center).dot(u))-Math.atan2(b.clone().sub(center).dot(axis),b.clone().sub(center).dot(u)));
   for(let k=1;k<points.length-1;k++)for(const p of [points[0],points[k],points[k+1]]){positions.push(...p.toArray());normals.push(...normal(p).toArray());}
  }
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 if(kind==='pinch'){geo.morphTargetsRelative=true;const close=new Float32Array(positions.length);for(let i=1;i<positions.length;i+=3)close[i]=-.012*T.MathUtils.smoothstep(positions[i],.01,.04);geo.morphAttributes.position=[new T.Float32BufferAttribute(close,3)];}
 return geo;
}
const mittenGeometries=new Map();
function mitten(kind,mat){
 if(!mittenGeometries.has(kind))mittenGeometries.set(kind,makeMittenGeometry(kind));
 const mesh=new T.Mesh(mittenGeometries.get(kind),mat);mesh.name='GesturePalm';return mesh;
}
function heart(){
 const s=new T.Shape();s.moveTo(0,-.035);s.bezierCurveTo(-.015,-.018,-.049,.005,-.037,.029);s.bezierCurveTo(-.028,.046,-.008,.043,0,.026);s.bezierCurveTo(.008,.043,.028,.046,.037,.029);s.bezierCurveTo(.049,.005,.015,-.018,0,-.035);
 const geo=new T.ExtrudeGeometry(s,{depth:.009,bevelEnabled:true,bevelSegments:3,bevelSize:.005,bevelThickness:.005,curveSegments:12});geo.translate(0,0,-.0045);
 const mesh=new T.Mesh(geo,new T.MeshStandardMaterial({color:'#df929d',roughness:.85}));mesh.name='CompanionHeart';return mesh;
}
export function makeEmotionHands(model,handPoint){
 const groups=new Map(),mat=new T.MeshStandardMaterial({color:'#f2cbb4',roughness:.92});let love=null;
 function make(style,side){
  const g=new T.Group();g.name='CompanionHand-'+side+'-'+style;model.add(g);g.add(mitten(style,mat));
  if(style==='point'){const pad=new T.Object3D();pad.name='PointPad';pad.position.set(...MITTEN_TAP_POINT);g.add(pad);}
  return g;
 }
 return {update(pose,look={}){
  mat.color.set(look.skin||'#f2cbb4');for(const g of groups.values())g.visible=false;if(love)love.visible=false;
  for(const side of ['left','right']){
   const style=handStyle(pose,side);if(!style)continue;const key=side+'-'+style;let g=groups.get(key);if(!g){g=make(style,side);groups.set(key,g);}
   g.visible=true;pointToolAt(g,model,handPoint(side),null,.1);g.scale.setScalar(handScaleOf(look));
   if(style==='point'){g.rotation.x=pose.phone?Math.PI:Math.PI/3;g.rotation.z=pose.phone?0:-.45;}
   if(style==='pinch'){g.rotation.x=.2;g.rotation.y=-.25;g.getObjectByName('GesturePalm').morphTargetInfluences[0]=.5+.5*(pose.pinchTap||0);}
  }
  if(pose?.heart){
   if(!love){love=heart();model.add(love);}love.visible=true;
   const left=handPoint('left'),right=handPoint('right');pointToolAt(love,model,left.lerp(right,.5),null,.1);love.position.z+=.036;love.scale.setScalar(pose.heart);
  }
 }};
}
