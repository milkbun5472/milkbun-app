import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-fb6c3a7df3ec4fb8';
const FLOOR=.08;
// The treadmill's open belt is floor height. Only its actual console and rails block walking.
const furniture=[
 {id:'treadmill-console',kind:'equipment',x:-2.75,z:-3.28,w:1.52,d:.38,h:1.15},
 {id:'treadmill-left',kind:'equipment',x:-3.47,z:-2.13,w:.10,d:2.3,h:.95},
 {id:'treadmill-right',kind:'equipment',x:-2.03,z:-2.13,w:.10,d:2.3,h:.95},
 {id:'weight-rack',kind:'shelf',x:2.25,z:-3.3,w:3.3,d:.65,top:.48,work:{'take-weights':{x:-.08,y:.575,z:.285}}},
 {id:'gym-lockers',kind:'cabinet',x:-4,z:1,w:1.3,d:1.5,top:1.9},
 {id:'water-counter',kind:'counter',x:4,z:.05,w:1.25,d:1.1,top:.72},
 {id:'rest-bench',kind:'bench',x:2.0,z:2.3,w:2.55,d:.64,seat:.45,heading:0,color:'#bfa990'}
];
const seats={rest:roomSeat(furniture,'rest-bench',{x:2,z:3.15})};
export const gymMap={label:'健身房',renderer:'dayGym',radius:10,bounds:{w:10,d:9},floor:FLOOR,spawn:{x:0,z:4},view:{x:0,z:-.15},furniture,obstacles:roomObstacles(furniture,{w:10,d:9}),seats,
 spots:[
  {id:'entrance',label:'走进健身房',description:'从入口沿中央通道走向器械、拉伸区或休息座。',action:'rest',gesture:'rest',target:{x:0,z:3.25},heading:Math.PI,furniture:'Threshold'},
  {id:'storage',label:'柜前整理随身物品',description:'在储物柜前放好随身物品，再走去运动区；柜门朝通道打开。',action:'prepare',gesture:'rest',target:{x:-2.93,z:1},heading:-Math.PI/2,furniture:'gym-lockers'},
  {id:'treadmill',label:'跑步机上慢跑',description:'沿跑带后方走上平齐地面的跑带，站在扶手之间慢跑；停止后从后方下来。',action:'exercise',gesture:'rest',target:{x:-2.75,z:-2.0},heading:Math.PI,furniture:'treadmill-console'},
  {id:'take-weights',label:'哑铃架前取放',description:'站在低架前拿起或放回哑铃，再走到前方空出的训练区。',action:'prepare',gesture:'rest',target:{x:2.25,z:-2.80},heading:Math.PI,furniture:'weight-rack'},
  {id:'weights',label:'哑铃区练习',description:'在哑铃架前方的空地做双手弯举，周围留出摆臂与走动空间。',action:'exercise',gesture:'rest',target:{x:2.25,z:-1.45},heading:0,furniture:'weight-rack'},
  {id:'stretch',label:'软垫上拉伸',description:'站在中央软垫上舒展肩臂、侧身拉伸，不占器械前的通路。',action:'exercise',gesture:'rest',target:{x:0,z:.15},heading:0,furniture:'StretchMat'},
  {id:'water',label:'补水位置',description:'运动后走到饮水台旁，用原小人的杯子喝水。',action:'tea',gesture:'tea',target:{x:2.99,z:.05},heading:Math.PI/2,furniture:'water-counter'},
  {id:'rest',label:'长椅上休息',description:'坐在运动区旁的长椅上休息，起身后沿通道去储物柜或出口。',action:'rest',gesture:'rest',target:seats.rest.approach,heading:0,seat:seats.rest,furniture:'rest-bench'},
  {id:'exit',label:'结束运动离开',description:'收好物品，从南侧入口离开健身房。',action:'rest',gesture:'rest',target:{x:0,z:4},heading:0,furniture:'Threshold'}
 ],tour:['entrance','storage','treadmill','take-weights','weights','stretch','water','rest','exit']};
function dumbbell(kit,parent,x,y,z){
 const g=kit.group('RackDumbbell',{x,y,z},parent);kit.cylinder('bar',{r:.024,h:.28,color:'#a8ada4',rotation:[0,0,Math.PI/2]},g);
 for(const a of [-1,1])kit.cylinder('weight',{x:a*.15,r:.085,h:.09,color:'#798a84',rotation:[0,0,Math.PI/2]},g);
}
export function createGym(){
 const kit=createRoomKit();kit.room({w:10,d:9,floorColor:'#d4d0c0',wallColor:'#eee8d8',accent:'#91ada6'});kit.root.name='DayGym';kit.root.userData.furniture=furniture;
 kit.box('TrainingFloor',{x:.1,y:FLOOR+.005,z:-.4,w:7.9,h:.008,d:5.8,color:'#c0ccc0'});
 kit.box('StretchMat',{x:0,y:FLOOR+.012,z:.15,w:1.65,h:.02,d:2.1,color:'#afc1b5',radius:.06});
 for(const x of [-.66,.66])kit.box('MatStitch',{x,y:FLOOR+.024,z:.15,w:.025,h:.004,d:1.8,color:'#e4e5cf'});
 const belt=kit.group('TreadmillBelt',{x:-2.75,z:-2.12});kit.box('RunningBelt',{y:FLOOR+.007,w:1.27,h:.012,d:2.25,color:'#738b83'},belt);
 for(let i=0;i<7;i++){const stripe=kit.replaceableGroup('BeltStripe:'+i,{y:FLOOR+.016,z:-.94+i*.31},belt);stripe.userData.dayBelt={index:i,length:2.17};kit.box('stripe',{w:.91,h:.006,d:.025,color:'#9aafa3',radius:0},stripe);}
 for(const p of furniture){
  if(p.kind==='bench')kit.bench(p);
  else if(p.id==='weight-rack'){
   const g=kit.group(p.id,{x:p.x,z:p.z});for(const x of [-1.5,1.5])kit.box('RackLeg',{x,y:FLOOR+.31,w:.10,h:.62,d:.53,color:'#94a79a'},g);
   for(const y of [.22,.48]){kit.box('WeightTray',{y:FLOOR+y-.02,w:p.w,h:.04,d:p.d,color:'#b8bcaa'},g);for(let i=0;i<6;i++){const props=kit.replaceableGroup('GymWeights:'+y+':'+i,{},g);props.userData.dayWeights=[2,3].includes(i)&&y===.48;dumbbell(kit,props,[-1.30,-.78,-.12,.12,.78,1.30][i],FLOOR+y+.095,[2,3].includes(i)&&y===.48?.285:0);}}
  }else if(p.id==='gym-lockers'){
   const g=kit.group(p.id,{x:p.x,z:p.z});kit.box('LockerBack',{y:FLOOR+.95,w:p.w,h:1.9,d:p.d,color:'#b8c2ae'},g);
   for(const z of [-.38,.38]){kit.box('LockerPanel',{x:.66,y:FLOOR+.95,z,w:.03,h:1.75,d:.67,color:'#cfceb7'},g);kit.box('LockerHandle',{x:.70,y:FLOOR+1,z:z-.23,w:.04,h:.18,d:.05,color:'#859b8d'},g);}
  }else if(p.kind==='counter'){
   const g=kit.table(p);kit.box('WaterDispenser',{y:FLOOR+p.top+.30,w:.37,h:.6,d:.40,color:'#dce3d2'},g);kit.box('DispenserWindow',{x:-.195,y:FLOOR+p.top+.29,w:.018,h:.28,d:.25,color:'#acc9c8'},g);
   for(let i=0;i<3;i++)kit.cylinder('WaterBottle',{x:.36,y:FLOOR+p.top+.14,z:-.32+i*.27,r:.06,h:.27,color:'#adc8b5'},g);
  }else{
   const g=kit.group(p.id,{x:p.x,z:p.z});
   if(p.id==='treadmill-console'){
    for(const x of [-.57,.57])kit.box('ConsolePost',{x,y:FLOOR+.49,w:.08,h:.98,d:.12,color:'#91a89c'},g);
    kit.box('ConsoleBoard',{y:FLOOR+1.02,w:p.w,h:.26,d:p.d,color:'#a4bbae'},g);kit.box('RunningScreen',{y:FLOOR+1.04,z:.2,w:.65,h:.13,d:.016,color:'#50766d'},g);
   }else{kit.box('RailBase',{y:FLOOR+.035,w:p.w,h:.07,d:p.d,color:'#8ca49a'},g);kit.box('HandRail',{y:FLOOR+.92,w:p.w,h:.065,d:p.d,color:'#a6bdaf'},g);for(const z of [-.88,.88])kit.box('RailPost',{y:FLOOR+.46,z,w:.07,h:.91,d:.08,color:'#8ca49a'},g);}
  }
 }
 kit.sign('GymTitle',{text:'动一动',x:0,y:2.55,z:-4.34,w:2.65,h:.55,color:'#91ada6',ink:'#f5efdc'});
 kit.sign('GymZones',{text:'慢跑 · 力量 · 拉伸',x:0,y:2.04,z:-4.34,w:3.1,h:.24});
 kit.sign('GymWater',{text:'补水休息',x:4.1,y:1.8,z:-.62,w:1.18,h:.27});
 kit.box('GymMirrorFrame',{x:-4.87,y:1.65,z:-2,w:.10,h:1.72,d:2.5,color:'#99b3a8'});kit.box('GymMirror',{x:-4.8,y:1.65,z:-2,w:.015,h:1.52,d:2.29,color:'#b9d1cd'});
 return kit.finish();
}
