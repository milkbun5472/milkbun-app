import * as T from 'three';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=fg-02c90601f4c121f4';
import {DRACOLoader} from '../vendor/DRACOLoader.js?v=fg-02c90601f4c121f4';
import {createTraveler,loadTravelerSource,setFaceBase} from '../traveler.mjs?v=fg-02c90601f4c121f4';
import {seatLook} from '../wardrobe.mjs?v=fg-02c90601f4c121f4';
import {MAPS,findPath,floorHeight,walkable,segmentClear,seatsOf,areaSpots,sleepPose} from '../world.mjs?v=fg-02c90601f4c121f4';
import {createMapLoader,disposeMap} from '../map-loader.mjs?v=fg-02c90601f4c121f4';
import {stepRoute} from '../locomotion.mjs?v=fg-02c90601f4c121f4';
import {createMapGesture,orthographicPanDelta,orthographicCameraPose} from '../view-controls.mjs?v=fg-02c90601f4c121f4';
import {activityPose} from './activity.mjs?v=fg-02c90601f4c121f4';
import {DAY_PLACES,DAY_FACTORIES,registerDayPlaces,placeList,createPlaceMarkers} from './places/index.mjs?v=fg-02c90601f4c121f4';
registerDayPlaces(MAPS);
import {CORE_SPACES,SPACE_STYLES,registerCoreSpaces,activitySpot} from './spaces.mjs?v=fg-02c90601f4c121f4';
import {createSpaceView} from './space-view.mjs?v=fg-02c90601f4c121f4';
registerCoreSpaces(MAPS);
setFaceBase(new URL('../../companion/faces/',import.meta.url).href);

const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,alpha:false}),camera=new T.OrthographicCamera(-8,8,8,-8,.1,100);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#e4dece');document.body.prepend(renderer.domElement);
const hemi=new T.HemisphereLight('#fff4dd','#958267',2.2);scene.add(hemi);
const sun=new T.DirectionalLight('#fff4de',3);sun.position.set(-8,16,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:65});sun.shadow.normalBias=.035;scene.add(sun);
const fill=new T.DirectionalLight('#d4e5ee',1);fill.position.set(8,6,-9);scene.add(fill);
const draco=new DRACOLoader();draco.setDecoderPath(new URL('../vendor/draco/',import.meta.url).href);const loader=new GLTFLoader();loader.setDRACOLoader(draco);
const cover=document.querySelector('#cover'),place=document.querySelector('#place'),pan={x:0,z:0};
let avatar=null,ready=false,disposed=false,map=null,snapshot=null,pending=null,signature='',lookKey='',epoch=0,route=[],position={x:0,z:0},speed=0,yaw=0,target=null,seat=null,bed=null,walkTarget=0,dwell=0,onArrive=null,following=true,span=10,frame=0,changing=false,failure='',spaceStyle='';
const tell=error=>{failure=error||'';if(parent!==window)parent.postMessage({type:'char-day-status',error},location.origin);};
const mapLoader=createMapLoader({maps:MAPS,loadAsset:async asset=>{const url=new URL('../'+asset.replace(/^\.\//,''),import.meta.url).href,root=(await loader.loadAsync(url)).scene;root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});return root;},factories:{...DAY_FACTORIES,...Object.fromEntries(Object.keys(CORE_SPACES).map(id=>[id,()=>createSpaceView(id,id==='dayHome'?snapshot?.homeStyle:'warm')]))},attach:o=>scene.add(o),detach:o=>scene.remove(o)});
function cameraPose(){const p=orthographicCameraPose(pan,span,camera.zoom,0);camera.position.set(p.position.x,p.position.y,p.position.z);camera.lookAt(p.target.x,p.target.y,p.target.z);camera.far=p.far;camera.updateProjectionMatrix();}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;cameraPose();}
function setFollowing(value){if(following===value)return;following=value;if(parent!==window)parent.postMessage({type:'char-day-view',following},location.origin);}
function center(){setFollowing(true);const focal=bed||seat||position;pan.x=focal.x;pan.z=focal.z;gesture.setZoom(1.6);cameraPose();}
function overview(){setFollowing(false);pan.x=MAPS[map]?.view?.x||0;pan.z=MAPS[map]?.view?.z||0;gesture.setZoom(CORE_SPACES[map]?Math.min(.75,innerWidth/innerHeight*span/(MAPS[map].bounds.w+MAPS[map].bounds.d)*1.13):DAY_PLACES[map]?Math.min(.85,innerWidth/innerHeight*.77):map==='garden'?.65:.62);cameraPose();}
const gesture=createMapGesture({initial:1.6,min:.2,onZoom:v=>{camera.zoom=v;cameraPose();},onPan:(dx,dy)=>{
  setFollowing(false);const a=new T.Raycaster(),b=new T.Raycaster();a.setFromCamera(new T.Vector2(0,0),camera);b.setFromCamera(new T.Vector2(dx/innerWidth*2,-dy/innerHeight*2),camera);
  const q=orthographicPanDelta(a.ray.origin,b.ray.origin,a.ray.direction);if(q){pan.x=Math.max(-50,Math.min(50,pan.x+q.x));pan.z=Math.max(-50,Math.min(50,pan.z+q.z));cameraPose();}
},onTap:()=>center()});
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{gesture.down(e.pointerId,e.clientX,e.clientY);canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>gesture.move(e.pointerId,e.clientX,e.clientY));
canvas.addEventListener('pointerup',e=>gesture.up(e.pointerId,e.clientX,e.clientY));
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>gesture.up(e.pointerId,e.clientX,e.clientY,true));
canvas.addEventListener('wheel',e=>{e.preventDefault();gesture.setZoom(gesture.getZoom()*Math.exp(-Math.max(-240,Math.min(240,e.deltaY))*.002));},{passive:false});
addEventListener('resize',resize);addEventListener('blur',()=>gesture.cancel());

function availableSeat(kind){return Object.values(seatsOf(map)).find(s=>s.piece?.includes(':'+kind+':'))||Object.values(seatsOf(map))[0];}
function destination(p){
  seat=null;bed=null;
  if(p.spot){const spot=(DAY_PLACES[map]||CORE_SPACES[map])?.spots.find(s=>s.id===p.spot);if(spot){seat=spot.seat||null;if(spot.sleep)bed=sleepPose({map,position:MAPS[map].spawn,companion:{map,position:spot.target},sleep:{companion:spot.id}},'companion');yaw=spot.heading||0;return {...spot.target};}}
  if(CORE_SPACES[map]){
    const spot=activitySpot(MAPS[map],p.action);
    if(spot){seat=spot.seat||null;if(spot.sleep)bed=sleepPose({map,position:MAPS[map].spawn,companion:{map,position:spot.target},sleep:{companion:spot.id}},'companion');yaw=spot.heading||0;return {...spot.target};}
    return {...MAPS[map].spawn};
  }
  if(p.action==='sleep'){
    const id=Object.keys(MAPS.home.beds)[0],approach=MAPS.home.beds[id].approach.companion;
    bed=sleepPose({map:'home',position:MAPS.home.spawn,companion:{map:'home',position:approach},sleep:{companion:id}},'companion');
    return {...approach};
  }
  if(['meal','tea','rest'].includes(p.action)){
    seat=availableSeat(p.action==='meal'?'chair':map==='home'?'sofa':'bench');
    if(seat)return {...(seat.approach||seat)};
  }
  if(['read','work'].includes(p.action)){
    const spots=areaSpots(map,MAPS[map].spawn,50),spot=spots.find(s=>s.gesture==='read');if(spot)return {...spot.target};
  }
  return {...MAPS[map].spawn};
}
function go(to,done){
  route=findPath(position,to,map)||[];speed=0;onArrive=done||null;
  if(!route.length&&Math.hypot(position.x-to.x,position.z-to.z)<.3){const fn=onArrive;onArrive=null;fn?.();}
  else if(!route.length){target={...position};seat=bed=null;onArrive=null;}
}
async function enter(next,token,initial=false){
  changing=true;cover.classList.add('on');avatar.root.visible=false;
  try{
    const view=await mapLoader.ensure(next,MAPS[next].spawn);if(token!==epoch||disposed)return;
    mapLoader.keep(next);map=next;if(DAY_PLACES[map]&&!view.markers){view.markers=createPlaceMarkers(map);view.root.add(view.markers);}if(view.markers)view.markers.visible=!!snapshot.showcase;view.root.visible=true;for(const o of view.stream?.roots()||[])o.visible=true;
    position={...MAPS[map].spawn};avatar.root.position.set(position.x,floorHeight(map,position),position.z);avatar.root.visible=true;
    span=CORE_SPACES[map]||DAY_PLACES[map]?14:map==='garden'?12:11;spaceStyle=map==='dayHome'?snapshot.homeStyle||'warm':'';resize();place.hidden=!!DAY_PLACES[map];place.textContent=CORE_SPACES[map]?.label||DAY_PLACES[map]?.label||(map==='garden'?'街边 · 借用庭院场景':map==='hall'?'案边 · 借用公共厅场景':'住处 · 借用小屋场景');
    yaw=0;target=destination(snapshot.presentation);walkTarget=0;dwell=0;
    if(initial&&snapshot.presentation.action==='sleep'&&walkable(target.x,target.z,map)){position={...target};route=[];}else go(target);
    if(snapshot.presentation.action==='walk'&&!route.length)wander();
    if(snapshot.follow)center();else overview();tell('');
  }catch(e){if(token===epoch)tell('画面加载失败：'+e.message);}finally{if(token===epoch){changing=false;cover.classList.remove('on');}}
}
function apply(data){
  if(!ready){pending=data;return;}
  if(!data)return;snapshot=data;if(mapLoader.views[map]?.markers)mapLoader.views[map].markers.visible=!!data.showcase;
  const newLook=JSON.stringify([data.charId,data.ta,data.look]);if(newLook!==lookKey){avatar.setLook(seatLook('companion',data.look,data.ta),true);lookKey=newLook;}
  const next=JSON.stringify([data.charId,data.key,data.presentation,data.homeStyle]);
  if(next===signature)return;signature=next;const token=++epoch;route=[];onArrive=null;seat=bed=null;dwell=0;
  const needed=data.presentation.map;
  if(map==='dayHome'&&needed===map&&spaceStyle!==(data.homeStyle||'warm')){mapLoader.keep(null);enter(needed,token);}
  else if(map&&map!==needed&&!changing){
    target={...MAPS[map].spawn};go(target,()=>enter(needed,token));
    if(!route.length&&!changing)enter(needed,token);
  }else if(!map||changing)enter(needed,token,!map);
  else{target=destination(data.presentation);go(target);}
}
function wander(){
  const base=MAPS[map].spawn,candidates=MAPS[map].wander||[{x:base.x+2.4,z:base.z+1.4},{x:base.x-2,z:base.z+.8},base];
  for(let i=0;i<candidates.length;i++){
    const to=candidates[walkTarget++%candidates.length];
    if(Math.hypot(position.x-to.x,position.z-to.z)<.5||!walkable(to.x,to.z,map))continue;
    const next=findPath(position,to,map);if(!next?.length)continue;
    route=next;speed=0;onArrive=null;target={...to};return;
  }
}
function tick(dt,time){
  if(!ready||!map||changing||!avatar.root.visible)return;
  const moving=route.length>0;
  if(moving){
    const step=stepRoute(position,route,dt,{speed,walkSpeed:1.6,clear:(a,b)=>segmentClear(a,b,map)});position=step.position;speed=step.speed;if(step.heading!=null)yaw=step.heading;
    if(!route.length){dwell=0;const done=onArrive;onArrive=null;done?.();}
  }else dwell+=dt;
  if(!moving&&CORE_SPACES[map]&&!snapshot.presentation.spot)yaw=activitySpot(MAPS[map],snapshot.presentation.action)?.heading||0;
  const pose=activityPose(snapshot.presentation,dwell,{hasSlot:!!snapshot.slot,seated:!!seat});
  if(!moving&&snapshot.presentation.spot){const spot=(DAY_PLACES[map]||CORE_SPACES[map])?.spots.find(s=>s.id===snapshot.presentation.spot);if(spot)yaw=spot.heading||0;}
  avatar.root.position.set(position.x,0,position.z);avatar.root.rotation.y=yaw;
  if(!moving&&bed){avatar.animate(time,{sleepPose:bed});}
  else if(!moving&&seat){avatar.root.position.set(seat.x,0,seat.z);avatar.root.rotation.y=seat.heading||0;avatar.animate(time,{...pose,seated:true,height:floorHeight(map,seat)+(seat.rise||0)+.05});}
  else avatar.animate(time,{...pose,moving,gesture:moving?'rest':pose.gesture,emotion:moving?null:pose.emotion,height:floorHeight(map,position)});
  if(!moving&&snapshot.slot&&snapshot.presentation.action==='walk'&&dwell>1.5){dwell=0;wander();}
  if(following){const focal=bed||(!moving&&seat)||position;pan.x+=(focal.x-pan.x)*Math.min(1,dt*6);pan.z+=(focal.z-pan.z)*Math.min(1,dt*6);cameraPose();}
  if(map==='garden')mapLoader.views[map]?.stream?.update(pan,Math.max(7,span/camera.zoom));
  const minute=snapshot.minute,night=minute<360||minute>=1200;hemi.intensity=night?1.15:2.2;sun.intensity=night?1.2:3;
}
let last=performance.now();function loop(t){if(disposed)return;const dt=Math.min(.05,(t-last)/1000);last=t;if(!document.hidden){tick(dt,t/1000);renderer.render(scene,camera);}frame=requestAnimationFrame(loop);}
function appearanceTextures(){const urls=[];avatar?.root.traverse(o=>{const src=o.material?.map?.image?.src;if(src&&/\/faces\//.test(src))urls.push(src);});return [...new Set(urls)];}
function chinContact(){const head=avatar?.root.getObjectByName('HeadAnchor'),hand=avatar?.root.getObjectByName('Right_hand');return head&&hand?head.worldToLocal(hand.getWorldPosition(new T.Vector3())).toArray():null;}
window.CharDayScene={setSnapshot:apply,listPlaces:placeList,listStyles:()=>Object.entries(SPACE_STYLES).map(([id,p])=>({id,label:p.label,colors:[p.wall,p.wood,p.fabric]})),focus:center,overview,inspect:()=>({ready,map,spaceStyle,spot:snapshot?.presentation.spot,avatarPosition:avatar?.root.position.toArray(),furnitureNodes:mapLoader.views[map]?.root.children.filter(o=>o.userData.furnitureId).map(o=>o.name),layout:mapLoader.views[map]?.root.userData.layout,seat:seat?{...seat}:null,error:failure,bed:bed?{...bed}:null,visible:avatar?.root.visible,visualTilt:avatar?.root.getObjectByName('TravelerVisual')?.rotation.x,position:{...position},route:route.map(p=>({...p})),gesture:avatar?.root.userData.posture,emotion:avatar?.root.userData.emotion,dailyAction:avatar?.root.userData.dailyAction,arm:avatar?.root.getObjectByName('rightArm')?.quaternion.toArray(),chinContact:chinContact(),following,key:snapshot?.key,charId:snapshot?.charId,changing,look:lookKey,markersVisible:!!mapLoader.views[map]?.markers?.visible,faceTextures:appearanceTextures(),render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles}})};
addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);for(const v of Object.values(mapLoader.views)){v.stream?.close();disposeMap(v.root);}if(avatar)disposeMap(avatar.root);draco.dispose();renderer.dispose();});
resize();frame=requestAnimationFrame(loop);
try{avatar=createTraveler(await loadTravelerSource(),true);scene.add(avatar.root);await avatar.ready();ready=true;tell('');if(pending)apply(pending);}catch(e){tell('画面加载失败：'+e.message);}
