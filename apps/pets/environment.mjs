import {weatherLook} from '../fairy-garden/weather-look.mjs?v=fg-633977aef81920f3';
import {SEASONS,seasonOf,calendarSeason} from '../fairy-garden/world.mjs?v=fg-633977aef81920f3';
const clamp=x=>Math.max(0,Math.min(1,x));
// Local-clock environments share one visual weather draw and daylight calculation.
export function townEnvironment(time,epoch,{seasonIndex=time.season,weatherWeights=null,weatherEpoch=epoch,dawnStart=330}={}){
 const minute=time.minute,season=SEASONS[seasonIndex]||seasonOf(time.day),day=time.calendarDay||time.day,dusk=season.dusk;
 const light=Math.min(clamp((minute-dawnStart)/90),clamp((dusk+90-minute)/90));
 const sunset=clamp(1-Math.abs(minute-dusk)/70),dawn=clamp(1-Math.abs(minute-(dawnStart+45))/60);
 const look=weatherLook({day,seasonIndex,minute:minute<dawnStart+90?1440:minute,epoch:weatherEpoch,weatherWeights});
 return {...look,day,date:time.date,minute,epoch,seasonName:season.name,light,warmth:Math.max(sunset,dawn)*light,
  phase:minute<dawnStart||minute>=dusk+90?'夜晚':minute<dawnStart+90?'清晨':minute>=dusk-60?'傍晚':'白天',
  time:String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0')};
}
// Calendar scenes reuse the same draw, palettes and daylight. No persisted roll.
export const CALENDAR_WEATHER=Object.freeze([
 Object.freeze({'晴日':40,'阴天':20,'细雨':25,'薄雾':5,'大风':10}),
 Object.freeze({'晴日':50,'阴天':15,'细雨':25,'薄雾':5,'大风':5}),
 Object.freeze({'晴日':35,'阴天':25,'细雨':20,'薄雾':5,'大风':15}),
 Object.freeze({'晴日':20,'阴天':20,'细雪':45,'大风':15})
]);
export function calendarEnvironment(time,epoch){
 const seasonIndex=calendarSeason(Number(String(time.date).split('-')[1]))??3,slot=Math.floor(time.minute/180);
 const env=townEnvironment(time,epoch,{seasonIndex,weatherWeights:CALENDAR_WEATHER[seasonIndex],weatherEpoch:String(epoch)+':calendar:'+slot,dawnStart:[330,270,360,420][seasonIndex]});
 return {...env,night:env.light<.15,source:'real-calendar',weatherSlot:time.date+':'+slot};
}
export function townSeasonRole(material){const name=material.name||'';return /叶片|嫩叶/.test(name)?'leaf':/街区柔绿|奶油石路|地台侧面/.test(name)?'ground':/屋顶/.test(name)?'roof':name==='水面'?'water':null;}
export function townRainSurface(world,s,x,z){return s.map==='outside'&&world.walkable(x,z)?{y:world.ground(x,z)+.015,water:false}:null;}
