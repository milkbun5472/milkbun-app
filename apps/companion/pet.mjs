// 陪伴（桌宠）的画面：一个高清的 v2 小人，透明底，住在 iframe 里。
// 外壳（js/companion.js）用 postMessage 把样貌和表情送进来：{type:'pet-look', look, ta}。
// ?mode=float 是悬浮小窗：点一下就请外壳打开陪伴。
// 小人本身、换装、表情、体型全部走庭院那一份 traveler.mjs，不另写一套（one-public-mechanism）。
import * as T from 'three';
import {targetAt,highFiveHit} from './touch-targets.mjs?v=fg-8e92d657ad09bbcc';
import {MOODS,DUR,moodBase,pulse,accent,chooseAction} from './motion.mjs?v=fg-8e92d657ad09bbcc';
import {GLTFLoader} from '../fairy-garden/vendor/GLTFLoader.js?v=fg-8e92d657ad09bbcc';
import {DRACOLoader} from '../fairy-garden/vendor/DRACOLoader.js?v=fg-8e92d657ad09bbcc';
import {createTraveler,setFaceBase} from '../fairy-garden/traveler.mjs?v=fg-8e92d657ad09bbcc';
import {lookForTa,mergeLook,dyesOf,outfitId,outfitColors,hairId,HAIR_MODES} from '../fairy-garden/wardrobe.mjs?v=fg-8e92d657ad09bbcc';
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
let pet=null,pending=null,lastLook='',cur={look:{},ta:'TA',characterId:''},outfitShowToken=0;
// 外壳的换装面板（庭院那一份 DressControls）问这里要现值、让这里合并改动——换装规则只有 wardrobe.mjs 一份
const full=()=>({...lookForTa(cur.ta),...cur.look});
window.PetGame={hairModes:HAIR_MODES,getDyes:()=>dyesOf(full(),full()),getOutfit:()=>{const l=full();return {id:outfitId(l),colors:outfitColors(l)};},getHair:()=>hairId(full().hair),merge:(look,patch)=>mergeLook(look||{},patch||{})};
const outfitKey=look=>JSON.stringify([outfitId(look),outfitColors(look)]);
const apply=m=>{
 const previous=cur,oldLook=full(),wasReady=!!lastLook;
 cur={look:m.look||{},ta:m.ta||'TA',characterId:String(m.characterId||'')};
 const changedCharacter=previous.characterId!==cur.characterId||previous.ta!==cur.ta;
 if(changedCharacter)outfitShowToken++;
 if(!pet){pending=m;return;}
 const look=full(),key=JSON.stringify([cur.characterId,look]);if(key===lastLook)return;
 lastLook=key;pet.setLook(look,true);
 if(wasReady&&!changedCharacter&&outfitKey(oldLook)!==outfitKey(look)){
  const token=++outfitShowToken;
  setTimeout(async()=>{
   await pet.ready();
   if(token!==outfitShowToken||document.hidden||sleeping||held)return;
   const visual=pet.root.getObjectByName('TravelerVisual');
   const id=outfitId(full());let wearing=false;
   visual?.traverse(o=>{if(o.isMesh&&o.visible&&o.userData.outfit===id)wearing=true;});
   if(wearing)act={kind:'emotion-show',start:clock.getElapsedTime()};
  },400);
 }
};
addEventListener('message',e=>{if(e.data&&e.data.type==='pet-look')apply(e.data);if(e.data&&e.data.type==='pet-ctx')setCtx(e.data);});
// 外壳告诉他你在哪一页、有没有在放歌、多久没碰手机（她 2026-09-26：点他有反应／跟着时间／看你在干嘛）。
let ctx={screen:'',music:false,idle:false},sleeping=false;
function setCtx(m){const was=ctx.idle;ctx={screen:String(m.screen||''),music:!!m.music,idle:!!m.idle};if(was&&!ctx.idle)wake();}
// 两种都用庭院那一份小人：高清整包（8MB、上百 MB 解码）在她手机上一点进来就把 app 挤到重启（2026-09-26）。
// 清晰靠整页的 2K 脸和按屏幕像素比渲染。
// 小人 doll.glb 约 1.4MB（只有身体和头发），身上那套衣服另下 0.6–1.1MB（outfits/，按需加载，她 2026-09-26 定）。第一次进来要真下一遍：
// 报个进度，别让人对着空屏幕猜是不是坏了。
// ⚠️这行原来是模块顶层的裸 await：网抖一下就整个 iframe 卡住、pet-ready 永不发，
//   外壳那句「小人还在来的路上…」会永远挂着（2026-09-26 发公共版前查出来的）。
try{
 const gltf=await loader.loadAsync('../fairy-garden/doll.glb?v=fg-8e92d657ad09bbcc',
   e=>{if(e&&e.total)parent.postMessage({type:'pet-progress',pct:Math.min(99,Math.round(e.loaded/e.total*100))},'*');});
 pet=createTraveler(gltf.scene,true,pending?full():{});sc.add(pet.root);if(pending)apply(pending);   // 样貌先到了就直接照它建：头发按需下载，别先白下一款默认的
 parent.postMessage({type:'pet-ready'},'*');
}catch(err){
 parent.postMessage({type:'pet-failed',why:String((err&&err.message)||err).slice(0,200)},'*');
 throw err;
}
let act=null,yaw=0,nextAt=3,curMood='default',sitB=0,lastT=0,soft={y:0,tilt:0,yaw:0};const clock=new T.Clock();
window.petDebug={ready:()=>pet.ready(),frames:0,snapshot:()=>({action:act?.kind,emotion:pet.root.userData.emotion,targets:touchTargets()}),play:(k,at)=>{act={kind:k,start:clock.getElapsedTime()-(at||0)*DUR[k]};}};   // 截图/测试用；frames 用来验切后台真停了
// 你在哪儿：聊天→凑过去看；写东西／专注→坐在旁边安静陪；其余照心情来
const CHAT=['thread','gthread','messages','forum'],QUIET=['diary','fanfic','memo','dreamjournal','study','pomodoro','read'];
const night=()=>{const h=new Date().getHours();return h>=23||h<6;};
let greeted=false,held=null,taps=[];const lastActions=new Map();
function pickForMood(face,pool){const key=MOODS[face]?face:'default',kind=chooseAction(pool||MOODS[key].acts,lastActions.get(key));lastActions.set(key,kind);return kind;}
function wake(){if(!sleeping)return;sleeping=false;act={kind:'wake',start:clock.getElapsedTime()};}
function touchTargets(){
 if(!pet)return [];pet.root.updateWorldMatrix(true,true);cam.updateMatrixWorld(true);
 const rect=r.domElement.getBoundingClientRect(),project=v=>{const p=v.clone().project(cam);return {x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2,z:p.z};};
 const radius=(point,size)=>{const right=new T.Vector3(1,0,0).applyQuaternion(cam.quaternion).multiplyScalar(size),a=project(point),b=project(point.clone().add(right));return Math.abs(a.x-b.x);};
 const result=[],surfaces=[];pet.root.traverseVisible(o=>{if(o.isMesh)surfaces.push(o);});
 const ray=new T.Raycaster();
 const exposed=point=>{const origin=cam.getWorldPosition(new T.Vector3()),distance=origin.distanceTo(point);ray.set(origin,point.clone().sub(origin).normalize());const hit=ray.intersectObjects(surfaces,false)[0];return !hit||hit.distance>=distance-.08;};
 for(const side of ['left','right']){
  const hand=pet.root.getObjectByName(side==='left'?'Left_hand':'Right_hand');if(!hand)continue;
  const pos=hand.getWorldPosition(new T.Vector3()),p=project(pos);
  result.push({kind:'hand',side,...p,radius:Math.min(24,Math.max(8,radius(pos,.065))),visible:p.z>-1&&p.z<1&&exposed(pos)});
 }
 const head=pet.root.getObjectByName('HeadAnchor');
 if(head){const pos=head.localToWorld(new T.Vector3(0,-.13,.65)),p=project(pos),scale=head.getWorldScale(new T.Vector3()).x/.20448;
  const forward=new T.Vector3(0,0,1).transformDirection(head.matrixWorld),front=forward.dot(cam.position.clone().sub(pos).normalize())>.35;
  const crown=head.localToWorld(new T.Vector3(0,.48,.35)),hp=project(crown);
  result.push({kind:'head',...hp,rx:radius(crown,.12*scale),ry:radius(crown,.075*scale),visible:front&&hp.z>-1&&hp.z<1});
  result.push({kind:'face',...p,rx:radius(pos,.13*scale),ry:radius(pos,.105*scale),visible:front&&p.z>-1&&p.z<1});}
 return result;
}
function touch(x,y){
 if(sleeping){wake();return;}const target=targetAt(x,y,touchTargets()),t=clock.getElapsedTime();
 if(!target){poke();return;}taps=[];
 if(target.kind==='hand'){
  const hit=highFiveHit(act,target.side,t,DUR[act?.kind]);
  act={kind:'emotion-'+(hit?'clap-':'five-')+target.side,start:t};
 }else if(target.kind==='head')act={kind:'emotion-headpat',start:t};
 else act={kind:'emotion-dodge-'+target.side,start:t};
 // 外壳的聊天反馈仍沿原来的单点入口，不增加模型调用入口。
 parent.postMessage({type:'pet-poke',kind:'tap',count:1},'*');
}
function poke(){const t=clock.getElapsedTime();if(sleeping){wake();return;}taps=taps.filter(x=>t-x<1.4);taps.push(t);
 const n=taps.length,face=(cur.look&&cur.look.face)||'default',cross=['irritated','sad','gloomy'].includes(face);
 // 点一下回头看你；连点两下蹦一下；再点他就害羞（心情不好的时候是扭过头去不理你）
 act={kind:n>=3?(cross?'emotion-irritated':'shy'):n===2?(cross?'emotion-'+face:'emotion-amazed'):pickForMood(face),start:t};parent.postMessage({type:'pet-poke',kind:n>=3?'many':n===2?'double':'tap',count:n},'*');}
// ── 省电：它是全 app 唯一【常驻】的 WebGL ────────────────────────────────
// 悬浮小人在每一页都活着，切后台也照跑——装饰品的唯一失败方式就是「开着很烦」
// （发烫、掉电）。所以：页面看不见就真的停，悬浮那只按 24 帧画（指甲盖大小，
// 60 帧一分钱好看都换不到）。整页那只给 40 帧，拖着转圈仍然跟手。
const FRAME=mode==='float'?1/24:1/40;let lastDraw=-1,lastTold=null;
function frame(){const t=clock.getElapsedTime();
 if(t-lastDraw<FRAME)return;lastDraw=t;
 draw(t);}
function draw(t){
 const face=(cur.look&&cur.look.face)||'default',M=MOODS[face]||MOODS.default;
 // 很久没碰手机就趴下睡；深夜隔一阵打个哈欠；早上第一次见面伸个懒腰
 if(ctx.idle&&!sleeping&&!held){sleeping=true;act=null;}
 if(!greeted&&t>1.5){greeted=true;const h=new Date().getHours();if(h>=6&&h<10&&!act)act={kind:'stretch',start:t};}
 if(face!==curMood){curMood=face;act=null;nextAt=t+1.2;}
 if(!act&&!sleeping&&!held&&t>nextAt){const pool=QUIET.includes(ctx.screen)?['read','sit','tea','emotion-chin']:night()?[...M.acts,'yawn','yawn']:M.acts;const k=pickForMood(face,pool);act={kind:k,start:t};}
 let emotion=null,gesture='rest',progress=0,moving=false,seated=false,dy=0,dtilt=0,dyaw=0;
 if(act){progress=(t-act.start)/DUR[act.kind];if(progress>=1){act=null;nextAt=t+M.every*(.7+Math.random()*.6);progress=0;}
  else{if(act.kind.startsWith('emotion-'))emotion=act.kind.slice(8);const e=pulse(progress);const a=accent(act.kind,progress);dy=a.dy;dtilt=a.dtilt;dyaw=a.dyaw;switch(act.kind){
   case 'wave':case 'stretch':gesture=act.kind;break;
   case 'tea':gesture='tea';break;
   case 'read':gesture='read';break;
   case 'sit':seated=true;break;
   case 'look':dyaw=-(yaw+moodBase(face,t).yaw)*e;dtilt=.02*e;break;
   case 'yawn':gesture='stretch';dtilt=-e*.025;break;                                      // 仰头打哈欠
   case 'wake':dtilt=-e*.025;if(progress>.35){gesture='wave';progress=(progress-.35)/.65;};break;                 // 醒了一激灵，冲你招手
}}}
 if(held){dy=.12+Math.sin(t*9)*.01;dtilt=0;pet.root.rotation.z=Math.sin(t*5)*.18;gesture='rest';emotion=null;}else pet.root.rotation.z=0;   // 被拎起来晃
 if(sleeping&&!act){seated=true;dtilt=.22+Math.sin(t*1.3)*.015;}                        // 趴着睡，一起一伏
 else if(!act&&!held){if(CHAT.includes(ctx.screen)){dtilt=.08;dyaw=-.35;}else if(QUIET.includes(ctx.screen))seated=true;}
 if(ctx.music&&!sleeping&&!held)dtilt+=Math.sin(t*Math.PI*2*.55)*.03;               // 放着歌就跟着慢慢点头（她 2026-09-26：原来一秒 1.6 下「晃得有点快」）                                                    // 别过脸去
 const b=moodBase(face,t),dt=Math.min(.1,Math.max(0,t-lastT));lastT=t;
 // 与 traveler 的坐姿使用同一时间步，返回前台时不突然抬高。
 sitB+=((seated?1:0)-sitB)*Math.min(1,dt*9);
 const blend=1-Math.exp(-dt*7);
 for(const [key,target] of Object.entries({y:b.y+dy,tilt:b.tilt+dtilt,yaw:b.yaw+dyaw}))soft[key]+=(target-soft[key])*blend;
 pet.animate(t,{gesture,progress,height:soft.y+sitB*.3,moving,seated,emotion});
 pet.root.rotation.y=yaw+soft.yaw;pet.root.rotation.x=soft.tilt;
 r.render(sc,cam);window.petDebug.frames++;
 // 他这会儿在干什么，报给外壳写成一行字——十种心情各一套动作，不说没人看得出来
 const now=sleeping?'sleep':held?'held':act?act.kind:'';
 if(now!==lastTold){lastTold=now;parent.postMessage({type:'pet-act',kind:now},'*');}}
r.setAnimationLoop(frame);
// 切后台／锁屏／换到别的 app：停到看得见再说（clock 照走，回来时不让他从半个动作里接）
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){r.setAnimationLoop(null);return;}
 act=null;lastT=clock.getElapsedTime();nextAt=lastT+1;lastDraw=-1;r.setAnimationLoop(frame);});
// 点他：两种模式都一样。按住不动半秒＝拎起来，松手落地。
// 悬浮时不再用「点小人」打开陪伴页——那一下留给他的反应；打开改成点底下那条把手（js/companion.js）。
for(const k of ['contextmenu','selectstart','dragstart'])addEventListener(k,e=>e.preventDefault());   // iOS 长按的选框/菜单
{let down=null,moved=0,timer=0;
 addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,last:e.clientX,lastY:e.clientY};moved=0;clearTimeout(timer);timer=setTimeout(()=>{if(down&&moved<6){held=true;act=null;sleeping=false;}},450);});
 addEventListener('pointermove',e=>{if(!down)return;moved+=Math.hypot(e.clientX-down.last,e.clientY-down.lastY);if(mode!=='float'&&!held)yaw+=(e.clientX-down.last)*.01;down.last=e.clientX;down.lastY=e.clientY;});
 addEventListener('pointerup',e=>{clearTimeout(timer);if(held){held=null;act={kind:'land',start:clock.getElapsedTime()};parent.postMessage({type:'pet-poke',kind:'lift',count:1},'*');}else if(down&&moved<6)touch(e.clientX,e.clientY);down=null;});
 addEventListener('pointercancel',()=>{clearTimeout(timer);held=null;down=null;});}
