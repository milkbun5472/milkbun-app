// A visit is a visible, disposable scene session. It has no save or chat writer.
import {MAPS,findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-4ea3c2dd79f75cae';
import {PERSONAL_SPACE} from '../companion.mjs?v=fg-4ea3c2dd79f75cae';
import {stepRoute} from '../locomotion.mjs?v=fg-4ea3c2dd79f75cae';
import {furniturePoint,furnitureSeat} from './home-catalog.mjs?v=fg-4ea3c2dd79f75cae';
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clearance=PERSONAL_SPACE+.16;
export const visitorAvoid=ta=>ta?[{x:ta.x,z:ta.z,r:clearance}]:[];
function reachable(from,to,ta){const avoid=visitorAvoid(ta);return walkable(to.x,to.z,'dayHome')&&(!ta||gap(to,ta)>=clearance)&&findPath(from,to,'dayHome',avoid);}
export function visitSeats(map,occupied){
 const pieces=map.furniture.filter(p=>['sofa','chair'].includes(p.kind));
 return pieces.flatMap(p=>{
  const shared=occupied?.piece===p.id;if(shared&&p.kind!=='sofa')return [];
  const offsets=p.kind==='sofa'?[-.6,.6]:[0];
  return offsets.flatMap(x=>{
   const at=furniturePoint(p,{x,z:p.kind==='sofa'?.05:0});if(occupied&&gap(at,occupied)<clearance)return [];
   const approaches=[{x:-p.w/2-.6,z:.25},{x:p.w/2+.6,z:.25},{x,z:p.d/2+.7}].map(q=>furniturePoint(p,q));
   return approaches.map(approach=>({seat:furnitureSeat(p,approach,{x,z:p.kind==='sofa'?.05:0}),shared}));
  });
 }).sort((a,b)=>Number(b.shared)-Number(a.shared));
}
export function chooseVisitSeat(map,from,occupied,ta){
 const choices=visitSeats(map,occupied).map(q=>({...q,route:reachable(from,q.seat.approach,ta)})).filter(q=>q.route);
 return choices.sort((a,b)=>Number(b.shared)-Number(a.shared)||gap(a.seat,ta||from)-gap(b.seat,ta||from))[0]||null;
}
export function visitNear(from,ta){
 const choices=[];for(const distance of [1.05,1.4,1.8])for(let n=0;n<16;n++){const a=n*Math.PI/8,to={x:ta.x+Math.cos(a)*distance,z:ta.z+Math.sin(a)*distance},route=reachable(from,to,ta);if(route)choices.push({to,route});}
 return choices.sort((a,b)=>gap(from,a.to)-gap(from,b.to))[0]||null;
}
export function createHomeVisit({avatar,ta,onChange=()=>{}}){
 let present=false,position={...MAPS.dayHome.spawn},route=[],speed=0,yaw=0,seat=null,pendingSeat=null,leaving=false,notice='',last='';
 const inspect=()=>({present,position:{...position},route:route.map(q=>({...q})),seated:!!seat,seat:seat?{...seat}:null,busy:route.length>0,leaving,notice,visible:avatar.root.visible,visualPosition:avatar.root.position.toArray(),leg:avatar.root.getObjectByName?.('leftLeg')?.rotation.x});
 function tell(text){if(text!==undefined)notice=text;const info=inspect(),key=JSON.stringify([present,info.busy,info.seated,leaving,notice]);if(key!==last){last=key;onChange(info);}}
 function go(to,nextSeat=null){
  const next=reachable(position,to,ta());if(!next){tell('这里暂时走不过去，换个空位试试。');return false;}
  seat=null;pendingSeat=nextSeat;route=next;speed=0;
  if(!route.length){seat=pendingSeat;pendingSeat=null;}tell(seat?'已坐下，可以聊聊。':'正在走过去…');return true;
 }
 function join(){
  present=true;leaving=false;seat=pendingSeat=null;position={...MAPS.dayHome.spawn};avatar.root.visible=true;
  // An arriving visitor uses the existing doorway, then gives it back.
  avatar.root.position.set(position.x,floorHeight('dayHome',position),position.z);
  const free=visitNear(position,ta());if(free)go(free.to);else tell('已进小屋，点空地可以走动。');return true;
 }
 function stand(){if(!present||leaving)return false;seat=pendingSeat=null;route=[];tell('已起身，点空地可以走动。');return true;}
 function act(kind,point){
  if(!present||leaving)return false;
  if(kind==='stand')return stand();
  if(kind==='walk')return point&&Number.isFinite(point.x)&&Number.isFinite(point.z)?go(point):false;
  if(kind==='sit'){const q=chooseVisitSeat(MAPS.dayHome,position,ta()?.seat,ta());if(!q){tell('没有能走到的空座位，可以站着陪一会儿。');return false;}return go(q.seat.approach,q.seat);}
  if(kind==='near'){const q=visitNear(position,ta());if(!q){tell('TA旁边暂时没有能走到的空位。');return false;}return go(q.to);}
  if(kind==='leave'){if(!go(MAPS.dayHome.spawn))return false;leaving=true;tell('正在走到门口…');return true;}
  return false;
 }
 function close(text=''){present=false;leaving=false;route=[];seat=pendingSeat=null;avatar.root.visible=false;tell(text);}
 function tick(dt,time){
  if(!present)return;
  let moving=route.length>0;
  if(moving){const step=stepRoute(position,route,dt,{speed,walkSpeed:1.45,clear:(a,b)=>segmentClear(a,b,'dayHome',visitorAvoid(ta()))});position=step.position;speed=step.speed;if(step.heading!==null)yaw=step.heading;
   if(step.blocked){pendingSeat=null;leaving=false;tell('路线被挡住了，点另一块空地再走。');}
   else if(!route.length){if(leaving){close('已离开小屋，继续看看TA的一天。');return;}seat=pendingSeat;pendingSeat=null;tell(seat?'已坐到空位上，可以聊聊。':'已走到位置，点空地可以走动。');}
  }
  moving=route.length>0;
  const at=seat||position;avatar.root.position.set(at.x,0,at.z);avatar.root.rotation.y=seat?.heading??yaw;
  if(!moving&&!seat){const other=ta();if(other)avatar.root.rotation.y=Math.atan2(other.x-at.x,other.z-at.z);}
  avatar.animate(time,{moving,seated:!!seat,gesture:'rest',height:floorHeight('dayHome',at)+(seat?seat.rise+.05:0)});
 }
 avatar.root.visible=false;return {join,act,close,tick,inspect};
}
