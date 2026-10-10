import * as T from 'three';

// Optional work gestures share the original traveler's rig and real hand anchors.
export function taskPose(task,time){
  if(!task)return null;
  const kind=task.kind,p=Math.max(0,Math.min(1,task.progress||0)),pulse=Math.sin(time*5);
  if(kind==='read')return null;
  if(kind==='carry')return {left:[-.18,0,0],right:[-.8,0,-.12],rightElbow:0,tilt:0};
  if(kind==='select'||kind==='return'||kind==='tidy')return {left:[-.8,0,.12],right:[-.5,0,-.12],rightElbow:-.8,tilt:.025,reach:Math.sin(Math.PI*p)**2};
  if(kind==='write')return {left:[-.65,0,.1],right:[-.6,0,-.1],rightElbow:-.8,tilt:.045,reach:1,dx:pulse*.028,dz:Math.cos(time*3)*.017};
  if(kind==='type')return {left:[-.9,0,.08],right:[-.6,0,-.12],rightElbow:-.75,tilt:.025,reach:1,dx:pulse*.045,dy:Math.max(0,pulse)*.014};
  if(kind==='experiment')return {left:[-.6,0,.12],right:[-.55,0,-.12],rightElbow:-.8,tilt:.025,reach:1,dy:Math.max(0,Math.sin(time*1.4))*.028};
  if(kind==='observe')return {left:[-.2,0,0],right:[-.4,0,-.08],rightElbow:-.55,tilt:.08,reach:.8,dx:Math.sin(time)*.025};
  return null;
}
export function makeTaskProps(root,model,handPoint){
  const group=new T.Group();group.name='WorkActionProps';model.add(group);
  const cream=new T.MeshStandardMaterial({color:'#eee7d5',roughness:.9}),green=new T.MeshStandardMaterial({color:'#819f91',roughness:.85}),wood=new T.MeshStandardMaterial({color:'#b59a6d',roughness:.85});
  const mesh=(parent,geo,mat,x=0,y=0,z=0)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;};
  const step=mesh(root,new T.BoxGeometry(.48,1,.50),wood);step.name='WorkFootrest';
  const pen=new T.Group();pen.name='WorkPencil';group.add(pen);mesh(pen,new T.CylinderGeometry(.012,.012,.19,8),wood,0,-.085,0);mesh(pen,new T.ConeGeometry(.012,.03,8),green,0,-.195,0).rotation.z=Math.PI;
  const pipette=new T.Group();pipette.name='WorkPipette';group.add(pipette);mesh(pipette,new T.CylinderGeometry(.022,.016,.15,10),cream,0,-.055,0);mesh(pipette,new T.CylinderGeometry(.008,.006,.1,8),green,0,-.18,0);mesh(pipette,new T.CylinderGeometry(.025,.025,.025,10),green,0,.03,0);
  const book=new T.Group();book.name='CarriedWorkBook';group.add(book);mesh(book,new T.BoxGeometry(.26,.07,.32),cream);for(const y of [-.043,.043])mesh(book,new T.BoxGeometry(.28,.014,.34),green,0,y,0);
  const place=(o,side)=>{o.position.copy(group.worldToLocal(handPoint(side)));o.rotation.set(0,0,0);};
  return {update(task,moving=false){
    step.visible=!moving&&(task?.rise||0)>.001;if(step.visible){step.scale.y=task.rise;step.position.set(0,task.floor-root.position.y+task.rise/2,0);}
    pen.visible=!moving&&task?.kind==='write';pipette.visible=!moving&&task?.kind==='experiment';
    book.visible=!!task?.carry&&['carry','select','return'].includes(task.kind)&&!(task.kind==='return'&&task.progress>.8);
    const aim=(tool,length)=>{place(tool,'right');if(task.contact){const point=group.worldToLocal(new T.Vector3(task.contact.x,task.contact.y,task.contact.z)),to=point.sub(tool.position);tool.quaternion.setFromUnitVectors(new T.Vector3(0,-1,0),to.clone().normalize());tool.scale.y=to.length()/length;}};
    if(pen.visible)aim(pen,.21);
    if(pipette.visible)aim(pipette,.23);
    if(book.visible){place(book,'right');book.position.y-=.035;book.position.z+=.07;book.rotation.x=.12;}
    root.userData.workAction={kind:task?.kind||null,carry:book.visible,pen:pen.visible,pipette:pipette.visible,rise:task?.rise||0,cushion:step.visible&&!!task.seated,target:task?.target||null};
  }};
}
