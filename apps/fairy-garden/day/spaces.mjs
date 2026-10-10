import {homeSize} from './home-architecture.mjs?v=fg-6a186babf51cdda8';
import {BASE_HOME,homeFurniture,homeRoom,homeAnchors,furniturePoint as localPoint,furnitureSeat,furnitureFootprint} from './home-catalog.mjs?v=fg-6a186babf51cdda8';
import {MAPS,walkable} from '../world.mjs?v=fg-6a186babf51cdda8';
// Layout, navigation and activity anchors share furniture-local coordinates.
// New furniture placements can rebuild this map without changing its renderer.
const piece=(id,kind,x,z,w,d,extra={})=>({id,kind,x,z,w,d,heading:0,...extra});
export const SPACE_STYLES={
  warm:{label:'暖木生活',floor:'#c5aa85',wall:'#e4d2b4',wood:'#a57450',dark:'#594c40',fabric:'#547b6d',accent:'#c57f68',paper:'#f4e8cf',glass:'#c2d5cc'},
  light:{label:'清爽浅色',floor:'#d0d4c9',wall:'#e6ece3',wood:'#a9b5a2',dark:'#57757a',fabric:'#7daab4',accent:'#d3a26e',paper:'#f6f2e1',glass:'#c8e2df'},
  rose:{label:'淡粉柔软',floor:'#ddd3bc',wall:'#eedad4',wood:'#c5a991',dark:'#725d5b',fabric:'#cfa59b',accent:'#b77b81',paper:'#fff1e7',glass:'#d2dcd4'},
  ink:{label:'灰石利落',floor:'#c7c6bb',wall:'#deded8',wood:'#8c8276',dark:'#424749',fabric:'#667d80',accent:'#a89a7d',paper:'#eee9df',glass:'#b4c8cb'},
  dusk:{label:'深木安静',floor:'#a08a73',wall:'#d7cbb9',wood:'#765544',dark:'#403f40',fabric:'#576d79',accent:'#b98277',paper:'#e6d9c3',glass:'#adbfc8'}
};
export const DEFAULT_STYLE='warm';
export const styleOf=id=>SPACE_STYLES[id]||SPACE_STYLES[DEFAULT_STYLE];
const HOME=BASE_HOME;
const WORK=[
 piece('work-desk','table',-2.5,-1.2,2.7,1.15),piece('work-chair','chair',-2.5,.02,.56,.57,{heading:Math.PI}),
 piece('reading-desk','table',2.7,-2.15,2.25,1),piece('reading-chair','chair',2.7,-1,.56,.57,{heading:Math.PI}),
 piece('work-shelf','shelf',-2.6,-4.05,3.8,.65),piece('work-cabinet','cabinet',-4.7,-1.7,.75,2),
 piece('work-sofa','sofa',2.9,2.4,2.5,.9),piece('work-plant','plant',4.7,-3.7,.5,.5)
];
const CAFE=[
 piece('counter','counter',-2.7,-3.35,4.25,1),piece('menu-cabinet','shelf',-2.7,-4.15,3.7,.5),
 piece('cafe-table','table',2.8,-1.3,1.55,1.1),piece('cafe-chair','chair',2.8,-.12,.56,.57,{heading:Math.PI}),
 piece('cafe-partner','chair',2.8,-2.48,.56,.57),piece('window-table','table',-2.4,1.3,1.6,1),
 piece('window-chair','chair',-2.4,2.44,.56,.57,{heading:Math.PI}),piece('cafe-plant','plant',4.5,2.9,.6,.6)
];
const STREET=[
 piece('home-front','facade',-5,-3,4,3.6,{h:3.3}),piece('shop-front','facade',3.9,-3.3,4.8,3,{h:3.6}),
 piece('street-bench','bench',-4,2.3,2.5,.72),piece('tree-one','tree',-6.6,.2,1.2,1.2),
 piece('tree-two','tree',6.5,2.8,1.2,1.2),piece('flower-box','flowers',4.8,.5,1.8,.6),
 piece('street-lamp','lamp',.8,3.7,.3,.3)
];
export const SPACE_DEFS={
 dayHome:{label:'你们的小家',w:14,d:11,pieces:HOME,structure:[{id:'bedroom-partition',x:-.8,z:-3.7,w:.14,d:3.4,h:1.55}],spawn:{x:0,z:4.8},zones:[{id:'bedroom',label:'双人卧室'},{id:'living',label:'起居室'},{id:'kitchen',label:'厨房与餐区'},{id:'free',label:'留给以后布置'}],
  anchors:homeAnchors(HOME,homeRoom({}))},
 dayWork:{label:'工作与学习空间',w:11,d:9,pieces:WORK,spawn:{x:0,z:3.9},anchors:[
  {id:'work',action:'work',piece:'work-desk',approach:{x:1.85,z:.05},heading:-Math.PI/2},
  {id:'read',action:'read',piece:'reading-chair',approach:{x:-.9,z:0},seat:true},
  {id:'rest',action:'rest',piece:'work-sofa',approach:{x:-1.85,z:.25},seat:true}
 ]},
 dayCafe:{label:'街角餐饮小店',w:10,d:9,pieces:CAFE,spawn:{x:0,z:3.9},anchors:[
  {id:'meal',action:'meal',piece:'cafe-chair',approach:{x:-.9,z:0},seat:true},
  {id:'tea',action:'tea',piece:'window-chair',approach:{x:-.9,z:0},seat:true},
  {id:'rest',action:'rest',piece:'window-chair',approach:{x:-.9,z:0},seat:true},
  {id:'read',action:'read',piece:'window-chair',approach:{x:-.9,z:0},seat:true}
 ]},
 dayStreet:{label:'小街与散步处',w:16,d:11,pieces:STREET,outdoor:true,spawn:{x:0,z:4.6},anchors:[
  {id:'walk',action:'walk',target:{x:0,z:0}},
  {id:'rest',action:'rest',piece:'street-bench',approach:{x:1.9,z:.2},seat:true},
 ],wander:[{x:0,z:0},{x:3,z:2.7},{x:-1.2,z:2.8},{x:5.3,z:1.4},{x:-2.8,z:-.6}]}
};
export function buildSpace(id,placements={}){
 const definition=SPACE_DEFS[id],d=id==='dayHome'?{...definition,w:homeSize(homeRoom(placements)).w,d:homeSize(homeRoom(placements)).d,spawn:{x:0,z:homeSize(homeRoom(placements)).d/2-.7}}:definition;if(!d)throw Error('未知日常场景');
 const furniture=(id==='dayHome'?homeFurniture(placements):d.pieces).filter(p=>placements[p.id]?.stored!==true).map(p=>{const q=p.mount?{}:placements[p.id]||{};return {...p,x:Number.isFinite(q.x)?q.x:p.x,z:Number.isFinite(q.z)?q.z:p.z,heading:Number.isFinite(q.heading)?q.heading:p.heading};});
 const pieces=Object.fromEntries(furniture.map(p=>[p.id,p]));
 const walls=d.outdoor?[]:[{id:'back-wall',x:0,z:-d.d/2,w:d.w+.2,d:.18},{id:'left-wall',x:-d.w/2,z:0,w:.18,d:d.d}];
 const structure=d.structure||[],obstacles=[...walls,...structure,...furniture.filter(p=>!p.walkThrough&&!p.mount).map(furnitureFootprint)];
 const room=id==='dayHome'?homeRoom(placements):null;
 const anchors=room?homeAnchors(furniture,room):d.anchors;
 const spots=anchors.filter(a=>!a.piece||pieces[a.piece]).map(a=>{
  const p=pieces[a.piece],target=a.target?{...a.target}:localPoint(p,a.approach);
  const spot={...a,target,heading:(p?.heading||0)+(a.heading||0)};
  if(a.seat)spot.seat=furnitureSeat(p,target,a.offset);
  if(a.bed){spot.sleep={...localPoint(p,{x:.55,z:.65}),y:.94,heading:p.heading};spot.playerSleep={...localPoint(p,{x:-.55,z:.65}),y:.94,heading:p.heading};}
  return spot;
 });
 const map={id,label:d.label,renderer:id,radius:Math.hypot(d.w/2,d.d/2)+.5,bounds:{w:d.w,d:d.d},floor:.08,spawn:{...d.spawn},view:{x:0,z:0},furniture,room,structure,obstacles,spots,
  seats:Object.fromEntries(spots.filter(s=>s.seat).map(s=>[s.id,s.seat])),
  beds:Object.fromEntries(spots.filter(s=>s.sleep).map(s=>[s.id,{approach:{companion:s.target,player:{...s.target}},slots:{companion:s.sleep,player:s.playerSleep}}])),
  wander:d.wander?.map(p=>({...p})),zones:d.zones||[],outdoor:!!d.outdoor};
 if(id==='dayHome'){
  // A new cooking point must not invalidate an older accepted decoration.
  // Use the shared collision check; the layout validator checks routes.
  const previous=MAPS[id];MAPS[id]=map;
  try{map.spots=spots.filter(s=>{if(s.action!=='cook')return true;const p=pieces[s.piece];
   for(const dx of [0,-.30,.30]){const target=localPoint(p,{x:s.approach.x+dx,z:s.approach.z});if(walkable(target.x,target.z,id)){s.target=target;return true;}}
   return false;
  });}finally{if(previous)MAPS[id]=previous;else delete MAPS[id];}
 }
 return map;
}
export const CORE_SPACES=Object.fromEntries(Object.keys(SPACE_DEFS).map(id=>[id,buildSpace(id)]));
export function registerCoreSpaces(maps){Object.assign(maps,CORE_SPACES);}
export function activitySpot(map,action){return map.spots.find(s=>s.action===action)||map.spots.find(s=>s.action==='rest');}
