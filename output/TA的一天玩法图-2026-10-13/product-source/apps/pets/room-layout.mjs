// One layout drives the compressed room, navigation and every interaction anchor.
// Furniture moves as a unit; only the shell, window opening and rug grow.
export const ROOM_LAYOUT_VERSION=2;
const spec=(x,z,zones,bounds=[-3,3.1,-2.6,2.65])=>({scale:{x,z},bounds:{minX:bounds[0]*x,maxX:bounds[1]*x,minZ:bounds[2]*z,maxZ:bounds[3]*z},zones});
export const ROOM_LAYOUTS={
 home:spec(1.42,1.42,{shell:{scale:[1.42,1.42]},window:{scale:[1.42,1.42]},rug:{scale:[1.36,1.36]},sofa:{offset:[.65,-.74]},bed:{offset:[-.8,-.69]},tree:{offset:[-1.05,-.1]},feeding:{offset:[1,.47]},toys:{offset:[-1,.73]},lamp:{offset:[.04,-.82]},picture:{offset:[.61,-1.1424]},shelf:{offset:[-1.3524,0]}},[-2.98,3.05,-2.48,2.55]),
 cafe:spec(1.25,1.22,{shell:{scale:[1.25,1.22]},bar:{offset:[.25,-.55]},window:{offset:[-.805,0]},tables:{offset:[.12,.38]},welcome:{offset:[.72,-.5984]},shelves:{offset:[.1,-.5984]}}),
 bakery:spec(1.25,1.22,{shell:{scale:[1.25,1.22]},counter:{offset:[.3,-.4]},oven:{offset:[-.6,-.55]},perch:{offset:[-.25,-.35]},seating:{offset:[0,.45]},shelves:{offset:[0,-.5984]}}),
 store:spec(1.2,1.2,{shell:{scale:[1.2,1.2]},groceries:{offset:[0,-.544]},checkout:{offset:[.55,0]},fridge:{offset:[-.6,-.5]},delivery:{offset:[-.55,.2]},entrance:{offset:[-.644,.25]}}),
 florist:spec(1.18,1.18,{shell:{scale:[1.18,1.18]},worktable:{offset:[.3,-.3]},plants:{offset:[0,-.4896]},bouquets:{offset:[-.5,-.1]},door:{offset:[-.5796,0]},bench:{offset:[.28,.4]}}),
 alley:spec(1.12,1.12,{shell:{scale:[1.12,1.12]},facades:{offset:[0,-.3264]},clues:{offset:[-.3,-.15]},stall:{offset:[.3,.32]},rest:{offset:[0,.32]}})
};
export const roomBounds=id=>ROOM_LAYOUTS[id]?.bounds||{minX:-3,maxX:3.1,minZ:-2.6,maxZ:2.65};
export function roomPoint(id,zone,p){const t=ROOM_LAYOUTS[id]?.zones[zone];return {...p,x:p.x*(t?.scale?.[0]||1)+(t?.offset?.[0]||0),z:p.z*(t?.scale?.[1]||1)+(t?.offset?.[1]||0)};}
export const homePoint=p=>{const b=roomBounds('home');return p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>b.minX&&p.x<b.maxX&&p.z>b.minZ&&p.z<b.maxZ?{x:p.x,z:p.z}:null;};
export const roomDoor=id=>{const s=ROOM_LAYOUTS[id]?.scale||{x:1,z:1};return {x:(id==='home'?0:id==='alley'?-1.9:-2.65)*s.x,z:2.25*s.z};};
export const HOME_PLACES={box:{x:-1,z:.05,yaw:0},feeding:roomPoint('home','feeding',{x:1.55,z:1.4,yaw:Math.PI/2}),rug:roomPoint('home','rug',{x:0,z:.55,yaw:0}),bed:roomPoint('home','bed',{x:-1.2,z:-.82,yaw:-2.3}),sofa:roomPoint('home','sofa',{x:1.1,z:-.5,yaw:Math.PI}),window:roomPoint('home','window',{x:-.55,z:-1.9,yaw:Math.PI})};
export const PET_STATIONS=[null,{bowl:{x:3.25,z:-.7},rest:{x:-3.2,z:.6},rug:{x:-1.8,z:.4},watch:{x:.6,z:-2.55},color:'#d4b6af'},{bowl:{x:1.35,z:2.9},rest:{x:-.8,z:-2.7},rug:{x:.15,z:-1.2},watch:{x:-1.4,z:-2.5},color:'#bfb4ce'},{bowl:{x:-2.95,z:1.25},rest:{x:2.65,z:.2},rug:{x:1.8,z:1.35},watch:{x:1.65,z:-1.4},color:'#c7b58d'}];
export const petHomePlaces=station=>station?{...HOME_PLACES,feeding:{...station.bowl,yaw:Math.PI/2},box:{...station.rest,yaw:0},bed:{...station.rest,yaw:-2.3},rug:{...station.rug,yaw:0},window:{...station.watch,yaw:Math.PI},sofa:{...station.rest,yaw:Math.PI}}:HOME_PLACES;
export function chorePlaces(index=0){const p=petHomePlaces(PET_STATIONS[index]),base={x:-2.6+(index%2)*1.15,z:2.05+Math.floor(index/2)};return {bowl:{...p.feeding},water:{x:p.feeding.x+(index===2?.32:-.32),z:p.feeding.z},toys:{ball:{x:base.x-.065,z:base.z},mouse:{x:base.x+.065,z:base.z}},tray:base,bedding:{bed:index?{...p.bed}:roomPoint('home','bed',{x:-1.4,z:-1.4}),sofa:index?{...p.sofa}:roomPoint('home','sofa',{x:1.1,z:-1.3}),box:{...p.box}}};}
export const HOME_DETAILS={plantStand:{x:-2.6,z:-.35},bed:roomPoint('home','bed',{x:-1.89,z:-1.64}),bread:roomPoint('home','feeding',{x:2.42,z:.28}),flowers:roomPoint('home','lamp',{x:-.16,z:-2.02}),memory:roomPoint('home','shelf',{x:-3.02,z:-.57}),courier:{x:0,z:roomDoor('home').z-.12},doorFace:{x:0,z:roomBounds('home').maxZ}};
const models=new WeakSet();
export function applyRoomLayout(model,id){if(!model||models.has(model)||!ROOM_LAYOUTS[id])return model;models.add(model);model.traverse(o=>{const t=ROOM_LAYOUTS[id].zones[o.userData?.zone];if(!t)return;if(t.scale){o.scale.x*=t.scale[0];o.scale.z*=t.scale[1];}if(t.offset){o.position.x+=t.offset[0];o.position.z+=t.offset[1];}});model.updateMatrixWorld(true);return model;}
// These are the previous layout's persisted anchors, used only for upgrading old
// in-flight tasks. Current anchors above remain the only live layout.
const LEGACY_HOME={feeding:{x:1.55,z:1.4},bed:{x:-1.2,z:-.82},sofa:{x:1.1,z:-.5},window:{x:-.55,z:-1.9}};
const LEGACY_STATIONS=[null,{bowl:{x:.65,z:2.08},rest:{x:1.05,z:.48},watch:{x:1.5,z:.05}},{bowl:{x:-1.55,z:2.05},rest:{x:-1.3,z:.05},watch:{x:-1.4,z:-.25}},{bowl:{x:.55,z:-.62},rest:{x:.05,z:-.75},watch:{x:.15,z:-.65}}];
export function upgradeRoomLayout(raw){
 if(!raw||raw.roomLayoutVersion>=ROOM_LAYOUT_VERSION)return raw;
 const r=structuredClone(raw),rows=r.pets?.length?r.pets:[r];
 const shift=(p,d)=>{if(p&&Number.isFinite(p.x)&&Number.isFinite(p.z)){p.x+=d.x;p.z+=d.z;}};
 const windowDelta={x:HOME_PLACES.window.x-LEGACY_HOME.window.x,z:HOME_PLACES.window.z-LEGACY_HOME.window.z};
 for(const [i,p]of rows.entries()){
  const c=p.care,t=c?.task;if(!c||!t)continue;
  const key=t.place==='water'?'feeding':t.place,places=petHomePlaces(PET_STATIONS[i]);
  if(t.socialId&&r.social?.pending?.kind==='window'){
   shift(t.spot,windowDelta);shift(t.focus,windowDelta);
   if(t.phase==='doing'){shift(c.position,windowDelta);if(p.town?.place==='home')p.town.position={...c.position};}
  }else if(Object.hasOwn(LEGACY_HOME,key)){
   const station=LEGACY_STATIONS[i],before=station?(key==='feeding'?station.bowl:key==='window'?station.watch:station.rest):LEGACY_HOME[key];
   const d={x:places[key].x-before.x,z:places[key].z-before.z};
   if(t.phase==='doing'){shift(c.position,d);if(p.town?.place==='home')p.town.position={...c.position};}
   shift(t.spot,d);shift(t.focus,d);
  }
 }
 if(r.social?.pending?.kind==='window')shift(r.social.pending.rendezvous,windowDelta);
 const resident=r.resident,activity=resident?.activity;
 if(activity&&['plants','window'].includes(activity.kind)){
  const zone=activity.kind==='plants'?'shelf':'window',goal=activity.goal&&(activity.kind==='plants'?{...HOME_DETAILS.plantStand}:roomPoint('home',zone,activity.goal));
  if(goal&&activity.phase==='doing'){const d={x:goal.x-activity.goal.x,z:goal.z-activity.goal.z};shift(resident.position,d);if(resident.town?.place==='home')shift(resident.town.position,d);}
  if(goal)activity.goal=goal;if(activity.face)activity.face=roomPoint('home',zone,activity.face);
 }
 const task=r.household?.task;
 if(task&&homePoint(task.focus)&&homePoint(task.target)){
  const i=rows.findIndex(p=>p.id===task.petId),p=chorePlaces(Math.max(0,i));
  if(task.kind==='toys'){
   const target=p.toys[task.toy];if(target){const d={x:target.x-task.target.x,z:target.z-task.target.z};task.target={...target};if(task.picked){shift(task.goal,d);if(task.phase==='doing')shift(task.position,d);}}
  }else{
   const focus=task.kind==='bedding'?p.bedding[task.place]:p[task.kind];
   if(focus){const d={x:focus.x-task.focus.x,z:focus.z-task.focus.z};task.focus={...focus};task.target={...focus};shift(task.goal,d);if(task.phase==='doing')shift(task.position,d);}
  }
 }
 r.roomLayoutVersion=ROOM_LAYOUT_VERSION;return r;
}
