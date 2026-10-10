import {createRoomKit,roomObstacles,finishRoom} from './room-kit.mjs?v=fg-f9a3c901abadb37b';
import {notebook} from './work-room-kit.mjs?v=fg-f9a3c901abadb37b';
import {furnishRoom,seatedSpot,benchFlask} from './occupation-room-kit.mjs?v=fg-f9a3c901abadb37b';
const SIZE={w:16,d:14};
const furniture=[
 {id:'gear-lockers',kind:'cabinet',x:-6.1,z:-5.2,w:2.7,d:.85,h:1.85,color:'#7f8f74',doors:4},
 {id:'map-table',kind:'table',x:-4.65,z:-1.72,w:2.8,d:1.22,top:.85,color:'#a1a98a',work:{briefing:{x:.16,y:.905,z:.35}}},
 {id:'duty-table',kind:'table',x:5.65,z:4.15,w:2.4,d:1.05,top:.85,color:'#a7ac8e',work:{duty:{x:-.15,y:.905,z:.34}}},
 {id:'duty-chair',kind:'chair',x:5.65,z:4.93,w:.56,d:.57,heading:Math.PI,color:'#80957e'},
 {id:'training-bench',kind:'bench',heading:0,x:-4.55,z:4.25,w:3.4,d:.65,seat:.45,color:'#8e9d7e'},
 {id:'obstacle-box',kind:'equipment',x:4.65,z:-2.05,w:2.0,d:.75},
 {id:'stretch-station',kind:'equipment',x:.7,z:-3.65,w:3.1,d:1.35,walkable:true},
 {id:'report-station',kind:'equipment',x:.3,z:.6,w:1.4,d:1.0,walkable:true},
 {id:'tree-west',kind:'tree',x:-6.5,z:2.2,w:.38,d:.38},
 {id:'tree-north',kind:'tree',x:7,z:-6.3,w:.38,d:.38},
 {id:'patrol-a',kind:'equipment',x:6.45,z:-5.12,w:.45,d:.45},
 {id:'patrol-b',kind:'equipment',x:6.48,z:.25,w:.45,d:.45}
];
const spots=[
 {id:'entrance',label:'训练基地入口',description:'进入基地，按日程走向集合或值勤地点。',action:'rest',gesture:'rest',target:{x:0,z:6.1},heading:Math.PI},
 {id:'gear',label:'装备柜前准备',description:'取放个人训练用品，整理装备。',action:'work',gesture:'rest',target:{x:-6.1,z:-4.22},heading:Math.PI,furniture:'gear-lockers'},
 {id:'briefing',label:'沙盘图前听取简报',description:'站在实际地图桌前听取任务安排或说明路线。',action:'work',gesture:'rest',target:{x:-4.65,z:-.71},heading:Math.PI,furniture:'map-table'},
 {id:'report',label:'集合与敬礼',description:'在集合线上立正，抬手到额侧敬礼，再自然放下。',action:'work',gesture:'rest',target:{x:.3,z:.6},heading:Math.PI,furniture:'report-station'},
 {id:'stretch',label:'训练前热身',description:'在平齐地面的软垫上活动肩臂、拉伸热身。',action:'work',gesture:'rest',target:{x:.7,z:-3.65},heading:Math.PI,furniture:'stretch-station'},
 {id:'run',label:'操场体能训练',description:'在跑道训练位交替摆臂与抬腿，按日程穿插热身和停歇。',action:'work',gesture:'rest',target:{x:3.6,z:1.45},heading:Math.PI},
 {id:'patrol',label:'北侧巡查点',description:'值勤巡查沿北侧、东侧两个真实点位轮流走动。',action:'work',gesture:'rest',target:{x:5.72,z:-5.12},heading:Math.PI/2,furniture:'patrol-a'},
 {id:'checkpoint',label:'东侧巡查点',description:'走到东侧巡查点，停下查看周围。',action:'work',gesture:'rest',target:{x:5.74,z:.25},heading:Math.PI/2,furniture:'patrol-b'},
 seatedSpot(furniture,{id:'duty',label:'岗亭登记与交接',description:'坐在岗亭桌前记录值勤情况，整理交接事项。',chair:'duty-chair',approach:{x:6.48,z:4.93},piece:'duty-table'}),
 seatedSpot(furniture,{id:'rest',label:'训练间隙休息',description:'在树荫边的训练长椅休息。',chair:'training-bench',approach:{x:-4.55,z:5.08},piece:'training-bench',action:'rest'}),
 seatedSpot(furniture,{id:'water',label:'训练后补水',description:'在训练长椅边拿杯补水，仍留在基地。',chair:'training-bench',approach:{x:-4.55,z:5.08},piece:'training-bench',action:'tea'}),
 {id:'exit',label:'归还用品离开',description:'整理用品后从基地入口离开。',action:'rest',gesture:'rest',target:{x:0,z:6.38},heading:0}
];
export const trainingMap={label:'训练基地',renderer:'dayTraining',radius:14,bounds:SIZE,floor:.08,spawn:{x:0,z:6.38},view:{x:0,z:0},furniture,seats:Object.fromEntries(spots.filter(s=>s.seat).map(s=>[s.id,s.seat])),obstacles:roomObstacles(furniture.filter(p=>!p.walkable),SIZE),spots,tour:spots.map(s=>s.id)};
export function createTraining(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#b6c0a1',wallColor:'#c7cfb3',accent:'#809475',joins:false});
 // The enclosure is a low compound wall, not another furnished interior.
 for(const id of ['BackWall','LeftWall']){const wall=k.root.getObjectByName(id);wall.scale.y=.28;wall.position.y=.46;}
 k.box('DrillLane',{x:3.7,y:.091,z:.65,w:4.6,h:.012,d:9.8,color:'#c3ab8d'});for(const x of [1.57,3.7,5.83])k.box('LaneStripe',{x,y:.1,z:.65,w:.025,h:.004,d:9.45,color:'#ece5cf',radius:0});
 for(let i=0;i<3;i++)k.box('AssemblyLine',{x:.3,y:.10,z:.06+i*.5,w:1.4,h:.004,d:.022,color:'#eee7d4',radius:0});
 furnishRoom(k,furniture);notebook(k,furniture.find(p=>p.id==='duty-table'),'duty');
 const map=k.root.getObjectByName('map-table');k.box('RouteMap',{y:.947,w:2.2,h:.02,d:.87,color:'#e1dfc2'},map);for(let i=0;i<6;i++)k.box('MapRoute',{x:-.78+i*.3,y:.959,z:Math.sin(i)*.18,w:.29,h:.005,d:.025,color:'#879f92',heading:.35*i,radius:0},map);
 const mat=k.group('stretch-station',{x:.7,z:-3.65});k.box('TrainingMat',{y:.095,w:3.1,h:.026,d:1.35,color:'#789786'},mat);
 k.group('report-station',{x:.3,z:.6});const hurdle=k.group('obstacle-box',{x:4.65,z:-2.05});k.box('HurdleTop',{y:.68,w:2,h:.10,d:.75,color:'#899879'},hurdle);for(const x of [-.8,.8])k.box('HurdleLeg',{x,y:.38,w:.12,h:.6,d:.60,color:'#a39d80'},hurdle);
 for(const p of furniture.filter(p=>p.id.startsWith('patrol-'))){const g=k.group(p.id,{x:p.x,z:p.z});k.cylinder('CheckpointPost',{y:.63,r:.075,h:1.1,color:'#7c8b79'},g);k.box('CheckpointCap',{y:1.23,w:.45,h:.15,d:.45,color:'#afac8c'},g);}
 for(const p of furniture.filter(p=>p.kind==='tree')){const tree=k.group(p.id,{x:p.x,z:p.z});k.cylinder('TreeTrunk',{y:1.55,r:.13,h:2.9,color:'#95856b'},tree);k.ellipsoid('TreeCrown',{y:3.3,w:1.8,h:1.8,d:1.6,color:'#8ea284'},tree);}
 // Canopies are overhead; their feet fit inside the existing furniture footprints.
 for(const [p,h]of [[furniture[0],2.35],[furniture[2],2.30]]){const g=k.root.getObjectByName(p.id);for(const x of [-p.w/2+.08,p.w/2-.08])k.box('CanopyPost',{x,y:h/2,z:-p.d/2+.08,w:.08,h,d:.08,color:'#8d927a'},g);k.box('CanopyRoof',{y:h,w:p.w,h:.10,d:p.d,color:'#9eae91'},g);}
 k.sign('BaseWall',{text:'集合 · 训练 · 值勤',x:-2,y:1.04,z:-6.84,w:3.9,h:.31,color:'#c7cfb3',ink:'#5e755d'});
 benchFlask(k,furniture.find(p=>p.id==='training-bench'));
 return finishRoom(k,trainingMap,'DayTraining');
}
