// Shared player/companion route step. Ice changes acceleration and braking, never collision rules.
export function stepRoute(position,route,dt,{speed=0,skating=false,walkSpeed=1.45,iceSpeed=2.7,clear=()=>true}={}){
 let remaining=0,prev=position;for(const q of route){remaining+=Math.hypot(q.x-prev.x,q.z-prev.z);prev=q;}
 const duration=Math.max(0,Math.min(1,dt)),desired=skating?Math.min(iceSpeed,Math.sqrt(2*2.2*remaining)):walkSpeed;
 speed=route.length?(skating?speed+Math.max(-3*duration,Math.min(1.9*duration,desired-speed)):walkSpeed):0;
 let budget=Math.min(remaining,speed*duration),p={x:position.x,z:position.z},heading=null,blocked=false;
 while(route.length&&(budget>0||remaining<.008)){
  const q=route[0];if(!clear(p,q)){route.length=0;speed=0;blocked=true;break;}
  const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);if(d>.0001)heading=Math.atan2(dx,dz);
  if(d<=budget+.008){p={...q};route.shift();budget=Math.max(0,budget-d);}else{p.x+=dx/d*budget;p.z+=dz/d*budget;budget=0;}
 }
 return {position:p,speed:route.length?speed:0,heading,blocked};
}
