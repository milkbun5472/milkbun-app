import {stepRoute} from './locomotion.mjs?v=fg-4808f755e2be3301';
import {makeLakeView} from './lake-view.mjs?v=fg-4808f755e2be3301';
import {makeMuseum} from './museum-view.mjs?v=fg-4808f755e2be3301';
import {museumCaption} from './museum.mjs?v=fg-4808f755e2be3301';
import {makeOutdoor} from './outdoor.mjs?v=fg-4808f755e2be3301';
import {installSeasonBook} from './season-book.mjs?v=fg-4808f755e2be3301';
import {makeMagicView} from './magic-view.mjs?v=fg-4808f755e2be3301';
import {installViewControls,orthographicPanDelta} from './view-controls.mjs?v=fg-4808f755e2be3301';
import * as THREE from 'three';
import {createMapLoader} from './map-loader.mjs?v=fg-4808f755e2be3301';
import {makeSurroundings} from './surroundings.mjs?v=fg-4808f755e2be3301';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=fg-4808f755e2be3301';
import {START,MAPS,NODES,lakeFrozen,onLakeIce,weather,targetFor,actionError,walkable,findPath,perform,restoreState,freshState,COMPANION_DESTINATIONS,advanceTime,timeLabel,gardenIntent,seasonOf,hitInteraction,journalText,companionNearby,floorHeight,groundPoint,exitFor,sleepPose,wakeSleeper,deepestAllowed,SEED_KINDS,SEED_DAYS,SEED_PER_DAY,seedError,sowSeed,seedsToday,readySeeds,keepNotes,pinNote,SHARD_KINDS,VEIN_POOL,veinLow,fillVein,pinShard,CRAFT_WAYS,SPOTS,craftError,craftThing,placeThing,placedAt,thingReady,bellRings,donate,donateError,collectedKinds,recipeIndex,RECIPE_TOTAL,driftPick,driftError,drawBottle,BOTTLE_DAYS,recentHappenings,diveWet,mapFoggy,MAP_FOG_RANGE,SPELLS,SPELL_PLACES,restoreSpells,castError,castSpell,castAt,castLine,spellOfSeason,sealBottle,sealError,floating,missArrived,missWaiting,missGaveUp,missLetGo,missTaken,missMaterial,talkedWith,QUEST_KINDS,QUEST_TAKEN_MAX,QUEST_CYCLE,questBoard,questTaken,questCycle,questPaid,takeError,takeQuest,turnIn,lampOn,lampShelter} from './world.mjs?v=fg-4808f755e2be3301';
import {makeForest} from './forest.mjs?v=fg-4808f755e2be3301';
import {makeDepths} from './depths.mjs?v=fg-4808f755e2be3301';
import {createTraveler} from './traveler.mjs?v=fg-4808f755e2be3301';
import {makeCompanionController,dailySchedule,plannedActivity} from './companion.mjs?v=fg-4808f755e2be3301';const $=id=>document.getElementById(id),KEY='fairy-garden-prototype-v1';
const embedded=new URLSearchParams(location.search).get('embedded')==='1';
const host=embedded&&window.parent.FairyGardenHostFor?window.parent.FairyGardenHostFor(window):null;
if(embedded&&!host){$('load-text').textContent='请从小手机里的「微光庭院」入口重新打开。';throw new Error('Missing garden host');}
if(host)document.body.classList.add('embedded');
let chatting=false,data=freshState(),saveOK=true;try{data=restoreState(host?host.load().world:JSON.parse(localStorage.getItem(KEY)));}catch(e){if(host){$('load-text').textContent=e.message;throw e;}}
const boundPartner=host&&host.partner();if(boundPartner)data.companion.name=boundPartner.name;

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
let loadingMap=false,cameraFollow=false;
const lakeView=makeLakeView();scene.add(lakeView.root);
const magicView=makeMagicView();scene.add(magicView.seed,magicView.bed,magicView.lamps);
function refreshSeasonPlan(){try{data.seasonPlan=host?.planState(data.day)?.plan||null;}catch{data.seasonPlan=null;}}
function isMenuOpen(){return $('companion-dialog').open||$('reset-dialog').open||$('season-dialog').open;}
const companionController=makeCompanionController();let playerAvatar,companionAvatar,timeAccumulator=0,lastAutoSave=0,lastCompanionUI=0,lastCompanionEvent='';
let actor,moving=false,path=[],task=null,acting=null,clock=0,ready=false;const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
const targetRing=new THREE.Mesh(new THREE.RingGeometry(.13,.19,32),new THREE.MeshBasicMaterial({color:'#faf9ce',transparent:true,opacity:.9,side:THREE.DoubleSide}));targetRing.rotation.x=-Math.PI/2;targetRing.position.y=.1;targetRing.visible=false;scene.add(targetRing);
const highlights=[];for(const p of [MAPS.garden.stations.well,MAPS.garden.stations.garden,MAPS.garden.stations.travel]){const ring=new THREE.Mesh(new THREE.RingGeometry(.26,.29,40),new THREE.MeshBasicMaterial({color:'#f9e9b8',transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.105,p.z);scene.add(ring);highlights.push(ring);}
const outdoor=makeOutdoor(scene,[surroundings.root]),rain=outdoor.precipitation;
const blooms=new THREE.Group();scene.add(blooms);
const stream=new THREE.Group();scene.add(stream);stream.visible=false;for(let i=0;i<12;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.026,6,5),new THREE.MeshBasicMaterial({color:'#bcebee',transparent:true,opacity:.8}));stream.add(d);}
const magic=new THREE.Group();scene.add(magic);magic.visible=false;const sparkGeo=new THREE.SphereGeometry(.035,6,4),sparkMat=new THREE.MeshBasicMaterial({color:'#e2efb2'});for(let i=0;i<18;i++)magic.add(new THREE.Mesh(sparkGeo,sparkMat));
function grow(){blooms.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});blooms.clear();for(let i=0;i<data.blooms;i++){const group=new THREE.Group();const site=MAPS.garden.decor.blooms;group.position.set(site.x+i*.5,site.y,site.z);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018,.023,.52,6),new THREE.MeshStandardMaterial({color:'#769876'}));stem.position.y=.26;group.add(stem);for(let j=0;j<5;j++){const p=new THREE.Mesh(new THREE.SphereGeometry(.10,10,7),new THREE.MeshStandardMaterial({color:'#b9ddd4',emissive:'#74bdaa',emissiveIntensity:.2,roughness:.85}));p.scale.set(1, .45,1.4);p.position.set(Math.cos(j*Math.PI*2/5)*.105,.55,Math.sin(j*Math.PI*2/5)*.105);group.add(p);}const c=new THREE.Mesh(new THREE.SphereGeometry(.055,10,7),new THREE.MeshStandardMaterial({color:'#f9e4a5',emissive:'#e5ce7a',emissiveIntensity:.25}));c.position.y=.56;group.add(c);blooms.add(group);}}
function button(id,icon,label,detail){$(id).innerHTML=`<span class="button-icon">${icon}</span><span>${label}<small>${detail}</small></span>`;}
// 我跟着他走那个开关。⚠️声明必须排在 ui() 前面：ui() 里就读它，
//   摆到下面去就是一个 TDZ（这仓库栽过一次：v69.48 修的正是 v69.30 种下的那个）。
let chasing=false;
function ui(){
 $('home-sleep').hidden=data.map!=='home';$('wake-player').hidden=!data.sleep?.player;$('wake-companion').hidden=!data.sleep?.companion;for(const id of ['lie-down','bed-select','sleep-mode','wake-player','wake-companion'])$(id).disabled=!!acting;
 const woods=data.map==='forest',down=data.map==='depths',inside=!!MAPS[data.map].interior;refreshSeasonPlan();$('water').textContent='● '.repeat(data.water)+'○ '.repeat(3-data.water);$('blooms').textContent=['幼苗','一朵苏醒','两朵苏醒','可以采收'][data.blooms];
 for(const k of ['herbs','mushrooms','potions','harvest','sand','stones'])$(k).textContent=data[k];
 $('place-title').textContent=MAPS[data.map].name;const season=seasonOf(data.day);$('season-open').textContent=`${season.name} · ${season.day}/14 天`; $('date').textContent=`第 ${season.year} 年 · ${season.name} ${season.day} 日 · ${weather(data.day,data.epoch)}`;const currentWeather=weather(data.day,data.epoch);$('weather-icon').textContent=down?'◇':({'晴日':'☼','细雨':'☂','细雪':'❄','薄雾':'≋'})[currentWeather];$('rest').disabled=!MAPS[data.map].stations.rest||!!acting;$('rest').title=woods?'回到庭院后可以休息':'走回屋前休息，进入下一天';
 $('objective').textContent=inside?'在'+MAPS[data.map].name+'走走歇歇':down?(data.stones?'再往深处找找月石':'在这几层找到第一颗月石'):woods?'带一些森林的微光回家':data.blooms===3?'月光花开了，可以采收':data.potions?'用月露唤醒整圃月光花':data.herbs>=2&&data.mushrooms?'材料齐了，试试炼制月露':'沿着庭院小路，去林间采集';
 if(down){button('well','◈','刨一处矿脉','走过去 · 星砂或月石');button('garden','↡','再往下一层','越深越容易出月石');}
 else if(woods){button('well','❧','采铃叶草','每丛 2 份 · 炼药材料');button('garden','✧','采荧光菇','每丛 1 份 · 炼药材料');}
 else{button('well','♧','井边取水','走过去 · 装满水壶');button('garden','✿',data.blooms===3?'采收月光花':data.potions?'月露浇灌':'照料花圃',data.blooms===3?'收入花藏 · 留根再生':data.potions?'消耗月露 ×1 · 整圃开花':'消耗清水 ×1 · 唤醒一朵');}
 $('skate-lake').hidden=data.map!=='garden'||!lakeFrozen(data);$('skate-lake').disabled=!!acting;
 $('sit-pond').hidden=!MAPS[data.map].seats;$('sit-pond').textContent=data.seat?'起身走走':data.map==='garden'?'去月湖栈桥坐下':'去池边坐下';$('sit-pond').disabled=!!acting;$('brew').hidden=data.map!=='garden';$('well').hidden=inside;$('garden').hidden=inside;$('enter-home').hidden=!MAPS[data.map].exits.enter;$('enter-home').disabled=!!acting;
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
 // 漂流瓶：水在庭院里，一天一只。⚠️这一条一个字都不生成，漂回来的全是存档里已经有的东西
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
let doorsMap='';function fillDoors(){const box=$('map-doors');if(doorsMap!==data.map){doorsMap=data.map;box.replaceChildren();for(const [id,e]of Object.entries(MAPS[data.map].exits)){if(e.action!=='door')continue;const b=document.createElement('button');b.textContent=e.label;b.dataset.door=id;b.onclick=()=>request('door',id);box.append(b);}}box.hidden=!box.children.length;for(const b of box.children)b.disabled=!!acting;}
function lampLine(){return lampShelter(data)?'小路那盏灯下站着个人，在躲雨。':lampOn(data)?'你们修好的那盏灯亮着。':'';}
function bellLine(){return bellRings(data)?'屋檐下的雨铃在响。'+(data.companion.map==='garden'?data.companion.name+'路过时站住听了一会儿。':''):'';}
function showMap(atPlayer=false){const center=atPlayer&&actor?{x:actor.position.x,z:actor.position.z}:MAPS[data.map].view||{x:0,z:0};cameraPan.set(center.x,0,center.z);const extent=MAPS[data.map].radius+2;sun.shadow.camera.left=-extent;sun.shadow.camera.right=extent;sun.shadow.camera.top=extent;sun.shadow.camera.bottom=-extent;sun.shadow.camera.updateProjectionMatrix();for(const [id,view] of Object.entries(mapViews)){view.root.visible=id===data.map;for(const root of view.stream?.roots()||[])root.visible=view.root.visible;}highlights.forEach(h=>h.visible=data.map==='garden');const map=MAPS[data.map];scene.background.set(map.background);scene.fog.color.set(map.background);sun.intensity=map.light;ui();resize();}
function flash(){ $('arrival').classList.add('flash');setTimeout(()=>$('arrival').classList.remove('flash'),350);}
function say(s){$('message').textContent=s;}
function save(){if(actor)data.position={x:actor.position.x,z:actor.position.z};try{if(host){if(boundPartner)data.companion.name=boundPartner.name;const {seasonPlan,...saved}=data;if(!host.save(saved))throw Error('存档窗口已切换');}else {const {seasonPlan,...saved}=data;localStorage.setItem(KEY,JSON.stringify(saved));}saveOK=true;$('save').textContent='已保存在这台设备';}catch{saveOK=false;$('save').textContent='存储失败 · 暂勿关闭页面';}return saveOK;}
function resize(updateSize=true){const w=innerWidth,h=innerHeight;if(updateSize)renderer.setSize(w,h,false);const aspect=w/h;const spanX=MAPS[data.map].viewSpan|| (aspect<1?(h<730?14:12.8):Math.max(14,16*aspect));const spanY=spanX/aspect;const offset=aspect<1?(h<730?2.0:1.4):2.1;camera.position.set(10+cameraPan.x,12,16+cameraPan.z);camera.lookAt(cameraPan.x,.5-offset/camera.zoom,cameraPan.z);camera.updateMatrixWorld();camera.left=-spanX/2;camera.right=spanX/2;camera.top=spanY/2;camera.bottom=-spanY/2;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
async function load(){try{const loader=assetLoader;await mapLoader.ensure(data.map,data.position);const a=await loader.loadAsync('./doll.glb?v=fg-4808f755e2be3301');playerAvatar=createTraveler(a.scene);actor=playerAvatar.root;actor.name='Player';scene.add(actor);companionAvatar=createTraveler(a.scene,true);companionAvatar.root.name='Companion';scene.add(companionAvatar.root);
 // 存档里存着的样貌（发型/发色/衣色）——没有就用 traveler.mjs 的默认。换发型是数据，不是另导一个模型。
 if(data.look)playerAvatar.setLook(data.look);if(data.companion&&data.companion.look)companionAvatar.setLook(data.companion.look);
 actor.position.set(data.position.x,.08,data.position.z);actor.rotation.y=.35;ready=true;showMap(true);if(data.map==='forest')say('林间的微光还在，背包和采集进度也都留下了。');else if(data.blooms)say('你上次照料过的月光花，还在这里。');$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),550);save();window.dispatchEvent(new Event('garden-ready'));if(host)host.ready();}catch(e){console.error(e);$('load-text').textContent='素材没有加载完成，请刷新重试。'+e.message;}}
function go(target,job=null){if(!ready||acting)return false;const points=findPath({x:actor.position.x,z:actor.position.z},target,data.map,[],data);if(!points?.length){say('那边暂时走不过去，换一块空地试试。');return false;}data.seat=null;data=wakeSleeper(data);companionController.reset();ui();cameraFollow=true;path=points;task=job;targetRing.position.set(target.x,floorHeight(data.map,target,data)+.025,target.z);targetRing.visible=true;$('hint').style.opacity=0;if(!job)say(onLakeIce(data.map,target,data)?'轻轻蹬一下，沿着月湖的冰面滑过去。':data.map==='depths'?'脚下是碎石，慢一点。':data.map==='forest'?'脚步轻一点，草叶里藏着小小的光。':'慢慢走，庭院里的路都属于这个下午。');return true;}
function request(kind,id){if(!ready||acting||loadingMap)return;if(kind==='rest'&&sleepPose(data)){beginAction({kind});return;}const err=actionError(data,kind,id);if(err){say(err);return;}const p=targetFor(data,kind,id);if(!p)return;if(go(p,{kind,id,sleepMode:kind==='bed'?$('sleep-mode').value:null}))say(kind==='door'?exitFor(data.map,kind,id).label+'。':kind==='visit'?`去${MAPS[data.map].sites[id].label}看看。`:({bed:'去选好的卧室，慢慢歇下来。',enter:'回到门口，走进自己的小屋。',sit:data.map==='garden'?'去月湖的栈桥上找个位置坐下。':'去池塘边找个位置坐下。',well:'去井边装一壶清水。',garden:data.blooms===3?'去把开好的月光花收进花藏。':data.potions?'带着月露，去唤醒整圃花。':'沿着小路，去看看花圃。',brew:'带齐材料，去炼药锅旁边。',travel:data.map==='garden'?'沿着庭院小路，走向林间。':'穿过石门，带着收获回家。',dive:'走到井边，扶着绳梯往下。',deeper:'找到那个往下的洞口。',ladder:'走回梯子下面。',seed:'去林地的微光旁，等同行者一起唤醒种子。',star:'去看看星铃花。',lamp:'把花带到屋前，做一盏星铃灯。',gather:'走近一点，摘下这一丛森林的礼物。',rest:'回屋睡一觉，让日子慢慢往前走。',board:'去公共厅门前看看板子上贴着什么。',bottle:'走到水边，去捞那只漂流瓶。',sow:'走到花圃边上，蹲下来。',cast:'走到林后那棵许愿树下。'})[kind]||'');}
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
 // 井底：这一层没刨过的都算，离得近的先来（星砂月石不用分开点两个按钮）
 if(kind==='vein'){const here=NODES.filter(n=>n.map==='depths'&&n.depth===data.depth&&!data.picked.includes(n.id))
  .sort((a,b)=>Math.hypot(a.x-actor.position.x,a.z-actor.position.z)-Math.hypot(b.x-actor.position.x,b.z-actor.position.z));
  if(!here.length){say('这一层的矿脉都刨空了。再往下一层，或者顺着梯子上去。');return;}
  request('gather',here[0].id);return;}
 const available=NODES.filter(n=>n.kind===kind&&!data.picked.includes(n.id)).sort((a,b)=>Math.hypot(a.x-actor.position.x,a.z-actor.position.z)-Math.hypot(b.x-actor.position.x,b.z-actor.position.z));if(!available.length){say('今天的'+(kind==='herb'?'铃叶草':'荧光菇')+'采完了。回屋睡到明天，它们会重新长出来。');return;}request('gather',available[0].id);}
$('magic-action').onclick=()=>{if(data.map==='forest'){if(actionError(data,'seed')){say(actionError(data,'seed'));return;}data.companion.mode='follow';companionController.reset();request('seed');}else request('star');};$('make-lamp').onclick=()=>request('lamp');
$('well').onclick=()=>data.map==='forest'?gather('herb'):data.map==='depths'?gather('vein'):request('well');
$('garden').onclick=()=>data.map==='forest'?gather('mushroom'):data.map==='depths'?request('deeper'):request('garden');
$('brew').onclick=()=>request('brew');
$('travel').onclick=()=>request(data.map==='depths'?'ladder':'travel');
$('dive').onclick=()=>request('dive');
$('notes').onclick=()=>request('note');
$('rest').onclick=()=>request('rest');
function beginAction(job){acting={...job,intent:job.kind==='bed'?job.sleepMode:job.kind==='garden'?gardenIntent(data):null,time:0};actor.rotation.y=job.kind==='brew'?-Math.PI/2:Math.PI;$('progress').hidden=false;$('progress').firstElementChild.style.width='0%';ui();say(job.kind==='visit'?'在这里停一会儿。':({door:'推开门，往里面走。',bed:'把枕头放好，床铺暖暖的。',enter:'推开门，屋里的光暖暖的。',sit:'在水边慢慢坐下来。',well:'井水晃了一下，清凉地流进壶底。',garden:data.blooms===3?'把开好的花轻轻摘下来，留住花根。':data.potions?'月露落在叶尖，微光沿着叶脉散开。':'一点一点浇下去，叶子舒展开来。',brew:'草叶、荧光菇和清水，在锅里轻轻旋转……',seed:'把手放在微光两侧，等两个人的魔力慢慢汇合。',star:'留一点清水，看看花的变化。',lamp:'把花的微光留进灯罩里。',gather:'轻轻摘下，给它留一点明天生长的余地。',travel:'穿过小路，风里换了一种草木香。',rest:'灯熄了。窗外的风，替你翻过了一页日历。'})[job.kind]);}
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
  b.innerHTML='<b>〔'+(SHARD_KINDS[sh.kind]||'碎片')+(sh.whole?' · 完整的一片':'')+'〕</b>'+sh.text;
  b.onclick=()=>{craftPicks=craftPicks.includes(sh.id)?craftPicks.filter(x=>x!==sh.id):[...craftPicks,sh.id].slice(-2);sync();};
  list.append(b);}
 for(const [key,way] of Object.entries(CRAFT_WAYS)){const b=document.createElement('button');
  b.dataset.way=key;b.textContent=way.label;b.title=way.note;b.disabled=true;
  b.onclick=()=>{const [first,second]=craftPicks;if(!first)return;
   const err=craftError(data,first,key,second);
   if(err){say(err);return;}
   const before=data;data=craftThing(data,first,key,second);
   if(data===before){say('这一炉没成。');return;}
   const made=data.things[0];
   $('craft-dialog').close();ui();save();
   say(way.days?('封进坛子里了。第 '+made.openDay+' 天再回来开。'):('做好了：'+made.name+'。'+made.note+'（在手机的「屋里」可以摆出去）'));};
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
   const before=data;data=donate(data,t.id);if(data===before){say('这一件没能捐进去。');return;}
   const first=data.deeds>before.deeds;
   $('museum-dialog').close();ui();save();
   say(first?('「'+t.name+'」进馆了，馆里第一次有这一种。'):('「'+t.name+'」摆进去了，挨着原来那一件。'));};
  list.append(b);}
 if(!rows.length)list.innerHTML='<p class="craft-hint">'+(have?'背包里没有做好的东西了。':'还没有能捐的东西。下井刨一片碎片，去锅那儿做点什么。')+'</p>';
 $('museum-dialog').showModal();
}
// ── 漂流瓶（v69.47）：把过去那些东西重新递回来一次，零调用 ──────────────
const DRIFT_WORDS={mine:'是你自己封进去的那一只',note:'是那天花笺上的一句',shard:'是从井里刨出来过的一片',kept:'是留在收藏馆里的那一件'};
function openBottle(){
 const err=driftError(data);if(err){say(err);return;}
 const row=driftPick(data);
 const before=data;data=drawBottle(data);if(data===before){say('今天水面上是空的。');return;}
 if(!row){$('bottle-hint').textContent='捞上来是个空瓶子。';
  $('bottle-text').textContent='里面什么都没有。往里放一句话吧——'+BOTTLE_DAYS+' 天以后它会漂回来。（在手机的「漂流瓶」里写）';}
 else {$('bottle-hint').textContent='水面上漂着一只，'+DRIFT_WORDS[row.kind]+'（第 '+row.from+' 天）。';
  $('bottle-text').textContent=row.text;}
 ui();save();$('bottle-dialog').showModal();
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
 const before=data;data=sowSeed(data,sowKind,$('sow-text').value);
 if(data===before){say('这一株没种下去。');return;}
 $('sow-dialog').close();ui();save();say('种下了，三天后开花。到时候回这儿收。');
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
 ['site','neighbor1'],['site','neighbor2'],['site','neighbor3'],
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
 let hidden=0;
 for(const [kind,id,name] of MAP_SPOTS){
  const src=kind==='site'?MAPS.garden.sites[id]:null,pos=src?src.target:MAPS.garden.stations[id];
  if(!pos)continue;
  if(fog&&here&&Math.hypot(pos.x-here.x,pos.z-here.z)>MAP_FOG_RANGE){hidden++;continue;}
  const p=at(pos),label=name||(src&&src.label)||id;
  const dy=kind==='site'?13:-7;
  svg+='<g class="spot-hit" role="button" tabindex="0" data-x="'+pos.x+'" data-z="'+pos.z+'" data-label="'+esc(label)+'">'
    +'<title>走过去：'+esc(label)+'</title>'
    +'<circle class="spot-tap" cx="'+p.x+'" cy="'+p.y+'" r="15"/>'
    +'<circle class="spot" cx="'+p.x+'" cy="'+p.y+'" r="'+(kind==='site'?4:3)+'"/>'
    +'<text class="spot-label" x="'+p.x+'" y="'+(Number(p.y)+dy).toFixed(1)+'" text-anchor="middle">'+esc(label)+'</text>'
    +'</g>';
 }
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
 if(go(target))say('往'+hit.dataset.label+'那边走。');
 else say('这会儿走不过去。');
});
$('map-open').onclick=()=>openMap();
$('map-close').onclick=()=>$('map-dialog').close();
$('sow').onclick=()=>request('sow');
$('cast').onclick=()=>request('cast');
$('sow-close').onclick=()=>$('sow-dialog').close();
$('bottle').onclick=()=>request('bottle');
$('bottle-close').onclick=()=>$('bottle-dialog').close();
$('museum').onclick=()=>openMuseum();
$('museum-close').onclick=()=>$('museum-dialog').close();
$('craft').onclick=()=>request('craft');
$('craft-close').onclick=()=>$('craft-dialog').close();
async function completeAction(){if(loadingMap)return;const {kind,id,intent}=acting;
 // 到锅前了：打开弹层让她挑，挑完才真的做（perform 里没有这一支）
 if(kind==='craft'){acting=null;$('progress').hidden=true;ui();openCraft();return;}
 if(kind==='board'){acting=null;$('progress').hidden=true;ui();openBoard();return;}
 if(kind==='bottle'){acting=null;$('progress').hidden=true;ui();openBottle();return;}
 if(kind==='sow'){acting=null;$('progress').hidden=true;ui();openSow();return;}
 if(kind==='cast'){acting=null;$('progress').hidden=true;ui();openCast();return;}
 // ⚠️花笺这一支不走 perform：那一枪在宿主那侧打（callAI 在父页），
 //   回来才把结果写进存档。一次把开好的全收了＝一次调用。
 if(kind==='note'){const rows=readySeeds(data);acting=null;$('progress').hidden=true;
  if(!rows.length){ui();say('地里还没有开好的花。');return;}
  if(!host){ui();say('试玩模式里花还开不了——从小手机的庭院进来才有人回。');return;}
  say('花开了，正在读上面的字…');
  try{const out=await host.bloom(rows.map(x=>({id:x.id,kind:x.kind,ask:x.ask})));
   const before=data;data=keepNotes(data,out);
   if(data===before){ui();say('这次没收上来，花还在地里。');return;}
   ui();save();say('收到 '+(data.notes.length-(before.notes||[]).length)+' 张花笺。在手机那头的花册里。');}
  catch(e){ui();say(e&&e.message||'这次没收上来，花还在地里。');}
  return;}
 // 下井、上来都要先把那张地图准备好（和 travel 同一条路）
 if(kind==='dive'||kind==='ladder'){loadingMap=true;say(kind==='dive'?'正在往下…':'正在爬上去…');
  try{await mapLoader.ensure(kind==='dive'?'depths':'garden',kind==='dive'?undefined:MAPS.garden.stations.well);}catch(e){acting=null;$('progress').hidden=true;ui();say('井里那一段没有加载完成，进度留在原地，稍后再试。');return;}finally{loadingMap=false;}}
 if(exitFor(data.map,kind,id)){loadingMap=true;say('正在打开前方的小路…');try{await mapLoader.ensure(exitFor(data.map,kind,id).to,exitFor(data.map,kind,id).at);}catch(e){acting=null;$('progress').hidden=true;ui();say('前方场景没有加载完成，进度留在原地，稍后再试。');return;}finally{loadingMap=false;}}
const before=data;data=perform(data,kind,id,intent||undefined);acting=null;$('progress').hidden=true;stream.visible=false;if(data===before){ui();say('这次行动没有完成，材料和进度都保留了。');return;}
 if(exitFor(before.map,kind,id)||kind==='dive'||kind==='ladder'){actor.position.set(data.position.x,.08,data.position.z);flash();showMap(true);mapLoader.keep(data.map);}
 else if(kind==='deeper'){actor.position.set(data.position.x,.08,data.position.z);flash();showMap(true);}
 // 下到井里／再往下：池子快空了就补一批（一次调用出一批，接下来几层都从这池里取）
 if((kind==='dive'||kind==='deeper')&&host&&host.dig&&veinLow(data))fillPool();
 else if(kind==='rest'){syncThaw();flash();showMap();const bell=bellLine()||lampLine();if(bell)setTimeout(()=>say(bell),900);}else ui();save();
 // ⚠️封在这一处的那片碎片，走到了就该听见——不然「封进去了」只是背包里少一片
 {const where=SPELL_SPOT[kind==='visit'?id:kind];const line=where?castLine(data,where):'';if(line)setTimeout(()=>say(line),1100);}
 say(kind==='visit'&&data.map==='museum'?museumCaption(data,id):kind==='door'?'到了'+MAPS[data.map].name+'，可以走走看看。':kind==='travel'&&MAPS[before.map].interior?'到了'+MAPS[data.map].name+'。':kind==='bed'?($('sleep-mode').value==='companion'?'已经给 TA 留好床了，你可以继续走走。':'躺下来休息了。可以睡到明天，也可以随时起床。'):kind==='enter'?'回到小屋了。可以在这里走走，或者睡到明天。':kind==='visit'&&id==='home'&&bellLine()?MAPS[data.map].sites[id].text+' '+bellLine():
  kind==='dive'?'井比看上去深。落到第一层时，石壁上有细碎的光。':
  kind==='deeper'?'又下了一层，这里是第 '+data.depth+' 层。空气更凉了。':
  kind==='ladder'?'爬回井口，天光刺了一下眼睛。星砂 '+data.sand+' · 月石 '+data.stones+'。':
  kind==='gather'&&data.map==='depths'?(before.stones!==data.stones?'月石 +1。往下的路又通了两层。':'星砂 +'+(data.sand-before.sand)+'。三份能换一颗月露。'):
  kind==='sit'?'在水边坐下了。想走时，轻点地面或点起身。':kind==='visit'?MAPS[data.map].sites[id].text:kind==='seed'?('星铃种子 +1。带回庭院种下吧。'+(before.spells?.length!==data.spells?.length?'醒来的还有一个咒：'+SPELLS[spellOfSeason(seasonOf(data.day).index)].name+'。去林后那棵许愿树下念它。':'')):kind==='star'?!before.magic.planted?'种子已经住进小花盆，每天用清水照料一次。':before.magic.growth>=2?'星铃花 +1，花谱记住了它。可以和三朵月光花一起制作星铃灯。':'新芽长大了一点，隔一天再来照料吧。':kind==='lamp'?'星铃灯留在屋前了。天色暗下来时，它会亮起。':kind==='travel'?(data.map==='forest'?'林地到了。铃叶草和荧光菇，可以一起炼成月露。':'回家了。炼药需要两份铃叶草、一份荧光菇和一格清水。'):kind==='rest'?`第 ${data.day} 天，${weather(data.day,data.epoch)}。林地的材料重新长好了。${weather(data.day,data.epoch)==='细雨'?'雨水也替花圃浇了一次水。':''}`:kind==='gather'?(NODES.find(n=>n.id===id).kind==='herb'?'铃叶草 +2，收进背包了。':'荧光菇 +1，收进背包了。'):kind==='brew'?'月露 +1。带去花圃，就能让尚未开好的花一起苏醒。':kind==='well'?'水壶装满了，浇花和炼药都可以用。':before.blooms===3?'月光花 +3，收入花藏。花根还在，可以继续照料。':before.potions?'月露散开，整圃月光花都亮了。可以采收啦。':'一朵月光花醒来了，再照料一下旁边的花吧。');}
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
   b.innerHTML='<b>〔'+(SHARD_KINDS[sh.kind]||'碎片')+'〕</b>'+sh.text;
   b.onclick=()=>{castPick.shard=sh.id;sync();};list.append(b);}
  places.replaceChildren();
  for(const [key,label] of Object.entries(SPELL_PLACES)){const b=document.createElement('button');
   const taken=castAt(data,key);
   b.textContent=taken?label+'（封着了）':label;b.disabled=!!taken||!castPick.shard;
   b.onclick=()=>{
    const err=castError(data,castPick.spell,castPick.shard,key);
    if(err){say(err);return;}
    const before=data;data=castSpell(data,castPick.spell,castPick.shard,key);
    if(data===before){say('这一下没念成。');return;}
    $('cast-dialog').close();ui();save();
    say('封进'+label+'了。走过去的时候会知道。');
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
// ── 点东西弹出「这儿能做什么」（她 2026-09-17）──────────────────────────
// ⚠️条目就是行动栏里那几颗【真按钮】本身：名字、能不能点、点了做什么，
//   全在 ui() 那一处算好了。这儿另写一份文案和判断，就是同一层活在两处。
// ⚠️只有一件事可做时不弹：为一颗按钮再让她点一下，是白让她多点一下。
const SPOT_TITLES={well:'井边',garden:'花圃',brew:'炼药锅',board:'公告栏',star:'星铃花',pond:'月潭边'};
const SPOT_BUTTONS={
 well:['well','dive'],
 garden:['garden','sow','notes'],
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
function openSpot(key){
 const ids=SPOT_BUTTONS[key]||[];
 const live=ids.map(id=>$(id)).filter(b=>b&&!b.hidden);
 if(live.length<2)return false;                       // 只有一件事：别拦她，直接做
 const list=$('spot-list');list.replaceChildren();
 for(const src of live){
  const b=src.cloneNode(true);
  b.removeAttribute('id');b.removeAttribute('hidden');b.classList.remove('from-scene');b.disabled=src.disabled;
  b.onclick=()=>{$('spot-dialog').close();src.click();};
  list.append(b);
 }
 $('spot-title').textContent=SPOT_TITLES[key]||'这儿';
 $('spot-dialog').showModal();
 return true;
}
$('spot-close').onclick=()=>$('spot-dialog').close();
function tapMap(clientX,clientY){chasing=false;const r=canvas.getBoundingClientRect();mouse.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);if(companionAvatar?.root.visible&&ray.intersectObject(companionAvatar.root,true).length){openCompanion();return;}if(lakeView.pickBottle(ray)){request('bottle');return;}const point=groundPoint(data.map,ray.ray.origin,ray.ray.direction,data);if(point){const picked=mapViews[data.map]?.pick?.(ray);const hit=picked?{kind:'gather',id:picked}:hitInteraction(data.map,point,data.depth);if(hit){if(hit.kind==='bed'){$('bed-select').value=hit.id;if($('panel-content').hidden)$('panel-toggle').click();say('选好了'+MAPS.home.beds[hit.id].label+'，在行动栏选休息安排。');return;}const key=spotKeyOf(hit);if(key&&openSpot(key))return;if(hit.kind==='seed'){$('magic-action').click();}else request(hit.kind,hit.id);return;}if(walkable(point.x,point.z,data.map,data))go({x:point.x,z:point.z});}}

function panMap(dx,dy){cameraFollow=false;
 camera.updateMatrixWorld();const r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(0,0),camera);const origin=r.ray.origin.clone();r.setFromCamera(new THREE.Vector2(dx/innerWidth*2,-dy/innerHeight*2),camera);const delta=orthographicPanDelta(origin,r.ray.origin,r.ray.direction);if(!delta)return;cameraPan.x+=delta.x;cameraPan.z+=delta.z;cameraPan.y=0;cameraPan.clampLength(0,MAPS[data.map].radius);resize(false);
}
const viewControls=installViewControls({canvas,center:$('view-center'),onCenter:()=>{cameraFollow=true;if(actor)cameraPan.set(actor.position.x,0,actor.position.z);resize(false);},onReset:()=>{cameraFollow=false;const p=MAPS[data.map].view||{x:0,z:0};cameraPan.set(p.x,0,p.z);},onPan:panMap,panel:$('action-panel'),content:$('panel-content'),toggle:$('panel-toggle'),zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),reset:$('zoom-reset'),onTap:tapMap,onZoom:value=>{camera.zoom=value;resize(false);}});
canvas.addEventListener('keydown',e=>{const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(d&&actor){e.preventDefault();go({x:actor.position.x+d[0],z:actor.position.z+d[1]});}});
let lite=false;$('quality').onclick=()=>{lite=!lite;renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1:1.6));renderer.shadowMap.enabled=!lite;$('quality').textContent=lite?'精细画质':'轻量画质';scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});resize();};
$('reset').onclick=()=>$('reset-dialog').showModal();$('cancel-reset').onclick=()=>$('reset-dialog').close();$('confirm-reset').onclick=async()=>{if(loadingMap)return;loadingMap=true;try{await mapLoader.ensure('garden',START);}catch(e){say('小屋暂时没有加载成功，原来的进度还在。');return;}finally{loadingMap=false;}path=[];task=null;acting=null;stream.visible=false;$('progress').hidden=true;data={...freshState(),epoch:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)};companionController.reset();timeAccumulator=0;lastCompanionEvent='';if(actor)actor.position.set(START.x,.08,START.z);targetRing.visible=false;showMap();mapLoader.keep('garden');save();if(boundPartner)data.companion.name=boundPartner.name;say('新的生活，从一壶清水和一条林间小路开始。');$('reset-dialog').close();};
function refreshTime(){
 const season=seasonOf(data.day);$('season-open').textContent=`${season.name} · ${season.day}/14 天`; $('date').textContent=`第 ${season.year} 年 · ${season.name} ${season.day} 日 · ${weather(data.day,data.epoch)}`;$('place-subtitle').textContent=`${timeLabel(data.minute)} · ${data.map==='depths'?'第 '+data.depth+' 层 · 往下还通 '+Math.max(0,deepestAllowed(data)-data.depth)+' 层':MAPS[data.map].interior?MAPS[data.map].name:data.map==='forest'?'萤光与草木':'小屋与月光花'}`;
 const indoor=!!MAPS[data.map].interior,underground=data.map==='depths',late=data.minute>=season.dusk+90,dusk=data.minute>=season.dusk;hemi.intensity=underground?.95:late?1.3:dusk?1.7:2.1;sun.intensity=underground?.7:MAPS[data.map].light*(late?.40:dusk?.75:1);sun.color.set(underground?'#abc9db':late?'#cad8f1':dusk?'#ffcf9e':'#fff0d0');fill.intensity=underground?.45:1;
 const color=underground?MAPS.depths.background:late?'#b9c8c3':dusk?'#e1dcc5':MAPS[data.map].background;scene.background.set(color);scene.fog.color.set(color);surroundings.root.visible=!!MAPS[data.map].outdoor;if(MAPS[data.map].outdoor)surroundings.update(data.map,season.tint,MAPS[data.map]);
 // Outdoor materials and particles share one renderer; underground keeps its own palette.
 outdoor.update(data,mapViews,clock,cameraPan);
 if(indoor){hemi.intensity=1.7;sun.intensity=2.1;fill.intensity=.7;sun.color.set('#ffe5bc');scene.background.set(MAPS[data.map].background);scene.fog.color.copy(scene.background);}
 if(MAPS[data.map].outdoor){const kind=weather(data.day,data.epoch);if(kind!=='晴日'){sun.intensity*=kind==='薄雾'?.65:.55;scene.background.lerp(new THREE.Color(kind==='细雪'?'#cbd9e1':'#b4c5c8'),.55);scene.fog.color.copy(scene.background);}}
}
// ── 他说的话浮在头顶（她 2026-09-17：「在里面说话角色也可以头上显示气泡」）──
// ⚠️气泡只是【把手机那侧刚收到的那句话】显示一遍：这儿不生成任何文字，也不存它。
//   停留时长按字数走——两个字和两百个字读完要的时间不一样。
let bubbleText='',bubbleUntil=0,bubbleQueue=[],bubbleTimer=0;
const BUBBLE_MIN=3200,BUBBLE_PER_CHAR=95,BUBBLE_MAX=15000,BUBBLE_GAP=520;
function bubbleHold(line){return Math.min(BUBBLE_MAX,BUBBLE_MIN+line.length*BUBBLE_PER_CHAR);}
function nextBubble(){
 const line=bubbleQueue.shift();
 if(!line){bubbleText='';bubbleUntil=0;$('companion-bubble').textContent='';return;}
 bubbleText=line;bubbleUntil=Date.now()+bubbleHold(line);
 $('companion-bubble').textContent=line;
 bubbleTimer=setTimeout(nextBubble,bubbleHold(line)+BUBBLE_GAP);
}
// 一轮话可能有好几条：一条显示完、收起来停一口气，再冒下一条（她 2026-09-17 点的）
function speak(lines){
 clearTimeout(bubbleTimer);
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
$('companion-call').onclick=()=>askMiss();
function updateCompanionUI(){const c=data.companion,v=companionController.view();$('companion-status').textContent=`${c.name} · ${c.map===data.map?v.status:MAPS[c.map].name+' · '+v.status}`;$('companion-tag').textContent=c.name;}
function drawSchedule(){const preview=data,current=plannedActivity(preview);$('companion-current-time').textContent=`${weather(data.day,data.epoch)} · ${timeLabel(data.minute)}`;$('companion-schedule').replaceChildren();for(const item of dailySchedule(preview)){const li=document.createElement('li'),t=document.createElement('time'),label=document.createElement('span');t.textContent=timeLabel(item.start);label.textContent=item.label+(item.note?' · '+item.note:'');li.append(t,label);li.classList.toggle('current',current.start===item.start);$('companion-schedule').append(li);}}
function openCompanion(){if(!ready)return;const c=data.companion;$('companion-input').value=c.name;$('companion-input').disabled=!!boundPartner;drawSchedule();$('companion-detail').textContent=`现在在${MAPS[c.map].name}，${companionController.view().status}。${lastCompanionEvent||''}`;$('companion-follow').setAttribute('aria-pressed',c.mode==='follow');$('companion-routine').setAttribute('aria-pressed',c.mode==='routine');$('companion-wait').disabled=!!acting;$('companion-dialog').showModal();}
function applyCompanion(mode=data.companion.mode){if(mode!==data.companion.mode)data=wakeSleeper(data,'companion');data={...data,companion:{...data.companion,name:$('companion-input').value.trim().slice(0,16)||'同行者',mode}};companionController.reset();save();updateCompanionUI();}
$('companion-open').onclick=openCompanion;$('companion-tag').onclick=openCompanion;$('companion-close').onclick=()=>$('companion-dialog').close();
$('companion-save').onclick=()=>{applyCompanion();$('companion-dialog').close();say(`${data.companion.name}会按新的偏好安排接下来的日子。`);};
$('companion-follow').onclick=()=>{data=wakeSleeper(data,'companion');applyCompanion('follow');$('companion-dialog').close();say(`${data.companion.name}听见了，会沿着小路过来和你同行。`);};
$('companion-routine').onclick=()=>{data=wakeSleeper(data,'companion');applyCompanion('routine');$('companion-dialog').close();say(`${data.companion.name}继续自己的安排，你们可以在世界里再碰面。`);};
$('companion-wait').onclick=()=>{if(acting)return;applyCompanion();path=[];task=null;targetRing.visible=false;data.position={x:actor.position.x,z:actor.position.z};for(let i=0;i<60;i++){data=advanceTime(data,1);const result=companionController.tick(data,1);data=result.state;if(result.event)lastCompanionEvent=result.event;}syncThaw();timeAccumulator=0;$('companion-dialog').close();showMap();save();say(`歇了一会儿，现在是 ${timeLabel(data.minute)}。${data.companion.name}${companionController.view().status}。`);};
function syncThaw(){if(!actor)return;if(Math.hypot(actor.position.x-data.position.x,actor.position.z-data.position.z)>.01){actor.position.x=data.position.x;actor.position.z=data.position.z;path=[];task=null;playerSpeed=0;targetRing.visible=false;companionController.reset();say('春天到了，湖冰渐渐化开。你们回到了岸边。');}}
function updateWorld(elapsed,dt){
 if(!ready||!actor)return;const paused=isMenuOpen();
 if(!paused){data.position={x:actor.position.x,z:actor.position.z};if(!chatting)timeAccumulator+=elapsed;if(timeAccumulator>=1){const oldDay=data.day,oldTaken=questTaken(data).length,minutes=Math.floor(timeAccumulator);timeAccumulator-=minutes;data=advanceTime(data,minutes);if(data.day!==oldDay){const dropped=Math.max(0,oldTaken-questTaken(data).length);syncThaw();ui();save();if(!acting)say(`第 ${data.day} 天，${weather(data.day,data.epoch)}。`+((recentHappenings(data,1)[0]||{}).text||'林地又长出了新的材料。')+(dropped?`板子换了，没做完的 ${dropped} 件撕下来了。`:''));}else refreshTime();}
 const result=companionController.tick(data,dt,{allowCare:acting?.kind!=='garden'});data=result.state;if(result.event){lastCompanionEvent=result.event;ui();save();if(!acting)say(result.event);}
  missTick();chaseTick();
 if(clock-lastAutoSave>10){save();lastAutoSave=clock;}}
 const c=data.companion,v=companionController.view(),root=companionAvatar.root;root.visible=c.map===data.map;root.position.set(c.position.x,.08,c.position.z);if(v.moving||v.gesture==='water'||v.gesture==='sit')root.rotation.y+=Math.atan2(Math.sin(v.heading-root.rotation.y),Math.cos(v.heading-root.rotation.y))*Math.min(1,dt*(onLakeIce(c.map,c.position,data)?4:12));companionAvatar.animate(clock,{skating:onLakeIce(c.map,c.position,data),moving:!paused&&v.moving,gesture:v.gesture,height:floorHeight(c.map,c.position,data),sleepPose:sleepPose(data,'companion')});
 const point=new THREE.Vector3(sleepPose(data,'companion')?.x??c.position.x,sleepPose(data,'companion')?1.5:1.95,sleepPose(data,'companion')?.z??c.position.z).project(camera),x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2;const panelTop=$('action-panel').getBoundingClientRect().top-12;const offscreen=!root.visible||x<15||x>innerWidth-15||y<125||y>panelTop;
 $('companion-tag').hidden=offscreen;$('companion-tag').style.left=x+'px';$('companion-tag').style.top=y+'px';
 // 气泡跟着名字走，再往上让开名字那一行；他走出画面时跟着一起收起来
 const bubble=$('companion-bubble'),speaking=!!bubbleText&&Date.now()<bubbleUntil;
 bubble.hidden=offscreen||!speaking;
 if(!bubble.hidden){bubble.style.left=x+'px';
  bubble.style.top=Math.max(y-19,118+bubble.offsetHeight)+'px';}
 // 他走到了、正等着她点头。⚠️这一路一枪都不打；点下去那一下才花钱
 const call=$('companion-call');
 call.hidden=offscreen||speaking||missing||!missWaiting(data);
 if(!call.hidden){call.style.left=x+'px';call.style.top=Math.max(y-19,118+call.offsetHeight)+'px';}
 if(clock-lastCompanionUI>.3){updateCompanionUI();lastCompanionUI=clock;}
}
let playerSpeed=0;
let last=performance.now(),lastRender=0;function frame(now){requestAnimationFrame(frame);if(document.hidden){last=now;return;}const elapsed=Math.min((now-last)/1000,1),dt=Math.min(elapsed,.05);last=now;clock+=dt;if(loadingMap){renderer.render(scene,camera);return;}
 if(actor&&!isMenuOpen()){moving=path.length>0;if(moving){const step=stepRoute(actor.position,path,dt,{speed:playerSpeed,skating:onLakeIce(data.map,actor.position,data)});playerSpeed=step.speed;actor.position.x=step.position.x;actor.position.z=step.position.z;if(step.heading!==null){const k=onLakeIce(data.map,actor.position,data)?4:13;actor.rotation.y+=Math.atan2(Math.sin(step.heading-actor.rotation.y),Math.cos(step.heading-actor.rotation.y))*Math.min(1,dt*k);}if(!path.length){targetRing.visible=false;save();if(task){const k=task;task=null;beginAction(k);}}}else playerSpeed=0;
 if(data.seat&&!moving)actor.rotation.y=MAPS[data.map].seats[data.seat].heading;playerAvatar.animate(clock,{moving,skating:onLakeIce(data.map,actor.position,data),gesture:data.seat?'sit':acting?'water':'rest',height:floorHeight(data.map,{x:actor.position.x,z:actor.position.z},data),sleepPose:sleepPose(data)});
 if(acting){const together=acting.kind!=='seed'||companionNearby(data);if(together)acting.time+=dt;else {acting.wait=(acting.wait||0)+dt;say('等同行者走到身边，再一起唤醒种子。');if(acting.wait>35){acting=null;$('progress').hidden=true;ui();say('这次没等到同行者到场，种子还在，可以再叫他一起过来。');}}if(acting){const duration=acting.kind==='brew'?2.5:acting.kind==='rest'?2:acting.kind==='travel'?.5:1.5;$('progress').firstElementChild.style.width=Math.min(100,acting.time/duration*100)+'%';if(acting.kind==='garden'&&data.blooms<3){stream.visible=true;stream.position.set(actor.position.x+.22,.5,actor.position.z-.4);stream.children.forEach((d,i)=>{const p=(clock*1.5+i/12)%1;d.position.set(Math.sin(i*2.4)*.10,.55-p*.55,-p*.35);});}if(acting.time>=duration)completeAction();}}}
 if(actor&&moving&&cameraFollow){cameraPan.lerp(new THREE.Vector3(actor.position.x,0,actor.position.z),1-Math.exp(-dt*4));resize(false);}
 updateWorld(elapsed,dt);
 magic.visible=!!acting&&(acting.kind==='brew'||acting.kind==='garden'&&data.potions>0&&data.blooms<3);if(magic.visible){const site=MAPS.garden.interactions.find(x=>x.kind===(acting.kind==='brew'?'brew':'garden'));magic.position.set(site.x,.65,site.z);magic.children.forEach((m,i)=>{const a=clock*2+i*2.4,r=acting.kind==='brew'?.26:.6;m.position.set(Math.cos(a)*r,((clock*.5+i/18)%1)*.75,Math.sin(a)*r);});}
 const activeView=mapViews[data.map];activeView?.stream?.update(cameraPan,Math.hypot(camera.right,camera.top)*.85/camera.zoom);activeView?.update?.(data,clock);lakeView.update(data,clock,activeView?.stream?.inspect().loaded||[]);magicView.update(data,clock);outdoor.update(data,mapViews,clock,cameraPan);
 highlights.forEach((h,i)=>h.material.opacity=.35+Math.sin(clock*2+i)*.12);blooms.children.forEach((g,i)=>g.rotation.z=Math.sin(clock*1.6+i)*.035);
 if(now-lastRender>1000/(lite?30:45)){renderer.render(scene,camera);lastRender=now;}}
addEventListener('pagehide',()=>{if(ready)save();});
requestAnimationFrame(frame);load();
// Read-only snapshots make the prototype's movement and persistence testable.
window.gardenDebug={getLake:()=>lakeView.inspect(),getDistricts:()=>mapViews[data.map]?.stream?.inspect()||null,getMuseum:()=>mapViews.museum?.inspect?.()||null,getEnvironment:()=>({rain:rain.visible,hemi:hemi.intensity,sun:sun.intensity,fill:fill.intensity,seasonTint:mapViews[data.map]?.root.userData.seasonTint!==false,weather:weather(data.day,data.epoch),fog:scene.fog.far,...outdoor.inspect()}),getView:()=>({pan:{x:cameraPan.x,z:cameraPan.z},zoom:camera.zoom,folded:$('panel-content').hidden}),getState:()=>JSON.parse(JSON.stringify(data)),getPlayer:()=>actor?{skating:onLakeIce(data.map,actor.position,data),speed:playerSpeed,x:actor.position.x,z:actor.position.z,y:actor.position.y,seat:data.seat,posture:actor.userData.posture,bed:sleepPose(data),visualTilt:actor.getObjectByName('TravelerVisual')?.rotation.x,leg:actor.getObjectByName('leftLeg')?.rotation.x,moving:!!path.length,acting:acting?.kind||null}:null,project:(x,z)=>{const v=new THREE.Vector3(x,floorHeight(data.map,{x,z},data),z).project(camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};},getCompanion:()=>({skating:onLakeIce(data.companion.map,data.companion.position,data),...companionController.view(),posture:companionAvatar?.root.userData.posture,bed:sleepPose(data,'companion'),visualTilt:companionAvatar?.root.getObjectByName('TravelerVisual')?.rotation.x,map:data.companion.map,position:{...data.companion.position},visible:!!companionAvatar?.root.visible}),getRenderStats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,maps:Object.keys(mapViews)}),getReady:()=>ready,setLook:(who,look)=>{const a=who==='companion'?companionAvatar:playerAvatar;if(a)a.setLook(look);return !!a;}};

// Only bounded game actions cross this bridge. The model cannot mutate inventory or run code.
window.FairyGardenGame={
 flush:()=>ready&&save(),
 refreshSeasonPlan:()=>{refreshSeasonPlan();companionController.reset();},
 snapshot:()=>({epoch:data.epoch,season:seasonOf(data.day),lately:recentHappenings(data,6),magic:{...data.magic},journal:(data.journal||[]).slice(-14),day:data.day,time:timeLabel(data.minute),weather:weather(data.day,data.epoch),map:MAPS[data.map].name,position:{...data.position},companion:{name:data.companion.name,map:MAPS[data.companion.map].name,position:{...data.companion.position},activity:companionController.view().status},inventory:{water:data.water,herbs:data.herbs,mushrooms:data.mushrooms,potions:data.potions,flowers:data.blooms,harvest:data.harvest}}),
 setChatOpen:value=>{chatting=!!value;document.body.classList.toggle('chatting',chatting);},
 // 样貌（发型/发色/衣色）：一个身体十二款头发，换一款是数据。
 // ⚠️谁的样貌就存在谁名下：我的在 data.look，同行者的在 data.companion.look，
 //   换角色入住时各自跟着自己的存档走，不会串到别人头上。
 getLook:()=>({me:{...(data.look||{})},companion:{...((data.companion&&data.companion.look)||{})}}),
 // ── 花田：写字和翻花册在手机那一侧，走过去收在游戏这一侧 ──────────────
 // 补碎片池：静悄悄地打这一枪，失败也不拦着她继续挖（挖到的是没纹路的石头）
 fillPool:()=>fillPool(),
 // 锅：把碎片做成东西。⚠️全程零调用——做出来是什么由配方表算
 craft:(shardId,way,secondId)=>{const err=craftError(data,shardId,way,secondId);if(err)return err;
  const before=data;data=craftThing(data,shardId,way,secondId);if(data===before)return '这一炉没成。';
  ui();save();return '';},
 // 他刚说的那句话：显示在头顶，几秒后自己散掉。传空串就是立刻收起来
 speak:text=>{speak(text);return true;},
 // 漂流瓶：写字在手机那一侧，走到水边捞在游戏这一侧（跟花笺同一个分法）
 getBottles:()=>({days:BOTTLE_DAYS,day:data.day,floating:floating(data),
  drifts:(data.drifts||[]).slice(0,40),error:sealError(data,'x')}),
 seal:text=>{const err=sealError(data,text);if(err)return err;
  const before=data;data=sealBottle(data,text);if(data===before)return '这一只没放下去。';
  ui();save();return '';},
 // 收藏馆：捐出去的一份永不删除，炼金笔记的全表只在 world.mjs 那一处生成
 getCollection:()=>({rows:(data.collection||[]).slice(0,COLLECTION_VIEW),kinds:collectedKinds(data),
  total:RECIPE_TOTAL,made:[...(data.made||[])],recipes:recipeIndex()}),
 getThings:()=>({ways:{...CRAFT_WAYS},spots:{...SPOTS},day:data.day,
  rows:(data.things||[]).map(t=>({...t,ready:thingReady(data,t)}))}),
 place:(id,spot)=>{const before=data;data=placeThing(data,id,spot||null);
  if(data===before)return '这一样现在还摆不出去。';ui();save();return '';},
 getShards:()=>({kinds:{...SHARD_KINDS},rows:(data.shards||[]).slice(0,160),pool:(data.vein||[]).length,busy:digging,
  casts:(data.casts||[]).map(c=>({...c,place:SPELL_PLACES[c.place],spell:SPELLS[c.spell].name,line:castLine(data,c.place)})),
  spells:restoreSpells(data.spells).map(id=>({id,name:SPELLS[id].name,note:SPELLS[id].note,need:SHARD_KINDS[SPELLS[id].need]}))}),
 pinShard:id=>{data=pinShard(data,id);save();return true;},
 getGarden:()=>({day:data.day,seeds:(data.seeds||[]).filter(x=>!x.done).map(x=>({...x,bloomIn:Math.max(0,SEED_DAYS-(data.day-x.day))})),
  notes:(data.notes||[]).slice(0,120),ready:readySeeds(data).length,error:seedError(data),kinds:{...SEED_KINDS}}),
 pinNote:id=>{data=pinNote(data,id);save();return true;},
 setLook:(who,look)=>{if(!ready||!look)return false;
  const avatar=who==='companion'?companionAvatar:playerAvatar;if(!avatar)return false;
  avatar.setLook(look);
  // ⚠️dims 是嵌一层的：浅合并会让「只拖一根滑杆」把另外五根打回中性
  const merge=(old={})=>({...old,...look,...(look.dims?{dims:{...(old.dims||{}),...look.dims}}:{})});
  if(who==='companion')data={...data,companion:{...data.companion,look:merge(data.companion.look)}};
  else data={...data,look:merge(data.look)};
  return save();},
 applyAction:action=>{if(!ready||!action)return false;if(action.kind==='none')return true;if(!['follow','routine','wait','goto'].includes(action.kind))return false;if(action.kind==='goto'&&!COMPANION_DESTINATIONS[action.target])return false;data=wakeSleeper(data,'companion');data={...data,companion:{...data.companion,mode:action.kind,destination:action.target||data.companion.destination}};companionController.reset();ui();return save();}
};
installSeasonBook({getState:()=>data,getHost:()=>host,refresh:()=>{refreshSeasonPlan();companionController.reset();}});
if(host){$('host-talk').hidden=false;$('host-talk').onclick=()=>host.openChat();$('host-partner').hidden=false;$('host-partner').onclick=()=>host.changePartner();$('companion-dialog').querySelector('.prototype-note').textContent=boundPartner?'同行者来自角色卡；外形暂用小布偶。聊天沿用小手机创作线路。':'示例同行者按本地日程行动；可以选手机里的角色入住。';}
