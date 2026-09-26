import * as T from 'three';
import {restState,isResting,changeRest,restContext} from './rest.mjs?v=fg-da70aec4cf65bb87';
import {makePromise,creditPhoto,promiseSummaries} from './photo-promise.mjs?v=fg-da70aec4cf65bb87';
import {mergeLook,outfitId,outfitColors,DEFAULT_LOOK,COMPANION_LOOK,hairId,dyesOf,HAIR_MODES} from '../fairy-garden/wardrobe.mjs?v=fg-da70aec4cf65bb87';
import {createPassengers} from './passengers.mjs?v=fg-da70aec4cf65bb87';
import {photoPlan,photoLabel,exchangePhotos} from './photography.mjs?v=fg-da70aec4cf65bb87';
import {createTravelCamera} from './camera-view.mjs?v=fg-da70aec4cf65bb87';
import {removeAlbumItem,setBackNote} from './album.mjs?v=fg-da70aec4cf65bb87';
import {createPuzzleDesk} from './puzzle-view.mjs?v=fg-da70aec4cf65bb87';
import {createCarriageView} from '../../art/train-carriage/view.mjs?v=fg-da70aec4cf65bb87';
import {restoreTrip,travelEnvironment,travelContext,advanceTrip} from './travel.mjs?v=fg-da70aec4cf65bb87';
import {ROUTES,SEASONS,WEATHERS} from '../../art/train-carriage/scenery.mjs?v=fg-da70aec4cf65bb87';
import {createTraveler} from '../fairy-garden/traveler.mjs?v=fg-da70aec4cf65bb87';
const host=window.parent!==window&&window.parent.FairyGardenHostFor?.(window),status=document.querySelector('#status');
let wander=()=>{},cameraSubject='window',companionCamera=()=>{},passengers,cameraUI,desk,view,state,frame=0,last=0,saveAt=0,closed=false,saveFailed=false;
// 改外貌时的预览（她 2026-09-25：「设置外貌的时候看不到预览，搞成跟庭院一样」）：
// 宿主那页顶上留 PREVIEW_BAND 这么高一条透明窗，这儿往窗里单独渲一个小人，和庭院那一份同一个做法。
// 自己一个场景、一台相机；小人还是同一个 createTraveler、同一份 doll.glb。
const PREVIEW_BAND=.36;
let previewWho=null,previewScene=null,previewCam=null;const previewDolls={};
function setPreview(who){if(who!=='me'&&who!=='companion'){previewWho=null;document.body.classList.remove('previewing');return true;}
 if(!passengers?.source)return false;
 if(!previewScene){previewScene=new T.Scene();previewCam=new T.OrthographicCamera(-1,1,1,-1,.1,20);previewCam.position.set(.9,1.5,4);previewCam.lookAt(0,.82,0);previewScene.add(new T.HemisphereLight('#ffffff','#c3cfb4',1.9));const key=new T.DirectionalLight('#fff4e0',1.5);key.position.set(2.2,4,3);previewScene.add(key);}
 if(!previewDolls[who]){const d=createTraveler(passengers.source,who!=='me',lookOf(who));previewScene.add(d.root);previewDolls[who]=d;}
 for(const [k,d] of Object.entries(previewDolls))d.root.visible=k===who;previewWho=who;document.body.classList.add('previewing');return true;}
function drawPreview(clock){const doll=previewDolls[previewWho],r=view.renderer;if(!doll)return;doll.animate(clock,{moving:false,gesture:'rest',height:.08});doll.root.rotation.y=Math.sin(clock*.5)*.5;
 const W=r.domElement.clientWidth||innerWidth,H=r.domElement.clientHeight||innerHeight,w=Math.max(1,W),h=Math.max(1,Math.round(innerHeight*PREVIEW_BAND)),y=Math.max(0,H-h),span=2.35,aspect=w/h;
 previewCam.left=-span*aspect/2;previewCam.right=span*aspect/2;previewCam.top=span/2;previewCam.bottom=-span/2;previewCam.updateProjectionMatrix();
 const size=r.getSize(new T.Vector2());r.setScissorTest(true);r.setScissor(0,y,w,h);r.setViewport(0,y,w,h);const old=r.getClearColor(new T.Color()),oa=r.getClearAlpha();r.setClearColor('#e9ecdd',1);r.clear();r.render(previewScene,previewCam);r.setClearColor(old,oa);r.setScissorTest(false);r.setViewport(0,0,size.x,size.y);}
function lookOf(who){const a=host?.load?.()||{},g=a.worlds?.garden||a.world;return state?.looks?.[who]||(who==='me'?a.journey?.look||g?.look:a.journey?.companionLook||g?.companion?.look)||{};}
function flush(){if(!view||!state)return false;try{if(!host.save({...state},'train'))throw Error('没有保存成功');saveFailed=false;status.textContent='';return true;}catch(e){saveFailed=true;status.textContent='进度没有保存成功，请留在车上重试。';return false;}}
// 休息面板那行字照实说：站起来走动了就别再写「在桌边」
function standAt(w){const at=passengers?.where(w);return at&&at!=='坐在座位上'?at:'在桌边';}
function sync(){const r=restState(state),has=!!host.companion?.()?.id;document.querySelector('#rest-controls').hidden=view.currentView!=='berths'||cameraUI?.isOpen||desk?.isOpen||!document.querySelector('#move-controls').hidden;document.querySelector('#rest-you').textContent=r.you?'我回桌边':'我躺下';document.querySelector('#rest-companion').textContent=r.companion?'TA回桌边':'TA休息';document.querySelector('#rest-companion').disabled=!has;document.querySelector('#rest-together').disabled=!has;document.querySelector('#rest-info').textContent=(r.you?'你在下铺休息':'你'+standAt('me'))+(has?(r.companion?' · TA在上铺休息':' · TA'+standAt('companion')):'');document.querySelector('#take-photo').textContent=isResting(state)?'起身拍照':'拍照';document.querySelector('#open-puzzle').textContent=isResting(state)?'起身拼图':'拼图';const pending=(state.companionPhotos||[]).length;document.querySelector('#open-album').textContent=pending?'相册 · '+pending:'相册';const env=travelEnvironment(state);view.scenery.set({...env,distance:state.distance,playing:false});view.syncLighting();if((!cameraUI?.isOpen||cameraSubject!=='window')&&!(desk?.isOpen&&desk.activity!=='travel'))view.render();if(previewWho)drawPreview(performance.now()/1000);const minute=Math.floor(state.minute),clock=String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');document.querySelector('#scene-info').textContent=`${SEASONS[env.season]} · ${WEATHERS[env.weather]} · ${clock}　${env.routeBlend>0?ROUTES[env.route]+' → '+ROUTES[env.nextRoute]:ROUTES[env.route]}`;}
function animate(now){frame=requestAnimationFrame(animate);if(closed||document.hidden){last=0;return;}if(last&&now-last<1000/30)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
 if(!saveFailed){state=advanceTrip(state,dt,view.scenery.destination.speedFactor);view.scenery.state.weatherTime+=dt;sync();passengers?.tick(now,dt,!cameraUI?.isOpen);wander(now);companionCamera();saveAt+=dt;if(saveAt>=3){saveAt=0;flush();}}
}
try{if(!host)throw Error('请从小世界的列车入口进入。');state=restoreTrip(host.load().worlds?.train);view=await createCarriageView(document.querySelector('#stage'),{immersive:true});passengers=await createPassengers(view,host,document.querySelector('#stage'),()=>state);view.setView(isResting(state)?'berths':'table');view.setZoom(.72);sync();
 for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{try{if(b.dataset.view==='table')rise();view.setView(b.dataset.view);document.querySelectorAll('[data-view]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}catch(e){status.textContent=e.message;}};document.querySelector('[data-view='+view.currentView+']').setAttribute('aria-pressed','true');
 function setRest(who,lying){const before=state;state=changeRest(state,who,lying,!!host.companion?.()?.id);if(!flush()){state=before;throw Error('休息状态没有保存成功，请重试。');}passengers.tick(performance.now(),0,true);sync();}
 function rise(){if(isResting(state)){setRest('both',false);view.setView('table');}}
 // 躺下＝真的走到卧铺前再躺进去；回桌边＝从床上起来走回座位坐下（她 2026-09-25）
 for(const [id,who] of [['rest-you','you'],['rest-companion','companion']])document.querySelector('#'+id).onclick=()=>{try{if(restState(state)[who])setRest(who,false);else moveTo(who==='you'?'me':'companion','berth');}catch(e){status.textContent=e.message;}};// 走动（她 2026-09-25）：两排，一排是你、一排是TA。躺下这一格走到卧铺前再交给原来那套休息（时钟、拍照的规矩都跟着它）
 const moveKey={me:'you',companion:'companion'};
 function moveTo(who,spot,quiet=false){try{const key=moveKey[who];if(restState(state)[key])setRest(key,false);passengers.go(who,spot,spot==='berth'?()=>{try{setRest(key,true);if(!quiet)view.setView('berths');}catch(e){status.textContent=e.message;}}:null);syncMove();return true;}catch(e){status.textContent=e.message;return false;}}
 // TA 自己也会起来走走（她 2026-09-25）：坐一阵就起身看看窗外、理理行李，过一会儿自己回座位；
 // 夜里（22 点到 6 点）偶尔自己去上铺躺下，天亮了自己起来。拼图、拍照开着的时候不动。
 let wanderAt=0,selfRest=false;const rand=(a,b)=>a+Math.random()*(b-a);
 wander=(now,force=false)=>{if(!passengers||saveFailed||!host.companion?.()?.id||cameraUI?.isOpen||(desk?.isOpen&&desk.activity!=='travel'))return;const p=passengers.people.find(x=>x.who==='companion');if(!p||p.path.length)return;
  const hour=state.minute/60,night=hour>=22||hour<6,resting=!!restState(state).companion;
  if(resting){if(selfRest&&!night){selfRest=false;try{setRest('companion',false);}catch(e){}wanderAt=now+rand(60,150)*1000;}return;}
  if(!wanderAt&&!force){wanderAt=now+rand(90,240)*1000;return;}if(now<wanderAt&&!force)return;
  if(p.spot==='seat'){const spot=night&&Math.random()<.5?'berth':['stand','stand','rack'][Math.floor(Math.random()*3)];if(moveTo('companion',spot,true)&&spot==='berth')selfRest=true;wanderAt=now+rand(40,90)*1000;}
  else{moveTo('companion','seat',true);wanderAt=now+rand(120,300)*1000;}};
 // 点一下地板：我就走过去。拖动、双指缩放不算点；拍照、拼图开着时不接
 {const c=view.renderer.domElement;let down=null;c.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId};});
  c.addEventListener('pointerup',e=>{const d=down;down=null;if(!d||d.id!==e.pointerId||Math.hypot(e.clientX-d.x,e.clientY-d.y)>8||performance.now()-d.t>500||cameraUI?.isOpen||desk?.isOpen)return;
   const box=c.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((e.clientX-box.left)/box.width*2-1,-(e.clientY-box.top)/box.height*2+1),view.camera);
   const at=passengers?.floorPoint(ray.ray);if(!at)return;try{if(restState(state).you)setRest('you',false);passengers.goTo('me',at.x,at.z);}catch(err){status.textContent=err.message;}});}
 function syncMove(){const has=!!host.companion?.()?.id;for(const b of document.querySelectorAll('#move-controls [data-who=companion]'))b.disabled=!has;}
 for(const b of document.querySelectorAll('#move-controls [data-spot]'))b.onclick=()=>moveTo(b.dataset.who,b.dataset.spot);
 document.querySelector('#open-move').onclick=()=>{const el=document.querySelector('#move-controls');el.hidden=!el.hidden;document.querySelector('#open-move').setAttribute('aria-pressed',String(!el.hidden));syncMove();};
 document.querySelector('#move-close').onclick=()=>{document.querySelector('#move-controls').hidden=true;document.querySelector('#open-move').setAttribute('aria-pressed','false');};
document.querySelector('#rest-together').onclick=()=>{try{const r=restState(state);if(!r.you)moveTo('me','berth');if(!r.companion&&host.companion?.()?.id)moveTo('companion','berth');}catch(e){status.textContent=e.message;}};
 function capture(crop,plan=null,subject='window'){if(!plan&&isResting(state)){try{rise();}catch(e){status.textContent=e.message;return null;}}if(subject!=='window')view.render();const src=subject==='window'?view.scenery.canvas:view.renderer.domElement,c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d'),sw=Math.min(src.width,src.height*1.5),sh=sw/1.5,r=crop||{x:(src.width-sw)/2,y:(src.height-sh)/2,w:sw,h:sh};ctx.drawImage(src,r.x,r.y,r.w,r.h,0,0,900,600);const companion=host.companion?.(),environment=plan?.environment||travelContext(state),photo={id:'photo-'+crypto.randomUUID(),at:Date.now(),day:state.day,src:c.toDataURL('image/jpeg',.84),crop:r,environment,subject,label:photoLabel(environment,subject==='window'?plan?.subject:subject==='companion'?'车厢里的'+(companion?.name||'同行者'):'车厢合照'),photographer:plan?{role:'companion',id:companion.id,name:companion.name}:{role:'you'}};
 const before=state,credited=creditPhoto(state,photo,r,src.width,src.height);state=credited.s;Object.assign(photo,credited.photo);state=plan?{...state,companionPhotos:[...(state.companionPhotos||[]),photo],cameraLog:{key:plan.key,trip:plan.trip,count:plan.count,distance:plan.distance}}:{...state,photos:[...(state.photos||[]),photo]};if(!flush()){state=before;return null;}return photo;}
 companionCamera=()=>{const src=view.scenery.canvas,plan=photoPlan(state,host.companion?.(),src.width,src.height);if(plan)capture(plan.crop,plan);};

 cameraUI=createTravelCamera({host,source:mode=>mode==='window'?view.scenery.canvas:view.renderer.domElement,shoot:(crop,mode)=>capture(crop,null,mode),hasCompanion:()=>!!host.companion?.()?.id,onMode:mode=>{cameraSubject=mode;view.setPhotoView(mode);},onClose:()=>{cameraSubject='window';view.setPhotoView(null);},state:()=>state,onPromise:theme=>{const before=state;state=makePromise(state,theme,host.companion?.());if(!flush()){state=before;throw Error('约定没有存好，请重试。');}},onOpen:()=>{rise();view.setView('table');}});
 desk=createPuzzleDesk({state:()=>state,save:flush,capture,host,environment:()=>travelContext(state),onOpen:mode=>{if(mode!=='travel'){rise();passengers?.home();}view.setView(isResting(state)?'berths':'table');},stage:document.querySelector('#stage')});
 document.querySelector('#open-chat').onclick=()=>desk.open('travel').catch(e=>{status.textContent=e.message;});
 document.querySelector('#open-puzzle').onclick=()=>desk.open().catch(e=>{status.textContent=e.message;});
 document.querySelector('#take-photo').onclick=()=>{try{passengers?.home();cameraUI.open();}catch(e){status.textContent=e.message;}};
 document.querySelector('#open-album').onclick=()=>{if(flush())host.openAlbum?.();};
 window.TrainGame={desk,flush,speak:(lines,who)=>passengers?.speak(lines,who),passengers,
  // 改外貌（她 2026-09-25：「列车里的设置能不能把改外貌也放进去」）：只记在这一档列车里，
  // 没改过就沿用庭院那一身；合并规则和庭院是同一个 mergeLook。
  // 聊天里 TA 说要去哪，就真的走过去（只动 TA 自己）
  companionMove:spot=>['seat','stand','rack','berth'].includes(spot)&&!cameraUI?.isOpen&&!(desk?.isOpen&&desk.activity!=='travel')?moveTo('companion',spot,true):false,
  wanderNow:()=>wander(performance.now(),true),
  preview:who=>setPreview(who),
  getLook:()=>({me:{...lookOf('me')},companion:{...lookOf('companion')}}),
  hairModes:HAIR_MODES,
  getDyes:who=>dyesOf(lookOf(who),who==='me'?DEFAULT_LOOK:COMPANION_LOOK),
  getHair:who=>hairId(lookOf(who).hair||(who==='me'?DEFAULT_LOOK:COMPANION_LOOK).hair),
  getOutfit:who=>{const l=lookOf(who);return {id:outfitId(l),colors:outfitColors({...(who==='me'?DEFAULT_LOOK:COMPANION_LOOK),...l})};},
  setLook:(who,patch)=>{if(!view||!patch||(who!=='me'&&who!=='companion'))return false;const before=state;state={...state,looks:{...(state.looks||{}),[who]:mergeLook(lookOf(who),patch)}};if(!flush()){state=before;return false;}passengers?.people.find(p=>p.who===who)?.avatar.setLook(patch);previewDolls[who]?.setLook(patch);return true;},
  chatContext:()=>({map:"carriage",activity:cameraUI?.isOpen?(cameraSubject==='window'?'拍摄窗景':cameraSubject==='companion'?'给同行者拍照':'拍两人合照'):desk?.isOpen&&desk?.activity==='travel'?(isResting(state)?'在卧铺边休息聊天':'看窗外聊天'):desk?.isOpen?'拼图桌边':'乘车看风景',rest:(()=>{const r=restContext(state,!!host.companion?.()?.id);for(const [k,w] of [['you','me'],['companion','companion']]){const at=passengers?.where(w);if(at&&r[k]&&!restState(state)[k])r[k]=at;}return r;})(),environment:travelContext(state),photography:{promises:promiseSummaries(state,true).slice(-3),unopenedCount:(state.companionPhotos||[]).length,recentPhotos:[...(state.photos||[]),...(state.companionPhotos||[])].slice(-4).map(p=>({label:p.label,photographer:p.photographer?.role==='companion'?p.photographer.name:'对方',shared:!(state.companionPhotos||[]).some(x=>x.id===p.id)}))}}),editAlbum:action=>{const before=state;try{if(action.kind==='exchange')state=exchangePhotos(state);else if(action.kind==='delete')state=removeAlbumItem(state,action.id);else if(action.kind==='note')state=setBackNote(state,action.id,action.who,action.text,host.companion?.()?.name);else throw Error('未知操作');if(!flush())throw Error('相册没有保存成功');desk.refresh().catch(e=>{status.textContent=e.message;});return true;}catch(e){state=before;throw e;}},snapshot:()=>({...state}),get ready(){return !!view;}};host.ready?.();if(!flush())throw Error('进度没有保存成功，请返回重试。');frame=requestAnimationFrame(animate);
}catch(e){status.textContent=e.message;}
window.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)flush();});
window.addEventListener('pagehide',()=>{closed=true;cancelAnimationFrame(frame);flush();cameraUI?.dispose();desk?.dispose();passengers?.dispose();view?.dispose();});
