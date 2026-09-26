// 陪伴（桌宠）的画面：一个高清的 v2 小人，透明底，住在 iframe 里。
// 外壳（js/companion.js）用 postMessage 把样貌和表情送进来：{type:'pet-look', look, ta}。
// ?mode=float 是悬浮小窗：点一下就请外壳打开陪伴。
// 小人本身、换装、表情、体型全部走庭院那一份 traveler.mjs，不另写一套（one-public-mechanism）。
import * as T from 'three';
import {GLTFLoader} from '../fairy-garden/vendor/GLTFLoader.js';
import {DRACOLoader} from '../fairy-garden/vendor/DRACOLoader.js';
import {createTraveler,setFaceBase} from '../fairy-garden/traveler.mjs';
import {lookForTa,mergeLook,dyesOf,outfitId,outfitColors,hairId,HAIR_MODES} from '../fairy-garden/wardrobe.mjs';
const mode=new URLSearchParams(location.search).get('mode')||'full';
// 悬浮小窗用庭院那份 1K 的小人和脸：屏幕上只有指甲盖大，高清版白占内存（整页时手机会被挤得重载）
if(mode!=='float')setFaceBase(new URL('./faces/',import.meta.url).href);
const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setClearColor(0,0);r.setPixelRatio(Math.min(2,devicePixelRatio||1));r.outputColorSpace=T.SRGBColorSpace;document.body.append(r.domElement);
const sc=new T.Scene();sc.add(new T.HemisphereLight('#fff8ee','#b8a38c',2.3));const sun=new T.DirectionalLight('#ffffff',1.5);sun.position.set(1.2,3,2.6);sc.add(sun);
const cam=new T.PerspectiveCamera(mode==='float'?24:26,1,.05,20);
function size(){const w=innerWidth,h=innerHeight;r.setSize(w,h);cam.aspect=w/h;
 // 整个人放进画面：头顶约 1.2，脚 0
 const top=1.25,bottom=-.02,mid=(top+bottom)/2,half=(top-bottom)/2*1.08;const dist=Math.max(half/Math.tan(cam.fov*Math.PI/360),half/cam.aspect/Math.tan(cam.fov*Math.PI/360));
 cam.position.set(0,mid+.05,dist+.3);cam.lookAt(0,mid,0);cam.updateProjectionMatrix();}
addEventListener('resize',size);size();
const loader=new GLTFLoader();const draco=new DRACOLoader();draco.setDecoderPath('../fairy-garden/vendor/draco/');loader.setDRACOLoader(draco);
let pet=null,pending=null,lastLook='',cur={look:{},ta:'TA'};
// 外壳的换装面板（庭院那一份 DressControls）问这里要现值、让这里合并改动——换装规则只有 wardrobe.mjs 一份
const full=()=>({...lookForTa(cur.ta),...cur.look});
window.PetGame={hairModes:HAIR_MODES,getDyes:()=>dyesOf(full(),full()),getOutfit:()=>{const l=full();return {id:outfitId(l),colors:outfitColors(l)};},getHair:()=>hairId(full().hair),merge:(look,patch)=>mergeLook(look||{},patch||{})};
const apply=m=>{cur={look:m.look||{},ta:m.ta||'TA'};if(!pet){pending=m;return;}const look=full();const key=JSON.stringify(look);if(key===lastLook)return;lastLook=key;pet.setLook(look);};
addEventListener('message',e=>{if(e.data&&e.data.type==='pet-look')apply(e.data);});
// 两种都用庭院那一份小人：高清整包（8MB、上百 MB 解码）在她手机上一点进来就把 app 挤到重启（2026-09-26）。
// 清晰靠整页的 2K 脸和按屏幕像素比渲染。
const gltf=await loader.loadAsync('../fairy-garden/doll.glb');pet=createTraveler(gltf.scene,true,{});sc.add(pet.root);if(pending)apply(pending);
parent.postMessage({type:'pet-ready'},'*');
// 待着的时候偶尔挥挥手、伸个懒腰：动作公式都是庭院那一套
let wave=null,yaw=0;const clock=new T.Clock();
r.setAnimationLoop(()=>{const t=clock.getElapsedTime();
 if(!wave&&t>4&&Math.random()<.0015)wave={kind:Math.random()<.6?'wave':'stretch',start:t};
 let gesture='rest',progress=0;if(wave){const dur=wave.kind==='wave'?3.4:3.8;progress=(t-wave.start)/dur;if(progress>=1)wave=null;else gesture=wave.kind;}
 pet.animate(t,{gesture,progress,height:0});pet.root.rotation.y=yaw+Math.sin(t*.35)*.12;r.render(sc,cam);});
if(mode==='float'){let down=null;addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6)parent.postMessage({type:'pet-open'},'*');down=null;});}
else{// 拖着转圈看；轻点一下他就挥手
 let drag=null,moved=0;addEventListener('pointerdown',e=>{drag=e.clientX;moved=0;});addEventListener('pointermove',e=>{if(drag!=null){yaw+=(e.clientX-drag)*.01;moved+=Math.abs(e.clientX-drag);drag=e.clientX;}});
 addEventListener('pointerup',()=>{if(drag!=null&&moved<6&&!wave)wave={kind:'wave',start:clock.getElapsedTime()};drag=null;});}
