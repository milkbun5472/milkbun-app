import * as T from 'three';
import {furniturePoint,furnitureSeat} from './home-catalog.mjs?v=fg-90b53e2779ab7a1c';
import {headPoint,bonePoint,nearHand,pairContact,torsoPoint,shoulderPose,pairSize} from './pair-pose.mjs?v=fg-90b53e2779ab7a1c';

import './social.js?v=fg-90b53e2779ab7a1c';
export const REST_PAIRS=globalThis.CharDaySocial.rest;
const compatible=new Set(['look','cup','hand','pat','hug','shoulder','closer','cuddle']);
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const local=(p,q)=>{const h=p.heading||0,dx=q.x-p.x,dz=q.z-p.z;return {x:dx*Math.cos(h)-dz*Math.sin(h),z:dx*Math.sin(h)+dz*Math.cos(h)};};
const sofaApproaches=(p,x)=>[{x:-p.w/2-.6,z:.25},{x:p.w/2+.6,z:.25},{x:-x,z:p.d/2+.75},{x,z:p.d/2+.75}].map(q=>furniturePoint(p,q));
export function sofaPairs(map,offset=.6,leaner=null){
 return map.furniture.filter(p=>['sofa','bench'].includes(p.kind)&&!p.stored).flatMap(p=>[-1,1].flatMap(side=>{
  const approaches=sofaApproaches(p,offset*side);
  return approaches.flatMap(a=>approaches.map(b=>({a:furnitureSeat(p,a,{x:-offset*side,z:.05+(leaner==='a'?.12:0)}),b:furnitureSeat(p,b,{x:offset*side,z:.05+(leaner==='b'?.12:0)})})));
 }));
}
export function restKindFor(kind,from){return REST_PAIRS[kind]?kind:(from.a.bed||from.b.bed)?({hand:'lie-hand',hug:'lie-hug',cuddle:'lie-hug',look:'lie-rest',closer:'lie-rest'}[kind]||null):null;}
// Keep a real occupied cushion first. Only the free participant approaches;
// someone already on that cushion can slide across it without standing up.
export function restPlans(map,kind,from,{distance=null,automatic=false}={}){
 const restKind=restKindFor(kind,from),definition=REST_PAIRS[restKind],choices=[];
 if(definition?.posture==='lie'){
  for(const p of map.furniture.filter(p=>p.kind==='bed'&&!p.stored)){
   const spot=map.spots.find(s=>s.piece===p.id&&s.sleep);if(!spot)continue;
   const same=(who,slot)=>!!from[who].bed&&(from[who].bed.piece?from[who].bed.piece===p.id:gap(from[who].bed,slot)<1.2),current=same('a',spot.sleep),guestCurrent=same('b',spot.playerSleep);
   const spacing=restKind==='lie-hug'?(distance||.44):restKind==='lie-hand'?.66:.98;
   const poses={a:{...spot.sleep,...furniturePoint(p,{x:spacing/2,z:.65}),piece:p.id,awake:!automatic||!current||from.a.bed.awake===true},b:{...spot.playerSleep,...furniturePoint(p,{x:-spacing/2,z:.65}),piece:p.id,awake:true}};
   if(current){Object.assign(poses.a,{x:from.a.bed.x,z:from.a.bed.z});const q=local(p,poses.a);Object.assign(poses.b,furniturePoint(p,{x:q.x-spacing,z:q.z}));}else if(guestCurrent){Object.assign(poses.b,{x:from.b.bed.x,z:from.b.bed.z});const q=local(p,poses.b);Object.assign(poses.a,furniturePoint(p,{x:q.x+spacing,z:q.z}));}
   const approaches=who=>{const old=from[who].bed,same=old&&gap(old,poses[who])<1.2;return same?[{...from[who],retain:true}]:[{x:(who==='a'?1:-1)*(p.w/2+.55),z:.8},{x:(who==='a'?1:-1)*.55,z:p.d/2+.65},{x:(who==='a'?1:-1)*.85,z:p.d/2+.9}].map(q=>furniturePoint(p,q));};
   for(const a of approaches('a'))for(const b of approaches('b'))choices.push({a,b,beds:poses,heading:p.heading||0,local:!!current||guestCurrent,preserveHost:!!current,retain:{a:!!a.retain,b:!!b.retain},posture:'lie',restKind});
  }
  return choices;
 }
 if(!definition&&!compatible.has(kind))return choices;
 for(const host of ['a','b']){
  const guest=host==='a'?'b':'a',at=from[host].seat,p=map.furniture.find(p=>p.id===at?.piece&&!p.stored);if(!p)continue;
  if(['sofa','bench'].includes(p.kind))for(const side of [-1,1]){
   const q=local(p,at),x=q.x+side*(distance||.66);if(Math.abs(x)>p.w/2-.22)continue;
   const same=from[guest].seat?.piece===p.id;
   for(const approach of same?[{...from[guest]}]:sofaApproaches(p,x)){
    const seats={[host]:{...at},[guest]:furnitureSeat(p,approach,{x,z:q.z})};
    choices.push({[host]:{...from[host]},[guest]:approach,seats,heading:p.heading||0,local:true,preserveHost:!!from.a.seat,retain:{[host]:true,[guest]:same},posture:'sit'});
   }
  }
  if(!definition&&['look','cup','hand','pat','hug'].includes(kind))for(const side of [-1,1]){
   const q=local(p,at),guestAt=furniturePoint(p,{x:q.x+side*.64,z:p.d/2+.38});
   choices.push({[host]:{...from[host]},[guest]:guestAt,seats:{[host]:{...at}},heading:p.heading||0,local:true,preserveHost:!!from.a.seat,retain:{[host]:true},posture:'mixed'});
  }
 }
 if(definition?.posture==='sit')choices.push(...sofaPairs(map,(distance||.66)/2).map(seats=>({a:seats.a.approach,b:seats.b.approach,seats,heading:seats.a.heading,posture:'sit'})));
 return choices;
}

export function createRestPair({a,b}){
 const actors={a,b};
 return {tick(s,pa,pb){
  const d=REST_PAIRS[s.plan.restKind||s.kind];if(!d)return null;
  const giver=s.initiator==='a'?a:b,receiver=giver===a?b:a,pg=giver===a?pa:pb,pr=receiver===a?pa:pb,contacts=[],progress=Math.min(pa,pb);
  const q={ok:true,posture:d.posture,progress,contacts,stage:progress<.98?'轻轻靠近':'相依'};
  if(d.motion==='hand'){
   const as=nearHand(a,b.root.position),bs=nearHand(b,a.root.position),point=bonePoint(a,as==='left'?'Left_hand':'Right_hand').add(bonePoint(b,bs==='left'?'Left_hand':'Right_hand')).multiplyScalar(.5);
   if(d.posture==='lie')point.y=Math.max(point.y,s.plan.beds.a.y+.045);
   else{point.y=Math.min(bonePoint(a,as+'Arm').y,bonePoint(b,bs+'Arm').y)-.17;point.add(new T.Vector3(Math.sin(s.plan.heading||0)*.07,0,Math.cos(s.plan.heading||0)*.07));}
   pairContact(a,{[as]:point},pa,contacts);pairContact(b,{[bs]:point},pb,contacts);q.handsDistance=bonePoint(a,as==='left'?'Left_hand':'Right_hand').distanceTo(bonePoint(b,bs==='left'?'Left_hand':'Right_hand'));
  }else if(d.motion==='pat'){
   const difference=Math.max(0,headPoint(receiver,[0,0,0]).y-headPoint(giver,[0,0,0]).y),toward=receiver.root.worldToLocal(giver.root.position.clone()).x<0?-1:1;
   giver.contactPose({tilt:.35*pg});receiver.contactPose({tilt:Math.min(.75,.45+difference)*pr,nod:Math.min(.85,.48+difference)*pr});
   const stroke=Math.sin(s.elapsed*.9)*.09,point=headPoint(receiver,[toward*.66,-.48+stroke,-.58]);pairContact(giver,{[nearHand(giver,point)]:point},pg,contacts);q.stroke=stroke;q.hairTarget=point.toArray();
  }else if(d.motion==='shoulder'){
   const side=nearHand(giver,receiver.root.position),point=torsoPoint(receiver,side==='left'?1:-1,1,-.015);pairContact(giver,{[side]:point},pg,contacts);
   receiver.contactPose({lean:(receiver.root.worldToLocal(giver.root.position.clone()).x<0?1:-1)*.12*pr});
  }else if(d.motion==='lean'){
   const pose=shoulderPose(giver,receiver,pr,{holderProgress:pg,minimumHeadGap:(pairSize(giver).radius+pairSize(receiver).radius)*.97});q.shoulderDistance=pose.shoulderDistance;
   const toward=receiver.root.worldToLocal(giver.root.position.clone()).x<0?-1:1,side=nearHand(giver,receiver.root.position),back=torsoPoint(receiver,toward*.85,.60,-.015);pairContact(giver,{[side]:back},pg,contacts);
   const wrist=bonePoint(giver,side==='left'?'Left_hand':'Right_hand');pairContact(receiver,{[nearHand(receiver,wrist)]:wrist},pr,contacts);
  }else if(d.motion==='hug'){
   const separation=Math.hypot(s.plan.beds.a.x-s.plan.beds.b.x,s.plan.beds.a.z-s.plan.beds.b.z),gapNeeded=pairSize(a).radius+pairSize(b).radius+.065,lean=T.MathUtils.clamp((gapNeeded-separation)/1.05,.04,.25);
   a.contactPose({lean:-lean*pa});b.contactPose({lean:lean*pb});
   const side=nearHand(giver,bonePoint(receiver,'body')),back=torsoPoint(receiver,giver===a?1:-1,.65,-.025);pairContact(giver,{[side]:back},pg,contacts);
   const wrist=bonePoint(giver,side==='left'?'Left_hand':'Right_hand');pairContact(receiver,{[nearHand(receiver,wrist)]:wrist},pr,contacts);
  }
  q.points={a:headPoint(a,[0,0,0]).toArray(),b:headPoint(b,[0,0,0]).toArray()};return q;
 }};
}
