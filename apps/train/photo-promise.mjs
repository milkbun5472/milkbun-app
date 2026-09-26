import {FILM_LIMIT,WAITING_FILM_LIMIT} from './photo-limits.mjs?v=fg-367961cd8d7e618c';
import {travelEnvironment} from './travel.mjs?v=fg-367961cd8d7e618c';
import {visibleJourney} from '../../art/train-carriage/journey.mjs?v=fg-367961cd8d7e618c';
export const PHOTO_THEMES=[
 {id:'bridge',name:'桥上的风景',hint:'等列车过桥，把桥身和栏杆收进画面。'},
 {id:'station',name:'路过的小站',hint:'等站房经过窗前，把站房拍下来。'},
 {id:'water',name:'一片水光',hint:'经过湖泊、河岸或渔港时，把水面留在画面里。'},
 {id:'village',name:'有人住的地方',hint:'等村落经过，把房子收进画面。'},
 {id:'rain-night',name:'雨中的夜色',hint:'等下雨的夜晚。天气和时刻照常流转，可能需要多坐一会儿。'},
 {id:'lights',name:'亮灯的站房',hint:'等夜晚经过小站，把亮着灯的站房窗口拍下来。'}
];
export const photoTheme=id=>PHOTO_THEMES.find(t=>t.id===id);
export const currentPromise=s=>(s.photoPromises||[]).find(p=>p.trip===(s.trips||1))||null;
export function makePromise(s,theme,companion){
 if(!photoTheme(theme))throw Error('先选一个想拍的主题。');
 if(currentPromise(s))throw Error('这一趟已经约好了，下一趟再换主题。');
 if(companion?.id&&s.cameraLog?.trip===(s.trips||1)&&s.cameraLog.count>=FILM_LIMIT)throw Error('TA这趟的胶卷已经拍满了，下一趟再一起约。');
 if(companion?.id&&(s.companionPhotos||[]).length>=WAITING_FILM_LIMIT)throw Error('先交换一下TA的相册，再约这趟想拍的主题。');
 const choices=PHOTO_THEMES.slice(0,4).filter(t=>t.id!==theme);let hash=0;for(const c of String(companion?.id||'')+':'+(s.trips||1))hash=(Math.imul(hash,31)+c.charCodeAt(0))>>>0;
 const promise={id:'promise-'+(s.trips||1),trip:s.trips||1,day:s.day,you:{theme},companion:companion?.id?{id:companion.id,name:companion.name,theme:choices[hash%choices.length].id}:null};
 return {...s,photoPromises:[...(s.photoPromises||[]),promise]};
}
// Conservative subject region in the 1600x600 window painting. Cropping only sky does not count.
export function matchesTheme(s,theme,crop,width=1600,height=600){
 const env=travelEnvironment(s),event=visibleJourney(env),night=env.hour<6||env.hour>19.5;
 if(env.routeBlend||event.tunnel||event.id==='tunnel')return false;
 if(theme==='rain-night')return env.weather==='rain'&&night;
 if(event.progress<.3||event.progress>.65)return false;
 const x=1900-event.progress*3600;
 let box;
 if(theme==='bridge'&&event.id==='bridge')box={x:0,y:356,w:1600,h:244};
 else if((theme==='station'||theme==='lights'&&night)&&event.id==='station')box=theme==='lights'?{x:x+187,y:405,w:278,h:49}:{x:x+160,y:330,w:360,h:177};
 else if(theme==='water'&&['lake','harbor'].includes(event.id))box={x:0,y:454,w:1600,h:146};
 else if(theme==='village'&&event.id==='village'&&env.route!=='coast')box={x:x+220,y:400,w:550,h:120};
 else if(theme==='village'&&event.id==='village'&&env.route==='coast')box={x:300,y:270,w:1000,h:230};
 else return false;
 const r=crop?{x:crop.x/width*1600,y:crop.y/height*600,w:crop.w/width*1600,h:crop.h/height*600}:{x:350,y:0,w:900,h:600};
 const overlap=Math.max(0,Math.min(r.x+r.w,box.x+box.w,1600)-Math.max(r.x,box.x,0))*Math.max(0,Math.min(r.y+r.h,box.y+box.h,600)-Math.max(r.y,box.y,0));
 return overlap>=Math.min(r.w*r.h*.12,box.w*box.h*.25);
}
export function creditPhoto(s,photo,crop,width,height){
 if(photo.subject&&photo.subject!=='window')return{s,photo};
 const promise=currentPromise(s),who=photo.photographer?.role==='companion'?'companion':'you',part=promise?.[who];
 if(!part||part.result||!matchesTheme(s,part.theme,crop,width,height))return{s,photo};
 const result={photoId:photo.id,label:photo.label,shared:who==='you'};
 return{s:{...s,photoPromises:s.photoPromises.map(p=>p.id===promise.id?{...p,[who]:{...part,result}}:p)},photo:{...photo,promise:{id:promise.id,theme:part.theme,name:photoTheme(part.theme).name}}};
}
export function promiseSummaries(s,reveal=false){return(s.photoPromises||[]).map(p=>({id:p.id,trip:p.trip,you:{theme:photoTheme(p.you.theme)?.name,status:p.you.result?'已拍到':'还没拍到'},companion:p.companion?{name:p.companion.name,theme:photoTheme(p.companion.theme)?.name,status:p.companion.result?.shared?'已拍到并交换':reveal&&p.companion.result?'已拍到，尚未交换':!p.companion.result&&p.companion.reviewed?'暂时还没拍到':'等交换相册时揭晓'}:null}));}
