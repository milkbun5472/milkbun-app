import * as T from 'three';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=fg-bc35c5341d4847ae';
import {DRACOLoader} from '../vendor/DRACOLoader.js?v=fg-bc35c5341d4847ae';
import {createTraveler,loadTravelerSource,setFaceBase} from '../traveler.mjs?v=fg-bc35c5341d4847ae';
import {seatLook} from '../wardrobe.mjs?v=fg-bc35c5341d4847ae';
import {MAPS,findPath,floorHeight,walkable,segmentClear,seatsOf,areaSpots,sleepPose} from '../world.mjs?v=fg-bc35c5341d4847ae';
import {createMapLoader,disposeMap} from '../map-loader.mjs?v=fg-bc35c5341d4847ae';
import {stepRoute} from '../locomotion.mjs?v=fg-bc35c5341d4847ae';
import {createMapGesture,orthographicPanDelta,orthographicCameraPose} from '../view-controls.mjs?v=fg-bc35c5341d4847ae';
import {updateWorkScene} from './work-scene.mjs?v=fg-bc35c5341d4847ae';
import {activityPhase,taskAt} from './workflow.mjs?v=fg-bc35c5341d4847ae';
import {activityPose} from './activity.mjs?v=fg-bc35c5341d4847ae';
import {DAY_PLACES,DAY_FACTORIES,registerDayPlaces,placeList,createPlaceMarkers} from './places/index.mjs?v=fg-bc35c5341d4847ae';
registerDayPlaces(MAPS);
import {CORE_SPACES,SPACE_STYLES,registerCoreSpaces,activitySpot,styleOf} from './spaces.mjs?v=fg-bc35c5341d4847ae';
import {createSpaceView} from './space-view.mjs?v=fg-bc35c5341d4847ae';
import {setHomeClock} from './home-shell.mjs?v=fg-bc35c5341d4847ae';
import {PROFESSIONAL_OPTIONS,professionalOptions} from './professional.mjs?v=fg-bc35c5341d4847ae';
import {createTogether} from './together.mjs?v=fg-bc35c5341d4847ae';
import {HAIR_STYLES} from '../traveler.mjs?v=fg-bc35c5341d4847ae';
import {OUTFITS,HAIR_MODES,dyesOf,outfitColors,outfitId,hairId,mergeLook} from '../wardrobe.mjs?v=fg-bc35c5341d4847ae';
import {createHomeVisit} from './visit.mjs?v=fg-bc35c5341d4847ae';
import {MOTION_STYLES,motionProfile} from './motion-profile.mjs?v=fg-bc35c5341d4847ae';
let hostMotion=null,guestMotion=null,motionKey='';
registerCoreSpaces(MAPS);
import {homePlacements,homeFurniture,restoreHomeLayout,checkHomeLayout,changeHomeFurniture,addHomeFurniture,changeHomeRoom} from './home-layout.mjs?v=fg-bc35c5341d4847ae';
import {HOME_CATALOG,HOME_CATEGORIES,HOME_COLORS,HOME_MATERIALS,HOME_WALLS,HOME_FLOORS,usesFor,furniturePrimary} from './home-catalog.mjs?v=fg-bc35c5341d4847ae';
setFaceBase(new URL('../../companion/faces/',import.meta.url).href);

const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,alpha:false}),camera=new T.OrthographicCamera(-8,8,8,-8,.1,100);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#e4dece');document.body.prepend(renderer.domElement);
const hemi=new T.HemisphereLight('#fff4dd','#958267',2.2);scene.add(hemi);
const sun=new T.DirectionalLight('#fff4de',3);sun.position.set(-8,16,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:65});sun.shadow.normalBias=.035;scene.add(sun);
const fill=new T.DirectionalLight('#d4e5ee',1);fill.position.set(8,6,-9);scene.add(fill);
const draco=new DRACOLoader();draco.setDecoderPath(new URL('../vendor/draco/',import.meta.url).href);const loader=new GLTFLoader();loader.setDRACOLoader(draco);
const cover=document.querySelector('#cover'),place=document.querySelector('#place'),pan={x:0,z:0};
let activity=null,taskState=null;
let visitor=null,visitorAvatar=null,visitorReady=null,travelerSource=null,visitLoading=false,visitEpoch=0,together=null,helloUntil=0,visitorLookKey='';
function visitNotice(info){if(parent!==window)parent.postMessage({type:'char-day-visit',charId:snapshot?.charId,...info},location.origin);}
function closeVisit(notice=''){together?.stop(notice);helloUntil=0;visitEpoch++;visitLoading=false;visitor?.close(notice);if(!visitor)visitNotice({present:false,busy:false,notice});}
function prepareVisitor(){
 if(!visitorReady)visitorReady=(async()=>{
  visitorAvatar=createTraveler(travelerSource,false);visitorAvatar.root.visible=false;scene.add(visitorAvatar.root);await visitorAvatar.ready();
  visitor=createHomeVisit({avatar:visitorAvatar,ta:()=>({x:avatar.root.position.x,z:avatar.root.position.z,seat:route.length?null:seat}),motion:()=>guestMotion,onChange:visitNotice,choice:snapshot?.visitorData?.activityChoice});
  together=createTogether({a:avatar,b:visitorAvatar,motion:()=>({a:hostMotion,b:guestMotion}),map:()=>MAPS.dayHome,from:()=>({a:{...position},b:visitor.inspect().position}),onUpdate:info=>{if(info)visitor.control(info);},onStop:info=>{visitor.release(info);position={...info.a};seat=null;bed=null;target=destination(activity);go(target);}});
 })().catch(e=>{if(visitorAvatar){disposeMap(visitorAvatar.root);visitorAvatar.root.removeFromParent();}visitorAvatar=null;visitorReady=null;throw e;});
 return visitorReady;
}
async function joinVisit(){
 if(!ready||changing||route.length||map!=='dayHome'||snapshot.editing||snapshot.showcase||snapshot.preview||snapshot.presentation.action==='walk'){visitNotice({present:false,busy:false,notice:'等TA在家走到位置后，再进小屋。'});return false;}
 if(visitor?.inspect().present||visitLoading)return false;
 const token=++visitEpoch;visitLoading=true;visitNotice({present:false,busy:true,notice:'正在准备你的小人…'});
 try{
  await prepareVisitor();
  if(token!==visitEpoch||disposed)return false;
  visitorAvatar.setLook(seatLook('me',snapshot?.visitorLook||{},'她'),true);visitorLookKey=JSON.stringify(snapshot?.visitorLook||{});await visitorAvatar.ready();
  if(token!==visitEpoch||disposed)return false;
  visitLoading=false;visitor.join();helloUntil=performance.now()/1000+5;center();return true;
 }catch(e){if(token===visitEpoch){visitLoading=false;visitNotice({present:false,busy:false,notice:'你的小人还没准备好，可以再试一次。'});}return false;}
}
let avatar=null,ready=false,disposed=false,map=null,snapshot=null,pending=null,signature='',lookKey='',epoch=0,route=[],position={x:0,z:0},speed=0,yaw=0,target=null,seat=null,bed=null,walkTarget=0,dwell=0,onArrive=null,following=true,span=10,frame=0,changing=false,failure='',spaceStyle='',homeKey='',homeInput='',homeRecord=homePlacements(),selected='',drag=null,lastEditNotice='',homeOverview=false;
const editorPointers=new Map(),history=[];
const selection=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#88a773',transparent:true,opacity:.35,depthWrite:false,depthTest:false,side:T.DoubleSide}));selection.rotation.x=-Math.PI/2;selection.visible=false;selection.renderOrder=10;scene.add(selection);
const tell=error=>{failure=error||'';if(parent!==window)parent.postMessage({type:'char-day-status',error},location.origin);};
const mapLoader=createMapLoader({maps:MAPS,loadAsset:async asset=>{const url=new URL('../'+asset.replace(/^\.\//,''),import.meta.url).href,root=(await loader.loadAsync(url)).scene;root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});return root;},factories:{...Object.fromEntries(Object.entries(DAY_FACTORIES).map(([id,factory])=>[id,()=>factory(professionalOptions(snapshot?.professional,id))])),...Object.fromEntries(Object.keys(CORE_SPACES).map(id=>[id,()=>createSpaceView(id,id==='dayHome'?snapshot?.homeStyle:'warm',MAPS[id])]))},attach:o=>scene.add(o),detach:o=>scene.remove(o)});
function cameraPose(){const p=orthographicCameraPose(pan,span,camera.zoom,0);camera.position.set(p.position.x,p.position.y,p.position.z);camera.lookAt(p.target.x,p.target.y,p.target.z);camera.far=p.far;camera.updateProjectionMatrix();camera.updateMatrixWorld();}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;cameraPose();if(homeOverview&&map==='dayHome')overview();}
function setFollowing(value){if(following===value)return;following=value;if(parent!==window)parent.postMessage({type:'char-day-view',following},location.origin);}
function visitFocus(focal){const v=visitor?.inspect();if(!v?.present)return focal;const at=v.seat||v.position;return {x:(focal.x+at.x)/2,z:(focal.z+at.z)/2};}
function center(){setFollowing(true);const focal=visitFocus(bed||(!route.length&&seat)||position);pan.x=focal.x;pan.z=focal.z;gesture.setZoom(1.6);cameraPose();}
function overview(){
 setFollowing(false);pan.x=MAPS[map]?.view?.x||0;pan.z=MAPS[map]?.view?.z||0;
 const home=map==='dayHome'&&mapLoader.views[map]?.root;
 if(home){gesture.setZoom(1);const bounds=new T.Box3().setFromObject(home);let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const a of [bounds.min.x,bounds.max.x])for(const b of [bounds.min.y,bounds.max.y])for(const c of [bounds.min.z,bounds.max.z]){const v=new T.Vector3(a,b,c).project(camera);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
  // Leave space for the existing current-schedule card and scene captions.
  const top=Math.min(125,innerHeight*.36)+8,bottom=Math.min(60,innerHeight*.22),zoom=Math.min(1.5,1.88/(maxX-minX),2*(innerHeight-top-bottom)/innerHeight/(maxY-minY));
  const e=camera.matrixWorld.elements,rightX=e[0],rightZ=e[2],upX=e[4],upZ=e[6],det=rightX*upZ-rightZ*upX;
  const dx=(minX+maxX)/2*(camera.right-camera.left)/2,dy=(((minY+maxY)/2)*zoom-(bottom-top)/innerHeight)*(camera.top-camera.bottom)/(2*zoom);
  pan.x+=(dx*upZ-dy*rightZ)/det;pan.z+=(rightX*dy-upX*dx)/det;gesture.setZoom(zoom);homeOverview=true;
 }else gesture.setZoom(CORE_SPACES[map]?Math.min(.75,innerWidth/innerHeight*span/(MAPS[map].bounds.w+MAPS[map].bounds.d)*1.13):DAY_PLACES[map]?Math.min(.85,innerWidth/innerHeight*.77):map==='garden'?.65:.62);cameraPose();
}
const gesture=createMapGesture({initial:1.6,min:.2,onZoom:v=>{homeOverview=false;camera.zoom=v;cameraPose();},onPan:(dx,dy)=>{
  homeOverview=false;
  setFollowing(false);const a=new T.Raycaster(),b=new T.Raycaster();a.setFromCamera(new T.Vector2(0,0),camera);b.setFromCamera(new T.Vector2(dx/innerWidth*2,-dy/innerHeight*2),camera);
  const q=orthographicPanDelta(a.ray.origin,b.ray.origin,a.ray.direction);if(q){pan.x=Math.max(-50,Math.min(50,pan.x+q.x));pan.z=Math.max(-50,Math.min(50,pan.z+q.z));cameraPose();}
},onTap:(x,y)=>{if(snapshot?.editing)selectFurniture('');else if(visitor?.inspect().present){const point=groundPoint(x,y);if(point)visitAction('walk',{x:point.x,z:point.z});}else center();}});
const canvas=renderer.domElement;
function editorNotice(notice){
 if(notice!==undefined)lastEditNotice=notice;
 if(parent!==window)parent.postMessage({type:'char-day-layout',placements:homePlacements(snapshot?.homePlacements),selected,notice:lastEditNotice,dragging:!!drag,busy:changing},location.origin);
}
function selectedPiece(){return homeFurniture(snapshot?.homePlacements).find(p=>p.id===selected);}
function markSelection(candidate=selectedPiece(),valid=true){selection.visible=!!snapshot?.editing&&!!candidate&&!candidate.stored;if(!selection.visible)return;selection.position.set(candidate.x,.12,candidate.z);selection.rotation.z=-(candidate.heading||0);selection.scale.set(candidate.w+.14,candidate.d+.14,1);selection.material.color.set(valid?'#88a773':'#cb6e60');}
function selectFurniture(id){selected=homeFurniture(snapshot?.homePlacements).some(p=>p.id===id)?id:'';markSelection();editorNotice();}
function groundPoint(x,y){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.08),new T.Vector3());}
function projectGround(point){const v=new T.Vector3(point.x,floorHeight(map,point),point.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}
function projectFurniture(id,point){const p=point||homeFurniture(snapshot?.homePlacements).find(p=>p.id===id);if(!p)return null;const v=new T.Vector3(p.x,.5,p.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}
function hitFurniture(x,y){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);const root=mapLoader.views.dayHome?.root;if(!root)return '';for(const hit of ray.intersectObjects(root.children,true)){let o=hit.object;while(o&&o!==root){if(o.userData.furnitureId)return o.userData.furnitureId;o=o.parent;}}const near=homeFurniture(snapshot?.homePlacements).filter(p=>!p.stored).map(p=>{const q=projectFurniture(p.id);return {id:p.id,d:Math.hypot(q.x-x,q.y-y)};}).sort((a,b)=>a.d-b.d)[0];return near?.d<=22?near.id:'';}
function cancelDrag(notify=true){if(!drag)return;const p=selectedPiece(),node=mapLoader.views.dayHome?.root.children.find(o=>o.userData.furnitureId===selected);if(node&&p)node.position.set(p.x,node.position.y,p.z);drag=null;markSelection();if(notify)editorNotice();}
function commitEdit(result){if(!snapshot?.editing||changing||drag)return false;if(!result.ok){editorNotice(result.reason);return false;}if(result.selected)selected=result.selected;history.push(homePlacements(snapshot.homePlacements));if(history.length>30)history.shift();apply({...snapshot,homePlacements:result.placements},true);editorNotice(result.notice||'摆好了，记得保存。');return true;}
function editAction(action){if(!snapshot?.editing||changing||drag)return false;if(action==='undo'){const previous=history.pop();if(!previous){editorNotice('还没有需要撤销的摆放。');return false;}apply({...snapshot,homePlacements:previous},true);editorNotice('已撤销上一次摆放。');return true;}return commitEdit(changeHomeFurniture(snapshot.homePlacements,selected,action));}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;editorPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId);}catch{}
 if(snapshot?.editing&&editorPointers.size===1&&!changing){const id=hitFurniture(e.clientX,e.clientY),point=groundPoint(e.clientX,e.clientY);if(id&&point){selectFurniture(id);const p=selectedPiece();drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,offsetX:p.x-point.x,offsetZ:p.z-point.z,candidate:{...p},moved:false};editorNotice();return;}}
 if(editorPointers.size>1){cancelDrag();gesture.cancel();for(const [id,p]of editorPointers)gesture.down(id,p.x,p.y);}else gesture.down(e.pointerId,e.clientX,e.clientY);
});
canvas.addEventListener('pointermove',e=>{
 if(editorPointers.has(e.pointerId))editorPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(drag?.id===e.pointerId){const q=groundPoint(e.clientX,e.clientY);if(!q)return;drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;if(!drag.moved)return;const p={...selectedPiece(),x:Math.round((q.x+drag.offsetX)*10)/10,z:Math.round((q.z+drag.offsetZ)*10)/10};drag.candidate=p;const node=mapLoader.views.dayHome?.root.children.find(o=>o.userData.furnitureId===selected);if(node)node.position.set(p.x,node.position.y,p.z);const candidate=homePlacements(snapshot.homePlacements);candidate[selected]={...candidate[selected],x:p.x,z:p.z};markSelection(p,checkHomeLayout(candidate,{routes:false}).ok);return;}
 gesture.move(e.pointerId,e.clientX,e.clientY);
});
function pointerEnd(e,cancel=false){editorPointers.delete(e.pointerId);if(drag?.id===e.pointerId){const d=drag;cancelDrag(false);if(!cancel&&d.moved)commitEdit(changeHomeFurniture(snapshot.homePlacements,selected,d.candidate));else editorNotice();return;}gesture.up(e.pointerId,e.clientX,e.clientY,cancel);}
canvas.addEventListener('pointerup',e=>pointerEnd(e));
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointerEnd(e,true));
canvas.addEventListener('wheel',e=>{e.preventDefault();gesture.setZoom(gesture.getZoom()*Math.exp(-Math.max(-240,Math.min(240,e.deltaY))*.002));},{passive:false});
addEventListener('resize',resize);addEventListener('blur',()=>{cancelDrag();editorPointers.clear();gesture.cancel();});

function availableSeat(kind){return Object.values(seatsOf(map)).find(s=>s.piece?.includes(':'+kind+':'))||Object.values(seatsOf(map))[0];}
function destination(p){
  seat=null;bed=null;
  if(p.spot){const spot=(DAY_PLACES[map]||MAPS[map])?.spots.find(s=>s.id===p.spot);if(spot){seat=spot.seat||null;if(spot.sleep)bed=sleepPose({map,position:MAPS[map].spawn,companion:{map,position:spot.target},sleep:{companion:spot.id}},'companion');yaw=spot.heading||0;return {...spot.target};}}
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
function companionAvoid(){const v=visitor?.inspect();if(!v?.present)return [];const p=v.seat||v.position;return [{x:p.x,z:p.z,r:Math.min(.74,Math.hypot(position.x-p.x,position.z-p.z)*.85)}];}
function go(to,done){
  route=findPath(position,to,map,companionAvoid())||[];speed=0;onArrive=done||null;
  if(!route.length&&Math.hypot(position.x-to.x,position.z-to.z)<.3){const fn=onArrive;onArrive=null;fn?.();}
  else if(!route.length){target={...position};seat=bed=null;onArrive=null;}
}
async function enter(next,token,initial=false,retainView=false){
  changing=true;cover.classList.add('on');avatar.root.visible=false;
  try{
    const view=await mapLoader.ensure(next,MAPS[next].spawn);if(token!==epoch||disposed)return;
    mapLoader.keep(next);map=next;if(DAY_PLACES[map])view.root.userData.professional=professionalOptions(snapshot.professional,map);if(DAY_PLACES[map]&&!view.markers){view.markers=createPlaceMarkers(map);view.root.add(view.markers);}if(view.markers)view.markers.visible=!!snapshot.showcase;view.root.visible=true;for(const o of view.stream?.roots()||[])o.visible=true;
    if(next==='dayHome')setHomeClock(view.root,snapshot.minute);
    const shadowSize=next==='dayHome'?2048:1024,shadowExtent=next==='dayHome'?12:18;
    if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadowSize,shadowSize);}
    Object.assign(sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=next==='dayHome'?.015:.035;
    position={...MAPS[map].spawn};avatar.root.position.set(position.x,floorHeight(map,position),position.z);avatar.root.visible=!snapshot.editing;
    span=CORE_SPACES[map]||DAY_PLACES[map]?14:map==='garden'?12:11;spaceStyle=map==='dayHome'?snapshot.homeStyle||'warm':'';resize();place.hidden=!!DAY_PLACES[map];place.textContent=CORE_SPACES[map]?.label||DAY_PLACES[map]?.label||(map==='garden'?'街边 · 借用庭院场景':map==='hall'?'案边 · 借用公共厅场景':'住处 · 借用小屋场景');
    yaw=0;target=destination(activity);walkTarget=0;dwell=0;
    if(snapshot.editing){route=[];seat=bed=null;markSelection();}
    else if(initial&&snapshot.presentation.action==='sleep'&&walkable(target.x,target.z,map)){position={...target};route=[];}else go(target);
    if(snapshot.presentation.action==='walk'&&!route.length)wander();
    if(!retainView){if(snapshot.follow)center();else overview();}tell('');markSelection();if(snapshot.editing)editorNotice();
  }catch(e){if(token===epoch)tell('画面加载失败：'+e.message);}finally{if(token===epoch){changing=false;cover.classList.remove('on');if(snapshot.editing)editorNotice();}}
}
function apply(data,local=false){
  if(!ready){pending=data;return;}
  if(!data)return;const wasEditing=snapshot?.editing,wasVisitorPreview=snapshot?.visitorPreview;
  // During an edit session this scene owns the draft. Host clock pulses only
  // mirror it; an older pulse cannot replace a just-released furniture drag.
  if(wasEditing&&data.editing&&!local&&data.charId===snapshot.charId)data={...data,homePlacements:snapshot.homePlacements};
  snapshot={...data};
  const acting=JSON.stringify([data.charId,data.persona,data.motionStyle,data.visitorData]);
  if(acting!==motionKey){motionKey=acting;hostMotion=motionProfile({id:data.charId+':ta',persona:data.persona,style:data.motionStyle});guestMotion=motionProfile({id:(data.visitorData?.id||'__me')+':me',persona:data.visitorData?.persona,style:data.visitorData?.motionStyle});}
  const input=JSON.stringify(data.homePlacements||{});
  if(input!==homeInput)homeRecord=restoreHomeLayout(data.homePlacements);
  homeInput=input;snapshot.homePlacements=homeRecord;
  const nextHome=JSON.stringify(homeRecord),layoutChanged=nextHome!==homeKey;
  if(layoutChanged){MAPS.dayHome=checkHomeLayout(homeRecord).map;homeKey=nextHome;}
  if(data.editing&&!wasEditing){history.length=0;selected='double-bed';lastEditNotice='';}
  if(data.editing&&selected&&!Object.hasOwn(homeRecord,selected))selected='';
  if(!data.editing&&wasEditing){cancelDrag();history.length=0;selection.visible=false;}
  if(mapLoader.views[map]?.markers)mapLoader.views[map].markers.visible=!!data.showcase;
  const newLook=JSON.stringify([data.charId,data.ta,data.look]);if(newLook!==lookKey){avatar.setLook(seatLook('companion',data.look,data.ta),true);lookKey=newLook;}
  activity=activityPhase(data.presentation,data.slot,data.at,{preview:data.preview||data.showcase||data.editing});
  const next=JSON.stringify([data.charId,data.key,activity,data.homeStyle,nextHome,data.editing,data.professional]);
  if(visitorAvatar&&JSON.stringify(data.visitorLook||{})!==visitorLookKey){visitorLookKey=JSON.stringify(data.visitorLook||{});visitorAvatar.setLook(seatLook('me',data.visitorLook||{},'她'),true);}
  if(data.visitorPreview){prepareVisitor().then(()=>{
   if(!snapshot?.visitorPreview)return;
   if(!visitor.inspect().present){visitorAvatar.setLook(seatLook('me',snapshot.visitorLook||{},'她'),true);visitorAvatar.root.visible=true;visitorAvatar.root.position.set(0,.08,3.2);}
   const v=visitor.inspect(),at=v.present?(v.seat||v.position):{x:0,z:3.2};pan.x=at.x;pan.z=at.z;setFollowing(false);gesture.setZoom(2.5);cameraPose();
   const projected=groundPoint(innerWidth/2,innerHeight*.30);if(projected){pan.x+=at.x-projected.x;pan.z+=at.z-projected.z;cameraPose();}
  }).catch(()=>{});}else if(visitorAvatar&&!visitor?.inspect().present)visitorAvatar.root.visible=false;
  if(wasVisitorPreview&&!data.visitorPreview)center();
  if(next===signature)return;signature=next;
  if(visitor?.inspect().present||visitLoading)closeVisit('TA的安排或小家布置变了，已回到跟随查看。');
  if(parent!==window)parent.postMessage({type:'char-day-activity',charId:data.charId,key:data.key,phase:activity.phase,label:activity.motion||activity.phase!=='work'?activity.phaseLabel:'',spotLabel:DAY_PLACES[activity.map]?.spots.find(s=>s.id===activity.spot)?.label||''},location.origin);const token=++epoch;route=[];onArrive=null;seat=bed=null;dwell=0;
  const needed=data.presentation.map;
  if(DAY_PLACES[map]&&map===needed&&JSON.stringify(mapLoader.views[map]?.root.userData.professional||{})!==JSON.stringify(professionalOptions(data.professional,map))){mapLoader.keep(null);enter(needed,token);return;}
  if(data.editing&&map!==needed){enter(needed,token);}
  else if(map==='dayHome'&&needed===map&&(spaceStyle!==(data.homeStyle||'warm')||layoutChanged||!!wasEditing!==!!data.editing)){mapLoader.keep(null);enter(needed,token,false,!!wasEditing&&!!data.editing);}
  else if(map&&map!==needed&&!changing){
    target={...MAPS[map].spawn};go(target,()=>enter(needed,token));
    if(!route.length&&!changing)enter(needed,token);
  }else if(!map||changing)enter(needed,token,!map);
  else{target=destination(activity);go(target);}
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
  if(map==='dayHome')setHomeClock(mapLoader.views[map]?.root,snapshot?.minute);
  if(snapshot?.visitorPreview&&visitorAvatar&&!visitor?.inspect().present){visitorAvatar.animate(time,{height:.08});}
  if(!ready||!map||changing||snapshot?.editing||!avatar.root.visible)return;
  if(together?.inspect()){together.tick(dt,time);if(together.inspect()){taskState=together.inspect()?.aTask;updateWorkScene(mapLoader.views[map]?.root,taskState,false,time);if(following){const s=together.inspect(),aa=s.seats?.a||s.a,bb=s.seats?.b||s.b;pan.x+=( (aa.x+bb.x)/2-pan.x)*Math.min(1,dt*6);pan.z+=((aa.z+bb.z)/2-pan.z)*Math.min(1,dt*6);cameraPose();}return;}}
  const moving=route.length>0;
  if(moving){
    const step=stepRoute(position,route,dt,{speed,walkSpeed:1.6*(hostMotion?.walk||1),clear:(a,b)=>segmentClear(a,b,map,companionAvoid())});position=step.position;speed=step.speed;if(step.heading!=null)yaw=step.heading;
    if(!route.length){dwell=0;const done=onArrive;onArrive=null;done?.();}
  }else dwell+=dt;
  if(!moving&&CORE_SPACES[map]&&!snapshot.presentation.spot)yaw=activitySpot(MAPS[map],snapshot.presentation.action)?.heading||0;
  const spot=(DAY_PLACES[map]||MAPS[map])?.spots.find(s=>s.id===activity?.spot);
  const stage=spot&&DAY_PLACES[map]?{...activity,action:spot.action,gesture:spot.gesture}:CORE_SPACES[map]&&snapshot.presentation.action!=='work'&&!MAPS[map].spots.some(s=>s.action===snapshot.presentation.action)?{action:'rest',gesture:'rest'}:activity;
  const pose=activityPose(stage,dwell,{hasSlot:!!snapshot.slot,seated:!!seat});
  if(!moving&&spot)yaw=spot.heading||0;
  // During departure the avatar still walks through the previous room.
  taskState=activity?.map===map?taskAt(stage,spot,MAPS[map],dwell,{moving,position,heading:yaw,motion:hostMotion}):null;
  const equipment=professionalOptions(snapshot?.professional,map);if((['piano','guitar'].includes(taskState?.kind)&&equipment.instruments===false)||(['experiment','observe'].includes(taskState?.kind)&&equipment.equipment==='none')||(['paint','craft'].includes(taskState?.kind)&&equipment.materials==='none')){taskState=null;pose.gesture='rest';pose.emotion=null;}
  if(taskState){if(taskState.daily)pose.gesture={read:'read',drink:'tea',eat:'eat',cook:'stir'}[taskState.kind];else if(taskState.kind!=='read')pose.gesture='rest';pose.emotion=null;}
  if(['enter','exit','break'].includes(stage.phase)&&!moving){pose.gesture='rest';pose.emotion=null;}
  avatar.root.position.set(position.x,0,position.z);avatar.root.rotation.y=yaw;
  if(!moving&&bed){avatar.animate(time,{sleepPose:bed});}
  else if(!moving&&seat){avatar.root.position.set(seat.x,0,seat.z);avatar.root.rotation.y=seat.heading||0;avatar.animate(time,{...pose,task:taskState,motion:hostMotion,seated:true,height:floorHeight(map,seat)+(seat.rise||0)+.05});}
  else avatar.animate(time,{...pose,task:taskState,motion:hostMotion,moving,gesture:moving?'rest':pose.gesture,emotion:moving?null:pose.emotion,height:floorHeight(map,position)});
  if(!moving&&snapshot.slot&&snapshot.presentation.action==='walk'&&dwell>1.5){dwell=0;wander();}
  if(time<helloUntil&&!moving&&!bed){const v=visitor?.inspect();if(v?.present){avatar.root.rotation.y=Math.atan2(v.position.x-avatar.root.position.x,v.position.z-avatar.root.position.z);taskState=null;avatar.animate(time,{seated:!!seat,height:floorHeight(map,seat||position)+(seat?seat.rise+.05:0),gesture:'wave',progress:(time-(helloUntil-5))/5});}}
  updateWorkScene(mapLoader.views[map]?.root,taskState,moving,time);
  if(map==='dayHome')visitor?.tick(dt,time);
  if(following&&!snapshot?.visitorPreview){const focal=visitFocus(bed||(!moving&&seat)||position);pan.x+=(focal.x-pan.x)*Math.min(1,dt*6);pan.z+=(focal.z-pan.z)*Math.min(1,dt*6);cameraPose();}
  if(map==='garden')mapLoader.views[map]?.stream?.update(pan,Math.max(7,span/camera.zoom));
  const minute=snapshot.minute,night=minute<360||minute>=1200;hemi.intensity=night?1.15:2.2;sun.intensity=night?1.2:3;
}
function previewVisitor(time){
 if(!snapshot?.visitorPreview||!visitorAvatar?.root.visible)return;const v=visitor?.inspect(),at=v?.present?(v.seat||v.position):{x:0,z:3.2},seated=v?.present&&v.seat;visitorAvatar.root.position.set(at.x,0,at.z);visitorAvatar.root.rotation.y=Math.atan2(camera.position.x-at.x,camera.position.z-at.z);visitorAvatar.animate(time,{seated:!!seated,height:floorHeight(map,at)+(seated?seated.rise+.05:0),gesture:'rest'});
}
let last=performance.now();function loop(t){if(disposed)return;const dt=Math.min(.05,(t-last)/1000);last=t;if(!document.hidden){tick(dt,t/1000);previewVisitor(t/1000);renderer.render(scene,camera);}frame=requestAnimationFrame(loop);}
function appearanceTextures(){const urls=[];avatar?.root.traverse(o=>{const src=o.material?.map?.image?.src;if(src&&/\/faces\//.test(src))urls.push(src);});return [...new Set(urls)];}
function chinContact(){const head=avatar?.root.getObjectByName('HeadAnchor'),hand=avatar?.root.getObjectByName('Right_hand');return head&&hand?head.worldToLocal(hand.getWorldPosition(new T.Vector3())).toArray():null;}
let catalogCache=null;
function listCatalog(){
 if(catalogCache)return catalogCache;
 const target=new T.WebGLRenderTarget(160,160);target.texture.colorSpace=T.SRGBColorSpace;
 const previous=renderer.getRenderTarget(),previewScene=new T.Scene(),previewCamera=new T.OrthographicCamera(-2,2,2,-2,.1,50);
 previewScene.background=new T.Color('#f2ecde');previewScene.add(new T.HemisphereLight('#fff4dd','#958267',2.2));const light=new T.DirectionalLight('#fff4de',3);light.position.set(-4,8,5);previewScene.add(light);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=160;const ctx=canvas.getContext('2d'),pixels=new Uint8Array(160*160*4);
 try{catalogCache=HOME_CATALOG.map(p=>{
  const view=createSpaceView('dayHome','warm',{...CORE_SPACES.dayHome,furniture:[{...p,catalogId:p.id,x:0,z:0,heading:0}],structure:[]},{furnitureOnly:true});previewScene.add(view.root);
  const bounds=new T.Box3().setFromObject(view.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.y,size.z)*.85+.35;
  Object.assign(previewCamera,{left:-span,right:span,top:span,bottom:-span});previewCamera.position.copy(center).add(new T.Vector3(5,4,6));previewCamera.lookAt(center);previewCamera.updateProjectionMatrix();
  try{renderer.setRenderTarget(target);renderer.render(previewScene,previewCamera);renderer.readRenderTargetPixels(target,0,0,160,160,pixels);const data=ctx.createImageData(160,160);for(let y=0;y<160;y++)data.data.set(pixels.subarray((159-y)*640,(160-y)*640),y*640);ctx.putImageData(data,0,0);return {...p,thumbnail:canvas.toDataURL('image/png')};}
  finally{previewScene.remove(view.root);disposeMap(view.root);}
 });return catalogCache;}finally{renderer.setRenderTarget(previous);target.dispose();renderer.render(scene,camera);}
}
function visitAction(kind,point){
 if(kind==='end'){return together?.stop();}
 const shared=kind.startsWith('together:');if(shared)kind=kind.slice(9);
 if(shared||['hand','hug','shoulder','meal','cook'].includes(kind)){
  visitor?.act('manual');
  if(!visitor?.inspect().present||map!=='dayHome'||route.length||bed||changing){visitNotice({...visitor?.inspect(),notice:bed?'TA在睡觉，先安静陪一会儿。':'等TA走到位置后再互动。'});return false;}
  const result=together.start(kind);if(!result.ok)visitNotice({...visitor.inspect(),notice:result.reason});else center();return result.ok;
 }
 together?.stop();const ok=visitor?.act(kind,point)||false;if(ok&&kind!=='leave')center();return ok;
}
function visitorWardrobe(){const look=seatLook('me',snapshot?.visitorLook||{},'她');return {getDyes:()=>dyesOf(look),getOutfit:()=>({id:outfitId(look),colors:outfitColors(look)}),getHair:()=>hairId(look.hair),hairModes:HAIR_MODES};}
const listFurniture=()=>homeFurniture(snapshot?.homePlacements).map(p=>({...p,primary:furniturePrimary(p,styleOf(snapshot?.homeStyle)).color,actions:usesFor(p),inUse:usesFor(p).some(action=>MAPS.dayHome.spots.find(s=>s.id===action)?.piece===p.id)}));
window.CharDayScene={professionalChoices:()=>PROFESSIONAL_OPTIONS,joinVisit,visitAction,visitorWardrobe,mergeVisitorLook:(patch,old)=>mergeLook(old||snapshot?.visitorLook||{},patch),setSnapshot:apply,listPlaces:placeList,listFurniture,listCatalog,decorationOptions:()=>({categories:HOME_CATEGORIES,colors:HOME_COLORS,materials:HOME_MATERIALS,walls:HOME_WALLS,floors:HOME_FLOORS}),addFurniture:id=>commitEdit(addHomeFurniture(snapshot?.homePlacements,id)),editRoom:change=>commitEdit(changeHomeRoom(snapshot?.homePlacements,change)),selectFurniture,editAction,editMove:(id,point)=>{selectFurniture(id);return commitEdit(changeHomeFurniture(snapshot?.homePlacements,id,point));},editLayout:()=>drag||changing?{ok:false,reason:'等家具放稳后再保存。'}:checkHomeLayout(snapshot?.homePlacements),projectGround,projectFurniture,listMotions:()=>Object.entries(MOTION_STYLES).map(([id,p])=>({id,label:p.label,description:p.description})),listStyles:()=>Object.entries(SPACE_STYLES).map(([id,p])=>({id,label:p.label,colors:[p.wall,p.wood,p.fabric]})),focus:center,overview,probeAction:()=>{const hand=avatar?.root.getObjectByName('Right_hand'),head=avatar?.root.getObjectByName('HeadAnchor'),tool=avatar?.root.getObjectByName(taskState?.kind==='write'?'WorkPencil':taskState?.kind==='paint'?'WorkBrush':'WorkPipette');return {leftHand:avatar?.root.getObjectByName('Left_hand')?.getWorldPosition(new T.Vector3()).toArray(),luggage:avatar?.root.getObjectByName('WorkSuitcase')?.getWorldPosition(new T.Vector3()).toArray(),luggageGrip:avatar?.root.getObjectByName('SuitcaseGrip')?.getWorldPosition(new T.Vector3()).toArray(),leftHeadHand:(()=>{const left=avatar?.root.getObjectByName('Left_hand');return head&&left?head.worldToLocal(left.getWorldPosition(new T.Vector3())).toArray():null;})(),bones:['rightArm','rightForearm'].map(n=>avatar?.root.getObjectByName(n)?.getWorldPosition(new T.Vector3()).toArray()),hand:hand?.getWorldPosition(new T.Vector3()).toArray(),headHand:head&&hand?head.worldToLocal(hand.getWorldPosition(new T.Vector3())).toArray():null,tool:tool?.getWorldPosition(new T.Vector3()).toArray(),task:taskState};},inspect:()=>({motion:hostMotion,visitorMotion:guestMotion,professional:mapLoader.views[map]?.root.userData.professional,contacts:{ta:avatar?.root.userData.contacts,me:visitorAvatar?.root.userData.contacts},together:together?.inspect(),visitorLook:snapshot?.visitorLook||{},visitor:visitor?.inspect()||{present:false,visible:false},visitLoading,ready,map,spaceStyle,editing:!!snapshot?.editing,selected,dragging:!!drag,dragPreview:drag?.candidate,editHistory:history.length,homePlacements:homePlacements(snapshot?.homePlacements),spot:snapshot?.presentation.spot,activity:activity?{...activity}:null,task:taskState,workAction:avatar?.root.userData.workAction,avatarPosition:avatar?.root.position.toArray(),avatarHeading:avatar?.root.rotation.y,visualPosition:avatar?.root.getObjectByName('TravelerVisual')?.getWorldPosition(new T.Vector3()).toArray(),furnitureNodes:mapLoader.views[map]?.root.children.filter(o=>o.userData.furnitureId).map(o=>o.name),layout:mapLoader.views[map]?.root.userData.layout,finishes:mapLoader.views[map]?.root.children.filter(g=>g.userData.furnitureId).map(g=>({id:g.name,finish:g.userData.finish,primary:g.userData.primary,materials:g.children.filter(o=>o.isMesh).map(o=>({color:'#'+o.material.color.getHexString(),roughness:o.material.roughness,metalness:o.material.metalness,textured:!!o.material.map}))})),seat:seat?{...seat}:null,error:failure,bed:bed?{...bed}:null,visible:avatar?.root.visible,visualTilt:avatar?.root.getObjectByName('TravelerVisual')?.rotation.x,position:{...position},route:route.map(p=>({...p})),gesture:avatar?.root.userData.posture,emotion:avatar?.root.userData.emotion,dailyAction:avatar?.root.userData.dailyAction,arm:avatar?.root.getObjectByName('rightArm')?.quaternion.toArray(),chinContact:chinContact(),following,key:snapshot?.key,charId:snapshot?.charId,changing,look:lookKey,markersVisible:!!mapLoader.views[map]?.markers?.visible,faceTextures:appearanceTextures(),sceneAction:mapLoader.views[map]?.root.userData.sceneAction,render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,zoom:camera.zoom,homeOverview}})};
addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);for(const v of Object.values(mapLoader.views)){v.stream?.close();disposeMap(v.root);}closeVisit();if(visitorAvatar)disposeMap(visitorAvatar.root);if(avatar)disposeMap(avatar.root);selection.geometry.dispose();selection.material.dispose();draco.dispose();renderer.dispose();});
resize();frame=requestAnimationFrame(loop);
try{travelerSource=await loadTravelerSource();avatar=createTraveler(travelerSource,true);scene.add(avatar.root);await avatar.ready();ready=true;tell('');visitNotice({present:false,busy:false,notice:''});if(pending)apply(pending);}catch(e){tell('画面加载失败：'+e.message);}
