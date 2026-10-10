import {SPACE_DEFS,buildSpace} from './spaces.mjs?v=fg-aa215f3b04f25467';
import {MAPS,walkable,findPath} from '../world.mjs?v=fg-aa215f3b04f25467';

// The editor and schedule viewer consume the same placement record and map.
export const HOME_NAMES={'double-bed':'双人床',wardrobe:'衣柜',bedside:'床头柜',sofa:'沙发','coffee-table':'茶几','dining-table':'餐桌','dining-chair':'餐椅','partner-chair':'另一把餐椅',kitchen:'厨房台面',pantry:'储物柜','home-plant':'盆栽',bookcase:'书柜'};
const defs=SPACE_DEFS.dayHome.pieces;
export function homePlacements(raw={}){
 return Object.fromEntries(defs.map(p=>{const q=raw?.[p.id]||{};return [p.id,{x:Number.isFinite(q.x)?q.x:p.x,z:Number.isFinite(q.z)?q.z:p.z,heading:Number.isFinite(q.heading)?((Math.round(q.heading/(Math.PI/2))%4+4)%4)*Math.PI/2:p.heading,stored:q.stored===true}];}));
}
export function homeFurniture(raw){const placements=homePlacements(raw);return defs.map(p=>({...p,...placements[p.id],label:HOME_NAMES[p.id]}));}
const overlaps=(a,b,gap=.035)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap-1e-6&&Math.abs(a.z-b.z)<(a.d+b.d)/2+gap-1e-6;
export function checkHomeLayout(raw,{routes=true}={}){
 const placements=homePlacements(raw),map=buildSpace('dayHome',placements),f=map.obstacles.filter(o=>HOME_NAMES[o.id]);
 for(const a of f){
  if(Math.abs(a.x)+a.w/2>map.bounds.w/2-.2||Math.abs(a.z)+a.d/2>map.bounds.d/2-.2)return {ok:false,reason:HOME_NAMES[a.id]+'超出房间了，往里挪一点。'};
  if(overlaps(a,{...map.spawn,w:1.4,d:1}))return {ok:false,reason:'门口要留出通道，换个位置吧。'};
  for(const b of map.structure)if(overlaps(a,b))return {ok:false,reason:'这里碰到隔墙了，换个位置吧。'};
  for(const b of f)if(b!==a&&overlaps(a,b))return {ok:false,reason:HOME_NAMES[a.id]+'挤到'+HOME_NAMES[b.id]+'了，留一点距离。'};
 }
 if(routes){
  // Synchronous validation borrows the real world's collision/path functions.
  // Map identity invalidates the common navigator grid after any placement change.
  const previous=MAPS.dayHome;MAPS.dayHome=map;
  try{
   for(const s of map.spots){if(!walkable(s.target.x,s.target.z,'dayHome')||!findPath(map.spawn,s.target,'dayHome')?.length)return {ok:false,reason:HOME_NAMES[s.piece]+'旁边走不过去，给TA留条路。'};}
   for(const a of f){const points=[{x:a.x+a.w/2+.4,z:a.z},{x:a.x-a.w/2-.4,z:a.z},{x:a.x,z:a.z+a.d/2+.4},{x:a.x,z:a.z-a.d/2-.4}];if(!points.some(p=>walkable(p.x,p.z,'dayHome')&&findPath(map.spawn,p,'dayHome')?.length))return {ok:false,reason:HOME_NAMES[a.id]+'周围走不过去，留一点通道。'};}
  }finally{if(previous)MAPS.dayHome=previous;else delete MAPS.dayHome;}
 }
 return {ok:true,placements,map};
}
export function restoreHomeLayout(raw){const result=checkHomeLayout(raw);return result.ok?result.placements:homePlacements();}
export function changeHomeFurniture(raw,id,change){
 const placements=homePlacements(raw);if(!Object.hasOwn(placements,id))return {ok:false,reason:'先选一件家具。'};
 const p=placements[id];
 if(change==='rotate')p.heading+=Math.PI/2;
 else if(change==='store')p.stored=true;
 else if(change==='restore'){
  p.stored=false;const at=checkHomeLayout(placements);if(at.ok)return at;
  // Try the retained position first, then search the actual room for a free spot.
  for(let z=4.5;z>=-4.5;z-=.5)for(let x=5.5;x>=-5.5;x-=.5){p.x=x;p.z=z;const test=checkHomeLayout(placements);if(test.ok)return test;}
  return {ok:false,reason:'现在没有够大的空位，先挪开一点家具再摆回。'};
 }else if(change&&typeof change==='object'){p.x=change.x;p.z=change.z;if(Number.isFinite(change.heading))p.heading=change.heading;}
 return checkHomeLayout(placements);
}
