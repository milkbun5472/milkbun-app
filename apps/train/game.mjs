import {makePromise,creditPhoto,promiseSummaries} from './photo-promise.mjs?v=fg-bd50d5646d2e1a12';
import {createPassengers} from './passengers.mjs?v=fg-bd50d5646d2e1a12';
import {photoPlan,photoLabel,exchangePhotos} from './photography.mjs?v=fg-bd50d5646d2e1a12';
import {createTravelCamera} from './camera-view.mjs?v=fg-bd50d5646d2e1a12';
import {removeAlbumItem} from './album.mjs?v=fg-bd50d5646d2e1a12';
import {createPuzzleDesk} from './puzzle-view.mjs?v=fg-bd50d5646d2e1a12';
import {createCarriageView} from '../../art/train-carriage/view.mjs?v=fg-bd50d5646d2e1a12';
import {restoreTrip,travelEnvironment,travelContext,advanceTrip} from './travel.mjs?v=fg-bd50d5646d2e1a12';
import {ROUTES,SEASONS,WEATHERS} from '../../art/train-carriage/scenery.mjs?v=fg-bd50d5646d2e1a12';
const host=window.parent!==window&&window.parent.FairyGardenHostFor?.(window),status=document.querySelector('#status');
let companionCamera=()=>{},passengers,cameraUI,desk,view,state,frame=0,last=0,saveAt=0,closed=false,saveFailed=false;
function flush(){if(!view||!state)return false;try{if(!host.save({...state},'train'))throw Error('没有保存成功');saveFailed=false;status.textContent='';return true;}catch(e){saveFailed=true;status.textContent='进度没有保存成功，请留在车上重试。';return false;}}
function sync(){const pending=(state.companionPhotos||[]).length;document.querySelector('#open-album').textContent=pending?'相册 · '+pending:'相册';const env=travelEnvironment(state);view.scenery.set({...env,distance:state.distance,playing:false});view.syncLighting();if(!cameraUI?.isOpen)view.render();const minute=Math.floor(state.minute),clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');document.querySelector('#scene-info').textContent=`${SEASONS[env.season]} · ${WEATHERS[env.weather]} · ${clock}　${env.routeBlend>0?ROUTES[env.route]+' → '+ROUTES[env.nextRoute]:ROUTES[env.route]}`;}
function animate(now){frame=requestAnimationFrame(animate);if(closed||document.hidden){last=0;return;}if(last&&now-last<1000/30)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(!saveFailed){state=advanceTrip(state,dt,view.scenery.destination.speedFactor);view.scenery.state.weatherTime+=dt;sync();passengers?.tick(now,dt,!cameraUI?.isOpen);companionCamera();saveAt+=dt;if(saveAt>=3){saveAt=0;flush();}}
}
try{if(!host)throw Error('请从小世界的列车入口进入。');state=restoreTrip(host.load().worlds?.train);view=await createCarriageView(document.querySelector('#stage'),{immersive:true});passengers=await createPassengers(view,host,document.querySelector('#stage'));view.setView('table');view.setZoom(.72);sync();
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view.setView(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));};document.querySelector('[data-view=table]').setAttribute('aria-pressed','true');
 function capture(crop,plan=null){const src=view.scenery.canvas,c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d'),sw=Math.min(src.width,src.height*1.5),sh=sw/1.5,r=crop||{x:(src.width-sw)/2,y:(src.height-sh)/2,w:sw,h:sh};ctx.drawImage(src,r.x,r.y,r.w,r.h,0,0,900,600);const companion=host.companion?.(),environment=plan?.environment||travelContext(state),photo={id:'photo-'+crypto.randomUUID(),src:c.toDataURL('image/jpeg',.84),crop:r,environment,label:photoLabel(environment,plan?.subject),photographer:plan?{role:'companion',id:companion.id,name:companion.name}:{role:'you'}};
 const before=state,credited=creditPhoto(state,photo,r,src.width,src.height);state=credited.s;Object.assign(photo,credited.photo);state=plan?{...state,companionPhotos:[...(state.companionPhotos||[]),photo],cameraLog:{key:plan.key,trip:plan.trip,count:plan.count,distance:plan.distance}}:{...state,photos:[...(state.photos||[]),photo]};if(!flush()){state=before;return null;}return photo;}
 companionCamera=()=>{const src=view.scenery.canvas,plan=photoPlan(state,host.companion?.(),src.width,src.height);if(plan)capture(plan.crop,plan);};

 cameraUI=createTravelCamera({source:()=>view.scenery.canvas,shoot:capture,state:()=>state,onPromise:theme=>{const before=state;state=makePromise(state,theme,host.companion?.());if(!flush()){state=before;throw Error('约定没有存好，请重试。');}},onOpen:()=>view.setView('window')});
 desk=createPuzzleDesk({state:()=>state,save:flush,capture,host,environment:()=>travelContext(state),onOpen:mode=>view.setView('table'),stage:document.querySelector('#stage')});
 document.querySelector('#open-chat').onclick=()=>desk.open('travel').catch(e=>{status.textContent=e.message;});
 document.querySelector('#open-puzzle').onclick=()=>desk.open().catch(e=>{status.textContent=e.message;});
 document.querySelector('#take-photo').onclick=()=>cameraUI.open();
 document.querySelector('#open-album').onclick=()=>{if(flush())host.openAlbum?.();};
 window.TrainGame={desk,flush,speak:(lines,who)=>passengers?.speak(lines,who),passengers,chatContext:()=>({map:"carriage",activity:desk?.activity==='travel'?'看窗外聊天':desk?.isOpen?'拼图桌边':'乘车看风景',environment:travelContext(state),photography:{promises:promiseSummaries(state,true).slice(-3),unopenedCount:(state.companionPhotos||[]).length,recentPhotos:[...(state.photos||[]),...(state.companionPhotos||[])].slice(-4).map(p=>({label:p.label,photographer:p.photographer?.role==='companion'?p.photographer.name:'对方',shared:!(state.companionPhotos||[]).some(x=>x.id===p.id)}))}}),editAlbum:action=>{const before=state;try{if(action.kind==='exchange')state=exchangePhotos(state);else if(action.kind==='delete')state=removeAlbumItem(state,action.id);else throw Error('未知操作');if(!flush())throw Error('相册没有保存成功');desk.refresh().catch(e=>{status.textContent=e.message;});return true;}catch(e){state=before;throw e;}},snapshot:()=>({...state}),get ready(){return !!view;}};host.ready?.();if(!flush())throw Error('进度没有保存成功，请返回重试。');frame=requestAnimationFrame(animate);
}catch(e){status.textContent=e.message;}
window.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)flush();});
window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);flush();cameraUI?.dispose();desk?.dispose();passengers?.dispose();view?.dispose();});
