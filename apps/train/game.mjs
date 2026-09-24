import {createPuzzleDesk} from './puzzle-view.mjs?v=fg-0f354cf95dbf3953';
import {createCarriageView} from '../../art/train-carriage/view.mjs?v=fg-0f354cf95dbf3953';
import {restoreTrip,travelEnvironment,advanceTrip} from './travel.mjs?v=fg-0f354cf95dbf3953';
import {ROUTES,SEASONS,WEATHERS} from '../../art/train-carriage/scenery.mjs?v=fg-0f354cf95dbf3953';
const host=window.parent!==window&&window.parent.FairyGardenHostFor?.(window),status=document.querySelector('#status');
let desk,view,state,frame=0,last=0,saveAt=0,closed=false,saveFailed=false;
function flush(){if(!view||!state)return false;try{if(!host.save({...state},'train'))throw Error('没有保存成功');saveFailed=false;status.textContent='';return true;}catch(e){saveFailed=true;status.textContent='进度没有保存成功，请留在车上重试。';return false;}}
function sync(){const env=travelEnvironment(state);view.scenery.set({...env,distance:state.distance,playing:false});view.syncLighting();if(!desk?.isOpen)view.render();const minute=Math.floor(state.minute),clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');document.querySelector('#scene-info').textContent=`${SEASONS[env.season]} · ${WEATHERS[env.weather]} · ${clock}　${env.routeBlend>0?ROUTES[env.route]+' → '+ROUTES[env.nextRoute]:ROUTES[env.route]}`;}
function animate(now){frame=requestAnimationFrame(animate);if(closed||document.hidden){last=0;return;}if(last&&now-last<1000/30)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(!saveFailed){state=advanceTrip(state,dt,view.scenery.destination.speedFactor);view.scenery.state.weatherTime+=dt;sync();saveAt+=dt;if(saveAt>=3){saveAt=0;flush();}}
}
try{if(!host)throw Error('请从小世界的列车入口进入。');state=restoreTrip(host.load().worlds?.train);view=await createCarriageView(document.querySelector('#stage'),{immersive:true});view.setView('window');view.setZoom(.72);sync();
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view.setView(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};document.querySelector('[data-view=window]').setAttribute('aria-pressed','true');
 function capture(){const src=view.scenery.canvas,c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d'),sw=Math.min(src.width,src.height*1.5),sh=sw/1.5;ctx.drawImage(src,(src.width-sw)/2,(src.height-sh)/2,sw,sh,0,0,900,600);const env=travelEnvironment(state),photo={id:'photo-'+crypto.randomUUID(),src:c.toDataURL('image/jpeg',.84),label:`${ROUTES[env.route]} · ${SEASONS[env.season]} · 第${state.day}天 ${String(Math.floor(state.minute/60)).padStart(2,'0')}:${String(Math.floor(state.minute%60)).padStart(2,'0')}`};state.photos=[...(state.photos||[]),photo];if(!flush()){state.photos=state.photos.filter(p=>p.id!==photo.id);return null;}return photo;}
 desk=createPuzzleDesk({state:()=>state,save:flush,capture,host,onOpen:()=>view.setView('table')});
 document.querySelector('#open-puzzle').onclick=()=>desk.open().catch(e=>{status.textContent=e.message;});
 document.querySelector('#take-photo').onclick=()=>{if(capture()){status.textContent='窗景拍好了，去拼图桌选照片吧。';setTimeout(()=>{if(!saveFailed)status.textContent='';},2500);}};
 window.TrainGame={desk,flush,snapshot:()=>({...state}),get ready(){return !!view;}};host.ready?.();if(!flush())throw Error('进度没有保存成功，请返回重试。');frame=requestAnimationFrame(animate);
}catch(e){status.textContent=e.message;}
window.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)flush();});
window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);flush();desk?.dispose();view?.dispose();});
