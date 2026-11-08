import * as T from 'three';
import {STORY_ACTIONS} from './story-actions.mjs?v=fg-b87d2cd90819f098';
const ease=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
const reach=p=>ease(p/.24)*ease((1-p)/.22);
export function storyAnimation(action,progress){const d=STORY_ACTIONS[action]||{};return {gesture:d.gesture||'rest',emotion:d.emotion||null,progress};}
export function makeStoryLetter(){
 const letter=new T.Group();letter.name='CarriedLetter';letter.add(new T.Mesh(new T.BoxGeometry(.28,.18,.018),new T.MeshStandardMaterial({color:'#eee1c4',roughness:.9})));
 const fold=new T.BufferGeometry().setFromPoints([new T.Vector3(-.135,.08,.013),new T.Vector3(0,-.025,.013),new T.Vector3(.135,.08,.013)]);letter.add(new T.Line(fold,new T.LineBasicMaterial({color:'#a99169'})));return letter;
}
const bone=(a,name)=>a.root.getObjectByName(name);
export const storyHandPoint=(a,side='right')=>{a.root.updateWorldMatrix(true,true);const h=bone(a,side==='left'?'Left_hand':'Right_hand');return h?h.getWorldPosition(new T.Vector3()):a.handPoint(side);};
const shoulder=a=>{a.root.updateWorldMatrix(true,true);const b=bone(a,'rightArm')||bone(a,'Right_shoulder')||bone(a,'HeadAnchor');return b?b.getWorldPosition(new T.Vector3()):a.root.position.clone().add(new T.Vector3(0,1.15,0));};
const hand=(a,target,p)=>storyHandPoint(a).lerp(target,reach(p));
export function applyStoryPair(actor,target,action,progress,{giverSide='right'}={}){
 if(!actor||!target)return null;const p=T.MathUtils.clamp(progress,0,1);
 if(action==='pat'){
  const candidates=['leftArm','rightArm'].map(name=>bone(target,name)).filter(Boolean).map(b=>b.getWorldPosition(new T.Vector3())),from=actor.root.position;const closest=candidates.sort((a,b)=>a.distanceToSquared(from)-b.distanceToSquared(from))[0]||shoulder(target);const toward=actor.root.position.clone().sub(target.root.position);toward.y=0;toward.normalize();
  const contact=closest.addScaledVector(toward,.055).add(new T.Vector3(0,.025+Math.sin(p*Math.PI*6)*.012,0));actor.contactPose({right:hand(actor,contact,p)});
  const dx=actor.root.position.x-target.root.position.x,dz=actor.root.position.z-target.root.position.z,angle=Math.atan2(dx,dz)-target.root.rotation.y;
  target.contactPose({neckTurn:T.MathUtils.clamp(Math.atan2(Math.sin(angle),Math.cos(angle)),-.65,.65)*reach(p),nod:-.035*reach(p),headPivot:1});
  return {contact:contact.toArray(),distance:storyHandPoint(actor).distanceTo(contact),reaction:reach(p),targetHeadTurn:bone(target,'neck')?.rotation.y||0,actorPosition:actor.root.position.toArray(),targetPosition:target.root.position.toArray(),hand:storyHandPoint(actor).toArray()};
 }
 if(action==='hand'){
  const receiverSide=giverSide==='right'?'left':'right',a=bone(actor,giverSide+'Arm').getWorldPosition(new T.Vector3()),b=bone(target,receiverSide+'Arm').getWorldPosition(new T.Vector3()),contact=a.clone().add(b).multiplyScalar(.5);contact.y-=.04;
  actor.contactPose({[giverSide]:storyHandPoint(actor,giverSide).lerp(contact,reach(p))});target.contactPose({[receiverSide]:storyHandPoint(target,receiverSide).lerp(contact,reach(p))});
  return {contact:contact.toArray(),giverSide,receiverSide,giverDistance:storyHandPoint(actor,giverSide).distanceTo(contact),receiverDistance:storyHandPoint(target,receiverSide).distanceTo(contact)};
 }
 return null;
}
export function createStoryTools(scene){
 const broom=new T.Group();broom.name='StoryBroom';scene.add(broom);const wood=new T.MeshStandardMaterial({color:'#9f805a',roughness:.88}),straw=new T.MeshStandardMaterial({color:'#c4ac70',roughness:.95});
 const shaft=new T.Mesh(new T.CylinderGeometry(.018,.022,1.05,8),wood);shaft.position.y=.59;broom.add(shaft);
 for(let i=0;i<9;i++){const tuft=new T.Mesh(new T.BoxGeometry(.042,.17,.055),straw);tuft.position.set((i-4)*.039,.085,0);tuft.rotation.z=(i-4)*-.025;broom.add(tuft);}broom.visible=false;
 let report=null;
 return {begin(){broom.visible=false;report=null;},sweep(avatar,p,floor=.08){
  const yaw=avatar.root.rotation.y,side=Math.sin(p*Math.PI*5)*.12,base=avatar.root.position.clone().add(new T.Vector3(Math.sin(yaw)*.34+Math.cos(yaw)*side,0,Math.cos(yaw)*.34-Math.sin(yaw)*side));base.y=floor;
  broom.visible=p>0&&p<1;broom.position.copy(base);broom.rotation.set(-.18,yaw,0,'YXZ');broom.updateWorldMatrix(true,true);
  const shoulderY=shoulder(avatar).y-floor,right=broom.localToWorld(new T.Vector3(0,Math.max(.3,shoulderY-.14),0)),left=broom.localToWorld(new T.Vector3(0,Math.max(.4,shoulderY+.02),0));avatar.contactPose({right:hand(avatar,right,p),left:storyHandPoint(avatar,'left').lerp(left,reach(p)),tilt:.04*reach(p)});
  report={kind:'sweep',visible:broom.visible,foot:base.toArray(),right:storyHandPoint(avatar).distanceTo(right),left:storyHandPoint(avatar,'left').distanceTo(left)};
 },lamp(avatar,p,target){
  const point=new T.Vector3(target.x,target.y-.12*Math.sin(p*Math.PI)**2,target.z);avatar.contactPose({right:hand(avatar,point,p)});report={kind:'lamp',contact:point.toArray(),distance:storyHandPoint(avatar).distanceTo(point)};
 },inspect:()=>report};
}
