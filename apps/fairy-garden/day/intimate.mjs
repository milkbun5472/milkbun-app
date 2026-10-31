import * as T from 'three';
import {makeRecipeFood,disposeFood} from './recipe-food.mjs?v=fg-90b53e2779ab7a1c';
import './social.js?v=fg-90b53e2779ab7a1c';
import {pairProgress} from './motion-profile.mjs?v=fg-90b53e2779ab7a1c';
import {walkable,segmentClear} from '../world.mjs?v=fg-90b53e2779ab7a1c';

export const INTIMATE=globalThis.CharDaySocial.intimate;
import {headPoint,nearHand,bonePoint,torsoPoint,pairContact,shoulderPose,faceSpacing,facePose,faceHands} from './pair-pose.mjs?v=fg-90b53e2779ab7a1c';
export {headPoint};
const hand=(actor,side)=>actor.root.getObjectByName(side==='left'?'Left_hand':'Right_hand');
const smooth=n=>{n=T.MathUtils.clamp(n,0,1);return n*n*(3-2*n);};

export function createIntimate({a,b,map,style,kitchen=()=>null}){
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
 let diagnostics=null,foodKey='',servingFood=null;
 function hide(clearFood=true){if(clearFood){disposeFood(servingFood);servingFood=null;foodKey='';}dish.visible=morsel.visible=true;spoon.visible=snack.visible=false;diagnostics=null;}
 const contact=pairContact;
 function safeMove(actor,dx,dz,other,clearance=.26){
  const old={x:actor.root.position.x,z:actor.root.position.z},next={x:old.x+dx,z:old.z+dz},m=map(),id=m.id||m.renderer;
  if(!walkable(next.x,next.z,id)||!segmentClear(old,next,id,[{x:other.root.position.x,z:other.root.position.z,r:clearance}]))return false;
  actor.root.position.x=next.x;actor.root.position.z=next.z;actor.root.updateWorldMatrix(true,true);return true;
 }
 // Feet stay on the real floor. A taller participant bends toward the shorter one.
 function meet(giver,receiver,gp,rp,progress,seated,anchor=null){
  const from=headPoint(giver,gp),to=headPoint(receiver,rp),delta=to.clone().sub(from);
  if(seated)return from.distanceTo(to);
  const amount=smooth(progress),dx=delta.x*amount,dz=delta.z*amount;
  if(Math.hypot(dx,dz)>.75)return null;
  const share=anchor===giver?0:anchor===receiver?1:.5;
  if(!safeMove(giver,dx*share,dz*share,receiver)||!safeMove(receiver,-dx*(1-share),-dz*(1-share),giver))return null;
  return headPoint(giver,gp).distanceTo(headPoint(receiver,rp));
 }
 function tick(s){
  hide(false);const definition=INTIMATE[s.kind];if(!definition||s.phase!=='active')return null;
  const initiator=s.initiator||'b',other=initiator==='a'?'b':'a',g=actors[initiator],r=actors[other],pg=pairProgress(s.elapsed,style(initiator)),pr=pairProgress(s.elapsed,style(other)),p=Math.min(pg,pr),contacts=[];
  const hc=headPoint(g,[0,0,0]),rc=headPoint(r,[0,0,0]),heightDifference=hc.y-rc.y;
  const posture=(actor,pose)=>actor.contactPose(pose);
  diagnostics={initiator:initiator==='a'?'ta':'me',progress:p,stage:p<.98?'靠近':'相依',contacts};
  if(['kiss','kiss-cheek','kiss-forehead','forehead'].includes(s.kind)){
   const gp=s.kind==='forehead'?[0,.48,.9]:[0,-.42,.93],rp=s.kind==='kiss-forehead'?[0,.50,.91]:s.kind==='kiss-cheek'?[.75,-.18,.67]:s.kind==='forehead'?[0,.48,.9]:[0,-.42,.93];
   const from=s.plan[initiator],to=s.plan[other],center=new T.Vector3((from.x+to.x)/2,0,(from.z+to.z)/2),direction=new T.Vector3(to.x-from.x,0,to.z-from.z).normalize(),spacing=faceSpacing(g,r),goals={giver:center.clone().addScaledVector(direction,-spacing/2),receiver:center.clone().addScaledVector(direction,spacing/2)};
   if(s.plan.anchor===initiator){goals.giver.set(from.x,0,from.z);goals.receiver.copy(goals.giver).addScaledVector(direction,spacing);}
   else if(s.plan.anchor===other){goals.receiver.set(to.x,0,to.z);goals.giver.copy(goals.receiver).addScaledVector(direction,-spacing);}
   const fit=facePose(g,r,gp,rp,goals,s.faceFit);let distance;
   if(fit.ok){
    s.faceFit=fit;const amount=smooth(p)*p,poseProgress=smooth(Math.min(1,p*1.4)),move=(actor,origin,target,partner)=>{const next=new T.Vector3(origin.x,0,origin.z).lerp(target,amount);return safeMove(actor,next.x-actor.root.position.x,next.z-actor.root.position.z,partner,spacing*.65);};
    if(!move(g,from,goals.giver,r)||!move(r,to,goals.receiver,g))return {ok:false,reason:'身旁的位置被挡住了，换一处空地再靠近。'};
    posture(g,{tilt:fit.tilt*poseProgress,nod:fit.giverNod*poseProgress,headPivot:poseProgress});posture(r,{tilt:fit.tilt*poseProgress,nod:fit.receiverNod*poseProgress,neckTurn:fit.receiverTurn*poseProgress,headPivot:poseProgress});
    distance=headPoint(g,gp).distanceTo(headPoint(r,rp));
    diagnostics.headDistance=distance;diagnostics.points={giver:headPoint(g,gp).toArray(),receiver:headPoint(r,rp).toArray()};
   }else{
   posture(g,{tilt:.06*pg,nod:.06*pg,lean:s.kind==='kiss-cheek'?.06*pg:0});posture(r,{tilt:(s.kind==='kiss-forehead'?.12:.06)*pr,nod:(s.kind==='kiss-forehead'?.32:.06)*pr,turn:s.kind==='kiss-cheek'?.32*pr:0});
   // Match the actual mouth/cheek/forehead heights, including both body sizes.
   const bendTo=(actor,point,y,progress)=>{
    const q=actor.root.worldToLocal(headPoint(actor,point)),joint=name=>actor.root.worldToLocal(actor.root.getObjectByName(name).getWorldPosition(new T.Vector3())),neck=joint('neck'),waist=joint('body');
    const height=t=>q.clone().sub(neck).applyAxisAngle(new T.Vector3(1,0,0),t*.65).add(neck).sub(waist).applyAxisAngle(new T.Vector3(1,0,0),t*.32).add(waist).y+actor.root.position.y;
    let low=0,high=1;for(let i=0;i<9;i++){const mid=(low+high)/2;if(height(mid)>y)low=mid;else high=mid;}
    posture(actor,{tilt:high*.32*progress,nod:high*.65*progress});
   };
   const gy=headPoint(g,gp).y,ry=headPoint(r,rp).y;if(gy>ry+.01)bendTo(g,gp,ry,pg);else if(ry>gy+.01)bendTo(r,rp,gy,pr);
   distance=meet(g,r,gp,rp,p,!!s.plan.seats,actors[s.plan.anchor]);if(distance==null)return {ok:false,reason:'这个角度没有能站稳的位置，换一处空地再靠近。'};
   diagnostics.headDistance=distance;diagnostics.points={giver:headPoint(g,gp).toArray(),receiver:headPoint(r,rp).toArray()};
   }
   diagnostics.bodyDistance=Math.hypot(g.root.position.x-r.root.position.x,g.root.position.z-r.root.position.z);diagnostics.closeFit=fit.ok;
   const held=faceHands(g,r,pg,pr,s.faceHandChoice);s.faceHandChoice=held.choice;contacts.push(...held.contacts);diagnostics.faceHand=held.faceHand;
  }else if(s.kind==='pat'){
   // The receiver bows into the hand instead of lifting the giver off the floor.
   posture(r,{tilt:(.18+Math.max(0,-heightDifference)*.6)*pr,nod:(.30+Math.max(0,-heightDifference))*pr});posture(g,{tilt:.08*pg,nod:.06*pg});
   const stroke=Math.sin(s.elapsed*1.3)*.15,point=headPoint(r,[.35+stroke,.55,.84]);
   contact(g,{[nearHand(g,point)]:point},pg,contacts);diagnostics.stroke=stroke;diagnostics.points={hair:point.toArray()};
  }else if(s.kind==='back-hug'){
   const side=r.root.worldToLocal(g.root.position.clone()).x<0?-1:1;
   posture(g,{tilt:.28*pg,neckLean:-side*.70*pg,nod:-.35*pg});posture(r,{nod:.08*pr});
   const left=torsoPoint(r,-.95,.90,.09),right=torsoPoint(r,.95,.90,.09);
   contact(g,{left,right},pg,contacts);
   contact(r,{left:hand(g,'left').getWorldPosition(new T.Vector3()),right:hand(g,'right').getWorldPosition(new T.Vector3())},pr,contacts);
  }else if(s.kind==='cuddle'){
   const pose=shoulderPose(g,r,pr,{embrace:true,holderProgress:pg});contacts.push(...pose.contacts);diagnostics.shoulderDistance=pose.shoulderDistance;diagnostics.piece=s.plan.seats.a.piece;
  }else if(s.kind==='arm-walk'){
   // Keep the same paired route and speed; clasp the adjacent forearms as they walk.
   const gs=nearHand(g,r.root.position),rs=nearHand(r,g.root.position),target=(actor,side)=>{const bone=actor.root.getObjectByName(side+'Forearm');return bone?bone.getWorldPosition(new T.Vector3()):actor.root.localToWorld(new T.Vector3(0,.64,0));};
   contact(g,{[gs]:target(r,rs)},pg,contacts);contact(r,{[rs]:target(g,gs)},pr,contacts);
  }else if(s.kind==='feed'){
   const meal=kitchen()?.job,course=meal?.kind==='meal'?meal.courses?.[0]:meal?.kind==='cook'&&s.moment?.kind?.startsWith('taste')?{id:meal.id,recipeId:meal.recipeId,variation:meal.cooking?.variation}:null,key=course?meal.id+':'+course.id+':'+JSON.stringify([course.variation,course.finish,course.tabletop]):'';
   if(key!==foodKey){disposeFood(servingFood);servingFood=null;foodKey=key;if(course){servingFood=makeRecipeFood(course.recipeId,{variation:course.variation,finish:course.finish,tabletop:course.tabletop});servingFood.scale.setScalar(.28);servingFood.position.y=.024;snack.add(servingFood);bite.material.color.set(servingFood.userData.biteColor);}dish.visible=morsel.visible=!course;}
   diagnostics.recipeId=course?.recipeId||null;
   const turn=actor=>{const other=actor===g?r:g;return Math.sign(actor.root.worldToLocal(other.root.position.clone()).x)*.55;};
   posture(g,{tilt:.10*pg,turn:s.plan.seats&&!s.plan.tableMeal?turn(g)*pg:0});posture(r,{tilt:(s.plan.tableMeal?Math.min(.15,Math.max(0,-heightDifference)*.8):Math.max(0,-heightDifference)*.8)*pr,turn:s.plan.seats?turn(r)*pr:0});
   const mouth=headPoint(r,[0,-.42,.99]),serving=nearHand(g,mouth),holding=serving==='left'?'right':'left',shoulder=g.root.getObjectByName(serving+'Arm').getWorldPosition(new T.Vector3()),direction=mouth.clone().sub(shoulder).normalize(),grip=mouth.clone().addScaledVector(direction,-.17);
   const reach=smooth(((s.elapsed%(style(initiator).style==='clingy'?9:7))/7)*1.5);
   contact(g,{[serving]:grip},pg*reach,contacts);const wrist=hand(g,serving).getWorldPosition(new T.Vector3());
   spoon.visible=snack.visible=true;spoon.position.copy(wrist);spoon.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),mouth.clone().sub(wrist).normalize());
   snack.position.copy(hand(g,holding).getWorldPosition(new T.Vector3()));spoon.updateWorldMatrix(true,true);
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
