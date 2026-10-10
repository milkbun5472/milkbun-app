import {findPath,walkable} from '../world.mjs?v=fg-e4b373131c1a533d';
import {furniturePoint} from './home-catalog.mjs?v=fg-e4b373131c1a533d';

import './social.js?v=fg-e4b373131c1a533d';
export const CHORES=globalThis.CharDaySocial.chores;
export function choreIntent(slot){
 const text=String(slot?.deviation?.actual||slot?.title||'');
 if(/整理床铺|铺床|叠被|收拾床/.test(text))return 'tidy-bed';
 if(/浇花|浇水|照料植物/.test(text))return 'water-plant';
 if(/擦桌|清洁桌|擦拭桌/.test(text))return 'wipe-table';
 if(/洗碗|洗盘|清洗餐具/.test(text))return 'wash-dishes';
 return null;
}
const id=m=>m.id||m.renderer;
export function chorePlans(map,kind,from,other){
 const chore=CHORES[kind];if(!chore||id(map)!=='dayHome')return [];
 return map.furniture.filter(p=>p.kind===chore.kind&&!p.stored).flatMap(piece=>{
  const locals=kind==='tidy-bed'?[{x:piece.w/2+.20,z:.7},{x:-piece.w/2-.20,z:.7}]:kind==='wash-dishes'?[{x:-.62,z:piece.d/2+.18}]:[{x:0,z:piece.d/2+.20},{x:piece.w/2+.20,z:0},{x:-piece.w/2-.20,z:0}];
  return locals.map(local=>{
   const at=furniturePoint(piece,local),distance=other?Math.hypot(from.x-other.x,from.z-other.z):1;
   if(!walkable(at.x,at.z,id(map))||other&&Math.hypot(at.x-other.x,at.z-other.z)<.9)return null;
   const route=findPath(from,at,id(map),other?[{...other,r:Math.min(.86,distance*.85)}]:[]);if(!route)return null;
   const surface=kind==='tidy-bed'?{x:Math.sign(local.x)*(piece.w/2-.20),z:.65,y:.73}:kind==='wash-dishes'?{x:-.8,z:.16,y:1.06}:kind==='water-plant'?{x:0,z:0,y:.43}:{x:Math.sign(local.x)*(piece.w/2-.12),z:local.z?piece.d/2-.12:0,y:(piece.top||.85)+.09};
   const target={...furniturePoint(piece,surface),y:surface.y};
   return {piece:piece.id,kind,at,route,target,heading:kind==='wash-dishes'?(piece.heading||0)+Math.PI:Math.atan2(target.x-at.x,target.z-at.z),duration:chore.duration,cost:route.reduce((n,p,i)=>n+Math.hypot(p.x-(i?route[i-1]:from).x,p.z-(i?route[i-1]:from).z),0)};
  }).filter(Boolean);
 }).sort((a,b)=>a.cost-b.cost);
}
