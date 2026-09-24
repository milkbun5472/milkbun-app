import {createCarriageView} from '../../art/train-carriage/view.mjs?v=fg-b89ee57384ffe249';
import {restoreTrip,travelEnvironment,advanceTrip} from './travel.mjs?v=fg-b89ee57384ffe249';
import {ROUTES,SEASONS,WEATHERS} from '../../art/train-carriage/scenery.mjs?v=fg-b89ee57384ffe249';
const host=window.parent!==window&&window.parent.FairyGardenHostFor?.(window),status=document.querySelector('#status');
let view,state,frame=0,last=0,saveAt=0,closed=false,saveFailed=false;
function flush(){if(!view||!state)return false;try{if(!host.save({...state},'train'))throw Error('没有保存成功');saveFailed=false;status.textContent='';return true;}catch(e){saveFailed=true;status.textContent='进度没有保存成功，请留在车上重试。';return false;}}
function sync(){const env=travelEnvironment(state);view.scenery.set({...env,distance:state.distance,playing:false});view.syncLighting();view.render();const minute=Math.floor(state.minute),clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');document.querySelector('#scene-info').textContent=`${SEASONS[env.season]} · ${WEATHERS[env.weather]} · ${clock}　${env.routeBlend>0?ROUTES[env.route]+' → '+ROUTES[env.nextRoute]:ROUTES[env.route]}`;}
function animate(now){frame=requestAnimationFrame(animate);if(closed||document.hidden){last=0;return;}if(last&&now-last<1000/30)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(!saveFailed){state=advanceTrip(state,dt,view.scenery.destination.speedFactor);view.scenery.state.weatherTime+=dt;sync();saveAt+=dt;if(saveAt>=3){saveAt=0;flush();}}
}
try{if(!host)throw Error('请从小世界的列车入口进入。');state=restoreTrip(host.load().worlds?.train);view=await createCarriageView(document.querySelector('#stage'),{immersive:true});view.setView('window');view.setZoom(.72);sync();
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view.setView(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};document.querySelector('[data-view=window]').setAttribute('aria-pressed','true');
 window.TrainGame={flush,snapshot:()=>({...state}),get ready(){return !!view;}};host.ready?.();if(!flush())throw Error('进度没有保存成功，请返回重试。');frame=requestAnimationFrame(animate);
}catch(e){status.textContent=e.message;}
window.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)flush();});
window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);flush();view?.dispose();});
