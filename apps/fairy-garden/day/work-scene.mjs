// The scenery and traveler follow the same task. Reset movable props when work stops.
export function updateWorkScene(root,task,moving,time){
 if(!root)return;
 if(!moving&&['paint','craft','write'].includes(task?.kind))root.userData.workProgress=Math.max(root.userData.workProgress||0,task.progress||0);
 root.traverse(o=>{
  if(o.userData.daySupply&&o.name.endsWith(':0'))o.visible=!(task?.carry&&task.carryType==='sample'&&!(task.kind==='tidy'&&task.progress>.8));
  if(o.userData.dayDoor){const door=o.userData.dayDoor,open=!moving&&task?.furniture===door.furniture&&['select','return','tidy'].includes(task.kind)?Math.sin(Math.PI*Math.min(.9,task.progress||0))**2:0;o.rotation.y=door.swing*open;}
  if(o.userData.workStroke!=null)o.visible=(root.userData.workProgress||0)>o.userData.workStroke/12;
 });
 const sample=root.getObjectByName('ActiveSample');if(sample)sample.visible=!(task?.carry&&task.carryType==='sample'&&['carry','select'].includes(task.kind));
 const train=root.getObjectByName('DayStationTrain');if(train){const present=!moving&&['wait','look-sign','ticket','read','pack','take-luggage','luggage'].includes(task?.kind);train.visible=true;const departure=task?.phase==='exit';train.position.z=departure?Math.min(13,(task.elapsed||0)*2):0;train.userData.phase=departure?'departing':present?'waiting':'hidden';}
 const playing=!moving&&task?.kind==='piano',guitar=root.getObjectByName('AcousticGuitar');
 if(guitar)guitar.visible=moving||task?.kind!=='guitar';
 root.traverse(o=>{if(o.name==='CookingPotLid'){const cooking=!moving&&task?.kind==='cook'&&o.parent.userData.furnitureId===task.furniture;o.position.y=cooking?.12:0;o.position.x=cooking?-.32:0;}});
 const keys=[];root.traverse(g=>{if(g.userData.key!=null){const n=g.userData.key,pressed=playing&&[9,12].includes(n)&&Math.sin(time*5+(n===9?0:Math.PI))>.25;g.rotation.x=pressed?.055:0;if(pressed)keys.push(n);}});
 root.userData.sceneAction={kind:task?.kind||null,pressedKeys:keys,guitarBorrowed:!!guitar&&!guitar.visible,doors:(()=>{const list=[];root.traverse(o=>{if(o.userData.dayDoor)list.push({furniture:o.userData.dayDoor.furniture,angle:o.rotation.y});});return list;})(),train:train?{visible:train.visible,phase:train.userData.phase,z:train.position.z}:null};
}
