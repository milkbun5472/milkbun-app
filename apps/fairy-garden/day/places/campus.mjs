import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-dfbc36ab1020098c';
import {notebook,cabinet,board} from './work-room-kit.mjs?v=fg-dfbc36ab1020098c';
const FLOOR=.08,SIZE={w:14,d:12};
const furniture=[
 {id:'class-blackboard',kind:'panel',x:-3.45,z:-5.61,w:4.80,d:.15,work:{blackboard:{x:.08,y:1.07,z:.10}}},
 {id:'lectern',kind:'table',x:.17,z:-4.76,w:1.3,d:.84,top:.85,color:'#b89a65',work:{prepare:{x:.12,y:.904,z:.32}}},
 {id:'student-desk',kind:'table',x:-4.35,z:-2.65,w:1.58,d:.90,top:.85,color:'#c7aa78',work:{notes:{x:.12,y:.904,z:.40}}},
 {id:'student-chair',kind:'chair',x:-4.35,z:-1.94,w:.56,d:.57,heading:Math.PI,color:'#b09668'},
 {id:'second-desk',kind:'table',x:-1.65,z:-2.65,w:1.58,d:.90,top:.85,color:'#c7aa78'},
 {id:'second-chair',kind:'chair',x:-1.65,z:-1.94,w:.56,d:.57,heading:Math.PI,color:'#b09668'},
 {id:'study-desk',kind:'table',x:-4.35,z:-.07,w:1.58,d:.90,top:.85,color:'#c7aa78',work:{study:{x:.12,y:.904,z:.40}}},
 {id:'study-chair',kind:'chair',x:-4.35,z:.64,w:.56,d:.57,heading:Math.PI,color:'#b09668'},
 {id:'empty-desk',kind:'table',x:-1.65,z:-.07,w:1.58,d:.90,top:.85,color:'#c7aa78'},
 {id:'empty-chair',kind:'chair',x:-1.65,z:.64,w:.56,d:.57,heading:Math.PI,color:'#b09668'},
 {id:'classroom-divider',kind:'partition',x:1.32,z:-3.4,w:.13,d:4.15},
 {id:'school-lockers',kind:'cabinet',x:4.65,z:-5.12,w:3.1,d:.63,h:1.65},
 {id:'courtyard-planter',kind:'planter',x:-3.26,z:3.62,w:2.3,d:1.75},
 {id:'courtyard-bench',kind:'bench',x:-3.25,z:2.24,w:2.8,d:.64,seat:.45,heading:Math.PI,color:'#92a68a'},
 {id:'lunch-table',kind:'table',x:4.43,z:1.50,w:2.5,d:1.10,top:.85,color:'#cfb782'},
 {id:'lunch-chair',kind:'chair',x:4.43,z:2.26,w:.56,d:.57,heading:Math.PI,color:'#99ac88'},
 {id:'school-tree',kind:'plant',x:4.85,z:4.35,w:.70,d:.70}
];
const seats={listen:roomSeat(furniture,'second-chair',{x:-.84,z:-1.94}),notes:roomSeat(furniture,'student-chair',{x:-3.54,z:-1.94}),study:roomSeat(furniture,'study-chair',{x:-3.54,z:.64}),rest:roomSeat(furniture,'courtyard-bench',{x:-3.25,z:1.4}),meal:roomSeat(furniture,'lunch-chair',{x:3.62,z:2.26})};
const sit=(id,label,description,key,piece,action='work')=>({id,label,description,action,gesture:action==='meal'?'eat':'rest',target:seats[key].approach,heading:seats[key].heading,seat:seats[key],furniture:piece});
export const campusMap={label:'教室／校园',renderer:'dayCampus',radius:12,bounds:SIZE,floor:FLOOR,spawn:{x:0,z:5.4},view:{x:0,z:0},furniture,seats,obstacles:roomObstacles(furniture,SIZE),spots:[
 {id:'entrance',label:'校园入口',description:'从课间庭院进入，沿走廊去教室。',action:'rest',gesture:'rest',target:{x:0,z:5.15},heading:Math.PI},
 sit('listen','课桌前听课','坐在课桌前面向黑板听讲，不会变成老师的授课动作。','listen','second-desk'),
 sit('notes','听课记笔记','坐在自己的课桌前，跟随课堂整理纸本笔记。','notes','student-desk'),
 sit('study','课后自习与做题','在后排单人课桌做题、复习、准备考试。','study','study-desk'),
 {id:'blackboard',label:'黑板前板书',description:'站在黑板前，用粉笔在实际板面写下讲解内容。',action:'work',gesture:'rest',target:{x:-3.49,z:-5.22},heading:Math.PI,furniture:'class-blackboard'},
 {id:'teach',label:'讲台旁授课',description:'面向课桌讲解课程、回应问题，动作与听课分开。',action:'work',gesture:'rest',target:{x:-1.10,z:-4.55},heading:0,furniture:'lectern'},
 {id:'prepare',label:'讲台整理教案',description:'在讲台前翻阅并记录教案，准备当前课程的资料。',action:'work',gesture:'rest',target:{x:.17,z:-4.04},heading:Math.PI,furniture:'lectern'},
 {id:'lockers',label:'走廊整理书包',description:'走到走廊柜前，取出和收好课本。',action:'read',gesture:'rest',target:{x:4.65,z:-4.40},heading:Math.PI,furniture:'school-lockers'},
 {id:'corridor',label:'走廊课间停步',description:'在教室外的走廊稍作停留，面向庭院放松。',action:'rest',gesture:'rest',target:{x:3.15,z:-.55},heading:0},
 sit('rest','庭院课间长椅','在树荫庭院坐一会儿，随后回到原来课堂。','rest','courtyard-bench','rest'),
 sit('meal','校园午餐桌','坐在校园餐桌用餐，仍属于原来的午餐日程。','meal','lunch-table','meal'),
 {id:'exit',label:'下课离开校园',description:'沿走廊经过庭院，收拾书包后离开校园。',action:'rest',gesture:'rest',target:{x:0,z:5.4},heading:0}
],tour:['entrance','lockers','listen','notes','study','blackboard','teach','prepare','corridor','rest','meal','exit']};
function classroomDetails(kit){
 kit.box('ClassroomWoodFloor',{x:-2.83,y:FLOOR+.007,z:-2.67,w:7.96,h:.012,d:5.96,color:'#dbc394',radius:.01});
 for(let i=0;i<11;i++)kit.box('ClassroomFloorSeam',{x:-6.64+i*.73,y:FLOOR+.015,z:-2.67,w:.010,h:.003,d:5.9,color:'#bba87f',radius:0});
 kit.box('CoveredCorridorFloor',{x:3.9,y:FLOOR+.006,z:-2.16,w:4.84,h:.011,d:6.91,color:'#d6dbc6',radius:.01});
 for(let z=-5.3;z<1.3;z+=.7)kit.box('CorridorTileJoint',{x:3.92,y:FLOOR+.013,z,w:4.78,h:.003,d:.012,color:'#bdc9b4',radius:0});
 const divider=kit.group('classroom-divider',{x:1.32,z:-3.4});
 kit.box('ClassroomLowWall',{y:.53,w:.13,h:.90,d:4.15,color:'#a8bda4'},divider);
 for(const z of [-2.03,0,2.03])kit.box('SchoolWindowPost',{y:1.73,z,w:.12,h:2.55,d:.12,color:'#7c9a88'},divider);
 for(const y of [1.04,2.65])kit.box('SchoolWindowRail',{y,w:.15,h:.10,d:4.15,color:'#7c9a88'},divider);
 kit.box('WindowOpenSill',{y:1.08,w:.32,h:.08,d:4.2,color:'#d4d5bf'},divider);
 // Front half is an open courtyard, with a canopy silhouette rather than a furnished room.
 kit.box('CourtyardGrass',{x:-2.81,y:FLOOR+.008,z:3.41,w:7.82,h:.013,d:3.75,color:'#b9c8a2',radius:.025});
 kit.box('CourtyardPath',{x:.15,y:FLOOR+.017,z:3.56,w:1.25,h:.01,d:3.3,color:'#e4dcc2',radius:.035});
 for(let i=0;i<6;i++)kit.box('CourtyardSteppingStone',{x:.15+(i%2)*.035,y:FLOOR+.026,z:2.24+i*.48,w:1.04,h:.009,d:.35,color:'#c9c3aa',radius:.045});
 kit.sign('SchoolClassroomSign',{text:'课堂与课间',x:-6.87,y:2.36,z:-2.7,w:2.30,h:.34,heading:Math.PI/2,color:'#e9e5d3',ink:'#577562'});
 kit.sign('CampusNotice',{text:'今日课程',x:3.1,y:2.24,z:-5.86,w:1.05,h:.65,color:'#eee9d7',ink:'#64816f'});
 const clock=kit.group('ClassroomClock',{x:.21,y:2.41,z:-5.83});
 kit.cylinder('ClockFace',{r:.22,h:.055,color:'#ece5ce',rotation:[Math.PI/2,0,0]},clock);for(const [name,length]of [['HomeClockHour',.10],['HomeClockMinute',.16]]){const hand=kit.replaceableGroup(name,{},clock);kit.tube('ClockHand',{points:[[0,-.02,.04],[0,length,.04]],r:.011,color:'#69826e'},hand);}
}
export function createCampus(){
 const kit=createRoomKit();kit.room({...SIZE,floorColor:'#e6dcc2',wallColor:'#ede5ce',accent:'#849e7a'});classroomDetails(kit);
 for(const p of furniture){
  if(p.kind==='table')kit.table(p);else if(p.kind==='chair')kit.chair(p);else if(p.kind==='bench')kit.bench(p);
  else if(p.kind==='panel')board(kit,p,{title:'把问题留给好奇心',chalk:true});
  else if(p.kind==='cabinet'){
   cabinet(kit,p,'#9bab83',6);
  }else if(p.kind==='planter'){
   const g=kit.group(p.id,{x:p.x,z:p.z});kit.box('RaisedPlanter',{y:FLOOR+.21,w:p.w,h:.42,d:p.d,color:'#b3b891'},g);kit.box('PlanterSoil',{y:FLOOR+.43,w:p.w-.16,h:.015,d:p.d-.16,color:'#8f9173'},g);
   kit.cylinder('CourtyardTreeTrunk',{y:1.02,r:.11,h:1.5,color:'#a49572'},g);for(const [x,y,z,w,h,d]of [[0,2.20,0,1.85,1.12,1.46],[-.5,1.92,.22,1.15,.85,1.08],[.5,2.1,-.15,1.03,.96,1.08]])kit.ellipsoid('CourtyardTreeCanopy',{x,y,z,w,h,d,color:x<0?'#91ab7c':'#a1b98a'},g);
  }else if(p.kind==='plant'){const g=kit.plant(p.x,p.z);g.name=p.id;}
 }
 for(const [id,spot]of [['student-desk','notes'],['study-desk','study'],['lectern','prepare']])notebook(kit,furniture.find(p=>p.id===id),spot,'#9da884');
 kit.book('DeskTextbook',{x:-1.70,y:FLOOR+.91,z:-2.76,w:.44,d:.52,color:'#93aaa0',flat:true});
 const chalks=kit.group('BlackboardChalks',{x:-3.1,y:.78,z:-5.48});for(let i=0;i<3;i++)kit.cylinder('ChalkStick',{x:i*.09,r:.012,h:.12,color:'#efece1',rotation:[0,0,Math.PI/2]},chalks);
 kit.root.userData.furniture=furniture.map(p=>({...p}));for(const p of furniture){const g=kit.root.getObjectByName(p.id);if(g)g.userData.furnitureId=p.id;}
 const result=kit.finish();result.root.name='DayCampus';return result;
}
