import {buildSpace} from './spaces.mjs?v=fg-e0724bc3c49727cf';
import {MAPS,walkable,findPath} from '../world.mjs?v=fg-e0724bc3c49727cf';

import {HOME_CATALOG,HOME_NAMES,HOME_LIMIT,homeRoom,homePlacements,homeFurniture,usesFor,furnitureFootprint} from './home-catalog.mjs?v=fg-e0724bc3c49727cf';
import {homeSize,wallSpan,wallTop,furnitureHeight,HOME_WINDOW} from './home-architecture.mjs?v=fg-e0724bc3c49727cf';
export {HOME_NAMES,homePlacements,homeFurniture};
const overlaps=(a,b,gap=.035)=>Math.abs(a.x-b.x)<(a.w+b.w)/2+gap-1e-6&&Math.abs(a.z-b.z)<(a.d+b.d)/2+gap-1e-6;
export function checkHomeLayout(raw,{routes=true}={}){
 const placements=homePlacements(raw),map=buildSpace('dayHome',placements),names=Object.fromEntries(homeFurniture(placements).map(p=>[p.id,p.label])),f=map.obstacles.filter(o=>names[o.id]);
 const mounted=map.furniture.filter(p=>p.mount),wallRect=p=>({x:p.along,z:p.y,w:p.w,d:p.height});
 for(const p of mounted){
  const a=wallRect(p),ends=[p.along-p.w/2,p.along+p.w/2];
  if(Math.abs(p.along)+p.w/2>wallSpan(p.wall,map.room)||p.y-p.height/2<.55||ends.some(v=>p.y+p.height/2>wallTop(p.wall,v)-.1))return {ok:false,reason:names[p.id]+'超出这面墙了，挪低一点或换面墙。'};
  if(p.wall==='back'){
   const window={x:HOME_WINDOW.x,z:HOME_WINDOW.base+HOME_WINDOW.h/2,w:HOME_WINDOW.w+.65,d:HOME_WINDOW.h+.5};
   if(overlaps(a,window,0))return {ok:false,reason:'这里是窗户与窗帘，换个地方挂吧。'};
   if(map.room.originalWallDecor&&[{x:-4.15,z:2.75,w:3.3,d:1.05},{x:6.15,z:3.07,w:.75,d:.75}].some(q=>overlaps(a,q)))return {ok:false,reason:'这里已有原来的墙饰，可以先在房间设置里收起。'};
  }
  if(mounted.some(q=>q!==p&&q.wall===p.wall&&overlaps(a,wallRect(q))))return {ok:false,reason:'两件墙饰挤在一起了，分开一点吧。'};
  const footprint=furnitureFootprint(p);
  if(map.furniture.some(q=>!q.mount&&!q.walkThrough&&overlaps(footprint,furnitureFootprint(q))&&p.y-p.height/2<furnitureHeight(q)+.06))return {ok:false,reason:'这件墙饰碰到下面的家具了，挂高一点或换个地方。'};
 }
 // Rugs share the room/wall bounds but can lie under furniture and paths.
 const rugs=map.furniture.filter(p=>p.walkThrough).map(furnitureFootprint);
 for(const a of rugs){
  if(Math.abs(a.x)+a.w/2>map.bounds.w/2-.2||Math.abs(a.z)+a.d/2>map.bounds.d/2-.2)return {ok:false,reason:names[a.id]+'超出房间了，往里挪一点。'};
  if(map.structure.some(b=>overlaps(a,b,0)))return {ok:false,reason:'这里碰到隔墙了，换个位置吧。'};
  if(rugs.some(b=>b!==a&&overlaps(a,b,0)))return {ok:false,reason:'两张地毯叠在一起了，分开铺会更清楚。'};
 }
 for(const a of f){
  if(Math.abs(a.x)+a.w/2>map.bounds.w/2-.2||Math.abs(a.z)+a.d/2>map.bounds.d/2-.2)return {ok:false,reason:names[a.id]+'超出房间了，往里挪一点。'};
  if(overlaps(a,{...map.spawn,w:1.4,d:1}))return {ok:false,reason:'门口要留出通道，换个位置吧。'};
  for(const b of map.structure)if(overlaps(a,b))return {ok:false,reason:'这里碰到隔墙了，换个位置吧。'};
  for(const b of f)if(b!==a&&overlaps(a,b))return {ok:false,reason:names[a.id]+'挤到'+names[b.id]+'了，留一点距离。'};
 }
 if(routes){
  // Synchronous validation borrows the real world's collision/path functions.
  // Map identity invalidates the common navigator grid after any placement change.
  const previous=MAPS.dayHome;MAPS.dayHome=map;
  try{
   const unavailableCooking=new Set();
   for(const s of map.spots){if(!walkable(s.target.x,s.target.z,'dayHome')||!findPath(map.spawn,s.target,'dayHome')?.length){if(s.action==='cook'){unavailableCooking.add(s.id);continue;}return {ok:false,reason:names[s.piece]+'旁边走不过去，给TA留条路。'};}}
   map.spots=map.spots.filter(s=>!unavailableCooking.has(s.id));
   for(const a of f){const points=[{x:a.x+a.w/2+.4,z:a.z},{x:a.x-a.w/2-.4,z:a.z},{x:a.x,z:a.z+a.d/2+.4},{x:a.x,z:a.z-a.d/2-.4}];if(!points.some(p=>walkable(p.x,p.z,'dayHome')&&findPath(map.spawn,p,'dayHome')?.length))return {ok:false,reason:names[a.id]+'周围走不过去，留一点通道。'};}
  }finally{if(previous)MAPS.dayHome=previous;else delete MAPS.dayHome;}
 }
 return {ok:true,placements,map};
}
export function restoreHomeLayout(raw){
 const result=checkHomeLayout(raw);if(result.ok)return result.placements;
 const safe=homePlacements(raw);for(const id of Object.keys(safe))if(/^furniture-/.test(id))safe[id].stored=true;
 const rescued=checkHomeLayout(safe);if(rescued.ok)return rescued.placements;
 const defaults=homePlacements();defaults.$room=safe.$room;for(const id of Object.keys(safe))if(/^furniture-/.test(id))defaults[id]=safe[id];return defaults;
}
export function changeHomeFurniture(raw,id,change){
 const placements=homePlacements(raw);if(!Object.hasOwn(placements,id))return {ok:false,reason:'先选一件家具。'};
 const p=placements[id];
 if(change==='rotate'){if(HOME_CATALOG.find(q=>q.id===p.catalogId)?.mount)p.wall=p.wall==='left'?'back':'left';else p.heading+=Math.PI/2;}
 else if(change==='store')p.stored=true;
 else if(change==='restore'){
  p.stored=false;const at=checkHomeLayout(placements);if(at.ok)return at;
  // Try the retained position first, then search the actual room for a free spot.
  const piece=HOME_CATALOG.find(q=>q.id===p.catalogId),size=homeSize(placements.$room);
  if(piece.mount){
   for(const wall of [p.wall,p.wall==='left'?'back':'left'])for(let y=2.7;y>=1.1;y-=.2)for(let along=wallSpan(wall,placements.$room)-piece.w/2;along>=-wallSpan(wall,placements.$room)+piece.w/2;along-=.4){Object.assign(p,{wall,along,y:Math.round(y*10)/10});const test=checkHomeLayout(placements,{routes:false});if(test.ok)return checkHomeLayout(placements);}
  }else for(let z=size.d/2-1;z>=-size.d/2+1;z-=.5)for(let x=size.w/2-1.5;x>=-size.w/2+1.5;x-=.5){p.x=x;p.z=z;const test=checkHomeLayout(placements,{routes:false});if(test.ok){const reachable=checkHomeLayout(placements);if(reachable.ok)return reachable;}}
  return {ok:false,reason:'现在没有够大的空位，先挪开一点家具再摆回。'};
 }else if(change&&typeof change==='object'){for(const k of ['x','z','heading','along','y'])if(Number.isFinite(change[k]))p[k]=change[k];if(Object.hasOwn(change,'wall'))p.wall=change.wall;if(Object.hasOwn(change,'color'))p.color=change.color;if(Object.hasOwn(change,'material'))p.material=change.material;}
 else if(change==='use'){const piece=homeFurniture(placements).find(p=>p.id===id);if(p.stored)return {ok:false,reason:'先把这件家具摆回小家。'};for(const action of usesFor(piece))placements.$room.uses[action]=id;}
 else return {ok:false,reason:'这个操作暂时不能用。'};
 return checkHomeLayout(placements);
}

export function addHomeFurniture(raw,catalogId){
 const placements=homePlacements(raw),p=HOME_CATALOG.find(p=>p.id===catalogId);
 if(!p)return {ok:false,reason:'这件家具暂时不能用。'};
 if(homeFurniture(placements).length>=HOME_LIMIT)return {ok:false,reason:'家具库已经有'+HOME_LIMIT+'件了，先用现有的家具布置吧。'};
 const n=Math.max(0,...Object.keys(placements).filter(id=>/^furniture-/.test(id)).map(id=>Number(id.slice(10))))+1,id='furniture-'+n;
 placements[id]={catalogId:p.id,x:5,z:2.5,heading:0,stored:true,color:'',material:'auto',...(p.mount?{wall:'back',along:-1.7,y:2.4}:{})};
 const result=changeHomeFurniture(placements,id,'restore');
 // A full room still accepts the item into storage for later placement.
 return result.ok?{...result,selected:id}: {...checkHomeLayout(placements),selected:id,notice:'已添到收纳，腾出空位后再摆回。'};
}
export function changeHomeRoom(raw,change){
 const placements=homePlacements(raw),room=placements.$room;
 for(const key of ['size','originalRugs','originalWallDecor','wall','floor','wallColor','floorColor'])if(Object.hasOwn(change||{},key))room[key]=change[key];
 placements.$room=homeRoom(placements);return checkHomeLayout(placements);
}
