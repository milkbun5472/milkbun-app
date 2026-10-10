import {createRoomKit,roomObstacles,roomSeat,finishRoom} from './room-kit.mjs?v=fg-0ea83b85ae5ca55e';
import {computer,cabinet} from './work-room-kit.mjs?v=fg-0ea83b85ae5ca55e';
import {cameraRig,microphone} from './media-kit.mjs?v=fg-0ea83b85ae5ca55e';
const FLOOR=.08,SIZE={w:14,d:12};
const furniture=[
 {id:'record-mic',kind:'equipment',x:-4.65,z:-4.26,w:.47,d:.47},
 {id:'booth-divider',kind:'partition',x:-1.90,z:-3.73,w:.14,d:3.89},
 {id:'script-desk',kind:'table',x:-4.40,z:-.88,w:1.85,d:.90,top:.85,color:'#bfad95'},
 {id:'script-chair',kind:'chair',x:-4.40,z:-.17,w:.56,d:.57,heading:Math.PI,color:'#8f9ca7'},
 {id:'mix-desk',kind:'table',x:2.05,z:-3.76,w:2.92,d:1.18,top:.85,color:'#7d93a3',work:{mix:{x:.14,y:.944,z:.32}}},
 {id:'mix-chair',kind:'chair',x:2.05,z:-2.91,w:.56,d:.57,heading:Math.PI,color:'#7c92a3'},
 {id:'gear-locker',kind:'cabinet',x:5.8,z:-4.66,w:1.42,d:.84,h:1.75},
 {id:'stream-desk',kind:'table',x:3.38,z:.48,w:3.1,d:1.03,top:.85,color:'#bea8a0',work:{stream:{x:-.20,y:.91,z:.40}}},
 {id:'stream-chair',kind:'chair',x:3.38,z:1.25,w:.56,d:.57,heading:Math.PI,color:'#a58da3'},
 {id:'break-bench',kind:'bench',x:-3.72,z:3.48,w:2.92,d:.65,seat:.45,heading:0,color:'#99aaa2'},
 {id:'entry-plant',kind:'plant',x:5.55,z:4.32,w:.55,d:.55}
];
const seats={script:roomSeat(furniture,'script-chair',{x:-3.58,z:-.17}),mix:roomSeat(furniture,'mix-chair',{x:2.88,z:-2.91}),stream:roomSeat(furniture,'stream-chair',{x:4.21,z:1.25}),rest:roomSeat(furniture,'break-bench',{x:-3.72,z:2.66})};
const sit=(id,label,description,piece,action='work')=>({id,label,description,action,gesture:action==='read'?'read':'rest',target:seats[id].approach,heading:seats[id].heading,seat:seats[id],furniture:piece});
export const broadcastMap={label:'录音／直播间',renderer:'dayBroadcast',radius:12,bounds:SIZE,floor:FLOOR,spawn:{x:0,z:5.38},view:{x:0,z:0},furniture,seats,obstacles:roomObstacles(furniture,SIZE),spots:[
 {id:'entrance',label:'录制空间入口',description:'从入口进入，走向录音区或直播工位。',action:'rest',gesture:'rest',target:{x:0,z:5.1},heading:Math.PI},
 {id:'gear',label:'器材柜前准备',description:'从器材柜取放耳机、线材和本次录制用品。',action:'work',gesture:'rest',target:{x:5.8,z:-3.82},heading:Math.PI,furniture:'gear-locker'},
 sit('script','录制前读台本','在录音区的小桌读台本、看歌词，准备这一段录制。','script-desk','read'),
 {id:'voice',label:'话筒前配音与试音',description:'站在防喷罩前试音、配音和播读，带有轻微说话手势。',action:'work',gesture:'rest',target:{x:-4.65,z:-3.49},heading:Math.PI,furniture:'record-mic'},
 {id:'sing',label:'话筒前录歌',description:'在同一个录音位演唱，身体与手势随乐句轻轻起伏。',action:'work',gesture:'rest',target:{x:-4.65,z:-3.49},heading:Math.PI,furniture:'record-mic'},
 sit('mix','调音台监听与混音','在实际调音台前推拉控制器，监听、整理当前录音。','mix-desk'),
 sit('stream','镜头前直播','坐在直播桌前面向镜头说话，游戏直播可按日程使用键盘。','stream-desk'),
 {id:'edit',label:'电脑前剪辑素材',description:'在直播电脑工位剪辑、整理本次视频和音频。',action:'work',gesture:'rest',target:seats.stream.approach,heading:seats.stream.heading,seat:seats.stream,furniture:'stream-desk'},
 sit('rest','录制间隙休息','离开话筒或电脑，到入口边的长椅休息。','break-bench','rest'),
 {id:'exit',label:'收好器材离开',description:'整理本次器材，从录制间走回入口。',action:'rest',gesture:'rest',target:{x:0,z:5.38},heading:0}
],tour:['entrance','gear','script','voice','sing','mix','stream','edit','rest','exit']};
export function createBroadcast(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#c9c6bf',wallColor:'#d2d9d6',accent:'#7b899d',joins:false});
 k.box('BoothFloor',{x:-4.33,y:.09,z:-3.38,w:4.71,h:.013,d:4.69,color:'#899998'});k.box('ControlFloor',{x:2.84,y:.09,z:-3.1,w:8.10,h:.013,d:4.71,color:'#a3afbd'});k.box('StreamRug',{x:3.38,y:.09,z:.90,w:5.78,h:.014,d:3.85,color:'#c9b8c5'});
 for(let i=0;i<8;i++)k.box('AcousticPanel',{x:-6.28+i*.55,y:1.68,z:-5.84,w:.44,h:2.35,d:.12,color:i%2?'#7c9391':'#91a6a0'},k.root);
 const divider=k.group('booth-divider',{x:-1.9,z:-3.73});k.box('BoothLowWall',{y:.45,w:.14,h:.75,d:3.89,color:'#829492'},divider);for(let z=-1.81;z<1.85;z+=.30)k.box('AcousticSlat',{y:1.8,z,w:.13,h:1.90,d:.065,color:'#b2b4a0'},divider);k.box('SlatHeader',{y:2.77,w:.14,h:.08,d:3.89,color:'#829492'},divider);
 for(const p of furniture){if(p.kind==='table')k.table(p);else if(p.kind==='chair')k.chair(p);else if(p.kind==='bench')k.bench(p);else if(p.kind==='cabinet')cabinet(k,p,'#7d94a3');else if(p.kind==='plant'){const g=k.plant(p.x,p.z);g.name=p.id;}}
 const mic=furniture.find(p=>p.id==='record-mic'),micRoot=k.group(mic.id,{x:mic.x,z:mic.z});microphone(k,micRoot,{y:1.20,furniture:mic.id});
 const mix=k.root.getObjectByName('mix-desk');k.box('MixConsole',{y:.97,z:.17,w:2.58,h:.075,d:.82,color:'#5c7282'},mix);
 for(let i=0;i<8;i++){const x=-1.02+i*.29;k.box('FaderTrack',{x,y:1.012,z:.33,w:.035,h:.005,d:.30,color:'#9cb0b5',radius:0},mix);const fader=k.replaceableGroup('MixFader:'+i,{x,y:1.024,z:.32},mix);fader.userData.dayFader={furniture:'mix-desk',index:i};k.box('FaderCap',{w:.07,h:.023,d:.055,color:'#d4d8c9'},fader);for(let n=0;n<3;n++)k.cylinder('MixKnob',{x,y:1.028,z:-.04-n*.09,r:.024,h:.034,color:'#a9bab1'},mix);}
 const levels=k.group('MixLevelMeter',{x:2.05,y:1.8,z:-4.16});for(let i=0;i<12;i++){const bar=k.replaceableGroup('Level:'+i,{x:-.85+i*.155},levels);bar.userData.dayLevel={furniture:'mix-desk',index:i};k.box('LevelBar',{y:.15,w:.10,h:.30,d:.018,color:i>8?'#c89e88':'#9ebaa3'},bar);}k.box('MeterFrame',{x:2.05,y:1.86,z:-4.19,w:2.3,h:.69,d:.06,color:'#5e7580'});
 computer(k,furniture.find(p=>p.id==='stream-desk'));
 const stream=k.root.getObjectByName('stream-desk');microphone(k,stream,{x:-.91,y:1.17,z:.25,furniture:'stream-desk',desk:true});
 const camera={id:'stream-camera',x:3.38,z:.15};cameraRig(k,camera,{name:'StreamCamera',small:true,heading:Math.PI,tableY:.94,workFurniture:'stream-desk'});
 const ring=k.group('StreamRingLight',{x:3.38,y:1.77,z:.15});for(let i=0;i<24;i++){const a=i/24*Math.PI*2;k.sphere('RingLightBead',{x:Math.cos(a)*.27,y:Math.sin(a)*.27,r:.027,color:'#eee4ca'},ring);}
 k.book('RecordingScript',{x:-4.4,y:.98,z:-.91,w:.43,d:.52,flat:true,color:'#a8b1bf'});k.sign('RecordDoorSign',{text:'录音中',x:-4.33,y:2.86,z:-5.84,w:1.64,h:.28,color:'#d2d9d6',ink:'#587476'});k.sign('BroadcastWallSign',{text:'试音 · 录制 · 直播',x:3.20,y:2.70,z:-5.84,w:3.12,h:.31,color:'#d2d9d6',ink:'#6b7890'});
 return finishRoom(k,broadcastMap,'DayBroadcast');
}
