import {BASIN_USE} from './bathroom-layout.mjs?v=fg-bf2a8f69e3079bf5';
import {findPath,walkable} from '../world.mjs?v=fg-bf2a8f69e3079bf5';
import {furniturePoint} from './home-catalog.mjs?v=fg-bf2a8f69e3079bf5';

import './social.js?v=fg-bf2a8f69e3079bf5';
export const CHORES=globalThis.CharDaySocial.chores;
export function choreIntent(slot){
 const text=String(slot?.deviation?.actual||slot?.title||'');
 if(/洗澡|淋浴|沐浴|冲澡/.test(text))return 'shower';
 if(/洗手/.test(text))return 'wash-hands';
 if(/上厕所|如厕|用厕所/.test(text))return 'toilet';
 if(/整理床铺|铺床|叠被|收拾床/.test(text))return 'tidy-bed';
 if(/浇花|浇水|照料植物/.test(text))return 'water-plant';
 if(/擦桌|清洁桌|擦拭桌/.test(text))return 'wipe-table';
 if(/洗碗|洗盘|清洗餐具/.test(text))return 'wash-dishes';
 return null;
}
const id=m=>m.id||m.renderer;
export function chorePlans(map,kind,from,other,preferred=null){
 const chore=CHORES[kind];if(!chore||id(map)!=='dayHome')return [];
 return map.furniture.filter(p=>p.kind===chore.kind&&!p.stored&&(!preferred||p.id===preferred)).flatMap(piece=>{
  const locals=chore.personal?[kind==='shower'?{x:0,z:.08}:{x:0,z:piece.d/2+(kind==='wash-hands'?BASIN_USE.approach:.35)}]:kind==='tidy-bed'?[{x:piece.w/2+.20,z:.7},{x:-piece.w/2-.20,z:.7}]:kind==='wash-dishes'?[{x:-.62,z:piece.d/2+.18}]:[{x:0,z:piece.d/2+.20},{x:piece.w/2+.20,z:0},{x:-piece.w/2-.20,z:0}];
  return locals.map(local=>{
   const at=furniturePoint(piece,local),distance=other?Math.hypot(from.x-other.x,from.z-other.z):1;
   if(!walkable(at.x,at.z,id(map))||other&&Math.hypot(at.x-other.x,at.z-other.z)<.9)return null;
   const route=findPath(from,at,id(map),other?[{...other,r:Math.min(.86,distance*.85)}]:[]);if(!route)return null;
   const surface=chore.personal?{x:0,z:kind==='wash-hands'?BASIN_USE.z:.08,y:kind==='wash-hands'?BASIN_USE.y:1.4}:kind==='tidy-bed'?{x:Math.sign(local.x)*(piece.w/2-.20),z:.65,y:.73}:kind==='wash-dishes'?{x:-.8,z:.16,y:1.06}:kind==='water-plant'?{x:0,z:0,y:.43}:{x:Math.sign(local.x)*(piece.w/2-.12),z:local.z?piece.d/2-.12:0,y:(piece.top||.85)+.09};
   const target={...furniturePoint(piece,surface),y:surface.y};
   return {piece:piece.id,kind,at,route,target,...(chore.personal?{personal:true,fixture:{x:piece.x,z:piece.z,heading:piece.heading,w:piece.w,d:piece.d},seat:{...furniturePoint(piece,{x:0,z:.39}),piece:piece.id}}:{}),heading:chore.personal?kind!=='wash-hands'?(piece.heading||0):(piece.heading||0)+Math.PI:kind==='wash-dishes'?(piece.heading||0)+Math.PI:Math.atan2(target.x-at.x,target.z-at.z),duration:chore.duration,cost:route.reduce((n,p,i)=>n+Math.hypot(p.x-(i?route[i-1]:from).x,p.z-(i?route[i-1]:from).z),0)};
  }).filter(Boolean);
 }).sort((a,b)=>Number(b.piece===map.room?.uses?.[kind])-Number(a.piece===map.room?.uses?.[kind])||a.cost-b.cost);
}

// Feed the main animation once per frame; a second animate call resets seat blending.
export function chorePose(plan,elapsed,moving,position){
 if(!plan?.personal||moving||elapsed>=plan.duration||Math.hypot(position.x-plan.at.x,position.z-plan.at.z)>.22)return {};
 return plan.kind==='toilet'?{seated:true,seatPose:'chair',height:.08+.48+.05}:{};
}
