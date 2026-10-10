import * as T from 'three';
import './social.js?v=fg-0ea83b85ae5ca55e';
import {pairProgress} from './motion-profile.mjs?v=fg-0ea83b85ae5ca55e';
import {walkable,segmentClear} from '../world.mjs?v=fg-0ea83b85ae5ca55e';

export const INTIMATE=globalThis.CharDaySocial.intimate;
const head=actor=>actor.root.getObjectByName('HeadAnchor');
const hand=(actor,side)=>actor.root.getObjectByName(side==='left'?'Left_hand':'Right_hand');
// These are points on the authored unit head, transformed by the actual look/pose.
export function headPoint(actor,point){actor.root.updateWorldMatrix(true,true);return head(actor).localToWorld(new T.Vector3(...point));}
const localPoint=(actor,point)=>actor.root.localToWorld(new T.Vector3(...point));
const nearHand=(actor,target)=>['left','right'].sort((x,y)=>hand(actor,x).getWorldPosition(new T.Vector3()).distanceTo(target)-hand(actor,y).getWorldPosition(new T.Vector3()).distanceTo(target))[0];
const smooth=n=>{n=T.MathUtils.clamp(n,0,1);return n*n*(3-2*n);};

export function createIntimate({a,b,map,style}){
 const actors={a,b};
 const spoon=new T.Group();spoon.name='TogetherSpoon';spoon.visible=false;a.root.parent?.add(spoon);
 const metal=new T.MeshStandardMaterial({color:'#c5c8b6',metalness:.6,roughness:.35});
 const stem=new T.Mesh(new T.CylinderGeometry(.009,.009,.14,8),metal);stem.rotation.x=Math.PI/2;stem.position.z=.07;spoon.add(stem);
 const bowl=new T.Mesh(new T.SphereGeometry(.031,12,8),metal);bowl.scale.set(.8,.25,1.2);bowl.position.z=.17;spoon.add(bowl);
 const bite=new T.Mesh(new T.SphereGeometry(.022,12,8),new T.MeshStandardMaterial({color:'#d5a66f',roughness:.9}));bite.position.set(0,.012,.17);spoon.add(bite);
 const tip=new T.Object3D();tip.name='TogetherSpoonTip';tip.position.z=.17;spoon.add(tip);
 const snack=new T.Group();snack.name='TogetherSnack';snack.visible=false;a.root.parent?.add(snack);
 const dish=new T.Mesh(new T.CylinderGeometry(.08,.06,.05,16),new T.MeshStandardMaterial({color:'#ead7b5',roughness:.85}));snack.add(dish);
 const morsel=bite.clone();morsel.position.set(0,.038,0);snack.add(morsel);
 let diagnostics=null;
 function hide(){spoon.visible=snack.visible=false;diagnostics=null;}
 function contact(actor,targets,progress,record){
  actor.root.updateWorldMatrix(true,true);const adjusted={};
  for(const side of ['left','right'])if(targets[side])adjusted[side]=hand(actor,side).getWorldPosition(new T.Vector3()).lerp(targets[side],progress);
  actor.contactPose(adjusted);
  for(const side of ['left','right'])if(targets[side])record.push({who:actor===a?'ta':'me',side,error:hand(actor,side).getWorldPosition(new T.Vector3()).distanceTo(targets[side])});
 }
 function safeMove(actor,dx,dz,other){
  const old={x:actor.root.position.x,z:actor.root.position.z},next={x:old.x+dx,z:old.z+dz},m=map(),id=m.id||m.renderer;
  if(!walkable(next.x,next.z,id)||!segmentClear(old,next,id,[{x:other.root.position.x,z:other.root.position.z,r:.26}]))return false;
  actor.root.position.x=next.x;actor.root.position.z=next.z;actor.root.updateWorldMatrix(true,true);return true;
 }
 // Feet stay on the real floor. A taller participant bends toward the shorter one.
 function meet(giver,receiver,gp,rp,progress,seated){
  const from=headPoint(giver,gp),to=headPoint(receiver,rp),delta=to.clone().sub(from);
  if(seated)return from.distanceTo(to);
  const amount=smooth(progress),dx=delta.x*amount,dz=delta.z*amount;
  if(Math.hypot(dx,dz)>.75)return null;
  if(!safeMove(giver,dx/2,dz/2,receiver)||!safeMove(receiver,-dx/2,-dz/2,giver))return null;
  return headPoint(giver,gp).distanceTo(headPoint(receiver,rp));
 }
 function tick(s){
  hide();const definition=INTIMATE[s.kind];if(!definition||s.phase!=='active')return null;
  const initiator=s.initiator||'b',other=initiator==='a'?'b':'a',g=actors[initiator],r=actors[other],pg=pairProgress(s.elapsed,style(initiator)),pr=pairProgress(s.elapsed,style(other)),p=Math.min(pg,pr),contacts=[];
  const hc=headPoint(g,[0,0,0]),rc=headPoint(r,[0,0,0]),heightDifference=hc.y-rc.y;
  const posture=(actor,pose)=>actor.contactPose(pose);
  diagnostics={initiator:initiator==='a'?'ta':'me',progress:p,stage:p<.98?'靠近':'相依',contacts};
  if(['kiss','kiss-cheek','kiss-forehead','forehead'].includes(s.kind)){
   const gp=s.kind==='forehead'?[0,.48,.9]:[0,-.42,.93],rp=s.kind==='kiss-forehead'?[0,.50,.91]:s.kind==='kiss-cheek'?[.75,-.18,.67]:s.kind==='forehead'?[0,.48,.9]:[0,-.42,.93];
   posture(g,{tilt:.04*pg,lean:s.kind==='kiss-cheek'?.09*pg:0});posture(r,{tilt:(s.kind==='kiss-forehead'?.44:.04)*pr,turn:s.kind==='kiss-cheek'?.48*pr:0});
   // Match the actual mouth/cheek/forehead heights, including both body sizes.
   const bendTo=(actor,point,y,progress)=>{const q=actor.root.worldToLocal(headPoint(actor,point));const angle=Math.acos(T.MathUtils.clamp((y-actor.root.position.y)/Math.hypot(q.y,q.z),-1,1))-Math.atan2(q.z,q.y);posture(actor,{tilt:T.MathUtils.clamp(angle,0,.50)*progress});};
   const gy=headPoint(g,gp).y,ry=headPoint(r,rp).y;if(gy>ry+.01)bendTo(g,gp,ry,pg);else if(ry>gy+.01)bendTo(r,rp,gy,pr);
   const distance=meet(g,r,gp,rp,p,!!s.plan.seats);if(distance==null)return {ok:false,reason:'这个角度没有能站稳的位置，换一处空地再靠近。'};
   diagnostics.headDistance=distance;diagnostics.points={giver:headPoint(g,gp).toArray(),receiver:headPoint(r,rp).toArray()};
   if(s.kind!=='kiss-forehead'){const center=g.root.position.clone().add(r.root.position).multiplyScalar(.5),gs=nearHand(g,center),rs=nearHand(r,center),held=hand(g,gs).getWorldPosition(new T.Vector3()).add(hand(r,rs).getWorldPosition(new T.Vector3())).multiplyScalar(.5);
   held.y=(g.root.getObjectByName(gs+'Arm').getWorldPosition(new T.Vector3()).y+r.root.getObjectByName(rs+'Arm').getWorldPosition(new T.Vector3()).y)/2-.04;
   contact(g,{[gs]:held},pg,contacts);contact(r,{[rs]:held},pr,contacts);}
  }else if(s.kind==='pat'){
   // The receiver bows into the hand instead of lifting the giver off the floor.
   posture(r,{tilt:(.42+Math.max(0,-heightDifference)*1.3)*pr});posture(g,{tilt:.05*pg});
   const stroke=Math.sin(s.elapsed*1.3)*.15,point=headPoint(r,[.35+stroke,.55,.84]);
   contact(g,{[nearHand(g,point)]:point},pg,contacts);diagnostics.stroke=stroke;diagnostics.points={hair:point.toArray()};
  }else if(s.kind==='back-hug'){
   posture(g,{tilt:.04*pg,lean:style(initiator).sway*Math.sin(s.elapsed*.8)});
   const left=headPoint(r,[-.52,-1.50,-.42]),right=headPoint(r,[.52,-1.50,-.42]);
   contact(g,{left,right},pg,contacts);
   contact(r,{left:hand(g,'left').getWorldPosition(new T.Vector3()),right:hand(g,'right').getWorldPosition(new T.Vector3())},pr,contacts);
  }else if(s.kind==='cuddle'){
   const heading=s.plan.seats.a.heading,sign=Math.sign((r.root.position.x-g.root.position.x)*Math.cos(heading)-(r.root.position.z-g.root.position.z)*Math.sin(heading))||1;
   posture(g,{lean:-sign*.12*pg});posture(r,{lean:sign*(.16+style(other).lean*.15)*pr,tilt:.025*pr});
   const shoulder=headPoint(r,[-sign*.80,-1.21,-.32]),side=nearHand(g,shoulder);contact(g,{[side]:shoulder},pg,contacts);
   const clasp=g.root.getObjectByName(side+'Forearm').getWorldPosition(new T.Vector3());contact(r,{[nearHand(r,clasp)]:clasp},pr,contacts);
   diagnostics.piece=s.plan.seats.a.piece;
  }else if(s.kind==='arm-walk'){
   // Keep the same paired route and speed; clasp the adjacent forearms as they walk.
   const gs=nearHand(g,r.root.position),rs=nearHand(r,g.root.position),target=(actor,side)=>{const bone=actor.root.getObjectByName(side+'Forearm');return bone?bone.getWorldPosition(new T.Vector3()):localPoint(actor,[0,.64,0]);};
   contact(g,{[gs]:target(r,rs)},pg,contacts);contact(r,{[rs]:target(g,gs)},pr,contacts);
  }else if(s.kind==='feed'){
   posture(g,{tilt:.10*pg});posture(r,{tilt:Math.max(0,-heightDifference)*.8*pr});
   const mouth=headPoint(r,[0,-.42,.99]),shoulder=g.root.getObjectByName('rightArm').getWorldPosition(new T.Vector3()),direction=mouth.clone().sub(shoulder).normalize(),grip=mouth.clone().addScaledVector(direction,-.17);
   const reach=smooth(((s.elapsed%(style(initiator).style==='clingy'?9:7))/7)*1.5);
   contact(g,{right:grip},pg*reach,contacts);const wrist=hand(g,'right').getWorldPosition(new T.Vector3());
   spoon.visible=snack.visible=true;spoon.position.copy(wrist);spoon.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),mouth.clone().sub(wrist).normalize());
   snack.position.copy(hand(g,'left').getWorldPosition(new T.Vector3()));spoon.updateWorldMatrix(true,true);
   const distance=tip.getWorldPosition(new T.Vector3()).distanceTo(mouth);bite.visible=distance>.07;diagnostics.spoonDistance=distance;diagnostics.stage=distance<.07?'吃一口':'递过来';diagnostics.prop='spoon';
  }else if(s.kind==='dance'){
   const turn=Math.sin(s.elapsed*.32)*.55*p,center=new T.Vector3((s.plan.a.x+s.plan.b.x)/2,0,(s.plan.a.z+s.plan.b.z)/2);
   for(const who of ['a','b']){const actor=actors[who],point=new T.Vector3(s.plan[who].x,0,s.plan[who].z).sub(center).applyAxisAngle(new T.Vector3(0,1,0),turn).add(center);if(!safeMove(actor,point.x-actor.root.position.x,point.z-actor.root.position.z,actors[who==='a'?'b':'a']))return {ok:false,reason:'慢舞旁边的空间被挡住了，换一处空地再试。'};}
   s.a.heading=s.plan.heading+turn;s.b.heading=s.a.heading+Math.PI;
   a.root.rotation.y=s.a.heading;b.root.rotation.y=s.b.heading;a.root.updateWorldMatrix(true,true);b.root.updateWorldMatrix(true,true);
   posture(g,{lean:Math.sin(s.elapsed*.8)*.025*pg});posture(r,{lean:-Math.sin(s.elapsed*.8)*.025*pr});
   const held=hand(g,'left').getWorldPosition(new T.Vector3()).add(hand(r,'right').getWorldPosition(new T.Vector3())).multiplyScalar(.5);held.y=Math.max(held.y,hc.y-.35);
   contact(g,{left:held,right:headPoint(r,[-.60,-1.45,.75])},pg,contacts);
   contact(r,{right:held,left:headPoint(g,[.73,-1.22,.65])},pr,contacts);diagnostics.turn=turn;
  }
  diagnostics.ok=true;return diagnostics;
 }
 return {tick,hide,inspect:()=>diagnostics};
}
