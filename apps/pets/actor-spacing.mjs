import {walkRoute} from './movement.mjs?v=fg-7dbe5530b8cc1d34';

// Physical bodies stay in the existing room/path system. Busy or sleeping
// residents still occupy space; the off-screen player's hand has no body.
export function actorRadius(a){const size=a.size||1;return a.kind==='person'?.23*size:(a.species==='dog'?.5:.46)*size*(1+.2*((a.weight||1)-1));}
export function actorDistance(a,b){return a.kind==='pet'&&b.kind==='pet'?.52*Math.max(a.size||1,b.size||1):actorRadius(a)+actorRadius(b)+.04;}
export function actorObstacles(self,actors){return actors.filter(a=>a.id!==self.id&&a.place===self.place&&a.position).map(a=>({...a.position,r:actorDistance(self,a)}));}
export function clearActorSegment(from,to,avoid=[]){
 const dx=to.x-from.x,dz=to.z-from.z,l=dx*dx+dz*dz;
 return avoid.every(o=>{const before=Math.hypot(from.x-o.x,from.z-o.z),minimum=Math.min(o.r,before),t=l?Math.max(0,Math.min(1,((o.x-from.x)*dx+(o.z-from.z)*dz)/l)):0;
  return Math.hypot(from.x+dx*t-o.x,from.z+dz*t-o.z)>=minimum-1e-7&&(before>=o.r-1e-7||!l||Math.hypot(to.x-o.x,to.z-o.z)>before+1e-7);
 });
}
export function createActorNavigation(base,{actor,actors}){
 let retry=0,escape=[];
 const obstacles=()=>actorObstacles(actor(),actors());
 const clearPoint=q=>obstacles().every(o=>Math.hypot(q.x-o.x,q.z-o.z)>=o.r-1e-7);
 const path=(from,to)=>base.path(from,to,obstacles());
 function freePoint(point,from=point,maxOffset=1.2,reachable=false){
  const avoid=obstacles(),clear=q=>base.walkable(q.x,q.z)&&avoid.every(o=>Math.hypot(q.x-o.x,q.z-o.z)>=o.r);
  if(clear(point)&&(!reachable||base.path(from,point,avoid)))return {...point};
  const angle=Math.atan2(from.x-point.x,from.z-point.z);
  for(let r=.2;r<=maxOffset+1e-7;r+=.2)for(const offset of [0,.6,-.6,1.2,-1.2,Math.PI/2,-Math.PI/2,1.8,-1.8,Math.PI]){const q={x:point.x+Math.sin(angle+offset)*r,z:point.z+Math.cos(angle+offset)*r};if(clear(q)&&base.path(from,q,avoid))return q;}
  return null;
 }
 function walk(route,position,heading,dt,speed){
  retry=Math.max(0,retry-dt);let blocked=false;const avoid=obstacles();
  const moved=walkRoute(route,position,heading,dt,speed,(q,p)=>{const ok=base.walkable(q.x,q.z)&&clearActorSegment(p,q,avoid);blocked=!ok;return ok;});
  if(blocked&&retry===0&&route.length){const next=path(position,route.at(-1));if(next)route.splice(0,route.length,...next);retry=.45;}
  return {...moved,blocked};
 }
 function separate(position,heading,dt,speed){
  if(clearPoint(position)){escape=[];return null;}
  if(!escape.length||!clearPoint(escape.at(-1))){const q=freePoint(position,position,1.6);escape=q?path(position,q)||[]:[];}
  return walk(escape,position,heading,dt,speed);
 }
 return {...base,path,freePoint,clearPoint,stepClear:(from,to)=>clearActorSegment(from,to,obstacles()),walk,separate};
}
