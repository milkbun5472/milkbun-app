// The same bounded pivot serves street walking and indoor furniture approaches.
export function turnPet(heading,desired,dt){const delta=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));return {heading:heading+Math.max(-3*dt,Math.min(3*dt,delta)),canMove:Math.abs(delta)<.3};}

// Manual street commands and residents' outings consume the same real route.
export function walkRoute(route,position,heading,dt,speed,clear=()=>true){const q=route[0];if(!q)return {position:{...position},heading,speed:0};const dx=q.x-position.x,dz=q.z-position.z,d=Math.hypot(dx,dz),turn=turnPet(heading,Math.atan2(dx,dz),dt);let step=turn.canMove?Math.min(d,dt*speed):0;const next={x:position.x+(d?dx/d*step:0),z:position.z+(d?dz/d*step:0)};if(step&&!clear(next,position)){step=0;next.x=position.x;next.z=position.z;}if(d<=step+.002)route.shift();return {position:next,heading:turn.heading,speed:dt&&step?step/dt:0};}
