import {moodFromCare} from '../../art/pet-house/pet-mood.mjs?v=fg-845d685297c8f9f1';
import {turnPet} from './movement.mjs?v=fg-845d685297c8f9f1';
import {createHomeNavigation,HOME_PLACES} from './home-navigation.mjs?v=fg-845d685297c8f9f1';
export function createPetHome(T,{scene,pet,care,onNotice,onSave,draw}){
 let nav,route=[],pendingTask=null,homeTime=0,reactionTime=0,poseBase=null,food=[];
 const toy=new T.Group(),ball=new T.Mesh(new T.SphereGeometry(.095,16,12),new T.MeshStandardMaterial({color:'#d6a08d',roughness:.85}));
 const mouse=new T.Group(),body=new T.Mesh(new T.SphereGeometry(.10,16,12),new T.MeshStandardMaterial({color:'#bba991',roughness:.9}));body.scale.set(.7,.65,1.6);mouse.add(body);
 for(const x of[-.055,.055]){const ear=new T.Mesh(new T.SphereGeometry(.032,8,8),new T.MeshStandardMaterial({color:'#c98070'}));ear.position.set(x,.06,.07);mouse.add(ear);}const treat=new T.Mesh(new T.SphereGeometry(.05,10,8),new T.MeshStandardMaterial({color:'#a97850',roughness:1}));toy.add(ball,mouse,treat);toy.visible=false;scene.add(toy);
 const local=()=>({x:pet.root.position.x,z:pet.root.position.z});
 function resetPose(){if(!poseBase)return;poseBase.model.position.copy(poseBase.position);poseBase.model.quaternion.copy(poseBase.quaternion);poseBase.model.scale.copy(poseBase.scale);}
 function begin(model){resetPose();nav=createHomeNavigation(pet.root.scale.x);poseBase={model:pet.model,position:pet.model.position.clone(),quaternion:pet.model.quaternion.clone(),scale:pet.model.scale.clone()};const p=nav.restore(care.state.position);pet.root.position.set(p.x,nav.ground(p.x,p.z),p.z);food=[];model.traverse(o=>{if(o.isMesh&&o.name.startsWith('feeding-food-'))food.push(o);});pet.bind({ground:nav.ground,matchSpeed:true});pendingTask=null;route=[];homeTime=0;reactionTime=0;sync();}
 function sync(){for(const mesh of food)mesh.visible=care.state.bowl>0;}
 function schedule(){const t=care.state.task;if(!t){if(pendingTask)route=[];pendingTask=null;toy.visible=false;return;}if(t===pendingTask)return;pendingTask=t;homeTime=0;const dest=HOME_PLACES[t.place]||HOME_PLACES.rug;route=t.phase==='walking'?nav.path(local(),dest)||[]:[];if(t.phase==='walking'&&!route.length){care.cancel();onNotice('暂时走不过去','换个地方再试试。');return;}}
 function request(action,options){if(action==='wake'){resetPose();const p=nav.restore(care.state.position);pet.root.position.set(p.x,nav.ground(p.x,p.z),p.z);pet.bind({ground:nav.ground,matchSpeed:true});}const result=care.request(action,options);if(result.accepted){schedule();sync();onSave();}else if(action==='pet'&&care.state.cooldown>0){const away={x:pet.root.position.x+.3,z:pet.root.position.z+.15};if(nav.walkable(away.x,away.z))route=[away];}if(!result.accepted&&action==='pet'&&care.state.cooldown>0)reactionTime=4;onNotice(result.accepted?(options?.source==='companion'?'它回应'+(options.name||'TA')+'了':'它回应你了'):'它有自己的想法',result.text);draw();return result;}
 function move(dt){let speed=0;if(route.length){const a=route[0],dx=a.x-pet.root.position.x,dz=a.z-pet.root.position.z,d=Math.hypot(dx,dz);speed=.5*pet.root.scale.x;const turn=turnPet(pet.root.rotation.y,Math.atan2(dx,dz),dt);pet.root.rotation.y=turn.heading;const step=turn.canMove?Math.min(d,speed*dt):0;if(!step)speed=0;if(d>.0001){pet.root.position.x+=dx/d*step;pet.root.position.z+=dz/d*step;}if(d<=step+.002)route.shift();}pet.root.position.y=nav.ground(pet.root.position.x,pet.root.position.z);return speed;}
 function tick(dt){resetPose();schedule();homeTime+=dt;reactionTime=Math.max(0,reactionTime-dt);pet.setMood(moodFromCare(care.state,reactionTime>0));const task=care.state.task,before=task;let speed=move(dt);if(task?.phase==='walking'&&!route.length){care.arrive();homeTime=0;if(task.kind==='sleep'){pet.motion.dispose();pet.root.rotation.y=HOME_PLACES[task.place].yaw;}onSave();}
  if(task?.phase==='doing'&&task.kind==='play'){
   toy.visible=true;treat.visible=false;ball.visible=task.toy==='ball';mouse.visible=!ball.visible;
   const phase=task.time*.65,target={x:.7*Math.sin(phase),z:.55+.45*Math.cos(phase)};
   toy.position.set(target.x,.16+.08*Math.abs(Math.sin(task.time*2)),target.z);toy.rotation.y=phase;
   if(!route.length&&Math.hypot(target.x-pet.root.position.x,target.z-pet.root.position.z)>.18)route=nav.path(local(),target)||[];
  }else if(task?.phase==='doing'&&task.kind==='treat'){toy.visible=true;treat.visible=true;ball.visible=false;mouse.visible=false;toy.position.copy(new T.Vector3(0,.4,.3).applyMatrix4(pet.root.matrixWorld));}else toy.visible=false;
  let pivot=false;if(task?.phase==='doing'&&!['sleep','play','pet'].includes(task.kind)){const desired=HOME_PLACES[task.place].yaw+(task.kind==='watch'?.08*Math.sin(task.time*.6):0),turn=turnPet(pet.root.rotation.y,desired,dt);pivot=Math.abs(turn.heading-pet.root.rotation.y)>.001;pet.root.rotation.y=turn.heading;}pet.motion.setActionPose(task?.phase==='doing'&&['eat','treat'].includes(task.kind)?{headPitch:.18+.04*Math.sin(task.time*5)}:{});if(task?.phase==='doing'&&task.kind==='sleep')pet.motion.updateExpression(dt);else pet.motion.update(dt,speed,0,speed>0||route.length>0||pivot);
  if(task?.phase==='doing'){
   if(task.kind==='pet'){pet.root.rotation.y+=Math.sin(task.time*2)*.018;poseBase.model.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),.045*Math.sin(task.time*3)));}
   if(task.kind==='sleep'){
    const blend=Math.min(1,homeTime/1.3),p=HOME_PLACES[task.place];
    if(task.place==='bed'){pet.root.position.x=T.MathUtils.lerp(p.x,-1.89,blend);pet.root.position.z=T.MathUtils.lerp(p.z,-1.64,blend);pet.root.position.y=.11+.25*blend+Math.sin(blend*Math.PI)*.18;}
    poseBase.model.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),blend*1.45));pet.root.updateMatrixWorld(true);const bottom=new T.Box3().setFromObject(poseBase.model).min.y;const floor=task.place==='bed'?.32:nav.ground(pet.root.position.x,pet.root.position.z);pet.root.position.y+=floor-bottom+.003*(1+Math.sin(task.time*1.6));
   }

  }
  // Sleeping is on the cushion; the saved floor position remains its safe approach.
  care.state.position=task?.kind==='sleep'&&task.phase==='doing'?{...HOME_PLACES[task.place]}:local();
  const result=care.tick(dt,{home:true});if(result?.accepted){schedule();onNotice('它自己决定了',result.text);onSave();}if(before&&!care.state.task){resetPose();const p=nav.restore(care.state.position);pet.root.position.set(p.x,nav.ground(p.x,p.z),p.z);route=[];pet.bind({ground:nav.ground,matchSpeed:true});onNotice('在家里过日子','可以看看它，也可以让它自己待一会儿。');onSave();}sync();
 }
 function leave(){resetPose();reactionTime=0;pet.motion?.setActionPose({});care.cancel();toy.visible=false;route=[];pendingTask=null;}
 function dispose(){leave();scene.remove(toy);toy.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});}
 return {begin,request,tick,leave,resetPose,dispose,snapshot:()=>({route:route.map(p=>({...p})),position:local(),toy:toy.visible})};
}
