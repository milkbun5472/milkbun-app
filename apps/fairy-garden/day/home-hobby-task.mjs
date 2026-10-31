import './home-hobbies.js?v=fg-90b53e2779ab7a1c';
import {furniturePoint} from './home-catalog.mjs?v=fg-90b53e2779ab7a1c';
import {motionClock} from './motion-profile.mjs?v=fg-90b53e2779ab7a1c';
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function homeHobbyTask(stage,spot,map,elapsed,{moving=false,position,motion=null,actor=null}={}){
 const hobby=globalThis.CharDayHomeHobbies.activities[stage.action];
 if(!hobby||map.id!=='dayHome'||moving||!spot||spot.action!==stage.action||position&&gap(position,spot.target)>.09)return null;
 const piece=map.furniture.find(p=>p.id===spot.piece&&!p.stored&&p.hobby===stage.action);if(!piece)return null;
 const clock=Math.max(0,motionClock(elapsed,motion)),task={kind:stage.action,elapsed:clock,progress:clock/8%1,furniture:piece.id,spot:spot.id,phase:stage.phase||'work',homeHobby:true,supportHeight:0};
 const point=q=>({...furniturePoint(piece,q),y:map.floor+q.y});
 if(task.kind==='piano'){
  const spread=Math.sin(clock*.65)*.025;task.contact=point({...hobby.contact,x:hobby.contact.x+spread});task.target={...task.contact,y:task.contact.y+.045};task.leftTarget=point({...hobby.contact,x:.168+spread,y:hobby.contact.y+.045});task.workSurface=true;
 }else if(task.kind==='paint'){
  const shoulder=actor?.root.getObjectByName('rightArm')?.getWorldPosition(actor.root.position.clone()).y,level=Number.isFinite(shoulder)?Math.max(.70,Math.min(1.20,shoulder-map.floor+.12)):hobby.contact.y;
  const stroke={...hobby.contact,x:hobby.contact.x+Math.sin(clock*1.6)*.06,y:level+Math.cos(clock*1.3)*.04};
  task.contact=point(stroke);task.target=point({...stroke,y:stroke.y-.04,z:stroke.z+.03});task.tool='brush';
 }else if(task.kind==='weights')task.weights=true;
 return task;
}
