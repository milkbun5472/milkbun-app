import {createNavigator,segmentIntersectsRect} from '../../apps/fairy-garden/navigation.mjs?v=fg-b80ee10be1013554';
import {clearActorSegment} from '../../apps/pets/actor-spacing.mjs?v=fg-b80ee10be1013554';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createPetWorld(layout){
 const padding=.25;
 const rectangles=[...layout.buildings,...layout.props.filter(p=>p.blocking!==false)];
 const circles=[{x:0,z:0,r:1.7},...layout.trees];
 function inRegion(x,z){return layout.walkRegions.some(r=>{if(!r.polygon)return Math.hypot(x-r.x,z-r.z)<=r.r;let inside=false;for(let i=0,j=r.polygon.length-1;i<r.polygon.length;j=i++){const a=r.polygon[i],b=r.polygon[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;});}
 function walkable(x,z){return Number.isFinite(x)&&Number.isFinite(z)&&Math.hypot(x,z)<=layout.radius&&inRegion(x,z)&&!rectangles.some(o=>Math.abs(x-o.x)<o.w/2+padding&&Math.abs(z-o.z)<o.d/2+padding)&&!circles.some(o=>Math.hypot(x-o.x,z-o.z)<o.r+padding);}
 function segmentClear(a,b,map,avoid=[]){
  if(!walkable(a.x,a.z)||!walkable(b.x,b.z))return false;
  for(const o of rectangles)if(segmentIntersectsRect(a,b,o,padding))return false;
  const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
  for(const o of circles){const t=l?Math.max(0,Math.min(1,((o.x-a.x)*dx+(o.z-a.z)*dz)/l)):0;if(Math.hypot(a.x+dx*t-o.x,a.z+dz*t-o.z)<o.r+padding)return false;}
  const n=Math.ceil(distance(a,b)/.18);for(let i=1;i<n;i++){const t=i/n;if(!inRegion(a.x+dx*t,a.z+dz*t))return false;}return clearActorSegment(a,b,avoid);
 }
 const navigator=createNavigator({outside:layout},walkable,segmentClear);
 const path=(a,b,avoid=[])=>{const result=navigator(a,b,'outside',avoid);if(!result)return null;let current=a,out=[],index=0;while(index<result.length){let next=index;while(next+1<result.length&&segmentClear(current,result[next+1],'outside',avoid))next++;out.push(result[next]);current=result[next];index=next+1;}return out;};
 function ground(x,z){return Math.abs(x)<=2.5&&Math.abs(z)<=29||Math.abs(x)<=1.5&&z<-27&&z>=-53||layout.buildings.some(b=>Math.abs(x-b.x*.5)<(Math.abs(b.x)+2)/2&&Math.abs(z-b.approach.z)<1.2)?.1:.06;}
 const building=id=>layout.buildings.find(b=>b.id===id);
 const nearest=p=>layout.buildings.map(b=>({building:b,distance:distance(p,b.approach)})).sort((a,b)=>a.distance-b.distance)[0];
 const canEnter=(p,id)=>!!building(id)&&distance(p,building(id).approach)<.45;
 function restore(raw){const d=raw&&typeof raw==='object'?raw:{},position=walkable(d.position?.x,d.position?.z)?{x:d.position.x,z:d.position.z}:{...layout.spawn};let outdoor=null;if(d.outdoor&&walkable(d.outdoor.position?.x,d.outdoor.position?.z)){const o=d.outdoor,p=o.pan;outdoor={position:{x:o.position.x,z:o.position.z},heading:Number.isFinite(o.heading)?o.heading:0,pan:p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{x:Math.max(-35,Math.min(35,p.x)),z:Math.max(-54,Math.min(39.2,p.z))}:{x:o.position.x,z:o.position.z},zoom:Number.isFinite(o.zoom)?Math.max(.45,Math.min(2.2,o.zoom)):1,follow:o.follow!==false,...(typeof o.overview==='boolean'?{overview:o.overview}:{})};}const room=building(d.room)?d.room:null;return {room:room&&outdoor&&canEnter(outdoor.position,room)?room:null,position,outdoor,evening:d.evening===true};}

 return {walkable,segmentClear,path,ground,building,nearest,canEnter,restore};
}
