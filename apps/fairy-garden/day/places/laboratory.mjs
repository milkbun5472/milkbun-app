import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-15cba47296d70fc5';

const FLOOR=.08;
// Footprints below also drive the rendered furniture, including its real chairs.
const furniture=[
  {id:'laboratory-bench',kind:'table',x:-.55,z:-3.52,w:4.8,d:1.05,top:.70,work:{bench:{x:-.15,y:.74,z:.47}},color:'#adbfb2'},
  {id:'observation-island',kind:'table',x:-1,z:-.6,w:2.65,d:1.15,top:.70,color:'#c2cabc'},
  {id:'computer-desk',kind:'table',x:3.18,z:-2.8,w:2.15,d:1.1,top:.85,color:'#bba68a'},
  {id:'records-desk',kind:'table',x:3.15,z:.7,w:2.2,d:1.05,top:.85,color:'#bba68a'},
  {id:'archive-cabinet',kind:'cabinet',x:-4.4,z:-2.68,w:.84,d:2.1,h:2.05},
  {id:'materials-shelf',kind:'shelf',x:-4.4,z:.58,w:.88,d:1.8,h:1.2},
  {id:'computer-chair',kind:'chair',x:3.18,z:-2.13,w:.6,d:.6,seat:.45,heading:Math.PI,color:'#71968b'},
  {id:'records-chair',kind:'chair',x:3.15,z:1.48,w:.6,d:.6,seat:.45,heading:Math.PI,color:'#819987'},
  {id:'break-chair',kind:'chair',x:-3.5,z:2.55,w:.6,d:.6,seat:.45,heading:Math.PI/2,color:'#a6b59a'},
  {id:'break-side-table',kind:'table',x:-4.42,z:2.78,w:.58,d:.6,top:.58,color:'#bba68a'},
  {id:'laboratory-plant',kind:'plant',x:4.35,z:3.05,w:.5,d:.5}
];
const piece=id=>furniture.find(p=>p.id===id);
const seats={
  computer:roomSeat(furniture,'computer-chair',{x:3.18,z:-1.22}),
  records:roomSeat(furniture,'records-chair',{x:3.15,z:2.26}),
  break:roomSeat(furniture,'break-chair',{x:-2.7,z:2.55})
};
export const laboratoryMap={
  label:'实验室',renderer:'dayLaboratory',radius:9,bounds:{w:10,d:9},floor:FLOOR,
  spawn:{x:0,z:4},view:{x:0,z:0},
  furniture:furniture,
  obstacles:roomObstacles(furniture),
  seats,
  spots:[
    {id:'entrance',label:'入口',description:'从南侧进入或离开实验室；这里也适合短暂停步，随后走向各工位。',action:'rest',gesture:'rest',target:{x:0,z:3.25},heading:Math.PI,furniture:'Threshold'},
    {id:'bench',label:'实验台前',description:'站着观察与操作台面的位置；右手拿取小工具，在样品杯上方操作，之后可去观察台与记录工位。',action:'work',gesture:'rest',target:{x:-.55,z:-2.73},heading:Math.PI,furniture:'laboratory-bench'},
    {id:'observation',label:'观察台前',description:'站在中央台前看样品与仪器；低头查看样品，再到记录工位记下观察。',action:'work',gesture:'rest',target:{x:-1,z:.29},heading:Math.PI,furniture:'observation-island'},
    {id:'computer',label:'电脑工位',description:'坐着查看资料、整理数据与分析结果的位置；双手在键盘前整理数据，随后可核对记录。',action:'work',gesture:'read',target:{...seats.computer.approach},heading:seats.computer.heading,seat:seats.computer,furniture:'computer-desk'},
    {id:'records',label:'记录工位',description:'坐着阅读实验记录、整理纸笔和写观察笔记的位置。',action:'read',gesture:'read',target:{...seats.records.approach},heading:seats.records.heading,seat:seats.records,furniture:'records-desk'},
    {id:'archive',label:'资料柜前',description:'从柜前取阅或归还资料的位置；到位后打开柜门，取阅并归还资料。',action:'read',gesture:'rest',target:{x:-3.35,z:-2.68},heading:-Math.PI/2,furniture:'archive-cabinet'},
    {id:'materials',label:'材料架前',description:'在架前挑选耗材与整理物品的位置；到位后取用耗材，收拾时归还。',action:'work',gesture:'rest',target:{x:-3.35,z:.58},heading:-Math.PI/2,furniture:'materials-shelf'},
    {id:'break',label:'休息座位',description:'坐着稍作休息或翻看资料的位置，邻边小桌可以放杯子和笔记。',action:'rest',gesture:'rest',target:{...seats.break.approach},heading:seats.break.heading,seat:seats.break,furniture:'break-chair'}
  ],
  tour:['entrance','archive','bench','observation','computer','records','materials','break','entrance']
};

function cabinet(kit,p){
 const g=kit.group(p.id,{x:p.x,z:p.z});
 kit.box('cabinet-back',{x:-p.w/2+.04,y:FLOOR+p.h/2,w:.08,h:p.h,d:p.d,color:'#b4c2b4'},g);
 for(const z of [-p.d/2+.03,p.d/2-.03])kit.box('cabinet-side',{y:FLOOR+p.h/2,z,w:p.w,h:p.h,d:.06,color:'#b4c2b4'},g);
 for(const y of [.1,.7,1.3,p.h-.03])kit.box('cabinet-shelf',{y:FLOOR+y,w:p.w,h:.06,d:p.d,color:'#b4c2b4'},g);
 for(const sign of [-1,1])kit.hingedDoor('cabinet-door',{x:p.w/2+.014,y:FLOOR+p.h/2+.015,z:sign*p.d/4,w:.035,h:p.h-.12,d:p.d/2-.065,color:'#d0d7c9',axis:'x',sign,furniture:p.id},g);
 for(let n=0;n<4;n++)kit.book('CabinetReference',{x:0,y:FLOOR+.92,z:-.65+n*.4,w:.12,h:.36,d:.3,color:'#9cb4a2'},g);
}
function materialsShelf(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box('shelf-back',{x:-p.w/2+.04,y:FLOOR+p.h/2,w:.08,h:p.h,d:p.d,color:'#b5bda9'},g);
  for(const z of [-1,1])kit.box('shelf-side',{y:FLOOR+p.h/2,z:z*(p.d/2-.04),w:p.w,h:p.h,d:.08,color:'#b5bda9'},g);
  for(const y of [.1,.48,.86,p.h])kit.box('shelf-board',{y:FLOOR+y-.035,w:p.w,h:.07,d:p.d,color:'#cbd1bf'},g);
  for(let i=0;i<4;i++){
    const z=-.62+i*.4;
    const stock=kit.replaceableGroup('LabConsumableStock:'+i,{},g);stock.userData.daySupply=true;
    kit.cylinder('supply-bottle',{x:.035,y:FLOOR+.63,z,r:.095,h:.23,color:i%2?'#d1d9cf':'#e2ddc7'},stock);
    kit.cylinder('bottle-cap',{x:.035,y:FLOOR+.758,z,r:.1,h:.035,color:'#829b8f'},stock);
    kit.box('supply-box',{x:.015,y:FLOOR+.98,z,w:.53,h:.16,d:.29,color:i%2?'#bdc9bc':'#d8ccb1'},g);
  }
  for(let i=0;i<4;i++){
    const b=kit.book('lab-guide',{x:.02,y:FLOOR+.255,z:-.53+i*.3,w:.18,h:.3,d:.36,color:['#859c8d','#b1a88e','#aac0b1','#879ba1'][i]},g);
    b.rotation.y=Math.PI/2;
  }
}
function wallDetails(kit){
  const window=kit.group('LaboratoryWindow',{x:-.2,y:2.18,z:-4.38});
  kit.box('window-frame',{w:3.4,h:1.48,d:.1,color:'#a6bfb3'},window);
  kit.box('window-view',{z:.06,w:3.2,h:1.29,d:.025,color:'#d0e2de',radius:.015},window);
  kit.box('window-horizon',{y:-.32,z:.078,w:3.17,h:.44,d:.012,color:'#bdcfc0',radius:0},window);
  for(const x of [-.54,.54])kit.box('window-bar',{x,z:.09,w:.045,h:1.31,d:.04,color:'#f2eee0',radius:.009},window);
  kit.box('window-sill',{y:-.76,z:.13,w:3.5,h:.09,d:.3,color:'#e5e8d9'},window);
  const board=kit.group('LabWallBoard',{x:3.5,y:2.18,z:-4.37});
  kit.box('board-frame',{w:1.36,h:.89,d:.055,color:'#9baa97'},board);
  kit.box('board-paper',{z:.037,w:1.21,h:.75,d:.019,color:'#f0ebd9',radius:.01},board);
  for(let i=0;i<3;i++)kit.box('board-note',{x:-.4+i*.4,y:.02,z:.055,w:.29,h:.38,d:.014,color:['#c1d0bd','#dbcba7','#bbcdd0'][i],radius:.004},board);
  kit.box('lab-zone-floor',{x:-.55,y:FLOOR+.006,z:-.94,w:4.9,h:.011,d:3.2,color:'#c7d2c6',radius:.035});
}
function benchStorage(kit,p){
  const g=kit.group('LaboratoryBenchStorage',{x:p.x,z:p.z});
  const h=p.top-.16;
  for(const x of [-p.w/2+.79,p.w/2-.79]){
    kit.box('bench-storage',{x,y:FLOOR+h/2,w:1.16,h,d:p.d-.2,color:'#c3cebd'},g);
    for(const y of [h*.32,h*.74]){
      kit.box('bench-drawer',{x,y:FLOOR+y,z:p.d/2-.084,w:1.055,h:h*.40,d:.04,color:'#d6dccb',radius:.013},g);
      kit.box('bench-drawer-pull',{x,y:FLOOR+y+.04,z:p.d/2-.045,w:.28,h:.027,d:.025,color:'#88a394',radius:.005},g);
    }
  }
}
function computerWorkstation(kit,p){
  const top=FLOOR+p.top;
  const g=kit.group('ComputerItems',{x:p.x,z:p.z});
  kit.box('monitor-base',{y:top+.035,z:-.25,w:.41,h:.055,d:.28,color:'#8f9e93'},g);
  kit.box('monitor-stem',{y:top+.2,z:-.29,w:.075,h:.3,d:.075,color:'#8f9e93'},g);
  kit.box('monitor',{y:top+.47,z:-.29,w:.9,h:.57,d:.095,color:'#778e84'},g);
  kit.box('screen',{y:top+.47,z:-.235,w:.79,h:.45,d:.012,color:'#c9dddb',radius:.009},g);
  for(let i=0;i<4;i++)kit.box('screen-data-bar',{x:-.27+i*.16,y:top+.365+i*.045,z:-.225,w:.065,h:.13+i*.09,d:.005,color:'#7ca294',radius:0},g);
  kit.box('keyboard',{y:top+.025,z:.41,w:.63,h:.04,d:.23,color:'#e1e3d7',radius:.01},g);
  for(let i=0;i<7;i++)kit.box('keyboard-key',{x:-.25+i*.083,y:top+.049,z:.45,w:.045,h:.008,d:.12,color:'#aab9ac',radius:.002},g);
  kit.box('mouse',{x:.53,y:top+.047,z:.22,w:.105,h:.07,d:.16,color:'#7f998a'},g);
  kit.book('reference-book',{x:-.76,y:top+.058,z:-.03,w:.3,d:.42,color:'#9dad90',flat:true},g);
}
function recordWorkstation(kit,p){
  const top=FLOOR+p.top,g=kit.group('RecordingItems',{x:p.x,z:p.z});
  kit.box('open-notebook',{x:-.12,y:top+.028,z:.32,w:.62,h:.045,d:.31,color:'#eee7d4',radius:.008},g);
  kit.box('notebook-spine',{x:-.12,y:top+.054,z:.32,w:.018,h:.008,d:.3,color:'#c8c0aa',radius:0},g);
  for(let i=0;i<4;i++)kit.box('notebook-line',{x:.06,y:top+.056,z:.245+i*.04,w:.21,h:.004,d:.008,color:'#acbbad',radius:0},g);
  kit.box('pencil',{x:.36,y:top+.041,z:.13,w:.025,h:.025,d:.39,color:'#a79871',heading:-.23,radius:.002},g);
  kit.book('record-folder',{x:.65,y:top+.16,z:-.2,w:.42,d:.52,color:'#97b2a2',flat:true},g);
  kit.book('record-folder-under',{x:.67,y:top+.06,z:-.19,w:.44,d:.54,color:'#c0c8b1',flat:true},g);
  kit.cylinder('pen-cup',{x:-.77,y:top+.13,z:-.25,r:.1,h:.24,color:'#b5c4b2'},g);
  for(let i=0;i<3;i++)kit.box('cup-pencil',{x:-.81+i*.037,y:top+.29,z:-.25,w:.022,h:.24,d:.022,color:i%2?'#b8a37e':'#78958b',radius:.002},g);
  kit.box('desk-lamp-foot',{x:-.75,y:top+.032,z:.25,w:.25,h:.045,d:.2,color:'#92aa9a'},g);
  kit.box('desk-lamp-arm',{x:-.75,y:top+.31,z:.25,w:.035,h:.54,d:.035,color:'#92aa9a'},g);
  kit.box('desk-lamp-shade',{x:-.65,y:top+.56,z:.25,w:.31,h:.1,d:.18,color:'#b7cabc'},g);
}
function generalEquipment(kit){
  // All specialized props live under this group and can be swapped as one unit.
  const equipment=kit.replaceableGroup('LaboratoryEquipment');
  const bench=piece('laboratory-bench'),benchTop=FLOOR+bench.top;
  const sample=bench.work.bench;const active=kit.replaceableGroup('ActiveSample',{x:bench.x+sample.x,y:FLOOR+sample.y-.04,z:bench.z+sample.z},equipment);
  kit.cylinder('active-sample-cup',{y:.019,r:.045,h:.038,color:'#d9e5d9'},active);kit.cylinder('active-sample-liquid',{y:.04,r:.032,h:.008,color:'#9db6a0'},active);
  const microscope=kit.replaceableGroup('Microscope',{x:bench.x-.9,y:benchTop,z:bench.z+.02},equipment);
  kit.box('microscope-base',{y:.045,w:.52,h:.09,d:.39,color:'#7b948c'},microscope);
  kit.box('microscope-body',{x:-.13,y:.32,z:-.075,w:.14,h:.57,d:.16,color:'#dde1d6',heading:.12},microscope);
  kit.box('microscope-stage',{y:.22,z:.045,w:.35,h:.055,d:.26,color:'#859d93'},microscope);
  kit.box('specimen-slide',{y:.254,z:.055,w:.2,h:.012,d:.105,color:'#d7e3db',radius:.002},microscope);
  kit.cylinder('microscope-tube',{x:-.04,y:.5,z:.105,r:.057,h:.29,color:'#b6c7bb',rotation:[.3,0,-.25]},microscope);
  kit.cylinder('microscope-eyepiece',{x:0,y:.637,z:.148,r:.067,h:.073,color:'#6b827b',rotation:[.3,0,-.25]},microscope);
  kit.cylinder('microscope-focus',{x:-.24,y:.36,z:-.075,r:.065,h:.095,color:'#8da297',rotation:[0,0,Math.PI/2]},microscope);
  const rack=kit.replaceableGroup('TestTubeRack',{x:bench.x+.37,y:benchTop,z:bench.z+.02},equipment);
  kit.box('tube-rack-base',{y:.04,w:.7,h:.07,d:.28,color:'#abbbab'},rack);
  for(const x of [-.3,.3])kit.box('tube-rack-side',{x,y:.155,w:.045,h:.3,d:.28,color:'#abbbab'},rack);
  kit.box('tube-rack-top',{y:.245,w:.66,h:.035,d:.18,color:'#b6c9b8'},rack);
  for(let i=0;i<4;i++){
    const x=-.225+i*.15;
    kit.cylinder('test-tube',{x,y:.225,r:.043,h:.34,color:'#d0e2dc'},rack);
    kit.cylinder('tube-content',{x,y:.144,r:.044,h:.14,color:i%2?'#a6c2b3':'#bacdc8'},rack);
    kit.cylinder('tube-rim',{x,y:.398,r:.047,h:.023,color:'#e3e8dd'},rack);
  }
  const instrument=kit.replaceableGroup('BenchAnalyzer',{x:bench.x+1.62,y:benchTop,z:bench.z},equipment);
  kit.box('analyzer-body',{y:.23,w:.69,h:.46,d:.61,color:'#d6dccf'},instrument);
  kit.box('analyzer-panel',{y:.295,z:.314,w:.49,h:.25,d:.02,color:'#92afa3'},instrument);
  kit.box('analyzer-display',{x:-.085,y:.325,z:.327,w:.25,h:.11,d:.012,color:'#cce1d7',radius:.007},instrument);
  for(const x of [.16,.23])kit.cylinder('analyzer-knob',{x,y:.23,z:.328,r:.032,h:.035,color:'#edf0df',rotation:[Math.PI/2,0,0]},instrument);
  const island=piece('observation-island'),islandTop=FLOOR+island.top;
  const tray=kit.group('ObservationTray',{x:island.x+.38,y:islandTop,z:island.z},equipment);
  kit.box('sample-tray',{y:.035,w:.7,h:.065,d:.45,color:'#aec1b5'},tray);
  for(let i=0;i<3;i++){
    kit.cylinder('sample-dish',{x:-.22+i*.22,y:.085,r:.082,h:.038,color:'#d9e5d9'},tray);
    kit.cylinder('sample-mark',{x:-.22+i*.22,y:.109,r:.038,h:.01,color:['#c2c88f','#9db6a0','#c6b697'][i]},tray);
  }
  const viewer=kit.replaceableGroup('ObservationInstrument',{x:island.x-.75,y:islandTop,z:island.z-.08},equipment);
  kit.box('viewer-base',{y:.035,w:.4,h:.065,d:.35,color:'#a3b7ad'},viewer);
  kit.box('viewer-body',{y:.19,w:.3,h:.29,d:.31,color:'#d6dccf'},viewer);
  kit.box('viewer-lens-frame',{y:.23,z:.166,w:.17,h:.17,d:.025,color:'#8aaba0'},viewer);
  kit.cylinder('viewer-lens',{y:.23,z:.188,r:.055,h:.025,color:'#bfd7d2',rotation:[Math.PI/2,0,0]},viewer);
}

export function createLaboratory({equipment='general'}={}){
  const kit=createRoomKit();
  kit.room({w:10,d:9,floorColor:'#d5d7c8',wallColor:'#e8eadd',accent:'#a2b8a8'});
  kit.root.name='DayLaboratory';
  kit.root.userData.furniture=furniture;
  wallDetails(kit);
  for(const p of furniture){
    if(p.kind==='table')kit.table(p);
    else if(p.kind==='chair')kit.chair(p);
    else if(p.kind==='cabinet')cabinet(kit,p);
    else if(p.kind==='shelf')materialsShelf(kit,p);
    else if(p.kind==='plant')kit.plant(p.x,p.z);
  }
  benchStorage(kit,piece('laboratory-bench'));
  computerWorkstation(kit,piece('computer-desk'));
  recordWorkstation(kit,piece('records-desk'));
  const side=piece('break-side-table');
  kit.book('break-notebook',{x:side.x,y:FLOOR+side.top+.055,z:side.z-.055,w:.31,d:.34,color:'#a8bb9a',flat:true});
  kit.cylinder('water-cup',{x:side.x+.14,y:FLOOR+side.top+.11,z:side.z+.12,r:.065,h:.2,color:'#e3e8d7'});
  kit.book('bench-checklist',{x:-2.52,y:FLOOR+piece('laboratory-bench').top+.06,z:-3.45,w:.36,d:.44,color:'#d4d9bd',flat:true});
  kit.book('observation-notes',{x:-1.16,y:FLOOR+piece('observation-island').top+.058,z:-.28,w:.37,d:.3,color:'#bbcbb8',flat:true});
  if(equipment!=='none'){generalEquipment(kit);if(equipment==='microscope'){kit.root.getObjectByName('TestTubeRack').visible=false;kit.root.getObjectByName('BenchAnalyzer').visible=false;}if(equipment==='chemistry'){kit.root.getObjectByName('Microscope').visible=false;kit.root.getObjectByName('ObservationInstrument').visible=false;}}
  else kit.replaceableGroup('LaboratoryEquipment');
  return kit.finish();
}
