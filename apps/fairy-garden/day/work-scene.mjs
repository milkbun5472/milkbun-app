// The scenery and traveler follow the same task. Reset movable props when work stops.
export function updateWorkScene(root,task,moving,time){
 if(!root)return;
 if(!moving&&['paint','craft'].includes(task?.kind)){root.userData.workProgress||={};root.userData.workProgress[task.kind]=Math.max(root.userData.workProgress[task.kind]||0,task.progress||0);}
 root.traverse(o=>{
  if(o.userData.daySignal){const s=o.userData.daySignal,furniture=Array.isArray(s.furniture)?s.furniture:[s.furniture];o.visible=!moving&&furniture.includes(task?.furniture)&&s.kinds.includes(task?.kind)&&(!s.spot||task?.spot===s.spot);}
  if(o.userData.dayFader){const f=o.userData.dayFader;o.position.z=.32+(!moving&&task?.kind==='console'&&task?.furniture===f.furniture?Math.sin(time*1.2+f.index)*.055:0);}
  if(o.userData.dayLevel){const l=o.userData.dayLevel;o.scale.y=!moving&&['console','voice','sing','stream'].includes(task?.kind)? .25+(Math.sin(time*3+l.index)+1)*.50: .15;}
  if(o.userData.dayCamera){const filming=!moving&&task?.kind==='camera'&&task?.furniture===o.userData.dayCamera;o.rotation.y=filming?Math.sin(time*.7)*.025:0;}
  if(o.userData.dayPass){o.visible=moving||task?.kind!=='serve'||task?.furniture!==o.userData.dayPass;}
  if(o.userData.dayPrinter){const printing=!moving&&task?.furniture===o.userData.dayPrinter&&task?.kind==='select';o.position.x=.40+(printing?Math.min(.22,(task.elapsed||0)*.06):0);o.visible=!printing||(task.progress||0)<.82;}
  if(o.userData.daySupply&&o.name.endsWith(':0'))o.visible=!(task?.carry&&task.carryType==='sample'&&!(task.kind==='tidy'&&task.progress>.8));
  if(o.userData.dayDoor){const door=o.userData.dayDoor,open=!moving&&task?.furniture===door.furniture&&['select','return','tidy','market-pick'].includes(task.kind)?Math.sin(Math.PI*Math.min(.9,task.progress||0))**2:0;o.rotation.y=door.swing*open;}
  if(o.userData.dayWeights)o.visible=!task?.weights;
  if(o.userData.marketProduct)o.visible=!(task?.spot===o.userData.marketProduct&&!moving&&task.kind==='market-pick'&&(task.progress||0)>.38);
  if(o.userData.marketPlaced)o.visible=!moving&&task?.spot===o.userData.marketPlaced&&(o.userData.marketPlaced==='checkout'?(task.progress||0)>.82:(task.progress||0)<.38);
  if(o.userData.dayBelt){const b=o.userData.dayBelt;o.position.z=-b.length/2+((b.index*.31+(!moving&&task?.kind==='treadmill'?time*.8:0))%b.length);}
  if(o.userData.workStroke!=null)o.visible=root.userData.materials!=='none'&&(root.userData.workProgress?.[o.userData.workKind]||0)>o.userData.workStroke/12;
 });
 const sample=root.getObjectByName('ActiveSample');if(sample)sample.visible=!(task?.carry&&task.carryType==='sample'&&['carry','select'].includes(task.kind));
 const train=root.getObjectByName('DayStationTrain');if(train){const present=!moving&&['wait','look-sign','ticket','read','pack','take-luggage','luggage'].includes(task?.kind);train.visible=true;const departure=task?.phase==='exit';train.position.z=departure?Math.min(13,(task.elapsed||0)*2):0;train.userData.phase=departure?'departing':present?'waiting':'hidden';}
 const playing=!moving&&task?.kind==='piano',guitar=root.getObjectByName('AcousticGuitar');
 if(guitar)guitar.visible=moving||task?.kind!=='guitar';
 root.traverse(o=>{if(o.name==='CookingPotLid'){const cooking=!moving&&task?.kind==='cook'&&o.parent.userData.furnitureId===task.furniture;o.position.y=cooking?.12:0;o.position.x=cooking?-.32:0;}});
 const keys=[];root.traverse(g=>{if(g.userData.key!=null){const n=g.userData.key,pressed=playing&&[9,12].includes(n)&&Math.sin(time*5+(n===9?0:Math.PI))>.25;g.rotation.x=pressed?.055:0;if(pressed)keys.push(n);}});
 root.userData.sceneAction={kind:task?.kind||null,beltRunning:!moving&&task?.kind==='treadmill',weightsBorrowed:!!task?.weights,marketPicking:!moving&&task?.kind==='market-pick'?task.spot:null,pressedKeys:keys,printing:!moving&&task?.spot==='print'&&task?.kind==='select',blackboardWriting:!moving&&task?.tool==='chalk',coffeeMaking:!moving&&task?.kind==='barista',mixingAudio:!moving&&task?.kind==='console',recording:!moving&&['voice','sing','stream','camera','act','pose'].includes(task?.kind),guitarBorrowed:!!guitar&&!guitar.visible,doors:(()=>{const list=[];root.traverse(o=>{if(o.userData.dayDoor)list.push({furniture:o.userData.dayDoor.furniture,angle:o.rotation.y});});return list;})(),train:train?{visible:train.visible,phase:train.userData.phase,z:train.position.z}:null};
}
