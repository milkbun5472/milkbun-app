import {restState} from './rest.mjs?v=fg-e5c8c3ebf8b26e97';
import {currentPromise,matchesTheme} from './photo-promise.mjs?v=fg-e5c8c3ebf8b26e97';
import {travelContext,travelEnvironment,ROUTE_LENGTH} from './travel.mjs?v=fg-e5c8c3ebf8b26e97';
import {visibleJourney} from '../../art/train-carriage/journey.mjs?v=fg-e5c8c3ebf8b26e97';
import {cropRect} from './album.mjs?v=fg-e5c8c3ebf8b26e97';
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
import {FILM_LIMIT,WAITING_FILM_LIMIT} from './photo-limits.mjs?v=fg-e5c8c3ebf8b26e97';
export {FILM_LIMIT};
export function photoPlan(s,companion,width,height){
 if(restState(s).companion||!companion?.id||(s.companionPhotos||[]).length>=WAITING_FILM_LIMIT)return null;
 const trip=s.trips||1,log=s.cameraLog||{},used=log.trip===trip?log.count||0:0;
 if(used>=FILM_LIMIT||(log.trip===trip&&s.distance-(log.distance||0)<32))return null;
 const env=travelEnvironment(s),event=visibleJourney(env);
 if(env.routeBlend||event.id==='open'||event.id==='tunnel'||event.progress<.25||event.progress>.7)return null;
 const key=trip+':'+Math.floor(s.distance/ROUTE_LENGTH)+':'+event.id;
 if(log.key===key)return null;
 const promise=currentPromise(s),target=promise?.companion?.id===companion.id&&!promise.companion.result?promise.companion.theme:null;
 if(!target&&used>0&&hash(companion.id+':'+event.id)%4===0)return null;
 const taste=hash(companion.id),seed=hash(companion.id+':'+key),zoom=1+(taste%4)*.3;
 const pan={x:.2+(seed%61)/100,y:.3+((seed>>>8)%41)/100};
 const crop=target?cropRect(width,height,1,{x:.5,y:.5}):cropRect(width,height,zoom,pan);
 if(target&&!matchesTheme(s,target,crop,width,height))return null;
 return{key,trip,count:used+1,distance:s.distance,crop,subject:event.label,environment:travelContext(s)};
}
export function photoLabel(environment,subject=''){return `${environment.scenery} · ${subject||environment.passing} · ${environment.season} · ${environment.weather} · 第${environment.day}天 ${environment.time}`;}
export function exchangePhotos(s){
 const waiting=s.companionPhotos||[],known=new Set((s.photos||[]).map(p=>p.id));
 return {...s,photos:[...(s.photos||[]),...waiting.filter(p=>!known.has(p.id))],companionPhotos:[],photoPromises:(s.photoPromises||[]).map(p=>p.companion?{...p,companion:{...p.companion,reviewed:true,...(p.companion.result&&waiting.some(x=>x.id===p.companion.result.photoId)?{result:{...p.companion.result,shared:true}}:{})}}:p)};
}
