import * as T from 'three';
import {makeDreamFlower} from './keepsake-view.mjs?v=fg-8310313b47ad0de4';
export const actionDuration=job=>job?.kind==='gift'?3.2:job?.kind==='garden'||job?.kind==='dreamHarvest'?3.6:job?.kind==='brew'?2.5:job?.kind==='rest'?2:job?.kind==='travel'?.5:1.5;
export function actionGesture(job){if(!job)return 'rest';if(job.kind==='garden')return job.intent==='harvest'?'harvest':'water';if(job.kind==='dreamHarvest')return 'harvest';if(job.kind==='dreamSow'||job.kind==='gather')return 'gather';return 'rest';}
export function makeHeldFlower(){const o=makeDreamFlower();o.scale.setScalar(.36);o.name='HeldMoonFlower';return o;}
export function makeDollLife(root,model,rig,book){
 const group=new T.Group();group.name='DailyActionProps';model.add(group);
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.8});const metal=mat('#88a99d'),cream=mat('#ede0c3'),tea=mat('#875b3e');
 function mesh(parent,g,m,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;}
 const can=new T.Group();can.name='WateringCan';group.add(can);mesh(can,new T.CylinderGeometry(.09,.10,.15,16),metal,0,-.055,0);mesh(can,new T.TorusGeometry(.095,.012,6,20),metal,-.075,-.02,0).rotation.y=Math.PI/2;
 const spout=mesh(can,new T.CylinderGeometry(.018,.029,.21,10),metal,0,-.01,.14);spout.rotation.x=Math.PI/2-.28;
 const lip=mesh(can,new T.CylinderGeometry(.037,.022,.032,12),cream,0,.02,.24);lip.rotation.x=Math.PI/2;
 const cup=new T.Group();cup.name='TeaCup';group.add(cup);mesh(cup,new T.CylinderGeometry(.058,.042,.085,18),cream,0,0,0);mesh(cup,new T.CircleGeometry(.046,18),tea,0,.044,0).rotation.x=-Math.PI/2;mesh(cup,new T.TorusGeometry(.033,.008,6,16),cream,.056,0,0);
 const flower=makeHeldFlower();group.add(flower);
 const drops=new T.Group();drops.name='WaterDrops';group.add(drops);const water=mat('#9ed9e1');for(let i=0;i<16;i++)mesh(drops,new T.SphereGeometry(.009,6,4),water);
 const page=new T.Group();page.name='TurningPage';book.add(page);mesh(page,new T.BoxGeometry(.13,.002,.19),cream,.065,.028,0);
 const legacy=[];model.traverse(o=>{if(o.isMesh&&/^Held.herb/i.test(o.name))legacy.push(o);});
 const hands={};model.traverse(o=>{if(o.isMesh&&/^(Left|Right).hand/i.test(o.name))hands[o.name.startsWith('Left')?'left':'right']=o;});
 const box=new T.Box3(),v=new T.Vector3(),tip=new T.Vector3();
 function handPoint(side='right'){model.updateWorldMatrix(true,true);return box.setFromObject(hands[side],true).getCenter(new T.Vector3());}
 const arms=Object.fromEntries(rig.map(x=>[x.label,x.p]));
 function atHand(prop,side='right'){prop.position.copy(model.worldToLocal(handPoint(side)));}
 return {handPoint,update(time,{gesture='rest',progress=0,moving=false,seated=false}={}){
  const active=!moving,watering=active&&gesture==='water',picking=active&&['harvest','gather'].includes(gesture),reading=active&&gesture==='read',drinking=active&&gesture==='tea',giving=active&&['give','receive'].includes(gesture);
  legacy.forEach(o=>o.visible=model.userData.outfit==='traveler'&&(!active||gesture==='rest'||gesture==='sit'));
  can.visible=drops.visible=watering;cup.visible=drinking;flower.visible=active&&(gesture==='flower'||gesture==='harvest'&&progress>.55);book.visible=reading;
  if(watering){arms.rightArm.rotation.x=-.85;arms.rightArm.rotation.z=-.13;}
  if(picking){const bend=Math.sin(Math.PI*Math.min(1,progress/.7));model.rotation.x=.32*Math.max(0,bend);root.position.y-=.11*Math.max(0,bend);arms.rightArm.rotation.x=-.45-.55*Math.max(0,bend);}
  if(reading){arms.leftArm.rotation.x=arms.rightArm.rotation.x=-.7;page.rotation.z=-Math.PI*((time*.18)%1);}
  if(drinking){const sip=Math.max(0,Math.sin(time*1.1));arms.rightArm.rotation.x=-.9-sip*1.25;arms.rightArm.rotation.z=-sip*.6;}
  if(giving){arms.rightArm.rotation.x=-1.25;arms.leftArm.rotation.x=-.25;}
  // A real hand mesh carries the prop, so height/build morphs affect the grip as well.
  if(can.visible){atHand(can);can.position.y-=.025;can.rotation.x=.3+Math.sin(time*2)*.07;can.rotation.z=0;model.updateWorldMatrix(true,true);tip.set(0,.02,.255);can.localToWorld(tip);group.worldToLocal(tip);drops.children.forEach((d,i)=>{const f=(time*1.7+i/16)%1;d.position.copy(tip).add(v.set(Math.sin(i*2.4)*.025,-f*.52,f*.12));});}
  if(cup.visible){atHand(cup);cup.rotation.x=-Math.max(0,Math.sin(time*1.1))*.35;}
  if(flower.visible)atHand(flower);
  if(reading){const l=handPoint('left'),r=handPoint();book.position.copy(root.worldToLocal(l.add(r).multiplyScalar(.5)));book.position.y+=.02;book.rotation.x=.25;}
  root.userData.dailyAction={gesture,can:can.visible,drops:drops.visible,flower:flower.visible,cup:cup.visible,book:book.visible,page:page.rotation.z,seated};
 }};
}
