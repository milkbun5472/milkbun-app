import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs';
import {computer,notebook,cabinet} from './work-room-kit.mjs';
const FLOOR=.08,SIZE={w:14,d:11};
const furniture=[
 {id:'clue-wall',kind:'panel',x:-3.9,z:-5.18,w:4.9,d:.17,work:{clues:{x:.03,y:1.08,z:.12}}},
 {id:'case-desk',kind:'table',x:-4.5,z:-2.5,w:2.25,d:1.02,top:.85,color:'#b79c7f',work:{notes:{x:.12,y:.904,z:.40}}},
 {id:'case-chair',kind:'chair',x:-4.5,z:-1.73,w:.56,d:.57,heading:Math.PI,color:'#8b9c8a'},
 {id:'analysis-desk',kind:'table',x:-1.45,z:-2.5,w:2.15,d:1.02,top:.85,color:'#b79c7f'},
 {id:'analysis-chair',kind:'chair',x:-1.45,z:-1.73,w:.56,d:.57,heading:Math.PI,color:'#8b9c8a'},
 {id:'brief-table',kind:'table',x:3.65,z:-2.45,w:3.4,d:1.40,top:.85,color:'#829a9b',work:{duty:{x:.12,y:.904,z:.65}}},
 {id:'duty-chair',kind:'chair',x:3.65,z:-1.52,w:.56,d:.57,heading:Math.PI,color:'#7c959a'},
 {id:'files',kind:'cabinet',x:3.70,z:-4.86,w:3.4,d:.70,h:1.75},
 {id:'evidence',kind:'cabinet',x:-4.6,z:1.10,w:2.4,d:.75,h:1.35},
 {id:'tea-table',kind:'table',x:-1.40,z:1.30,w:1.55,d:.82,top:.85,color:'#b79c7f'},
 {id:'tea-chair',kind:'chair',x:-1.40,z:2.00,w:.56,d:.57,heading:Math.PI,color:'#b6a789'},
 {id:'break-bench',kind:'bench',x:3.50,z:3.54,w:2.9,d:.65,seat:.45,heading:0,color:'#8b9c8a'},
 {id:'entry-plant',kind:'plant',x:-5.9,z:3.8,w:.55,d:.55}
];
const seats={notes:roomSeat(furniture,'case-chair',{x:-3.67,z:-1.73}),computer:roomSeat(furniture,'analysis-chair',{x:-.63,z:-1.73}),duty:roomSeat(furniture,'duty-chair',{x:4.48,z:-1.52}),tea:roomSeat(furniture,'tea-chair',{x:-.58,z:2}),rest:roomSeat(furniture,'break-bench',{x:3.5,z:2.72})};
const sit=(id,label,description,piece,action='work')=>({id,label,description,action,gesture:action==='tea'?'tea':'rest',target:seats[id].approach,heading:seats[id].heading,seat:seats[id],furniture:piece});
export const investigationMap={label:'办案室／值勤区',renderer:'dayInvestigation',radius:12,bounds:SIZE,floor:FLOOR,spawn:{x:0,z:4.87},view:{x:0,z:0},furniture,seats,obstacles:roomObstacles(furniture,SIZE),spots:[
 {id:'entrance',label:'值勤区入口',description:'沿中央通道进入办案区，走向当前案件工位。',action:'rest',gesture:'rest',target:{x:0,z:4.6},heading:Math.PI},
 {id:'clues',label:'线索墙前梳理',description:'对着线索墙逐项查看、指示连接关系，梳理案件。',action:'work',gesture:'rest',target:{x:-3.86,z:-4.69},heading:Math.PI,furniture:'clue-wall'},
 sit('notes','桌前整理案卷','在纸本案卷上记录调查信息、整理当日资料。','case-desk'),
 sit('computer','查询与比对资料','在电脑前检索资料、比对已有信息。','analysis-desk'),
 {id:'files',label:'档案柜取卷宗',description:'打开档案柜，取出并归还本次工作需要的卷宗。',action:'work',gesture:'rest',target:{x:3.7,z:-4.10},heading:Math.PI,furniture:'files'},
 {id:'evidence',label:'整理物证收纳',description:'在收纳柜前取放封存盒、核对标签。',action:'work',gesture:'rest',target:{x:-4.6,z:1.90},heading:Math.PI,furniture:'evidence'},
 {id:'briefing',label:'案情汇报位置',description:'站在长桌前梳理案情、说明调查进度。',action:'work',gesture:'rest',target:{x:2.65,z:-3.67},heading:0,furniture:'brief-table'},
 sit('duty','值勤交接席','在交接桌坐下，核对值勤记录和待办。','brief-table'),
 sit('tea','值勤间隙喝水','坐在小茶桌旁喝口水。','tea-table','tea'),
 sit('rest','下班前稍歇','在入口长椅暂歇，随后继续当前工作。','break-bench','rest'),
 {id:'exit',label:'交班后离开',description:'收好资料，沿通道离开值勤区。',action:'rest',gesture:'rest',target:{x:0,z:4.87},heading:0}
],tour:['entrance','files','notes','computer','clues','evidence','briefing','duty','tea','rest','exit']};
function clueWall(k){
 const p=furniture[0],g=k.group(p.id,{x:p.x,z:p.z});k.box('PinBoardFrame',{y:1.66,w:p.w,h:2.36,d:p.d,color:'#7a7566'},g);k.box('CorkBoard',{y:1.66,z:.097,w:p.w-.14,h:2.2,d:.022,color:'#b4a382'},g);
 const points=[[-1.75,2.20],[-.72,2.28],[.38,2.12],[1.48,2.25],[-1.50,1.30],[-.35,1.22],[.85,1.23],[1.77,1.36]];
 for(const [a,b]of [[0,1],[1,2],[2,3],[0,4],[1,5],[2,6],[3,7],[4,5],[5,6],[6,7]])k.tube('ClueThread',{points:[[...points[a],.12],[...points[b],.12]],r:.009,color:'#b66e57'},g);
 points.forEach(([x,y],i)=>{k.box('ClueCard',{x,y,z:.134,w:i<4?.65:.52,h:i<4?.45:.33,d:.014,color:i%3===0?'#d5ded5':'#ede8d9',radius:.003},g);for(let n=0;n<3;n++)k.box('ClueCardLine',{x:x-.025,y:y+.09-n*.065,z:.146,w:.34-n*.05,h:.008,d:.002,color:'#889790',radius:0},g);k.sphere('CluePin',{x,y:y+.15,z:.17,r:.025,color:'#a66c55'},g);});
 k.sign('ClueBoardTitle',{text:'线索与待核实',y:2.59,z:.151,w:2.35,h:.22,color:'#b4a382',ink:'#4b635f'},g);
}
export function createInvestigation(){
 const k=createRoomKit();k.room({...SIZE,floorColor:'#b7b5a4',wallColor:'#dedbd0',accent:'#778d8b',joins:false});
 for(let z=-5;z<=5;z+=1)k.box('TerrazzoJoint',{y:.084,z,w:13.7,h:.003,d:.012,color:'#9fa89e',radius:0});
 k.box('WorkRug',{x:-2.95,y:.09,z:-2.35,w:6.1,h:.012,d:3.52,color:'#c5baa0'});clueWall(k);
 for(const p of furniture){if(p.kind==='table')k.table(p);else if(p.kind==='chair')k.chair(p);else if(p.kind==='bench')k.bench(p);else if(p.kind==='cabinet')cabinet(k,p,p.id==='evidence'?'#798e8a':'#7d939a',p.id==='files'?4:3);else if(p.kind==='plant'){const g=k.plant(p.x,p.z);g.name=p.id;}}
 computer(k,furniture.find(p=>p.id==='analysis-desk'));notebook(k,furniture.find(p=>p.id==='case-desk'),'notes','#a78565');notebook(k,furniture.find(p=>p.id==='brief-table'),'duty','#839b96');
 const labels=k.group('FileLabels',{x:3.7,z:-4.48});for(let i=0;i<8;i++)k.sign('FileIndex',{text:String(i+1).padStart(2,'0'),x:-1.39+(i%4)*.93,y:.59+Math.floor(i/4)*.67,z:.015,w:.25,h:.14,color:'#d6ded4',ink:'#5b777a'},labels);
 const locker=k.group('SealedCases',{x:-4.6,y:1.49,z:1.1});for(let i=0;i<3;i++){k.box('ArchiveBox',{x:-.75+i*.73,y:.13,w:.60,h:.24,d:.45,color:['#c4bfa4','#aabdb3','#cdb89a'][i]},locker);k.box('SealLabel',{x:-.75+i*.73,y:.13,z:.231,w:.18,h:.09,d:.006,color:'#eee7d6',radius:.001},locker);}
 k.sign('DutySign',{text:'值勤交接',x:3.67,y:2.53,z:-5.36,w:2.05,h:.29,color:'#dedbd0',ink:'#526c72'});
 k.root.userData.furniture=furniture.map(p=>({...p}));for(const p of furniture){const g=k.root.getObjectByName(p.id);if(g)g.userData.furnitureId=p.id;}
 const result=k.finish();result.root.name='DayInvestigation';return result;
}
