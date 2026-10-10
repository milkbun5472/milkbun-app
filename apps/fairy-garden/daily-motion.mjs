import * as T from 'three';

const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
export function dailyTaskPose(task){
 const p=task.progress||0;
 if(task.kind==='read')return {left:[-.8,0,.1],right:[-.8,0,-.1],leftElbow:-.6,rightElbow:-.6,tilt:.035,turn:ease((p-.48)/.25),daily:true};
 if(task.kind==='drink')return {left:[-.25,0,0],right:[-.9,0,-.12],rightElbow:-.9,tilt:-.012,sip:ease(p/.19)*ease((.57-p)/.16),daily:true};
 if(task.kind==='eat')return {left:[-.9,0,.1],right:[-.8,0,-.1],leftElbow:-.65,rightElbow:-.8,tilt:.035,bite:ease(p/.22)*ease((.64-p)/.22),daily:true};
 if(task.kind==='cook')return {left:[-.25,0,0],right:[-.65,0,-.1],rightElbow:-.85,tilt:.035,reach:1,dx:Math.sin(task.elapsed*1.8)*.045,dz:Math.cos(task.elapsed*1.8)*.045,dy:Math.sin(task.elapsed*.9)*.009,daily:true};
 return null;
}
// Drink/eat/read contacts follow the morphed head; cooking receives the actual
// moved furniture surface. Both use the original traveler's shared hand solver.
export function dailyHandTargets(model,head,task,pose){
 if(!pose?.daily||!head||task.kind==='cook')return {};
 model.updateWorldMatrix(true,true);
 const point=(x,y,z)=>head.localToWorld(new T.Vector3(x,y,z));
 const front=new T.Vector3(0,0,1).applyQuaternion(model.getWorldQuaternion(new T.Quaternion()));
 const scale=model.getWorldScale(new T.Vector3()),mouth=point(0,-.9,1.08);
 if(task.kind==='read')return {reach:1,leftTarget:point(-.40,-1.65,1.05),target:point(.40,-1.65,1.05+Math.sin(Math.PI*pose.turn)*.16)};
 if(task.kind==='drink'){
  const rimOffset=new T.Vector3(-.056,.044,.014).applyEuler(new T.Euler(-pose.sip*.3,0,0)).multiply(scale).applyQuaternion(model.getWorldQuaternion(new T.Quaternion()));
  return {reach:1,target:point(.56,-1.8,1.1).lerp(mouth.clone().sub(rimOffset),pose.sip),mouth};
 }
 if(task.kind==='eat')return {reach:1,leftTarget:point(-.24,-1.85,1.03),target:point(.38,-1.52,1.18).lerp(mouth.clone().addScaledVector(front,.20*scale.z),pose.bite),mouth};
 return {};
}
