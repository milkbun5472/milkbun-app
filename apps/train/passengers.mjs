import {restState} from './rest.mjs?v=fg-8ad597cb779a8b50';
import {DRACOLoader} from '../fairy-garden/vendor/DRACOLoader.js?v=fg-8ad597cb779a8b50';
import * as T from 'three';
import {GLTFLoader} from '../fairy-garden/vendor/GLTFLoader.js?v=fg-8ad597cb779a8b50';
import {seatLook} from '../fairy-garden/wardrobe.mjs?v=fg-8ad597cb779a8b50';
import {createTraveler} from '../fairy-garden/traveler.mjs?v=fg-8ad597cb779a8b50';
import {bubbleRows,bubbleHold,BUBBLE_GAP} from '../fairy-garden/speech.mjs?v=fg-8ad597cb779a8b50';
export async function createPassengers(view,host,stage,state=()=>({})){
 const archive=host.load(),journey=archive.journey||{},garden=archive.worlds?.garden||archive.world,companion=host.companion?.();
 const draco=new DRACOLoader();draco.setDecoderPath(new URL('../fairy-garden/vendor/draco/',import.meta.url).href);const loader=new GLTFLoader();loader.setDRACOLoader(draco);let source;try{source=(await loader.loadAsync(new URL('../fairy-garden/doll.glb?v=fg-8ad597cb779a8b50',import.meta.url).href)).scene;}finally{draco.dispose();}
 const people=[];
 // 走动（她 2026-09-25：「可以走动不只是坐在那里，还可以下来活动，可以躺进卧铺，去整理上面的行李」）。
 // 车厢前面那条过道（z≈0.6~1.5）是空的，所以路线一律：先走到过道→沿过道走到目标那一列→再走进去。
 // 站在哪、朝哪都从车厢自带的锚点和床位算出来，不在这儿写死一张坐标表以外的东西。
 const AISLE_Z=.95,WALK=1.1;let floorY=.06;view.asset.traverse(o=>{if(o.userData.anchor==='entry')floorY=o.getWorldPosition(new T.Vector3()).y;});
 const SPOT_ZH={seat:'坐在座位上',stand:'站在过道里看窗外',rack:'在行李架底下整理行李',berth:'走到卧铺边',free:'在车厢里走动'};
 for(const [who,anchorName,look,name,angle] of [['me','seat_user',state()?.looks?.me||journey.look||garden?.look,'你',Math.PI/2],['companion','seat_companion',state()?.looks?.companion||journey.companionLook||garden?.companion?.look,companion?.name,-Math.PI/2]]){
  if(who==='companion'&&!companion?.id)continue;
  let anchor;view.asset.traverse(o=>{if(o.userData.anchor===anchorName)anchor=o;});if(!anchor)throw Error('座位还没有准备好');
  const at=anchor.getWorldPosition(new T.Vector3()),avatar=createTraveler(source,who==='companion',seatLook(who,look,companion?.ta));avatar.root.position.copy(at);avatar.root.rotation.y=angle;const carrier=new T.Group();view.scene.add(carrier);carrier.add(avatar.root);let bedAnchor;view.asset.traverse(o=>{if(o.userData.anchor===(who==='me'?'berth_lower':'berth_upper'))bedAnchor=o;});if(!bedAnchor)throw Error('卧铺还没有准备好');const bed=bedAnchor.getWorldPosition(new T.Vector3());avatar.root.updateMatrixWorld(true);const face=avatar.root.getObjectByName('Face'),headPoint=new T.Vector3(0,1.48,0);if(face){const bounds=new T.Box3().setFromObject(face,true),top=bounds.getCenter(new T.Vector3());top.y=bounds.max.y+.09;headPoint.copy(avatar.root.worldToLocal(top));}
  const bubble=document.createElement('div');bubble.id=who==='me'?'player-bubble':'companion-bubble';bubble.hidden=true;bubble.setAttribute('aria-live','polite');stage.append(bubble);

  people.push({who,avatar,carrier,bed,angle,face,resting:false,bubble,seat:at,headPoint,queue:[],line:null,left:0,spot:'seat',path:[],pos:new T.Vector3(at.x,0,AISLE_Z),yaw:angle,onArrive:null});
 }
 view.renderer.shadowMap.needsUpdate=true;
 const voiceOn=()=>{try{return localStorage.getItem('x_fairyGardenVoice')==='1';}catch(e){return false;}};
 function speak(lines,who='companion'){const p=people.find(p=>p.who===who);if(p)p.queue=[...p.queue,...bubbleRows(lines)].slice(0,12);}
 function tick(now,dt,visible){
  for(const p of people){const resting=restState(state())[p.who==='me'?'you':'companion'];if(resting!==p.resting){p.resting=resting;view.renderer.shadowMap.needsUpdate=true;if(!resting){p.path=[];p.onArrive=null;
    // 起身回桌边是真的走回去（她 2026-09-25）：从床前起来，沿过道走回座位再坐下；拍照、拼图要立刻落座的走 home()
    if(p.skipWalk)p.spot='seat';else{const t=target(p,'berth');p.pos.set(t.x,floorY,t.z);p.spot='berth';go(p.who,'seat');}}}p.skipWalk=false;
   if(resting){p.carrier.position.set(p.bed.x+.90,p.bed.y+.12,p.bed.z);p.carrier.rotation.y=Math.PI/2;p.avatar.root.position.set(0,0,0);p.avatar.animate(now/1000,{sleepPose:{x:0,z:0,y:0}});}
   else if(p.path.length){p.carrier.position.set(0,0,0);p.carrier.rotation.y=0;const to=p.path[0],dx=to.x-p.pos.x,dz=to.z-p.pos.z,d=Math.hypot(dx,dz),step=WALK*dt;
    if(d>1e-3)p.yaw=Math.atan2(dx,dz);
    if(d<=step){p.pos.set(to.x,floorY,to.z);p.path.shift();if(!p.path.length){if(to.yaw!=null)p.yaw=to.yaw;const done=p.onArrive;p.onArrive=null;done&&done();}}else p.pos.set(p.pos.x+dx/d*step,floorY,p.pos.z+dz/d*step);
    p.avatar.root.position.copy(p.pos);p.avatar.root.rotation.y=p.yaw;p.avatar.animate(now/1000,{moving:true});}
   else if(p.spot!=='seat'){p.carrier.position.set(0,0,0);p.carrier.rotation.y=0;p.avatar.root.position.copy(p.pos);p.avatar.root.rotation.y=p.yaw;p.avatar.animate(now/1000,{gesture:p.spot==='rack'?'hold':'rest'});}
   else{p.carrier.position.set(0,0,0);p.carrier.rotation.y=0;p.avatar.root.position.copy(p.seat);p.avatar.root.rotation.y=p.angle;p.avatar.animate(now/1000,{seated:true,gesture:'sit',height:p.seat.y+.05});/* 她 2026-09-26「人还是有点陷在沙发里」：原来 -.02，抬到 +.05。 坐在坐垫面上：seat 锚点就是坐垫顶（y≈.60），原来减 .215 整个人陷进沙发里（她 2026-09-25） */}
   p.carrier.updateMatrixWorld(true);
   const head=p.face?new T.Box3().setFromObject(p.face,true).getCenter(new T.Vector3()):p.avatar.root.localToWorld(p.headPoint.clone());head.y+=.14;head.project(view.camera);const rect=stage.getBoundingClientRect();
   const onscreen=visible&&head.z>=-1&&head.z<=1&&head.x>-1&&head.x<1&&head.y>-1&&head.y<1;
   p.bubble.hidden=!onscreen||!p.line;
   if(!onscreen)continue;
   if(p.line){if(p.reading)p.left=Math.max(p.left,BUBBLE_GAP+120);else p.left-=dt*1000;if(p.left<=0)p.line=null;}
   if(!p.line&&p.queue.length){p.line=p.queue.shift();p.left=bubbleHold(p.line.show)+BUBBLE_GAP;p.bubble.textContent=p.line.show;
    // 念出来（和庭院同一个开关）：TA 这一句念完才翻下一句；念不了就退回原来的定时
    if(p.who==='companion'&&voiceOn()&&host.readAloud){const line=p.line;p.reading=true;if(p.queue[0])host.warmAloud?.(p.queue[0].say||p.queue[0].show);host.readAloud(line.say||line.show).then(ok=>{if(p.line===line&&ok)p.left=Math.min(p.left,BUBBLE_GAP+400);}).catch(()=>{}).finally(()=>{if(p.line===line)p.reading=false;});}}
   const x=(head.x+1)*rect.width/2,y=(1-head.y)*rect.height/2;
   p.bubble.hidden=!p.line||p.left<BUBBLE_GAP;
   if(!p.bubble.hidden){const half=p.bubble.offsetWidth/2+6;p.bubble.style.left=Math.max(half,Math.min(rect.width-half,x))+'px';p.bubble.style.top=Math.max(p.bubble.offsetHeight+8,Math.min(rect.height-24,y-10))+'px';}
  }
 }
 // 到了以后脸朝镜头（yaw 0），不再自己转成背影（她 2026-09-25：「走路到了会自动转到背面能不能取消」）
 // 目标点：seat 回自己那格座位；stand 站到自己座位前的过道上看窗；rack 站到行李架底下；berth 走到卧铺前（到了由游戏那头躺下）
 function target(p,spot){
  if(spot==='seat')return{x:p.seat.x,z:AISLE_Z,yaw:p.angle,sit:true};
  if(spot==='stand')return{x:p.seat.x+(p.who==='me'?.55:-.55),z:AISLE_Z-.15,yaw:0};
  // ⚠️卧铺床沿在 z≈-.34、梯子占 x -2.9~-2.4 到 z≈.06：人站在床沿前 .3 的地方，x 也躲开梯子（她 2026-09-25 截图：穿进梯子和床里了）
  if(spot==='rack')return{x:p.who==='me'?-1.95:-1.2,z:.32,yaw:0};
  return{x:p.who==='me'?-1.7:-1.2,z:.3,yaw:0};}
 function go(who,spot,onArrive){const p=people.find(x=>x.who===who);if(!p)return false;const t=target(p,spot);
  // 从座位上起身：先落到自己那格座位前的过道
  if(p.spot==='seat'&&!p.path.length)p.pos.set(p.seat.x,floorY,AISLE_Z);
  const route=[];if(Math.abs(p.pos.z-AISLE_Z)>.05)route.push({x:p.pos.x,z:AISLE_Z});if(Math.abs(p.pos.x-t.x)>.05)route.push({x:t.x,z:AISLE_Z});route.push({x:t.x,z:t.z,yaw:t.yaw});
  p.path=route;p.spot=spot;p.onArrive=()=>{if(t.sit)p.spot='seat';onArrive&&onArrive();};return true;}
 // 点地板走过去（她 2026-09-25：「要点击地板可以走动」）：落点夹在车厢地板里，路线同样先走过道
 // 地板上能站的地方：床沿、梯子、座位都在 z≈.5 以内，所以落点再往里也只到床沿前 / 座位前
 const FLOOR={x:[-3,3.1],z:[.3,1.45]};
 function goTo(who,x,z){const p=people.find(q=>q.who===who);if(!p||!Number.isFinite(x)||!Number.isFinite(z))return false;
  x=Math.max(FLOOR.x[0],Math.min(FLOOR.x[1],x));z=Math.max(x>-.5?.62:.3,Math.min(FLOOR.z[1],z));
  if(p.spot==='seat'&&!p.path.length)p.pos.set(p.seat.x,floorY,AISLE_Z);
  const route=[];if(Math.abs(p.pos.z-AISLE_Z)>.05)route.push({x:p.pos.x,z:AISLE_Z});if(Math.abs(p.pos.x-x)>.05)route.push({x,z:AISLE_Z});route.push({x,z,yaw:0});
  p.path=route;p.spot='free';p.onArrive=null;return true;}
 function floorPoint(ray){if(Math.abs(ray.direction.y)<1e-4)return null;const t=(floorY-ray.origin.y)/ray.direction.y;if(t<=0)return null;const q=ray.origin.clone().addScaledVector(ray.direction,t);
  return q.x>=FLOOR.x[0]-.3&&q.x<=FLOOR.x[1]+.3&&q.z>=FLOOR.z[0]-.4&&q.z<=FLOOR.z[1]+.4?{x:q.x,z:q.z}:null;}
 // 拍照、拼图要两个人都在桌边：直接落座，不慢慢走
 function home(){for(const p of people){p.path=[];p.onArrive=null;p.spot='seat';p.skipWalk=true;}}
 function where(who){const p=people.find(x=>x.who===who);if(!p)return null;return p.resting?null:p.path.length?'正走去'+(SPOT_ZH[p.spot]||'').replace(/^(坐在|站在|在|走到)/,''):SPOT_ZH[p.spot]||SPOT_ZH.seat;}
 return {source,speak,tick,go,goTo,floorPoint,home,where,get people(){return people;},dispose(){for(const p of people){p.bubble.remove();}people.length=0;}};
}
