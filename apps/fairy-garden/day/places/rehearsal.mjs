import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-127ffe874240ba15';

const FLOOR=.08;
const furniture=[
  {id:'RehearsalMirror',kind:'mirror',x:-4.85,z:-.02,w:.52,d:4.45,h:2.48},
  {id:'piano-table',kind:'table',x:3.25,z:-3.1,w:2.4,d:1.2,top:.85,work:{piano:{x:-.12,y:.921,z:.50}},color:'#ab947b'},
  {id:'piano-chair',kind:'chair',x:3.25,z:-2.37,w:.6,d:.6,seat:.45,heading:Math.PI,color:'#899e93'},
  {id:'instrument-rack',kind:'cabinet',x:4.28,z:.18,w:.85,d:1.55,h:.52},
  {id:'score-stand',kind:'stand',x:.72,z:-.6,w:.6,d:.6,h:1.2},
  {id:'rest-bench',kind:'bench',x:-2.6,z:-3.68,w:3.4,d:.65,seat:.45,heading:0,color:'#a4b3a6'},
  {id:'rehearsal-side-table',kind:'table',x:-4.37,z:-2.6,w:.62,d:.62,top:.55,color:'#b8a085'},
  {id:'score-cabinet',kind:'cabinet',x:3.05,z:2.66,w:1.9,d:.7,h:.95},
  {id:'entry-plant',kind:'plant',x:-3.85,z:3.08,w:.55,d:.55}
];
const seats={piano:roomSeat(furniture,'piano-chair',{x:2.39,z:-2.10}),rest:roomSeat(furniture,'rest-bench',{x:-2.6,z:-2.79})};
export const rehearsalMap={
  label:'排练室',renderer:'dayRehearsal',radius:9,bounds:{w:10,d:9},floor:FLOOR,
  spawn:{x:0,z:4},view:{x:0,z:0},furniture,obstacles:roomObstacles(furniture),seats,
  spots:[
    {id:'entrance',label:'进入排练室',description:'从南侧入口走入，沿开阔通路去练习区、乐器角或休息长椅。',action:'rest',gesture:'rest',target:{x:0,z:3.2},heading:Math.PI,furniture:'Threshold'},
    {id:'practice',label:'开阔练习区',description:'按日程做轻量舞蹈或排戏练习，留出全身活动的空地。',action:'practice',gesture:'rest',target:{x:-.9,z:1.08},heading:Math.PI,furniture:'PracticeFloor'},
    {id:'mirror',label:'镜墙前站位',description:'在镜前检查站姿、动作与演出准备，左侧留有退后观察的距离。',action:'practice',gesture:'rest',target:{x:-3.48,z:.05},heading:-Math.PI/2,furniture:'RehearsalMirror'},
    {id:'score',label:'乐谱架前',description:'站着阅读乐谱或台词、熟悉排练内容；沿现有翻书基础动作。',action:'read',gesture:'read',target:{x:.72,z:.47},heading:Math.PI,furniture:'score-stand'},
    {id:'piano',label:'乐器前坐位',description:'坐在电钢琴前双手弹奏，手与琴键对齐；弹奏后可去看谱休息。',action:'practice',gesture:'rest',target:seats.piano.approach,heading:seats.piano.heading,seat:seats.piano,furniture:'piano-table'},
    {id:'instruments',label:'乐器架前',description:'持吉他做拨弦练习，放回后恢复乐器架摆件；乐器可整组关闭或替换。',action:'practice',gesture:'rest',target:{x:3.22,z:.18},heading:Math.PI/2,furniture:'instrument-rack'},
    {id:'rest',label:'排练间隙休息',description:'坐在长椅上歇一会儿，旁边的小桌留有水杯和谱本。',action:'rest',gesture:'rest',target:seats.rest.approach,heading:seats.rest.heading,seat:seats.rest,furniture:'rest-bench'},
    {id:'exit',label:'准备结束后离开',description:'整理排练内容后沿中央通道回到南侧出口。',action:'rest',gesture:'rest',target:{x:0,z:4},heading:0,furniture:'Threshold'}
  ],tour:['entrance','practice','mirror','score','piano','instruments','rest','exit']
};

function mirrorWall(kit,visible){
  const g=kit.replaceableGroup('RehearsalMirror',{x:-4.85,y:1.6,z:-.02,heading:Math.PI/2});
  if(!visible)return;
  kit.box('mirror-frame',{w:4.4,h:2.48,d:.065,color:'#abb5a7'},g);
  for(let i=0;i<3;i++){
    const pane=kit.box('mirror-pane',{x:-1.44+i*1.44,z:.04,w:1.37,h:2.32,d:.012,color:'#c1d4d0',radius:.008},g);
    pane.material=kit.material('#c1d4d0').clone();pane.material.roughness=.22;pane.material.metalness=.45;
    kit.box('mirror-glint',{x:-1.69+i*1.44,y:.1,z:.049,w:.05,h:1.85,d:.003,color:'#e0e7db',radius:0},g);
  }
  kit.box('ballet-barre',{y:-.49,z:.21,w:4.3,h:.055,d:.065,color:'#b49773'},g);
  for(const x of [-1.7,1.7])kit.box('barre-bracket',{x,y:-.62,z:.13,w:.045,h:.29,d:.21,color:'#859b91'},g);
}
function scoreStand(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.cylinder('stand-foot',{y:FLOOR+.026,r:.28,h:.05,color:'#7e8c85'},g);
  kit.cylinder('stand-column',{y:FLOOR+.6,r:.027,h:1.17,color:'#7e8c85'},g);
  kit.box('stand-tray',{y:FLOOR+1.19,w:.56,h:.43,d:.055,color:'#8fa298'},g);
  kit.box('sheet-pages',{y:FLOOR+1.2,z:.034,w:.48,h:.34,d:.014,color:'#f3ead8',radius:.002},g);
  for(let i=0;i<5;i++)kit.box('score-line',{y:FLOOR+1.12+i*.033,z:.043,w:.39,h:.006,d:.004,color:'#86998c',radius:0},g);
  for(let i=0;i<5;i++)kit.sphere('score-note',{x:-.13+i*.064,y:FLOOR+1.135+(i%3)*.033,z:.048,r:.011,color:'#667d70'},g);
}
function cabinets(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box('cabinet-body',{y:FLOOR+p.h/2,w:p.w,h:p.h,d:p.d,color:'#b4ae96'},g);
  kit.box('cabinet-top',{y:FLOOR+p.h+.015,w:p.w+.025,h:.03,d:p.d+.025,color:'#c8bda4'},g);
  if(p.id==='score-cabinet')for(let i=0;i<3;i++){
    kit.box('score-drawer',{x:-.58+i*.58,y:FLOOR+.48,z:p.d/2+.009,w:.52,h:.73,d:.026,color:'#c4c7b4'},g);
    kit.box('drawer-pull',{x:-.58+i*.58,y:FLOOR+.62,z:p.d/2+.037,w:.15,h:.032,d:.035,color:'#8fa092'},g);
    kit.book('score-folder',{x:-.59+i*.58,y:FLOOR+p.h+.06,z:0,w:.34,d:.46,color:['#99a998','#b7a68d','#91a7ad'][i],flat:true},g);
  }
}
function instruments(kit){
  const g=kit.replaceableGroup('RehearsalInstruments');
  const piano=kit.group('ElectricPiano',{x:3.25,y:FLOOR+.85,z:-3.06},g);
  kit.box('piano-case',{y:.027,w:2.03,h:.054,d:.98,color:'#6e8077'},piano);
  for(let i=0;i<21;i++){
    const key=kit.replaceableGroup('PianoKey-'+i,{x:-.86+i*.086,y:.071,z:.22},piano);
    key.userData.key=i;kit.box('white-key',{z:.16,w:.080,h:.018,d:.31,color:'#eee9da',radius:.002},key);
    if(i<20&&![2,6].includes(i%7))kit.box('black-key',{x:.041,y:.022,z:.045,w:.047,h:.035,d:.18,color:'#53655c',radius:.004},key);
  }
  kit.box('piano-music-rest',{y:.3,z:-.19,w:.7,h:.37,d:.035,color:'#7c9285'},piano);
  kit.box('piano-score',{y:.3,z:-.165,w:.6,h:.29,d:.008,color:'#ede6d3',radius:.002},piano);
  const guitar=kit.replaceableGroup('AcousticGuitar',{x:4.28,y:FLOOR+.55,z:.18},g);
  for(const [y,r]of [[.26,.225],[.5,.17]])kit.sphere('guitar-body',{y,r,color:'#c3a276'},guitar).scale.set(1,1,.32);
  kit.box('guitar-neck',{y:.91,w:.07,h:.66,d:.04,color:'#ac8b66'},guitar);
  kit.box('guitar-head',{y:1.26,w:.115,h:.16,d:.06,color:'#ba9871'},guitar);
  kit.cylinder('sound-hole',{y:.43,z:.065,r:.065,h:.008,color:'#7d705a',rotation:[Math.PI/2,0,0]},guitar);
  for(let i=0;i<4;i++)kit.box('guitar-string',{x:-.022+i*.014,y:.75,z:.072,w:.002,h:.89,d:.002,color:'#ece0bc',radius:0},guitar);
  return g;
}
// Instruments remain inside their table/rack footprints when swapped out.
export function createRehearsal({instruments:showInstruments=true,mirror=true}={}){
  const kit=createRoomKit();kit.room({w:10,d:9,floorColor:'#cbbda4',wallColor:'#e7e3d4',accent:'#a3b1a5'});
  kit.root.name='DayRehearsal';kit.root.userData.furniture=furniture;kit.root.userData.features={instruments:!!showInstruments,mirror:!!mirror};
  kit.box('PracticeFloor',{x:-1.1,y:FLOOR+.005,z:.67,w:5.7,h:.009,d:4.25,color:'#d6cbb6',radius:.055});
  for(let i=0;i<6;i++)kit.box('practice-floor-join',{x:-3.57+i*.9,y:FLOOR+.011,z:.67,w:.009,h:.002,d:4.14,color:'#c8b89d',radius:0});
  for(const p of furniture){if(p.kind==='table')kit.table(p);else if(p.kind==='chair')kit.chair(p);else if(p.kind==='bench')kit.bench(p);else if(p.kind==='cabinet')cabinets(kit,p);else if(p.kind==='stand')scoreStand(kit,p);else if(p.kind==='plant')kit.plant(p.x,p.z);}
  mirrorWall(kit,mirror);if(showInstruments)instruments(kit);else kit.replaceableGroup('RehearsalInstruments');
  for(let i=0;i<4;i++)kit.box('acoustic-panel',{x:-.4+i*.65,y:2.23,z:-4.36,w:.48,h:1.3,d:.085,color:i%2?'#b4bfae':'#c5ccba'});
  kit.sign('RoomName',{text:'排练室',x:-2.62,y:2.67,z:-4.36,w:2.15,h:.42});
  kit.book('break-score',{x:-4.37,y:FLOOR+.6,z:-2.62,w:.36,d:.35,flat:true,color:'#8fa58e'});
  kit.cylinder('water-cup',{x:-4.22,y:FLOOR+.67,z:-2.42,r:.065,h:.23,color:'#e8e3d2'});
  return kit.finish();
}
