import {TOWN_PLACES} from './town-life.mjs?v=fg-8c013226fd2a4c96';
const place=v=>TOWN_PLACES.includes(v)?v:'home';
const number=(v,a,b,d)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):d;
export function restoreObservation(raw,activeId,petIds,companionId){
 const id=petIds.includes(raw?.petId)?raw.petId:activeId;
 const mode=['pet','companion','fixed'].includes(raw?.mode)&&!(raw.mode==='companion'&&!companionId)?raw.mode:'pet';
 const resume=raw?.resume==='companion'&&companionId?'companion':'pet';
 const street=raw?.street||{};
 return {mode,petId:id,companionId:String(companionId||''),resume,place:place(raw?.place),street:{pan:{x:number(street.pan?.x,-35,35,0),z:number(street.pan?.z,-54,39.2,0)},zoom:number(street.zoom,.45,2.2,1.6),overview:street.overview===true},rooms:Object.fromEntries(Object.entries(raw?.rooms||{}).filter(([k,v])=>TOWN_PLACES.includes(k)&&k!=='outside'&&v&&typeof v==='object').map(([k,v])=>[k,{zoom:number(v.zoom,.72,8,1.3),pan:Array.isArray(v.pan)?v.pan.slice(0,3).map(x=>number(x,-6,6,0)):[0,0,0],at:Array.isArray(v.at)?v.at.slice(0,3).map(x=>number(x,-12,12,0)):null,orbit:{theta:number(v.orbit?.theta,.18,1.18,.6),phi:number(v.orbit?.phi,.66,1.19,.9)}}]))};
}
export function observedActor(view,pets,companion){
 const mode=view.mode==='fixed'?view.resume:view.mode;
 if(mode==='companion')return companion?.id===view.companionId&&companion.town?{kind:'companion',id:companion.id,name:companion.name,town:companion.town}:null;
 const pet=pets.find(p=>p.id===view.petId);
 return pet?{kind:'pet',id:pet.id,name:pet.profile.name,town:pet.town}:null;
}
export function observe(view,kind,id,pets,companion){
 if(kind==='fixed'){stopObservation(view);return true;}
 if(kind==='companion'&&!companion?.town||kind==='pet'&&!pets.some(p=>p.id===id)||!['pet','companion'].includes(kind))return false;
 view.mode=kind;view.resume=kind;if(kind==='pet')view.petId=id;else view.companionId=String(companion.id);return true;
}
export function stopObservation(view){if(view.mode!=='fixed')view.resume=view.mode;view.mode='fixed';}
