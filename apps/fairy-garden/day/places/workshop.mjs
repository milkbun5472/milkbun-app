import {createRoomKit,roomObstacles,finishRoom} from './room-kit.mjs?v=fg-0ea83b85ae5ca55e';
import {computer,notebook} from './work-room-kit.mjs?v=fg-0ea83b85ae5ca55e';
import {furnishRoom,seatedSpot,benchFlask} from './occupation-room-kit.mjs?v=fg-0ea83b85ae5ca55e';
const SIZE={w:14,d:12};
const furniture=[
 {id:'repair-bench',kind:'table',x:-4.4,z:-3.75,w:3.1,d:1.2,top:.85,color:'#ae9672',work:{repair:{x:.0,y:1.012,z:.30},craft:{x:-.64,y:.905,z:.38}}},
 {id:'parts-cabinet',kind:'cabinet',x:-5.95,z:.07,w:1.5,d:.80,h:1.82,color:'#859a96'},
 {id:'diagnose-desk',kind:'table',x:3.63,z:-3.97,w:2.78,d:1.06,top:.85,color:'#aeb5a9',work:{diagnose:{x:0,y:.91,z:.40}}},
 {id:'diagnose-chair',kind:'chair',x:3.63,z:-3.16,w:.56,d:.57,heading:Math.PI,color:'#7e9d9b'},
 {id:'test-bench',kind:'table',x:3.65,z:.20,w:2.85,d:1.17,top:.85,color:'#93a8a2',work:{test:{x:.14,y:.958,z:.40}}},
 {id:'records-desk',kind:'table',x:-3.1,z:2.05,w:2.3,d:1.0,top:.85,color:'#b3a080',work:{records:{x:-.16,y:.905,z:.36}}},
 {id:'records-chair',kind:'chair',x:-3.1,z:2.82,w:.56,d:.57,heading:Math.PI,color:'#92a699'},
 {id:'workshop-bench',kind:'bench',heading:0,x:3.2,z:3.76,w:2.75,d:.65,seat:.45,color:'#9aada3'},
 {id:'tool-rack',kind:'equipment',x:-.8,z:-5.08,w:1.20,d:.40}
];
const spots=[
 {id:'entrance',label:'工坊卷帘门入口',description:'进入维修与制作空间，走向本次工作台。',action:'rest',gesture:'rest',target:{x:0,z:5.1},heading:Math.PI},
 {id:'tools',label:'工具架前准备',description:'查看工具，取放本次使用的器具。',action:'work',gesture:'rest',target:{x:-.8,z:-4.38},heading:Math.PI,furniture:'tool-rack'},
 {id:'parts',label:'零件柜前取放',description:'取用、归还零件与耗材。',action:'work',gesture:'rest',target:{x:-5.95,z:.95},heading:Math.PI,furniture:'parts-cabinet'},
 seatedSpot(furniture,{id:'diagnose',label:'电脑诊断与查图纸',description:'对照设备资料、查看诊断结果。',chair:'diagnose-chair',approach:{x:4.46,z:-3.16},piece:'diagnose-desk'}),
 {id:'repair',label:'台前拆装与检修',description:'短螺丝刀贴住打开的设备，按步骤检修。',action:'work',gesture:'rest',target:{x:-4.4,z:-2.94},heading:Math.PI,furniture:'repair-bench'},
 {id:'craft',label:'工台手工制作',description:'在相邻的材料板上打磨、装配手工件。',action:'work',gesture:'rest',target:{x:-5.04,z:-2.94},heading:Math.PI,furniture:'repair-bench'},
 {id:'test',label:'测试台调试',description:'在真实测试仪面板前操作控制旋钮，核对设备状态。',action:'work',gesture:'rest',target:{x:3.95,z:1.0},heading:Math.PI,furniture:'test-bench'},
 seatedSpot(furniture,{id:'records',label:'记录维修与制作进度',description:'在记录桌写下本次检修、制作的步骤。',chair:'records-chair',approach:{x:-2.27,z:2.82},piece:'records-desk'}),
 seatedSpot(furniture,{id:'rest',label:'工坊间隙休息',description:'离开工具和机器，到门边长椅休息。',chair:'workshop-bench',approach:{x:3.2,z:4.58},piece:'workshop-bench',action:'rest'}),
 seatedSpot(furniture,{id:'water',label:'工坊间隙喝水',description:'暂放工具，到门边长椅喝水。',chair:'workshop-bench',approach:{x:3.2,z:4.58},piece:'workshop-bench',action:'tea'}),
 {id:'exit',label:'收工具离开',description:'收好器具后从工坊门口离开。',action:'rest',gesture:'rest',target:{x:0,z:5.38},heading:0}
];
export const workshopMap={label:'工坊／维修间',renderer:'dayWorkshop',radius:12,bounds:SIZE,floor:.08,spawn:{x:0,z:5.38},view:{x:0,z:0},furniture,seats:Object.fromEntries(spots.filter(s=>s.seat).map(s=>[s.id,s.seat])),obstacles:roomObstacles(furniture,SIZE),spots,tour:spots.map(s=>s.id)};
export function createWorkshop(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#c2c1b5',wallColor:'#d1d4cc',accent:'#7c9590',joins:false});
 for(let i=0;i<6;i++)k.box('ConcreteSeam',{x:-5+i*2,y:.083,w:.012,h:.003,d:12,color:'#b0b4ac',radius:0});
 k.box('GarageLintel',{x:0,y:3,z:-5.79,w:4.4,h:.21,d:.22,color:'#7b9390'});for(let i=0;i<8;i++)k.box('RolledDoorSlat',{x:0,y:2.2+i*.11,z:-5.81,w:4.2,h:.08,d:.07,color:i%2?'#a8b6aa':'#b7c1b1'});
 furnishRoom(k,furniture);computer(k,furniture[2]);notebook(k,furniture[5],'records');
 const repair=k.root.getObjectByName('repair-bench');k.box('RepairMat',{y:.945,z:.1,w:2.6,h:.022,d:.96,color:'#708f8b'},repair);
 const machine=k.replaceableGroup('OpenRepairDevice',{x:0,y:1.01,z:.1},repair);k.box('DeviceBase',{w:.72,h:.13,d:.64,color:'#b8bdb0'},machine);k.box('DeviceCircuit',{y:.072,w:.58,h:.015,d:.49,color:'#729387'},machine);for(let i=0;i<5;i++)k.box('CircuitComponent',{x:-.22+i*.10,y:.089,z:-.05,w:.067,h:.025,d:.13,color:i%2?'#d1be8e':'#5a7576'},machine);k.cylinder('RepairScrew',{y:.076,z:.20,r:.022,h:.012,color:'#c4cbb6'},machine);k.box('DeviceOpenCover',{y:.28,z:-.28,w:.72,h:.4,d:.03,color:'#b8bdb0'},machine);
 const a=furniture[0].work.craft;k.box('CraftBlank',{x:a.x,y:.08+a.y-.017,z:a.z,w:.43,h:.034,d:.29,color:'#c5aa7f'},repair);
 const test=k.root.getObjectByName('test-bench');k.box('TestPanel',{y:.97,z:.20,w:1.5,h:.06,d:.72,color:'#577b7b'},test);for(let i=0;i<4;i++){k.cylinder('TestDial',{x:-.44+i*.29,y:1.018,z:.39,r:.045,h:.033,color:'#d6d8c6'},test);const signal=k.replaceableGroup('TestLamp:'+i,{x:-.42+i*.28,y:1.015,z:.04},test);signal.userData.daySignal={furniture:'test-bench',kinds:['console']};k.sphere('TestLampBulb',{r:.022,color:'#d4b67e'},signal);}
 const rack=k.group('tool-rack',{x:-.8,z:-5.08});k.box('ToolRackFrame',{y:1.23,z:-.15,w:1.2,h:2.15,d:.10,color:'#7b928a'},rack);for(let i=0;i<5;i++){k.box('HangingToolHandle',{x:-.43+i*.21,y:1.7,z:.03,w:.04,h:.29,d:.04,color:'#c5ab7f'},rack);k.box('HangingToolHead',{x:-.43+i*.21,y:1.89,z:.03,w:.14,h:.065,d:.05,color:'#b9c9ba'},rack);}
 for(let x=-.47;x<=.48;x+=.19)for(let y=.35;y<2.2;y+=.23)k.cylinder('PegboardHole',{x,y,z:-.091,r:.012,h:.012,color:'#576f6c',rotation:[Math.PI/2,0,0]},rack);
 k.sign('WorkshopSign',{text:'检修 · 装配 · 调试',x:-4.35,y:2.85,z:-5.83,w:3.6,h:.34,color:'#d1d4cc',ink:'#527b73'});
 benchFlask(k,furniture.find(p=>p.id==='workshop-bench'));
 return finishRoom(k,workshopMap,'DayWorkshop');
}
