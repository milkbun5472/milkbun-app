// Shared equipment has one geometry and the same contact anchors in every work room.
export function keyboard(kit,parent,{x=0,y=0,z=0,color='#e1e3d7',keys='#aab9ac'}={}){
 kit.box('keyboard',{x,y:y+.025,z,w:.63,h:.04,d:.23,color,radius:.01},parent);
 for(let i=0;i<7;i++)kit.box('keyboard-key',{x:x-.25+i*.083,y:y+.049,z:z+.04,w:.045,h:.008,d:.12,color:keys,radius:.002},parent);
}
export function computer(kit,p){
 const g=kit.group('ComputerItems:'+p.id,{x:p.x,z:p.z}),y=.08+p.top;
 kit.box('MonitorFoot',{y:y+.025,z:-.24,w:.38,h:.05,d:.24,color:'#697c81'},g);
 kit.box('MonitorStem',{y:y+.18,z:-.25,w:.045,h:.30,d:.06,color:'#697c81'},g);
 kit.box('Monitor',{y:y+.43,z:-.25,w:.90,h:.54,d:.075,color:'#526770'},g);
 kit.box('Screen',{y:y+.43,z:-.207,w:.81,h:.45,d:.012,color:'#d3e5e8',radius:.006},g);
 for(let i=0;i<4;i++)kit.box('ScreenRow',{x:-.1,y:y+.55-i*.073,z:-.197,w:.48-i*.07,h:.017,d:.004,color:i===0?'#6f9da7':'#a3b8bf',radius:0},g);
 keyboard(kit,g,{y,z:.40,color:'#e3e9e7',keys:'#90a6af'});
 kit.box('Mouse',{x:.52,y:y+.034,z:.34,w:.10,h:.06,d:.15,color:'#526770'},g);
 return g;
}
export function notebook(kit,p,spot,color='#be975d'){
 const a=p.work[spot],g=kit.group('Notebook:'+p.id,{x:p.x+a.x,y:.08+a.y-.009,z:p.z+a.z});
 kit.box('NotebookCover',{y:-.035,w:.51,h:.025,d:.32,color,radius:.006},g);
 kit.box('NotebookPaper',{y:-.014,w:.47,h:.025,d:.30,color:'#f2eddf',radius:.006},g);
 for(let i=0;i<5;i++)kit.box('NotebookLine',{y:.001,z:-.11+i*.045,w:.36,h:.003,d:.004,color:'#c2c4b7',radius:0},g);
 return g;
}
export function cabinet(kit,p,color='#819ca4',doors=2){
 const g=kit.group(p.id,{x:p.x,z:p.z});
 kit.box('CabinetBody',{y:.08+p.h/2,w:p.w,h:p.h,d:p.d,color},g);
 for(let i=0;i<doors;i++){
  const x=-p.w/2+(i+.5)*p.w/doors,sign=i%2?1:-1;
  const door=kit.hingedDoor('CabinetDoor:'+i,{x,y:.08+p.h/2,z:p.d/2+.02,w:p.w/doors-.055,h:p.h-.08,d:.045,color:i%2?'#c4d1ce':'#b7c7bc',furniture:p.id,sign},g);
  if(doors>2){kit.sign('LockerNumber',{text:String(i+1),x:sign*(p.w/doors-.055)/2,y:.52,z:.025,w:.17,h:.14,color:i%2?'#c4d1ce':'#b7c7bc',ink:'#627c64'},door);}
 }

 return g;
}
export function board(kit,p,{color='#405e58',frame='#b5a480',title='今日课堂',chalk=false}={}){
 const g=kit.group(p.id,{x:p.x,z:p.z});
 kit.box('BoardFrame',{y:1.49,w:p.w,h:1.52,d:p.d,color:frame},g);
 kit.box('BoardFace',{y:1.49,z:p.d/2+.006,w:p.w-.16,h:1.36,d:.02,color,radius:.006},g);
 kit.box('BoardTray',{y:.73,z:.13,w:p.w-.12,h:.055,d:.23,color:frame},g);
 kit.sign('BoardTitle',{text:title,y:1.99,z:p.d/2+.025,w:2.35,h:.24,color,ink:chalk?'#eeeade':'#e5eff2'},g);
 // Each visible stroke is independent after batching, so the hand and board share a task.
 for(let i=0;i<12;i++){
  const a=p.work['blackboard']||p.work['presentation'],s=kit.replaceableGroup('BoardStroke:'+i,{},g);
  s.userData.workStroke=i;s.userData.workKind='paint';
  kit.box('BoardChalkLine',{x:a.x-.12+(i%4)*.07,y:.08+a.y+Math.floor(i/4)*.045,z:p.d/2+.025,w:.06,h:.007,d:.006,color:'#eeeade',radius:0},s);
 }
 return g;
}
