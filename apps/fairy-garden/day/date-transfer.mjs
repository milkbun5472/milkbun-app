import {findPath,walkable,segmentClear,floorHeight} from '../world.mjs?v=fg-163c7f71112cb39b';
import {stepRoute} from '../locomotion.mjs?v=fg-163c7f71112cb39b';
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function transferPlan(map,from){
 const id=map.id||map.renderer,a={...map.spawn},aRoute=findPath(from.a,a,id,[{...from.b,r:Math.min(.72,gap(from.a,from.b)*.85)}]);if(!aRoute)return null;
 for(const radius of [1.1,1.5,1.9])for(let n=0;n<16;n++){
  const angle=n*Math.PI/8,b={x:a.x+Math.sin(angle)*radius,z:a.z+Math.cos(angle)*radius};if(!walkable(b.x,b.z,id))continue;
  const bRoute=findPath(from.b,b,id,[{...a,r:.72}]);if(bRoute)return {a,b,aRoute,bRoute};
 }return null;
}
export function createDateTransfer({a,b,map,from,motion=()=>({}),onUpdate=()=>{},onDone=()=>{},onCancel=()=>{}}){
 let session=null;
 const inspect=()=>session&&{...session,a:{...session.a},b:{...session.b},plan:undefined};
 function cancel(reason='已停下一起转场。'){if(!session)return false;const info=inspect();session=null;onCancel({...info,reason});return true;}
 function start(destination,choice){const origin=from(),plan=transferPlan(map(),origin);if(!plan)return false;session={destination,choice,plan,a:{...origin.a},b:{...origin.b},phase:'departing-ta',speed:0,elapsed:0};return true;}
 function tick(dt,time){
  if(!session)return false;const s=session,id=map().id||map().renderer,who=s.phase==='departing-ta'?'a':'b',other=who==='a'?s.b:s.a;
  s.elapsed+=dt;const route=s.plan[who+'Route'],step=stepRoute(s[who],route,dt,{speed:s.speed,walkSpeed:1.45*(motion()[who]?.walk||1),clear:(u,v)=>segmentClear(u,v,id,[{...other,r:Math.min(.72,gap(s[who],other)*.85)}])});s[who]=step.position;s.speed=step.speed;if(step.heading!=null)s[who].heading=step.heading;
  for(const [key,actor]of [['a',a],['b',b]]){actor.root.position.set(s[key].x,0,s[key].z);actor.root.rotation.y=s[key].heading||0;actor.animate(time,{moving:who===key&&!!route.length,gesture:'rest',motion:motion()[key],height:floorHeight(id,s[key])});}
  onUpdate({...inspect(),moving:true,kind:'travel',label:'一起去下一站'});
  if(step.blocked||s.elapsed>35){cancel('门口的路线被挡住了，这次各自去下一站。');return false;}
  if(!route.length){if(who==='a'){s.phase='departing-you';s.speed=0;}else{const info=inspect();session=null;onDone(info);}}
  return true;
 }return {start,cancel,tick,inspect};
}
