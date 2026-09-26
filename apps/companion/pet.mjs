// 陪伴（桌宠）的画面：一个高清的 v2 小人，透明底，住在 iframe 里。
// 外壳（js/companion.js）用 postMessage 把样貌和表情送进来：{type:'pet-look', look, ta}。
// ?mode=float 是悬浮小窗：点一下就请外壳打开陪伴。
// 小人本身、换装、表情、体型全部走庭院那一份 traveler.mjs，不另写一套（one-public-mechanism）。
import * as T from 'three';
import {GLTFLoader} from '../fairy-garden/vendor/GLTFLoader.js?v=fg-4f889e12f6d059da';
import {DRACOLoader} from '../fairy-garden/vendor/DRACOLoader.js?v=fg-4f889e12f6d059da';
import {createTraveler,setFaceBase} from '../fairy-garden/traveler.mjs?v=fg-4f889e12f6d059da';
import {lookForTa,mergeLook,dyesOf,outfitId,outfitColors,hairId,HAIR_MODES} from '../fairy-garden/wardrobe.mjs?v=fg-4f889e12f6d059da';
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
addEventListener('message',e=>{if(e.data&&e.data.type==='pet-look')apply(e.data);if(e.data&&e.data.type==='pet-ctx')setCtx(e.data);});
// 外壳告诉他你在哪一页、有没有在放歌、多久没碰手机（她 2026-09-26：点他有反应／跟着时间／看你在干嘛）。
let ctx={screen:'',music:false,idle:false},sleeping=false;
function setCtx(m){const was=ctx.idle;ctx={screen:String(m.screen||''),music:!!m.music,idle:!!m.idle};if(was&&!ctx.idle)wake();}
// 两种都用庭院那一份小人：高清整包（8MB、上百 MB 解码）在她手机上一点进来就把 app 挤到重启（2026-09-26）。
// 清晰靠整页的 2K 脸和按屏幕像素比渲染。
const gltf=await loader.loadAsync('../fairy-garden/doll.glb?v=fg-4f889e12f6d059da');pet=createTraveler(gltf.scene,true,{});sc.add(pet.root);if(pending)apply(pending);
parent.postMessage({type:'pet-ready'},'*');
// 每种心情一套待机动作（她 2026-09-26：「做每一个心情的专属动作」）。
// 动作本身都是庭院那几个（挥手、伸懒腰、喝茶、看书、坐下、迈步），这里只管【什么心情、隔多久、配什么身段】。
// base(t)：一直在的身段（整个人的上下、前后倾、左右转）；acts：隔一阵随机挑一个做一次。
const MOODS={
 default:{base:t=>({y:Math.sin(t*2)*.004,tilt:0,yaw:Math.sin(t*.35)*.12}),every:14,acts:['wave','stretch']},
 happy:{base:t=>({y:Math.abs(Math.sin(t*3.2))*.03,tilt:0,yaw:Math.sin(t*.8)*.18}),every:6,acts:['wave','hop','wave']},
 amazed:{base:t=>({y:Math.abs(Math.sin(t*5))*.045,tilt:-.04,yaw:Math.sin(t*1.2)*.1}),every:4,acts:['stretch','hop','hop']},
 cozy:{base:t=>({y:Math.sin(t*1.1)*.006,tilt:.02,yaw:Math.sin(t*.45)*.2}),every:9,acts:['tea','tea','stretch']},
 relax:{base:t=>({y:Math.sin(t*.9)*.008,tilt:.03,yaw:Math.sin(t*.25)*.1}),every:12,acts:['read','sit']},
 surprise:{base:t=>({y:0,tilt:-.06,yaw:0}),every:5,acts:['jolt','jolt','wave']},
 proud:{base:t=>({y:Math.sin(t*1.6)*.006,tilt:-.09,yaw:Math.sin(t*.5)*.25}),every:7,acts:['nod','wave','nod']},
 gloomy:{base:t=>({y:-.012+Math.sin(t*.7)*.004,tilt:.14,yaw:Math.sin(t*.2)*.06}),every:11,acts:['sit','sigh']},
 sad:{base:t=>({y:-.015,tilt:.18,yaw:.25}),every:9,acts:['sit','sit','sigh']},
 irritated:{base:t=>({y:0,tilt:.04,yaw:.7+Math.sin(t*.9)*.08}),every:5,acts:['stomp','turn','stomp']}
};
const DUR={wave:3.4,stretch:3.8,tea:5,read:7,sit:8,hop:1.2,jolt:1,nod:1.6,sigh:2.4,stomp:1.6,turn:2.2,look:1.6,shy:2.6,yawn:3.2,wake:1.8,land:.8};
let act=null,yaw=0,nextAt=3,curMood='default',sitB=0,lastT=0;const clock=new T.Clock();
window.petDebug={play:(k,at)=>{act={kind:k,start:clock.getElapsedTime()-(at||0)*DUR[k]};}};   // 截图/测试用
// 你在哪儿：聊天→凑过去看；写东西／专注→坐在旁边安静陪；其余照心情来
const CHAT=['thread','gthread','messages','forum'],QUIET=['diary','fanfic','memo','dreamjournal','study','pomodoro','read'];
const night=()=>{const h=new Date().getHours();return h>=23||h<6;};
let greeted=false,held=null,taps=[];
function wake(){if(!sleeping)return;sleeping=false;act={kind:'wake',start:clock.getElapsedTime()};}
function poke(){const t=clock.getElapsedTime();if(sleeping){wake();return;}taps=taps.filter(x=>t-x<1.4);taps.push(t);
 const n=taps.length,face=(cur.look&&cur.look.face)||'default',cross=['irritated','sad','gloomy'].includes(face);
 // 点一下回头看你；连点两下蹦一下；再点他就害羞（心情不好的时候是扭过头去不理你）
 act={kind:n>=3?(cross?'turn':'shy'):n===2?(cross?'stomp':'hop'):'look',start:t};}
r.setAnimationLoop(()=>{const t=clock.getElapsedTime();
 const face=(cur.look&&cur.look.face)||'default',M=MOODS[face]||MOODS.default;
 // 很久没碰手机就趴下睡；深夜隔一阵打个哈欠；早上第一次见面伸个懒腰
 if(ctx.idle&&!sleeping&&!held){sleeping=true;act=null;}
 if(!greeted&&t>1.5){greeted=true;const h=new Date().getHours();if(h>=6&&h<10&&!act)act={kind:'stretch',start:t};}
 if(face!==curMood){curMood=face;act=null;nextAt=t+1.2;}
 if(!act&&!sleeping&&!held&&t>nextAt){const pool=QUIET.includes(ctx.screen)?['read','sit','tea']:night()?[...M.acts,'yawn','yawn']:M.acts;const k=pool[Math.floor(Math.random()*pool.length)];act={kind:k,start:t};}
 let gesture='rest',progress=0,moving=false,seated=false,dy=0,dtilt=0,dyaw=0;
 if(act){progress=(t-act.start)/DUR[act.kind];if(progress>=1){act=null;nextAt=t+M.every*(.7+Math.random()*.6);progress=0;}
  else{const e=Math.sin(Math.PI*progress);switch(act.kind){
   case 'wave':case 'stretch':gesture=act.kind;break;
   case 'tea':gesture='tea';break;
   case 'read':gesture='read';break;
   case 'sit':seated=true;break;
   case 'hop':dy=Math.abs(Math.sin(progress*Math.PI*2))*.09;break;                 // 蹦两下
   case 'jolt':dy=e*.06;dtilt=-e*.12;break;                                          // 吓一跳往后一仰
   case 'nod':dtilt=Math.sin(progress*Math.PI*2)*.08;break;                          // 点点头
   case 'sigh':dy=-e*.02;dtilt=e*.1;break;                                           // 叹口气塌下去
   case 'stomp':moving=true;break;                                                   // 原地跺脚
   case 'turn':dyaw=e*.9;break;
   case 'look':dyaw=-(yaw+M.base(t).yaw)*e;dtilt=Math.sin(progress*Math.PI*2)*.05;break;   // 回过头来看你一眼
   case 'shy':dtilt=e*.16;dyaw=Math.sin(progress*Math.PI*4)*.25*e;dy=-e*.01;break;       // 低头扭扭捏捏
   case 'yawn':gesture='stretch';dtilt=-e*.1;break;                                      // 仰头打哈欠
   case 'wake':dy=e*.04;dtilt=-e*.08;if(progress>.5)gesture='wave';break;                 // 醒了一激灵，冲你招手
   case 'land':dy=-e*.03;break;}}}
 if(held){dy=.12+Math.sin(t*9)*.01;dtilt=0;pet.root.rotation.z=Math.sin(t*5)*.18;gesture='rest';}else pet.root.rotation.z=0;   // 被拎起来晃
 if(sleeping&&!act){seated=true;dtilt=.22+Math.sin(t*1.3)*.015;}                        // 趴着睡，一起一伏
 else if(!act&&!held){if(CHAT.includes(ctx.screen)){dtilt=.08;dyaw=-.35;}else if(QUIET.includes(ctx.screen))seated=true;}
 if(ctx.music&&!sleeping&&!held)dtilt+=Math.sin(t*Math.PI*2*.55)*.03;               // 放着歌就跟着慢慢点头（她 2026-09-26：原来一秒 1.6 下「晃得有点快」）                                                    // 别过脸去
 const b=M.base(t);sitB+=((seated?1:0)-sitB)*Math.min(1,(t-lastT)*9);lastT=t;   // 坐下时庭院会把人往下放 .34（坐到凳子上），这里没凳子：抬回来坐在画面里
 pet.animate(t,{gesture,progress,height:b.y+dy+sitB*.3,moving,seated});
 pet.root.rotation.y=yaw+b.yaw+dyaw;pet.root.rotation.x=b.tilt+dtilt;r.render(sc,cam);});
// 点他：两种模式都一样。按住不动半秒＝拎起来，松手落地。
// 悬浮时不再用「点小人」打开陪伴页——那一下留给他的反应；打开改成点底下那条把手（js/companion.js）。
{let down=null,moved=0,timer=0;
 addEventListener('pointerdown',e=>{down={x:e.clientX,last:e.clientX};moved=0;clearTimeout(timer);timer=setTimeout(()=>{if(down&&moved<6){held=true;act=null;sleeping=false;}},450);});
 addEventListener('pointermove',e=>{if(!down)return;moved+=Math.abs(e.clientX-down.last);if(mode!=='float'&&!held)yaw+=(e.clientX-down.last)*.01;down.last=e.clientX;});
 addEventListener('pointerup',()=>{clearTimeout(timer);if(held){held=null;act={kind:'land',start:clock.getElapsedTime()};}else if(down&&moved<6)poke();down=null;});
 addEventListener('pointercancel',()=>{clearTimeout(timer);held=null;down=null;});}
