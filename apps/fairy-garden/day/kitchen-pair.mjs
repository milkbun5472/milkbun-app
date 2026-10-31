import * as T from 'three';
import {bonePoint,nearHand,headPoint,pairContact} from './pair-pose.mjs?v=fg-90b53e2779ab7a1c';
import {furniturePoint,HOME_PREP,HOME_COOK} from './home-catalog.mjs?v=fg-90b53e2779ab7a1c';
import {makeIngredient} from './ingredient-visual.mjs?v=fg-90b53e2779ab7a1c';
import {disposeFood} from './recipe-food.mjs?v=fg-90b53e2779ab7a1c';
// A short subaction of the original cooking session; feet routes remain Together's owner.
export function createKitchenPair({a,b,kitchen}){
 const actors={a,b},root=new T.Group();root.name='KitchenPairProps';a.root.add(root);let key='',prop=null,diagnostics=null,flour=null;
 function world(o,point,quaternion){a.root.updateWorldMatrix(true,true);o.position.copy(a.root.worldToLocal(point.clone()));o.quaternion.copy(a.root.getWorldQuaternion(new T.Quaternion()).invert());if(quaternion)o.quaternion.multiply(quaternion);}
 function hide(clearFlour=false){if(clearFlour&&flour)flour.visible=false;disposeFood(prop);prop=null;key='';diagnostics=null;root.visible=false;}
 function dust(progress){if(progress?.flour&&!flour){flour=new T.Group();flour.name='KitchenFlourMarks';b.root.getObjectByName('HeadAnchor')?.add(flour);for(let i=0;i<3;i++){const o=new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:'#f4eddc',roughness:1}));o.position.set(.46+i*.075,-.30+(i%2)*.07,.88);o.scale.set(.038,.023,.012);flour.add(o);}}if(flour)flour.visible=!!progress?.flour;}
 function object(names){const source=kitchen()?.tools;let found=null;source?.traverse(o=>{if(!found&&names.includes(o.name))found=o;});return found;}
 const closestArm=(actor,target)=>['left','right'].sort((u,v)=>bonePoint(actor,u+'Arm').distanceTo(target)-bonePoint(actor,v+'Arm').distanceTo(target))[0];
 function point(s,kind,actor){const source=kind==='prep'?(()=>{let flour=null;kitchen()?.tools?.traverse(o=>{if(o.userData.ingredient==='flour')flour=o;});return flour||object(['RecipePreparation']);})():object(['InteractivePan','RecipeFryingPan','RecipeMixingBowl']);
  if(source){const box=new T.Box3().setFromObject(source),center=box.getCenter(new T.Vector3());if(kind==='pan'&&actor){const toward=actor.root.position.clone().sub(center);toward.y=0;toward.normalize().multiplyScalar(Math.min(box.max.x-box.min.x,box.max.z-box.min.z)/2-.02);center.add(toward);}if(kind==='prep'&&actor){center.x=T.MathUtils.clamp(actor.root.position.x,box.min.x+.02,box.max.x-.02);center.z=T.MathUtils.clamp(actor.root.position.z,box.min.z+.02,box.max.z-.02);}center.y=box.max.y+.025;return center;}
  const q=furniturePoint(s.plan.piece,kind==='prep'?{x:HOME_PREP.x,z:HOME_PREP.contactZ}:{x:HOME_COOK.x-.20,z:HOME_COOK.z});return new T.Vector3(q.x,kind==='prep'?HOME_PREP.contactY+.10:HOME_COOK.contactY,q.z);
 }
 function tick(s){const data=kitchen(),job=data?.job,p=data?.progress;dust(p);if(!s.moment){hide();return null;}const m=s.moment,kind=m.kind,K=globalThis.CharDayKitchen;
  if(key!==m.id){hide();key=m.id;root.visible=true;
   if(['pass','bowl'].includes(kind)){prop=new T.Group();const bowl=new T.Mesh(new T.CylinderGeometry(.14,.12,.065,24),new T.MeshStandardMaterial({color:'#ece3c9',roughness:.8}));bowl.position.y=.045;prop.add(bowl);if(kind==='pass'){const item=p.table?.items.find(q=>q.id===m.sourceId),ingredient=item?.ingredient||Object.keys(K.recipeInfo(job.recipeId,job.cooking.variation).need)[0];const food=makeIngredient(item||{id:'passed',ingredient,w:.17,d:.14,h:.10},K.recipe(job.recipeId).method);food.position.y=.075;prop.add(food);m.ingredient=ingredient;}root.add(prop);}
   if(kind==='wipe'){prop=new T.Mesh(new T.BoxGeometry(.085,.075,.014),new T.MeshStandardMaterial({color:'#efe7d1',roughness:1}));root.add(prop);}
  }
  const elapsed=s.elapsed,amount=T.MathUtils.smoothstep(elapsed,.2,2),contacts=[],chef=job.cooking.lead==='me'?'b':'a',other=chef==='a'?'b':'a';
  let satisfied=false;
  if(['pass','bowl'].includes(kind)){
   const giver=actors[chef],receiver=actors[other];const mid=bonePoint(giver,'rightArm').add(bonePoint(receiver,'leftArm')).multiplyScalar(.5);mid.y-=.16;
   const gs=nearHand(giver,mid),rs=nearHand(receiver,mid),v=new T.Vector3(Math.cos(s.plan.heading)*.10,0,-Math.sin(s.plan.heading)*.10);
   pairContact(giver,{[gs]:mid.clone().sub(v)},amount,contacts);pairContact(receiver,{[rs]:mid.clone().add(v)},amount,contacts);
   const from=bonePoint(giver,gs==='left'?'Left_hand':'Right_hand'),to=bonePoint(receiver,rs==='left'?'Left_hand':'Right_hand'),t=T.MathUtils.smoothstep(elapsed,2,3.8),held=from.clone().lerp(to,t);held.y+=.035;world(prop,held);diagnostics={kind,contacts,holder:t>.98?other:chef,sourceId:m.sourceId,handGap:from.distanceTo(to)};satisfied=contacts.every(q=>q.error<.09);
  }else if(kind==='steady'){
   const helper=actors[other],target=point(s,'pan',helper),side=closestArm(helper,target);pairContact(helper,{[side]:target},amount,contacts);diagnostics={kind,contacts,target:target.toArray()};satisfied=contacts.every(q=>q.error<.09);
  }else if(['guide','stir'].includes(kind)){
   const worker=actors[kind==='guide'?other:chef],helper=worker===a?b:a,target=point(s,kind==='guide'?'prep':'pan',helper);target.x+=Math.sin(elapsed*2)*.035;target.z+=Math.cos(elapsed*2)*.035;
   const side=closestArm(worker,target);pairContact(worker,{[side]:target},amount,contacts);const hand=bonePoint(worker,side==='left'?'Left_hand':'Right_hand');const supporting=closestArm(helper,hand);pairContact(helper,{[supporting]:hand.clone().add(new T.Vector3(0,.045,0))},amount,contacts);
   diagnostics={kind,contacts,handGap:bonePoint(helper,supporting==='left'?'Left_hand':'Right_hand').distanceTo(hand),target:target.toArray()};satisfied=contacts.every(q=>q.error<.09);
  }else if(kind==='wipe'){
   const target=headPoint(b,[.62,-.75,.90]);target.y+=Math.sin(elapsed*5)*.018;const side=closestArm(a,target);pairContact(a,{[side]:target},amount,contacts);const held=bonePoint(a,side==='left'?'Left_hand':'Right_hand');world(prop,held,b.root.getObjectByName('HeadAnchor').getWorldQuaternion(new T.Quaternion()));diagnostics={kind,contacts,target:target.toArray(),clothDistance:held.distanceTo(target)};satisfied=contacts.every(q=>q.error<.09);
  }
  const done=elapsed>=K.COOP[kind].seconds&&satisfied;return {done,diagnostics,...(elapsed>12&&!satisfied?{reason:'这个位置还够不到道具，回台面换个位置再试。'}:{})};
 }
 return {operationPoint:point,tick,dust,hide,inspect:()=>diagnostics,dispose(){hide(true);disposeFood(flour);flour=null;root.removeFromParent();}};
}
