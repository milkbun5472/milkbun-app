import {HOME_COOK,furniturePoint} from './home-catalog.mjs?v=fg-c27bf8a6a71ea07b';
import {motionClock} from './motion-profile.mjs?v=fg-c27bf8a6a71ea07b';

export const DAILY_MOTIONS={read:'read',tea:'drink',meal:'eat',cook:'cook'};
export const DAILY_LABELS={read:'翻书阅读',tea:'喝口水',meal:'用餐',cook:'锅边料理'};
// A missing/stored kitchen or seat has no physical action. This is a projection,
// not another schedule: the original currentSlot still owns the activity.
export function dailyTaskAt(stage,spot,map,elapsed,{moving=false,motion=null}={}){
 if(moving||!['dayHome','dayCafe','dayWork'].includes(map.id))return null;
 spot=spot||map.spots.find(s=>s.action===stage.action);
 const kind=DAILY_MOTIONS[stage.action];
 if(!kind||!spot||spot.action!==stage.action||(['eat','drink'].includes(kind)&&!spot.seat))return null;
 const clock=motionClock(elapsed,motion),task={kind,daily:true,elapsed:Math.max(0,clock),progress:Math.max(0,clock)/(kind==='read'?9:kind==='drink'?8:kind==='eat'?5.5:7)%1,furniture:spot.piece||null};
 if(kind==='cook'){
  const p=map.furniture.find(p=>p.id===spot.piece);if(p?.kind!=='kitchen')return null;
  const point=y=>({...furniturePoint(p,HOME_COOK),y});
  task.target=point(HOME_COOK.gripY);task.contact=point(HOME_COOK.contactY);task.pot=point(HOME_COOK.y);
 }
 return task;
}
