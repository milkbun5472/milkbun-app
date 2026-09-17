// Processing is measured by the same game calendar as sleeping and ordinary play.
// No wall clock, model call, or second inventory lives here.
export const gameMinute=s=>(s.day-1)*1440+s.minute;
export const MATERIAL_NAMES={herbs:'铃叶草',mushrooms:'荧光菇',water:'清水',potions:'月露',sand:'星砂'};
export const MILL_RECIPES={
 powder:{name:'荧光研粉',furniture:'millstone',site:'grinding',minutes:120,input:{mushrooms:2},output:{sand:3}},
 dew:{name:'月露蒸馏',furniture:'distiller',site:'distilling',minutes:180,input:{herbs:3,mushrooms:1,water:1},output:{potions:2}}
};
export const materialLine=items=>Object.entries(items).map(([k,n])=>`${MATERIAL_NAMES[k]} ×${n}`).join('、');
export function restoreWorkshop(raw){const jobs={};for(const key of Object.keys(MILL_RECIPES)){const j=raw?.jobs?.[key],duration=MILL_RECIPES[key].minutes;if(!Number.isInteger(j?.start)||j.start<420)continue;const helped=typeof j.helper==='string'&&j.helper.trim();jobs[key]={start:j.start,end:j.start+duration-(helped?30:0),helper:helped?j.helper.slice(0,16):''};}return {jobs,helpDay:Number.isInteger(raw?.helpDay)&&raw.helpDay>0?raw.helpDay:0};}
export function millRemaining(s,key){const j=s.workshop?.jobs?.[key];return j?Math.max(0,j.end-gameMinute(s)):null;}
export function millError(s,key){const r=Object.hasOwn(MILL_RECIPES,key)?MILL_RECIPES[key]:null;if(!r)return '没有这份配方。';if(s.workshop?.jobs?.[key])return '先取走这一批，再放新的材料。';return Object.entries(r.input).some(([k,n])=>(s[k]||0)<n)?'需要'+materialLine(r.input)+'。':'';}
export function startMill(s,key){if(millError(s,key))return s;const r=MILL_RECIPES[key],w=restoreWorkshop(s.workshop),start=gameMinute(s),out={...s,workshop:{...w,jobs:{...w.jobs,[key]:{start,end:start+r.minutes,helper:''}}}};for(const [k,n]of Object.entries(r.input))out[k]=s[k]-n;return out;}
export function collectMill(s,key){if(millRemaining(s,key)!==0||!MILL_RECIPES[key])return s;const w=restoreWorkshop(s.workshop),jobs={...w.jobs};delete jobs[key];const out={...s,workshop:{...w,jobs}};for(const [k,n]of Object.entries(MILL_RECIPES[key].output))out[k]=(s[k]||0)+n;return out;}
export function helpMill(s,key){const w=restoreWorkshop(s.workshop),job=w.jobs[key];if(!job||job.helper||w.helpDay===s.day||millRemaining(s,key)<=0)return s;return {...s,workshop:{...w,helpDay:s.day,jobs:{...w.jobs,[key]:{...job,end:job.end-30,helper:s.companion.name}}}};}
export function restoreWaterLights(raw){return (Array.isArray(raw)?raw:[]).filter(x=>Number.isInteger(x?.at)&&x.at>=420).slice(-4).map(x=>({at:x.at,together:x.together===true}));}
export const activeWaterLights=s=>restoreWaterLights(s.waterLights).filter(x=>gameMinute(s)>=x.at&&gameMinute(s)-x.at<120);
export function waterLightError(s){const last=restoreWaterLights(s.waterLights).at(-1);return last&&gameMinute(s)-last.at<30?'刚放下的灯还在身边，过半个游戏小时再放一盏。':'';}
export function releaseWaterLight(s,together){if(waterLightError(s))return s;return {...s,waterLights:[...activeWaterLights(s),{at:gameMinute(s),together:!!together}].slice(-4)};}
