import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-95886b22f114ade5';

const FLOOR=.08;
// The new room, furniture construction and collision share these footprints.
const furniture=[
  {id:'clinic-desk',kind:'table',x:-1.4,z:-2.5,w:2.4,d:1.1,top:.85,color:'#c5b89e'},
  {id:'clinic-desk-chair',kind:'chair',x:-1.4,z:-1.28,w:.6,d:.6,seat:.45,heading:Math.PI,color:'#84a89e'},
  {id:'case-cabinet',kind:'cabinet',x:-4.38,z:-3.1,w:.76,d:1.65,h:1.94,heading:Math.PI/2,color:'#c3d1c7'},
  {id:'equipment-cabinet',kind:'cabinet',x:.94,z:-3.94,w:1.25,d:.7,h:1.85,heading:0,color:'#c3d1c7'},
  {id:'examination-bed',kind:'examBed',x:2.6,z:-2.15,w:1.25,d:2.7,top:.74,color:'#c8dcd9'},
  {id:'bed-step',kind:'step',x:2.6,z:-.21,w:.62,d:.42,h:.22,color:'#9fb9b0'},
  {id:'instrument-trolley',kind:'counter',x:4.07,z:-.69,w:.65,d:.74,top:.85,color:'#b7cbc0'},
  {id:'handwash-counter',kind:'counter',x:-4.4,z:-.4,w:.86,d:1.2,top:1,color:'#c9d5cc'},
  {id:'handoff-counter',kind:'counter',x:-2.9,z:.75,w:2.25,d:.75,top:.85,color:'#b8c9bd'},
  {id:'duty-chair',kind:'chair',x:3.25,z:1.1,w:.6,d:.6,seat:.45,heading:-Math.PI/2,color:'#9db2ab'},
  {id:'rest-chair',kind:'chair',x:3.25,z:2.55,w:.6,d:.6,seat:.45,heading:-Math.PI/2,color:'#a6b8ac'},
  {id:'rest-side-table',kind:'table',x:4.23,z:1.83,w:.7,d:.65,top:.58,color:'#c5b89e'},
  {id:'duty-locker',kind:'cabinet',x:-4.3,z:3.03,w:1,d:.7,h:1.75,heading:0,color:'#cbcfc0'},
  {id:'clinic-bin',kind:'bin',x:4.36,z:.28,w:.42,d:.42,h:.46,color:'#b6c8be'},
  {id:'bed-screen',kind:'screen',x:3.7,z:-3.78,w:1.08,d:.18,h:1.72,color:'#b6cec4'},
  {id:'clinic-plant',kind:'plant',x:1.44,z:3.45,w:.5,d:.5}
];
const piece=id=>furniture.find(p=>p.id===id);
const seats={
  desk:roomSeat(furniture,'clinic-desk-chair',{x:-1.4,z:-.5}),
  duty:roomSeat(furniture,'duty-chair',{x:2.43,z:1.1}),
  rest:roomSeat(furniture,'rest-chair',{x:2.43,z:2.55})
};

export const clinicMap={
  label:'诊室／值班室',renderer:'dayClinic',radius:9,bounds:{w:10,d:9},floor:FLOOR,
  spawn:{x:0,z:4},view:{x:0,z:0},obstacles:roomObstacles(furniture),seats,
  spots:[
    {id:'entrance',label:'入口与离开',description:'从南侧进出诊室，走入后可去桌边整理资料。',action:'rest',gesture:'rest',target:{x:0,z:3.2},heading:Math.PI,furniture:'Threshold'},
    {id:'casework',label:'桌前整理病历',description:'坐着阅读病历、查看电脑资料，适合独自整理记录与接诊准备。',action:'work',gesture:'read',target:{...seats.desk.approach},heading:seats.desk.heading,seat:seats.desk,furniture:'clinic-desk'},
    {id:'bedside',label:'诊查床旁',description:'站在诊查床旁查看器材，为以后诊查和准备工作预留；当前为空床。',action:'work',gesture:'rest',target:{x:1.25,z:-2.05},heading:Math.PI/2,furniture:'examination-bed'},
    {id:'equipment',label:'器材柜前',description:'站在器材柜前查看或准备取用器材，预留开柜和拿取动作。',action:'work',gesture:'rest',target:{x:.94,z:-2.97},heading:Math.PI,furniture:'equipment-cabinet'},
    {id:'casefiles',label:'病历柜前',description:'查看病历目录，适合取出与归还纸质资料。',action:'read',gesture:'rest',target:{x:-3.28,z:-3.1},heading:-Math.PI/2,furniture:'case-cabinet'},
    {id:'handoff',label:'交班资料台',description:'站着阅读交班清单、整理资料，预留以后交班的位置。',action:'read',gesture:'read',target:{x:-2.9,z:1.77},heading:Math.PI,furniture:'handoff-counter'},
    {id:'preparation',label:'器材车前',description:'在器材车旁做准备，预留拿取、推车和专业操作的位置。',action:'work',gesture:'rest',target:{x:3.15,z:-.2},heading:Math.atan2(.92,-.49),furniture:'instrument-trolley'},
    {id:'duty',label:'值班阅读座',description:'坐着翻看值班笔记或阅读资料，邻边小桌放水杯与书。',action:'read',gesture:'read',target:{...seats.duty.approach},heading:seats.duty.heading,seat:seats.duty,furniture:'duty-chair'},
    {id:'rest',label:'小休息角',description:'坐着稍作休息，仍保留走回办公桌与离开诊室的路线。',action:'rest',gesture:'rest',target:{...seats.rest.approach},heading:seats.rest.heading,seat:seats.rest,furniture:'rest-chair'}
  ],
  tour:['entrance','casefiles','casework','equipment','bedside','preparation','handoff','duty','rest','entrance']
};

function cabinet(kit,p){
  const turned=Math.abs(Math.sin(p.heading||0))>.5;
  const w=turned?p.d:p.w,d=turned?p.w:p.d;
  const g=kit.group(p.id,{x:p.x,z:p.z,heading:p.heading||0});
  kit.box(p.id+'-body',{y:FLOOR+p.h/2,w,h:p.h,d,color:p.color},g);
  const doors=p.id==='duty-locker'?1:2;
  for(let i=0;i<doors;i++){
    const x=doors===1?0:(i-.5)*w/2;
    kit.box(p.id+'-door',{x,y:FLOOR+p.h/2+.014,z:d/2+.012,w:w/doors-.055,h:p.h-.1,d:.025,color:'#e0e5d7',radius:.012},g);
    kit.box(p.id+'-handle',{x:doors===1?-.23:x+(i===0?.16:-.16),y:FLOOR+p.h*.55,z:d/2+.046,w:.035,h:.24,d:.035,color:'#8ba69a',radius:.007},g);
    if(p.id==='case-cabinet')kit.box('case-label',{x,y:FLOOR+p.h*.77,z:d/2+.028,w:.26,h:.15,d:.012,color:'#b7cabb',radius:.002},g);
    if(p.id==='equipment-cabinet'){
      kit.box('cabinet-window-frame',{x,y:FLOOR+p.h*.72,z:d/2+.028,w:.45,h:.62,d:.018,color:'#99b8ad',radius:.014},g);
      kit.box('cabinet-window',{x,y:FLOOR+p.h*.72,z:d/2+.04,w:.38,h:.54,d:.008,color:'#c9ddd3',radius:.01},g);
    }
  }
  if(p.id==='duty-locker')for(let i=0;i<4;i++)kit.box('locker-vent',{x:0,y:FLOOR+p.h-.19-i*.055,z:d/2+.032,w:.4,h:.011,d:.012,color:'#a7baac',radius:.002},g);
}
function examinationBed(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box('exam-frame',{y:FLOOR+p.top-.2,w:p.w,h:.13,d:p.d,color:'#a3bcb4'},g);
  kit.box('exam-mattress',{y:FLOOR+p.top-.07,w:p.w-.07,h:.14,d:p.d-.14,color:p.color,radius:.055},g);
  kit.box('exam-pillow',{y:FLOOR+p.top+.045,z:-p.d/2+.41,w:.84,h:.09,d:.43,color:'#e5ece0',radius:.035},g);
  kit.box('folded-exam-sheet',{y:FLOOR+p.top+.014,z:.42,w:p.w-.15,h:.028,d:.62,color:'#e6eadb',radius:.009},g);
  for(const x of [-1,1])for(const z of [-1,1])kit.box('exam-leg',{x:x*(p.w/2-.14),y:FLOOR+(p.top-.25)/2,z:z*(p.d/2-.23),w:.085,h:p.top-.25,d:.085,color:'#8fa9a1',radius:.012},g);
  for(const x of [-1,1])kit.box('exam-lower-rail',{x:x*(p.w/2-.14),y:FLOOR+.24,w:.07,h:.08,d:p.d-.37,color:'#a5bab0',radius:.01},g);
}
function trolley(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  for(const level of [.25,p.top])kit.box('trolley-tray',{y:FLOOR+level-.025,w:p.w,h:.05,d:p.d,color:p.color,radius:.023},g);
  for(const x of [-1,1])for(const z of [-1,1]){
    kit.box('trolley-post',{x:x*(p.w/2-.055),y:FLOOR+p.top/2,z:z*(p.d/2-.055),w:.04,h:p.top,d:.04,color:'#92afa2',radius:.007},g);
    kit.cylinder('trolley-wheel',{x:x*(p.w/2-.07),y:FLOOR+.052,z:z*(p.d/2-.07),r:.051,h:.055,color:'#819990',rotation:[0,0,Math.PI/2]},g);
  }
  kit.box('trolley-supply-box',{y:FLOOR+.37,w:.44,h:.18,d:.48,color:'#e1e7d6',radius:.015},g);
}
function handwashCounter(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box('wash-cabinet',{y:FLOOR+.45,w:p.w-.08,h:.9,d:p.d-.07,color:'#bccfc0'},g);
  kit.box('wash-counter-top',{y:FLOOR+p.top-.035,w:p.w,h:.07,d:p.d,color:p.color},g);
  kit.box('wash-door',{x:p.w/2-.005,y:FLOOR+.45,w:.04,h:.73,d:p.d-.15,color:'#e0e5d7',radius:.01},g);
  kit.box('wash-handle',{x:p.w/2+.037,y:FLOOR+.58,w:.04,h:.035,d:.27,color:'#89a89a',radius:.008},g);
  kit.box('sink-rim',{y:FLOOR+p.top+.018,w:.66,h:.045,d:.62,color:'#eef0e4',radius:.035},g);
  kit.box('sink-basin',{y:FLOOR+p.top+.043,w:.45,h:.012,d:.41,color:'#b4cfcb',radius:.028},g);
  kit.cylinder('faucet-upright',{x:-.25,y:FLOOR+p.top+.15,z:-.43,r:.025,h:.25,color:'#90aea2'},g);
  kit.box('faucet-spout',{x:-.16,y:FLOOR+p.top+.264,z:-.43,w:.22,h:.035,d:.048,color:'#90aea2',radius:.01},g);
  kit.cylinder('soap-bottle',{x:.24,y:FLOOR+p.top+.115,z:.42,r:.068,h:.22,color:'#d2ddcc'},g);
  kit.box('soap-pump',{x:.24,y:FLOOR+p.top+.235,z:.42,w:.11,h:.028,d:.033,color:'#8ca698',radius:.005},g);
}
function desktop(kit,p){
  const top=FLOOR+p.top,g=kit.group('ClinicDesktop',{x:p.x,z:p.z});
  kit.box('clinic-monitor-foot',{x:.47,y:top+.027,z:-.25,w:.4,h:.05,d:.27,color:'#9db5aa'},g);
  kit.box('clinic-monitor-stand',{x:.47,y:top+.2,z:-.28,w:.068,h:.34,d:.07,color:'#9db5aa'},g);
  kit.box('clinic-monitor',{x:.47,y:top+.46,z:-.28,w:.81,h:.51,d:.07,color:'#89a699'},g);
  kit.box('clinic-screen',{x:.47,y:top+.46,z:-.237,w:.71,h:.41,d:.011,color:'#d2e5df',radius:.008},g);
  kit.box('screen-document',{x:.35,y:top+.46,z:-.228,w:.3,h:.32,d:.006,color:'#edf0e3',radius:.002},g);
  for(let i=0;i<4;i++)kit.box('screen-document-line',{x:.35,y:top+.56-i*.055,z:-.223,w:.19,h:.008,d:.004,color:'#a5bfb2',radius:0},g);
  kit.box('clinic-keyboard',{x:.48,y:top+.023,z:.21,w:.59,h:.04,d:.21,color:'#dce3d5',radius:.012},g);
  for(let i=0;i<6;i++)kit.box('clinic-key',{x:.25+i*.08,y:top+.047,z:.21,w:.045,h:.008,d:.11,color:'#a8bcb0',radius:.002},g);
  kit.box('clinic-mouse',{x:.95,y:top+.043,z:.23,w:.1,h:.055,d:.15,color:'#86a395'},g);
  kit.book('case-file-lower',{x:-.62,y:top+.055,z:-.21,w:.53,d:.56,color:'#bacbb6',flat:true},g);
  kit.book('case-file-upper',{x:-.6,y:top+.153,z:-.24,w:.49,d:.51,color:'#95b5a6',flat:true},g);
  kit.box('case-notebook',{x:-.44,y:top+.023,z:.23,w:.73,h:.039,d:.29,color:'#efe9d8',radius:.009},g);
  for(let i=0;i<3;i++)kit.box('case-note-line',{x:-.45,y:top+.046,z:.16+i*.06,w:.44,h:.005,d:.008,color:'#b4c2ad',radius:0},g);
  kit.box('clinic-pencil',{x:-.91,y:top+.039,z:.23,w:.025,h:.025,d:.31,color:'#8ba999',heading:.18,radius:.002},g);
}
function handoffNotes(kit,p){
  const g=kit.group('HandoffItems',{x:p.x,z:p.z}),top=FLOOR+p.top;
  for(let i=0;i<3;i++)kit.book('handoff-folder-'+i,{x:-.69+i*.21,y:top+.2,z:-.03,w:.145,h:.4,d:.36,color:['#b0c2aa','#a0b7a6','#c6bfa4'][i]},g);
  kit.box('handoff-clipboard',{x:.47,y:top+.023,z:0,w:.61,h:.04,d:.45,color:'#abbbab',radius:.009},g);
  kit.box('handoff-paper',{x:.47,y:top+.047,z:.01,w:.53,h:.009,d:.36,color:'#eee9d8',radius:.003},g);
  for(let i=0;i<4;i++)kit.box('handoff-check',{x:.3,y:top+.054,z:-.105+i*.075,w:.025,h:.004,d:.025,color:'#94ada0',radius:0},g);
  for(let i=0;i<4;i++)kit.box('handoff-line',{x:.52,y:top+.054,z:-.105+i*.075,w:.27,h:.004,d:.009,color:'#b0c2ad',radius:0},g);
}
function clinicWalls(kit){
  const window=kit.group('ClinicWindow',{x:-1.4,y:2.31,z:-4.38});
  kit.box('clinic-window-frame',{w:2.56,h:1.35,d:.09,color:'#b0c8bb'},window);
  kit.box('clinic-window-view',{z:.055,w:2.37,h:1.16,d:.022,color:'#d4e5dd',radius:.02},window);
  kit.box('clinic-window-greenery',{y:-.36,z:.07,w:2.35,h:.42,d:.014,color:'#c1d1ba',radius:0},window);
  kit.box('clinic-window-divider',{z:.087,w:.045,h:1.18,d:.035,color:'#f0eee0',radius:.006},window);
  kit.box('clinic-window-sill',{y:-.71,z:.14,w:2.68,h:.085,d:.3,color:'#e8eadd'},window);
  const emblem=kit.group('ClinicWallEmblem',{x:2.58,y:2.44,z:-4.37});
  kit.box('emblem-back',{w:.76,h:.76,d:.055,color:'#d8e2d1',radius:.05},emblem);
  kit.box('emblem-cross-vertical',{z:.037,w:.16,h:.48,d:.026,color:'#88ab9b',radius:.007},emblem);
  kit.box('emblem-cross-horizontal',{z:.04,w:.48,h:.16,d:.024,color:'#88ab9b',radius:.007},emblem);
  const clock=kit.group('ClinicClock',{x:4.19,y:2.74,z:-4.35});
  kit.cylinder('clock-rim',{r:.25,h:.055,color:'#a3b9a9',rotation:[Math.PI/2,0,0]},clock);
  kit.cylinder('clock-face',{z:.037,r:.216,h:.023,color:'#eff0e2',rotation:[Math.PI/2,0,0]},clock);
  kit.box('clock-hour',{x:-.038,y:.049,z:.054,w:.024,h:.127,d:.008,color:'#87a08f',heading:0,radius:.003},clock);
  kit.box('clock-minute',{x:.063,y:.029,z:.055,w:.146,h:.02,d:.008,color:'#87a08f',radius:.003},clock);
  kit.box('rest-zone-floor',{x:3.32,y:FLOOR+.004,z:1.83,w:2.79,h:.008,d:2.63,color:'#d9d5c7',radius:.04});
  const notice=kit.group('DutyNotice',{x:-4.84,y:2.1,z:1.45,heading:Math.PI/2});
  kit.box('duty-notice-frame',{w:1.08,h:.79,d:.052,color:'#aebcaf'},notice);
  kit.box('duty-notice-paper',{z:.035,w:.96,h:.67,d:.015,color:'#ece9d7',radius:.008},notice);
  for(const x of [-.23,.23])kit.box('duty-notice-note',{x,z:.049,w:.37,h:.39,d:.013,color:x<0?'#c2d0bc':'#d9d1b5',radius:.006},notice);
}
function clinicEquipment(kit){
  const g=kit.replaceableGroup('ClinicEquipment'),p=piece('instrument-trolley'),top=FLOOR+p.top;
  const tray=kit.group('ClinicInstrumentTray',{x:p.x,y:top,z:p.z},g);
  kit.box('instrument-tray',{y:.025,w:.47,h:.047,d:.54,color:'#e1e8da',radius:.014},tray);
  kit.box('instrument-case',{y:.078,z:-.075,w:.29,h:.062,d:.22,color:'#a1baac',radius:.014},tray);
  kit.box('wrapped-instrument',{x:-.105,y:.087,z:.15,w:.04,h:.029,d:.24,color:'#8fa99b',radius:.004},tray);
  kit.box('wrapped-instrument',{x:.078,y:.085,z:.15,w:.038,h:.027,d:.21,color:'#a9c3b4',radius:.004},tray);
  const cabinet=piece('equipment-cabinet');
  const caseGroup=kit.group('ClinicSupplyCase',{x:cabinet.x,y:FLOOR+cabinet.h+.13,z:cabinet.z},g);
  kit.box('supply-case',{w:.68,h:.24,d:.39,color:'#a9c3b1'},caseGroup);
  kit.box('supply-case-handle',{y:.146,w:.23,h:.054,d:.046,color:'#88a494',radius:.01},caseGroup);
  kit.box('supply-case-cross-vertical',{y:.004,z:.204,w:.045,h:.135,d:.018,color:'#edf0df',radius:.003},caseGroup);
  kit.box('supply-case-cross-horizontal',{y:.004,z:.207,w:.135,h:.045,d:.016,color:'#edf0df',radius:.003},caseGroup);
}

export function createClinic({equipment='general'}={}){
  const kit=createRoomKit();
  kit.room({w:10,d:9,floorColor:'#d8dccf',wallColor:'#ebeddf',accent:'#b0c8b8'});
  kit.root.name='DayClinic';kit.root.userData.furniture=furniture;
  clinicWalls(kit);
  for(const p of furniture){
    if(p.kind==='table'||p.kind==='counter'&&p.id==='handoff-counter')kit.table(p);
    else if(p.kind==='chair')kit.chair(p);
    else if(p.kind==='cabinet')cabinet(kit,p);
    else if(p.kind==='examBed')examinationBed(kit,p);
    else if(p.id==='instrument-trolley')trolley(kit,p);
    else if(p.id==='handwash-counter')handwashCounter(kit,p);
    else if(p.kind==='step'){
      const g=kit.group(p.id,{x:p.x,z:p.z});
      kit.box('exam-step',{y:FLOOR+p.h/2,w:p.w,h:p.h,d:p.d,color:p.color,radius:.018},g);
      kit.box('exam-step-top',{y:FLOOR+p.h+.009,w:p.w-.05,h:.018,d:p.d-.05,color:'#d5dfd0',radius:.015},g);
    }else if(p.kind==='screen'){
      const g=kit.group(p.id,{x:p.x,z:p.z});
      kit.box('privacy-screen',{y:FLOOR+p.h/2+.035,w:p.w-.06,h:p.h-.07,d:.072,color:p.color,radius:.018},g);
      for(const x of [-1,1]){
        kit.box('screen-frame',{x:x*(p.w/2-.025),y:FLOOR+p.h/2,w:.05,h:p.h,d:.065,color:'#91ada0',radius:.012},g);
        kit.box('screen-foot',{x:x*(p.w/2-.065),y:FLOOR+.03,w:.12,h:.06,d:p.d,color:'#91ada0',radius:.012},g);
      }
    }else if(p.kind==='bin'){
      const g=kit.group(p.id,{x:p.x,z:p.z});
      kit.box('clinic-waste-bin',{y:FLOOR+p.h/2,w:p.w,h:p.h,d:p.d,color:p.color,radius:.04},g);
      kit.box('clinic-bin-lid',{y:FLOOR+p.h+.015,w:p.w+.012,h:.03,d:p.d+.012,color:'#d7e1d1',radius:.014},g);
    }else if(p.kind==='plant')kit.plant(p.x,p.z);
  }
  desktop(kit,piece('clinic-desk'));handoffNotes(kit,piece('handoff-counter'));
  const side=piece('rest-side-table');
  kit.book('duty-notebook',{x:side.x,y:FLOOR+side.top+.055,z:side.z-.04,w:.36,d:.35,color:'#acbc9f',flat:true});
  kit.cylinder('duty-water-cup',{x:side.x+.19,y:FLOOR+side.top+.105,z:side.z+.18,r:.068,h:.19,color:'#e5e8d8'});
  if(equipment!=='none')clinicEquipment(kit);else kit.replaceableGroup('ClinicEquipment');
  return kit.finish();
}
