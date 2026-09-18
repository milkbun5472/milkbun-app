import {seatsOf,SEAT_KINDS,FOODS,RECIPE_COST,BAG_LABELS,foodOf,recipeOf,nightMarketDay,nightMarketOpen,nextNightMarket,nightStock,vendorAt,vendorOfFood,vendorSpot,VENDOR_STALLS,foodError,foodPay,foodLabel,buyFood,eatError,eat,cookError,cook,foodBook,restorePantry,giftOptions,giftError,giveGift,giftBook,bondBook,companionDestinations,himGiveError,himGive,inviteError,invite,inviteMet,keepInvite,refuse,neighborNear,neighborWaveError,waveAtNeighbor,neighborGiftError,giveToNeighbor,neighborPairs,NEIGHBOR_HAND,MARKET_GOODS,marketOpen,atMarket,marketError,buy,starNightReady,keepStarNight,starChartPieces,STAR_CHART_NEED,spendTime,ACTION_MINUTES,guideStep,guideTarget,guideAdvance,guideSaid,markGuideSaid,setGuide,restoreGuide,todayHints,calendarMarks,marketDay,nextMarketDay,marketStock,marketGood,isBirthday,NEIGHBOR_REACH,neighborTalkError,noteNeighborTalk,neighborView} from './world.mjs?v=fg-4ff0d554e4619471';
import {actionGesture,actionDuration,makeHeldFlower} from './doll-life.mjs?v=fg-4ff0d554e4619471';
import {mergeLook,outfitColors,outfitId,DEFAULT_LOOK,COMPANION_LOOK} from './wardrobe.mjs?v=fg-4ff0d554e4619471';
import {repairError} from './world.mjs?v=fg-4ff0d554e4619471';
import {makeCurio} from './curio-view.mjs?v=fg-4ff0d554e4619471';
import {makePlacedKeepsakes} from './keepsake-view.mjs?v=fg-4ff0d554e4619471';
import {growingDreams,dreamStage,dreamError,SEED_PLOTS} from './world.mjs?v=fg-4ff0d554e4619471';
import {makeDreamGarden} from './dream-view.mjs?v=fg-4ff0d554e4619471';
import {WELL_CURIOS,WELL_KITS,wellTide,wellContext,chooseWellKit,shardName} from './world.mjs?v=fg-4ff0d554e4619471';
import {makeWellSigns} from './well-view.mjs?v=fg-4ff0d554e4619471';
import {makeExcavatingView} from './excavating-view.mjs?v=fg-4ff0d554e4619471';
import {makeStarChartView} from './starchart-view.mjs?v=fg-4ff0d554e4619471';
import {makeMarketView} from './market-view.mjs?v=fg-4ff0d554e4619471';
import {makeRitualView} from './ritual-view.mjs?v=fg-4ff0d554e4619471';
import {makeScoopingView} from './scooping-view.mjs?v=fg-4ff0d554e4619471';
import {weatherLook} from './weather-look.mjs?v=fg-4ff0d554e4619471';
import {BREWS,brewKey} from './brewing.mjs?v=fg-4ff0d554e4619471';
import {makeBrewingView} from './brewing-view.mjs?v=fg-4ff0d554e4619471';
import {MILL_RECIPES,materialLine,millRemaining,millError} from './workshop.mjs?v=fg-4ff0d554e4619471';
import {makeWorkshopView} from './workshop-view.mjs?v=fg-4ff0d554e4619471';
import {openingTag} from './opening-view.mjs?v=fg-4ff0d554e4619471';
import {stepRoute} from './locomotion.mjs?v=fg-4ff0d554e4619471';
import {makeLakeView} from './lake-view.mjs?v=fg-4ff0d554e4619471';
import {makeMuseum} from './museum-view.mjs?v=fg-4ff0d554e4619471';
import {museumCaption} from './museum.mjs?v=fg-4ff0d554e4619471';
import {makeOutdoor} from './outdoor.mjs?v=fg-4ff0d554e4619471';
import {installSeasonBook} from './season-book.mjs?v=fg-4ff0d554e4619471';
import {makeMagicView} from './magic-view.mjs?v=fg-4ff0d554e4619471';
import {installViewControls,orthographicPanDelta,orthographicCameraPose} from './view-controls.mjs?v=fg-4ff0d554e4619471';
import * as THREE from 'three';
import {createMapLoader} from './map-loader.mjs?v=fg-4ff0d554e4619471';
import {makeSurroundings} from './surroundings.mjs?v=fg-4ff0d554e4619471';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=fg-4ff0d554e4619471';
import {millAction,millAt,islandLightError,floatIslandLight,START,MAPS,NODES,gestureError,lakeFrozen,onLakeIce,weather,targetFor,actionError,walkable,findPath,perform,restoreState,freshState,COMPANION_DESTINATIONS,destinationChoices,advanceTime,timeLabel,gardenIntent,seasonOf,hitInteraction,journalText,companionNearby,floorHeight,groundPoint,exitFor,sleepPose,wakeSleeper,deepestAllowed,SEED_KINDS,SEED_DAYS,SEED_PER_DAY,seedError,sowSeed,seedsToday,readySeeds,keepNotes,pinNote,SHARD_KINDS,VEIN_POOL,veinLow,fillVein,pinShard,CRAFT_WAYS,SPOTS,spotsAll,spotKey,isSpot,spotLabel,spotParse,FURNITURE,furnitureAtPoint,approachSpot,lookText,craftError,craftThing,placeThing,placedAt,thingReady,hastenError,hastenThing,bellRings,donate,donateError,collectedKinds,recipeIndex,RECIPE_TOTAL,driftPick,driftError,drawBottle,keepBottleReply,BOTTLE_DAYS,recentHappenings,diveWet,mapFoggy,MAP_FOG_RANGE,restoreNeighbors,asCompanion,moveIn,moveOut,moveInError,neighborOf,freeHouse,NEIGHBOR_HOUSES,OPENINGS,isOpening,opened,openingLine,openingReady,WORKS,workHere,workError,workShort,workCost,doWork,workDone,worksDone,noteMeet,whereLabel,metCount,closeness,MEET_NEAR,SPELLS,SPELL_PLACES,restoreSpells,castError,castSpell,castAt,castLine,castPlaceError,spellOfSeason,sealBottle,sealError,bottleBook,missArrived,missWaiting,missGaveUp,missLetGo,missTaken,missMaterial,talkedWith,QUEST_KINDS,QUEST_TAKEN_MAX,QUEST_CYCLE,questBoard,questTaken,questCycle,questPaid,takeError,takeQuest,turnIn,lampOn,lampShelter,walkSpeedFor,STAR_SPOTS,STAR_ROLES,starError,takeStarRole,starLeave,starLive,starOther,turnStar,starGap,starReading,starAligned,alignStar,starDone,restoreStar,setNeighborDoor} from './world.mjs?v=fg-4ff0d554e4619471';
import {makeForest} from './forest.mjs?v=fg-4ff0d554e4619471';
import {makeDepths} from './depths.mjs?v=fg-4ff0d554e4619471';
import {createTraveler} from './traveler.mjs?v=fg-4ff0d554e4619471';
import {makeCompanionController,dailySchedule,plannedActivity} from './companion.mjs?v=fg-4ff0d554e4619471';const $=id=>document.getElementById(id),KEY='fairy-garden-prototype-v1';
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
const host=embedded&&window.parent.FairyGardenHostFor?window.parent.FairyGardenHostFor(window):null;
if(embedded&&!host){$('load-text').textContent='请从小手机里的「微光庭院」入口重新打开。';throw new Error('Missing garden host');}
if(host)document.body.classList.add('embedded');
let chatting=false,data=freshState(),saveOK=true;try{data=restoreState(host?host.load().world:JSON.parse(localStorage.getItem(KEY)));}catch(e){if(host){$('load-text').textContent=e.message;throw e;}}
const boundPartner=host&&host.partner();if(boundPartner){data.companion.name=boundPartner.name;data.birthday=Math.max(0,Math.min(56,Number(boundPartner.birthday)||0));
 // 他带路：从小手机进的庭院房第一次开档时打开一次；之后听花册里那个开关
 if(!restoreGuide(data.guide).asked)data=setGuide(data,true);}
// ⚠️同行者是谁，世界这边一直不知道（data.partnerId 从来没人写过），于是
//   moveInError 里那句「TA 已经和你住在一起了」一次都没响过——她 2026-09-17 报的
//   「让 a 做邻居再邀请 a 同行就变成两个」就是这么来的：一个人同时占了两个身份。
// ⚠️两件事一起做：把人告诉世界；如果这一位本来住在村里，现在他跟你一起住了，
//   就从那间屋里搬出来。换同行者会重开这一局，所以在这儿做一次就够。
data.partnerId=boundPartner?String(boundPartner.id):'';
if(data.partnerId&&neighborOf(data,data.partnerId))data=moveOut(data,data.partnerId);

const canvas=$('world');let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'low-power'});}catch(e){$('load-text').textContent='这个浏览器暂时无法打开立体画面，请换 Safari 或 Chrome 再试。';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
const scene=new THREE.Scene();scene.background=new THREE.Color('#dfe5d5');scene.fog=new THREE.Fog('#dfe5d5',27,62);
const camera=new THREE.OrthographicCamera(-7,7,7,-7,.1,80);const cameraPan=new THREE.Vector3();camera.position.set(10,12,16);camera.lookAt(0,.5,0);
const hemi=new THREE.HemisphereLight('#f7f1d6','#7d9278',2.1);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0d0',3.5);sun.position.set(-4,10,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.normalBias=.035;sun.shadow.bias=-.0001;scene.add(sun);
const fill=new THREE.DirectionalLight('#d8e9ed',1);fill.position.set(5,4,-5);scene.add(fill);
const surroundings=makeSurroundings();scene.add(surroundings.root);
const assetLoader=new GLTFLoader();
const mapLoader=createMapLoader({maps:MAPS,loadAsset:async url=>{const root=(await assetLoader.loadAsync(url)).scene;root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return root;},factories:{forest:makeForest,depths:makeDepths,museum:makeMuseum},attach:root=>{const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});root.traverse(o=>{if(o.isMesh)o.customDepthMaterial=depth;});scene.add(root);},detach:root=>scene.remove(root)}),mapViews=mapLoader.views;
let lite=false,loadingMap=false,cameraFollow=false,chatFollow=true;
const lakeView=makeLakeView();scene.add(lakeView.root);
const magicView=makeMagicView();scene.add(magicView.seed,magicView.bed,magicView.lamps);
function refreshSeasonPlan(){try{data.seasonPlan=host?.planState(data.day)?.plan||null;}catch{data.seasonPlan=null;}}
function isMenuOpen(){return bottleReading||$('bottle-dialog').open||!!document.querySelector('.scene-activity[open]')||$('companion-dialog').open||$('reset-dialog').open||$('season-dialog').open||$('mill-dialog').open||$('well-dialog').open||$('dream-dialog').open||$('repair-dialog').open;}
const companionController=makeCompanionController();let playerAvatar,companionAvatar,timeAccumulator=0,lastAutoSave=0,lastCompanionUI=0,lastCompanionEvent='';
let seatActivity='sit',receivedUntil=-Infinity,eatingUntil=-Infinity;
const giftFlower=makeHeldFlower();giftFlower.visible=false;scene.add(giftFlower);
let actor,moving=false,path=[],task=null,acting=null,clock=0,ready=false;const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
const targetRing=new THREE.Mesh(new THREE.RingGeometry(.13,.19,32),new THREE.MeshBasicMaterial({color:'#faf9ce',transparent:true,opacity:.9,side:THREE.DoubleSide}));targetRing.rotation.x=-Math.PI/2;targetRing.position.y=.1;targetRing.visible=false;scene.add(targetRing);
const workshopView=makeWorkshopView();scene.add(workshopView.root);
function avatarHand(root){const avatar=root===actor?playerAvatar:companionAvatar;return avatar.handPoint();}
function restoreActivityView(view){cameraPan.copy(view.pan);camera.zoom=view.zoom;actor.rotation.y=view.heading;companionAvatar.root.rotation.y=view.companionHeading;resize(false);ui();}
const brewing=makeBrewingView({scene,camera,site:MAPS.garden.interactions.find(x=>x.kind==='brew'),onClose:restoreActivityView});
// 小灶（她 2026-09-18：「这些吃的怎么融合到进度里」）：自家灶台前的第二口锅，走锅边那套近景；做什么、耗什么全在 world.FOODS
const cookSite=(k=>k?{x:k.x,z:k.z,y:.9}:{...MAPS.home.sites.kitchen.target,y:0})((MAPS.home.furniture||[]).find(f=>f.kind==='kitchen'));
const cooking=makeBrewingView({scene,camera,site:cookSite,onClose:restoreActivityView,id:'cooking-dialog',pot:true});
const FOOD_COLORS={herbs:'#90bb8c',mushrooms:'#b4abdd',sand:'#e6c47f',potions:'#bfe8ea',harvest:'#d6c8f0'};
const scooping=makeScoopingView({scene,camera,lake:lakeView,onClose:restoreActivityView});
const ritual=makeRitualView({scene,camera,onClose:restoreActivityView});
// 星图那一夜的近景、集市的摊面（她 2026-09-18：「不然一直点点点好单调」）
const starchart=makeStarChartView({scene,camera,onClose:restoreActivityView});
const marketView=makeMarketView();scene.add(marketView.root);
function openRitual(spell,shard,place){
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 path=[];task=null;acting=null;moving=false;targetRing.visible=false;
 ritual.open({spell,place,position:actor.position,height:floorHeight(data.map,actor.position,data),helper:companionNearby(data),commit:()=>{
 const err=castError(data,spell,shard,place);if(err)return {ok:false,text:err};
 const before=data;data=castSpell(data,spell,shard,place);if(data===before)return {ok:false,text:'这一下没念成。'};data=spendTime(data,'cast');
 syncOpenings();ui();save();return {ok:true,text:isOpening(place)?OPENINGS[place].done+'。':'封进'+SPELL_PLACES[place]+'了。走过去的时候还能读到这片碎片。'};
 }},view);cameraPan.set(actor.position.x,0,actor.position.z);ritual.camera();
}
const excavating=makeExcavatingView({scene,camera,onClose:restoreActivityView});
const dreamGarden=makeDreamGarden(scene,()=>mapViews);
const placedKeepsakes=makePlacedKeepsakes(scene,()=>mapViews);
const wellSigns=makeWellSigns(scene,{mouth:true});
function depthGatherText(before,after){if(after.stones>before.stones)return '井纹残片 +1。往下的路又通了两层。';const shard=after.shards.find(x=>!before.shards.some(b=>b.id===x.id));return shard?'取出一片'+(WELL_CURIOS[shard.curio]?.name||SHARD_KINDS[shard.kind]||'碎片')+'：'+shard.text:'这处奇物已经采空了。';}
function openExcavating(id){
 const err=actionError(data,'gather',id);if(err){say(err);return;}
 const site=NODES.find(n=>n.id===id),node=mapViews.depths?.node(id);if(!node){say('这一处奇物还没加载好，稍后再试。');return;}
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 path=[];task=null;acting=null;moving=false;targetRing.visible=false;$('progress').hidden=true;data.position={x:actor.position.x,z:actor.position.z};actor.rotation.y=Math.atan2(site.x-actor.position.x,site.z-actor.position.z);
 excavating.open({site,vein:node.vein,helper:companionNearby(data),hand:()=>avatarHand(actor),commit:()=>{const before=data;data=perform(data,'gather',id);if(data===before)return {ok:false,text:'矿点或位置发生了变化，这次没有领取。'};ui();save();return {ok:true,text:depthGatherText(before,data)};}},view);cameraPan.set(site.x,0,site.z);excavating.camera();
}
function openScooping(){
 const err=driftError(data);if(err){say(err);return;}
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 const site=MAPS.garden.lake.bottle;path=[];task=null;acting=null;moving=false;targetRing.visible=false;
 actor.rotation.y=Math.atan2(site.x-actor.position.x,site.z-actor.position.z);
 scooping.open({state:data,helper:companionNearby(data),hand:()=>avatarHand(actor),commit:openBottle},view);cameraPan.set(site.x,0,site.z);scooping.camera();
}
function openBrewing(options){
 if(brewing.active)return;
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 path=[];task=null;acting=null;moving=false;targetRing.visible=false;$('progress').hidden=true;
 data.position={x:actor.position.x,z:actor.position.z};
 const site=MAPS.garden.interactions.find(x=>x.kind==='brew');actor.rotation.y=Math.atan2(site.x-actor.position.x,site.z-actor.position.z);
 brewing.open({...options,helper:companionNearby(data)&&Math.hypot(data.companion.position.x-site.x,data.companion.position.z-site.z)<1.8,helperHand:()=>avatarHand(companionAvatar.root),hand:()=>avatarHand(actor)},view);cameraPan.set(site.x,0,site.z);brewing.camera();
}
function startCook(id){if(cooking.active||brewing.active)return;const err=cookError(data,id);if(err){say(err);return;}
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 path=[];task=null;acting=null;moving=false;targetRing.visible=false;$('progress').hidden=true;data.position={x:actor.position.x,z:actor.position.z};
 const site=cookSite;actor.rotation.y=Math.atan2(site.x-actor.position.x,site.z-actor.position.z);
 cooking.open({title:'小灶 · '+FOODS[id].label,finishLabel:'起锅，装碗',items:Object.entries(FOODS[id].cook).map(([key,count])=>({key,label:BAG_LABELS[key],count,color:FOOD_COLORS[key]})),helper:companionNearby(data)&&Math.hypot(data.companion.position.x-site.x,data.companion.position.z-site.z)<1.8,helperHand:()=>avatarHand(companionAvatar.root),hand:()=>avatarHand(actor),
  commit:()=>{const before=data;data=cook(data,id);if(data===before)return cookError(data,id)||'这一锅没成，材料还在。';data=spendTime(data,'cook');ui();save();return FOODS[id].label+'做好了，放进篮子里。';}},view);cameraPan.set(site.x,0,site.z);cooking.camera();}
function openCook(){const list=$('cook-list');list.innerHTML='';const book=foodBook(data);
 $('cook-hint').textContent='会做的这几样，材料从背包里出。不会的做法，夜市上有得买。';
 for(const it of book.items.filter(i=>i.cook)){const b=document.createElement('button');const err=it.known?cookError(data,it.id):'还不会做，夜市上有它的做法';
  b.textContent=it.label+' · '+Object.entries(FOODS[it.id].cook).map(([k,n])=>BAG_LABELS[k]+' ×'+n).join('、')+(err?'\n'+err.replace(/。$/,''):'');b.disabled=!!err;
  b.onclick=()=>{$('cook-dialog').close();startCook(it.id);};list.append(b);}
 $('cook-dialog').showModal();}
// 吃：篮子里挑一样，捧着碗吃；他在跟前就是一起吃的（相处册一格），结算在 world.eat
function openEat(){const list=$('eat-list');list.innerHTML='';const book=foodBook(data);
 $('eat-hint').textContent=book.pantry.length?(companionNearby(data)?'他在跟前，挑一样一起吃。':'挑一样吃。他在跟前的话，就是一起吃的。'):'篮子是空的。夜市上买，或者在自家灶上做。';
 for(const p of book.pantry){const b=document.createElement('button');const f=FOODS[p.id];b.textContent=p.label+(p.from==='him'?' · 他买的':p.from==='home'?' · 自己做的':'')+'\n'+f.note;
  b.onclick=()=>{const err=eatError(data,p.uid);if(err){say(err);return;}$('eat-dialog').close();path=[];task=null;moving=false;targetRing.visible=false;beginAction({kind:'eat',uid:p.uid,label:p.label});};list.append(b);}
 $('eat-dialog').showModal();}
$('eat-open').onclick=()=>{if(!ready||acting)return;openEat();};$('eat-close').onclick=()=>$('eat-dialog').close();
$('cook-open').onclick=()=>{if(!ready||acting)return;openCook();};$('cook-close').onclick=()=>$('cook-dialog').close();
function openDew(){const key=brewKey(data),recipe=BREWS[key];openBrewing({title:recipe.name,items:recipe.items,commit:()=>{const before=data;data=perform(data,'brew',key);ui();save();return data===before?'材料发生变化，这炉未结算，原材料保留。':'月露 +1，已经装好。带去花圃，可以唤醒尚未开好的花。';}});}
const highlights=[];for(const p of [MAPS.garden.stations.well,MAPS.garden.stations.garden,MAPS.garden.stations.travel]){const ring=new THREE.Mesh(new THREE.RingGeometry(.26,.29,40),new THREE.MeshBasicMaterial({color:'#f9e9b8',transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.105,p.z);scene.add(ring);highlights.push(ring);}
const outdoor=makeOutdoor(scene,[surroundings.root]),rain=outdoor.precipitation;
function updateOutdoor(){outdoor.update(data,mapViews,clock,cameraPan,{lite,span:Math.max(camera.right-camera.left,camera.top-camera.bottom)/camera.zoom});scene.fog.near+=camera.userData.fogOffset||0;scene.fog.far+=camera.userData.fogOffset||0;}
const blooms=new THREE.Group();scene.add(blooms);
const magic=new THREE.Group();scene.add(magic);magic.visible=false;const sparkGeo=new THREE.SphereGeometry(.035,6,4),sparkMat=new THREE.MeshBasicMaterial({color:'#e2efb2'});for(let i=0;i<18;i++)magic.add(new THREE.Mesh(sparkGeo,sparkMat));
function grow(){blooms.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});blooms.clear();for(let i=0;i<data.blooms;i++){const group=new THREE.Group();const site=MAPS.garden.decor.blooms;group.position.set(site.x+i*.5,site.y,site.z+.23);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018,.023,.52,6),new THREE.MeshStandardMaterial({color:'#769876'}));stem.position.y=.26;group.add(stem);for(let j=0;j<5;j++){const p=new THREE.Mesh(new THREE.SphereGeometry(.10,10,7),new THREE.MeshStandardMaterial({color:'#b9ddd4',emissive:'#74bdaa',emissiveIntensity:.2,roughness:.85}));p.scale.set(1, .45,1.4);p.position.set(Math.cos(j*Math.PI*2/5)*.105,.55,Math.sin(j*Math.PI*2/5)*.105);group.add(p);}const c=new THREE.Mesh(new THREE.SphereGeometry(.055,10,7),new THREE.MeshStandardMaterial({color:'#f9e4a5',emissive:'#e5ce7a',emissiveIntensity:.25}));c.position.y=.56;group.add(c);blooms.add(group);}}
function button(id,icon,label,detail){$(id).innerHTML=`<span class="button-icon">${icon}</span><span>${label}<small>${detail}</small></span>`;}
// 我跟着他走那个开关。⚠️声明必须排在 ui() 前面：ui() 里就读它，
//   摆到下面去就是一个 TDZ（这仓库栽过一次：v69.48 修的正是 v69.30 种下的那个）。
let chasing=false;
// 一天的时钟环：七点到二十三点走一圈（她 2026-09-18：地面动作开始花时间了，得看得见今天用掉多少）
function drawDayRing(){const ring=$('day-ring');if(!ring)return;const frac=Math.max(0,Math.min(1,(data.minute-420)/960)),dusk=seasonOf(data.day).dusk;$('day-arc').style.strokeDashoffset=(94.25*(1-frac)).toFixed(2);$('day-clock').textContent=timeLabel(data.minute);ring.classList.toggle('dusk',data.minute>=dusk-90&&data.minute<dusk);ring.classList.toggle('night',data.minute>=dusk);ring.setAttribute('aria-label','今天过去了 '+Math.round(frac*100)+'%，现在 '+timeLabel(data.minute));}
function ui(){drawDayRing();
 $('dream-open').hidden=data.map!=='garden';$('dream-open').disabled=!!acting;
 $('home-sleep').hidden=data.map!=='home';$('wake-player').hidden=!data.sleep?.player;$('wake-companion').hidden=!data.sleep?.companion;for(const id of ['lie-down','bed-select','sleep-mode','wake-player','wake-companion'])$(id).disabled=!!acting;
 const woods=data.map==='forest',down=data.map==='depths',inside=!!MAPS[data.map].interior;refreshSeasonPlan();$('water').textContent='● '.repeat(data.water)+'○ '.repeat(3-data.water);$('blooms').textContent=['幼苗','一朵苏醒','两朵苏醒','可以采收'][data.blooms];
// ⚠️背包那一行原来六样常驻，开局全是 0——占掉一整行，说的全是「你什么都没有」。
//   有的才显示；一样都没有时整行收起来。数还是同一处写，只是空的那几样不摆出来。
 {let carried=0;
  for(const k of ['herbs','mushrooms','potions','harvest','sand','stones']){
   const n=count0(data[k]),cell=$(k).parentElement;
   $(k).textContent=n;cell.hidden=!n;if(n)carried++;}
  $('bag').hidden=!carried;}
 $('place-title').textContent=MAPS[data.map].name;const season=seasonOf(data.day);$('season-open').textContent=`${season.name} · ${season.day}/14 天`; $('date').textContent=`第 ${season.year} 年 · ${season.name} ${season.day} 日 · ${weather(data.day,data.epoch)}`;const currentWeather=weather(data.day,data.epoch);$('weather-icon').textContent=down?'◇':({'晴日':'☼','细雨':'☂','细雪':'❄','薄雾':'≋'})[currentWeather];$('rest').disabled=!MAPS[data.map].stations.rest||!!acting;$('rest').title=woods?'回到庭院后可以休息':'走回屋前休息，进入下一天';
 $('well-tide').hidden=!['garden','depths'].includes(data.map);$('well-tide').textContent=wellContext(data).tide.name+' · 随身小物';
 {const hints=todayHints(data);const list=$('today-list');list.replaceChildren();for(const h of hints.slice(1)){const li=document.createElement('li');li.textContent=h.text;li.dataset.kind=h.kind;list.append(li);}list.hidden=hints.length<2;}
 $('objective').textContent=todayHints(data)[0]&&todayHints(data)[0].kind!=='free'?todayHints(data)[0].text:inside?'在'+MAPS[data.map].name+'走走歇歇':down?(data.stones?'再往深处找找井纹残片':'在这几层找到第一颗井纹残片'):woods?'带一些森林的微光回家':data.blooms===3?'月光花开了，可以采收':data.potions?'用月露唤醒整圃月光花':data.herbs>=2&&data.mushrooms?'材料齐了，试试炼制月露':'沿着庭院小路，去林间采集';
 if(down){button('well','◈','刨一处奇物','走过去 · 寻找井底遗落之物');button('garden','↡','再往下一层','找到井纹残片 · 打开深层');}
 else if(woods){button('well','❧','采铃叶草','每丛 2 份 · 炼药材料');button('garden','✧','采荧光菇','每丛 1 份 · 炼药材料');}
 else{button('well','♧','井边取水','走过去 · 装满水壶');button('garden','✿',data.blooms===3?'采收月光花':data.potions?'月露浇灌':'照料花圃',data.blooms===3?'收入花藏 · 留根再生':data.potions?'消耗月露 ×1 · 整圃开花':'消耗清水 ×1 · 唤醒一朵');}
 $('skate-lake').hidden=data.map!=='garden'||!lakeFrozen(data);$('skate-lake').disabled=!!acting;
 $('sit-pond').hidden=!MAPS[data.map].seats&&!data.seat;$('sit-pond').textContent=data.seat?'起身走走':data.map==='garden'?'去月湖栈桥坐下':'去池边坐下';$('sit-pond').disabled=!!acting;$('brew').hidden=data.map!=='garden';$('well').hidden=inside;$('garden').hidden=inside;$('enter-home').hidden=!MAPS[data.map].exits.enter;$('enter-home').disabled=!!acting;
 $('brew').textContent=data.sand>=3?'⚗ 用星砂炼月露':'⚗ 炼制月露';$('brew').title=data.sand>=3?'星砂 ×3':'铃叶草 ×2 + 荧光菇 ×1 + 清水 ×1；或星砂 ×3';
 $('travel').textContent=MAPS[data.map].exits.travel?.label||(inside?'走出小屋':down?'↑ 顺着梯子上去':woods?'↙ 返回微光庭院':'↗ 前往萤光林地');fillDoors();
 $('dive').hidden=data.map!=='garden';$('dive').textContent=diveWet(data)?'↓ 下到井里 · 井壁湿滑，慢一截':'↓ 下到井里';
 // 锅里做东西：背包里有碎片才亮
 {const n=(data.shards||[]).length;$('craft').hidden=data.map!=='garden';$('craft').disabled=!!acting||!n;
  $('craft').textContent=n?'⚗ 用碎片做东西 ×'+n:'⚗ 锅里还没材料';}
 // 公告栏：手上有能交的就说出来，别让她自己一件件点开看
 {const ready=questTaken(data).filter(q=>questPaid(data,q)).length;
  $('board').hidden=!MAPS[data.map].stations.board;$('board').disabled=!!acting;
  $('board').textContent=ready?'📌 公告栏 · 有 '+ready+' 件能交':'📌 看公告栏';}
 // 一起走这一组：叫他跟着／不用跟了／我跟着他。⚠️三件事摆在一排，
 //   原来只有「叫他跟着」，而且埋在同行者弹层里，她要「取消」的时候找不到。
 {const same=data.companion.map===data.map,following=data.companion.mode==='follow';
  $('walk-together').hidden=!same&&!following;$('walk-together').disabled=!!acting;
  $('walk-together').textContent=following?'不用跟着我了':'叫他一起走';
  $('follow-him').hidden=!same;$('follow-him').disabled=!!acting||following;
  $('follow-him').textContent=chasing?'不跟了':'我跟着他走';}
 // 漂流瓶：水在庭院里，一天一只。
 {const err=driftError(data);
  $('bottle').hidden=!MAPS[data.map].stations.bottle;$('bottle').disabled=!!acting||!!err;
  $('bottle').textContent=err?'🫙 今天的已经捞过了':'🫙 捞漂流瓶';}
 // 留下一件：只在馆里才有这个按钮（人已经站在展厅里了，不用再走一趟）。
 // ⚠️捐进去的东西背包挤不掉，这是做东西那条链唯一的出口。
 {const n=(data.things||[]).filter(t=>thingReady(data,t)).length;
  $('museum').hidden=data.map!=='museum';$('museum').disabled=!!acting;
  $('museum').textContent=n?'🏛 留下一件 · 有 '+n+' 件能留':'🏛 留下一件';}
 // 种下一句：⚠️种在【花圃那儿】种，不在册子里种（她 2026-09-17）
 {const err=seedError(data);
  $('sow').hidden=!MAPS[data.map].stations.sow;$('sow').disabled=!!acting||!!err;
  $('sow').textContent=err&&data.map==='garden'?'✎ '+err.replace(/。$/,''):'✎ 种下一句';}
 // 花笺：地里开好几株就写几株，一次全收（一次＝一枪）
 {const n=readySeeds(data).length;$('notes').hidden=data.map!=='garden';$('notes').disabled=!!acting||!n;
  $('notes').textContent=n?'✿ 收花笺 ×'+n:'✿ 花还没开';}
 for(const id of ['well','garden','brew','travel','dive'])$(id).disabled=!!acting;
 {const err=actionError(data,'cast');$('cast').hidden=!MAPS[data.map].stations.cast;$('cast').disabled=!!acting||!!err;
  $('cast').textContent=err&&data.map==='forest'?'✧ '+err.replace(/。$/,''):'✧ 念一个咒';}
 $('magic-action').parentElement.hidden=down||inside;$('magic-action').textContent=woods?'一起唤醒种子':!data.magic.planted?'种下星铃种子':data.magic.growth>=2?'采收星铃花':'照料星铃花';$('make-lamp').hidden=woods;for(const id of ['magic-action','make-lamp'])$(id).disabled=!!acting;
 grow();refreshTime();updateCompanionUI();blooms.visible=data.map==='garden';document.body.classList.toggle('forest',woods);document.body.classList.toggle('depths',down);
(() => {
  // ── 修一修这儿（她 2026-09-17：「做④吧宝宝」）────────────────────────
  // ⚠️走到那儿才出现：这不是行动栏里常驻的一颗，是【站在旧塔底下】才有的一件事。
  // ⚠️缺什么写在按钮上，不是点了才说：让她在决定走过去之前就知道还差几样。
  const id=workHere(data),b=$('fix-place');
  b.parentElement.hidden=!id;b.hidden=!id;
  if(id){const w=WORKS[id],short=workShort(data,id);
   b.disabled=!!acting||short.length>0;
   b.textContent=short.length?w.label+'（还差'+short.join('、')+'）':'修好'+w.label;
   b.title=w.hint+'：'+workCost(id);}
 })();
 placeHint();
 quietPanelButtons();tidyActions();
}
// 行动面板收拾一遍（她 2026-09-17 截图：「这个行动也太挤了」）。
// ⚠️这会儿【做不了】的那些照样要留着——她得看得见还有这么一件事，也得看得见为什么做不了
//   （按钮上写着「锅里还没材料」「花还没开」）。所以不是删掉，是收进一格里。
// ⚠️只认 disabled，不逐个按钮写规则：以后再加行动，这儿一个字都不用改。
const actionHome=new WeakMap();
function tidyActions(){
 const box=$('blocked-list'),wrap=$('blocked');if(!box)return;
 const buttons=[...$('panel-content').querySelectorAll('.secondary-actions > button, .actions > button')];
 let blocked=0;
 for(const b of buttons){
  if(!actionHome.has(b))actionHome.set(b,{parent:b.parentElement,next:b.nextElementSibling});
  const home=actionHome.get(b);
  if(home.parent===box)continue;                       // 自己就住在这一格里的不动
  if(b.classList.contains('from-scene'))continue;
  const away=b.disabled&&!b.hidden&&!acting;
  if(away){blocked++;if(b.parentElement!==box)box.append(b);}
  else if(b.parentElement!==home.parent){home.parent.insertBefore(b,home.next&&home.next.parentElement===home.parent?home.next:null);}
 }
 wrap.hidden=!blocked;$('blocked-count').textContent='这会儿做不了的 '+blocked+' 件';
 if(!blocked)wrap.open=false;
 // 空了的那几行别在面板里占一条缝
 for(const row of $('panel-content').querySelectorAll('.secondary-actions')){
  if(row===box||row.id==='map-doors')continue;
  row.hidden=![...row.children].some(x=>!x.hidden);
 }
}
// 雨铃：真下雨、真挂在屋檐下才响。⚠️这一句是代码说的，不是模型生成的
// Named doors use the same exit metadata as player travel and companion routing.
// ── 门收成一颗（她 2026-09-17：「整理一下 ui」）──────────────────────────
// ⚠️codex 每盖好一间屋，这儿就多一颗「走进 X」——她截图那一版已经七颗，占掉半屏，
//   而且只会越来越长。三颗以上就收成一颗「进屋去…」，点开再挑。
// ⚠️门在场景里本来就走得到（门就在那儿点得到），这一颗只是给「懒得找门」留的路，
//   跟她早先定的「撤掉场景里点得到的按钮」是同一条：不删路，只是不摊在台面上。
const DOORS_INLINE=3;
let doorsMap='';
const doorsOf=()=>Object.entries(MAPS[data.map].exits||{}).filter(([,e])=>e.action==='door');
function openDoors(){
 const list=$('spot-list');list.replaceChildren();
 for(const [id,e] of doorsOf()){const b=document.createElement('button');b.textContent=e.label;
  b.disabled=!!acting;b.onclick=()=>{$('spot-dialog').close();request('door',id);};list.append(b);}
 $('spot-title').textContent='进屋去';$('spot-note').hidden=true;
 $('spot-dialog').showModal();
}
function fillDoors(){const box=$('map-doors'),doors=doorsOf();
 if(doorsMap!==data.map){doorsMap=data.map;box.replaceChildren();
  if(doors.length>DOORS_INLINE){const b=document.createElement('button');
   b.textContent='进屋去… '+doors.length+' 处';b.dataset.door='more';b.onclick=openDoors;box.append(b);}
  else for(const [id,e]of doors){const b=document.createElement('button');b.textContent=e.label;
   b.dataset.door=id;b.onclick=()=>request('door',id);box.append(b);}}
 box.hidden=!box.children.length;for(const b of box.children)b.disabled=!!acting;}
// 修好的那几处：走到了就该看出来是弄过的（跟灯下那句同一个道理）
function workLine(){
 if(data.map!=='garden')return '';
 for(const [id,w] of Object.entries(WORKS)){
  if(!w.site||!w.there||!workDone(data,id))continue;
  const site=MAPS.garden.sites[w.site];if(!site)continue;
  if(Math.hypot(site.target.x-data.position.x,site.target.z-data.position.z)<=2.4)return w.there;
 }
 return '';
}
function lampLine(){return lampShelter(data)?'小路那盏灯下站着个人，在躲雨。':lampOn(data)?'你们修好的那盏灯亮着。':'';}
function bellLine(){return bellRings(data)?'屋檐下的雨铃在响。'+(data.companion.map==='garden'?data.companion.name+'路过时站住听了一会儿。':''):'';}
function showMap(atPlayer=false){syncOpenings();const center=atPlayer&&actor?{x:actor.position.x,z:actor.position.z}:MAPS[data.map].view||{x:0,z:0};cameraPan.set(center.x,0,center.z);const extent=MAPS[data.map].radius+2;sun.shadow.camera.left=-extent;sun.shadow.camera.right=extent;sun.shadow.camera.top=extent;sun.shadow.camera.bottom=-extent;sun.shadow.camera.updateProjectionMatrix();for(const [id,view] of Object.entries(mapViews)){view.root.visible=id===data.map;for(const root of view.stream?.roots()||[])root.visible=view.root.visible;}highlights.forEach(h=>h.visible=data.map==='garden');const map=MAPS[data.map];scene.background.set(map.background);scene.fog.color.set(map.background);sun.intensity=map.light;ui();resize();}
function flash(){ $('arrival').classList.add('flash');setTimeout(()=>$('arrival').classList.remove('flash'),350);}
// ⚠️那句提示原来只长在行动栏里面（#message 在 panel-content 里）：她把行动栏收起来，
//   点花圃说「先去井边打一壶水」这种话就一个字都看不见了——她 2026-09-17 报的
//   「我要打开展开行动才能看到提示」。收起来的时候在画面底上再浮一条。
//   ⚠️只有这一处写提示：两处各写一份，迟早一处改了另一处还留着旧话。
let sayTimer=0;
// ⚠️那条「轻点行走·拖动画面·双指缩放」原来按固定像素摆，行动面板一封顶就压在面板上
//   （她 2026-09-17 那一版正好盖住同行者那一条）。百分比也不行：它的包含块不是整屏。
//   所以照【面板此刻的上沿】摆——面板多高，它就退到哪儿。
// ⚠️只有这一处算位置：ui() 和收起／展开那一下都叫它，收起来时它才不会停在小人脸上。
const count0=v=>Math.max(0,Number.isFinite(Number(v))?Math.floor(Number(v)):0);
// 气泡最低只能到哪儿（她 2026-09-18：「气泡在太下面了」）。
// ⚠️原来只有【不许太高】那一道闸（118+高度），没有【不许太低】的：
//   他站在画面下半截时，那句话就掉进行动栏／聊天页里，她根本看不见。
// ⚠️聊天开着的时候下面那张纸是手机那一侧的（最高 52%），游戏这边没有它的节点，
//   所以按同一个数算——两处写同一个比例，改的时候一起改。
const CHAT_SHEET=.52, SCENE_TOP=118;
// 这会儿的庭院露出多少：下面那张纸的上沿。⚠️聊天开着的时候盖住画面的是
//   手机那一侧那张纸（最高 52%），不是行动栏——行动栏那时是 visibility:hidden，
//   它的 rect 还在原地，拿它当底就永远差一截。两处（藏不藏气泡、气泡摆多低）
//   必须用同一个数，不然会出现「气泡还在，但人已经判成看不见了」。
function sceneBottom(){
 if(chatting)return innerHeight*(1-CHAT_SHEET);
 const panel=$('action-panel');
 return panel&&!panel.hidden?panel.getBoundingClientRect().top:innerHeight;
}
// 一只气泡该摆在哪儿：跟着头顶走，但上不许顶到顶栏，下不许贴着那张纸的边。
// ⚠️「贴着边」就是她 2026-09-18 说的「太下面了」：他站在画面下半截时，
//   那句话被挤在最后一道缝里，看着像掉出去了。留出那一截可读的余地。
function bubbleTop(el,y){
 const bottom=sceneBottom(), floor=bottom-Math.max(12,(bottom-SCENE_TOP)*.18);
 return Math.min(Math.max(y-19,SCENE_TOP+el.offsetHeight),floor);
}
function placeHint(){
 const panel=$('action-panel'),hint=$('hint');
 if(panel&&hint)hint.style.bottom=(innerHeight-panel.getBoundingClientRect().top+10)+'px';
 // 行动栏占掉的那一截报给外面（她 2026-09-18：「音乐栏压着画面」）。
 // ⚠️这块画布是整屏的，悬浮播放器默认就停在右下角——正好压在行动栏上。
 //   报的是【同一个数】：气泡不许低过的那条线，也是悬浮工具不许落进去的那条线。
 //   在这一处报，是因为它本来就在折叠、改尺寸、刷界面这三处都会被叫到。
 if(host&&host.floatClear)try{host.floatClear(Math.max(0,innerHeight-sceneBottom()));}catch(e){}
}
function say(s){
 $('message').textContent=s;
 const note=$('say-note'),folded=$('panel-content').hidden;
 clearTimeout(sayTimer);
 if(!s||!folded){note.hidden=true;return;}
 note.textContent=s;note.hidden=false;
 sayTimer=setTimeout(()=>{note.hidden=true;},4200);
}
function save(){if(actor)data.position={x:actor.position.x,z:actor.position.z};try{if(host){if(boundPartner)data.companion.name=boundPartner.name;const {seasonPlan,...saved}=data;if(!host.save(saved))throw Error('存档窗口已切换');}else {const {seasonPlan,...saved}=data;localStorage.setItem(KEY,JSON.stringify(saved));}saveOK=true;$('save').textContent='已保存在这台设备';}catch{saveOK=false;$('save').textContent='存储失败 · 暂勿关闭页面';}return saveOK;}
function resize(updateSize=true){const w=innerWidth,h=innerHeight;if(updateSize)renderer.setSize(w,h,false);const aspect=w/h;const spanX=MAPS[data.map].viewSpan|| (aspect<1?(h<730?14:12.8):Math.max(14,16*aspect));const spanY=spanX/aspect;const offset=aspect<1?(h<730?2.0:1.4):2.1;const pose=orthographicCameraPose(cameraPan,spanY,camera.zoom,offset);camera.position.set(pose.position.x,pose.position.y,pose.position.z);camera.lookAt(pose.target.x,pose.target.y,pose.target.z);camera.far=pose.far;camera.userData.fogOffset=pose.fogOffset;camera.updateMatrixWorld();camera.left=-spanX/2;camera.right=spanX/2;camera.top=spanY/2;camera.bottom=-spanY/2;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
async function load(){try{const loader=assetLoader;await mapLoader.ensure(data.map,data.position);const a=await loader.loadAsync('./doll.glb?v=fg-4ff0d554e4619471');playerAvatar=createTraveler(a.scene);actor=playerAvatar.root;actor.name='Player';scene.add(actor);companionAvatar=createTraveler(a.scene,true);companionAvatar.root.name='Companion';scene.add(companionAvatar.root);dollSource=a.scene;marketView.setDoll(dollSource);syncNeighbors();
 // 存档里存着的样貌（发型/发色/衣色）——没有就用 traveler.mjs 的默认。换发型是数据，不是另导一个模型。
 if(data.look)playerAvatar.setLook(data.look);if(data.companion&&data.companion.look)companionAvatar.setLook(data.companion.look);
 actor.position.set(data.position.x,.08,data.position.z);actor.rotation.y=.35;ready=true;showMap(true);if(data.map==='forest')say('林间的微光还在，背包和采集进度也都留下了。');else if(data.blooms)say('你上次照料过的月光花，还在这里。');$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),550);save();window.dispatchEvent(new Event('garden-ready'));if(host)host.ready();}catch(e){console.error(e);$('load-text').textContent='素材没有加载完成，请刷新重试。'+e.message;}}
function go(target,job=null){if(!ready||acting)return false;const points=findPath({x:actor.position.x,z:actor.position.z},target,data.map,[],data);if(!points?.length){say('那边暂时走不过去，换一块空地试试。');return false;}data.seat=null;data=wakeSleeper(data);companionController.reset();ui();cameraFollow=true;path=points;task=job;targetRing.position.set(target.x,floorHeight(data.map,target,data)+.025,target.z);targetRing.visible=true;$('hint').style.opacity=0;if(!job)say(onLakeIce(data.map,target,data)?'轻轻蹬一下，沿着月湖的冰面滑过去。':data.map==='depths'?'脚下是碎石，慢一点。':data.map==='forest'?'脚步轻一点，草叶里藏着小小的光。':'慢慢走，庭院里的路都属于这个下午。');return true;}
function request(kind,id){if(!ready||acting||loadingMap)return;if(kind==='rest'&&sleepPose(data)){beginAction({kind});return;}const err=actionError(data,kind,id);if(err){say(err);return;}const p=targetFor(data,kind,id);if(!p)return;if(go(p,{kind,id,sleepMode:kind==='bed'?$('sleep-mode').value:null}))say(kind==='door'?exitFor(data.map,kind,id).label+'。':kind==='visit'?`去${MAPS[data.map].sites[id].label}看看。`:({dreamSow:'带着梦种，走到花圃边。',dreamHarvest:'去把开好的梦花收回家。',bed:'去选好的卧室，慢慢歇下来。',enter:'回到门口，走进自己的小屋。',sit:data.map==='garden'?'去月湖的栈桥上找个位置坐下。':'去池塘边找个位置坐下。',well:'去井边装一壶清水。',garden:data.blooms===3?'去把开好的月光花收进花藏。':data.potions?'带着月露，去唤醒整圃花。':'沿着小路，去看看花圃。',brew:'带齐材料，去炼药锅旁边。',travel:data.map==='garden'?'沿着庭院小路，走向林间。':'穿过石门，带着收获回家。',dive:'走到井边，扶着绳梯往下。',deeper:'找到那个往下的洞口。',ladder:'走回梯子下面。',seed:'去林地的微光旁，等同行者一起唤醒种子。',star:'去看看星铃花。',lamp:'把花带到屋前，做一盏星铃灯。',gather:data.map==='depths'?'走近奇物，轻轻扫开浮土。':'走近一点，摘下这一丛森林的礼物。',rest:'回屋睡一觉，让日子慢慢往前走。',board:'去公共厅门前看看板子上贴着什么。',bottle:'走到水边，去捞那只漂流瓶。',sow:'走到花圃边上，蹲下来。',cast:'走到林后那棵许愿树下。'})[kind]||'');}
let digging=false;
async function fillPool(){
 if(digging||!host||!host.dig)return false;
 digging=true;ui();
 try{const out=await host.dig(data.depth||1);const before=data;data=fillVein(data,out);
  if(data!==before)save();return true;}
 catch(e){say(e&&e.message||'这一层的石头里什么都没读出来。');return false;}
 finally{digging=false;ui();}
}
function gather(kind){
 // 井底：这一层没刨过的都算，离得近的先来（星砂井纹残片不用分开点两个按钮）
 if(kind==='vein'){const here=NODES.filter(n=>n.map==='depths'&&n.depth===data.depth&&!data.picked.includes(n.id))
  .sort((a,b)=>Math.hypot(a.x-actor.position.x,a.z-actor.position.z)-Math.hypot(b.x-actor.position.x,b.z-actor.position.z));
  if(!here.length){say('这一层的奇物都刨空了。再往下一层，或者顺着梯子上去。');return;}
  request('gather',here[0].id);return;}
 const available=NODES.filter(n=>n.kind===kind&&!data.picked.includes(n.id)).sort((a,b)=>Math.hypot(a.x-actor.position.x,a.z-actor.position.z)-Math.hypot(b.x-actor.position.x,b.z-actor.position.z));if(!available.length){say('今天的'+(kind==='herb'?'铃叶草':'荧光菇')+'采完了。回屋睡到明天，它们会重新长出来。');return;}request('gather',available[0].id);}
$('magic-action').onclick=()=>{if(data.map==='forest'){if(actionError(data,'seed')){say(actionError(data,'seed'));return;}data.companion.mode='follow';companionController.reset();request('seed');}else request('star');};$('fix-place').onclick=()=>{const id=workHere(data);if(!id)return;
 const err=workError(data,id);if(err){say(err);return;}
 const before=data;data=doWork(data,id);
 if(data===before){say('这一件这会儿动不了手。');return;}
 say(WORKS[id].done+'。'+(WORKS[id].there||''));ui();save();};
$('make-lamp').onclick=()=>request('lamp');
$('well').onclick=()=>data.map==='forest'?gather('herb'):data.map==='depths'?gather('vein'):request('well');
$('garden').onclick=()=>data.map==='forest'?gather('mushroom'):data.map==='depths'?request('deeper'):request('garden');
$('brew').onclick=()=>request('brew');
for(const [id,activity] of [['seat-tea','tea'],['seat-read','read'],['seat-idle','sit']])$(id).onclick=()=>{if(data.seat&&!acting){seatActivity=activity;say(activity==='tea'?'捧起杯子，慢慢喝一口。':activity==='read'?'把书放在手边，慢慢翻一页。':'收好东西，坐着看看水面。');}};
for(const kind of ['wave','stretch'])$('gesture-'+kind).onclick=()=>{
 if(!ready||acting||loadingMap||isMenuOpen())return;
 data.position={x:actor.position.x,z:actor.position.z};const err=gestureError(data,kind);
 // 同行者不在跟前、邻居在跟前：这一下是冲邻居挥的（世界那头记交情，打招呼那句问宿主要）
 const nb=kind==='wave'&&err?neighborNear(data):null;
 if(err&&!(nb&&!neighborWaveError(data,nb.charId))){say(err);return;}
 path=[];task=null;moving=false;targetRing.visible=false;
 beginAction(nb?{kind,greetTo:String(nb.charId),neighbor:true}:{kind,greetTo:data.partnerId||data.companion.name});
};
// ── 递一样东西（礼物簿）。挑什么在这儿的小页里，结算在 world.giveGift，他喜不喜欢问宿主那张表
const giftGate=()=>{const opts=giftOptions(data);if(!opts.length)return '手上还没有能递的东西。';const nb=giftTarget();return nb?neighborGiftError(data,nb,opts[0].ref):giftError(data,opts[0].ref);};
function openGift(){const list=$('gift-list');list.innerHTML='';const opts=giftOptions(data);
 const nb=giftTarget(),who=nb?neighborOf(data,nb):null;
 $('gift-hint').textContent=opts.length?(who?'递给'+who.name+'。邻居不挑东西，收了就是交情。':'挑一样递过去。一天只递一样，所以挑一挑。'):'手上还没有能递的东西：花圃、井里、锅里都长得出来。';
 for(const o of opts){const b=document.createElement('button');b.textContent=o.name+' · '+o.familyLabel+(o.note?'\n'+o.note.slice(0,60):'');b.onclick=()=>pickGift(o);list.append(b);}
 $('gift-dialog').showModal();}
let giftAsking=false;
async function pickGift(o){if(giftAsking||!ready||acting)return;giftAsking=true;
 try{let taste=null;
  const nb=giftTarget();
  if(nb){const err=neighborGiftError(data,nb,o.ref);if(err){say(err);return;}$('gift-dialog').close();const before=data;data=giveToNeighbor(data,nb,o.ref);if(data!==before){save();say((data.happenings||[])[0]?.text+'。');}ui();return;}
  if(host&&host.tastes){if(!host.hasTastes())say('第一次递东西给 TA。先问问 TA 心里怎么想的，再递过去…');
   try{const rows=await host.tastes();taste=(rows||[]).find(r=>r.family===o.family)||null;}catch(e){say(e.message);return;}}
  if(!ready||acting)return;data.position={x:actor.position.x,z:actor.position.z};const err=giftError(data,o.ref);if(err){say(err);return;}
  $('gift-dialog').close();path=[];task=null;moving=false;targetRing.visible=false;
  beginAction({kind:'gift',ref:o.ref,name:o.name,taste,giftTo:data.partnerId||data.companion.name});
 }finally{giftAsking=false;}}
// 邻居打招呼那句：他自己人设长的（宿主一枪，一位邻居一辈子一次），按处到哪一档挑一句
async function helloNeighbor(id){const n=neighborOf(data,id);if(!n)return;
 if(!host||!host.hello){say(n.name+'抬手应了一下。');return;}
 try{const rows=await host.hello(id);const tier=closeness(data,id);const line=(rows||[]).find(r=>r.tier===tier)||(rows||[])[0];if(line&&line.text)say(n.name+'：'+line.text);}
 catch(e){say(e&&e.message||n.name+'抬手应了一下。');}}
$('give-flower').onclick=()=>{if(!ready||acting)return;data.position={x:actor.position.x,z:actor.position.z};const gate=giftGate();if(gate&&!giftOptions(data).length){say(gate);return;}openGift();};
// 递给谁：同行者在跟前就是他；不在、邻居在跟前就是邻居（邻居那份不问喜好，只算交情）
const giftTarget=()=>{if(data.companion.map===data.map&&Math.hypot(data.position.x-data.companion.position.x,data.position.z-data.companion.position.z)<=NEIGHBOR_HAND)return null;const nb=neighborNear(data,NEIGHBOR_HAND);return nb?String(nb.charId):null;};
$('gift-close').onclick=()=>$('gift-dialog').close();
// ⚠️v69.63 撤地点下拉那一版把这六行一起删了：从那天起进不了自己家、床铺安排整套不可达、
//   「去月湖滑冰」也是死的。后面的逻辑一行没坏（request('enter')／arrangeSleep／wakeSleeper 都在），
//   只是按钮不接线——所以这六行【原样】抄回来，不改行为。
for(const [id,b]of Object.entries(MAPS.home.beds)){const o=document.createElement('option');o.value=id;o.textContent=b.label;$('bed-select').append(o);}
$('lie-down').onclick=()=>request('bed',$('bed-select').value);
$('wake-player').onclick=()=>{if(acting)return;data=wakeSleeper(data);ui();save();say('起床了，今天慢慢来。');};
$('wake-companion').onclick=()=>{if(acting)return;data=wakeSleeper(data,'companion');companionController.reset();ui();save();say('轻轻叫 TA 起床。');};
$('enter-home').onclick=()=>request('enter');
$('skate-lake').onclick=()=>{if(go(MAPS.garden.lake.skateStart)){say('走上月湖就会换上冰鞋；点冰面滑过去，点岸边回到小路。想一起滑，可以叫同行者跟随。');}};
function sitAt(id){seatActivity='sit';if(data.seat===id){data={...data,seat:null};companionController.reset();ui();save();return;}request('sit',id);}
$('sit-pond').onclick=()=>sitAt(data.seat||'pond');
$('sit-island').onclick=()=>sitAt('island');
$('water-light').onclick=()=>{const err=islandLightError(data);if(err){say(err);return;}$('wish-text').value='';$('wish-dialog').showModal();};
$('wish-close').onclick=()=>$('wish-dialog').close();
$('wish-go').onclick=()=>{const err=islandLightError(data);if(err){say(err);$('wish-dialog').close();return;}const wish=$('wish-text').value.trim();data=floatIslandLight(data,wish);$('wish-dialog').close();ui();save();say((lakeFrozen(data)?'小灯留在冰面上，暖光慢慢晃着。':'小灯落在水上，缓缓漂向湖心。')+(wish?'那句话跟着灯走了。':''));};
// 集市：功绩换东西（她 2026-09-18 的 5）。货和价在 world.MARKET_GOODS 一处
function openMarket(){const list=$('market-list');list.innerHTML='';const open=marketOpen(data),night=nightMarketOpen(data);
 $('market-hint').textContent=night?'夜市。一季只有这两晚。功绩 '+(data.deeds||0)+' 分，不够的拿材料换；摊后站着的是村里的邻居。':open?'集市日。功绩 '+(data.deeds||0)+' 分，替村里做事（交委托、往馆里留新的一种）能攒。今天上摊的就这几样，下次不一样。':nightMarketDay(data.day)?'今晚有夜市，天黑后开。':'今天不是集市日，下次是第 '+nextMarketDay(data.day)+' 天；夜市在第 '+nextNightMarket(data.day)+' 天晚上。';
 if(night)for(const id of nightStock(data)){const b=document.createElement('button');const err=foodError(data,id),v=vendorOfFood(data,id);b.textContent=foodLabel(id)+' · '+(recipeOf(id)?RECIPE_COST+' 分':FOODS[id].cost+' 分'+(FOODS[id].swap?'（或拿'+Object.entries(FOODS[id].swap).map(([k,n])=>BAG_LABELS[k]+' ×'+n).join('、')+'换）':''))+(v?' · '+v.name+'的摊':'');b.disabled=!!err;b.title=err;b.onclick=()=>{const e2=foodError(data,id);if(e2){say(e2);return;}data=buyFood(data,id);ui();save();say((data.happenings||[])[0]?.text+'。');openMarket();};list.append(b);}
 if(open)for(const id of marketStock(data)){const gd=marketGood(id);const b=document.createElement('button');b.textContent=gd.stall+' · '+gd.label+' · '+gd.cost+' 分';b.disabled=!!marketError(data,id);b.title=marketError(data,id);b.onclick=()=>{const err=marketError(data,id);if(err){say(err);return;}data=buy(data,id);ui();save();say((data.happenings||[])[0]?.text+'。');openMarket();};list.append(b);}
 $('market-dialog').showModal();}
// 点摊面上的货：走到那座摊子跟前再买（买不起也走过去，摊主会告诉她差多少）
function buyGood(id){if(!ready||acting||loadingMap)return;const front=marketView.stallFront(id);if(!front)return;data.position={x:actor.position.x,z:actor.position.z};if(atMarket(data)&&Math.hypot(actor.position.x-front.x,actor.position.z-front.z)<1.4){beginAction({kind:'buy',id});return;}if(go(front,{kind:'buy',id}))say('走到'+(marketGood(id)?marketGood(id).stall:vendorSpot(stallOfGood(id))?.label||'摊子')+'跟前。');}
const stallOfGood=id=>recipeOf(id)?'tea':foodOf(id)?FOODS[id].stall:null;
$('market-open').onclick=()=>{if(!ready||acting)return;data.position={x:actor.position.x,z:actor.position.z};if(!atMarket(data)){say('先走到灯串集市。');return;}openMarket();};$('market-close').onclick=()=>$('market-dialog').close();
$('mill-open').onclick=()=>request('mill');
$('mill-close').onclick=()=>$('mill-dialog').close();
// 走近了跟邻居说句话（她 2026-09-18 的 a）：一天一位一次，每次现打一枪。
// ⚠️发给 TA 的是 neighborView 裁好的那一份，不是 snapshot——同行者那条线一个字都不给。
//   门上开了哪几条由她在邻居那一页拨，这儿只负责把两样原样交给宿主。
let sayingTo='';
async function sayToNeighbor(){
 if(!ready||acting||loadingMap||sayingTo)return;
 data.position={x:actor.position.x,z:actor.position.z};
 const nb=neighborNear(data,NEIGHBOR_REACH);
 if(!nb){say('身边没有邻居。');return;}
 const err=neighborTalkError(data,nb.charId);if(err){say(err);return;}
 if(!host||!host.neighborSay){say('从小手机里的庭院进来，才听得见 TA 说话。');return;}
 sayingTo=nb.charId;refreshLeisure();say('你走过去，'+nb.name+'抬起头…');
 try{
  const lines=await host.neighborSay({charId:nb.charId,door:{...nb.door},view:neighborView(data,nb.charId)});
  // ⚠️回来之后重新核一遍：这一枪打了十几秒，她可能已经走开、或者换了一天
  if(neighborTalkError(data,nb.charId)){say('说话的劲头过去了，明天再找 TA。');return;}
  data=noteNeighborTalk(data,nb.charId,lines[0]);save();ui();
  speak(lines,nb.name);
 }catch(e){say(e&&e.message||'这次没听清 TA 说什么。');}
 finally{sayingTo='';refreshLeisure();}
}
$('neighbor-say').onclick=sayToNeighbor;
function refreshLeisure(){
 // 身边有邻居才露出来；今天聊过了就变灰，title 说明白为什么
 {const nb=neighborNear(data,NEIGHBOR_REACH);const err=nb?neighborTalkError(data,nb.charId):'身边没有邻居。';
  $('neighbor-say').hidden=!nb;$('neighbor-say').disabled=!!acting||!!err||!!sayingTo;
  $('neighbor-say').title=err;
  $('neighbor-say').textContent=sayingTo?'TA 正在想…':(nb?'跟'+nb.name+'说句话':'跟邻居说句话');}
 for(const id of ['seat-tea','seat-read','seat-idle']){$(id).hidden=!data.seat;$(id).disabled=!!acting;}
 for(const kind of ['wave','stretch']){const err=gestureError(data,kind);$('gesture-'+kind).disabled=!!acting||!!err;$('gesture-'+kind).title=err;}
 $('give-flower').hidden=data.map!==data.companion.map&&!neighborNear(data,NEIGHBOR_HAND);$('give-flower').disabled=!!acting||!!giftGate();$('give-flower').title=giftGate();
 $('sit-island').hidden=data.map!=='garden';$('sit-island').disabled=!!acting;
 $('sit-island').textContent=data.seat==='island'?'从小岛起身':'去小岛坐坐';
 $('market-open').hidden=!atMarket(data);$('market-open').disabled=!!acting;$('market-open').textContent=nightMarketOpen(data)?'逛夜市':marketDay(data.day)?'逛集市':nightMarketDay(data.day)?'今晚有夜市':'下次集市 · 第 '+nextMarketDay(data.day)+' 天';$('deeds').textContent=data.deeds||0;
 $('eat-open').hidden=!restorePantry(data.pantry).length;$('eat-open').disabled=!!acting;$('pantry').textContent=restorePantry(data.pantry).length;
 $('water-light').hidden=data.map!=='garden'||data.seat!=='island';$('water-light').disabled=!!acting||!!islandLightError(data);
 $('water-light').title=islandLightError(data);
 $('repair-open').hidden=data.map!=='watermill';$('repair-open').disabled=!!acting;
 $('mill-open').hidden=data.map!=='watermill';$('mill-open').disabled=!!acting;
 const jobs=Object.keys(data.workshop?.jobs||{}),done=jobs.filter(k=>millRemaining(data,k)===0).length;
 $('mill-open').textContent=done?'工坊加工 · '+done+' 批做好了':'看看工坊加工';
}
function openMill(){if(!millAt(data))return;const list=$('mill-list');list.replaceChildren();
 for(const [key,r]of Object.entries(MILL_RECIPES)){
  const card=document.createElement('section'),title=document.createElement('h3'),desc=document.createElement('p'),state=document.createElement('p'),button=document.createElement('button');
  card.className='mill-recipe';title.textContent=r.name;desc.textContent=materialLine(r.input)+' → '+materialLine(r.output)+' · '+r.minutes/60+' 游戏小时';
  const remaining=millRemaining(data,key),job=data.workshop?.jobs?.[key],err=millError(data,key);
  state.textContent=job?(remaining?'还要 '+remaining+' 游戏分钟':'这一批已经做好，回来多久都不会坏。')+(job.helper?' · '+job.helper+'帮过忙':''):err||'材料齐了，可以开始。';
  button.textContent=job?(remaining?'正在加工':'取走成品'):'放入材料';button.disabled=!!(job?remaining:err);button.dataset.mill=key;
  button.onclick=()=>{const before=data;data=millAction(data,key,!!job);if(data===before)return;save();ui();openMill();};
  card.append(title,desc,state,button);list.append(card);
 }
 if(!$('mill-dialog').open)$('mill-dialog').showModal();
}

$('travel').onclick=()=>request(data.map==='depths'?'ladder':'travel');
$('dive').onclick=()=>request('dive');
$('notes').onclick=()=>request('note');
$('rest').onclick=()=>request('rest');
function beginAction(job){if(job.kind==='repair'){openRepair(job.id);return;}if(job.kind==='gather'&&data.map==='depths'){openExcavating(job.id);return;}if(job.kind==='brew'){openDew();return;}acting={...job,intent:job.kind==='bed'?job.sleepMode:job.kind==='garden'?gardenIntent(data):null,time:0};if(!['wave','stretch'].includes(job.kind))actor.rotation.y=job.kind==='brew'?-Math.PI/2:Math.PI;$('progress').hidden=false;$('progress').firstElementChild.style.width='0%';ui();say(job.kind==='visit'?'在这里停一会儿。':({eat:'捧着碗，慢慢吃一口。',buy:'把功绩数给摊主，货从摊面上递下来。',gift:'把东西递过去，等 TA 接住。',wave:'抬起手，向同行者打个招呼。',stretch:'抬起双手，慢慢伸个懒腰。',plant:'把种子撒进土里，再轻轻覆好。',dreamSow:'把梦种放进松软的土里，轻轻覆土。',dreamHarvest:'托住花根，把梦花轻轻收回。',mill:'把材料和空瓶在工作台上放好。',door:'推开门，往里面走。',bed:'把枕头放好，床铺暖暖的。',enter:'推开门，屋里的光暖暖的。',sit:'在水边慢慢坐下来。',well:'井水晃了一下，清凉地流进壶底。',garden:data.blooms===3?'把开好的花轻轻摘下来，留住花根。':data.potions?'月露落在叶尖，微光沿着叶脉散开。':'一点一点浇下去，叶子舒展开来。',brew:'草叶、荧光菇和清水，在锅里轻轻旋转……',seed:'把手放在微光两侧，等两个人的魔力慢慢汇合。',star:'留一点清水，看看花的变化。',lamp:'把花的微光留进灯罩里。',gather:'轻轻摘下，给它留一点明天生长的余地。',travel:'穿过小路，风里换了一种草木香。',rest:'灯熄了。窗外的风，替你翻过了一页日历。'})[job.kind]);}
// ── 公告栏（v69.35）：接委托、交委托。⚠️也是一枪都不打，文案由表拼
// 还有几天撕板子。⚠️这一句必须说出来：接了没做就没了，不告诉她就是坑她
const boardLeft=()=>Math.max(0,(questCycle(data.day)+1)*QUEST_CYCLE-data.day+1);
function questLine(q){const k=QUEST_KINDS[q.kind];
 const what=k.need==='shard'?'井里刨的任意碎片 ×'+q.need
  :k.need==='relic'?'无名遗物 ×'+q.need
  :k.need==='herbs'?'铃叶草 ×'+q.need
  :k.need==='harvest'?'花藏 ×'+q.need
  :'走一趟就行';
 return {title:k.label,body:k.note+'。'+q.from+'。要的是：'+what+'。还有 '+boardLeft()+' 天'};}
function openBoard(){
 const list=$('board-list');list.innerHTML='';
 const taken=questTaken(data);
 $('board-hint').textContent='这块板子还剩 '+boardLeft()+' 天，到期没交的会被撕下来。'+(taken.length?'手上还有 '+taken.length+'/'+QUEST_TAKEN_MAX+' 件没做完。':'接了就在这儿交。');
 for(const q of taken){const line=questLine(q),b=document.createElement('button');
  const ok=questPaid(data,q);
  b.setAttribute('aria-pressed','true');
  b.innerHTML='<b>〔在做〕'+line.title+'</b><br>'+line.body+(ok?'<br><b>· 可以交了</b>':'<br>· 还差着');
  b.onclick=()=>{if(!ok){say('东西还不够。');return;}
   const before=data;data=turnIn(data,q.id);
   if(data===before){say('这一件现在交不了。');return;}
   $('board-dialog').close();ui();save();
   say(QUEST_KINDS[q.kind].keeps?'修好了。挂到通往月潭的小路上——天黑它就亮着。':'交给他了。这一件算做完了。');};
  list.append(b);}
 for(const q of questBoard(data)){
  if((data.quests||[]).some(x=>x.id===q.id))continue;
  const line=questLine(q),b=document.createElement('button');
  b.innerHTML='<b>'+line.title+'</b><br>'+line.body;
  b.onclick=()=>{const err=takeError(data,q.id);if(err){say(err);return;}
   data=takeQuest(data,q.id);$('board-dialog').close();ui();save();say('接下了。做完回公告栏交。');};
  list.append(b);}
 if(!list.children.length)list.innerHTML='<p class="craft-hint">这一季的都接完了。下一季会换新的。</p>';
 $('board-dialog').showModal();
}
$('board').onclick=()=>request('board');
$('board-close').onclick=()=>$('board-dialog').close();
// ── 锅里（v69.32）：挑一片碎片 ＋ 一种做法。⚠️全程零调用，出什么由配方表算
// ⚠️合炉要【两片】，别的做法只吃一片：所以选中的是一个数组，不是一个 id。
//   最多留两片，再点第三片就把最早那片挤出去（不用先取消再选，手指少走一趟）。
const COLLECTION_VIEW=200;
let craftPicks=[];
function openCraft(){
 craftPicks=[];
 const list=$('craft-list'),ways=$('craft-ways');
 list.innerHTML='';ways.innerHTML='';
 const rows=(data.shards||[]).slice(0,40);
 if(!rows.length){$('craft-hint').textContent='背包里没有碎片。下井刨一片回来。';}
 else $('craft-hint').textContent='挑一片碎片再挑做法。挑两片不一样的，可以合炉。做成过的记进「炼金笔记」。';
 const sync=()=>{
  [...list.children].forEach(x=>x.setAttribute('aria-pressed',craftPicks.includes(x.dataset.id)?'true':'false'));
  [...ways.children].forEach(x=>x.disabled=CRAFT_WAYS[x.dataset.way].pair?craftPicks.length<2:!craftPicks.length);};
 for(const sh of rows){const b=document.createElement('button');
  b.dataset.id=sh.id;b.setAttribute('aria-pressed','false');
  b.innerHTML='<b>〔'+(shardName(sh)+' · '+SHARD_KINDS[sh.kind])+(sh.whole?' · 完整的一片':'')+'〕</b>'+sh.text;
  b.onclick=()=>{craftPicks=craftPicks.includes(sh.id)?craftPicks.filter(x=>x!==sh.id):[...craftPicks,sh.id].slice(-2);sync();};
  list.append(b);}
 for(const [key,way] of Object.entries(CRAFT_WAYS)){const b=document.createElement('button');
  b.dataset.way=key;b.textContent=way.label;b.title=way.note;b.disabled=true;
  b.onclick=()=>{const [first,second]=craftPicks;if(!first)return;
   const err=craftError(data,first,key,second);
   if(err){say(err);return;}
   const items=[first,...(way.pair?[second]:[])].map(id=>{const sh=data.shards.find(x=>x.id===id);return {key:sh.kind,label:shardName(sh),count:1,color:({echo:'#e6c88f',dream:'#b9a3d4',sense:'#9acbc9',relic:'#c2b2a0'})[sh.kind]};});
   $('craft-dialog').close();openBrewing({title:way.label+' · 碎片炼金',items,finishLabel:way.days?'收火，封坛':key==='set'?'收火，凝成形状':'收火，装好',commit:()=>{
    const err=craftError(data,first,key,second);if(err)return err;
    const before=data;data=craftThing(data,first,key,second);if(data===before)return '这炉没有结算，碎片保留。';data=spendTime(data,'craft');
    const made=data.things[0];ui();save();return way.days?('封进坛子里了。第 '+made.openDay+' 天再回来开。'):('做好了：'+made.name+'。'+made.note);
   }});};
  ways.append(b);}
 sync();
 $('craft-dialog').showModal();
}
// ── 收藏馆（v69.41）：三个位置摆不下的那些，捐进来就一直摆着 ────────────
function openMuseum(){
 const list=$('museum-list');list.innerHTML='';
 const rows=(data.things||[]).filter(t=>thingReady(data,t));
 const kinds=collectedKinds(data),have=(data.collection||[]).length;
 $('museum-hint').textContent=have
  ?('馆里已经摆着 '+have+' 件，'+kinds+' 种。炼金笔记记下了 '+(data.made||[]).length+'/'+RECIPE_TOTAL+' 种做法。')
  :'把一样东西留在这儿，它就一直摆着——背包会被挤掉，这一份不会。';
 for(const t of rows){const b=document.createElement('button');
  b.innerHTML='<b>'+t.name+'</b><br>'+t.note;
  b.onclick=()=>{const err=donateError(data,t.id);if(err){say(err);return;}
   const before=data;data=donate(data,t.id);if(data===before){say('这一件没能捐进去。');return;}data=spendTime(data,'museum');
   const first=data.deeds>before.deeds;
   $('museum-dialog').close();ui();save();
   say(first?('「'+t.name+'」进馆了，馆里第一次有这一种。'):('「'+t.name+'」摆进去了，挨着原来那一件。'));};
  list.append(b);}
 if(!rows.length)list.innerHTML='<p class="craft-hint">'+(have?'背包里没有做好的东西了。':'还没有能捐的东西。下井刨一片碎片，去锅那儿做点什么。')+'</p>';
 $('museum-dialog').showModal();
}
// ── 漂流瓶：捞瓶完成后才拆信；生成失败不消耗次数，也不把失败当作没有回信。
const DRIFT_WORDS={reply:'里面多了一封回信',mine:'是你自己封进去的那一只，这次没有附信',note:'是那天花笺上的一句',shard:'是从井里刨出来过的一片',kept:'是留在收藏馆里的那一件'};
let bottleReading=false;
async function openBottle(){
 if(bottleReading)return;
 const err=driftError(data);if(err){say(err);return;}
 let row=driftPick(data);
 $('bottle-retry').hidden=true;
 if(!$('bottle-dialog').open)$('bottle-dialog').showModal();
 if(row?.pending){
  bottleReading=true;
  $('bottle-hint').textContent='瓶里多了一张纸，正在展开……';
  $('bottle-text').textContent='你放下的：'+row.original;
  try{
   if(!host?.bottleReply)throw Error('从小手机进入并选好同行者，才能读新回信。瓶子会留着。');
   const out=await host.bottleReply(row);
   if(driftPick(data)?.id!==row.id||driftError(data))throw Error('这只瓶子的状态已经改变，请重新捞取。');
   data=keepBottleReply(data,row.id,out.reply,out.sender);
   row=driftPick(data);
   if(row?.pending)throw Error('回信没有写完整，瓶子还留着。');
  }catch(e){$('bottle-hint').textContent='这次没能展开回信';$('bottle-text').textContent=e.message;$('bottle-retry').hidden=false;return;}
  finally{bottleReading=false;}
 }
 const before=data;data=drawBottle(data);if(data===before)return;
 if(!row){$('bottle-hint').textContent='捞上来是个空瓶子。';
  $('bottle-text').textContent='往里面放一句话吧，过 '+BOTTLE_DAYS+' 个游戏日再来看看，也许会收到回信。（在手机的「漂流瓶」里写）';}
 else {$('bottle-hint').textContent=DRIFT_WORDS[row.kind]+'（原信第 '+row.from+' 天）'+(row.sender?' · '+row.sender:'');
  $('bottle-text').textContent=(row.original?'你放下的：'+row.original+'\n\n':'')+row.text;}
 ui();save();
}
// ── 种下一句（v69.58）：走到花圃那儿种。写字仍在这一层，只是地方换了 ──────
let sowKind='miss';
function openSow(){
 const err=seedError(data);if(err){say(err);return;}
 const box=$('sow-kinds');box.replaceChildren();
 for(const [key,label] of Object.entries(SEED_KINDS)){const b=document.createElement('button');
  b.textContent=label;b.setAttribute('aria-pressed',String(key===sowKind));
  b.onclick=()=>{sowKind=key;[...box.children].forEach((x,i)=>x.setAttribute('aria-pressed',String(Object.keys(SEED_KINDS)[i]===sowKind)));};
  box.append(b);}
 $('sow-hint').textContent='挑一种，写一句，过三天开花。今天还能种 '+Math.max(0,SEED_PER_DAY-seedsToday(data))+' 株。';
 $('sow-text').value='';
 $('sow-dialog').showModal();
}
$('sow-go').onclick=()=>{
 const err=seedError(data);if(err){say(err);return;}
 if(acting)return;
 const ask=$('sow-text').value;$('sow-dialog').close();
 beginAction({kind:'plant',seedKind:sowKind,ask});
};
// ── 地图（v69.59，她 2026-09-17 点的）─────────────────────────────────────
// ⚠️只说【这会儿谁在哪儿】：点了不会把人传送过去——「就先走路」是她定的，
//   走路本身是这游戏的节奏，一个能点的传送盘会把它抹掉。
// ⚠️一枪都不打：地名、坐标全是 MAPS 里现成的。
const MAP_W=320, MAP_PAD=3.5;
// 图上标哪几处：⚠️不是把 sites 整张表倒出来——广场／摊位／湖的两个岸挨着大地方，
//   标上去只会把字叠在一起。留下的是她真的会去的那几处。
const MAP_SPOTS=[
 ['site','home','家'],['site','hall'],['site','museum'],['site','pond'],['site','bridge'],
 ['site','neighbor1'],['site','neighbor2'],['site','neighbor3'],['site','oldTower'],['site','lakeNorth'],['site','railway'],['site','watermill'],
 ['station','garden','花圃'],['station','well','井'],['station','craft','锅'],['station','board','公告栏'],['station','travel','去林地']
];
function planBox(){
 const pts=MAP_SPOTS.map(([kind,id])=>kind==='site'?MAPS.garden.sites[id].target:MAPS.garden.stations[id]).filter(Boolean);
 const xs=pts.map(p=>p.x),zs=pts.map(p=>p.z);
 const minX=Math.min(...xs)-MAP_PAD,maxX=Math.max(...xs)+MAP_PAD;
 const minZ=Math.min(...zs)-MAP_PAD,maxZ=Math.max(...zs)+MAP_PAD;
 const scale=MAP_W/(maxX-minX);
 return {minX,minZ,scale,w:MAP_W,h:(maxZ-minZ)*scale};
}
function openMap(){
 const box=planBox(),esc=t=>String(t).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
 const at=p=>({x:((p.x-box.minX)*box.scale).toFixed(1),y:((p.z-box.minZ)*box.scale).toFixed(1)});
 let svg='<svg viewBox="0 0 '+box.w+' '+box.h.toFixed(1)+'" role="img" aria-label="村子平面图">';
 // ⚠️雾天只标近的那几处：这是「今天看得见什么」真的变了，不是给地图加个滤镜
 const fog=mapFoggy(data),here=data.map==='garden'?data.position:null;
 let hidden=0,hitAreas='',markers='';
 for(const [kind,id,name] of MAP_SPOTS){
  const src=kind==='site'?MAPS.garden.sites[id]:null,pos=src?src.target:MAPS.garden.stations[id];
  if(!pos)continue;
  if(fog&&here&&Math.hypot(pos.x-here.x,pos.z-here.z)>MAP_FOG_RANGE){hidden++;continue;}
  const p=at(pos),label=name||(src&&src.label)||id;
  const dy=kind==='site'?13:-7;
  hitAreas+='<circle class="spot-hit spot-tap" data-x="'+pos.x+'" data-z="'+pos.z+'" data-name="'+esc(label)+'" cx="'+p.x+'" cy="'+p.y+'" r="15"/>';
  markers+='<g class="spot-hit" role="button" tabindex="0" data-x="'+pos.x+'" data-z="'+pos.z+'" data-label="'+esc(label)+'">'
    +'<title>走过去：'+esc(label)+'</title>'
    +'<circle class="spot" cx="'+p.x+'" cy="'+p.y+'" r="'+(kind==='site'?4:3)+'"/>'
    +'<text class="spot-label" x="'+p.x+'" y="'+(Number(p.y)+dy).toFixed(1)+'" text-anchor="middle">'+esc(label)+'</text>'
    +'</g>';
 }
 // Touch circles sit below every label, so a neighboring target cannot cover its text.
 svg+=hitAreas+markers;
 const rows=[];
 for(const [cls,who,person] of [['me','你',{map:data.map,position:data.position}],['them',data.companion.name,data.companion]]){
  if(person.map!=='garden'){rows.push(who+'在'+MAPS[person.map].name+'。');continue;}
  const p=at(person.position);
  svg+='<circle class="'+cls+'" cx="'+p.x+'" cy="'+p.y+'" r="6"/>'
    +'<text class="who-label '+cls+'" x="'+p.x+'" y="'+(Number(p.y)-9).toFixed(1)+'" text-anchor="middle">'+esc(who)+'</text>';
  rows.push(who+'在'+MAPS.garden.name+'。');
 }
 svg+='</svg>';
 $('map-plan').innerHTML=svg;
 $('map-where').textContent=rows.join('')+(hidden?'雾大，远处那 '+hidden+' 处这会儿看不清。':'')+'点一处，他会带你走过去——是走过去，不是一下子到。';
 $('map-dialog').showModal();
}
// 我跟着他走（她 2026-09-17）。⚠️不是传送：还是一步一步走过去的，
//   他一动，下一段路重算。她自己点地面＝把主动权收回去，当场不跟了。
const CHASE_NEAR=1.35;
function chaseTick(){
 if(!chasing||acting||!actor)return;
 const c=data.companion;
 if(c.map!==data.map){chasing=false;ui();say(c.name+'进了'+MAPS[c.map].name+'，你得自己走那扇门。');return;}
 if(path.length)return;
 if(Math.hypot(c.position.x-actor.position.x,c.position.z-actor.position.z)<=CHASE_NEAR)return;
 go({x:c.position.x,z:c.position.z});
}
$('follow-him').onclick=()=>{
 if(acting)return;
 if(!chasing&&data.companion.mode==='follow'){say('他本来就跟着你——先让他按自己的走，你再跟。');return;}
 chasing=!chasing;ui();
 say(chasing?('跟上'+data.companion.name+'，他去哪儿你就去哪儿。'):'不跟了，自己走走。');
};
$('walk-together').onclick=()=>{
 if(acting)return;
 const following=data.companion.mode==='follow';
 data=wakeSleeper(data,'companion');applyCompanion(following?'routine':'follow');
 if(!following)chasing=false;
 ui();save();say(following?(data.companion.name+'不跟着了，回自己的安排里去。'):(data.companion.name+'听见了，会沿着小路过来和你同行。'));
};
// 点图上一处＝从现在站的地方走过去。⚠️不传送：走的是 go()，
//   而且不带 job——到了就是到了，不替她做任何事（要浇要种，她自己点）。
$('map-plan').addEventListener('click',e=>{
 const hit=e.target.closest('.spot-hit');if(!hit)return;
 const target={x:Number(hit.dataset.x),z:Number(hit.dataset.z)};
 if(!Number.isFinite(target.x)||!Number.isFinite(target.z))return;
 $('map-dialog').close();
 if(acting){say('这件事做完再走。');return;}
 chasing=false;ui();
 if(go(target))say('往'+(hit.dataset.label||hit.dataset.name)+'那边走。');
 else say('这会儿走不过去。');
});
$('map-open').onclick=()=>openMap();
$('map-close').onclick=()=>$('map-dialog').close();
$('sow').onclick=()=>request('sow');
$('cast').onclick=()=>request('cast');
$('sow-close').onclick=()=>$('sow-dialog').close();
$('bottle').onclick=()=>request('bottle');
$('bottle-retry').onclick=()=>openBottle();
$('bottle-close').onclick=()=>$('bottle-dialog').close();
$('museum').onclick=()=>openMuseum();
$('museum-close').onclick=()=>$('museum-dialog').close();
$('craft').onclick=()=>request('craft');
$('craft-close').onclick=()=>$('craft-dialog').close();
async function completeAction(){if(loadingMap)return;const {kind,id,intent}=acting;
 if(kind==='wave'&&acting.neighbor){const id=acting.greetTo;acting=null;$('progress').hidden=true;const before=data;data=waveAtNeighbor(data,id);if(data!==before)save();ui();helloNeighbor(id);return;}
 if(kind==='wave'||kind==='stretch'){acting=null;$('progress').hidden=true;ui();return;}
 if(kind==='plant'){const before=data;data=sowSeed(data,acting.seedKind,acting.ask);acting=null;$('progress').hidden=true;ui();save();say(data===before?(seedError(data)||'这一株没种下去。'):'种下了，三天后开花。到时候回这儿收。');return;}
 if(kind==='gift'){const before=data;const same=acting.giftTo===(data.partnerId||data.companion.name);if(same)data=giveGift(data,acting.ref,acting.taste);acting=null;giftFlower.visible=false;$('progress').hidden=true;
  if(data!==before){receivedUntil=clock+4;save();const row=(data.gifts||[])[0],line=(data.happenings||[])[0]?.text;say(line?line+'。':data.companion.name+'接过了。');
   // 第一次接过这一类，他说的那几句是他自己定的（宿主那张表），只在这一次说出口
   if(row&&row.said&&row.said.length)speak(row.said);}
  else say(giftError(data,acting.ref)||'同行者换了，这一样还在你手上。');ui();return;}
 // 到锅前了：打开弹层让她挑，挑完才真的做（perform 里没有这一支）
 if(kind==='eat'){const uid=acting.uid;acting=null;$('progress').hidden=true;const err=eatError(data,uid);if(err){say(err);ui();return;}const together=companionNearby(data);data=eat(data,uid);data=spendTime(data,'eat');if(together)eatingUntil=clock+3.4;ui();save();say((data.happenings||[])[0]?.text+'。');return;}
 // 夜市上的吃的和做法跟白天的货走同一条路，只是结算问 world.buyFood
 if(kind==='buy'){const id=acting.id;acting=null;$('progress').hidden=true;const food=!!(foodOf(id)||recipeOf(id));const err=food?foodError(data,id):marketError(data,id);if(err){say(err);ui();return;}data=food?buyFood(data,id):buy(data,id);marketView.fly(id,{x:actor.position.x,y:1.1,z:actor.position.z});ui();save();say((data.happenings||[])[0]?.text+'。');return;}
 if(kind==='mill'){acting=null;$('progress').hidden=true;ui();openMill();return;}
 if(kind==='craft'){acting=null;$('progress').hidden=true;ui();openCraft();return;}
 if(kind==='board'){acting=null;$('progress').hidden=true;ui();openBoard();return;}
 if(kind==='bottle'){acting=null;$('progress').hidden=true;ui();openScooping();return;}
 if(kind==='sow'){acting=null;$('progress').hidden=true;ui();openSow();return;}
 if(kind==='cast'){acting=null;$('progress').hidden=true;ui();openCast();return;}
 // ⚠️花笺这一支不走 perform：那一枪在宿主那侧打（callAI 在父页），
 //   回来才把结果写进存档。一次把开好的全收了＝一次调用。
 if(kind==='note'){const rows=readySeeds(data);acting=null;$('progress').hidden=true;
  if(!rows.length){ui();say('地里还没有开好的花。');return;}
  if(!host){ui();say('试玩模式里花还开不了——从小手机的庭院进来才有人回。');return;}
  say('花开了，正在读上面的字…');
  try{const out=await host.bloom(rows.map(x=>({id:x.id,kind:x.kind,ask:x.ask})));
   const before=data;data=keepNotes(data,out);if(data!==before)data=spendTime(data,'note');
   if(data===before){ui();say('这次没收上来，花还在地里。');return;}
   ui();save();say('收到 '+(data.notes.length-(before.notes||[]).length)+' 张花笺。在手机那头的花册里。');}
  catch(e){ui();say(e&&e.message||'这次没收上来，花还在地里。');}
  return;}
 // 下井、上来都要先把那张地图准备好（和 travel 同一条路）
 if(kind==='dive'||kind==='ladder'){loadingMap=true;say(kind==='dive'?'正在往下…':'正在爬上去…');
  try{await mapLoader.ensure(kind==='dive'?'depths':'garden',kind==='dive'?undefined:MAPS.garden.stations.well);}catch(e){acting=null;$('progress').hidden=true;ui();say('井里那一段没有加载完成，进度留在原地，稍后再试。');return;}finally{loadingMap=false;}}
 if(exitFor(data.map,kind,id)){loadingMap=true;say('正在打开前方的小路…');try{await mapLoader.ensure(exitFor(data.map,kind,id).to,exitFor(data.map,kind,id).at);}catch(e){acting=null;$('progress').hidden=true;ui();say('前方场景没有加载完成，进度留在原地，稍后再试。');return;}finally{loadingMap=false;}}
const before=data;data=perform(data,kind,id,intent||undefined);acting=null;$('progress').hidden=true;if(data===before){ui();say('这次行动没有完成，材料和进度都保留了。');return;}
 if(exitFor(before.map,kind,id)||kind==='dive'||kind==='ladder'){actor.position.set(data.position.x,.08,data.position.z);flash();showMap(true);mapLoader.keep(data.map);}
 else if(kind==='deeper'){actor.position.set(data.position.x,.08,data.position.z);flash();showMap(true);}
 // 下到井里／再往下：池子快空了就补一批（一次调用出一批，接下来几层都从这池里取）
 if((kind==='dive'||kind==='deeper')&&host&&host.dig&&veinLow(data))fillPool();
 else if(kind==='rest'){syncThaw();flash();showMap();const bell=bellLine()||lampLine();if(bell)setTimeout(()=>say(bell),900);}else ui();save();
 // ⚠️封在这一处的那片碎片，走到了就该听见——不然「封进去了」只是背包里少一片
 {const where=SPELL_SPOT[kind==='visit'?id:kind];const line=where?castLine(data,where):'';if(line)setTimeout(()=>say(line),1100);}
 {const line=workLine();if(line)setTimeout(()=>say(line),1250);}   // 走到修好的地方，看得出是弄过的
 {const key=kind==='visit'?OPENING_AT[id]:null;if(key&&openingReady(key))setTimeout(()=>say(openingLine(data,key)),1400);}
 say(kind==='dreamSow'?'梦种住进花圃了，三天后开花。原来的片段留在花心里。':kind==='dreamHarvest'?'梦花收回来了，可以摆在家具上，也可以留在收藏馆。':kind==='visit'&&data.map==='museum'?museumCaption(data,id):kind==='door'?'到了'+MAPS[data.map].name+'，可以走走看看。':kind==='travel'&&MAPS[before.map].interior?'到了'+MAPS[data.map].name+'。':kind==='bed'?($('sleep-mode').value==='companion'?'已经给 TA 留好床了，你可以继续走走。':'躺下来休息了。可以睡到明天，也可以随时起床。'):kind==='enter'?'回到小屋了。可以在这里走走，或者睡到明天。':kind==='visit'&&id==='home'&&bellLine()?MAPS[data.map].sites[id].text+' '+bellLine():
  kind==='dive'?wellContext(data).tide.name+'。'+wellContext(data).tide.sign:
  kind==='deeper'?'第 '+data.depth+' 层。'+(wellContext(data).anomaly?'这一层逆着井潮：':'')+wellContext(data).local.sign:
  kind==='ladder'?'爬回井口，天光刺了一下眼睛。星砂 '+data.sand+' · 井纹残片 '+data.stones+'。':
  kind==='gather'&&data.map==='depths'?depthGatherText(before,data):
  kind==='sit'?(seatsOf(data.map)[id||'pond']?.label?'坐下了。':'在水边坐下了。')+'想走时，轻点地面或点起身。':kind==='visit'?MAPS[data.map].sites[id].text:kind==='seed'?('星铃种子 +1。带回庭院种下吧。'+(before.spells?.length!==data.spells?.length?'醒来的还有一个咒：'+SPELLS[spellOfSeason(seasonOf(data.day).index)].name+'。去林后那棵许愿树下念它。':'')):kind==='star'?!before.magic.planted?'种子已经住进小花盆，每天用清水照料一次。':before.magic.growth>=2?'星铃花 +1，花谱记住了它。可以和三朵月光花一起制作星铃灯。':'新芽长大了一点，隔一天再来照料吧。':kind==='lamp'?'星铃灯留在屋前了。天色暗下来时，它会亮起。':kind==='travel'?(data.map==='forest'?'林地到了。铃叶草和荧光菇，可以一起炼成月露。':'回家了。炼药需要两份铃叶草、一份荧光菇和一格清水。'):kind==='rest'?`第 ${data.day} 天，${weather(data.day,data.epoch)}。林地的材料重新长好了。${weather(data.day,data.epoch)==='细雨'?'雨水也替花圃浇了一次水。':''}`:kind==='gather'?(NODES.find(n=>n.id===id).kind==='herb'?'铃叶草 +2，收进背包了。':'荧光菇 +1，收进背包了。'):kind==='brew'?'月露 +1。带去花圃，就能让尚未开好的花一起苏醒。':kind==='well'?'水壶装满了，浇花和炼药都可以用。':before.blooms===3?'月光花 +3，收入花藏。花根还在，可以继续照料。':before.potions?'月露散开，整圃月光花都亮了。可以采收啦。':'一朵月光花醒来了，再照料一下旁边的花吧。');}
// 哪个动作走到的是哪一处封咒的地方（封咒的名字只在 world.mjs 那一张表里定）
const SPELL_SPOT={well:'well',dive:'well',garden:'plot',sow:'plot',note:'plot',pond:'pond',lamp:'lamp'};
// ── 许愿树下念咒（v69.72）：那棵树原来只是个景 ──────────────────────────
// ⚠️挑咒、挑碎片、挑地方，全在这一层；出什么由 world.mjs 算，这儿一枪不打。
let castPick={spell:null,shard:null};
function openCast(){
 const known=restoreSpells(data.spells);
 if(!known.length){say('你还不会念咒。跟他一起去林地深处唤醒一颗种子，醒来的时候会多一个咒。');return;}
 castPick={spell:known[0],shard:null};
 const box=$('cast-spells'),list=$('cast-shards'),places=$('cast-places');
 const sync=()=>{
  [...box.children].forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.spell===castPick.spell)));
  const need=SPELLS[castPick.spell].need;
  list.replaceChildren();
  const rows=(data.shards||[]).filter(x=>x.kind===need).slice(0,30);
  if(!rows.length){const p=document.createElement('p');p.className='craft-hint';
   p.textContent='背包里没有'+SHARD_KINDS[need]+'。'+SPELLS[castPick.spell].name+'要的是这一种。';list.append(p);}
  for(const sh of rows){const b=document.createElement('button');
   b.dataset.id=sh.id;b.setAttribute('aria-pressed',String(sh.id===castPick.shard));
   b.innerHTML='<b>〔'+(shardName(sh)+' · '+SHARD_KINDS[sh.kind])+'〕</b>'+sh.text;
   b.onclick=()=>{castPick.shard=sh.id;sync();};list.append(b);}
  places.replaceChildren();
  // ⚠️模型还没标记的那几处开口【整个不出现】：灰着摆在那儿是吊她胃口，
  //   而那一处此刻根本不存在。codex 的标记一到，它们自己就会冒出来。
  for(const [key,label] of Object.entries(SPELL_PLACES)){
   if(isOpening(key)&&!openingReady(key))continue;
   const b=document.createElement('button');
   const taken=castAt(data,key),locked=castPlaceError(data,key);
   b.textContent=taken?label+'（封着了）':locked?label+'（还不行）':label;
   b.title=locked||'';
   b.disabled=!!taken||!!locked||!castPick.shard;
   if(locked)b.onclick=()=>say(locked);
   if(!locked)b.onclick=()=>{
    const err=castError(data,castPick.spell,castPick.shard,key);
    if(err){say(err);return;}
    $('cast-dialog').close();openRitual(castPick.spell,castPick.shard,key);
   };
   places.append(b);}
  $('cast-hint').textContent=SPELLS[castPick.spell].note+'。'+(castPick.shard?'挑一个地方封进去。':'先挑一片碎片。');
 };
 box.replaceChildren();
 for(const id of known){const b=document.createElement('button');
  b.dataset.spell=id;b.textContent=SPELLS[id].name;
  b.onclick=()=>{castPick={spell:id,shard:null};sync();};box.append(b);}
 sync();
 $('cast-dialog').showModal();
}
$('cast-close').onclick=()=>$('cast-dialog').close();
// ── 住进来的邻居（v69.83）：三间邻居屋里各过各的日子 ─────────────────────
// ⚠️邻居走路用的是【同一套控制器和同一个布偶工厂】，只是各跑一份实例：
//   另写一套"邻居移动"就是同一层活在两处。autonomous:true 让它不接那几件
//   「你和他之间」的事（来找你、去馆里看你留下的东西、帮你浇花）。
let dollSource=null;
const crew=new Map();                       // charId → {ctrl, avatar}
function syncNeighbors(){
 if(!dollSource)return;
 const rows=restoreNeighbors(data.neighbors),live=new Set(rows.map(n=>String(n.charId)));
 for(const [id,x] of crew){ if(live.has(id))continue;
  scene.remove(x.avatar.root);x.avatar.dispose?.();crew.delete(id); }
 for(const n of rows){ const id=String(n.charId);
  if(crew.has(id))continue;
  const avatar=createTraveler(dollSource,true,n.look||{});
  avatar.root.name='Neighbor:'+id;scene.add(avatar.root);
  crew.set(id,{ctrl:makeCompanionController(),avatar}); }
}
function tickNeighbors(dt){
 if(!crew.size)return;
 const rows=restoreNeighbors(data.neighbors);
 // 夜市那两晚天黑后，邻居各站到自己那座摊后头当摊主（谁站哪座在 world.vendorAt）；收摊了控制器重排日程
 const vend=nightMarketOpen(data)?VENDOR_STALLS.map(k=>vendorAt(data,k)):[];
 let changed=false;
 const next=rows.map(n=>{
  const x=crew.get(String(n.charId));if(!x)return n;
  const vi=vend.findIndex(v=>v&&String(v.charId)===String(n.charId));
  if(vi>=0){const spot=vendorSpot(VENDOR_STALLS[vi]);if(!x.vending){x.vending=VENDOR_STALLS[vi];x.ctrl.reset();}if(n.map==='garden'&&Math.hypot(n.position.x-spot.x,n.position.z-spot.z)<.01)return n;changed=true;return {...n,map:'garden',position:{x:spot.x,z:spot.z}};}
  if(x.vending){x.vending='';x.ctrl.reset();}
  const out=x.ctrl.tick(asCompanion(data,n),dt,{allowCare:false,autonomous:true}).state.companion;
  if(out!==n)changed=true;
  return {...out,charId:n.charId,home:n.home};
 });
 if(changed)data={...data,neighbors:next};
}
// ── 碰见（她 2026-09-17：「继续做玩法吧」）──────────────────────────────
// 谁和谁在哪儿照过面，村里的账上要有。⚠️记在 world.mjs 那一处（noteMeet），
//   这儿只负责「谁站在哪儿」——距离和名字是场上的事，怎么记是世界的事。
// ⚠️半秒才看一眼：最多四个人＝六对，但每帧都算就是白烧电，她的手机要撑一整天。
let meetClock=0;
function meetTick(dt){
 meetClock+=dt;if(meetClock<.5)return;meetClock=0;
 const here=[];
 if(actor)here.push({id:'me',name:'你',map:data.map,at:{x:actor.position.x,z:actor.position.z}});
 const c=data.companion;
 if(c)here.push({id:'companion',name:c.name,map:c.map,at:{...c.position}});
 for(const n of restoreNeighbors(data.neighbors))here.push({id:String(n.charId),name:n.name,map:n.map,at:{...n.position}});
 for(let i=0;i<here.length;i++)for(let j=i+1;j<here.length;j++){
  const a=here[i],b=here[j];
  if(a.map!==b.map)continue;
  if(Math.hypot(a.at.x-b.at.x,a.at.z-b.at.z)>MEET_NEAR)continue;
  const before=data;
  data=noteMeet(data,{a:a.id,b:b.id,nameA:a.name,nameB:b.name,place:whereLabel(a.map,a.at)});
  if(data!==before){ui();save();}
 }
}
// ── 一起对铜环（她 2026-09-18；codex 提的②）────────────────────────────
// ⚠️「配合」在界面上就一句话：【你占的那一头能做的事，和另一头看到的东西，不是同一份】。
//   楼下转环的人看不见差多少；台上看光的人转不动那个环，只能报方向。
// ⚠️她占 watch 的时候，那两颗按钮不是「她转」，是【她让他转】——同一个 turnStar，
//   不另开一路（不然「他转」迟早自己长出一套规则）。
function drawStar(){
 const star=restoreStar(data.star),mine=star.role,watching=mine==='watch';
 $('star-title').textContent=STAR_ROLES[mine]||'一起对铜环';
 // 台上那一位看得见差多少；楼下那一位只知道自己转到哪一格
 $('star-note').textContent=starDone(data)?'今晚已经对上了，明晚这一格会换。'
  :watching?starReading(data)+'（告诉'+data.companion.name+'该往哪边）'
  :'你手里只有铜环，看不见光落在哪儿——听'+data.companion.name+'报。';
 const live=starLive(data);
 $('star-turn').hidden=!live||starDone(data);
 // ⚠️她在楼下转的时候，【他得真的开口报方向】：不然她手里只有一个环、
 //   一句提示都没有，那不是配合，那是一扇打不开的门（实测转了十五格还在瞎转）。
 //   这一句是代码算的——和台上那一位看到的是同一个数，一枪都不打。
 //   等他那一枪接上了，换的是【他怎么说】，不是这一层。
 if(live&&!watching&&!starDone(data))speak(starReading(data));
 $('star-left').textContent=watching?'让 TA 往左一格':'往左一格';
 $('star-right').textContent=watching?'让 TA 往右一格':'往右一格';
}
function openStar(role){
 const err=starError(data,role);
 if(err){say(err);return false;}
 data=takeStarRole(data,role);ui();save();drawStar();$('star-dialog').showModal();return true;
}
function stepStar(step){
 const before=data;data=turnStar(data,step);
 if(data===before)return;
 if(starAligned(data)){const done=alignStar(data);
  if(done!==data){data=done;$('star-dialog').close();ui();save();
   say('铜环停在那一格上，残顶落下一道光。');return;}}
 drawStar();ui();save();
}
$('star-left').onclick=()=>stepStar(-1);
$('star-right').onclick=()=>stepStar(1);
$('star-close').onclick=()=>$('star-dialog').close();
$('star-leave').onclick=()=>{data=starLeave(data);$('star-dialog').close();ui();save();say('先放着，铜环停在原地。');};
// ── 会开的路：场景那一侧（交接单：庭院工单-会开的路-2026-09-17.md）────────
// 同一处地方有两份网格，名字即契约：shut:<key> 还挡着的那一份，open:<key> 开了的那一份。
// ⚠️先例是 doll.glb 那十二款头发（hair_<style>）：认名字切可见性，两边从来没对错过。
// ⚠️名字里那个冒号【GLTFLoader 会洗掉】，真名留在 userData.name 里——这是 codex
//   2026-09-17 导出那一版发现的，他把认名字这件事收成了 openingTag()。
//   这儿直接用他那一份：自己再写一条正则，就是同一层活在两处，而且我那条认不出来。
// ⚠️shut: 缺了就是一条空路却走不过去（花圃那次的毛病）；open: 缺了只是把 shut: 藏起来，
//   看着像树凭空没了——所以两份都要。这儿两种都不崩。
const OPENING_AT=Object.fromEntries(Object.entries(OPENINGS).map(([k,v])=>[v.site,k]));
// ⚠️村落是分区流式加载的：倒树、芦苇桥都在【后来才下载下来】的那几块里。
//   只扫主场景的话，走过去那一块刚加载完，它还是「关着」的那一份
//   （codex 2026-09-17 点名的那一条）。所以两件事：扫的时候连流式的根一起扫，
//   而且哪一块新加载进来就重扫一次。
const openingMark=()=>data.map+'|'+((mapViews[data.map]?.stream?.inspect().loaded||[]).join(','));
let loadedMark='';
function syncOpenings(){
 const view=mapViews[data.map];if(!view)return;
 for(const root of [view.root,...(view.stream?.roots()||[])].filter(Boolean))root.traverse(o=>{
  const tag=openingTag(o);if(!tag||!isOpening(tag.key))return;
  o.visible=(tag.side==='open')===opened(data,tag.key);
 });
 loadedMark=openingMark();
}
function watchOpenings(){if(openingMark()!==loadedMark)syncOpenings();}
// ── 衣柜预览（她 2026-09-17：「为啥感觉体型拉杆没用」）──────────────────
// 拉杆是有用的，只是她【一个像素都看不见】：换样貌那一页是整页盖住游戏的
// （iframe 一旦卸载这一局就没了，所以只能盖不能换屏），底下的小人被挡得严严实实，
// 「拖动时小人当场就变」这句话她根本没法验证。
// 那一页顶上留一条透明的窗，这儿就往窗里单独渲一个小人。
// ⚠️自己一个场景、自己一台相机，不去动世界那一路的可见性——
//   世界那一路是走路、天气、流式加载共用的，为了一条预览去翻它的可见性太贵了。
// ⚠️小人还是同一个 createTraveler、同一份 doll.glb：预览里看到的就是场上那一个。
const PREVIEW_BAND=.3;                     // 和手机那一侧那条透明窗同一个比例
const previewScene=new THREE.Scene();
const previewCam=new THREE.OrthographicCamera(-1,1,1,-1,.1,20);
previewCam.position.set(.9,1.5,4);previewCam.lookAt(0,.82,0);
previewScene.add(new THREE.HemisphereLight('#ffffff','#c3cfb4',1.9));
const previewKey=new THREE.DirectionalLight('#fff4e0',1.5);previewKey.position.set(2.2,4,3);previewScene.add(previewKey);
const previewDolls={};
let previewWho=null;
function setPreview(who){
 // ⚠️预览的时候把游戏自己那套壳（顶栏、天气、缩放、行动面板）全收起来：
 //   那条窗是透明的，不收的话她看到的是小人后面压着一排按钮。
 const nb=neighborOf(data,who);
 if(who!=='me'&&who!=='companion'&&!nb){previewWho=null;document.body.classList.remove('previewing');return true;}
 if(!dollSource)return false;
 if(!previewDolls[who]){const d=createTraveler(dollSource,who!=='me');
  previewScene.add(d.root);previewDolls[who]=d;}
 previewDolls[who].setLook(nb?(nb.look||{}):who==='companion'?(data.companion&&data.companion.look)||{}:data.look||{});
 for(const [k,d] of Object.entries(previewDolls))d.root.visible=k===who;
 previewWho=who;document.body.classList.add('previewing');return true;
}
function drawPreview(){
 const doll=previewDolls[previewWho];if(!doll)return;
 doll.animate(clock,{moving:false,gesture:'rest',height:.08});
 doll.root.rotation.y=Math.sin(clock*.5)*.5;
 const w=Math.max(1,innerWidth),h=Math.max(1,Math.round(innerHeight*PREVIEW_BAND)),y=innerHeight-h;
 const span=2.35,aspect=w/h;
 previewCam.left=-span*aspect/2;previewCam.right=span*aspect/2;
 previewCam.top=span/2;previewCam.bottom=-span/2;previewCam.updateProjectionMatrix();
 renderer.setScissorTest(true);renderer.setScissor(0,y,w,h);renderer.setViewport(0,y,w,h);
 renderer.setClearColor('#e9ecdd',1);renderer.clear();      // 和那一页同一个底色
 renderer.render(previewScene,previewCam);
 renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
}
function drawNeighbors(dt){
 const rows=restoreNeighbors(data.neighbors);
 for(const n of rows){ const x=crew.get(String(n.charId));if(!x)continue;
  const v=x.ctrl.view(),root=x.avatar.root;
  root.visible=n.map===data.map;
  if(!root.visible)continue;
  root.position.set(n.position.x,.08,n.position.z);
  if(x.vending){root.rotation.y=vendorSpot(x.vending).heading;x.avatar.animate(clock,{moving:false,gesture:'rest',height:floorHeight(n.map,n.position,data)});continue;}
  if(v.moving)root.rotation.y+=Math.atan2(Math.sin(v.heading-root.rotation.y),Math.cos(v.heading-root.rotation.y))*Math.min(1,dt*12);
  x.avatar.animate(clock,{moving:v.moving,gesture:v.gesture,progress:(clock*.3)%1,height:floorHeight(n.map,n.position,data)});
 }
}
// ── 点东西弹出「这儿能做什么」（她 2026-09-17）──────────────────────────
// ⚠️条目就是行动栏里那几颗【真按钮】本身：名字、能不能点、点了做什么，
//   全在 ui() 那一处算好了。这儿另写一份文案和判断，就是同一层活在两处。
// ⚠️只有一件事可做时不弹：为一颗按钮再让她点一下，是白让她多点一下。
const SPOT_TITLES={well:'井边',garden:'花圃',brew:'炼药锅',board:'公告栏',star:'星铃花',pond:'月潭边'};
const SPOT_BUTTONS={
 well:['well','dive','well-tide'],
 garden:['garden','sow','notes','dream-open'],
 brew:['brew','craft'],
 board:['board'],
 star:['magic-action','make-lamp'],
 pond:['bottle','sit-pond']
};
// 这颗按钮归哪一处物件管（从上面那张表倒过来推，不另写一张）
const BUTTON_SPOT=Object.fromEntries(Object.entries(SPOT_BUTTONS).flatMap(([key,ids])=>ids.map(id=>[id,key])));
// 这张地图上，那件东西点得到吗。⚠️只有点得到，才把按钮从行动栏里收走——
//   林地没有井也没有星铃花，在那儿把按钮藏了，那件事就彻底没路可走了。
function spotOnMap(key){
 const list=MAPS[data.map].interactions||[];
 if(key==='pond')return list.some(i=>i.kind==='visit'&&(i.id==='pond'||i.id==='lakeNorth'||i.id==='lakeEast'));
 return list.some(i=>i.kind===key);
}
// 画面里点得到的，就不在行动栏里再摆一颗（她 2026-09-17：「做吧」）
function quietPanelButtons(){
 for(const [id,key] of Object.entries(BUTTON_SPOT)){
  const b=$(id);if(!b)continue;
  b.classList.toggle('from-scene',spotOnMap(key)&&!b.hidden);
 }
 const names=[...new Set(Object.entries(SPOT_TITLES).filter(([k])=>spotOnMap(k)).map(([,v])=>v))];
 $('scene-hint').hidden=!names.length;
 $('scene-hint').textContent=names.join('、')+'——在画面里点它们。';
}
function spotKeyOf(hit){
 if(!hit)return null;
 if(hit.kind==='visit'&&(hit.id==='pond'||hit.id==='lakeNorth'||hit.id==='lakeEast'))return 'pond';
 return Object.hasOwn(SPOT_BUTTONS,hit.kind)?hit.kind:null;
}
// 户外那几处坐得下的景点（小桥、两岸、车站、广场、倒树后）：点了先问坐还是看，不再只有一句描述
function openSeatSite(id){const seat=seatsOf(data.map)[id],site=MAPS[data.map].sites?.[id];if(!seat||!site||seat.piece)return false;
 const list=$('spot-list');list.replaceChildren();$('spot-title').textContent=site.label;$('spot-note').textContent=site.text||'';$('spot-note').hidden=!site.text;
 const sit=document.createElement('button');sit.textContent=data.seat===id?'起身':'坐一会儿';const err=actionError(data,'sit',id);sit.disabled=!!acting||!!err;if(err)sit.textContent+='（'+err.replace(/。$/,'')+'）';sit.onclick=()=>{$('spot-dialog').close();sitAt(id);};list.append(sit);
 const look=document.createElement('button');look.textContent='走过去看看';look.disabled=!!acting;look.onclick=()=>{$('spot-dialog').close();request('visit',id);};list.append(look);
 $('spot-dialog').showModal();return true;}
function openSpot(key){
 const ids=SPOT_BUTTONS[key]||[];
 const live=ids.map(id=>$(id)).filter(b=>b&&!b.hidden);
 if(live.length<2)return false;                       // 只有一件事：别拦她，直接做
 const list=$('spot-list');list.replaceChildren();
 for(const src of live)appendSpotAction(src,list);
 $('spot-title').textContent=SPOT_TITLES[key]||'这儿';
 $('spot-note').hidden=true;
 $('spot-dialog').showModal();
 return true;
}
// Physical objects and scenery menus proxy the same real action button.
function appendSpotAction(src,list){
 const b=src.cloneNode(true);b.removeAttribute('id');b.removeAttribute('hidden');b.classList.remove('from-scene');b.disabled=src.disabled;
 b.onclick=()=>{$('spot-dialog').close();src.click();};list.append(b);
}
// ── 开放交互：每一处的家具都点得到（她 2026-09-17）────────────────────────
// ⚠️家具本身是障碍，点上去 walkable 一定是 false——所以这一步必须排在「走过去」前面，
//   不然点沙发就是什么都不会发生（这正是她说的「不能交互」）。
// ⚠️走过去【才】开菜单：她之前定的规矩就是点了自动带路，不传送也不隔空操作。
let pendingSpot=null;
// ⚠️点家具不能靠【地面落点】猜：镜头是斜的，她点在沙发靠背上，射线落到地面
//   已经是沙发后面那一块了——实测点沙发会走到它后面那张桌子。
//   所以这儿拿家具自己的盒子和射线做一次真的相交：盒子的尺寸 rules.js 里本来就有
//   （它们就是碰撞盒），高度没写就按 .9 米算。⚠️不另存一份家具表。
const boxCache=new Map();
function furnitureBoxes(map){
 if(boxCache.has(map))return boxCache.get(map);
 const out=(MAPS[map].furniture||[]).map((f,i)=>{
  if(!FURNITURE[f.kind])return null;
  const h=f.h||.9,y=floorHeight(map,{x:f.x,z:f.z},data);
  return {key:spotKey(map,f.kind,i),
   box:new THREE.Box3(new THREE.Vector3(f.x-f.w/2,y,f.z-f.d/2),new THREE.Vector3(f.x+f.w/2,y+h,f.z+f.d/2))};
 }).filter(Boolean);
 boxCache.set(map,out);return out;
}
function pickFurniture(ray){
 let best=null,near=Infinity;
 const hit=new THREE.Vector3();
 for(const {key,box} of furnitureBoxes(data.map)){
  if(!ray.ray.intersectBox(box,hit))continue;
  const d=hit.distanceTo(ray.ray.origin);
  if(d<near){near=d;best=key;}
 }
 return best;
}
function openFurniture(key){
 const at=spotParse(key);if(!at)return false;
 const kind=FURNITURE[at.kind];
 $('spot-title').textContent=MAPS[at.map].name+'的'+kind.label;
 $('spot-note').textContent=lookText(data,key);$('spot-note').hidden=false;
 const list=$('spot-list');list.replaceChildren();
 if(at.map==='watermill'&&(at.kind==='island'||Object.values(MILL_RECIPES).some(r=>r.furniture===at.kind)))appendSpotAction($('mill-open'),list);
 if(at.map==='watermill'&&at.kind==='island')appendSpotAction($('repair-open'),list);
 if(at.map==='home'&&['kitchen','island','dining'].includes(at.kind))appendSpotAction($('cook-open'),list);
 // 审计（她 2026-09-18）：椅子沙发长凳浴缸边都坐得下（座位从家具表推，见 world.seatsOf）；衣柜和梳妆台开样貌那一页
 if(SEAT_KINDS.includes(at.kind)&&seatsOf(at.map)[key]){const b=document.createElement('button');b.textContent=data.seat===key?'起身':'坐一会儿';b.disabled=!!acting;b.onclick=()=>{$('spot-dialog').close();sitAt(key);};list.append(b);}
 if(['wardrobe','vanity'].includes(at.kind)){const b=document.createElement('button');b.textContent='换样貌';b.onclick=()=>{$('spot-dialog').close();if(host&&host.openWardrobe)host.openWardrobe();else say('样貌在季节手册的「样貌」页里换。');};list.append(b);}
 // 铜环和望远镜是这一处的两头：点哪一头就占哪一头（她 2026-09-18）。
 // ⚠️名单从 STAR_SPOTS 倒过来推，不另写一张——codex 哪天挪了站位，这儿跟着走。
 {const role=Object.keys(STAR_SPOTS).find(k=>STAR_SPOTS[k]===at.kind);
  if(role&&at.map==='oldTower'){const b=document.createElement('button');
   b.textContent=STAR_ROLES[role];
   const err=starError(data,role);
   b.disabled=!!acting;
   b.onclick=()=>{$('spot-dialog').close();if(err){say(err);return;}openStar(role);};
   if(err)b.textContent=STAR_ROLES[role]+'（'+err.replace(/。$/,'')+'）';
   list.append(b);}}
 if(kind.holds){
  // ⚠️就在这儿摆：做出来的东西原来只有屋檐、窗台、池边三个位置，
  //   第四样往后全堆在盒子里没去处。现在每一件放得住东西的家具都是一个位置。
  const there=(data.things||[]).find(x=>x.spot===key);
  if(there){const off=document.createElement('button');off.textContent='把「'+there.name+'」收起来';
   off.onclick=()=>{data=placeThing(data,there.id,null);$('spot-dialog').close();ui();save();
    say('把「'+there.name+'」收回盒子里了。');};list.append(off);}
  const ready=(data.things||[]).filter(t=>thingReady(data,t)&&t.spot!==key).slice(0,8);
  for(const t of ready){const b=document.createElement('button');
   b.textContent='摆「'+t.name+'」';
   b.onclick=()=>{const before=data;data=placeThing(data,t.id,key);
    $('spot-dialog').close();
    if(data===before){say('这一样这会儿摆不上去。');return;}
    ui();save();say('把「'+t.name+'」摆在'+MAPS[at.map].name+'的'+kind.label+'上了。');};
   list.append(b);}
  if(!ready.length&&!there){const none=document.createElement('button');
   none.disabled=true;none.textContent='还没有做出来的东西可以摆';list.append(none);}}
 $('spot-dialog').showModal();
 return true;
}
// 走到了再开：路上她可能改主意，所以只在真的走到那儿才弹
// 她这会儿站在哪一件旁边：花册里「摆在这儿」要先把这一件顶上去
const furnitureHereKey=()=>{const k=actor?furnitureAtPoint(data.map,{x:actor.position.x,z:actor.position.z},1.4):null;return k&&isSpot(k)?k:null;};
// 走过去，到了再开菜单。⚠️两个入口（射线打中盒子／地面落点在它旁边）共用这一段，
//   各写一份迟早只改一处。
function openNear(key){
 if(!actor)return false;
 const spot=approachSpot(data,key);
 if(!spot){say('这一件旁边站不下人。');return true;}
 if(Math.hypot(spot.x-actor.position.x,spot.z-actor.position.z)<.6)return openFurniture(key);
 // ⚠️走过去要说【往哪儿走】：原来走的是 go() 那句通用的「慢慢走，庭院里的路…」，
 //   点了沙发和点了空地一模一样，走过去又要好几秒——她看到的就是「点了没反应」。
 //   （2026-09-17 查那条「第一次点击被当成走路」时查出来的：点击本身一直是对的，
 //     缺的是这一句。菜单在走到之后照常弹出来。）
 if(go(spot)){pendingSpot=key;
  say('往'+MAPS[spotParse(key).map].name+'的'+FURNITURE[spotParse(key).kind].label+'那儿走。');
  return true;}
 return false;
}
function arriveSpot(){const key=pendingSpot;pendingSpot=null;if(key)openFurniture(key);}
$('spot-close').onclick=()=>$('spot-dialog').close();
function tapMap(clientX,clientY){chasing=false;const r=canvas.getBoundingClientRect();mouse.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);if(companionAvatar?.root.visible&&ray.intersectObject(companionAvatar.root,true).length){openCompanion();return;}if(lakeView.pickBottle(ray)){request('bottle');return;}const good=marketView.pick(ray);if(good){buyGood(good);return;}const box=pickFurniture(ray);if(box&&openNear(box))return;const point=groundPoint(data.map,ray.ray.origin,ray.ray.direction,data);if(point){const picked=mapViews[data.map]?.pick?.(ray);const hit=picked?{kind:'gather',id:picked}:hitInteraction(data.map,point,data.depth);if(hit){if(hit.kind==='bed'){$('bed-select').value=hit.id;if($('panel-content').hidden)$('panel-toggle').click();say('选好了'+MAPS.home.beds[hit.id].label+'，在行动栏选休息安排。');return;}if(hit.kind==='visit'&&openSeatSite(hit.id))return;if(hit.kind==='visit'&&data.map==='museum'){say(MAPS.museum.sites[hit.id]?.text||'');openMuseum();return;}const key=spotKeyOf(hit);if(key&&openSpot(key))return;if(hit.kind==='seed'){$('magic-action').click();}else request(hit.kind,hit.id);return;}const furn=furnitureAtPoint(data.map,point);if(furn&&openNear(furn))return;if(walkable(point.x,point.z,data.map,data))go({x:point.x,z:point.z});}}

function panMap(dx,dy){cameraFollow=false;chatFollow=false;
 camera.updateMatrixWorld();const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(0,0),camera);const origin=r.ray.origin.clone();r.setFromCamera(new THREE.Vector2(dx/innerWidth*2,-dy/innerHeight*2),camera);const delta=orthographicPanDelta(origin,r.ray.origin,r.ray.direction);if(!delta)return;cameraPan.x+=delta.x;cameraPan.z+=delta.z;cameraPan.y=0;cameraPan.clampLength(0,MAPS[data.map].radius);resize(false);
}
const viewControls=installViewControls({canvas,center:$('view-center'),onCenter:()=>{cameraFollow=true;chatFollow=true;if(actor)cameraPan.set(actor.position.x,0,actor.position.z);resize(false);},onReset:()=>{cameraFollow=false;const p=MAPS[data.map].view||{x:0,z:0};cameraPan.set(p.x,0,p.z);},onPan:panMap,panel:$('action-panel'),content:$('panel-content'),toggle:$('panel-toggle'),zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),reset:$('zoom-reset'),onTap:tapMap,onFold:()=>placeHint(),
 onZoom:value=>{camera.zoom=value;resize(false);
 // ⚠️−／100%／＋ 三颗横着占掉两百像素、压在标题上（她 2026-09-17 点名的就是这块）。
 //   双指本来就能缩放（提示里写着），所以默认只留「地图」和「回到自己」两颗；
 //   真的缩放过了，那三颗才冒出来——她需要的是【退回去】，不是一直摆着三颗。
 const off=Math.abs(value-1)>.02;$('zoom-reset').hidden=!off;$('zoom-in').hidden=!off;$('zoom-out').hidden=!off;}});
canvas.addEventListener('keydown',e=>{const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(d&&actor){e.preventDefault();go({x:actor.position.x+d[0],z:actor.position.z+d[1]});}});
$('quality').onclick=()=>{lite=!lite;renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1:1.6));renderer.shadowMap.enabled=!lite;$('quality').textContent=lite?'精细画质':'轻量画质';scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});resize();};
$('reset').onclick=()=>$('reset-dialog').showModal();$('cancel-reset').onclick=()=>$('reset-dialog').close();$('confirm-reset').onclick=async()=>{if(loadingMap)return;loadingMap=true;try{await mapLoader.ensure('garden',START);}catch(e){say('小屋暂时没有加载成功，原来的进度还在。');return;}finally{loadingMap=false;}path=[];task=null;acting=null;$('progress').hidden=true;data={...freshState(),epoch:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)};companionController.reset();timeAccumulator=0;lastCompanionEvent='';if(actor)actor.position.set(START.x,.08,START.z);targetRing.visible=false;showMap();mapLoader.keep('garden');save();if(boundPartner)data.companion.name=boundPartner.name;say('新的生活，从一壶清水和一条林间小路开始。');$('reset-dialog').close();};
function refreshTime(){
 refreshLeisure();drawDayRing();
 const season=seasonOf(data.day);$('season-open').textContent=`${season.name} · ${season.day}/14 天`; $('date').textContent=`第 ${season.year} 年 · ${season.name} ${season.day} 日 · ${weather(data.day,data.epoch)}`;$('place-subtitle').textContent=`${timeLabel(data.minute)} · ${data.map==='depths'?'第 '+data.depth+' 层 · 往下还通 '+Math.max(0,deepestAllowed(data)-data.depth)+' 层':MAPS[data.map].interior?MAPS[data.map].name:data.map==='forest'?'萤光与草木':'小屋与月光花'}`;
 const indoor=!!MAPS[data.map].interior,underground=data.map==='depths',late=data.minute>=season.dusk+90,dusk=data.minute>=season.dusk;hemi.intensity=underground?.95:late?1.3:dusk?1.7:2.1;sun.intensity=underground?.7:MAPS[data.map].light*(late?.40:dusk?.75:1);sun.color.set(underground?'#abc9db':late?'#cad8f1':dusk?'#ffcf9e':'#fff0d0');fill.intensity=underground?.45:1;
 const color=underground?MAPS.depths.background:late?'#b9c8c3':dusk?'#e1dcc5':MAPS[data.map].background;scene.background.set(color);scene.fog.color.set(color);surroundings.root.visible=!!MAPS[data.map].outdoor;if(MAPS[data.map].outdoor)surroundings.update(data.map,season.tint,MAPS[data.map]);
 // Outdoor materials and particles share one renderer; underground keeps its own palette.
 updateOutdoor();
 if(indoor){hemi.intensity=1.7;sun.intensity=2.1;fill.intensity=.7;sun.color.set('#ffe5bc');scene.background.set(MAPS[data.map].background);scene.fog.color.copy(scene.background);}
 if(MAPS[data.map].outdoor){const look=weatherLook(data);sun.intensity*=look.sunScale;hemi.intensity*=look.ambientScale;sun.color.lerp(new THREE.Color(look.sunColor),late?.15:dusk?.35:.85);scene.background.lerp(new THREE.Color(look.sky),late?.18:dusk?.3:.8);scene.fog.color.copy(scene.background);}
}
// ── 他说的话浮在头顶（她 2026-09-17：「在里面说话角色也可以头上显示气泡」）──
// ⚠️气泡只是【把手机那侧刚收到的那句话】显示一遍：这儿不生成任何文字，也不存它。
//   停留时长按字数走——两个字和两百个字读完要的时间不一样。
let bubbleText='',bubbleUntil=0,bubbleQueue=[],bubbleTimer=0;
const BUBBLE_MIN=3200,BUBBLE_PER_CHAR=95,BUBBLE_MAX=15000,BUBBLE_GAP=520;
function bubbleHold(line){return Math.min(BUBBLE_MAX,BUBBLE_MIN+line.length*BUBBLE_PER_CHAR);}
// 谁在说这一串：'companion' 是他，'me' 是她自己（她 2026-09-17：「我自己说话也要气泡」）。
// ⚠️两只气泡走同一段队列、同一套停顿：各写一套的话，分段那条规矩迟早只剩一边还对。
let bubbleWho='companion';
const bubbleEl=()=>$(bubbleWho==='me'?'player-bubble':'companion-bubble');
function nextBubble(){
 const line=bubbleQueue.shift();
 if(!line){bubbleText='';bubbleUntil=0;$('companion-bubble').textContent='';$('player-bubble').textContent='';return;}
 bubbleText=line;bubbleUntil=Date.now()+bubbleHold(line);
 bubbleEl().textContent=line;
 bubbleTimer=setTimeout(nextBubble,bubbleHold(line)+BUBBLE_GAP);
}
// 一轮话可能有好几条：一条显示完、收起来停一口气，再冒下一条（她 2026-09-17 点的）
function speak(lines,who='companion'){
 clearTimeout(bubbleTimer);
 $('companion-bubble').textContent='';$('player-bubble').textContent='';
 bubbleWho=who==='me'?'me':'companion';
 bubbleQueue=(Array.isArray(lines)?lines:[lines])
  .map(x=>String(x==null?'':x).replace(/\s+/g,' ').trim().slice(0,120)).filter(Boolean).slice(0,12);
 nextBubble();
}
// ── 他自己来找你（她 2026-09-17）────────────────────────────────────────
// ⚠️走过来、站着等、等不到就回去——这三件全是代码算的，一枪都不打。
//   真正那一枪在 host 那侧，等她点了那个记号才发。
let missing=false;
function missTick(){
 if(missing)return;
 const before=data;
 let next=missArrived(data);
 if(missGaveUp(next))next=missLetGo(next);
 if(next!==before){data=next;save();ui();}
}
async function askMiss(){
 if(guideTalkReady()){askGuide();return;}
 if(inviteMet(data)){askDate();return;}
 if(starNightReady(data)){askStarNight();return;}
 if(missing||!missWaiting(data))return;
 // ⚠️先记上今天这一次再打：点两下＝花两次钱，而她只想听一句
 missing=true;data=missTaken(data);ui();save();
 if(!host||!host.miss){say('试玩模式里他还说不出话——从小手机的庭院进来才有人应。');missing=false;ui();return;}
 say('他站在那儿，像是在想怎么开口…');
 try{
  const lines=await host.miss(missMaterial(data));
  data=talkedWith(data);save();
  speak(lines);say('');
 }catch(e){say(e&&e.message||'这次他没说出口，明天再来。');}
 finally{missing=false;ui();}
}
// 赴约那一段：他约的、她真来了，两个人都在那儿——她点一下，才打这一枪（跟「他来找你」同一条路）
async function askDate(){
 if(missing||!inviteMet(data))return;
 const inv=data.invite;missing=true;data=keepInvite(data);ui();save();
 if(!host||!host.miss){say('试玩模式里他还说不出话——从小手机的庭院进来才有人应。');missing=false;ui();return;}
 say('他看见你来了…');
 try{const lines=await host.miss({...missMaterial(data),invite:{place:COMPANION_DESTINATIONS[inv.place].label,note:inv.note}});data=talkedWith(data);save();speak(lines);say('');}
 catch(e){say(e&&e.message||'这次他没说出口。');}
 finally{missing=false;ui();}}
// 星图那一夜：六片攒齐、两个人夜里都在旧塔——她点一下，才打这一枪（同一条路）
// 先进近景把六片拼起来；拼齐那一刻才结算（keepStarNight），那一枪在近景收起之后才打
function askStarNight(){
 if(missing||!starNightReady(data)||starchart.active)return;
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 path=[];task=null;acting=null;moving=false;targetRing.visible=false;
 starchart.open({position:actor.position,height:floorHeight(data.map,actor.position,data),helper:companionNearby(data),seed:data.epoch+':night:'+data.day,commit:()=>{
  if(!starNightReady(data))return {ok:false,text:'这会儿拼不成：得是夜里，两个人都在旧塔。'};
  missing=true;data=keepStarNight(data);ui();save();
  sayStarNight();return {ok:true,text:'整张星图亮起来了。'};
 }},view);cameraPan.set(actor.position.x,0,actor.position.z);starchart.camera();}
async function sayStarNight(){
 if(!host||!host.miss){say('星图摊开了。试玩模式里他还说不出话。');missing=false;ui();return;}
 try{const lines=await host.miss({...missMaterial(data),starNight:true});data=talkedWith(data);save();speak(lines);say('');}
 catch(e){say(e&&e.message||'这次他没说出口。');}
 finally{missing=false;ui();}}
// 他带路那一句：他站在那儿等着、她走到跟前，点一下他说那句（那句是宿主一枪十句里的，零调用）
function guideTalkReady(){const step=guideStep(data);return !!step&&!guideSaid(data,step.id)&&companionNearby(data)&&companionController.view().status==='在这儿等你';}
let guideAsking=false;
async function askGuide(){if(guideAsking||!guideTalkReady())return;const step=guideStep(data);guideAsking=true;
 try{let line=step.hint;if(host&&host.guideLines){try{const rows=await host.guideLines();const row=(rows||[]).find(r=>r.step===step.id);if(row&&row.text)line=row.text;}catch(e){say(e.message);}}
  data=markGuideSaid(data,step.id);save();ui();speak(line);}
 finally{guideAsking=false;}}
$('companion-call').onclick=()=>askMiss();
function updateCompanionUI(){const c=data.companion,v=companionController.view();$('companion-status').textContent=`${c.name} · ${c.map===data.map?v.status:MAPS[c.map].name+' · '+v.status}`;$('companion-tag').textContent=c.name;}
function drawSchedule(){const preview=data,current=plannedActivity(preview);$('companion-current-time').textContent=`${weather(data.day,data.epoch)} · ${timeLabel(data.minute)}`;$('companion-schedule').replaceChildren();for(const item of dailySchedule(preview)){const li=document.createElement('li'),t=document.createElement('time'),label=document.createElement('span');t.textContent=timeLabel(item.start);label.textContent=item.label+(item.note?' · '+item.note:'');li.append(t,label);li.classList.toggle('current',current.start===item.start);$('companion-schedule').append(li);}
 // 她 2026-09-17 截图：「他这个行动都不会干别的」——真正照着他人设排的那一份
 // 在季节手册里，而这一页上从来没说过。①告诉她这是地板，②给一颗直接过去的按钮。
 const planned=!!preview.seasonPlan;
 $('companion-plan-note').hidden=planned;$('companion-plan').hidden=planned;
 if(!planned)$('companion-plan-note').textContent='这一季还没一起安排过。上面这几格是没排过时的日子——每天不一样，但不是照着 TA 的人设排的。';}
function openCompanion(){if(!ready)return;const c=data.companion;$('companion-input').value=c.name;$('companion-input').disabled=!!boundPartner;drawSchedule();$('companion-detail').textContent=`现在在${MAPS[c.map].name}，${companionController.view().status}。${lastCompanionEvent||''}`;$('companion-follow').setAttribute('aria-pressed',c.mode==='follow');$('companion-routine').setAttribute('aria-pressed',c.mode==='routine');$('companion-wait').disabled=!!acting;$('companion-dialog').showModal();}
function applyCompanion(mode=data.companion.mode){if(mode!==data.companion.mode)data=wakeSleeper(data,'companion');data={...data,companion:{...data.companion,name:$('companion-input').value.trim().slice(0,16)||'同行者',mode}};companionController.reset();save();updateCompanionUI();}
$('companion-plan').onclick=()=>{$('companion-dialog').close();$('season-open').click();};
$('companion-open').onclick=openCompanion;$('companion-tag').onclick=openCompanion;$('companion-close').onclick=()=>$('companion-dialog').close();
$('companion-save').onclick=()=>{applyCompanion();$('companion-dialog').close();say(`${data.companion.name}会按新的偏好安排接下来的日子。`);};
$('companion-follow').onclick=()=>{data=wakeSleeper(data,'companion');applyCompanion('follow');$('companion-dialog').close();say(`${data.companion.name}听见了，会沿着小路过来和你同行。`);};
$('companion-routine').onclick=()=>{data=wakeSleeper(data,'companion');applyCompanion('routine');$('companion-dialog').close();say(`${data.companion.name}继续自己的安排，你们可以在世界里再碰面。`);};
$('companion-wait').onclick=()=>{if(acting)return;applyCompanion();path=[];task=null;targetRing.visible=false;data.position={x:actor.position.x,z:actor.position.z};for(let i=0;i<60;i++){data=advanceTime(data,1);const result=companionController.tick(data,1);data=result.state;if(result.event)lastCompanionEvent=result.event;}syncThaw();timeAccumulator=0;$('companion-dialog').close();showMap();save();say(`歇了一会儿，现在是 ${timeLabel(data.minute)}。${data.companion.name}${companionController.view().status}。`);};
function syncThaw(){if(!actor)return;if(Math.hypot(actor.position.x-data.position.x,actor.position.z-data.position.z)>.01){actor.position.x=data.position.x;actor.position.z=data.position.z;path=[];task=null;playerSpeed=0;targetRing.visible=false;companionController.reset();say('春天到了，湖冰渐渐化开。你们回到了岸边。');}}
function updateWorld(elapsed,dt){
 if(!ready||!actor)return;const paused=isMenuOpen()||['gift','wave'].includes(acting?.kind);
 if(!paused){data.position={x:actor.position.x,z:actor.position.z};
  // ⚠️走着说话，日子照走；站定了说话，时间停下来等她（她 2026-09-17）。
  //   原来只要在打字时间就停，于是「边走边聊」这件事在这游戏里等于不存在。
  if(!chatting||moving)timeAccumulator+=elapsed;if(timeAccumulator>=1){const oldDay=data.day,oldTaken=questTaken(data).length,minutes=Math.floor(timeAccumulator);timeAccumulator-=minutes;data=advanceTime(data,minutes);{const g=guideAdvance(data);if(g!==data){data=g;companionController.reset();ui();}}if(data.day!==oldDay){const dropped=Math.max(0,oldTaken-questTaken(data).length);syncThaw();ui();save();if(!acting)say(`第 ${data.day} 天，${weather(data.day,data.epoch)}。`+((recentHappenings(data,1)[0]||{}).text||'林地又长出了新的材料。')+(dropped?`板子换了，没做完的 ${dropped} 件撕下来了。`:''));}else refreshTime();}
 const result=receivedUntil>clock||eatingUntil>clock?{state:data,event:null}:companionController.tick(data,dt,{allowCare:acting?.kind!=='garden'});data=result.state;if(result.event){lastCompanionEvent=result.event;ui();save();if(!acting)say(result.event);}
  missTick();chaseTick();tickNeighbors(dt);meetTick(dt);
 if(clock-lastAutoSave>10){save();lastAutoSave=clock;}}
 drawNeighbors(dt);
 const c=data.companion,v=companionController.view(),root=companionAvatar.root;root.visible=c.map===data.map;root.position.set(c.position.x,.08,c.position.z);if(v.moving||v.gesture==='water'||v.gesture==='sit')root.rotation.y+=Math.atan2(Math.sin(v.heading-root.rotation.y),Math.cos(v.heading-root.rotation.y))*Math.min(1,dt*(onLakeIce(c.map,c.position,data)?4:12));companionAvatar.animate(clock,{skating:onLakeIce(c.map,c.position,data),moving:!paused&&v.moving,gesture:v.gesture,progress:(clock*.3)%1,height:floorHeight(c.map,c.position,data),sleepPose:sleepPose(data,'companion')});
 const point=new THREE.Vector3(sleepPose(data,'companion')?.x??c.position.x,sleepPose(data,'companion')?1.5:1.95,sleepPose(data,'companion')?.z??c.position.z).project(camera),x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2;const panelTop=sceneBottom()-12;const offscreen=!root.visible||x<15||x>innerWidth-15||y<125||y>panelTop;
 $('companion-tag').hidden=offscreen;$('companion-tag').style.left=x+'px';$('companion-tag').style.top=y+'px';
 // 气泡跟着名字走，再往上让开名字那一行；他走出画面时跟着一起收起来
 const speaking=!!bubbleText&&Date.now()<bubbleUntil;
 const bubble=$('companion-bubble');
 bubble.hidden=offscreen||!speaking||bubbleWho!=='companion';
 if(!bubble.hidden){bubble.style.left=x+'px';bubble.style.top=bubbleTop(bubble,y)+'px';}
 // 她自己那只：挂在她头顶上，跟着她走
 const mine=$('player-bubble');
 mine.hidden=!speaking||bubbleWho!=='me'||!actor;
 if(!mine.hidden){
  const q=new THREE.Vector3(actor.position.x,1.95,actor.position.z).project(camera);
  mine.style.left=((q.x+1)*innerWidth/2)+'px';
  mine.style.top=bubbleTop(mine,(1-q.y)*innerHeight/2)+'px';}
 // 他走到了、正等着她点头。⚠️这一路一枪都不打；点下去那一下才花钱
 const call=$('companion-call');
 const dating=inviteMet(data),starry=!dating&&starNightReady(data),guiding=!dating&&!starry&&guideTalkReady();call.textContent=dating?'他约你来的':starry?'摊开星图':guiding?'他带你看看':'他好像有话要说';
 call.hidden=offscreen||speaking||missing||!missWaiting(data)&&!dating&&!starry&&!guiding;
 if(!call.hidden){call.style.left=x+'px';call.style.top=bubbleTop(call,y)+'px';}
 if(clock-lastCompanionUI>.3){updateCompanionUI();lastCompanionUI=clock;}
}
let playerSpeed=0;
let last=performance.now(),lastRender=0;function frame(now){requestAnimationFrame(frame);if(document.hidden){last=now;return;}const elapsed=Math.min((now-last)/1000,1),dt=Math.min(elapsed,.05);last=now;clock+=dt;if(loadingMap){renderer.render(scene,camera);return;}
 if(actor&&!isMenuOpen()){moving=path.length>0;if(moving){const step=stepRoute(actor.position,path,dt,{speed:playerSpeed,walkSpeed:walkSpeedFor(data.map),skating:onLakeIce(data.map,actor.position,data)});playerSpeed=step.speed;actor.position.x=step.position.x;actor.position.z=step.position.z;if(step.heading!==null){const k=onLakeIce(data.map,actor.position,data)?4:13;actor.rotation.y+=Math.atan2(Math.sin(step.heading-actor.rotation.y),Math.cos(step.heading-actor.rotation.y))*Math.min(1,dt*k);}if(!path.length){targetRing.visible=false;save();if(task){const k=task;task=null;beginAction(k);}else {ui();arriveSpot();}}}else playerSpeed=0;
 if(data.seat&&!moving)actor.rotation.y=seatsOf(data.map)[data.seat]?.heading??actor.rotation.y;playerAvatar.animate(clock,{moving,skating:onLakeIce(data.map,actor.position,data),gesture:data.seat?seatActivity:actionGesture(acting),seated:!!data.seat,progress:acting?acting.time/actionDuration(acting):0,height:floorHeight(data.map,{x:actor.position.x,z:actor.position.z},data),sleepPose:sleepPose(data)});
 if(acting){const together=acting.kind!=='seed'||companionNearby(data);if(together)acting.time+=dt;else {acting.wait=(acting.wait||0)+dt;say('等同行者走到身边，再一起唤醒种子。');if(acting.wait>35){acting=null;$('progress').hidden=true;ui();say('这次没等到同行者到场，种子还在，可以再叫他一起过来。');}}if(acting){const duration=actionDuration(acting);$('progress').firstElementChild.style.width=Math.min(100,acting.time/duration*100)+'%';if(acting.time>=duration)completeAction();}}}
 // 打字的时候镜头跟着他走：不然他走出画面，她一边打字一边看不见人。
 // ⚠️她自己拖过画面就不跟了——那是把主动权收回去（跟点地面取消「跟着他走」同一个道理）。
 if(actor&&moving&&(cameraFollow||chatting&&chatFollow)){cameraPan.lerp(new THREE.Vector3(actor.position.x,0,actor.position.z),1-Math.exp(-dt*4));resize(false);}
 updateWorld(elapsed,dt);
 magic.visible=!!acting&&(acting.kind==='brew'||acting.kind==='garden'&&data.potions>0&&data.blooms<3);if(magic.visible){const site=MAPS.garden.interactions.find(x=>x.kind===(acting.kind==='brew'?'brew':'garden'));magic.position.set(site.x,.65,site.z);magic.children.forEach((m,i)=>{const a=clock*2+i*2.4,r=acting.kind==='brew'?.26:.6;m.position.set(Math.cos(a)*r,((clock*.5+i/18)%1)*.75,Math.sin(a)*r);});}
 giftFlower.visible=acting?.kind==='gift';
 if(giftFlower.visible){const c=data.companion,p=acting.time/actionDuration(acting),other=companionAvatar.root;
  actor.rotation.y=Math.atan2(c.position.x-actor.position.x,c.position.z-actor.position.z);other.rotation.y=actor.rotation.y+Math.PI;
  playerAvatar.animate(clock,{gesture:'give',height:floorHeight(data.map,actor.position,data)});companionAvatar.animate(clock,{gesture:'receive',height:floorHeight(c.map,c.position,data)});
  const t=Math.max(0,Math.min(1,(p-.3)/.45)),ease=t*t*(3-2*t);giftFlower.position.copy(playerAvatar.handPoint()).lerp(companionAvatar.handPoint(),ease);giftFlower.rotation.y=actor.rotation.y;
 }else if(companionAvatar&&receivedUntil>clock&&data.companion.map===data.map){companionAvatar.animate(clock,{gesture:'flower',height:floorHeight(data.map,data.companion.position,data)});}
 else if(companionAvatar&&eatingUntil>clock&&data.companion.map===data.map){companionAvatar.root.rotation.y=Math.atan2(actor.position.x-data.companion.position.x,actor.position.z-data.companion.position.z);companionAvatar.animate(clock,{gesture:'eat',height:floorHeight(data.map,data.companion.position,data)});}
 const activeView=mapViews[data.map];activeView?.stream?.update(cameraPan,Math.hypot(camera.right,camera.top)*.85/camera.zoom);activeView?.update?.(data,clock);dreamGarden.update(data,clock,acting);placedKeepsakes.update(data,clock);wellSigns.update(data,clock);lakeView.update(data,clock,activeView?.stream?.inspect().loaded||[]);magicView.update(data,clock);marketView.update(data,clock,dt);workshopView.update(data,clock);updateOutdoor();
 highlights.forEach((h,i)=>h.material.opacity=.35+Math.sin(clock*2+i)*.12);blooms.children.forEach((g,i)=>g.rotation.z=Math.sin(clock*1.6+i)*.035);
 if(acting?.kind==='seed'&&companionAvatar&&companionNearby(data)){const c=data.companion;companionAvatar.root.rotation.y=Math.atan2(actor.position.x-c.position.x,actor.position.z-c.position.z);companionAvatar.animate(clock,{gesture:'hold',height:floorHeight(c.map,c.position,data)});}
 if(acting?.kind==='wave'&&acting.neighbor){const x=crew.get(acting.greetTo),n=neighborOf(data,acting.greetTo),p=acting.time/actionDuration(acting);
  if(x&&n){actor.rotation.y=Math.atan2(n.position.x-actor.position.x,n.position.z-actor.position.z);x.avatar.root.rotation.y=actor.rotation.y+Math.PI;
   if(p>.18)x.avatar.animate(clock,{gesture:'wave',progress:(p-.18)/.82,height:floorHeight(n.map,n.position,data)});}}
 else if(acting?.kind==='wave'&&companionAvatar){
  const c=data.companion,p=acting.time/actionDuration(acting);
  if(acting.greetTo===(data.partnerId||c.name)&&!gestureError(data,'wave')){
   actor.rotation.y=Math.atan2(c.position.x-actor.position.x,c.position.z-actor.position.z);
   companionAvatar.root.rotation.y=actor.rotation.y+Math.PI;
   if(p>.18)companionAvatar.animate(clock,{gesture:'wave',progress:(p-.18)/.82,skating:onLakeIce(c.map,c.position,data),seated:companionController.view().gesture==='sit',height:floorHeight(c.map,c.position,data)});
  }
 }
 if(brewing.active){if(brewing.stage==='done')actor.rotation.y=Math.atan2(camera.position.x-actor.position.x,camera.position.z-actor.position.z);brewing.update(dt,clock);playerAvatar.animate(clock,{gesture:brewing.stage==='stir'?'stir':'hold',height:floorHeight(data.map,actor.position,data)});if(brewing.helping){const site=MAPS.garden.interactions.find(x=>x.kind==='brew');companionAvatar.root.rotation.y=Math.atan2(site.x-data.companion.position.x,site.z-data.companion.position.z);companionAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,data.companion.position,data)});}}
 if(cooking.active){if(cooking.stage==='done')actor.rotation.y=Math.atan2(camera.position.x-actor.position.x,camera.position.z-actor.position.z);cooking.update(dt,clock);playerAvatar.animate(clock,{gesture:cooking.stage==='stir'?'stir':'hold',height:floorHeight(data.map,actor.position,data)});if(cooking.helping){companionAvatar.root.rotation.y=Math.atan2(cookSite.x-data.companion.position.x,cookSite.z-data.companion.position.z);companionAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,data.companion.position,data)});}}
 if(scooping.active){scooping.update(dt,clock);playerAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,actor.position,data)});if(scooping.helping){const site=MAPS.garden.lake.bottle;companionAvatar.root.rotation.y=Math.atan2(site.x-data.companion.position.x,site.z-data.companion.position.z);companionAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,data.companion.position,data)});}}
 if(starchart.active){starchart.update(dt,clock);playerAvatar.animate(clock,{gesture:'read',height:floorHeight(data.map,actor.position,data)});if(companionAvatar&&companionNearby(data)){companionAvatar.root.rotation.y=Math.atan2(actor.position.x-data.companion.position.x,actor.position.z-data.companion.position.z);companionAvatar.animate(clock,{gesture:'read',height:floorHeight(data.companion.map,data.companion.position,data)});}}
 if(ritual.active){ritual.update(dt,clock);playerAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,actor.position,data)});if(ritual.helping)companionAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,data.companion.position,data)});}
 if(excavating.active){excavating.update(dt,clock);playerAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,actor.position,data)});if(excavating.helping)companionAvatar.animate(clock,{gesture:'hold',height:floorHeight(data.map,data.companion.position,data)});}
 watchOpenings();
 if(now-lastRender>1000/(lite?30:45)){renderer.render(scene,camera);if(previewWho)drawPreview();lastRender=now;}}
addEventListener('pagehide',()=>{if(ready)save();});
requestAnimationFrame(frame);load();
// Read-only snapshots make the prototype's movement and persistence testable.
window.gardenDebug={getStarChart:()=>starchart.inspect(),getCooking:()=>cooking.inspect(),getFood:()=>foodBook(data),getMarket:()=>({shown:marketView.root.visible,night:nightMarketOpen(data),goods:Object.entries(marketView.goods).map(([id,g])=>{const v=g.group.getWorldPosition(new THREE.Vector3()).project(camera);return {id,visible:g.group.visible,x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};})}),getDreams:()=>dreamGarden.inspect(),getDreamPlaced:()=>placedKeepsakes.inspect(),getWell:()=>({context:wellContext(data),nodes:NODES.filter(n=>n.depth===data.depth).map(n=>({id:n.id,form:mapViews.depths?.node(n.id)?.form})),mouthVisible:wellSigns.root.visible}),getExcavating:()=>excavating.inspect(),getRitual:()=>ritual.inspect(),getScooping:()=>scooping.inspect(),getBrewing:()=>brewing.inspect(),getWorkshop:()=>workshopView.inspect(),getOpenings:()=>{const items=[];const v=mapViews[data.map];for(const root of [v?.root,...(v?.stream?.roots()||[])].filter(Boolean))root.traverse(o=>{const tag=openingTag(o);if(tag)items.push({...tag,visible:o.visible,name:o.name,sourceName:o.userData.name});});return items;},getLake:()=>lakeView.inspect(),getDistricts:()=>mapViews[data.map]?.stream?.inspect()||null,getMuseum:()=>mapViews.museum?.inspect?.()||null,getEnvironment:()=>({rain:rain.visible,hemi:hemi.intensity,sun:sun.intensity,fill:fill.intensity,seasonTint:mapViews[data.map]?.root.userData.seasonTint!==false,weather:weather(data.day,data.epoch),fog:scene.fog.far,...outdoor.inspect()}),getView:()=>({pan:{x:cameraPan.x,z:cameraPan.z},zoom:camera.zoom,folded:$('panel-content').hidden}),getState:()=>JSON.parse(JSON.stringify(data)),getDailyActions:()=>({player:actor?.userData.dailyAction,companion:companionAvatar?.root.userData.dailyAction,gift:giftFlower.visible,giftAt:giftFlower.position.toArray(),seatActivity}),getPlayer:()=>actor?{skating:onLakeIce(data.map,actor.position,data),speed:playerSpeed,x:actor.position.x,z:actor.position.z,y:actor.position.y,seat:data.seat,posture:actor.userData.posture,bed:sleepPose(data),visualTilt:actor.getObjectByName('TravelerVisual')?.rotation.x,leg:actor.getObjectByName('leftLeg')?.rotation.x,moving:!!path.length,acting:acting?.kind||null}:null,project:(x,z)=>{const v=new THREE.Vector3(x,floorHeight(data.map,{x,z},data),z).project(camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};},getCompanion:()=>({skating:onLakeIce(data.companion.map,data.companion.position,data),...companionController.view(),posture:companionAvatar?.root.userData.posture,bed:sleepPose(data,'companion'),visualTilt:companionAvatar?.root.getObjectByName('TravelerVisual')?.rotation.x,map:data.companion.map,position:{...data.companion.position},visible:!!companionAvatar?.root.visible}),getRenderStats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,maps:Object.keys(mapViews)}),getReady:()=>ready,setLook:(who,look)=>{const a=who==='companion'?companionAvatar:playerAvatar;if(a)a.setLook(look);return !!a;}};

// Only bounded game actions cross this bridge. The model cannot mutate inventory or run code.
window.FairyGardenGame={
 flush:()=>ready&&save(),
 refreshSeasonPlan:()=>{refreshSeasonPlan();companionController.reset();},
 // 相处册与礼物簿：他答应「去哪儿」的名单也从这儿出（处熟了名单才长）
 snapshot:()=>({bond:(b=>({label:b.label,together:b.kinds.filter(k=>k.count).map(k=>k.label),notYet:b.kinds.filter(k=>!k.count).map(k=>k.label)}))(bondBook(data)),invite:data.invite?{place:COMPANION_DESTINATIONS[data.invite.place]?.label,note:data.invite.note,met:inviteMet(data)}:null,starChart:{pieces:starChartPieces(data),need:STAR_CHART_NEED,nights:data.starNights||0},deeds:data.deeds||0,marketDay:marketDay(data.day),nextMarket:nextMarketDay(data.day),food:(f=>({pantry:f.pantry.map(p=>p.label),tasted:f.tasted,total:f.total,tonight:f.tonight,open:f.open,nextFair:f.next,buffs:f.buffs}))(foodBook(data)),birthday:data.birthday?{today:isBirthday(data),gameDay:data.birthday}:null,guide:guideStep(data)?guideStep(data).label:null,gifts:(g=>({today:g.today,perDay:g.perDay,known:g.families.filter(f=>f.stance).map(f=>({family:f.label,stance:g.stances[f.stance]})),recent:g.rows.slice(0,5).map(r=>({day:r.day,name:r.name}))}))(giftBook(data)),dreams:growingDreams(data).map(x=>({day:x.day,stage:dreamStage(data,x),from:x.origin.text})),well:wellContext(data),workshop:Object.keys(data.workshop?.jobs||{}).map(key=>({name:MILL_RECIPES[key].name,remaining:millRemaining(data,key)})),seat:data.seat,epoch:data.epoch,season:seasonOf(data.day),lately:recentHappenings(data,6),magic:{...data.magic},journal:(data.journal||[]).slice(-14),day:data.day,time:timeLabel(data.minute),weather:weather(data.day,data.epoch),map:MAPS[data.map].name,position:{...data.position},companion:{name:data.companion.name,map:MAPS[data.companion.map].name,position:{...data.companion.position},activity:companionController.view().status},inventory:{water:data.water,herbs:data.herbs,mushrooms:data.mushrooms,potions:data.potions,flowers:data.blooms,harvest:data.harvest}}),
 setChatOpen:value=>{chatting=!!value;if(chatting)chatFollow=true;document.body.classList.toggle('chatting',chatting);},
 // 样貌（发型/发色/衣色）：一个身体十二款头发，换一款是数据。
 // ⚠️谁的样貌就存在谁名下：我的在 data.look，同行者的在 data.companion.look，
 //   换角色入住时各自跟着自己的存档走，不会串到别人头上。
 getLook:()=>({me:{...(data.look||{})},companion:{...((data.companion&&data.companion.look)||{})},
  ...Object.fromEntries(restoreNeighbors(data.neighbors).map(n=>[String(n.charId),{...(n.look||{})}]))}),
 // ── 花田：写字和翻花册在手机那一侧，走过去收在游戏这一侧 ──────────────
 // 补碎片池：静悄悄地打这一枪，失败也不拦着她继续挖（挖到的是没纹路的石头）
 fillPool:()=>fillPool(),
 // 锅：把碎片做成东西。⚠️全程零调用——做出来是什么由配方表算
 craft:(shardId,way,secondId)=>{if(brewing.active)return '这一炉正在做，等装好再开下一炉。';const err=craftError(data,shardId,way,secondId);if(err)return err;
  const before=data;data=craftThing(data,shardId,way,secondId);if(data===before)return '这一炉没成。';data=spendTime(data,'craft');
  ui();save();return '';},
 // 他刚说的那句话：显示在头顶，几秒后自己散掉。传空串就是立刻收起来
 speak:(text,who)=>{speak(text,who);return true;},
 // 邻居：谁住在哪一间，搬进来搬出去都在手机那一侧挑（跟选同行者一个道理）
 // 相处册＋礼物簿（手机那一册读这个；一枪不打）
 getBond:()=>({...bondBook(data),gifts:giftBook(data),food:foodBook(data),guide:{...restoreGuide(data.guide),step:guideStep(data)?{id:guideStep(data).id,label:guideStep(data).label}:null}}),
 setGuide:on=>{data=setGuide(data,on);companionController.reset();ui();return save();},
 getNeighbors:()=>({houses:NEIGHBOR_HOUSES.map(h=>({id:h,label:MAPS.garden.sites[h].label})),
  rows:restoreNeighbors(data.neighbors).map(n=>({charId:n.charId,name:n.name,home:n.home,
   houseLabel:MAPS.garden.sites[n.home].label,map:MAPS[n.map].name,here:n.map===data.map,
   where:whereLabel(n.map,n.position),met:metCount(data,n.charId),closeness:closeness(data,n.charId),door:{...n.door}})),
  pairs:neighborPairs(data),free:freeHouse(data)}),
 moveIn:row=>{const err=moveInError(data,row&&row.charId);if(err)return err;
  const before=data;data=moveIn(data,row);if(data===before)return '这一位没能搬进来。';
  syncNeighbors();ui();save();return '';},
 // 门禁（她 2026-09-18 的 b）：请 TA 搬进来那一下就能设，之后也随时能改。
 // ⚠️开关叫什么、怎么念，全在宿主那侧照 ChatRooms.GROUPS 来；这儿只收【开了哪几条】。
 setNeighborDoor:(charId,door,name)=>{const before=data;data=setNeighborDoor(data,charId,door,name);
  if(data===before)return 'TA 不住在村里。';
  syncNeighbors();ui();save();return '';},
 moveOut:charId=>{const before=data;data=moveOut(data,charId);
  if(data===before)return 'TA 不住在村里。';
  syncNeighbors();ui();save();return '';},
 // 漂流瓶：写字在手机那一侧，走到水边捞在游戏这一侧（跟花笺同一个分法）
 getBottles:options=>bottleBook(data,options),
 seal:text=>{const err=sealError(data,text);if(err)return err;
  const before=data;data=sealBottle(data,text);if(data===before)return '这一只没放下去。';
  ui();save();return '';},
 // 收藏馆：捐出去的一份永不删除，炼金笔记的全表只在 world.mjs 那一处生成
 getCollection:()=>({rows:(data.collection||[]).slice(0,COLLECTION_VIEW),kinds:collectedKinds(data),
  total:RECIPE_TOTAL,made:[...(data.made||[])],recipes:recipeIndex()}),
 getThings:()=>({ways:{...CRAFT_WAYS},spots:spotsAll(),here:furnitureHereKey(),day:data.day,potions:data.potions,
  rows:(data.things||[]).map(t=>({...t,ready:thingReady(data,t)})),
  // 修好的地方：⚠️名单和「还差什么」都问 world.mjs 那一处要，手机这一侧不另算一遍
  works:Object.entries(WORKS).map(([id,w])=>({id,label:w.label,hint:w.hint,
   cost:workCost(id),done:workDone(data,id),short:workShort(data,id),
   where:w.site?MAPS.garden.sites[w.site].label:''}))}),
 hasten:id=>{const err=hastenError(data,id);if(err)return err;
  const before=data;data=hastenThing(data,id);if(data===before)return '这一样没能提前开。';
  ui();save();return '';},
 place:(id,spot)=>{const before=data;data=placeThing(data,id,spot||null);
  if(data===before)return '这一样现在还摆不出去。';ui();save();return '';},
 getShards:()=>({curios:WELL_CURIOS,kinds:{...SHARD_KINDS},rows:(data.shards||[]).slice(0,160),pool:(data.vein||[]).length,busy:digging,
  casts:(data.casts||[]).map(c=>({...c,place:SPELL_PLACES[c.place],spell:SPELLS[c.spell].name,line:castLine(data,c.place)})),
  spells:restoreSpells(data.spells).map(id=>({id,name:SPELLS[id].name,note:SPELLS[id].note,need:SHARD_KINDS[SPELLS[id].need]}))}),
 pinShard:id=>{data=pinShard(data,id);save();return true;},
 getGarden:()=>({day:data.day,seeds:(data.seeds||[]).filter(x=>!x.done).map(x=>({...x,label:x.origin?'梦种':SEED_KINDS[x.kind],bloomIn:Math.max(0,SEED_DAYS-(data.day-x.day))})),
  notes:(data.notes||[]).slice(0,120),ready:readySeeds(data).length,error:seedError(data),kinds:{...SEED_KINDS}}),
 pinNote:id=>{data=pinNote(data,id);save();return true;},
 // 衣柜那一页顶上那条透明的窗：开的时候告诉游戏渲谁，关了传 null
 preview:who=>setPreview(who),
 getDyes:who=>{const look=neighborOf(data,who)?.look||(who==='companion'?data.companion.look:data.look)||{},defaults=who==='me'?DEFAULT_LOOK:COMPANION_LOOK;return {skin:look.skin||defaults.skin,hairColor:look.hairColor||defaults.hairColor};},
 getOutfit:who=>{const look=neighborOf(data,who)?.look||(who==='companion'?data.companion.look:data.look)||{};return {id:outfitId(look),colors:outfitColors({...((who==='me')?DEFAULT_LOOK:COMPANION_LOOK),...look})};},
 setLook:(who,look)=>{if(!ready||!look)return false;
  // ⚠️dims 是嵌一层的：浅合并会让「只拖一根滑杆」把另外五根打回中性
  const merge=(old={})=>mergeLook(old,look);
  // 住在村里的那几位也能换样貌（她 2026-09-17：「邀请邻居的话改不了外貌」）。
  // ⚠️走的是同一段：同一个 setLook、同一份 merge、同一个预览小人。
  //   给邻居另写一套，六根滑杆那条链就活在两处了。
  const n=neighborOf(data,who);
  if(n){ const x=crew.get(String(n.charId));
   if(x)x.avatar.setLook(look);
   if(previewDolls[who])previewDolls[who].setLook(look);
   data={...data,neighbors:restoreNeighbors(data.neighbors).map(r=>String(r.charId)===String(n.charId)?{...r,look:merge(r.look)}:r)};
   return save(); }
  const avatar=who==='companion'?companionAvatar:playerAvatar;if(!avatar)return false;
  avatar.setLook(look);
  // 预览里那一个跟着一起变：不然她拖的是窗里那个小人，变的却是窗外看不见的那个
  if(previewDolls[who])previewDolls[who].setLook(look);
  if(who==='companion')data={...data,companion:{...data.companion,look:merge(data.companion.look)}};
  else data={...data,look:merge(data.look)};
  return save();},
 // 写给模型的那句「goto 能填什么」——照 companionDestinations 长（处到哪一档开到哪一档），宿主不另抄一份中文名。
 // ⚠️不塞进 snapshot：那份每一枪都要 JSON.stringify 一遍，这一串单独递。
 destinations:()=>destinationChoices(data),
 // 七种：四种走法＋回送／约她／没答应。后三种真的改世界（world.mjs 那三处），不只是嘴上说
 applyAction:action=>{if(!ready||!action)return false;if(action.kind==='none')return true;
  if(action.kind==='gift'){if(himGiveError(data,action.item))return false;data=himGive(data,action.item);ui();return save();}
  if(action.kind==='refuse'){data=refuse(data,action.why);companionController.reset();ui();return save();}
  if(action.kind==='invite'){if(inviteError(data,action.target))return false;data=wakeSleeper(data,'companion');data=invite(data,action.target,action.note);companionController.reset();ui();return save();}
  if(!['follow','routine','wait','goto'].includes(action.kind))return false;if(action.kind==='goto'&&!companionDestinations(data)[action.target])return false;data=wakeSleeper(data,'companion');data={...data,companion:{...data.companion,mode:action.kind,destination:action.target||data.companion.destination}};companionController.reset();ui();return save();}
};
installSeasonBook({getState:()=>data,getHost:()=>host,refresh:()=>{refreshSeasonPlan();companionController.reset();}});
if(host){$('host-partner').hidden=false;$('host-partner').onclick=()=>host.changePartner();$('companion-dialog').querySelector('.prototype-note').textContent=boundPartner?'同行者来自角色卡；外形暂用小布偶。聊天沿用小手机创作线路。':'示例同行者按本地日程行动；可以选手机里的角色入住。';}

function showWell(){
 const c=wellContext(data),down=data.map==='depths',t=down?c.tide:wellTide(data);
 $('well-sign').textContent='第 '+t.day+' 天 · '+t.name+'。'+t.sign;
 $('well-layer').textContent=down?('第 '+data.depth+' 层 · '+(c.anomaly?'逆潮征兆：':'局部征兆：')+c.local.sign):'下井后，每层还会有自己的征兆。井潮每天变化，不分好日子和坏日子。';
 $('well-kit-note').textContent=down?'这趟带着'+WELL_KITS[c.kit].name+'，回到地面可以换。':'小物可反复使用，略微提高对应奇物的机会。';
 const kits=$('well-kits');kits.replaceChildren();for(const [id,k]of Object.entries(WELL_KITS)){const b=document.createElement('button');b.textContent=k.name+(k.form?' · '+WELL_CURIOS[k.form].name:'');b.setAttribute('aria-pressed',String((down?c.kit:data.wellKit)===id));b.disabled=down;b.onclick=()=>{data=chooseWellKit(data,id);save();ui();showWell();};kits.append(b);}
 const finds=$('well-finds');finds.replaceChildren();for(const sh of data.shards.slice(0,12)){const p=document.createElement('p');p.className='time-note';p.textContent=(WELL_CURIOS[sh.curio]?.name||SHARD_KINDS[sh.kind])+' · '+sh.text;finds.append(p);}if(!finds.children.length)finds.textContent='尚未带回奇物。';
 if(!$('well-dialog').open)$('well-dialog').showModal();
}
$('well-tide').onclick=showWell;$('well-close').onclick=()=>$('well-dialog').close();

function showDreams(){
 const list=$('dream-list');list.replaceChildren();
 const add=(title,text,label,err,run)=>{const card=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),b=document.createElement('button');h.textContent=title;p.textContent=text;p.className='time-note';b.textContent=err||label;b.disabled=!!err;b.onclick=run;card.append(h,p,b);list.append(card);};
 for(const x of growingDreams(data))add(['刚种下','长出新芽','抱着花苞','梦花开了'][dreamStage(data,x)],x.origin.text,'收回梦花',dreamError(data,x.id,true),()=>{$('dream-dialog').close();request('dreamHarvest',x.id);});
 for(const sh of data.shards.filter(x=>x.curio==='seed'))add('带回的梦种',sh.text,'种进花圃',dreamError(data,sh.id),()=>{$('dream-dialog').close();request('dreamSow',sh.id);});
 if(!list.children.length)list.textContent='还没有梦种。井里遇到梦游潮时，更容易找到它。';
 $('dream-hint').textContent='和念头花共用 '+SEED_PLOTS+' 格花圃、每天两株名额。三天自然开花，不会枯萎。收获可摆放、可收藏，原来的片段会留下，不调用 AI。';
 $('dream-dialog').showModal();
}
$('dream-open').onclick=showDreams;$('dream-close').onclick=()=>$('dream-dialog').close();

function openRepair(id){
 const err=repairError(data,id);if(err){say(err);return;}
 const table=MAPS.watermill.furniture.find(f=>f.kind==='island'),site={x:table.x-1.3,z:table.z+.35};
 const view={pan:cameraPan.clone(),zoom:camera.zoom,heading:actor.rotation.y,companionHeading:companionAvatar.root.rotation.y};
 path=[];task=null;acting=null;moving=false;targetRing.visible=false;data.position={x:actor.position.x,z:actor.position.z};
 const tableRoot=mapViews.watermill.root;tableRoot.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(site.x,6,site.z),new THREE.Vector3(0,-1,0));const height=(ray.intersectObject(tableRoot,true).find(h=>h.point.y<2)?.point.y??1)+.02;
 const holder=new THREE.Group(),model=makeCurio('restored');model.scale.setScalar(1.1);holder.add(model);holder.position.set(site.x,height,site.z);scene.add(holder);const lid=model.getObjectByName('relic-lid');
 actor.rotation.y=Math.atan2(site.x-actor.position.x,site.z-actor.position.z);
 excavating.open({mode:'repair',site,height,vein:model,helper:companionNearby(data),hand:()=>avatarHand(actor),onClose:()=>holder.removeFromParent(),animate:(stage,t)=>{const k=stage==='done'?1:stage==='lift'?t:0;lid.position.set(.18*(1-k),.4+.25*(1-k),0);lid.rotation.z=.25*(1-k);},commit:()=>{const before=data;data=perform(data,'repair',id);if(data===before)return {ok:false,text:repairError(data,id)||'没有完成修复，旧物仍在背包里。'};ui();save();return {ok:true,text:'修好了留光匣。'+data.things[0].from};}},view);
 cameraPan.set(site.x,0,site.z);excavating.camera();
}
function showRepair(){
 const list=$('repair-list');list.replaceChildren();for(const sh of data.shards.filter(x=>x.curio==='relic')){const card=document.createElement('article'),p=document.createElement('p'),b=document.createElement('button');p.textContent=sh.text;p.className='time-note';const err=repairError(data,sh.id);b.textContent=err||'放到工作台修复';b.disabled=!!err;b.onclick=()=>{$('repair-dialog').close();request('repair',sh.id);};card.append(p,b);list.append(card);}if(!list.children.length)list.textContent='还没有沉睡旧物。井里遇到旧日潮时，更容易找到。';$('repair-dialog').showModal();
}
$('repair-open').onclick=showRepair;$('repair-close').onclick=()=>$('repair-dialog').close();
