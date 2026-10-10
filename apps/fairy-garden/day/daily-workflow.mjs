import {HOME_COOK} from './home-catalog.mjs?v=fg-5ee68d467e4124cc';

export const DAILY_MOTIONS={read:'read',tea:'drink',meal:'eat',cook:'cook'};
export const DAILY_LABELS={read:'翻书阅读',tea:'喝口水',meal:'用餐',cook:'锅边料理'};
// A missing/stored kitchen or seat has no physical action. This is a projection,
// not another schedule: the original currentSlot still owns the activity.
export function dailyTaskAt(stage,spot,map,elapsed,{moving=false}={}){
 if(moving||!['dayHome','dayCafe','dayWork'].includes(map.id))return null;
 spot=spot||map.spots.find(s=>s.action===stage.action);
 const kind=DAILY_MOTIONS[stage.action];
 if(!kind||!spot||spot.action!==stage.action||(['eat','drink'].includes(kind)&&!spot.seat))return null;
 const task={kind,daily:true,elapsed:Math.max(0,elapsed),progress:Math.max(0,elapsed)/(kind==='read'?9:kind==='drink'?8:kind==='eat'?5.5:7)%1,furniture:spot.piece||null};
 if(kind==='cook'){
  const p=map.furniture.find(p=>p.id===spot.piece);if(p?.kind!=='kitchen')return null;
  const h=p.heading||0,c=Math.cos(h),s=Math.sin(h),point=y=>({x:p.x+HOME_COOK.x*c+HOME_COOK.z*s,y,z:p.z-HOME_COOK.x*s+HOME_COOK.z*c});
  task.target=point(HOME_COOK.gripY);task.contact=point(HOME_COOK.contactY);task.pot=point(HOME_COOK.y);
 }
 return task;
}
