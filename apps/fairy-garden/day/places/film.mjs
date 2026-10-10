import * as T from 'three';
import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-dfbc36ab1020098c';
import {computer} from './work-room-kit.mjs?v=fg-dfbc36ab1020098c';
import {cameraRig,softbox} from './media-kit.mjs?v=fg-dfbc36ab1020098c';
const FLOOR=.08,SIZE={w:16,d:12};
const furniture=[
 {id:'film-backdrop',kind:'panel',x:-3.64,z:-5.24,w:7.45,d:.45},
 {id:'film-camera',kind:'equipment',x:-3.73,z:.31,w:.88,d:.85,work:{camera:{x:-.20,y:1.16,z:.42}}},
 {id:'key-light',kind:'equipment',x:-6.9,z:-2.28,w:.64,d:.64},
 {id:'fill-light',kind:'equipment',x:.37,z:-2.28,w:.64,d:.64},
 {id:'vanity',kind:'table',x:4.68,z:-3.9,w:2.5,d:1.06,top:.85,color:'#d4b8a1'},
 {id:'vanity-chair',kind:'chair',x:4.68,z:-3.12,w:.56,d:.57,heading:Math.PI,color:'#bca0a1'},
 {id:'script-table',kind:'table',x:4.68,z:-.90,w:2.0,d:.90,top:.85,color:'#d4b8a1'},
 {id:'script-chair',kind:'chair',x:4.68,z:-.19,w:.56,d:.57,heading:Math.PI,color:'#bca0a1'},
 {id:'costume-rail',kind:'shelf',x:6.60,z:2.12,w:.78,d:1.82,h:1.8},
 {id:'monitor-desk',kind:'table',x:-.03,z:2.63,w:2.25,d:1.04,top:.85,color:'#929ca3'},
 {id:'monitor-chair',kind:'chair',x:-.03,z:3.41,w:.56,d:.57,heading:Math.PI,color:'#778e9b'},
 {id:'wait-bench',kind:'bench',x:4.12,z:4.35,w:2.83,d:.65,seat:.45,heading:0,color:'#bba2a1'}
];
const seats={makeup:roomSeat(furniture,'vanity-chair',{x:3.86,z:-3.12}),script:roomSeat(furniture,'script-chair',{x:3.86,z:-.19}),review:roomSeat(furniture,'monitor-chair',{x:.79,z:3.41}),rest:roomSeat(furniture,'wait-bench',{x:4.12,z:3.53})};
const sit=(id,label,description,piece,action='work')=>({id,label,description,action,gesture:action==='read'?'read':'rest',target:seats[id].approach,heading:seats[id].heading,seat:seats[id],furniture:piece});
export const filmMap={label:'拍摄棚／妆造区',renderer:'dayFilm',radius:13,bounds:SIZE,floor:FLOOR,spawn:{x:0,z:5.38},view:{x:0,z:0},furniture,seats,obstacles:roomObstacles(furniture,SIZE),spots:[
 {id:'entrance',label:'拍摄棚入口',description:'经过候场区，走向当天拍摄需要的位置。',action:'rest',gesture:'rest',target:{x:0,z:5.1},heading:Math.PI},
 sit('makeup','镜前整理妆容','坐在亮灯妆镜前，用短化妆刷整理脸侧妆容。','vanity'),
 sit('script','候场读台本','在候场小桌坐下翻阅台本，保持演员的准备活动。','script-table','read'),
 {id:'costume',label:'服装架前准备',description:'在挂衣架前取放、整理拍摄服装。',action:'work',gesture:'rest',target:{x:5.74,z:2.12},heading:Math.PI/2,furniture:'costume-rail'},
 {id:'perform',label:'布景前表演与试镜',description:'站在布景前面向摄影机表演，带有说话时的手势与停顿。',action:'work',gesture:'rest',target:{x:-3.70,z:-2.78},heading:0,furniture:'film-backdrop'},
 {id:'pose',label:'定点棚拍姿态',description:'在摄影机前调整站姿、侧身与手的位置，适合模特棚拍。',action:'work',gesture:'rest',target:{x:-2.43,z:-2.78},heading:-.18,furniture:'film-backdrop'},
 {id:'camera',label:'摄影机后掌镜',description:'站在摄影机后，握住真实机身侧柄、调整拍摄方向。',action:'work',gesture:'rest',target:{x:-3.86,z:.97},heading:Math.PI,furniture:'film-camera'},
 {id:'lighting',label:'灯架边检查布光',description:'在补光灯旁调整和检查布光。',action:'work',gesture:'rest',target:{x:1.18,z:-2.28},heading:-Math.PI/2,furniture:'fill-light'},
 sit('review','监视器前回看素材','在监视器工位回看、整理当天素材。','monitor-desk'),
 sit('rest','候场长椅休息','在妆造区外的长椅等候、短暂休息。','wait-bench','rest'),
 {id:'exit',label:'收工离开拍摄棚',description:'收好台本和器材，沿开放通道离开棚内。',action:'rest',gesture:'rest',target:{x:0,z:5.38},heading:0}
],tour:['entrance','makeup','script','costume','perform','pose','camera','lighting','review','rest','exit']};
function backdrop(k){
 const p=furniture[0],g=k.group(p.id,{x:p.x,z:p.z});
 const shape=new T.Shape();shape.moveTo(-.21,.08);shape.lineTo(-.21,3.12);shape.lineTo(.10,3.12);shape.lineTo(.10,.65);shape.quadraticCurveTo(.10,.10,.22,.10);shape.lineTo(.225,.08);shape.closePath();
 const mesh=k.profile('CycloramaCurve',{shape,depth:p.w,color:'#c5c5ba',bevel:0},g);mesh.rotation.y=Math.PI/2;
 k.box('BackdropFloor',{y:.09,z:2.68,w:p.w,h:.014,d:4.93,color:'#c5c5ba'},g);
 for(const x of [-2.37,2.37])k.cylinder('BackdropSupport',{x,y:1.72,z:-.12,r:.035,h:3.24,color:'#82928f'},g);
 const tape=k.group('ActorFloorMarks',{x:-.06,z:2.46},g);for(const x of [-.09,.09])k.box('FloorMark',{x,y:.10,w:.026,h:.003,d:.32,color:'#a17a65',heading:x<0?.65:-.65,radius:0},tape);
}
export function createFilm(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#b4bab6',wallColor:'#bbc2c0',accent:'#6d8489',joins:false});
 k.box('MakeupFloor',{x:4.5,y:.09,z:-2.35,w:5.93,h:.013,d:6.6,color:'#d9bfa8'});for(let i=0;i<9;i++)k.box('MakeupFloorSeam',{x:1.72+i*.69,y:.101,z:-2.35,w:.012,h:.003,d:6.58,color:'#c3a88f',radius:0});backdrop(k);
 for(const p of furniture){if(p.kind==='table')k.table(p);else if(p.kind==='chair')k.chair(p);else if(p.kind==='bench')k.bench(p);}
 cameraRig(k,furniture.find(p=>p.id==='film-camera'));softbox(k,furniture.find(p=>p.id==='key-light'),{heading:Math.PI/2});softbox(k,furniture.find(p=>p.id==='fill-light'),{heading:-Math.PI/2,color:'#dbe4dc'});
 const vanity=k.root.getObjectByName('vanity');k.box('MirrorFrame',{y:1.72,z:-.29,w:1.8,h:1.23,d:.10,color:'#927d76'},vanity);k.box('VanityMirror',{y:1.72,z:-.231,w:1.64,h:1.07,d:.012,color:'#c9d6d6'},vanity);for(const x of [-.95,.95])for(let i=0;i<5;i++)k.sphere('VanityBulb',{x,y:1.19+i*.25,z:-.18,r:.048,color:'#f2dfb7'},vanity);
 for(const x of [-.80,-.62,.63,.80])k.cylinder('CosmeticBottle',{x,y:1.06,z:.20,r:.055,h:.23,color:x<0?'#c1a2a1':'#a6bbb0'},vanity);k.cylinder('PowderCompact',{x:.40,y:.96,z:.24,r:.11,h:.035,color:'#bc958a'},vanity);
 const rail=furniture.find(p=>p.id==='costume-rail'),g=k.group(rail.id,{x:rail.x,z:rail.z});for(const z of [-.75,.75]){k.cylinder('ClothesStand',{y:.95,z,r:.035,h:1.74,color:'#7c9195'},g);k.box('ClothesFoot',{y:.12,z,w:.70,h:.05,d:.16,color:'#7c9195'},g);}k.tube('ClothesRail',{points:[[0,1.80,-.75],[0,1.80,.75]],r:.03,color:'#7c9195'},g);
 for(let i=0;i<5;i++){const z=-.60+i*.30;k.tube('Hanger',{points:[[0,1.79,z],[-.28,1.56,z],[.28,1.56,z],[0,1.79,z]],r:.018,color:'#d5c29e'},g);k.box('HangingCostume',{y:1.11,z,w:.57,h:.79,d:.10,color:['#a1b7b5','#c0a9a7','#c9ba9a','#7e999b','#b1bdab'][i]},g);}
 computer(k,furniture.find(p=>p.id==='monitor-desk'));k.book('ShootScript',{x:4.68,y:.98,z:-.86,w:.43,d:.52,flat:true,color:'#a4b4b1'});
 k.sign('ShootBoard',{text:'拍摄 · 候场 · 收工',x:4.70,y:2.70,z:-5.85,w:2.9,h:.32,color:'#bbc2c0',ink:'#516b72'});
 k.root.userData.furniture=furniture.map(p=>({...p}));for(const p of furniture){const g=k.root.getObjectByName(p.id);if(g)g.userData.furnitureId=p.id;}
 const result=k.finish();result.root.name='DayFilm';return result;
}
