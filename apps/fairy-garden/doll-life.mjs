import * as T from 'three';
import {makeDreamFlower} from './keepsake-view.mjs?v=fg-fb6c3a7df3ec4fb8';
import {pointToolAt} from './reach-hand.mjs?v=fg-fb6c3a7df3ec4fb8';
export const actionDuration=job=>job?.kind==='eat'?3.4:job?.kind==='well'?2.8:job?.kind==='lamp'?3.2:job?.kind==='wave'?3.4:job?.kind==='stretch'?3.8:['plant','dreamSow'].includes(job?.kind)?4.2:job?.kind==='gift'?3.2:job?.kind==='garden'||job?.kind==='dreamHarvest'?3.6:job?.kind==='brew'?2.5:job?.kind==='rest'?2:job?.kind==='travel'?.5:1.5;
export function actionGesture(job){if(!job)return 'rest';if(job.kind==='garden')return job.intent==='harvest'?'harvest':'water';if(job.kind==='dreamHarvest')return 'harvest';if(['plant','dreamSow'].includes(job.kind))return 'plant';if(['wave','stretch'].includes(job.kind))return job.kind;if(job.kind==='gather')return 'gather';if(job.kind==='well')return 'draw';if(job.kind==='lamp')return 'lamp';if(job.kind==='seed')return 'hold';if(job.kind==='eat')return 'eat';return 'rest';}
export function makeHeldFlower(){const o=makeDreamFlower();o.scale.setScalar(.36);o.name='HeldMoonFlower';return o;}
export function makeDollLife(root,model,rig,book,syncPose=()=>{}){
 const group=new T.Group();group.name='DailyActionProps';model.add(group);
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.8});const metal=mat('#88a99d'),cream=mat('#ede0c3'),tea=mat('#875b3e');
 function mesh(parent,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
 const can=new T.Group();can.name='WateringCan';group.add(can);mesh(can,new T.CylinderGeometry(.09,.10,.15,16),metal,0,-.055,0);mesh(can,new T.TorusGeometry(.095,.012,6,20),metal,-.075,-.02,0).rotation.y=Math.PI/2;
 const spout=mesh(can,new T.CylinderGeometry(.018,.029,.21,10),metal,0,-.01,.14);spout.rotation.x=Math.PI/2-.28;
 const lip=mesh(can,new T.CylinderGeometry(.037,.022,.032,12),cream,0,.02,.24);lip.rotation.x=Math.PI/2;
 const cup=new T.Group();cup.name='TeaCup';group.add(cup);mesh(cup,new T.CylinderGeometry(.058,.042,.085,18),cream,0,0,0);mesh(cup,new T.CircleGeometry(.046,18),tea,0,.044,0).rotation.x=-Math.PI/2;mesh(cup,new T.TorusGeometry(.033,.008,6,16),cream,.056,0,0);
 const flower=makeHeldFlower();group.add(flower);
 // 取水的桶、做灯的灯罩（她 2026-09-18：这三样原来是「站着不动一根条」）
 const bucket=new T.Group();bucket.name='WellBucket';group.add(bucket);mesh(bucket,new T.CylinderGeometry(.075,.06,.11,14),metal,0,-.03,0);mesh(bucket,new T.TorusGeometry(.07,.008,6,18),cream,0,.04,0).rotation.x=Math.PI/2;const rope=mesh(bucket,new T.CylinderGeometry(.006,.006,.5,6),cream,0,.3,0);
 const lampProp=new T.Group();lampProp.name='StarLamp';group.add(lampProp);mesh(lampProp,new T.ConeGeometry(.11,.08,8),cream,0,.09,0);const bulb=mesh(lampProp,new T.IcosahedronGeometry(.07,1),new T.MeshStandardMaterial({color:'#d6c8f0',emissive:'#d6c8f0',emissiveIntensity:0,roughness:.6}),0,0,0);mesh(lampProp,new T.TorusGeometry(.045,.007,6,14),metal,0,.14,0);
 // 吃东西的那只碗（她 2026-09-18：「搞个吃东西的动作」）：左手托碗，右手一下一下往嘴边送
 const bowl=new T.Group();bowl.name='FoodBowl';group.add(bowl);mesh(bowl,new T.CylinderGeometry(.075,.05,.06,16),cream,0,0,0);mesh(bowl,new T.CircleGeometry(.066,16),tea,0,.031,0).rotation.x=-Math.PI/2;const chop=mesh(bowl,new T.CylinderGeometry(.006,.006,.2,6),mat('#b89661'),.03,.09,0);chop.rotation.z=.4;
 const eatingTool=new T.Group();eatingTool.name='EatingChopsticks';group.add(eatingTool);for(const x of [-.008,.008])mesh(eatingTool,new T.CylinderGeometry(.005,.004,.20,8),cream,x,-.10,0);const bite=mesh(eatingTool,new T.SphereGeometry(.018,8,6),tea,0,-.2,0);eatingTool.visible=false;
 const ladle=new T.Group();ladle.name='CookingLadle';group.add(ladle);mesh(ladle,new T.CylinderGeometry(.009,.009,.22,8),cream,0,-.11,0);mesh(ladle,new T.SphereGeometry(.038,12,8),metal,0,-.24,0).scale.set(1,.35,1);ladle.visible=false;
 const prepKnife=new T.Group();prepKnife.name='PreparationKnife';group.add(prepKnife);mesh(prepKnife,new T.BoxGeometry(.035,.20,.035),cream,0,-.005,0);mesh(prepKnife,new T.BoxGeometry(.055,.13,.012),metal,0,-.14,0);prepKnife.visible=false;
 // Add a visible binding and print to the existing reading prop, shared by all rooms.
 book.name='ReadingBook';mesh(book,new T.BoxGeometry(.012,.005,.21),tea,0,.026,0);for(const x of [-.09,.09])for(let n=0;n<4;n++)mesh(book,new T.BoxGeometry(.09,.001,.002),metal,x,.027,-.065+n*.035);
 const packet=new T.Group();packet.name='SeedPacket';group.add(packet);mesh(packet,new T.BoxGeometry(.11,.14,.045),cream);mesh(packet,new T.SphereGeometry(.028,8,6),metal,0,.01,.03);
 const grains=new T.Group();grains.name='SowingGrains';group.add(grains);const seedMat=mat('#ddbd72');for(let i=0;i<7;i++)mesh(grains,new T.SphereGeometry(.018,6,4),seedMat);

 const drops=new T.Group();drops.name='WaterDrops';group.add(drops);const water=mat('#9ed9e1');for(let i=0;i<16;i++)mesh(drops,new T.SphereGeometry(.009,6,4),water);
 const page=new T.Group();page.name='TurningPage';book.add(page);mesh(page,new T.BoxGeometry(.13,.002,.19),cream,.065,.028,0);
 const legacy=[];model.traverse(o=>{if(o.isMesh&&/^Held.herb/i.test(o.name))legacy.push(o);});
 const hands={};model.traverse(o=>{if(o.isMesh&&/^(Left|Right).hand/i.test(o.name))hands[o.name.startsWith('Left')?'left':'right']=o;});
 const feet=[];model.traverse(o=>{if(o.isMesh&&(/Rounded.boots/i.test(o.name)||o.userData.colorSlot==='boots'))feet.push(o);});
 const box=new T.Box3(),v=new T.Vector3(),tip=new T.Vector3();
 function handPoint(side='right'){syncPose();model.updateWorldMatrix(true,true);return box.setFromObject(hands[side],true).getCenter(new T.Vector3());}
 const arms=Object.fromEntries(rig.map(x=>[x.label,x.p]));
 function atHand(prop,side='right'){prop.position.copy(model.worldToLocal(handPoint(side)));}
 let taskPropsActive=false;
 return {handPoint,updateTask(time,task,pose){
  prepKnife.visible=task?.kind==='prep';eatingTool.visible=task?.kind==='eat';ladle.visible=task?.kind==='cook';
  if(!task){if(taskPropsActive){cup.visible=bowl.visible=book.visible=false;}taskPropsActive=false;chop.visible=true;return;}
  taskPropsActive=true;cup.visible=task.kind==='drink';bowl.visible=task.kind==='eat';book.visible=task.kind==='read';chop.visible=false;
  const right=handPoint(),left=handPoint('left');
  if(prepKnife.visible){const d=pointToolAt(prepKnife,group,right,{...task.contact,y:task.contact.y+(pose?.dy||0)},.21,{scale:false});prepKnife.visible=d>=.12&&d<=.30;if(prepKnife.visible)prepKnife.translateY(.21-d);}
  if(cup.visible){cup.rotation.set(-(pose?.sip||0)*.3,0,0);const grip=new T.Vector3(.056,0,0).applyEuler(cup.rotation);cup.position.copy(model.worldToLocal(right.clone()).sub(grip));}
  if(bowl.visible){bowl.rotation.set(0,0,0);bowl.position.copy(model.worldToLocal(left.clone()));bowl.position.y-=.015;
   const forward=new T.Vector3(0,0,-1).applyQuaternion(model.getWorldQuaternion(new T.Quaternion())),length=.20*model.getWorldScale(new T.Vector3()).z;
   const tip=pose.mouth&&pose.bite>.5?pose.mouth.clone():right.clone().addScaledVector(forward,length);
   const gripToTip=pointToolAt(eatingTool,group,right,tip,.20,{scale:false})||.20;
   // Fixed length sticks slide through the grip as the bite reaches the lips.
   // Scaling the sticks or fixing their tip would penetrate a smaller face.
   for(const stick of eatingTool.children)if(stick!==bite)stick.position.y=.10-gripToTip;
   bite.position.y=-gripToTip;bite.visible=(pose?.bite||0)>.08;
  }
  if(book.visible){book.position.copy(root.worldToLocal(left.clone().add(right).multiplyScalar(.5)));book.position.z+=.025;book.rotation.set(.25,0,0);page.rotation.z=-Math.PI*(pose?.turn||0);page.visible=(task.progress||0)<.76;}
  if(ladle.visible){const contact={...task.contact,x:task.contact.x+(pose?.dx||0),z:task.contact.z+(pose?.dz||0)};
   // During the first hand/stool transition, wait for the palm to reach the pot.
   // A normal ladle never turns into a long pole to bridge the transition.
   ladle.visible=right.distanceTo(new T.Vector3(contact.x,contact.y,contact.z))<=.42;
   if(ladle.visible)pointToolAt(ladle,group,right,contact,.24);
  }
  root.updateWorldMatrix(true,true);
  Object.assign(root.userData.dailyAction,{cup:cup.visible,bowl:bowl.visible,book:book.visible,page:page.rotation.z,ladle:ladle.visible,chopsticks:eatingTool.visible,kind:task.kind,sip:pose?.sip||0,bite:pose?.bite||0,
   rightGrip:right.toArray(),leftGrip:left.toArray(),cupGrip:cup.visible?cup.localToWorld(new T.Vector3(.056,0,0)).toArray():null,cupRim:cup.visible?cup.localToWorld(new T.Vector3(0,.044,.014)).toArray():null,
   mouth:pose?.mouth?.toArray()||null,toolTip:ladle.visible?ladle.localToWorld(new T.Vector3(0,-.24,0)).toArray():eatingTool.visible?bite.getWorldPosition(new T.Vector3()).toArray():null,
   toolGrip:ladle.visible?ladle.getWorldPosition(new T.Vector3()).toArray():eatingTool.visible?eatingTool.getWorldPosition(new T.Vector3()).toArray():null,
   toolLength:ladle.visible?.24*ladle.scale.y*model.getWorldScale(new T.Vector3()).y:eatingTool.visible?.20*model.getWorldScale(new T.Vector3()).y:0});
 },update(time,{gesture='rest',progress=0,moving=false,seated=false,height=.08}={}){
  const active=!moving,drawing=active&&gesture==='draw',lamping=active&&gesture==='lamp',planting=active&&gesture==='plant',waving=active&&gesture==='wave',stretching=active&&gesture==='stretch',watering=active&&gesture==='water',picking=active&&['harvest','gather'].includes(gesture),reading=active&&gesture==='read',drinking=active&&gesture==='tea',eating=active&&gesture==='eat',giving=active&&['give','receive'].includes(gesture);
  legacy.forEach(o=>o.visible=model.userData.outfit==='traveler'&&(!active||gesture==='rest'||gesture==='sit'));
  bucket.visible=drawing;lampProp.visible=lamping;bowl.visible=eating;can.visible=drops.visible=watering;cup.visible=drinking;flower.visible=active&&(gesture==='flower'||gesture==='harvest'&&progress>.55);book.visible=reading;
  packet.visible=planting;grains.visible=planting&&progress>.2&&progress<.65;
  const p=Math.max(0,Math.min(1,progress)),ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const envelope=ease(p/.2)*ease((1-p)/.22);
  if(waving){arms.rightArm.rotation.x=-2.35*envelope;arms.rightArm.rotation.z=(.45+Math.sin(p*Math.PI*10)*.22)*envelope;arms.leftArm.rotation.x=-.12*envelope;model.rotation.z=Math.sin(p*Math.PI*2)*.025*envelope;}
  if(stretching){for(const [name,sign] of [['leftArm',1],['rightArm',-1]]){arms[name].rotation.x=-2.8*envelope;arms[name].rotation.z=-sign*.45*envelope;}model.rotation.x=-.10*envelope;model.rotation.z=Math.sin(p*Math.PI*2)*.055*envelope;}
  if(planting){
   model.rotation.x=.4*envelope;arms.leftLeg.rotation.x=arms.rightLeg.rotation.x=-.9*envelope;
   arms.leftArm.rotation.x=-.8*envelope;arms.rightArm.rotation.x=(-.85+Math.sin(p*Math.PI*8)*.18)*envelope;
   arms.rightArm.rotation.z=Math.sin(p*Math.PI*6)*.22*envelope;
   model.traverse(o=>{const i=o.morphTargetDictionary?.seated;if(i!=null)o.morphTargetInfluences[i]=.35*envelope;});
   // Pin visible soles to the floor while lowering the hips, including morphed bodies and different boots.
   syncPose();model.updateWorldMatrix(true,true);let bottom=Infinity;for(const f of feet)if(f.visible)bottom=Math.min(bottom,box.setFromObject(f,true).min.y);
   if(Number.isFinite(bottom))root.position.y+=height-bottom;
   atHand(packet,'left');packet.rotation.z=-.25;
   if(grains.visible){const from=handPoint();root.updateWorldMatrix(true,false);grains.children.forEach((g,i)=>{const q=Math.max(0,Math.min(1,(p-.2-i*.023)/.28));const end=new T.Vector3((i-3)*.04,height-root.position.y,.46+i*.012);root.localToWorld(end);g.position.copy(group.worldToLocal(from.clone().lerp(end,q)));g.visible=q>0&&q<1;});}
  }
  if(watering){arms.rightArm.rotation.x=-.85;arms.rightArm.rotation.z=-.13;}
  // 拉井绳：两只手一上一下轮着拽，桶跟着右手，绳子在头顶收
  if(drawing){const pull=Math.sin(p*Math.PI*5);arms.rightArm.rotation.x=(-1.6-pull*.55)*envelope;arms.leftArm.rotation.x=(-1.6+pull*.55)*envelope;model.rotation.x=.08*envelope;atHand(bucket);bucket.position.y-=.06;rope.scale.y=Math.max(.05,1-p);rope.position.y=.06+rope.scale.y*.25;}
  // 举灯：两手把灯罩举到眼前，光一点点装进去
  if(lamping){arms.rightArm.rotation.x=arms.leftArm.rotation.x=(-2.1-p*.5)*envelope;arms.rightArm.rotation.z=-.25*envelope;arms.leftArm.rotation.z=.25*envelope;const l=handPoint('left'),r=handPoint();lampProp.position.copy(group.worldToLocal(l.add(r).multiplyScalar(.5)));lampProp.position.y+=.04;lampProp.rotation.y=time*.8;bulb.material.emissiveIntensity=ease(p)*1.4;}
  if(picking){const bend=Math.sin(Math.PI*Math.min(1,progress/.7));model.rotation.x=.32*Math.max(0,bend);root.position.y-=.11*Math.max(0,bend);arms.rightArm.rotation.x=-.45-.55*Math.max(0,bend);}
  if(reading){arms.leftArm.rotation.x=arms.rightArm.rotation.x=-.9;page.visible=true;page.rotation.z=-Math.PI*((time*.18)%1);}
  if(eating){const bite=Math.max(0,Math.sin(time*2.2));arms.leftArm.rotation.x=-1.05;arms.leftArm.rotation.z=.35;arms.rightArm.rotation.x=-1.1-bite*.9;arms.rightArm.rotation.z=-.2;model.rotation.x=.05*bite;}
  if(drinking){const sip=Math.max(0,Math.sin(time*1.1));arms.rightArm.rotation.x=-.9-sip*1.25;arms.rightArm.rotation.z=-sip*.6;}
  if(giving){arms.rightArm.rotation.x=-1.25;arms.leftArm.rotation.x=-.25;}
  // A real hand mesh carries the prop, so height/build morphs affect the grip as well.
  if(can.visible){atHand(can);can.position.y-=.025;can.rotation.x=.3+Math.sin(time*2)*.07;can.rotation.z=0;model.updateWorldMatrix(true,true);tip.set(0,.02,.255);can.localToWorld(tip);group.worldToLocal(tip);drops.children.forEach((d,i)=>{const f=(time*1.7+i/16)%1;d.position.copy(tip).add(v.set(Math.sin(i*2.4)*.025,-f*.52,f*.12));});}
  if(bowl.visible){atHand(bowl,'left');bowl.position.y-=.02;chop.rotation.x=-Math.max(0,Math.sin(time*2.2))*.6;}
  if(cup.visible){atHand(cup);cup.rotation.x=-Math.max(0,Math.sin(time*1.1))*.35;}
  if(flower.visible)atHand(flower);
  if(reading){const l=handPoint('left'),r=handPoint();book.position.copy(root.worldToLocal(l.add(r).multiplyScalar(.5)));book.position.y+=.02;book.position.z+=.065;book.rotation.x=.25;}
  root.userData.dailyAction={gesture,packet:packet.visible,grains:grains.visible,waving,stretching,can:can.visible,drops:drops.visible,flower:flower.visible,cup:cup.visible,bowl:bowl.visible,book:book.visible,page:page.rotation.z,seated};
 }};
}
