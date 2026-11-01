import {createRoomCutaway} from './camera-view.mjs?v=fg-90b53e2779ab7a1c';
import {createKitchenStation} from './board-station.mjs?v=fg-90b53e2779ab7a1c';
const boardStation=createKitchenStation();let kitchenStation='';
import './kitchen.js?v=fg-90b53e2779ab7a1c';
import {createLunchCarry} from './lunch-carry.mjs?v=fg-90b53e2779ab7a1c';
import {createKitchenView} from './kitchen-view.mjs?v=fg-90b53e2779ab7a1c';
const kitchenView=createKitchenView({actors:()=>[avatar,visitorAvatar]});
import {QUALITY_LEVELS,sceneLoad,createQualityMonitor} from './quality.mjs?v=fg-90b53e2779ab7a1c';
import {createDayEnvironment} from './environment-view.mjs?v=fg-90b53e2779ab7a1c';
import {HOME_SIZES,HOME_MOUNT_WALLS,wallFurniturePosition} from './home-architecture.mjs?v=fg-90b53e2779ab7a1c';
import * as T from 'three';
import {GLTFLoader} from '../vendor/GLTFLoader.js?v=fg-90b53e2779ab7a1c';
import {DRACOLoader} from '../vendor/DRACOLoader.js?v=fg-90b53e2779ab7a1c';
import {createTraveler,loadTravelerSource,setFaceBase} from '../traveler.mjs?v=fg-90b53e2779ab7a1c';
import {renderPhoto,visibleBounds} from '../photo-render.mjs?v=fg-90b53e2779ab7a1c';
import {createWardrobe,seatLook} from '../wardrobe.mjs?v=fg-90b53e2779ab7a1c';
import {MAPS,findPath,floorHeight,walkable,segmentClear,seatsOf,areaSpots,sleepPose} from '../world.mjs?v=fg-90b53e2779ab7a1c';
import {createMapLoader,disposeMap} from '../map-loader.mjs?v=fg-90b53e2779ab7a1c';
import {stepRoute} from '../locomotion.mjs?v=fg-90b53e2779ab7a1c';
import {createMapGesture,orthographicPanDelta,orthographicCameraPose,orthographicFrame,createMapOrbit,orthographicGroundOffset} from '../view-controls.mjs?v=fg-90b53e2779ab7a1c';
import {updateWorkScene} from './work-scene.mjs?v=fg-90b53e2779ab7a1c';
import {activityPhase,taskAt} from './workflow.mjs?v=fg-90b53e2779ab7a1c';
import {activityPose} from './activity.mjs?v=fg-90b53e2779ab7a1c';
import {DAY_PLACES,DAY_FACTORIES,registerDayPlaces,placeList,createPlaceMarkers} from './places/index.mjs?v=fg-90b53e2779ab7a1c';
registerDayPlaces(MAPS);
import {CORE_SPACES,SPACE_STYLES,registerCoreSpaces,activitySpot,styleOf} from './spaces.mjs?v=fg-90b53e2779ab7a1c';
import {createSpaceView} from './space-view.mjs?v=fg-90b53e2779ab7a1c';
import {setHomeClock} from './home-shell.mjs?v=fg-90b53e2779ab7a1c';
import {PROFESSIONAL_OPTIONS,PROFESSIONAL_STYLES,professionalOptions} from './professional.mjs?v=fg-90b53e2779ab7a1c';
import {createTogether} from './together.mjs?v=fg-90b53e2779ab7a1c';
import {HAIR_STYLES} from '../traveler.mjs?v=fg-90b53e2779ab7a1c';
import {OUTFITS,HAIR_MODES,dyesOf,outfitColors,outfitId,hairId,mergeLook} from '../wardrobe.mjs?v=fg-90b53e2779ab7a1c';
import {CHORES,chorePlans,choreIntent,chorePose} from './chores.mjs?v=fg-90b53e2779ab7a1c';
import {createChoreVisual} from './chore-visual.mjs?v=fg-90b53e2779ab7a1c';
import {createSceneVisit} from './visit.mjs?v=fg-90b53e2779ab7a1c';
import {createAutoInteraction,canTravelTogether} from './social-flow.mjs?v=fg-90b53e2779ab7a1c';
import {createDateTransfer} from './date-transfer.mjs?v=fg-90b53e2779ab7a1c';
import {MOTION_STYLES,PAIR_STYLES,motionProfile,pairProfile} from './motion-profile.mjs?v=fg-90b53e2779ab7a1c';
let hostMotion=null,guestMotion=null,hostPair=null,guestPair=null,motionKey='';
const autoInteraction=createAutoInteraction();let transfer=null,arrival=null;
registerCoreSpaces(MAPS);
import {homePlacements,homeFurniture,restoreHomeLayout,checkHomeLayout,changeHomeFurniture,addHomeFurniture,changeHomeRoom} from './home-layout.mjs?v=fg-90b53e2779ab7a1c';
import {HOME_CATALOG,HOME_CATEGORIES,HOME_COLLECTIONS,HOME_COLORS,HOME_MATERIALS,HOME_WALLS,HOME_FLOORS,usesFor,furniturePrimary} from './home-catalog.mjs?v=fg-90b53e2779ab7a1c';
setFaceBase(new URL('../../companion/faces/',import.meta.url).href);

const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,alpha:false}),camera=new T.OrthographicCamera(-8,8,8,-8,.1,100);
const lunchCarry=createLunchCarry(scene);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#e4dece');document.body.prepend(renderer.domElement);
const hemi=new T.HemisphereLight('#fff4dd','#958267',2.2);scene.add(hemi);
const sun=new T.DirectionalLight('#fff4de',3);sun.position.set(-8,16,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:65});sun.shadow.normalBias=.035;scene.add(sun);
const qualityMonitor=createQualityMonitor();let qualityLevel='high';
const fill=new T.DirectionalLight('#d4e5ee',1);fill.position.set(8,6,-9);scene.add(fill);
const dayEnvironment=createDayEnvironment({scene,renderer,hemi,sun,fill});
function applyQuality(level,force=false){
 if(!force&&level===qualityLevel)return;qualityLevel=level;const quality=QUALITY_LEVELS[level];
 renderer.setPixelRatio(Math.min(devicePixelRatio,quality.pixelRatio));
 const size=map==='dayHome'?quality.homeShadow:quality.shadow;
 if(sun.shadow.mapSize.x!==size){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(size,size);}
 const root=mapLoader.views[map]?.root;root?.traverse(o=>{if(!o.isMesh||o.material?.isShaderMaterial)return;if(o.userData.dayOriginalShadow==null)o.userData.dayOriginalShadow=o.castShadow;
  if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();const b=o.geometry.boundingBox,small=b&&Math.max(b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z)<.4;
  o.castShadow=o.userData.dayOriginalShadow&&(quality.smallShadows||!small);
 });dayEnvironment.setQuality(quality);resize();
}

const draco=new DRACOLoader();draco.setDecoderPath(new URL('../vendor/draco/',import.meta.url).href);const loader=new GLTFLoader();loader.setDRACOLoader(draco);
const cover=document.querySelector('#cover'),place=document.querySelector('#place'),pan={x:0,z:0};
const orbit=createMapOrbit(),orbitPivot=new T.Vector3(0,.5,0),cutaway=createRoomCutaway(T);
const social=globalThis.CharDaySocial;
let hostChore=null,hostChoreVisual=null,hostChoreManual=false;
let activity=null,taskState=null,homeAutoSuppressed=false,autoJoinFailed=false;
const freeOuting=()=>social.outing(snapshot);
const soloOuting=()=>freeOuting()?.mode==='solo';
const visitSetting=()=>snapshot?.presentation?.map===map?social.setting(snapshot):null;
let visitor=null,visitorAvatar=null,visitorReady=null,travelerSource=null,visitLoading=false,visitEpoch=0,together=null,helloUntil=0,visitorLookKey='';
function visitNotice(info){if(parent!==window)parent.postMessage({type:'char-day-visit',charId:snapshot?.charId,outing:freeOuting()?{...freeOuting()}:null,...info},location.origin);}
function closeVisit(notice=''){arrival=null;transfer?.cancel();autoInteraction.reset();together?.stop(notice);helloUntil=0;visitEpoch++;visitLoading=false;visitor?.close(notice);if(!visitor)visitNotice({present:false,busy:false,notice});}
function planVisibility(plan){
 const view=mapLoader.views[map]?.root;if(!view)return 0;
 const ray=new T.Raycaster(),direction=camera.getWorldDirection(new T.Vector3()).negate();ray.camera=camera;ray.far=4;let penalty=0;
 for(const who of ['a','b'])for(const height of plan.kind==='dance'?[.08,.65]:[.65]){const at=plan.seats?.[who]||plan[who];ray.set(new T.Vector3(at.x,(at.rise||0)+height,at.z),direction);const hit=ray.intersectObject(view,true).find(p=>p.distance<4&&p.object.visible&&p.object.isMesh);if(hit)penalty+=35;}
 return penalty;
}
function prepareVisitor(){
 if(!visitorReady)visitorReady=(async()=>{
  visitorAvatar=createTraveler(travelerSource,false);visitorAvatar.root.visible=false;scene.add(visitorAvatar.root);await visitorAvatar.ready();
  visitor=createSceneVisit({avatar:visitorAvatar,choreVisual:createChoreVisual(visitorAvatar),ta:()=>soloOuting()?null:({x:avatar.root.position.x,z:avatar.root.position.z,seat,heading:yaw,moving:!!route.length&&!seat&&!bed,walkSpeed:1.6*(hostMotion?.walk||1),action:hostChore?null:activity?.action}),following:()=>!!visitSetting()&&!visitSetting().home&&!soloOuting(),motion:()=>guestMotion,onChange:visitNotice,choice:snapshot?.visitorData?.activityChoice,map:()=>MAPS[map]||MAPS.dayHome});
  together=createTogether({a:avatar,b:visitorAvatar,kitchen:()=>({job:currentKitchenJob(),elapsed:kitchenProgress?.elapsed||0,progress:kitchenProgress?.progress,tools:kitchenView.tabletop()?.root||kitchenView.stationObjects('pan',globalThis.CharDayKitchen.cookingSpec(currentKitchenJob())).root}),onKitchenMoment:moment=>{const job=currentKitchenJob();if(job?.cooking&&job.id===moment.jobId){kitchenProgress.progress=globalThis.CharDayKitchen.stepCooking(job,kitchenProgress.progress,{kind:'moment',value:moment.kind,id:moment.id,ingredient:moment.ingredient});updateKitchen(0);}},visibility:planVisibility,pair:()=>({a:hostPair,b:guestPair}),motion:()=>({a:hostMotion,b:guestMotion}),map:()=>MAPS[map],from:()=>({a:{...position,heading:yaw,seat:!route.length?seat:null,bed:!route.length?bed:null},b:{...visitor.inspect().position,heading:visitor.inspect().heading,seat:visitor.inspect().seat,bed:visitor.inspect().bed}}),onUpdate:info=>{if(info){visitor.control(info);if(info.notice&&parent!==window)parent.postMessage({type:'char-day-kitchen-notice',charId:snapshot?.charId,notice:info.notice},location.origin);}},onStop:info=>{visitor.release(info);position={...info.a};if(info.preserveHost&&(info.seats?.a||info.beds?.a)){seat=info.seats?.a||null;bed=info.beds?.a||null;route=[];onArrive=null;}else{seat=null;bed=null;target=destination(activity);go(target);}}});
  transfer=createDateTransfer({a:avatar,b:visitorAvatar,map:()=>MAPS[map],from:()=>({a:{...position},b:visitor.inspect().position}),motion:()=>({a:hostMotion,b:guestMotion}),
   onUpdate:info=>visitor.control({...info,automatic:true}),
   onCancel:info=>{position={...info.a};visitor.release({b:info.b,reason:info.reason});},
   onDone:info=>{const next=arrival;position={...info.a};visitor.close();enter(info.destination,epoch).then(async()=>{if(!next||next!==arrival||map!==info.destination||!visitSetting())return;arrival=null;await joinVisit({arrival:true,restore:info.choice});});}});
 })().catch(e=>{if(visitorAvatar){disposeMap(visitorAvatar.root);visitorAvatar.root.removeFromParent();}visitorAvatar=null;visitorReady=null;throw e;});
 return visitorReady;
}
async function joinVisit({automatic=false,arrival:arriving=false,restore=null}={}){
 if(!ready||changing||!visitSetting()){visitNotice({present:false,busy:false,notice:'等TA到可以一起活动的地点，再走进来。'});return false;}
 if(visitor?.inspect().present||visitLoading)return false;
 const token=++visitEpoch,placeId=map;visitLoading=true;visitNotice({present:false,busy:true,notice:'正在准备你的小人…'});
 try{
  await prepareVisitor();
  if(token!==visitEpoch||disposed||map!==placeId||!visitSetting())return false;
  visitorAvatar.setLook(seatLook('me',snapshot?.visitorLook||{},'她'),true);visitorLookKey=JSON.stringify(snapshot?.visitorLook||{});await visitorAvatar.ready();
  if(token!==visitEpoch||disposed||map!==placeId||!visitSetting())return false;
  visitLoading=false;const solo=soloOuting(),joined=visitor.join({automatic:automatic&&!solo,arrival:arriving,restore:solo?{control:'manual',manualAction:'manual'}:freeOuting()?{control:'auto',manualAction:'manual'}:!automatic&&!arriving&&!visitSetting().home?{control:'auto',manualAction:'manual'}:restore});if(!joined){autoJoinFailed=automatic;return false;}homeAutoSuppressed=false;helloUntil=automatic||solo?0:performance.now()/1000+5;if(following)setCameraMode(solo?'me':'both');return true;
 }catch(e){if(token===visitEpoch){visitLoading=false;autoJoinFailed=automatic;visitNotice({present:false,busy:false,notice:'你的小人还没准备好，可以再试一次。'});}return false;}
}
let avatar=null,ready=false,disposed=false,map=null,snapshot=null,pending=null,signature='',lookKey='',epoch=0,route=[],position={x:0,z:0},speed=0,yaw=0,target=null,seat=null,bed=null,walkTarget=0,dwell=0,onArrive=null,following=true,span=10,frame=0,changing=false,failure='',spaceStyle='',homeKey='',homeInput='',homeRecord=homePlacements(),selected='',drag=null,lastEditNotice='',homeOverview=false;
let cameraMode='ta',framing=false,kitchenProgress=null,kitchenDrag=null,mealReturn=false,tabletopCamera=null;
const editorPointers=new Map(),history=[];
// The outing is temporary view state. Retain the real scene progress separately
// so returning cannot replay its entrance or overwrite the schedule.
let editResume=null,scheduledResume=null;
const selection=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:'#88a773',transparent:true,opacity:.35,depthWrite:false,depthTest:false,side:T.DoubleSide}));selection.rotation.x=-Math.PI/2;selection.visible=false;selection.renderOrder=10;scene.add(selection);
const tell=error=>{failure=error||'';if(parent!==window)parent.postMessage({type:'char-day-status',error},location.origin);};
const mapLoader=createMapLoader({maps:MAPS,loadAsset:async asset=>{const url=new URL('../'+asset.replace(/^\.\//,''),import.meta.url).href,root=(await loader.loadAsync(url)).scene;root.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;}});return root;},factories:{...Object.fromEntries(Object.entries(DAY_FACTORIES).map(([id,factory])=>[id,()=>factory(professionalOptions(snapshot?.professional,id,snapshot?.persona))])),...Object.fromEntries(Object.keys(CORE_SPACES).map(id=>[id,()=>createSpaceView(id,id==='dayHome'?snapshot?.homeStyle:'warm',MAPS[id])]))},attach:o=>scene.add(o),detach:o=>scene.remove(o)});
function cameraPose(){
 if(tabletopCamera){const h=tabletopCamera.heading;camera.position.set(pan.x+Math.sin(h)*9,23,pan.z+Math.cos(h)*9);camera.lookAt(pan.x,1.1,pan.z);camera.far=130;}
 else{const p=orthographicCameraPose(pan,span,camera.zoom,0,orbit.snapshot());camera.position.set(p.position.x,p.position.y,p.position.z);camera.lookAt(p.target.x,p.target.y,p.target.z);camera.far=p.far;}
 camera.updateProjectionMatrix();camera.updateMatrixWorld();cutaway.update(mapLoader.views[map]?.root,MAPS[map]?.bounds,{x:camera.position.x-pan.x,z:camera.position.z-pan.z});
}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.top=span/2;camera.bottom=-span/2;cameraPose();if(homeOverview&&map==='dayHome')overview();else if(tabletopCamera)focusKitchen();else if(ready)trackCamera(1);}
function setFollowing(value,mode=value?'ta':'free'){const changed=following!==value||cameraMode!==mode;following=value;cameraMode=mode;if(changed&&parent!==window)parent.postMessage({type:'char-day-view',following,mode:cameraMode},location.origin);}
function projectedBounds(box,view=camera){let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const a of [box.min.x,box.max.x])for(const b of [box.min.y,box.max.y])for(const c of [box.min.z,box.max.z]){const v=new T.Vector3(a,b,c).project(view);minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);}
 return {minX,maxX,minY,maxY};
}
function frameBox(box,insets,maxZoom=2.2,smooth=1){cameraPose();const e=camera.matrixWorld.elements,fit=orthographicFrame({...projectedBounds(box),zoom:camera.zoom,halfWidth:(camera.right-camera.left)/2,halfHeight:span/2,width:innerWidth,height:innerHeight,rightX:e[0],rightZ:e[2],upX:e[4],upZ:e[6],insets,maxZoom});if(!fit)return;
 pan.x+=fit.x*smooth;pan.z+=fit.z*smooth;framing=true;gesture.setZoom(camera.zoom+(fit.zoom-camera.zoom)*smooth);framing=false;cameraPose();
}
function actorBounds(who){const v=visitor?.inspect(),roots=who==='me'&&v?.present?[visitorAvatar?.root]:who==='both'&&v?.present?[avatar?.root,visitorAvatar?.root]:[avatar?.root],box=visibleBounds(T,roots);return box.isEmpty()?null:box.expandByScalar(.12);}
function trackCamera(smooth=1){if(!following||snapshot?.visitorPreview||snapshot?.editing)return;if(['me','both'].includes(cameraMode)&&!visitor?.inspect().present&&!soloOuting())setFollowing(true,'ta');const box=actorBounds(cameraMode);if(box){orbitPivot.copy(box.getCenter(new T.Vector3()));frameBox(box,snapshot?.viewInsets||{top:130,bottom:30,left:18,right:18},cameraMode==='both'?5:5.5,smooth);}}
function setCameraMode(mode){tabletopCamera=null;if(mode==='overview'){overview();return true;}if(!['ta','me','both'].includes(mode))return false;if(soloOuting()&&mode!=='me')return false;if(mode!=='ta'&&!visitor?.inspect().present)return false;homeOverview=false;setFollowing(true,mode);trackCamera();return true;}
function center(){return setCameraMode(soloOuting()?'me':'ta');}
function overview(){
 tabletopCamera=null;orbit.reset();
 setFollowing(false,'overview');pan.x=MAPS[map]?.view?.x||0;pan.z=MAPS[map]?.view?.z||0;
 const room=mapLoader.views[map]?.root;if(room)orbitPivot.copy(new T.Box3().setFromObject(room).getCenter(new T.Vector3()));
 const home=map==='dayHome'&&room;
 if(home){framing=true;gesture.setZoom(1);framing=false;frameBox(new T.Box3().setFromObject(home),snapshot?.viewInsets||{top:133,bottom:60,left:12,right:12},1.5);homeOverview=true;}
 else{framing=true;gesture.setZoom(CORE_SPACES[map]?Math.min(.75,innerWidth/innerHeight*span/(MAPS[map].bounds.w+MAPS[map].bounds.d)*1.13):DAY_PLACES[map]?Math.min(.85,innerWidth/innerHeight*.77):map==='garden'?.65:.62);framing=false;}cameraPose();
}
const gesture=createMapGesture({initial:1.6,min:.2,max:8,onRotate:(dx,dy)=>{const before=orbitPivot.clone().project(camera);tabletopCamera=null;homeOverview=false;setFollowing(false,'free');orbit.rotate(dx,dy);cameraPose();const after=orbitPivot.clone().project(camera),e=camera.matrixWorld.elements,delta=orthographicGroundOffset((after.x-before.x)*(camera.right-camera.left)/2/camera.zoom,(after.y-before.y)*span/2/camera.zoom,e[0],e[2],e[4],e[6]);if(delta){pan.x+=delta.x;pan.z+=delta.z;cameraPose();}},onZoom:v=>{homeOverview=false;if(!framing)setFollowing(false,'free');camera.zoom=v;cameraPose();},onPan:(dx,dy)=>{
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
function markSelection(candidate=selectedPiece(),valid=true){selection.visible=!!snapshot?.editing&&!!candidate&&!candidate.stored;if(!selection.visible)return;if(candidate.mount){const front=candidate.d/2+.018;selection.position.set(candidate.x+(candidate.wall==='left'?front:0),candidate.y,candidate.z+(candidate.wall==='back'?front:0));selection.rotation.set(0,candidate.heading,0);selection.scale.set(candidate.w+.08,candidate.height+.08,1);}else{selection.position.set(candidate.x,.12,candidate.z);selection.rotation.set(-Math.PI/2,0,-(candidate.heading||0));selection.scale.set(candidate.w+.14,candidate.d+.14,1);}selection.material.color.set(valid?'#88a773':'#cb6e60');}
function selectFurniture(id){selected=homeFurniture(snapshot?.homePlacements).some(p=>p.id===id)?id:'';markSelection();editorNotice();}
function groundPoint(x,y){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-.08),new T.Vector3());}
function piecePoint(x,y,p){if(!p?.mount)return groundPoint(x,y);const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);return ray.ray.intersectPlane(p.wall==='left'?new T.Plane(new T.Vector3(1,0,0),-p.x):new T.Plane(new T.Vector3(0,0,1),-p.z),new T.Vector3());}
function projectGround(point){const v=new T.Vector3(point.x,floorHeight(map,point),point.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}
function projectFurniture(id,point){const p=point||homeFurniture(snapshot?.homePlacements).find(p=>p.id===id);if(!p)return null;const v=new T.Vector3(p.x,p.mount?p.y:.5,p.z).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}
function hitFurniture(x,y){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);const root=mapLoader.views.dayHome?.root;if(!root)return '';for(const hit of ray.intersectObjects(root.children,true)){let o=hit.object;while(o&&o!==root){if(o.userData.furnitureId)return o.userData.furnitureId;o=o.parent;}}const near=homeFurniture(snapshot?.homePlacements).filter(p=>!p.stored).map(p=>{const q=projectFurniture(p.id);return {id:p.id,d:Math.hypot(q.x-x,q.y-y)};}).sort((a,b)=>a.d-b.d)[0];return near?.d<=22?near.id:'';}
function cancelDrag(notify=true){if(!drag)return;const p=selectedPiece(),node=mapLoader.views.dayHome?.root.children.find(o=>o.userData.furnitureId===selected);if(node&&p)node.position.set(p.x,p.mount?p.y:node.position.y,p.z);drag=null;markSelection();if(notify)editorNotice();}
function commitEdit(result){if(!snapshot?.editing||changing||drag)return false;if(!result.ok){editorNotice(result.reason);return false;}if(result.selected)selected=result.selected;history.push(homePlacements(snapshot.homePlacements));if(history.length>30)history.shift();apply({...snapshot,homePlacements:result.placements},true);editorNotice(result.notice||'摆好了，记得保存。');return true;}
function editAction(action){if(!snapshot?.editing||changing||drag)return false;if(action==='undo'){const previous=history.pop();if(!previous){editorNotice('还没有需要撤销的摆放。');return false;}apply({...snapshot,homePlacements:previous},true);editorNotice('已撤销上一次摆放。');return true;}return commitEdit(changeHomeFurniture(snapshot.homePlacements,selected,action));}
canvas.addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'&&e.button!==0)return;editorPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});try{canvas.setPointerCapture(e.pointerId);}catch{}
 if(!snapshot?.editing&&editorPointers.size===1&&!kitchenProgress?.preview){const hit=kitchenStation?boardStation.hit(e.clientX,e.clientY):hitKitchen(e.clientX,e.clientY);if(hit){kitchenDrag={id:e.pointerId,target:typeof hit==='string'?hit:null,tag:typeof hit==='object'?hit:null,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,distance:0,worked:false,path:[],point:null};if(kitchenStation){kitchenDrag.station=kitchenStation;const p=boardStation.point(e.clientX,e.clientY);if(p){kitchenDrag.path.push(p);kitchenDrag.point=p;}}return;}}
 if(kitchenStation){if(editorPointers.size>1)kitchenDrag=null;return;}
 if(snapshot?.editing&&editorPointers.size===1&&!changing){const id=hitFurniture(e.clientX,e.clientY),p=homeFurniture(snapshot.homePlacements).find(p=>p.id===id),point=piecePoint(e.clientX,e.clientY,p);if(id&&point){selectFurniture(id);drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,offsetX:p.x-point.x,offsetZ:p.z-point.z,offsetY:p.mount?p.y-point.y:0,candidate:{...p},moved:false};editorNotice();return;}}
 if(editorPointers.size>1){kitchenDrag=null;cancelDrag();gesture.cancel();for(const [id,p]of editorPointers)gesture.down(id,p.x,p.y);}else gesture.down(e.pointerId,e.clientX,e.clientY);
});
canvas.addEventListener('pointermove',e=>{
 if(editorPointers.has(e.pointerId))editorPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(kitchenDrag?.id===e.pointerId){const d=kitchenDrag;if(d.tag){const point=kitchenStation?boardStation.point(e.clientX,e.clientY,d.tag.type==='sauce'?'plate':null):tabletopPointer(e.clientX,e.clientY,d.tag.zone);if(point){d.point=point;d.zone=point.zone;d.path.push(point);if(d.path.length>80)d.path=d.path.filter((_,i)=>i%2===0);}d.distance+=Math.hypot(e.clientX-d.lastX,e.clientY-d.lastY);d.lastX=e.clientX;d.lastY=e.clientY;return;}d.distance+=Math.hypot(e.clientX-d.lastX,e.clientY-d.lastY);d.lastX=e.clientX;d.lastY=e.clientY;if(d.distance>=26){d.worked=true;}return;}
 if(drag?.id===e.pointerId){const piece=selectedPiece(),q=piecePoint(e.clientX,e.clientY,piece);if(!q)return;drag.moved ||= Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5;if(!drag.moved)return;const p=piece.mount?{...piece,along:Math.round((piece.wall==='left'?q.z+drag.offsetZ:q.x+drag.offsetX)*10)/10,y:Math.round((q.y+drag.offsetY)*10)/10}:{...piece,x:Math.round((q.x+drag.offsetX)*10)/10,z:Math.round((q.z+drag.offsetZ)*10)/10};if(p.mount)Object.assign(p,wallFurniturePosition(p,homePlacements(snapshot.homePlacements).$room));drag.candidate=p;const node=mapLoader.views.dayHome?.root.children.find(o=>o.userData.furnitureId===selected);if(node)node.position.set(p.x,p.mount?p.y:node.position.y,p.z);const candidate=homePlacements(snapshot.homePlacements);candidate[selected]={...candidate[selected],x:p.x,z:p.z,...(p.mount?{along:p.along,y:p.y}:{})};markSelection(p,checkHomeLayout(candidate,{routes:false}).ok);return;}
 if(!kitchenStation)gesture.move(e.pointerId,e.clientX,e.clientY);
});
function pointerEnd(e,cancel=false){editorPointers.delete(e.pointerId);if(kitchenDrag?.id===e.pointerId){const d=kitchenDrag;kitchenDrag=null;if(d.tag){if(!cancel){if(d.station)finishStationDrag(d);else if(d.tag.type!=='ingredient'){const value=stationForTag(d.tag);if(value)kitchenInput({kind:'station',value});}else if(d.distance<8)kitchenInput({kind:'station',value:d.tag.zone});else finishTabletopDrag(d);}return;}if(!cancel){kitchenInput({kind:'station',value:d.target==='prep'?'prep':d.target==='serve'?'plate':d.target==='heat'?'heat':'pan'});return;}if(!cancel&&!d.worked)kitchenInput(d.target==='heat'?{kind:'heat',value:((kitchenProgress?.progress?.heat||0)+1)%3}:{kind:'work',target:d.target});return;}if(drag?.id===e.pointerId){const d=drag;cancelDrag(false);if(!cancel&&d.moved)commitEdit(changeHomeFurniture(snapshot.homePlacements,selected,d.candidate));else editorNotice();return;}if(!kitchenStation)gesture.up(e.pointerId,e.clientX,e.clientY,cancel);}
canvas.addEventListener('pointerup',e=>pointerEnd(e));
for(const event of ['pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>pointerEnd(e,true));
canvas.addEventListener('wheel',e=>{e.preventDefault();gesture.setZoom(gesture.getZoom()*Math.exp(-Math.max(-240,Math.min(240,e.deltaY))*.002));},{passive:false});
addEventListener('resize',resize);addEventListener('blur',()=>{kitchenDrag=null;cancelDrag();editorPointers.clear();gesture.cancel();});

function availableSeat(kind){return Object.values(seatsOf(map)).find(s=>s.piece?.includes(':'+kind+':'))||Object.values(seatsOf(map))[0];}
function strolling(){return !!activity?.stroll||activity?.action==='walk'&&activity?.phase!=='break';}
function destination(p){
  seat=null;bed=null;hostChore=null;hostChoreManual=false;hostChoreVisual?.hide();
  if(p.stroll)return {...MAPS[map].spawn};
  if(map==='dayHome'&&CHORES[p.action]?.personal){const spot=MAPS[map].spots.find(s=>s.id===p.spot)||MAPS[map].spots.find(s=>s.action===p.action),v=visitor?.inspect(),plan=spot&&chorePlans(MAPS[map],p.action,position,v?.present?(v.seat||v.position):null,spot.piece)[0];if(plan){hostChore=plan;yaw=plan.heading;return {...plan.at};}}
  if(map==='dayHome'&&p.phase==='work'&&p.action===snapshot?.presentation?.action&&!p.manual&&!snapshot?.editing&&!freeOuting()){const kind=choreIntent(snapshot?.activitySlot||snapshot?.slot),v=visitor?.inspect(),plan=kind&&chorePlans(MAPS[map],kind,position,v?.present?(v.seat||v.position):null)[0];if(plan){hostChore=plan;yaw=plan.heading;return {...plan.at};}}
  if(p.spot){let spot=(DAY_PLACES[map]||MAPS[map])?.spots.find(s=>s.id===p.spot);if(spot&&map==='dayHome'&&globalThis.CharDayHomeHobbies.activities[p.action]&&spot.seat&&visitor?.inspect()?.seat?.piece===spot.piece){const occupied=spot.piece,other=MAPS[map].spots.find(s=>s.action===p.action&&s.piece!==occupied);if(other){spot=other;p.spot=other.id;}else{spot=MAPS[map].spots.find(s=>s.action==='rest');p.phaseLabel='兴趣角有人在用，先歇一会儿。';}}if(spot){seat=p.standing?null:spot.seat||null;if(spot.sleep)bed=sleepPose({map,position:MAPS[map].spawn,companion:{map,position:spot.target},sleep:{companion:spot.id}},'companion');yaw=spot.heading||0;return {...spot.target};}}
  if(CORE_SPACES[map]){
    const spot=activitySpot(MAPS[map],p.action);
    if(spot){seat=p.standing?null:spot.seat||null;if(spot.sleep)bed=sleepPose({map,position:MAPS[map].spawn,companion:{map,position:spot.target},sleep:{companion:spot.id}},'companion');yaw=spot.heading||0;return {...spot.target};}
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
function companionAvoid(){const v=visitor?.inspect();if(!v?.present)return [];const p=v.seat||v.position;return [{x:p.x,z:p.z,r:Math.min(v.following?.42:.74,Math.hypot(position.x-p.x,position.z-p.z)*.85)}];}
function go(to,done){
  route=findPath(position,to,map,companionAvoid())||[];speed=0;onArrive=done||null;
  if(!route.length&&Math.hypot(position.x-to.x,position.z-to.z)<.3){const fn=onArrive;onArrive=null;fn?.();}
  else if(!route.length){target={...position};seat=bed=null;onArrive=null;}
}
function activityKey(){return JSON.stringify([snapshot?.key,activity,!!snapshot?.preview,!!snapshot?.showcase]);}
function pauseState(){
  if(snapshot?.editing)return editResume;
  if(!ready||!map||changing||!snapshot)return null;
  return {charId:snapshot.charId,map,outing:freeOuting()?{...freeOuting()}:null,scheduledResume:freeOuting()?scheduledResume:null,key:activityKey(),position:{...(together?.inspect()?.a||position)},target:target&&{...target},moving:!!route.length||!!together?.inspect()||hostChoreManual,yaw,speed,dwell,walkTarget,interaction:together?.pauseState()||null,view:{orbit:orbit.snapshot(),pivot:orbitPivot.toArray(),pan:{...pan},zoom:camera.zoom,following,cameraMode},visitor:visitor?.pauseState()||null};
}
async function enter(next,token,initial=false,retainView=false,resume=null){
  changing=true;cover.classList.add('on');avatar.root.visible=false;
  try{
    const view=await mapLoader.ensure(next,MAPS[next].spawn);if(token!==epoch||disposed)return;
    mapLoader.keep(next);map=next;if(DAY_PLACES[map])view.root.userData.professional=professionalOptions(snapshot.professional,map,snapshot.persona);if(DAY_PLACES[map]&&!view.markers){view.markers=createPlaceMarkers(map);view.root.add(view.markers);}if(view.markers)view.markers.visible=!!snapshot.showcase;view.root.visible=true;for(const o of view.stream?.roots()||[])o.visible=true;
    if(['dayHome','dayCampus'].includes(next))setHomeClock(view.root,snapshot.minute);
    const shadowSize=next==='dayHome'?QUALITY_LEVELS[qualityLevel].homeShadow:QUALITY_LEVELS[qualityLevel].shadow,shadowExtent=next==='dayHome'?12:18;
    if(sun.shadow.mapSize.x!==shadowSize){sun.shadow.map?.dispose();sun.shadow.map=null;sun.shadow.mapSize.set(shadowSize,shadowSize);}
    applyQuality(qualityMonitor.reset(sceneLoad(view.root)),true);dayEnvironment.bind(MAPS[next],view,QUALITY_LEVELS[qualityLevel]);
    Object.assign(sun.shadow.camera,{left:-shadowExtent,right:shadowExtent,top:shadowExtent,bottom:-shadowExtent});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=next==='dayHome'?.015:.035;
    position=resume&&walkable(resume.position.x,resume.position.z,map)?{...resume.position}:{...MAPS[map].spawn};avatar.root.position.set(position.x,floorHeight(map,position),position.z);avatar.root.visible=!snapshot.editing&&!soloOuting();
    span=CORE_SPACES[map]||DAY_PLACES[map]?14:map==='garden'?12:11;spaceStyle=map==='dayHome'?snapshot.homeStyle||'warm':'';resize();place.hidden=!!DAY_PLACES[map];place.textContent=CORE_SPACES[map]?.label||DAY_PLACES[map]?.label||(map==='garden'?'街边 · 借用庭院场景':map==='hall'?'案边 · 借用公共厅场景':'住处 · 借用小屋场景');
    yaw=0;target=destination(activity);walkTarget=0;dwell=0;
    if(soloOuting()){position={...target};route=[];}
    else if(snapshot.editing){route=[];seat=bed=null;markSelection();}
    else if(resume){
      const same=resume.key===activityKey();
      if(same){yaw=resume.yaw;dwell=resume.dwell;walkTarget=resume.walkTarget;}
      if(same&&strolling()&&resume.target)target={...resume.target};
      // An arrived activity stays at its real anchor, including a moved bed or
      // chair. A paused walk (or new schedule phase) replans from its progress.
      if(same&&!resume.moving&&snapshot.presentation.action!=='walk'&&walkable(target.x,target.z,map)){position={...target};route=[];}
      else{go(target);if(same&&route.length)speed=resume.speed;}
    }
    else if((initial||snapshot.albumShot)&&(snapshot.presentation.action==='sleep'||snapshot.albumShot||!snapshot.preview&&!snapshot.showcase&&snapshot.slot&&Number.isFinite(snapshot.at)&&snapshot.at>snapshot.slot.startAt+30000&&activity.phase!=='enter')&&walkable(target.x,target.z,map)){position={...target};route=[];}else go(target);
    if(strolling()&&!route.length)wander();
    if(resume?.visitor?.present&&visitSetting()&&(freeOuting()||snapshot.visitorData?.homePresence!=='away')){
      await prepareVisitor();if(token!==epoch||disposed)return;
      visitorAvatar.setLook(seatLook('me',snapshot.visitorLook||{},'她'),true);visitorLookKey=JSON.stringify(snapshot.visitorLook||{});await visitorAvatar.ready();
      if(token!==epoch||disposed)return;visitor.restore(resume.visitor);if(resume.interaction&&together.restore(resume.interaction)){route=[];onArrive=null;}
    }
    if(resume?.view&&resume.map===next){const v=resume.view;orbit.restore(v.orbit);if(v.pivot?.length===3&&v.pivot.every(Number.isFinite))orbitPivot.fromArray(v.pivot);if(Number.isFinite(v.pan?.x)&&Number.isFinite(v.pan?.z)){pan.x=v.pan.x;pan.z=v.pan.z;}framing=true;gesture.setZoom(v.zoom);framing=false;setFollowing(!!v.following,v.cameraMode||'free');cameraPose();}else if(!retainView){if(snapshot.follow)setCameraMode(snapshot.cameraMode&&snapshot.cameraMode!=='free'?snapshot.cameraMode:'ta');else overview();}tell('');markSelection();if(snapshot.editing)editorNotice();
  }catch(e){if(token===epoch)tell('画面加载失败：'+e.message);}finally{if(token===epoch){changing=false;
   // Apply the live seat/bed pose before exposing the completed scene. The
   // navigation approach is a floor point, not the avatar's sitting position.
   if(!snapshot.editing&&freeOuting()&&!visitor?.inspect().present&&!homeAutoSuppressed&&!autoJoinFailed&&!snapshot.scenePaused)await joinVisit({automatic:true});
   if(token!==epoch||disposed)return;
   if(!snapshot.editing)tick(0,performance.now()/1000);
   cover.classList.remove('on');if(snapshot.editing)editorNotice();}}
}
function apply(data,local=false){
  if(!ready){pending=data;return;}
  if(!data)return;const previous=snapshot,previousPause=pauseState(),first=!snapshot,wasEditing=snapshot?.editing,wasVisitorPreview=snapshot?.visitorPreview,previousKey=snapshot?.key,previousChar=snapshot?.charId;
  const oldTrip=social.outing(previous),newTrip=social.outing(data),tripChanged=JSON.stringify(oldTrip)!==JSON.stringify(newTrip);
  if(previous?.charId!==data.charId)scheduledResume=null;
  if(first&&newTrip)scheduledResume=data.resume?.scheduledResume||null;
  else if(newTrip&&!oldTrip&&!wasEditing&&previous?.charId===data.charId)scheduledResume=previousPause;
  if(snapshot?.charId!==data.charId||snapshot?.presentation?.map!==data.presentation.map||tripChanged){homeAutoSuppressed=false;autoJoinFailed=false;}
  if(data.editing&&!wasEditing)editResume=first?data.resume:pauseState();
  let resume=!data.editing?(wasEditing?editResume:first?data.resume:null):null;
  if(!data.editing)editResume=null;
  if(scheduledResume&&!newTrip&&!data.editing&&!wasEditing&&!data.preview&&!data.showcase&&previous?.charId===data.charId){resume=scheduledResume;scheduledResume=null;}
  // A scene boundary inside one compound slot yields to an active manual
  // interaction. The next host pulse applies the current stage after it ends.
  const interaction=together?.inspect();
  const manualPositionChange=data.presentation.manual&&(!data.presentation.stageManual||previous?.presentation.stageIndex===data.presentation.stageIndex)&&(!previous?.presentation.manual||previous.presentation.map!==data.presentation.map||previous.presentation.spot!==data.presentation.spot);
  if(previous&&!tripChanged&&!data.editing&&!data.preview&&!data.showcase&&!manualPositionChange&&previousChar===data.charId&&previousKey===data.key&&map!==data.presentation.map&&(hostChoreManual||interaction&&!interaction.automatic)){
    snapshot={...previous,scenePaused:data.scenePaused};return;
  }
  // During an edit session this scene owns the draft. Host clock pulses only
  // mirror it; an older pulse cannot replace a just-released furniture drag.
  if(wasEditing&&data.editing&&!local&&data.charId===snapshot.charId)data={...data,homePlacements:snapshot.homePlacements};
  snapshot={...data};
  if(previous&&previous.charId!==data.charId)visitor?.setChoice(data.visitorData?.activityChoice||'auto');
  if(data.socialPreferences?.autoInteractions===false&&together?.inspect()?.automatic)together.stop('自动小互动已关闭，继续各自活动。');
  if(data.socialPreferences?.followDates===false&&transfer?.inspect()){transfer.cancel('已关闭一起去下一站。');arrival=null;signature='';}
  const acting=JSON.stringify([data.charId,data.persona,data.motionStyle,data.pairStyle,data.visitorData]);
  if(acting!==motionKey){motionKey=acting;hostMotion=motionProfile({id:data.charId+':ta',persona:data.persona,style:data.motionStyle});guestMotion=motionProfile({id:(data.visitorData?.id||'__me')+':me',persona:data.visitorData?.persona,style:data.visitorData?.motionStyle});hostPair=pairProfile(hostMotion,data.persona,data.pairStyle);guestPair=pairProfile(guestMotion,data.visitorData?.persona,data.visitorData?.pairStyle);}
  const input=JSON.stringify(data.homePlacements||{});
  if(input!==homeInput)homeRecord=restoreHomeLayout(data.homePlacements);
  homeInput=input;snapshot.homePlacements=homeRecord;
  const nextHome=JSON.stringify(homeRecord),layoutChanged=nextHome!==homeKey;
  if(!resume&&!data.editing&&previous?.charId===data.charId&&map===data.presentation.map&&map==='dayHome'&&(layoutChanged||spaceStyle!==(data.homeStyle||'warm')))resume=previousPause;
  if(layoutChanged){MAPS.dayHome=checkHomeLayout(homeRecord).map;homeKey=nextHome;}
  if(data.editing&&!wasEditing){history.length=0;selected='double-bed';lastEditNotice='';}
  if(data.editing&&selected&&!Object.hasOwn(homeRecord,selected))selected='';
  if(!data.editing&&wasEditing){cancelDrag();history.length=0;selection.visible=false;}
  if(mapLoader.views[map]?.markers)mapLoader.views[map].markers.visible=!!data.showcase;
  const newLook=JSON.stringify([data.charId,data.ta,data.look]);if(newLook!==lookKey){avatar.setLook(seatLook('companion',data.look,data.ta),true);lookKey=newLook;}
  if(newTrip){
    const space=DAY_PLACES[data.presentation.map]||MAPS[data.presentation.map],rest=space?.spots.find(p=>p.action==='rest'&&p.seat)||space?.spots.find(p=>p.action==='rest');
    activity={...data.presentation,spot:rest?.id,phase:'work',phaseLabel:''};
  }else activity=activityPhase(data.presentation,data.activitySlot||data.slot,data.at,{preview:data.preview||data.showcase||data.editing,space:MAPS[data.presentation.map]});
  const next=JSON.stringify([data.charId,data.key,activity,data.homeStyle,nextHome,data.editing,data.professional,professionalOptions(data.professional,data.presentation.map,data.persona)]);
  if(visitorAvatar&&JSON.stringify(data.visitorLook||{})!==visitorLookKey){visitorLookKey=JSON.stringify(data.visitorLook||{});visitorAvatar.setLook(seatLook('me',data.visitorLook||{},'她'),true);}
  if(data.visitorPreview){prepareVisitor().then(()=>{
   if(!snapshot?.visitorPreview)return;
   if(!visitor.inspect().present){visitorAvatar.setLook(seatLook('me',snapshot.visitorLook||{},'她'),true);visitorAvatar.root.visible=true;visitorAvatar.root.position.set(0,.08,3.2);}
   const v=visitor.inspect(),at=v.present?(v.seat||v.position):{x:0,z:3.2};pan.x=at.x;pan.z=at.z;setFollowing(false);gesture.setZoom(2.5);cameraPose();
   const projected=groundPoint(innerWidth/2,innerHeight*.30);if(projected){pan.x+=at.x-projected.x;pan.z+=at.z-projected.z;cameraPose();}
  }).catch(()=>{});}else if(visitorAvatar&&!visitor?.inspect().present)visitorAvatar.root.visible=false;
  if(wasVisitorPreview&&!data.visitorPreview)center();
  if(transfer?.inspect()&&data.charId===previous?.charId&&data.presentation.map===transfer.inspect().destination&&!data.editing&&!data.preview&&data.socialPreferences?.followDates!==false)return;
  if(next===signature)return;signature=next;
  const carry=!oldTrip&&!newTrip&&canTravelTogether(previous,data,visitor?.inspect(),social);
  const carryChoice=carry?{control:visitor.inspect().control,manualAction:visitor.inspect().manualAction}:null;
  if(transfer?.inspect()||arrival){transfer?.cancel();arrival=null;}
  const keepVisitor=!tripChanged&&visitor?.inspect().present&&visitor.inspect().map===data.presentation.map&&social.setting(data)&&!layoutChanged&&(map!=='dayHome'||spaceStyle===(data.homeStyle||'warm'));
  if(parent!==window)parent.postMessage({type:'char-day-activity',charId:data.charId,key:data.key,stageIndex:activity.stageIndex,phase:activity.phase,groupLabel:activity.groupLabel||'',label:[activity.stageLabel,activity.group||activity.motion||activity.phase!=='work'?activity.phaseLabel:''].filter(Boolean).join(' · '),spotLabel:activity.stroll?'':MAPS[activity.map]?.spots.find(s=>s.id===activity.spot)?.label||''},location.origin);
  // A cosmetic pause inside the same slot yields to the user's interaction.
  // onStop already replans against the latest activity when they finish it.
  if(keepVisitor&&(together?.inspect()||hostChoreManual)&&previousKey===data.key&&previousChar===data.charId&&!manualPositionChange)return;
  if(!carry&&!keepVisitor&&(visitor?.inspect().present||visitLoading))closeVisit(newTrip?'正在前往选择的地点…':'继续看看TA的一天。');
  else if(keepVisitor||carry)together?.stop();
  if(!newTrip&&!data.editing&&oldTrip)visitor?.setChoice(data.visitorData?.activityChoice||'auto');
  const token=++epoch;route=[];onArrive=null;seat=bed=null;dwell=0;
  const needed=data.presentation.map;
  hostChore=null;hostChoreManual=false;hostChoreVisual?.hide();
  if(carry){
   arrival={destination:needed,choice:carryChoice};autoInteraction.reset();seat=bed=null;
   if(transfer.start(needed,carryChoice)){return;}
   arrival=null;closeVisit('门口没有能一起走到的位置，这次各自前往。');
  }
  if(resume?.charId===data.charId&&resume.map===needed){
    if(map==='dayHome'&&(spaceStyle!==(data.homeStyle||'warm')||layoutChanged||wasEditing))mapLoader.keep(null);
    enter(needed,token,false,false,resume);return;
  }
  if(DAY_PLACES[map]&&map===needed&&JSON.stringify(mapLoader.views[map]?.root.userData.professional||{})!==JSON.stringify(professionalOptions(data.professional,map,data.persona))){mapLoader.keep(null);enter(needed,token,false,true,previousPause);return;}
  if(tripChanged){enter(needed,token,false,false,resume?.map===needed?resume:null);}
  else if(data.editing&&map!==needed){enter(needed,token);}
  else if(map==='dayHome'&&needed===map&&(spaceStyle!==(data.homeStyle||'warm')||layoutChanged||!!wasEditing!==!!data.editing)){mapLoader.keep(null);enter(needed,token,false,!!wasEditing&&!!data.editing);}
  // The day album jumps straight to each stop instead of walking out of the last room first.
  else if(data.albumShot&&map&&map!==needed&&!changing){enter(needed,token);}
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
  if(['dayHome','dayCampus'].includes(map))setHomeClock(mapLoader.views[map]?.root,snapshot?.minute);
  if(snapshot?.visitorPreview&&visitorAvatar&&!visitor?.inspect().present){visitorAvatar.animate(time,{height:.08});}
  if(!ready||!map||changing||snapshot?.editing||snapshot?.scenePaused||snapshot?.visitorPreview)return;
  if(freeOuting()&&!homeAutoSuppressed&&!autoJoinFailed&&!visitor?.inspect().present&&!visitLoading)joinVisit({automatic:true});
  if(soloOuting()){visitor?.tick(dt,time);updateWorkScene(mapLoader.views[map]?.root,null,false,time);trackCamera(Math.min(1,dt*8));dayEnvironment.update(snapshot.minute,snapshot.weather,time);return;}
  if(!avatar.root.visible)return;
  if(transfer?.inspect()){transfer.tick(dt,time);trackCamera(Math.min(1,dt*8));return;}
  if(map==='dayHome'&&visitSetting()&&!snapshot.visitorPreview&&snapshot.visitorData?.homePresence!=='away'&&!homeAutoSuppressed&&!autoJoinFailed&&!visitor?.inspect().present&&!visitLoading)joinVisit({automatic:true});
  if(together?.inspect()){if(together.inspect().automatic&&together.inspect().phase==='active'&&together.inspect().elapsed>=8){together.stop('小互动结束，继续各自活动。');autoInteraction.reset();}together.tick(dt,time);if(together.inspect()){if((mealReturn||together.inspect()?.tableMeal)&&currentKitchenJob()?.kind==='meal'&&together.inspect()?.kind==='feed'&&together.inspect()?.phase==='active'){const q=together.inspect(),contact=q.intimate,done=q.elapsed>=5&&contact?.spoonDistance<.06&&(contact.contacts||[]).every(c=>c.error<.06);if(done||q.elapsed>12){mealReturn=false;visitAction('together:meal');if(!done&&parent!==window)parent.postMessage({type:'char-day-kitchen-notice',charId:snapshot?.charId,notice:'这一口还够不到，先留在餐桌上一起尝。'},location.origin);}}taskState=together.inspect()?.aTask;updateWorkScene(mapLoader.views[map]?.root,taskState,false,time);trackCamera(Math.min(1,dt*8));updateKitchen(dt);return;}}
  const moving=route.length>0;
  if(moving){
    const step=stepRoute(position,route,dt,{speed,walkSpeed:1.6*(hostMotion?.walk||1),clear:(a,b)=>segmentClear(a,b,map,companionAvoid())});position=step.position;speed=step.speed;if(step.heading!=null)yaw=step.heading;
    if(!route.length){dwell=0;const done=onArrive;onArrive=null;done?.();}
  }else dwell+=dt;
  if(!moving&&CORE_SPACES[map]&&!snapshot.presentation.spot)yaw=activitySpot(MAPS[map],activity.action)?.heading||0;
  const spot=(DAY_PLACES[map]||MAPS[map])?.spots.find(s=>s.id===activity?.spot);
  const stage=spot&&DAY_PLACES[map]?{...activity,action:activity.action||spot.action,gesture:activity.gesture||spot.gesture}:CORE_SPACES[map]&&!activity.group&&activity.action!=='work'&&!MAPS[map].spots.some(s=>s.action===activity.action)?{action:'rest',gesture:'rest'}:activity;
  const pose=activityPose(stage,dwell,{hasSlot:!!snapshot.slot,seated:!!seat});
  if(!moving&&hostChore)yaw=hostChore.heading;else if(!moving&&spot)yaw=spot.heading||0;
  // During departure the avatar still walks through the previous room.
  taskState=activity?.map===map?taskAt(stage,spot,MAPS[map],dwell,{moving,position,heading:yaw,motion:hostMotion,actor:avatar}):null;
  const equipment=professionalOptions(snapshot?.professional,map,snapshot?.persona);if(!taskState?.homeHobby&&((['piano','guitar'].includes(taskState?.kind)&&equipment.instruments===false)||(['experiment','observe'].includes(taskState?.kind)&&equipment.equipment==='none')||(['paint','craft'].includes(taskState?.kind)&&equipment.materials==='none'))){taskState=null;pose.gesture='rest';pose.emotion=null;}
  if(taskState){if(taskState.daily)pose.gesture={read:'read',drink:'tea',eat:'eat',cook:'stir'}[taskState.kind];else if(taskState.kind!=='read')pose.gesture='rest';pose.emotion=null;}
  if(['enter','exit'].includes(stage.phase)&&!moving){pose.gesture='rest';pose.emotion=null;}
  if(hostChore){pose.gesture='rest';pose.emotion=null;taskState=null;}
  avatar.root.position.set(position.x,0,position.z);avatar.root.rotation.y=yaw;
  if(!moving&&bed){avatar.animate(time,{sleepPose:bed});}
  else if(!moving&&seat){avatar.root.position.set(seat.x,0,seat.z);avatar.root.rotation.y=seat.heading||0;avatar.animate(time,{...pose,task:taskState,motion:hostMotion,seated:true,seatPose:seat.pose,height:floorHeight(map,seat)+(seat.rise||0)+.05});}
  else avatar.animate(time,{...pose,task:taskState,motion:hostMotion,moving,gesture:moving?'rest':pose.gesture,emotion:moving?null:pose.emotion,height:floorHeight(map,position),...chorePose(hostChore,dwell,moving,position)});
  if(!moving&&snapshot.slot&&strolling()&&dwell>1.5){dwell=0;wander();}
  if(time<helloUntil&&!moving&&!bed&&!hostChore&&!activity?.stageCarry){const v=visitor?.inspect();if(v?.present){avatar.root.rotation.y=Math.atan2(v.position.x-avatar.root.position.x,v.position.z-avatar.root.position.z);taskState=null;avatar.animate(time,{seated:!!seat,seatPose:seat?.pose,height:floorHeight(map,seat||position)+(seat?seat.rise+.05:0),gesture:'wave',progress:(time-(helloUntil-5))/5});}}
  hostChoreVisual?.update(hostChore,dwell,moving);if(hostChore&&hostChoreManual&&dwell>=hostChore.duration){target=destination(activity);dwell=0;go(target);}
  visitor?.tick(dt,time);
  updateWorkScene(mapLoader.views[map]?.root,taskState,moving,time,[visitor?.inspect()?.task]);
  autoInteraction.tick(dt,{enabled:snapshot.socialPreferences?.autoInteractions!==false,eligible:!!social.automaticSetting(snapshot,{resting:!!bed})&&!visitor?.inspect()?.chore,visitor:visitor?.inspect(),ready:!route.length&&!arrival&&!hostChore,posture:bed?'lie':seat?'sit':'stand',sleeping:!!bed&&bed.awake!==true,profile:hostPair,actions:visitSetting()?.actions||[],start:(kind,options)=>{const result=together.start(kind,options);if(result.ok){route=[];onArrive=null;}return result;}});
  trackCamera(Math.min(1,dt*8));updateKitchen(dt);
  if(map==='garden')mapLoader.views[map]?.stream?.update(pan,Math.max(7,span/camera.zoom));
  dayEnvironment.update(snapshot.minute,snapshot.weather,time);
}
function previewVisitor(time){
 if(!snapshot?.visitorPreview||!visitorAvatar?.root.visible)return;const v=visitor?.inspect(),at=v?.present?(v.seat||v.position):{x:0,z:3.2},seated=v?.present&&v.seat;visitorAvatar.root.position.set(at.x,0,at.z);visitorAvatar.root.rotation.y=Math.atan2(camera.position.x-at.x,camera.position.z-at.z);visitorAvatar.animate(time,{seated:!!seated,seatPose:seated?.pose,height:floorHeight(map,at)+(seated?seated.rise+.05:0),gesture:'rest'});
}
let last=performance.now(),lastFrameTime=last;function loop(t){if(disposed)return;const dt=Math.min(.05,(t-last)/1000);last=t;if(!document.hidden){applyQuality(qualityMonitor.observe((t-lastFrameTime)/1000,ready&&!changing));tick(dt,t/1000);previewVisitor(t/1000);lunchCarry.update(avatar,snapshot?.kitchenCarry,!snapshot?.scenePaused&&!snapshot?.editing&&!snapshot?.preview&&!snapshot?.showcase&&(route.length>0||!!transfer?.inspect()));if(kitchenStation&&currentKitchenJob()?.cooking){boardStation.update(currentKitchenJob(),kitchenProgress.progress,innerWidth,innerHeight,kitchenDrag,kitchenStation,kitchenView.stationObjects(kitchenStation,globalThis.CharDayKitchen.cookingSpec(currentKitchenJob(),kitchenProgress.progress)));renderer.render(boardStation.scene,boardStation.camera);}else renderer.render(scene,camera);}lastFrameTime=t;frame=requestAnimationFrame(loop);}
function appearanceTextures(){const urls=[];avatar?.root.traverse(o=>{const src=o.material?.map?.image?.src;if(src&&/\/faces\//.test(src))urls.push(src);});return [...new Set(urls)];}
function chinContact(){const head=avatar?.root.getObjectByName('HeadAnchor'),hand=avatar?.root.getObjectByName('Right_hand');return head&&hand?head.worldToLocal(hand.getWorldPosition(new T.Vector3())).toArray():null;}
let catalogCache=null;const partCache=new Map();
function furnitureView(p){return createSpaceView('dayHome',snapshot?.homeStyle||'warm',{...CORE_SPACES.dayHome,furniture:[{...p,x:0,z:0,heading:0}],structure:[]},{furnitureOnly:true});}
function furnitureParts(p){
 const key=JSON.stringify([p.catalogId||p.id,snapshot?.homeStyle,p.color]);
 if(!partCache.has(key)){const view=furnitureView({...p,partColors:{},material:'auto'});try{partCache.set(key,view.root.children[0].userData.parts);}finally{disposeMap(view.root);}if(partCache.size>240)partCache.delete(partCache.keys().next().value);}
 return partCache.get(key).map(q=>({...q,color:p.partColors?.[q.id]||q.defaultColor,custom:!!p.partColors?.[q.id]}));
}
function previewFurniture(p,style='warm'){
 const previewScene=new T.Scene(),previewCamera=new T.OrthographicCamera(-2,2,2,-2,.1,50);
 previewScene.background=new T.Color('#f2ecde');previewScene.add(new T.HemisphereLight('#fff4dd','#958267',2.2));const light=new T.DirectionalLight('#fff4de',3);light.position.set(-4,8,5);previewScene.add(light);
 const view=createSpaceView('dayHome',style,{...CORE_SPACES.dayHome,furniture:[{...p,x:0,z:0,heading:0}],structure:[]},{furnitureOnly:true});previewScene.add(view.root);
 try{
  const bounds=new T.Box3().setFromObject(view.root),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3()),span=Math.max(size.x,size.y,size.z)*.85+.35;
  Object.assign(previewCamera,{left:-span,right:span,top:span,bottom:-span});previewCamera.position.copy(center).add(new T.Vector3(5,4,6));previewCamera.lookAt(center);previewCamera.updateProjectionMatrix();
  return renderPhoto(T,renderer,previewScene,previewCamera,{width:160,height:160,format:'image/png'});
 }finally{previewScene.remove(view.root);disposeMap(view.root);renderer.render(scene,camera);}
}
function listCatalog(){if(!catalogCache)catalogCache=HOME_CATALOG.map(p=>({...p,thumbnail:previewFurniture({...p,catalogId:p.id})}));return catalogCache;}
function furniturePreview(id){const p=homeFurniture(snapshot?.homePlacements).find(p=>p.id===id);return p?previewFurniture(p,snapshot?.homeStyle):null;}
function visitAction(kind,point){
 autoInteraction.reset();const wasTransfer=transfer?.inspect();if(wasTransfer){transfer.cancel('你已接管，继续按你的选择活动。');arrival=null;target={...MAPS[map].spawn};go(target,()=>{closeVisit('这次一起转场已结束，按当前日程继续。');enter(snapshot.presentation.map,epoch);});}
 if(kind==='end'){together?.stop();if(hostChoreManual){target=destination(activity);dwell=0;go(target);}return visitor?.act('manual')||false;}
 if(kind.startsWith('chore:ta:')){together?.stop();const choreKind=kind.slice(9);if(!CHORES[choreKind]?.personal)visitor?.act('manual');const v=visitor?.inspect(),plan=visitSetting()?.home&&CHORES[choreKind]&&chorePlans(MAPS[map],choreKind,position,v?.present?(v.seat||v.position):null)[0];if(!plan||bed||changing){visitNotice({...v,notice:CHORES[choreKind]?.personal?'浴室这件设施旁边有人或通道被挡，腾出空位再来。':'先给TA留一处能走到的对应家具，再来做家务。'});return false;}hostChore=plan;hostChoreManual=true;hostChoreVisual.hide();seat=bed=null;dwell=0;yaw=plan.heading;target={...plan.at};go(target);return true;}
 if(kind==='leave'&&(map==='dayHome'||freeOuting()))homeAutoSuppressed=true;
 const shared=kind.startsWith('together:');if(shared)kind=kind.slice(9);
 if(shared||['hand','hug','shoulder','meal','cook'].includes(kind)){
  visitor?.takeControl();
  if(!visitor?.inspect().present||!visitSetting()||changing){visitNotice({...visitor?.inspect(),notice:bed?'TA在睡觉，先安静陪一会儿。':'等TA走到位置后再互动。'});return false;}
  if(!visitSetting().actions.some(action=>action.kind===kind)){visitNotice({...visitor.inspect(),notice:'这个地点没有对应的双人活动位置。'});return false;}
  const result=together.start(kind,{initiator:point?.initiator,lead:kind==='cook'&&['ta','me'].includes(point?.lead)?point.lead:currentKitchenJob()?.cooking?.lead});if(result.ok){hostChore=null;hostChoreManual=false;hostChoreVisual?.hide();route=[];onArrive=null;}if(!result.ok)visitNotice({...visitor.inspect(),notice:result.reason});else if(following)trackCamera();return result.ok;
 }
 together?.stop();const ok=visitor?.act(kind,point)||false;if(ok&&kind!=='leave'&&following)trackCamera();return ok;
}
// Time advances only after BOTH rigs have reached their actual shared anchors.
function currentKitchenJob(){const job=snapshot?.kitchenJob,k=kitchenProgress;return job?.cooking&&k?.id===job.id?{...job,ready:k.ready,cooking:{...job.cooking,mode:k.mode,lead:k.lead,progress:k.progress}}:job;}
function syncKitchen(){const job=snapshot?.kitchenJob,K=globalThis.CharDayKitchen;if(kitchenStation&&(!job?.cooking||job.id!==kitchenProgress?.id||map!=='dayHome')){kitchenStation='';place.style.display='';boardStation.clear();place.style.display='';if(parent!==window)parent.postMessage({type:'char-day-kitchen-station',charId:snapshot?.charId,station:''},location.origin);}if(!job){kitchenProgress=null;return null;}if(kitchenProgress?.id!==job.id)kitchenProgress={id:job.id,elapsed:0,reported:-1,ready:!!job.ready,...(job.cooking?{mode:job.cooking.mode,lead:job.cooking.lead,progress:K.cookingProgress(job.cooking.progress)}:{})};else if(job.cooking&&K.cookingProgress(job.cooking.progress).rev>(kitchenProgress.progress?.rev||0)){Object.assign(kitchenProgress,{mode:job.cooking.mode,lead:job.cooking.lead,progress:K.cookingProgress(job.cooking.progress),ready:!!job.ready});}return kitchenProgress;}
function projectKitchenTargets(){if(kitchenStation)return boardStation.targets();return kitchenView.targets().map(o=>{const v=(o.userData.tabletop?new T.Box3().setFromObject(o).getCenter(new T.Vector3()):o.getWorldPosition(new T.Vector3())).project(camera);return {id:o.userData.kitchenTarget,...(o.userData.tabletop||{}),x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};});}
function projectKitchenPoint(q){if(kitchenStation)return boardStation.project(q);const table=kitchenView.tabletop();if(!table)return null;const v=table.worldPoint(q).project(camera);return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};}
function tabletopPointer(x,y,zone='board'){
 const table=kitchenView.tabletop();if(!table)return null;const q=globalThis.CharDayKitchen.TABLE_ZONES[zone]||globalThis.CharDayKitchen.TABLE_ZONES.board;
 const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);const world=table.worldPoint({x:q.x,z:q.z,y:q.y+.09}),point=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-world.y),new T.Vector3());if(!point)return null;const local=table.toLocal(point);return {x:local.x,z:local.z};
}
function hitKitchen(x,y){
 if(snapshot?.scenePaused||snapshot?.editing||changing||!currentKitchenJob()?.cooking||together?.inspect()?.phase!=='active')return null;
 if(kitchenView.tabletop()){const near=projectKitchenTargets().filter(q=>q.type&&!['plate-base','tray','pan','plate','basket'].includes(q.type)).map(q=>({...q,d:Math.hypot(q.x-x,q.y-y)})).sort((a,b)=>a.d-b.d)[0];if(near?.d<=8)return {type:near.type,id:near.id,zone:near.zone};}
 const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),camera);
 for(const hit of ray.intersectObjects(kitchenView.targets(),true)){let o=hit.object;while(o){if(o.userData.tabletop)return o.userData.tabletop;if(o.userData.kitchenTarget)return o.userData.kitchenTarget;o=o.parent;}}
 if(kitchenView.tabletop()){const near=projectKitchenTargets().filter(q=>q.type&&q.type!=='plate-base'&&q.type!=='tray').map(q=>({...q,d:Math.hypot(q.x-x,q.y-y)})).sort((a,b)=>a.d-b.d)[0];if(near?.d<=24)return {type:near.type,id:near.id,zone:near.zone};}return null;
}
function stationForTag(tag){return ({basket:'basket',knife:'board',pan:'pan',flip:'pan',stir:'pan',heat:'heat',sauce:'sauce','plate-base':'plate',plate:'plate',tray:'plate'})[tag?.type]||null;}
function finishStationDrag(d){
 const job=currentKitchenJob(),K=globalThis.CharDayKitchen,q=K.cookingSpec(job,kitchenProgress.progress),tag=d.tag,point=d.point;
 if(!q.tabletop){if(tag.type==='heat'){kitchenInput({kind:'heat',value:Math.max(0,Math.min(2,kitchenProgress.progress.heat+(d.startY-d.lastY>18?1:d.lastY-d.startY>18?-1:0)))});return;}
  if(q.operation==='plate'){if(tag.type==='legacy-plate'&&point?.zone==='legacyTray')kitchenInput({kind:'work',target:'serve',operation:'plate'});return;}
  if(q.passive)return;if(q.operation==='flip'&&d.startY-d.lastY<18)return;const n=d.distance<14?0:Math.min(6,Math.max(1,Math.floor(d.distance/24)));for(let i=0;i<n;i++){if(K.cookingSpec(job,kitchenProgress.progress).index!==q.index)break;kitchenInput({kind:'work',operation:q.operation,target:q.target});}return;
 }
 if(tag.type==='ingredient'&&tag.zone==='pan'&&point?.zone==='pan'&&d.distance>18){kitchenInput({kind:'stir',path:d.path});return;}
 if(tag.type==='heat'&&d.distance<8&&d.station!=='heat'){kitchenInput({kind:'station',value:'heat'});return;}
 if(tag.type==='sauce'&&d.station!=='sauce'&&d.distance<8){kitchenInput({kind:'station',value:'sauce'});return;}
 finishTabletopDrag(d);
}
function finishTabletopDrag(d){
 const kind=d.tag.type,point=d.point||tabletopPointer(d.lastX,d.lastY,d.tag.zone),path=d.path;
 if(kind==='ingredient'&&point){kitchenInput({kind:'drop',id:d.tag.id,point});const item=kitchenProgress?.progress?.table?.items.find(p=>p.id===d.tag.id);if(item&&(item.zone==='board'||!d.station&&item.zone!==d.tag.zone||item.zone==='plate'&&kitchenProgress.progress.table.items.every(p=>p.zone==='plate')))kitchenInput({kind:'station',value:item.zone});}
 else if(kind==='knife'&&path.length>1)kitchenInput({kind:'slice',from:path[0],to:path.at(-1),path});
 else if(['pan','stir'].includes(kind)&&path.length>1)kitchenInput({kind:'stir',path});
 else if(kind==='flip'&&d.lastY-d.startY<-18)kitchenInput({kind:'flip'});
 else if(kind==='heat')kitchenInput({kind:'heat',value:Math.max(0,Math.min(2,(kitchenProgress?.progress?.heat??1)+((d.startY-d.lastY)>12?1:(d.startY-d.lastY)<-12?-1:1)))});
 else if(kind==='sauce'&&path.length>1)kitchenInput({kind:'sauce',path});
 else if(kind==='plate'&&point)kitchenInput({kind:'serve-plate',point});
}
function focusKitchen(){const table=kitchenView.tabletop();if(!table)return false;tabletopCamera={heading:table.root.parent.rotation.y};orbitPivot.copy(new T.Box3().setFromObject(table.root).getCenter(new T.Vector3()));setFollowing(false);homeOverview=false;const box=new T.Box3().setFromObject(table.root).expandByScalar(.12);const wide=innerWidth>innerHeight,insets=wide?{top:snapshot?.viewInsets?.top||130,bottom:30,left:18,right:Math.max(320,snapshot?.viewInsets?.right||0)}:{top:snapshot?.viewInsets?.top||165,bottom:snapshot?.viewInsets?.right>50?150:snapshot?.viewInsets?.bottom||150,left:20,right:20};frameBox(box,insets,7);return true;}
function kitchenInput(event){const k=syncKitchen(),job=currentKitchenJob(),K=globalThis.CharDayKitchen;if(!job||map!=='dayHome'||snapshot?.scenePaused||changing)return {ok:false,reason:'先回到这份料理的现场。'};
 if(event.kind==='offer'&&job.kind==='meal'){if(together?.inspect()?.kind!=='meal'||together.inspect().phase!=='active')return {ok:false,reason:'先坐到餐桌，再给TA尝这一口。'};const ok=visitAction('together:feed',{initiator:'b'});mealReturn=ok;return {ok};}
 if(event.kind==='taste'&&job.kind==='meal')return {ok:visitAction('together:meal')};
 if(!job.cooking)return {ok:false};const spec=K.cookingSpec(job,k.progress);
 if(event.kind==='moment'){if(!together?.inspect()||together.inspect().kind!=='cook'||together.inspect().phase!=='active'||together.inspect().moment)return {ok:false,reason:'等两个人到锅边、做完当前这一下。'};const choice=K.cooperation(job,k.progress).find(q=>q.id===event.value);if(!choice||choice.disabled)return {ok:false,reason:choice?.reason||'这一步还没到。'};const result=together.start('cook',{lead:k.lead,moment:event.value});if(result.ok){kitchenInput({kind:'station',value:''});tabletopCamera=null;setCameraMode('both');route=[];onArrive=null;}return result;}
 if(together?.inspect()?.moment&&!(event.kind==='station'&&!event.value))return {ok:false,reason:'等这一小下做完，再接着操作。'};
 if(event.kind==='station'){const chosen=K.stationInfo(job,event.value,k.progress);if(event.value&&(!K.cookingStations(job,k.progress).some(q=>q.id===event.value)||chosen.disabled))return {ok:false,reason:'先做完当前这一步，再用这件道具。'};k.preview=spec.ready&&event.value==='plate';kitchenStation=event.value||'';place.style.display=kitchenStation?'none':'';kitchenDrag=null;boardStation.clear();if(parent!==window)parent.postMessage({type:'char-day-kitchen-station',charId:snapshot.charId,station:kitchenStation},location.origin);if(!kitchenStation)focusKitchen();return {ok:true};}
 if(event.kind==='board-pan'&&spec.tabletop){if(together?.inspect()?.phase!=='active')return {ok:false,reason:'等两个人到厨房再下锅。'};if(!k.progress.table.items.some(p=>p.zone==='board'))return {ok:false,reason:'先从食材篮拿一份到砧板。'};for(const [i,p]of k.progress.table.items.filter(p=>p.zone==='board').entries())k.progress=K.stepCooking(job,k.progress,{kind:'drop',id:p.id,point:{x:K.TABLE_ZONES.pan.x+(i%3-1)*.075,z:K.TABLE_ZONES.pan.z+(i%2-.5)*.075}});k.feedback='这批已下锅，接着看锅里的熟度。';kitchenInput({kind:'station',value:'pan'});updateKitchen(0);return {ok:true};}
 if(event.kind==='focus'){if(focusKitchen())return {ok:true};const target=kitchenView.targets().find(o=>o.userData.kitchenTarget===spec.target);if(target){const p=target.getWorldPosition(new T.Vector3());pan.x=p.x;pan.z=p.z;setFollowing(false);gesture.setZoom(2.7);cameraPose();return {ok:true};}return {ok:false};}
 if(event.kind==='away'&&spec.passive){together?.stop('正在慢慢煮，先去忙自己的事。');visitor?.act('auto');return {ok:true};}
 if(event.kind==='lead'){const result=together.start('cook',{lead:event.value});if(!result.ok)return result;k.lead=event.value==='me'?'me':'ta';k.progress={...k.progress,rev:k.progress.rev+1};route=[];onArrive=null;updateKitchen(0);return {ok:true};}
 if(event.kind==='mode'){k.mode=event.value==='auto'?'auto':'hands';k.progress={...k.progress,rev:k.progress.rev+1};updateKitchen(0);return {ok:true};}
 if(['work','drop','slice','stir','flip','sauce','serve-plate'].includes(event.kind)&&together?.inspect()?.phase!=='active')return {ok:false,reason:'等两个人走到自己的位置。'};
 if(event.kind==='work'&&event.target&&event.target!==spec.target)return {ok:false};
 if(event.kind==='heat'&&!spec.tabletop&&spec.index!==1)return {ok:false};
 const before=k.progress,next=K.stepCooking(job,before,{...event,operation:event.operation||spec.operation}),changed=next.rev!==before.rev;
 if(['slice','drop','stir','flip','sauce','serve-plate','work'].includes(event.kind)){
  const message=changed?(event.kind==='slice'?'切开了 · 现在砧板上有 '+next.table.items.filter(p=>p.zone==='board').length+' 块':event.kind==='work'?K.cookingSpec(job,next).index!==spec.index?'这一步完成了，接着'+K.cookingSpec(job,next).label:'做到了 '+Math.round(next.work/Math.max(1,spec.required)*100)+'%':({stir:'已经翻动拌匀',flip:'已翻面，让另一面也煎熟',sauce:'淋酱已经留在盘上',drop:'食材已放好','serve-plate':'摆盘完成了'})[event.kind]):event.kind==='slice'?'从食材中间划过试试；已经很小的块可以直接下锅。':event.kind==='drop'?'没放进去：熟好的菜才能盛盘，把食材拖到道具里再松手。':'这一下还没完成，照下面的提示再试一次。';
  k.feedback=message;if(parent!==window)parent.postMessage({type:'char-day-kitchen-notice',charId:snapshot.charId,notice:message},location.origin);
 }
 k.progress=next;updateKitchen(0);return {ok:changed||!['slice','drop','stir','flip','sauce','serve-plate','work'].includes(event.kind),notice:k.feedback};
}
function updateKitchen(dt){
 const k=syncKitchen(),job=currentKitchenJob(),shared=together?.inspect(),K=globalThis.CharDayKitchen;
 const active=!!job&&map==='dayHome'&&!snapshot.preview&&!snapshot.editing&&visitor?.inspect().present&&shared?.kind===job.kind&&shared.phase==='active';
 if(!job){if(kitchenStation){kitchenStation='';boardStation.clear();place.style.display='';if(parent!==window)parent.postMessage({type:'char-day-kitchen-station',charId:snapshot?.charId,station:''},location.origin);}if(tabletopCamera){tabletopCamera=null;setCameraMode('both');}kitchenView.update(mapLoader.views[map]?.root,MAPS[map],null,shared,{},0);return;}
 let stage=globalThis.CharDayKitchen.cookingStage(job,job.cooking?k.progress:k.elapsed);if(!stage.tabletop&&tabletopCamera){tabletopCamera=null;setCameraMode('both');}
 if(job.cooking){if((active||!!shared?.moment||stage.passive&&map==='dayHome')&&!k.ready)k.progress=K.stepCooking(job,k.progress,{kind:'tick',dt,active,prepPaused:!!shared?.moment||['board','basket'].includes(kitchenStation),chefPaused:!!shared?.moment||['pan','heat','plate','sauce'].includes(kitchenStation),operationPaused:!!shared?.moment||!!kitchenStation,held:kitchenDrag?.tag?.id});k.elapsed=k.progress.elapsed;k.ready=k.progress.index===3;stage=K.cookingStage(job,k.progress);}
 else if(active&&!k.ready){k.elapsed+=dt;if(k.elapsed>=stage.duration)k.ready=true;stage=K.cookingStage(job,k.elapsed);}
 kitchenView.update(mapLoader.views[map]?.root,MAPS[map],job,shared,stage,k.elapsed,shared?.moment?.kind==='pass'?{hideId:shared.moment.sourceId}:kitchenDrag);
 if(kitchenStation&&k.ready&&!k.preview)kitchenInput({kind:'station',value:''});else if(kitchenStation&&!stage.tabletop&&K.stationInfo(job,kitchenStation,k.progress).disabled)kitchenInput({kind:'station',value:K.primaryStation(job,k.progress)});
 if(active&&stage.tabletop&&k.focused!==job.id){k.focused=job.id;focusKitchen();}
 const momentKey=shared?.moment?shared.moment.id+':'+shared.phase:'',phase=k.ready?'ready':!active&&!stage.passive?'paused':stage.phase,step=Math.floor(k.elapsed*2);k.sinceNotice=(k.sinceNotice||0)+dt;
 if(k.momentKey!==momentKey||k.reported!==step||k.phase!==phase||job.cooking&&(k.savedRev!==k.progress.rev)||k.ready&&!job.ready&&k.sinceNotice>=1){k.sinceNotice=0;k.momentKey=momentKey;k.reported=step;k.phase=phase;k.savedRev=k.progress?.rev;if(parent!==window)parent.postMessage({type:'char-day-kitchen',charId:snapshot.charId,id:k.id,phase,moment:shared?.moment?{id:shared.moment.id,kind:shared.moment.kind,phase:shared.phase}:null,label:stage.label,elapsed:k.elapsed,ready:k.ready,feedback:k.feedback||'',...(job.cooking?{progress:{...k.progress},mode:k.mode,lead:k.lead}:{})},location.origin);}
}
function KITCHEN_TOOL_INSPECT(){return {...boardStation.inspect(),info:globalThis.CharDayKitchen.stationInfo(currentKitchenJob(),kitchenStation,kitchenProgress?.progress)};}
function capturePhoto(){
 if(!ready||changing||!visitSetting()||snapshot?.preview||snapshot?.editing||snapshot?.showcase||!avatar?.root.visible||!visitor?.inspect().present||!visitorAvatar?.root.visible)throw Error('先和TA走到一起，再拍同框照片。');
 const bounds=actorBounds('both'),center=bounds.getCenter(new T.Vector3()),view=camera.clone(),height=Math.max(1.8,bounds.getSize(new T.Vector3()).y+.5),width=height*4/3;
 Object.assign(view,{left:-width/2,right:width/2,top:height/2,bottom:-height/2,zoom:1,far:200});view.position.copy(center).add(new T.Vector3(10,11.5,16));view.lookAt(center);view.updateProjectionMatrix();view.updateMatrixWorld();
 const b=projectedBounds(bounds,view);view.zoom=Math.min(6,1.7/(b.maxX-b.minX),1.7/(b.maxY-b.minY));view.updateProjectionMatrix();
 const src=renderPhoto(T,renderer,scene,view,{width:800,height:600,quality:.84});renderer.render(scene,camera);
 return {src,map,place:MAPS[map]?.label,charId:snapshot.charId,activity:sharedActivity(),minute:snapshot.minute};
}
// TA alone for the day album: works while previewing a schedule row, never while editing. Small frame keeps the album light.
function captureSolo(){
 if(!ready||changing||snapshot?.editing||!avatar?.root.visible)throw Error('画面还没准备好。');
 const bounds=actorBounds('ta');if(!bounds)throw Error('画面还没准备好。');
 const center=bounds.getCenter(new T.Vector3()),view=camera.clone(),height=Math.max(2.6,bounds.getSize(new T.Vector3()).y+1.6),width=height*4/3;
 Object.assign(view,{left:-width/2,right:width/2,top:height/2,bottom:-height/2,zoom:1,far:200});view.position.copy(center).add(new T.Vector3(10,11.5,16));view.lookAt(center);view.updateProjectionMatrix();view.updateMatrixWorld();
 const src=renderPhoto(T,renderer,scene,view,{width:480,height:360,quality:.8});renderer.render(scene,camera);
 return {src,map,place:MAPS[map]?.label,charId:snapshot.charId,minute:snapshot.minute,key:snapshot.key};
}
function sharedActivity(){return together?.inspect()?.label||(freeOuting()?'一起逛逛':null)||(snapshot?.slot?.deviation?.actual||snapshot?.slot?.title||'在小家待一会儿');}
function visitorWardrobe(){return createWardrobe(()=>({me:seatLook('me',snapshot?.visitorLook||{},'她')}));}
const listFurniture=()=>homeFurniture(snapshot?.homePlacements).map(p=>({...p,parts:furnitureParts(p),primary:furniturePrimary(p,styleOf(snapshot?.homeStyle)).color,actions:usesFor(p),inUse:usesFor(p).some(action=>MAPS.dayHome.spots.find(s=>s.id===action)?.piece===p.id)}));
window.CharDayScene={kitchenInput,projectKitchenTargets,projectKitchenPoint,catalogLabels:()=>Object.fromEntries(HOME_CATALOG.map(p=>[p.id,p.label])),pauseState,setCameraMode,capturePhoto,captureSolo,professionalChoices:()=>PROFESSIONAL_OPTIONS,professionalStyles:()=>PROFESSIONAL_STYLES,joinVisit,visitAction,visitorWardrobe,mergeVisitorLook:(patch,old)=>mergeLook(old||snapshot?.visitorLook||{},patch),setSnapshot:apply,listPlaces:placeList,listFurniture,listCatalog,furniturePreview,decorationOptions:()=>({categories:HOME_CATEGORIES,collections:HOME_COLLECTIONS,colors:HOME_COLORS,materials:HOME_MATERIALS,walls:HOME_WALLS,floors:HOME_FLOORS,sizes:HOME_SIZES,mountWalls:HOME_MOUNT_WALLS}),addFurniture:id=>commitEdit(addHomeFurniture(snapshot?.homePlacements,id)),editRoom:change=>commitEdit(changeHomeRoom(snapshot?.homePlacements,change)),selectFurniture,editAction,editMove:(id,point)=>{selectFurniture(id);return commitEdit(changeHomeFurniture(snapshot?.homePlacements,id,point));},editLayout:()=>drag||changing?{ok:false,reason:'等家具放稳后再保存。'}:checkHomeLayout(snapshot?.homePlacements),projectGround,projectFurniture,listPairStyles:()=>Object.entries(PAIR_STYLES).map(([id,p])=>({id,label:p.label,description:p.description})),listMotions:()=>Object.entries(MOTION_STYLES).map(([id,p])=>({id,label:p.label,description:p.description})),listStyles:()=>Object.entries(SPACE_STYLES).map(([id,p])=>({id,label:p.label,colors:[p.wall,p.wood,p.fabric]})),focus:center,overview,probeAction:()=>{const hand=avatar?.root.getObjectByName('Right_hand'),head=avatar?.root.getObjectByName('HeadAnchor'),tool=avatar?.root.getObjectByName(taskState?.kind==='write'?'WorkPencil':taskState?.kind==='paint'?(taskState.tool==='chalk'?'WorkChalk':'WorkBrush'):'WorkPipette');return {leftHand:avatar?.root.getObjectByName('Left_hand')?.getWorldPosition(new T.Vector3()).toArray(),luggage:avatar?.root.getObjectByName('WorkSuitcase')?.getWorldPosition(new T.Vector3()).toArray(),luggageGrip:avatar?.root.getObjectByName('SuitcaseGrip')?.getWorldPosition(new T.Vector3()).toArray(),leftHeadHand:(()=>{const left=avatar?.root.getObjectByName('Left_hand');return head&&left?head.worldToLocal(left.getWorldPosition(new T.Vector3())).toArray():null;})(),bones:['rightArm','rightForearm'].map(n=>avatar?.root.getObjectByName(n)?.getWorldPosition(new T.Vector3()).toArray()),hand:hand?.getWorldPosition(new T.Vector3()).toArray(),headHand:head&&hand?head.worldToLocal(hand.getWorldPosition(new T.Vector3())).toArray():null,tool:tool?.getWorldPosition(new T.Vector3()).toArray(),task:taskState};},inspect:()=>({outing:freeOuting(),hasScheduledResume:!!scheduledResume,cameraMode,hostChore:hostChore?{kind:hostChore.kind,piece:hostChore.piece,elapsed:dwell,manual:hostChoreManual,contact:avatar.root.userData.chore}:null,transfer:transfer?.inspect(),pairStyles:{ta:hostPair,me:guestPair},kitchenStation,kitchenBoard:kitchenStation?boardStation.inspect():null,kitchenTool:kitchenStation?KITCHEN_TOOL_INSPECT():null,kitchenView:kitchenView.inspect(),lunchCarry:lunchCarry.inspect(),kitchenProgress,kitchenDrag:kitchenDrag?{tag:kitchenDrag.tag,x:kitchenDrag.startX,y:kitchenDrag.startY,point:kitchenDrag.point,path:kitchenDrag.path.length}:null,framedActors:(()=>{const roots=[avatar?.root,visitorAvatar?.root];return roots.filter(r=>r?.visible).map(r=>({...projectedBounds(visibleBounds(T,[r])),who:r===avatar.root?'ta':'me'}));})(),motion:hostMotion,visitorMotion:guestMotion,professional:mapLoader.views[map]?.root.userData.professional,contacts:{ta:avatar?.root.userData.contacts,me:visitorAvatar?.root.userData.contacts},together:together?.inspect(),visitorLook:snapshot?.visitorLook||{},visitor:visitor?.inspect()||{present:false,visible:false},visitLoading,ready,map,spaceStyle,editing:!!snapshot?.editing,selected,dragging:!!drag,dragPreview:drag?.candidate,editHistory:history.length,homePlacements:homePlacements(snapshot?.homePlacements),spot:snapshot?.presentation.spot,activity:activity?{...activity}:null,task:taskState,workAction:avatar?.root.userData.workAction,avatarPosition:avatar?.root.position.toArray(),avatarHeading:avatar?.root.rotation.y,visualPosition:avatar?.root.getObjectByName('TravelerVisual')?.getWorldPosition(new T.Vector3()).toArray(),furnitureNodes:mapLoader.views[map]?.root.children.filter(o=>o.userData.furnitureId).map(o=>o.name),layout:mapLoader.views[map]?.root.userData.layout,finishes:mapLoader.views[map]?.root.children.filter(g=>g.userData.furnitureId).map(g=>({id:g.name,finish:g.userData.finish,primary:g.userData.primary,materials:g.children.filter(o=>o.isMesh).map(o=>({color:'#'+o.material.color.getHexString(),roughness:o.material.roughness,metalness:o.material.metalness,textured:!!o.material.map}))})),seat:seat?{...seat}:null,error:failure,bed:bed?{...bed}:null,visible:avatar?.root.visible,visualTilt:avatar?.root.getObjectByName('TravelerVisual')?.rotation.x,position:{...position},route:route.map(p=>({...p})),gesture:avatar?.root.userData.posture,emotion:avatar?.root.userData.emotion,dailyAction:avatar?.root.userData.dailyAction,arm:avatar?.root.getObjectByName('rightArm')?.quaternion.toArray(),chinContact:chinContact(),following,key:snapshot?.key,charId:snapshot?.charId,changing,look:lookKey,markersVisible:!!mapLoader.views[map]?.markers?.visible,faceTextures:appearanceTextures(),sceneAction:mapLoader.views[map]?.root.userData.sceneAction,environment:dayEnvironment.inspect(),cameraView:{orbit:orbit.snapshot(),pivot:orbitPivot.toArray(),pivotProjection:orbitPivot.clone().project(camera).toArray(),pan:{...pan},position:camera.position.toArray(),cutaway:cutaway.snapshot()},render:{quality:qualityLevel,qualityLabel:QUALITY_LEVELS[qualityLevel].label,pixelRatio:renderer.getPixelRatio(),shadowSize:sun.shadow.mapSize.x,load:sceneLoad(mapLoader.views[map]?.root),activeMaps:Object.keys(mapLoader.views),calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,zoom:camera.zoom,homeOverview}})};
addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);boardStation.dispose();kitchenView.clear();lunchCarry.clear();mapLoader.close();dayEnvironment.close();closeVisit();if(visitorAvatar)disposeMap(visitorAvatar.root);if(avatar)disposeMap(avatar.root);selection.geometry.dispose();selection.material.dispose();draco.dispose();renderer.dispose();});
resize();frame=requestAnimationFrame(loop);
try{travelerSource=await loadTravelerSource();avatar=createTraveler(travelerSource,true);hostChoreVisual=createChoreVisual(avatar);scene.add(avatar.root);await avatar.ready();ready=true;tell('');visitNotice({present:false,busy:false,notice:''});if(pending)apply(pending);}catch(e){tell('画面加载失败：'+e.message);}
