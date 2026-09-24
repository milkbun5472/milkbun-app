import {createTravelCamera} from './camera-view.mjs?v=fg-abf1f6647933f99c';
import {removeAlbumItem} from './album.mjs?v=fg-abf1f6647933f99c';
import {createPuzzleDesk} from './puzzle-view.mjs?v=fg-abf1f6647933f99c';
import {createCarriageView} from '../../art/train-carriage/view.mjs?v=fg-abf1f6647933f99c';
import {restoreTrip,travelEnvironment,advanceTrip} from './travel.mjs?v=fg-abf1f6647933f99c';
import {ROUTES,SEASONS,WEATHERS} from '../../art/train-carriage/scenery.mjs?v=fg-abf1f6647933f99c';
const host=window.parent!==window&&window.parent.FairyGardenHostFor?.(window),status=document.querySelector('#status');
let cameraUI,desk,view,state,frame=0,last=0,saveAt=0,closed=false,saveFailed=false;
function flush(){if(!view||!state)return false;try{if(!host.save({...state},'train'))throw Error('没有保存成功');saveFailed=false;status.textContent='';return true;}catch(e){saveFailed=true;status.textContent='进度没有保存成功，请留在车上重试。';return false;}}
function sync(){const env=travelEnvironment(state);view.scenery.set({...env,distance:state.distance,playing:false});view.syncLighting();if(!desk?.isOpen&&!cameraUI?.isOpen)view.render();const minute=Math.floor(state.minute),clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');document.querySelector('#scene-info').textContent=`${SEASONS[env.season]} · ${WEATHERS[env.weather]} · ${clock}　${env.routeBlend>0?ROUTES[env.route]+' → '+ROUTES[env.nextRoute]:ROUTES[env.route]}`;}
function animate(now){frame=requestAnimationFrame(animate);if(closed||document.hidden){last=0;return;}if(last&&now-last<1000/30)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(!saveFailed){state=advanceTrip(state,dt,view.scenery.destination.speedFactor);view.scenery.state.weatherTime+=dt;sync();saveAt+=dt;if(saveAt>=3){saveAt=0;flush();}}
}
try{if(!host)throw Error('请从小世界的列车入口进入。');state=restoreTrip(host.load().worlds?.train);view=await createCarriageView(document.querySelector('#stage'),{immersive:true});view.setView('window');view.setZoom(.72);sync();
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view.setView(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};document.querySelector('[data-view=window]').setAttribute('aria-pressed','true');
 function capture(crop){const src=view.scenery.canvas,c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d'),sw=Math.min(src.width,src.height*1.5),sh=sw/1.5,r=crop||{x:(src.width-sw)/2,y:(src.height-sh)/2,w:sw,h:sh};ctx.drawImage(src,r.x,r.y,r.w,r.h,0,0,900,600);const env=travelEnvironment(state),photo={id:'photo-'+crypto.randomUUID(),src:c.toDataURL('image/jpeg',.84),crop:r,label:`${ROUTES[env.route]} · ${SEASONS[env.season]} · 第${state.day}天 ${String(Math.floor(state.minute/60)).padStart(2,'0')}:${String(Math.floor(state.minute%60)).padStart(2,'0')}`};state.photos=[...(state.photos||[]),photo];if(!flush()){state.photos=state.photos.filter(p=>p.id!==photo.id);return null;}return photo;}
 cameraUI=createTravelCamera({source:()=>view.scenery.canvas,shoot:capture,onOpen:()=>view.setView('window')});
 desk=createPuzzleDesk({state:()=>state,save:flush,capture,host,onOpen:()=>view.setView('table')});
 document.querySelector('#open-puzzle').onclick=()=>desk.open().catch(e=>{status.textContent=e.message;});
 document.querySelector('#take-photo').onclick=()=>cameraUI.open();
 document.querySelector('#open-album').onclick=()=>{if(flush())host.openAlbum?.();};
 window.TrainGame={desk,flush,editAlbum:action=>{const before=state;try{if(action.kind!=='delete')throw Error('未知操作');state=removeAlbumItem(state,action.id);if(!flush())throw Error('相册没有保存成功');desk.refresh().catch(e=>{status.textContent=e.message;});return true;}catch(e){state=before;throw e;}},snapshot:()=>({...state}),get ready(){return !!view;}};host.ready?.();if(!flush())throw Error('进度没有保存成功，请返回重试。');frame=requestAnimationFrame(animate);
}catch(e){status.textContent=e.message;}
window.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)flush();});
window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);flush();cameraUI?.dispose();desk?.dispose();view?.dispose();});
