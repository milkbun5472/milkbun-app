// Physical key/fader contacts are shared by scenery and the actor's hands.
export const WORK_DESK_HEIGHT=.75;
export function deskWorkSurfaces(furniture,ids){for(const p of furniture.filter(p=>ids.includes(p.id))){const delta=(p.top??.85)-WORK_DESK_HEIGHT;p.top=WORK_DESK_HEIGHT;p.seatedWork=true;for(const anchor of Object.values(p.work||{}))anchor.y-=delta;}return furniture;}
export const KEYBOARD={z:.40,labZ:.41,keyY:.053,keyStart:-.25,keyStep:.083,right:2,left:4};
export const PIANO={right:9,left:12,start:-.86,step:.086,contactZ:.55,contactY:WORK_DESK_HEIGHT+.08};
export const MIXER={right:3,left:4,start:-1.02,step:.29,z:.44,y:WORK_DESK_HEIGHT+.0655,travel:.055};
export function mixerPoint(index,elapsed){return {x:MIXER.start+index*MIXER.step,y:MIXER.y,z:MIXER.z+Math.sin(elapsed*1.2+index)*MIXER.travel};}
export function workControls(task,map,p){
 if(!p)return;
 const point=q=>({x:p.x+q.x,y:map.floor+q.y,z:p.z+q.z});
 if(task.kind==='type'){
  const z=map.renderer==='dayLaboratory'?KEYBOARD.labZ:KEYBOARD.z,y=(p.top??.85)+KEYBOARD.keyY;
  task.contact=point({x:KEYBOARD.keyStart+KEYBOARD.right*KEYBOARD.keyStep,y,z:z+.075});task.target={...task.contact,y:task.contact.y+.045};task.leftTarget=point({x:KEYBOARD.keyStart+KEYBOARD.left*KEYBOARD.keyStep,y:y+.045,z:z+.075});task.workSurface=true;
 }else if(task.kind==='piano'){
  task.contact=point({x:PIANO.start+PIANO.right*PIANO.step,y:PIANO.contactY,z:PIANO.contactZ});task.target={...task.contact,y:task.contact.y+.045};task.leftTarget=point({x:PIANO.start+PIANO.left*PIANO.step,y:PIANO.contactY+.045,z:PIANO.contactZ});task.workSurface=true;
 }else if(task.kind==='console'&&map.renderer==='dayBroadcast'){
  task.contact=point(mixerPoint(MIXER.right,task.elapsed));task.target={...task.contact,y:task.contact.y+.045};task.leftTarget={...point(mixerPoint(MIXER.left,task.elapsed)),y:task.target.y};task.workSurface=true;
 }else if(task.kind==='wash'){
  task.contact=point({x:-.12,y:.876,z:.53});task.target={...task.contact,y:task.contact.y+.045};task.leftTarget=point({x:.12,y:.921,z:.53});task.workSurface=true;
 }
}
