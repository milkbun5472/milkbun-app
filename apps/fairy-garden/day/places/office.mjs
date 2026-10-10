import * as T from 'three';
import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-87e36a9d89c69f3f';
import {computer,notebook,cabinet,board} from './work-room-kit.mjs?v=fg-87e36a9d89c69f3f';
const FLOOR=.08,SIZE={w:14,d:11};
const furniture=[
 {id:'window-workstation',kind:'table',x:-4.6,z:-3.1,w:2.05,d:1.05,top:.85,color:'#d0c0a4'},
 {id:'window-chair',kind:'chair',x:-4.6,z:-2.34,w:.56,d:.57,heading:Math.PI,color:'#738e9b'},
 {id:'notes-desk',kind:'table',x:-1.95,z:-3.1,w:2.05,d:1.05,top:.85,color:'#d0c0a4',work:{notes:{x:.12,y:.904,z:.40}}},
 {id:'notes-chair',kind:'chair',x:-1.95,z:-2.34,w:.56,d:.57,heading:Math.PI,color:'#738e9b'},
 {id:'meeting-table',kind:'table',x:3.6,z:-2.95,w:4.3,d:1.45,top:.85,color:'#8ca5af',work:{'meeting-notes':{x:.78,y:.904,z:.68}}},
 {id:'meeting-chair',kind:'chair',x:2.78,z:-1.98,w:.56,d:.57,heading:Math.PI,color:'#79929d'},
 {id:'meeting-notes-chair',kind:'chair',x:4.38,z:-1.98,w:.56,d:.57,heading:Math.PI,color:'#79929d'},
 {id:'presentation-screen',kind:'panel',x:3.60,z:-5.26,w:3.90,d:.16,work:{presentation:{x:-.76,y:1.06,z:.105}}},
 {id:'meeting-glass',kind:'partition',x:.34,z:-3.14,w:.11,d:4.05},
 {id:'files',kind:'cabinet',x:-5.95,z:-4.53,w:.72,d:1.2,h:1.65},
 {id:'printer-cabinet',kind:'cabinet',x:-5.92,z:.3,w:.90,d:1.15,h:.66,work:{print:{x:.45,y:.93,z:.1}}},
 {id:'pantry-counter',kind:'counter',x:4.92,z:1.70,w:2.2,d:.85,top:.85},
 {id:'tea-table',kind:'table',x:2.35,z:1.78,w:1.7,d:.85,top:.85,color:'#d0c0a4'},
 {id:'tea-chair',kind:'chair',x:2.35,z:2.49,w:.56,d:.57,heading:Math.PI,color:'#bead8f'},
 {id:'break-bench',kind:'bench',x:-1.70,z:3.55,w:2.15,d:.65,seat:.45,heading:0,color:'#819d98'},
 {id:'office-plant',kind:'plant',x:5.92,z:3.67,w:.55,d:.55},
 {id:'entry-plant',kind:'plant',x:-5.9,z:3.64,w:.55,d:.55}
];
const seats={computer:roomSeat(furniture,'window-chair',{x:-3.77,z:-2.34}),notes:roomSeat(furniture,'notes-chair',{x:-1.13,z:-2.34}),meeting:roomSeat(furniture,'meeting-chair',{x:1.96,z:-1.98}),meetingNotes:roomSeat(furniture,'meeting-notes-chair',{x:5.20,z:-1.98}),tea:roomSeat(furniture,'tea-chair',{x:1.53,z:2.49}),rest:roomSeat(furniture,'break-bench',{x:-1.70,z:2.73})};
const sit=(id,label,description,key,piece,action='work')=>({id,label,description,action,gesture:action==='tea'?'tea':'rest',target:seats[key].approach,heading:seats[key].heading,seat:seats[key],furniture:piece});
export const officeMap={label:'办公室／会议室',renderer:'dayOffice',radius:12,bounds:SIZE,floor:FLOOR,spawn:{x:0,z:4.87},view:{x:0,z:0},furniture,seats,obstacles:roomObstacles(furniture,SIZE),spots:[
 {id:'entrance',label:'办公区入口',description:'从入口穿过通道，走向工位或会议区。',action:'rest',gesture:'rest',target:{x:0,z:4.6},heading:Math.PI},
 sit('computer','窗边电脑工位','在真实电脑与键盘前处理邮件、表格和报告。','computer','window-workstation'),
 sit('notes','整理文件与写记录','在纸本工作台整理资料、落笔记下待办。','notes','notes-desk'),
 sit('meeting','会议席听讨论','坐在玻璃会议区，面向投影听讨论，稍作回应。','meeting','meeting-table'),
 sit('meeting-notes','会议记录席','坐在会议桌另一侧，记录会上正在讨论的内容。','meetingNotes','meeting-table'),
 {id:'presentation',label:'投影前汇报',description:'站在投影旁面向会议桌，指示图表、讲解汇报。',action:'work',gesture:'rest',target:{x:2.38,z:-4.58},heading:.28,furniture:'presentation-screen'},
 {id:'files',label:'资料柜取文件',description:'打开资料柜，取出并整理工作文件。',action:'work',gesture:'rest',target:{x:-5.16,z:-4.53},heading:-Math.PI/2,furniture:'files'},
 {id:'print',label:'打印与收文件',description:'在打印机前操作面板，取走输出的纸张。',action:'work',gesture:'rest',target:{x:-5.05,z:.3},heading:-Math.PI/2,furniture:'printer-cabinet'},
 sit('tea','茶水角喝口水','坐在茶水小桌前喝水，工作间隙可以暂歇。','tea','tea-table','tea'),
 sit('rest','入口休息长椅','在入口边的长椅暂歇，再回到当前工作。','rest','break-bench','rest'),
 {id:'exit',label:'收工离开',description:'收好工作资料，沿中央通道离开办公室。',action:'rest',gesture:'rest',target:{x:0,z:4.87},heading:0}
],tour:['entrance','computer','notes','print','files','meeting','meeting-notes','presentation','tea','rest','exit']};
function windows(kit){
 const g=kit.group('OfficeRibbonWindows',{x:-3.45,y:2.12,z:-5.36});
 kit.box('RibbonWindowFrame',{w:5.85,h:1.64,d:.12,color:'#718b95'},g);
 kit.box('RibbonWindowSky',{z:.075,w:5.65,h:1.44,d:.018,color:'#b9d6de'},g);
 for(let i=0;i<8;i++)kit.box('CitySilhouette',{x:-2.42+i*.69,y:-.38+(i%3)*.045,z:.086,w:.47,h:.52+(i%3)*.09,d:.008,color:['#91b0bd','#a6c1c9','#9cbbc3'][i%3],radius:0},g);
 for(const x of [-1.9,-.65,.65,1.9])kit.box('WindowMullion',{x,z:.11,w:.045,h:1.48,d:.04,color:'#ecede6',radius:0},g);
 kit.box('RibbonWindowSill',{y:-.85,z:.12,w:5.96,h:.08,d:.27,color:'#d0c0a4'},g);
}
function glass(kit,p){
 const g=kit.group(p.id,{x:p.x,z:p.z});g.userData.furnitureId=p.id;
 const m=new T.MeshStandardMaterial({color:'#c4dbe0',transparent:true,opacity:.20,roughness:.25,depthWrite:false});
 const pane=new T.Mesh(new T.BoxGeometry(p.w,2.35,p.d),m);pane.position.y=FLOOR+1.175;g.add(pane);
 for(const z of [-p.d/2,0,p.d/2])kit.box('GlassMullion',{y:FLOOR+1.2,z,w:.09,h:2.40,d:.075,color:'#69858f',radius:0},g);
 kit.box('GlassBase',{y:FLOOR+.055,w:.14,h:.11,d:p.d,color:'#69858f'},g);
 kit.box('GlassHeader',{y:FLOOR+2.4,w:.09,h:.055,d:p.d,color:'#69858f'},g);
 // Frosted band makes the partition legible without covering people behind it.
 kit.box('GlassFrostedBand',{y:1.13,w:.115,h:.14,d:p.d-.03,color:'#c0d2d1',radius:0},g);
}
export function createOffice(){
 const kit=createRoomKit();kit.room({...SIZE,floorColor:'#c7d1d0',wallColor:'#e2e7e4',accent:'#6f8c97'});
 kit.box('MeetingFloor',{x:3.6,y:FLOOR+.008,z:-2.93,w:6.12,h:.013,d:4.54,color:'#8dabb1',radius:.03});
 kit.box('WorkAreaFloor',{x:-3.2,y:FLOOR+.009,z:-2.58,w:6.23,h:.014,d:3.79,color:'#d8cdb9',radius:.025});
 for(let i=0;i<6;i++)kit.box('WorkFloorSeam',{x:-6.13+i*1.03,y:FLOOR+.018,z:-2.58,w:.014,h:.003,d:3.75,color:'#c0b59f',radius:0});
 windows(kit);
 for(const p of furniture){
  if(p.kind==='table')kit.table(p);
  else if(p.kind==='chair')kit.chair(p);
  else if(p.kind==='bench')kit.bench(p);
  else if(p.kind==='plant'){const g=kit.plant(p.x,p.z);g.name=p.id;}
  else if(p.kind==='partition')glass(kit,p);
  else if(p.kind==='cabinet')cabinet(kit,p);
  else if(p.kind==='panel')board(kit,p,{title:'项目进度',color:'#526f80',frame:'#849da7'});
  else if(p.kind==='counter'){
   const g=kit.group(p.id,{x:p.x,z:p.z});kit.box('PantryBody',{y:FLOOR+.39,w:p.w-.1,h:.78,d:p.d-.03,color:'#789793'},g);kit.box('PantryTop',{y:FLOOR+p.top-.04,w:p.w,h:.08,d:p.d,color:'#e4e5d8'},g);
   const machine=kit.replaceableGroup('OfficeCoffeeMachine',{x:.42,y:FLOOR+p.top,z:-.02},g);kit.box('Machine',{y:.21,w:.40,h:.42,d:.42,color:'#5c747d'},machine);kit.box('MachinePanel',{y:.28,z:.22,w:.22,h:.12,d:.018,color:'#b4d3d3'},machine);kit.cylinder('MachineCup',{y:.066,z:.21,r:.05,h:.12,color:'#e9e6d9'},machine);
   kit.cylinder('WaterFlask',{x:-.64,y:FLOOR+p.top+.15,z:0,r:.095,h:.30,color:'#a1b8b6'},g);
  }
 }
 const desk=furniture.find(p=>p.id==='window-workstation');computer(kit,desk);
 notebook(kit,furniture.find(p=>p.id==='notes-desk'),'notes');notebook(kit,furniture.find(p=>p.id==='meeting-table'),'meeting-notes','#889d9d');
 const screen=kit.root.getObjectByName('presentation-screen');
 for(let i=0;i<5;i++)kit.box('ProjectedBar',{x:-.64+i*.29,y:1.20+i*.09,z:.11,w:.18,h:.22+i*.18,d:.01,color:['#dce8dc','#adcfd0','#c0d7c3','#e1c791','#c0d4df'][i],radius:0},screen);
 const printer=kit.replaceableGroup('OfficePrinter',{x:-5.92,y:FLOOR+.66,z:.3});
 kit.box('PrinterBody',{y:.16,w:.72,h:.32,d:.67,color:'#e1e8e4'},printer);kit.box('PrinterLid',{y:.335,w:.77,h:.06,d:.69,color:'#81969e'},printer);kit.box('PrinterPanel',{x:.365,y:.28,z:.10,w:.025,h:.095,d:.22,color:'#8cadb5'},printer);kit.box('PrinterSlot',{x:.375,y:.11,w:.025,h:.08,d:.43,color:'#5c7580'},printer);
 const paper=kit.replaceableGroup('PrinterOutput',{x:.40,y:.1,z:0},printer);paper.userData.dayPrinter='printer-cabinet';kit.box('PrintedPaper',{x:.10,w:.22,h:.009,d:.32,color:'#f4f1e7',radius:.002},paper);for(let i=0;i<4;i++)kit.box('PrintedLine',{x:.12,y:.006,z:-.10+i*.045,w:.13,h:.003,d:.004,color:'#8fa6a3',radius:0},paper);
 kit.sign('MeetingDoorSign',{text:'会议室',x:.405,y:1.72,z:-.96,w:1.0,h:.26,heading:Math.PI/2,color:'#dce5e3',ink:'#48616b'});
 kit.sign('OfficeEntrySign',{text:'工作与生活之间',x:-6.88,y:1.98,z:1.50,w:1.90,h:.33,heading:Math.PI/2,color:'#e2e7e4',ink:'#657f87'});
 kit.root.userData.furniture=furniture.map(p=>({...p}));
 for(const p of furniture){const g=kit.root.getObjectByName(p.id);if(g)g.userData.furnitureId=p.id;}
 const result=kit.finish();result.root.name='DayOffice';return result;
}
