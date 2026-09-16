import {installSeasonBook} from './season-book.mjs?v=fg-2bce841d8faa1f06';
import {makeMagicView} from './magic-view.mjs?v=fg-2bce841d8faa1f06';
import {installViewControls} from './view-controls.mjs?v=fg-2bce841d8faa1f06';
import * as THREE from 'three';
import {createMapLoader} from './map-loader.mjs?v=fg-2bce841d8faa1f06';
import {makeSurroundings} from './surroundings.mjs?v=fg-2bce841d8faa1f06';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=fg-2bce841d8faa1f06';
import {START,MAPS,NODES,weather,targetFor,actionError,walkable,findPath,perform,restoreState,freshState,COMPANION_DESTINATIONS,advanceTime,timeLabel,gardenIntent,seasonOf,hitInteraction,journalText,companionNearby,floorHeight,deepestAllowed,SEED_KINDS,SEED_DAYS,seedError,sowSeed,readySeeds,keepNotes,pinNote} from './world.mjs?v=fg-2bce841d8faa1f06';
import {makeForest} from './forest.mjs?v=fg-2bce841d8faa1f06';
import {makeDepths} from './depths.mjs?v=fg-2bce841d8faa1f06';
import {createTraveler} from './traveler.mjs?v=fg-2bce841d8faa1f06';
import {makeCompanionController,dailySchedule,plannedActivity} from './companion.mjs?v=fg-2bce841d8faa1f06';
const $=id=>document.getElementById(id),KEY='fairy-garden-prototype-v1';
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
const mapLoader=createMapLoader({maps:MAPS,loadAsset:async url=>{const root=(await assetLoader.loadAsync(url)).scene;root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return root;},factories:{forest:makeForest,depths:makeDepths},attach:root=>scene.add(root),detach:root=>scene.remove(root)}),mapViews=mapLoader.views;
let loadingMap=false,cameraFollow=false;
const magicView=makeMagicView();scene.add(magicView.seed,magicView.bed,magicView.lamps);let coloredSeason=-1;
function refreshSeasonPlan(){try{data.seasonPlan=host?.planState(data.day)?.plan||null;}catch{data.seasonPlan=null;}}
function isMenuOpen(){return $('companion-dialog').open||$('reset-dialog').open||$('season-dialog').open;}
const companionController=makeCompanionController();let playerAvatar,companionAvatar,timeAccumulator=0,lastAutoSave=0,lastCompanionUI=0,lastCompanionEvent='';
let actor,moving=false,path=[],task=null,acting=null,clock=0,ready=false;const ray=new THREE.Raycaster(),mouse=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-.08);
const targetRing=new THREE.Mesh(new THREE.RingGeometry(.13,.19,32),new THREE.MeshBasicMaterial({color:'#faf9ce',transparent:true,opacity:.9,side:THREE.DoubleSide}));targetRing.rotation.x=-Math.PI/2;targetRing.position.y=.1;targetRing.visible=false;scene.add(targetRing);
const highlights=[];for(const p of [MAPS.garden.stations.well,MAPS.garden.stations.garden,MAPS.garden.stations.travel]){const ring=new THREE.Mesh(new THREE.RingGeometry(.26,.29,40),new THREE.MeshBasicMaterial({color:'#f9e9b8',transparent:true,opacity:.75,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(p.x,.105,p.z);scene.add(ring);highlights.push(ring);}
const rainGeo=new THREE.BufferGeometry(),rainPoints=new Float32Array(90*3);for(let i=0;i<90;i++){rainPoints[i*3]=(Math.sin(i*89)*.5)*10;rainPoints[i*3+1]=(i%13)*.27;rainPoints[i*3+2]=(Math.cos(i*37)*.5)*10;}rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPoints,3));const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:'#e4f3ef',size:.035,transparent:true,opacity:.7}));scene.add(rain);
const blooms=new THREE.Group();scene.add(blooms);
const stream=new THREE.Group();scene.add(stream);stream.visible=false;for(let i=0;i<12;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.026,6,5),new THREE.MeshBasicMaterial({color:'#bcebee',transparent:true,opacity:.8}));stream.add(d);}
const magic=new THREE.Group();scene.add(magic);magic.visible=false;const sparkGeo=new THREE.SphereGeometry(.035,6,4),sparkMat=new THREE.MeshBasicMaterial({color:'#e2efb2'});for(let i=0;i<18;i++)magic.add(new THREE.Mesh(sparkGeo,sparkMat));
function grow(){blooms.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});blooms.clear();for(let i=0;i<data.blooms;i++){const group=new THREE.Group();const site=MAPS.garden.decor.blooms;group.position.set(site.x+i*.5,site.y,site.z);const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018,.023,.52,6),new THREE.MeshStandardMaterial({color:'#769876'}));stem.position.y=.26;group.add(stem);for(let j=0;j<5;j++){const p=new THREE.Mesh(new THREE.SphereGeometry(.10,10,7),new THREE.MeshStandardMaterial({color:'#b9ddd4',emissive:'#74bdaa',emissiveIntensity:.2,roughness:.85}));p.scale.set(1, .45,1.4);p.position.set(Math.cos(j*Math.PI*2/5)*.105,.55,Math.sin(j*Math.PI*2/5)*.105);group.add(p);}const c=new THREE.Mesh(new THREE.SphereGeometry(.055,10,7),new THREE.MeshStandardMaterial({color:'#f9e4a5',emissive:'#e5ce7a',emissiveIntensity:.25}));c.position.y=.56;group.add(c);blooms.add(group);}}
function button(id,icon,label,detail){$(id).innerHTML=`<span class="button-icon">${icon}</span><span>${label}<small>${detail}</small></span>`;}
function ui(){
 const woods=data.map==='forest',down=data.map==='depths';refreshSeasonPlan();$('water').textContent='● '.repeat(data.water)+'○ '.repeat(3-data.water);$('blooms').textContent=['幼苗','一朵苏醒','两朵苏醒','可以采收'][data.blooms];
 for(const k of ['herbs','mushrooms','potions','harvest','sand','stones'])$(k).textContent=data[k];
 $('place-title').textContent=MAPS[data.map].name;const season=seasonOf(data.day);$('season-open').textContent=`${season.name} · ${season.day}/14 天`; $('date').textContent=`第 ${season.year} 年 · ${season.name} ${season.day} 日 · ${weather(data.day)}`;// ⚠️副标题每分钟由 refreshTime 那一处重写，这儿再写一遍只会被它盖掉（写过一次，白写）$('weather-icon').textContent=down?'◇':weather(data.day)==='细雨'?'☂':woods?'✧':'☼';$('rest').disabled=woods||down||!!acting;$('rest').title=woods?'回到庭院后可以休息':'走回屋前休息，进入下一天';
 $('objective').textContent=down?(data.stones?'再往深处找找月石':'在这几层找到第一颗月石'):woods?'带一些森林的微光回家':data.blooms===3?'月光花开了，可以采收':data.potions?'用月露唤醒整圃月光花':data.herbs>=2&&data.mushrooms?'材料齐了，试试炼制月露':'沿着庭院小路，去林间采集';
 if(down){button('well','◈','刨一处矿脉','走过去 · 星砂或月石');button('garden','↡','再往下一层','越深越容易出月石');}
 else if(woods){button('well','❧','采铃叶草','每丛 2 份 · 炼药材料');button('garden','✧','采荧光菇','每丛 1 份 · 炼药材料');}
 else{button('well','♧','井边取水','走过去 · 装满水壶');button('garden','✿',data.blooms===3?'采收月光花':data.potions?'月露浇灌':'照料花圃',data.blooms===3?'收入花藏 · 留根再生':data.potions?'消耗月露 ×1 · 整圃开花':'消耗清水 ×1 · 唤醒一朵');}
 $('village-places').hidden=woods||down;$('brew').hidden=woods||down;
 $('brew').textContent=data.sand>=3?'⚗ 用星砂炼月露':'⚗ 炼制月露';$('brew').title=data.sand>=3?'星砂 ×3':'铃叶草 ×2 + 荧光菇 ×1 + 清水 ×1；或星砂 ×3';
 $('travel').textContent=down?'↑ 顺着梯子上去':woods?'↙ 返回微光庭院':'↗ 前往萤光林地';
 $('dive').hidden=woods||down;$('dive').textContent='↓ 下到井里';
 // 花笺：地里开好几株就写几株，一次全收（一次＝一枪）
 {const n=readySeeds(data).length;$('notes').hidden=woods||down;$('notes').disabled=!!acting||!n;
  $('notes').textContent=n?'✿ 收花笺 ×'+n:'✿ 花还没开';}
 for(const id of ['well','garden','brew','travel','dive'])$(id).disabled=!!acting;
 $('magic-action').parentElement.hidden=down;$('magic-action').textContent=woods?'一起唤醒种子':!data.magic.planted?'种下星铃种子':data.magic.growth>=2?'采收星铃花':'照料星铃花';$('make-lamp').hidden=woods;for(const id of ['magic-action','make-lamp'])$(id).disabled=!!acting;
 grow();refreshTime();updateCompanionUI();blooms.visible=!woods&&!down;document.body.classList.toggle('forest',woods);document.body.classList.toggle('depths',down);rain.visible=!down&&['细雨','细雪'].includes(weather(data.day));
}
function showMap(atPlayer=false){const center=atPlayer&&actor?{x:actor.position.x,z:actor.position.z}:MAPS[data.map].view||{x:0,z:0};cameraPan.set(center.x,0,center.z);coloredSeason=-1;const extent=MAPS[data.map].radius+2;sun.shadow.camera.left=-extent;sun.shadow.camera.right=extent;sun.shadow.camera.top=extent;sun.shadow.camera.bottom=-extent;sun.shadow.camera.updateProjectionMatrix();for(const [id,view] of Object.entries(mapViews))view.root.visible=id===data.map;highlights.forEach(h=>h.visible=data.map==='garden');const map=MAPS[data.map];scene.background.set(map.background);scene.fog.color.set(map.background);sun.intensity=map.light;ui();resize();}
function flash(){ $('arrival').classList.add('flash');setTimeout(()=>$('arrival').classList.remove('flash'),350);}
function say(s){$('message').textContent=s;}
function save(){if(actor)data.position={x:actor.position.x,z:actor.position.z};try{if(host){if(boundPartner)data.companion.name=boundPartner.name;const {seasonPlan,...saved}=data;if(!host.save(saved))throw Error('存档窗口已切换');}else {const {seasonPlan,...saved}=data;localStorage.setItem(KEY,JSON.stringify(saved));}saveOK=true;$('save').textContent='已保存在这台设备';}catch{saveOK=false;$('save').textContent='存储失败 · 暂勿关闭页面';}return saveOK;}
function resize(updateSize=true){const w=innerWidth,h=innerHeight;if(updateSize)renderer.setSize(w,h,false);const aspect=w/h;const spanX=aspect<1?(h<730?14:12.8):Math.max(14,16*aspect);const spanY=spanX/aspect;const offset=aspect<1?(h<730?2.0:1.4):2.1;camera.position.set(10+cameraPan.x,12,16+cameraPan.z);camera.lookAt(cameraPan.x,.5-offset/camera.zoom,cameraPan.z);camera.updateMatrixWorld();camera.left=-spanX/2;camera.right=spanX/2;camera.top=spanY/2;camera.bottom=-spanY/2;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
async function load(){try{const loader=assetLoader;await mapLoader.ensure(data.map);const a=await loader.loadAsync('./doll.glb?v=fg-2bce841d8faa1f06');playerAvatar=createTraveler(a.scene);actor=playerAvatar.root;actor.name='Player';scene.add(actor);companionAvatar=createTraveler(a.scene,true);companionAvatar.root.name='Companion';scene.add(companionAvatar.root);
 // 存档里存着的样貌（发型/发色/衣色）——没有就用 traveler.mjs 的默认。换发型是数据，不是另导一个模型。
 if(data.look)playerAvatar.setLook(data.look);if(data.companion&&data.companion.look)companionAvatar.setLook(data.companion.look);
 actor.position.set(data.position.x,.08,data.position.z);actor.rotation.y=.35;ready=true;showMap();if(data.map==='forest')say('林间的微光还在，背包和采集进度也都留下了。');else if(data.blooms)say('你上次照料过的月光花，还在这里。');$('loading').style.opacity=0;setTimeout(()=>$('loading').remove(),550);save();window.dispatchEvent(new Event('garden-ready'));if(host)host.ready();}catch(e){console.error(e);$('load-text').textContent='素材没有加载完成，请刷新重试。'+e.message;}}
function go(target,job=null){if(!ready||acting)return false;const points=findPath({x:actor.position.x,z:actor.position.z},target,data.map);if(!points?.length){say('那边暂时走不过去，换一块空地试试。');return false;}cameraFollow=true;path=points;task=job;targetRing.position.set(target.x,floorHeight(data.map,target)+.025,target.z);targetRing.visible=true;$('hint').style.opacity=0;if(!job)say(data.map==='depths'?'脚下是碎石，慢一点。':data.map==='forest'?'脚步轻一点，草叶里藏着小小的光。':'慢慢走，庭院里的路都属于这个下午。');return true;}
function request(kind,id){if(!ready||acting||loadingMap)return;const err=actionError(data,kind,id);if(err){say(err);return;}const p=targetFor(data,kind,id);if(!p)return;if(go(p,{kind,id}))say(kind==='visit'?`去${MAPS[data.map].sites[id].label}看看。`:({well:'去井边装一壶清水。',garden:data.blooms===3?'去把开好的月光花收进花藏。':data.potions?'带着月露，去唤醒整圃花。':'沿着小路，去看看花圃。',brew:'带齐材料，去炼药锅旁边。',travel:data.map==='garden'?'沿着庭院小路，走向林间。':'穿过石门，带着收获回家。',dive:'走到井边，扶着绳梯往下。',deeper:'找到那个往下的洞口。',ladder:'走回梯子下面。',seed:'去林地的微光旁，等同行者一起唤醒种子。',star:'去看看星铃花。',lamp:'把花带到屋前，做一盏星铃灯。',gather:'走近一点，摘下这一丛森林的礼物。',rest:'回屋睡一觉，让日子慢慢往前走。'})[kind]);}
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
for(const [id,site] of Object.entries(MAPS.garden.sites)){const o=document.createElement('option');o.value=id;o.textContent=site.label;$('place-select').append(o);}
$('visit-place').onclick=()=>request('visit',$('place-select').value);
function beginAction(job){acting={...job,intent:job.kind==='garden'?gardenIntent(data):null,time:0};actor.rotation.y=job.kind==='brew'?-Math.PI/2:Math.PI;$('progress').hidden=false;$('progress').firstElementChild.style.width='0%';ui();say(job.kind==='visit'?'在这里停一会儿。':({well:'井水晃了一下，清凉地流进壶底。',garden:data.blooms===3?'把开好的花轻轻摘下来，留住花根。':data.potions?'月露落在叶尖，微光沿着叶脉散开。':'一点一点浇下去，叶子舒展开来。',brew:'草叶、荧光菇和清水，在锅里轻轻旋转……',seed:'把手放在微光两侧，等两个人的魔力慢慢汇合。',star:'留一点清水，看看花的变化。',lamp:'把花的微光留进灯罩里。',gather:'轻轻摘下，给它留一点明天生长的余地。',travel:'穿过小路，风里换了一种草木香。',rest:'灯熄了。窗外的风，替你翻过了一页日历。'})[job.kind]);}
async function completeAction(){if(loadingMap)return;const {kind,id,intent}=acting;
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
  try{await mapLoader.ensure(kind==='dive'?'depths':'garden');}catch(e){acting=null;$('progress').hidden=true;ui();say('井里那一段没有加载完成，进度留在原地，稍后再试。');return;}finally{loadingMap=false;}}
 if(kind==='travel'){loadingMap=true;say('正在打开前方的小路…');try{await mapLoader.ensure(MAPS[data.map].exits.travel.to);}catch(e){acting=null;$('progress').hidden=true;ui();say('前方场景没有加载完成，进度留在原地，稍后再试。');return;}finally{loadingMap=false;}}
const before=data;data=perform(data,kind,id,intent||undefined);acting=null;$('progress').hidden=true;stream.visible=false;if(data===before){ui();say('这次行动没有完成，材料和进度都保留了。');return;}
 if(kind==='travel'||kind==='dive'||kind==='ladder'){actor.position.set(data.position.x,.08,data.position.z);flash();showMap(true);mapLoader.keep(data.map);}
 else if(kind==='deeper'){actor.position.set(data.position.x,.08,data.position.z);flash();showMap(true);}
 else if(kind==='rest'){flash();showMap();}else ui();save();
 say(kind==='dive'?'井比看上去深。落到第一层时，石壁上有细碎的光。':
  kind==='deeper'?'又下了一层，这里是第 '+data.depth+' 层。空气更凉了。':
  kind==='ladder'?'爬回井口，天光刺了一下眼睛。星砂 '+data.sand+' · 月石 '+data.stones+'。':
  kind==='gather'&&data.map==='depths'?(before.stones!==data.stones?'月石 +1。往下的路又通了两层。':'星砂 +'+(data.sand-before.sand)+'。三份能换一颗月露。'):
  kind==='visit'?MAPS[data.map].sites[id].text:kind==='seed'?'星铃种子 +1。带回庭院种下吧。':kind==='star'?!before.magic.planted?'种子已经住进小花盆，每天用清水照料一次。':before.magic.growth>=2?'星铃花 +1，花谱记住了它。可以和三朵月光花一起制作星铃灯。':'新芽长大了一点，隔一天再来照料吧。':kind==='lamp'?'星铃灯留在屋前了。天色暗下来时，它会亮起。':kind==='travel'?(data.map==='forest'?'林地到了。铃叶草和荧光菇，可以一起炼成月露。':'回家了。炼药需要两份铃叶草、一份荧光菇和一格清水。'):kind==='rest'?`第 ${data.day} 天，${weather(data.day)}。林地的材料重新长好了。${weather(data.day)==='细雨'?'雨水也替花圃浇了一次水。':''}`:kind==='gather'?(NODES.find(n=>n.id===id).kind==='herb'?'铃叶草 +2，收进背包了。':'荧光菇 +1，收进背包了。'):kind==='brew'?'月露 +1。带去花圃，就能让尚未开好的花一起苏醒。':kind==='well'?'水壶装满了，浇花和炼药都可以用。':before.blooms===3?'月光花 +3，收入花藏。花根还在，可以继续照料。':before.potions?'月露散开，整圃月光花都亮了。可以采收啦。':'一朵月光花醒来了，再照料一下旁边的花吧。');}
function tapMap(clientX,clientY){const r=canvas.getBoundingClientRect();mouse.set((clientX-r.left)/r.width*2-1,-(clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);if(companionAvatar?.root.visible&&ray.intersectObject(companionAvatar.root,true).length){openCompanion();return;}const point=new THREE.Vector3();if(ray.ray.intersectPlane(plane,point)){const picked=mapViews[data.map]?.pick?.(ray);const hit=picked?{kind:'gather',id:picked}:hitInteraction(data.map,point,data.depth);if(hit){if(hit.kind==='seed'){$('magic-action').click();}else request(hit.kind,hit.id);return;}if(walkable(point.x,point.z,data.map))go({x:point.x,z:point.z});}}

function panMap(dx,dy){cameraFollow=false;
 camera.updateMatrixWorld();const a=new THREE.Vector3(),b=new THREE.Vector3(),r=new THREE.Raycaster();r.setFromCamera(new THREE.Vector2(0,0),camera);if(!r.ray.intersectPlane(plane,a))return;r.setFromCamera(new THREE.Vector2(dx/innerWidth*2,-dy/innerHeight*2),camera);if(!r.ray.intersectPlane(plane,b))return;cameraPan.add(a.sub(b));cameraPan.y=0;cameraPan.clampLength(0,MAPS[data.map].radius);resize(false);
}
const viewControls=installViewControls({canvas,center:$('view-center'),onCenter:()=>{cameraFollow=true;if(actor)cameraPan.set(actor.position.x,0,actor.position.z);resize(false);},onReset:()=>{cameraFollow=false;const p=MAPS[data.map].view||{x:0,z:0};cameraPan.set(p.x,0,p.z);},onPan:panMap,panel:$('action-panel'),content:$('panel-content'),toggle:$('panel-toggle'),zoomIn:$('zoom-in'),zoomOut:$('zoom-out'),reset:$('zoom-reset'),onTap:tapMap,onZoom:value=>{camera.zoom=value;resize(false);}});
canvas.addEventListener('keydown',e=>{const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(d&&actor){e.preventDefault();go({x:actor.position.x+d[0],z:actor.position.z+d[1]});}});
let lite=false;$('quality').onclick=()=>{lite=!lite;renderer.setPixelRatio(Math.min(devicePixelRatio,lite?1:1.6));renderer.shadowMap.enabled=!lite;$('quality').textContent=lite?'精细画质':'轻量画质';scene.traverse(o=>{if(o.material)o.material.needsUpdate=true;});resize();};
$('reset').onclick=()=>$('reset-dialog').showModal();$('cancel-reset').onclick=()=>$('reset-dialog').close();$('confirm-reset').onclick=async()=>{if(loadingMap)return;loadingMap=true;try{await mapLoader.ensure('garden');}catch(e){say('小屋暂时没有加载成功，原来的进度还在。');return;}finally{loadingMap=false;}path=[];task=null;acting=null;stream.visible=false;$('progress').hidden=true;data={...freshState(),epoch:Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)};companionController.reset();timeAccumulator=0;lastCompanionEvent='';if(actor)actor.position.set(START.x,.08,START.z);targetRing.visible=false;showMap();mapLoader.keep('garden');save();if(boundPartner)data.companion.name=boundPartner.name;say('新的生活，从一壶清水和一条林间小路开始。');$('reset-dialog').close();};
function refreshTime(){
 const season=seasonOf(data.day);$('season-open').textContent=`${season.name} · ${season.day}/14 天`; $('date').textContent=`第 ${season.year} 年 · ${season.name} ${season.day} 日 · ${weather(data.day)}`;$('place-subtitle').textContent=`${timeLabel(data.minute)} · ${data.map==='depths'?'第 '+data.depth+' 层 · 往下还通 '+Math.max(0,deepestAllowed(data)-data.depth)+' 层':data.map==='forest'?'萤光与草木':'小屋与月光花'}`;
 const late=data.minute>=season.dusk+90,dusk=data.minute>=season.dusk;hemi.intensity=late?1.3:dusk?1.7:2.1;sun.intensity=MAPS[data.map].light*(late?.40:dusk?.75:1);sun.color.set(late?'#cad8f1':dusk?'#ffcf9e':'#fff0d0');
 const underground=data.map==='depths';const color=underground?MAPS.depths.background:late?'#b9c8c3':dusk?'#e1dcc5':MAPS[data.map].background;scene.background.set(color);scene.fog.color.set(color);surroundings.root.visible=!underground;if(!underground)surroundings.update(data.map,season.tint,MAPS[data.map]);
 if(coloredSeason!==season.index){coloredSeason=season.index;for(const view of Object.values(mapViews))view.root.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.color){m.userData.baseTint ??= m.color.getHex();m.color.setHex(m.userData.baseTint).lerp(new THREE.Color(season.tint),.12);}});} rain.material.color.set(weather(data.day)==='细雪'?'#ffffff':'#e4f3ef');rain.material.size=weather(data.day)==='细雪'?.06:.035;rain.visible=['细雨','细雪'].includes(weather(data.day));
}
function updateCompanionUI(){const c=data.companion,v=companionController.view();$('companion-status').textContent=`${c.name} · ${c.map===data.map?v.status:MAPS[c.map].name+' · '+v.status}`;$('companion-tag').textContent=c.name;}
function drawSchedule(){const preview={...data,companion:{...data.companion,temperament:$('companion-type').value}},current=plannedActivity(preview);$('companion-current-time').textContent=`${weather(data.day)} · ${timeLabel(data.minute)}`;$('companion-schedule').replaceChildren();for(const item of dailySchedule(preview)){const li=document.createElement('li'),t=document.createElement('time'),label=document.createElement('span');t.textContent=timeLabel(item.start);label.textContent=item.label+(item.note?' · '+item.note:'');li.append(t,label);li.classList.toggle('current',current.start===item.start);$('companion-schedule').append(li);}}
function openCompanion(){if(!ready)return;const c=data.companion;$('companion-input').value=c.name;$('companion-input').disabled=!!boundPartner;$('companion-type').value=c.temperament;drawSchedule();$('companion-detail').textContent=`现在在${MAPS[c.map].name}，${companionController.view().status}。${lastCompanionEvent||''}`;$('companion-follow').setAttribute('aria-pressed',c.mode==='follow');$('companion-routine').setAttribute('aria-pressed',c.mode==='routine');$('companion-wait').disabled=!!acting;$('companion-dialog').showModal();}
function applyCompanion(mode=data.companion.mode){data={...data,companion:{...data.companion,name:$('companion-input').value.trim().slice(0,16)||'同行者',temperament:$('companion-type').value,mode}};companionController.reset();save();updateCompanionUI();}
$('companion-open').onclick=openCompanion;$('companion-tag').onclick=openCompanion;$('companion-close').onclick=()=>$('companion-dialog').close();$('companion-type').onchange=drawSchedule;
$('companion-save').onclick=()=>{applyCompanion();$('companion-dialog').close();say(`${data.companion.name}会按新的偏好安排接下来的日子。`);};
$('companion-follow').onclick=()=>{applyCompanion('follow');$('companion-dialog').close();say(`${data.companion.name}听见了，会沿着小路过来和你同行。`);};
$('companion-routine').onclick=()=>{applyCompanion('routine');$('companion-dialog').close();say(`${data.companion.name}继续自己的安排，你们可以在世界里再碰面。`);};
$('companion-wait').onclick=()=>{if(acting)return;applyCompanion();path=[];task=null;targetRing.visible=false;data.position={x:actor.position.x,z:actor.position.z};for(let i=0;i<60;i++){data=advanceTime(data,1);const result=companionController.tick(data,1);data=result.state;if(result.event)lastCompanionEvent=result.event;}timeAccumulator=0;$('companion-dialog').close();showMap();save();say(`歇了一会儿，现在是 ${timeLabel(data.minute)}。${data.companion.name}${companionController.view().status}。`);};
function updateWorld(elapsed,dt){
 if(!ready||!actor)return;const paused=isMenuOpen();
 if(!paused){data.position={x:actor.position.x,z:actor.position.z};if(!chatting)timeAccumulator+=elapsed;if(timeAccumulator>=1){const oldDay=data.day,minutes=Math.floor(timeAccumulator);timeAccumulator-=minutes;data=advanceTime(data,minutes);if(data.day!==oldDay){ui();save();if(!acting)say(`第 ${data.day} 天，${weather(data.day)}。林地又长出了新的材料。`);}else refreshTime();}
 const result=companionController.tick(data,dt,{allowCare:acting?.kind!=='garden'});data=result.state;if(result.event){lastCompanionEvent=result.event;ui();save();if(!acting)say(result.event);}
 if(clock-lastAutoSave>10){save();lastAutoSave=clock;}}
 const c=data.companion,v=companionController.view(),root=companionAvatar.root;root.visible=c.map===data.map;root.position.set(c.position.x,.08,c.position.z);if(v.moving||v.gesture==='water')root.rotation.y+=Math.atan2(Math.sin(v.heading-root.rotation.y),Math.cos(v.heading-root.rotation.y))*Math.min(1,dt*12);companionAvatar.animate(clock,{moving:!paused&&v.moving,gesture:v.gesture,height:floorHeight(c.map,c.position)});
 const point=new THREE.Vector3(c.position.x,1.95,c.position.z).project(camera),x=(point.x+1)*innerWidth/2,y=(1-point.y)*innerHeight/2;const panelTop=$('action-panel').getBoundingClientRect().top-12;$('companion-tag').hidden=!root.visible||x<15||x>innerWidth-15||y<125||y>panelTop;$('companion-tag').style.left=x+'px';$('companion-tag').style.top=y+'px';
 if(clock-lastCompanionUI>.3){updateCompanionUI();lastCompanionUI=clock;}
}
let last=performance.now(),lastRender=0;function frame(now){requestAnimationFrame(frame);if(document.hidden){last=now;return;}const elapsed=Math.min((now-last)/1000,1),dt=Math.min(elapsed,.05);last=now;clock+=dt;if(loadingMap){renderer.render(scene,camera);return;}
 if(actor&&!isMenuOpen()){moving=path.length>0;if(moving){const next=path[0],dx=next.x-actor.position.x,dz=next.z-actor.position.z,dist=Math.hypot(dx,dz),step=1.45*dt;if(dist<=step){actor.position.x=next.x;actor.position.z=next.z;path.shift();if(!path.length){targetRing.visible=false;save();if(task){const k=task;task=null;beginAction(k);}}}else{actor.position.x+=dx/dist*step;actor.position.z+=dz/dist*step;}const angle=Math.atan2(dx,dz);actor.rotation.y+=Math.atan2(Math.sin(angle-actor.rotation.y),Math.cos(angle-actor.rotation.y))*Math.min(1,dt*13);}
 playerAvatar.animate(clock,{moving,gesture:acting?'water':'rest',height:floorHeight(data.map,{x:actor.position.x,z:actor.position.z})});
 if(acting){const together=acting.kind!=='seed'||companionNearby(data);if(together)acting.time+=dt;else {acting.wait=(acting.wait||0)+dt;say('等同行者走到身边，再一起唤醒种子。');if(acting.wait>35){acting=null;$('progress').hidden=true;ui();say('这次没等到同行者到场，种子还在，可以再叫他一起过来。');}}if(acting){const duration=acting.kind==='brew'?2.5:acting.kind==='rest'?2:acting.kind==='travel'?.5:1.5;$('progress').firstElementChild.style.width=Math.min(100,acting.time/duration*100)+'%';if(acting.kind==='garden'&&data.blooms<3){stream.visible=true;stream.position.set(actor.position.x+.22,.5,actor.position.z-.4);stream.children.forEach((d,i)=>{const p=(clock*1.5+i/12)%1;d.position.set(Math.sin(i*2.4)*.10,.55-p*.55,-p*.35);});}if(acting.time>=duration)completeAction();}}}
 if(actor&&moving&&cameraFollow){cameraPan.lerp(new THREE.Vector3(actor.position.x,0,actor.position.z),1-Math.exp(-dt*4));resize(false);}
 updateWorld(elapsed,dt);
 magic.visible=!!acting&&(acting.kind==='brew'||acting.kind==='garden'&&data.potions>0&&data.blooms<3);if(magic.visible){const site=MAPS.garden.interactions.find(x=>x.kind===(acting.kind==='brew'?'brew':'garden'));magic.position.set(site.x,.65,site.z);magic.children.forEach((m,i)=>{const a=clock*2+i*2.4,r=acting.kind==='brew'?.26:.6;m.position.set(Math.cos(a)*r,((clock*.5+i/18)%1)*.75,Math.sin(a)*r);});}
 mapViews[data.map]?.update?.(data,clock);magicView.update(data,clock);if(rain.visible){rain.position.set(cameraPan.x,0,cameraPan.z);for(let i=0;i<90;i++)rainPoints[i*3+1]=(4+((i%13)*.27-clock*2)%4)%4;rainGeo.attributes.position.needsUpdate=true;}
 highlights.forEach((h,i)=>h.material.opacity=.35+Math.sin(clock*2+i)*.12);blooms.children.forEach((g,i)=>g.rotation.z=Math.sin(clock*1.6+i)*.035);
 if(now-lastRender>1000/(lite?30:45)){renderer.render(scene,camera);lastRender=now;}}
addEventListener('pagehide',()=>{if(ready)save();});
requestAnimationFrame(frame);load();
// Read-only snapshots make the prototype's movement and persistence testable.
window.gardenDebug={getView:()=>({pan:{x:cameraPan.x,z:cameraPan.z},zoom:camera.zoom,folded:$('panel-content').hidden}),getState:()=>JSON.parse(JSON.stringify(data)),getPlayer:()=>actor?{x:actor.position.x,z:actor.position.z,moving:!!path.length,acting:acting?.kind||null}:null,project:(x,z)=>{const v=new THREE.Vector3(x,.08,z).project(camera);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight};},getCompanion:()=>({...companionController.view(),map:data.companion.map,position:{...data.companion.position},visible:!!companionAvatar?.root.visible}),getRenderStats:()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,maps:Object.keys(mapViews)}),getReady:()=>ready,setLook:(who,look)=>{const a=who==='companion'?companionAvatar:playerAvatar;if(a)a.setLook(look);return !!a;}};

// Only bounded game actions cross this bridge. The model cannot mutate inventory or run code.
window.FairyGardenGame={
 flush:()=>ready&&save(),
 refreshSeasonPlan:()=>{refreshSeasonPlan();companionController.reset();},
 snapshot:()=>({epoch:data.epoch,season:seasonOf(data.day),magic:{...data.magic},journal:(data.journal||[]).slice(-14),day:data.day,time:timeLabel(data.minute),weather:weather(data.day),map:MAPS[data.map].name,position:{...data.position},companion:{name:data.companion.name,map:MAPS[data.companion.map].name,position:{...data.companion.position},activity:companionController.view().status},inventory:{water:data.water,herbs:data.herbs,mushrooms:data.mushrooms,potions:data.potions,flowers:data.blooms,harvest:data.harvest}}),
 setChatOpen:value=>{chatting=!!value;document.body.classList.toggle('chatting',chatting);},
 // 样貌（发型/发色/衣色）：一个身体十二款头发，换一款是数据。
 // ⚠️谁的样貌就存在谁名下：我的在 data.look，同行者的在 data.companion.look，
 //   换角色入住时各自跟着自己的存档走，不会串到别人头上。
 getLook:()=>({me:{...(data.look||{})},companion:{...((data.companion&&data.companion.look)||{})}}),
 // ── 花田：写字和翻花册在手机那一侧，走过去收在游戏这一侧 ──────────────
 getGarden:()=>({day:data.day,seeds:(data.seeds||[]).filter(x=>!x.done).map(x=>({...x,bloomIn:Math.max(0,SEED_DAYS-(data.day-x.day))})),
  notes:(data.notes||[]).slice(0,120),ready:readySeeds(data).length,error:seedError(data),kinds:{...SEED_KINDS}}),
 sow:(kind,ask)=>{if(!ready)return '还没准备好。';const err=seedError(data);if(err)return err;
  const next=sowSeed(data,kind,ask);if(next===data)return '这一株没种下去。';data=next;ui();save();return '';},
 pinNote:id=>{data=pinNote(data,id);save();return true;},
 setLook:(who,look)=>{if(!ready||!look)return false;
  const avatar=who==='companion'?companionAvatar:playerAvatar;if(!avatar)return false;
  avatar.setLook(look);
  // ⚠️dims 是嵌一层的：浅合并会让「只拖一根滑杆」把另外五根打回中性
  const merge=(old={})=>({...old,...look,...(look.dims?{dims:{...(old.dims||{}),...look.dims}}:{})});
  if(who==='companion')data={...data,companion:{...data.companion,look:merge(data.companion.look)}};
  else data={...data,look:merge(data.look)};
  return save();},
 applyAction:action=>{if(!ready||!action)return false;if(action.kind==='none')return true;if(!['follow','routine','wait','goto'].includes(action.kind))return false;if(action.kind==='goto'&&!COMPANION_DESTINATIONS[action.target])return false;data={...data,companion:{...data.companion,mode:action.kind,destination:action.target||data.companion.destination}};companionController.reset();ui();return save();}
};
installSeasonBook({getState:()=>data,getHost:()=>host,refresh:()=>{refreshSeasonPlan();companionController.reset();}});
if(host){$('host-talk').hidden=false;$('host-talk').onclick=()=>host.openChat();$('host-partner').hidden=false;$('host-partner').onclick=()=>host.changePartner();$('companion-dialog').querySelector('.prototype-note').textContent=boundPartner?'同行者来自角色卡；外形暂用小布偶。聊天沿用小手机创作线路。':'示例同行者按本地日程行动；可以选手机里的角色入住。';}
