import '../fairy-garden/rules.js?v=fg-0f354cf95dbf3953';
const {seasonOf,weather}=globalThis.FairyGardenRules;
export const ROUTE_ORDER=['forest','country','coast'];
export const ROUTE_LENGTH=160;
export const WEATHER_CODES={'晴日':'clear','细雨':'rain','细雪':'snow','薄雾':'fog'};
export function startTrip(garden=null,random=Math.random,previous=null){
 const day=garden?garden.day:1+Math.floor(random()*56),minute=garden?garden.minute:Math.floor(random()*1440);
 return {version:1,map:'carriage',day,minute,epoch:garden?.epoch||'train-'+Math.floor(random()*1e12),distance:0,routeStart:Math.floor(random()*3),trips:(previous?.trips||0)+1,photos:previous?.photos||[],puzzle:previous?.puzzle||null};
}
export function restoreTrip(s){
 if(!s||s.version!==1||s.map!=='carriage'||!Number.isFinite(s.day)||s.day<1||!Number.isFinite(s.minute)||s.minute<0||s.minute>=1440||!Number.isFinite(s.distance)||s.distance<0||!Number.isInteger(s.routeStart)||s.routeStart<0||s.routeStart>2)throw Error('列车进度暂时无法读取，请返回后重试。');
 return {...s};
}
export function travelEnvironment(s){
 const segment=Math.floor(s.distance/ROUTE_LENGTH),phase=s.distance%ROUTE_LENGTH,index=(s.routeStart+segment)%3;
 return {route:ROUTE_ORDER[index],nextRoute:ROUTE_ORDER[(index+1)%3],routeBlend:Math.max(0,(phase-120)/40),eventDistance:phase,
  season:['spring','summer','autumn','winter'][seasonOf(s.day).index%4],weather:WEATHER_CODES[weather(s.day,s.epoch)],hour:s.minute/60};
}
export function advanceTrip(s,seconds,speedFactor=1){
 if(!Number.isFinite(seconds)||seconds<=0)return s;
 const elapsed=Math.min(seconds,.1),minutes=s.minute+elapsed*2; // twelve real minutes per train day
 return {...s,distance:s.distance+elapsed*speedFactor,day:s.day+Math.floor(minutes/1440),minute:minutes%1440};
}
