import {restState} from './rest.mjs?v=fg-da70aec4cf65bb87';
import {ROUTES,SEASONS,WEATHERS} from '../../art/train-carriage/environment.mjs?v=fg-da70aec4cf65bb87';
import {visibleJourney} from '../../art/train-carriage/journey.mjs?v=fg-da70aec4cf65bb87';
import {destinationState} from '../../art/train-carriage/destinations.mjs?v=fg-da70aec4cf65bb87';
import '../fairy-garden/rules.js?v=fg-da70aec4cf65bb87';
const {seasonOf,weather}=globalThis.FairyGardenRules;
export const ROUTE_ORDER=['forest','country','coast'];
export const ROUTE_LENGTH=160;
export const WEATHER_CODES={'晴日':'clear','细雨':'rain','细雪':'snow','薄雾':'fog'};
export function startTrip(garden=null,random=Math.random,previous=null){
 const day=garden?garden.day:1+Math.floor(random()*56),minute=garden?garden.minute:Math.floor(random()*1440);
 return {version:1,map:'carriage',rest:restState({}),day,startDay:day,minute,epoch:garden?.epoch||'train-'+Math.floor(random()*1e12),distance:0,routeStart:Math.floor(random()*3),trips:(previous?.trips||0)+1,photoPromises:previous?.photoPromises||[],photos:previous?.photos||[],companionPhotos:previous?.companionPhotos||[],artworks:previous?.artworks||[],puzzle:previous?.puzzle||null};
}
export function restoreTrip(s){
 if(!s||s.version!==1||s.map!=='carriage'||!Number.isFinite(s.day)||s.day<1||!Number.isFinite(s.minute)||s.minute<0||s.minute>=1440||!Number.isFinite(s.distance)||s.distance<0||!Number.isInteger(s.routeStart)||s.routeStart<0||s.routeStart>2)throw Error('列车进度暂时无法读取，请返回后重试。');
 return {...s,startDay:Number.isFinite(s.startDay)?s.startDay:s.day,rest:restState(s)};
}
// 车上的日历（她 2026-09-25：「一天4分钟吧宝宝！这样一个季节4天刚好」）：
// 列车一天＝现实 4 分钟，四天一季，一年≈64 分钟。从上车那天（startDay）所在的季节接着往下数，
// 天气仍是一天抽一次、按当季比例抽，所以把「车上第几天」折成庭院日历上对应季节里的一天去抽。
export const SEASON_DAYS=4;
export function calendarDay(s){const start=Number.isFinite(s.startDay)?s.startDay:s.day,q=Math.max(0,s.day-start),first=seasonOf(start),firstLen=Math.min(SEASON_DAYS,first.end-start+1);
 // 上车那一季：和庭院同一天、同一个天气，最多再过 4 天或者到庭院那一季结束就换季
 if(q<firstLen)return start+q;
 const r=q-firstLen;return (first.index+1+Math.floor(r/SEASON_DAYS))*14+r%SEASON_DAYS+1;}
export function travelEnvironment(s){
 const segment=Math.floor(s.distance/ROUTE_LENGTH),cd=calendarDay(s),phase=s.distance%ROUTE_LENGTH,index=(s.routeStart+segment)%3;
 return {route:ROUTE_ORDER[index],nextRoute:ROUTE_ORDER[(index+1)%3],routeBlend:Math.max(0,(phase-120)/40),eventDistance:phase,
  season:['spring','summer','autumn','winter'][seasonOf(cd).index%4],weather:WEATHER_CODES[weather(cd,s.epoch)],hour:s.minute/60};
}
export function advanceTrip(s,seconds,speedFactor=1){
 if(!Number.isFinite(seconds)||seconds<=0)return s;
 const elapsed=Math.min(seconds,.1),minutes=s.minute+elapsed*6; // 现实 4 分钟一天
 return {...s,distance:s.distance+elapsed*speedFactor,day:s.day+Math.floor(minutes/1440),minute:minutes%1440};
}

// Snapshot at message send, using the same route/event resolver as the window.
export function travelContext(s){
 const env=travelEnvironment(s),event=visibleJourney(env),destination=destinationState(env.route,event),m=Math.floor(s.minute),hour=env.hour;
 return {day:s.day,time:String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'),
  timeOfDay:hour<5?'深夜':hour<7?'黎明':hour<11?'上午':hour<14?'中午':hour<17?'下午':hour<20?'傍晚':'夜晚',
  season:SEASONS[env.season],weather:WEATHERS[env.weather],scenery:ROUTES[env.route],
  transition:env.routeBlend>0?{from:ROUTES[env.route],to:ROUTES[env.nextRoute],progress:env.routeBlend,description:'窗景正由远到近逐渐过渡'}:null,
  passing:event.label,passProgress:event.id==='open'?null:event.progress,
  tunnel:event.tunnel>0?{darkness:event.tunnel,description:'列车正在穿过隧道，洞外景色被遮挡'}:null,
  sightseeing:destination.reveal>0?{place:destination.label,speedFactor:destination.speedFactor}:null};
}
