import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-e4b373131c1a533d';

const FLOOR=.08;
const furniture=[
  {id:'waiting-bench',kind:'bench',x:-1.46,z:-2.16,w:3.22,d:.64,seat:.45,heading:0,color:'#8fa69c'},
  {id:'reading-bench',kind:'bench',x:-1.46,z:.45,w:3.22,d:.64,seat:.45,heading:0,color:'#a0b2a6'},
  {id:'service-counter',kind:'counter',x:-4.25,z:-3.35,w:1.92,d:.95,top:1,color:'#c0ab8e'},
  {id:'luggage-shelf',kind:'shelf',x:1.56,z:-2.95,w:1.46,d:.72,top:.6},
  {id:'platform-edge',kind:'edge',x:5.55,z:-.3,w:.2,d:7.22,h:.19},
  {id:'platform-sign',kind:'sign',x:3.76,z:-3.85,w:.9,d:.24,h:2.35},
  {id:'entrance-plant',kind:'plant',x:-4.8,z:3.1,w:.55,d:.55}
];
const seats={waiting:roomSeat(furniture,'waiting-bench',{x:-1.46,z:-1.28}),reading:roomSeat(furniture,'reading-bench',{x:-1.46,z:1.33})};
export const stationMap={
  label:'车站／候车区',renderer:'dayStation',radius:10,bounds:{w:12,d:9},floor:FLOOR,
  spawn:{x:0,z:4},view:{x:0,z:-.2},furniture,obstacles:roomObstacles(furniture,{w:12,d:9}),seats,
  spots:[
    {id:'entrance',label:'进入候车厅',description:'从南侧入口走入，沿中间通道去候车长椅、行李架或站台。',action:'rest',gesture:'rest',target:{x:0,z:3.28},heading:Math.PI,furniture:'Threshold'},
    {id:'information',label:'站牌前看信息',description:'在站牌前查看方向和候车信息，预留看站牌与出发准备的位置。',action:'wait',gesture:'rest',target:{x:3.76,z:-2.75},heading:Math.PI,furniture:'platform-sign'},
    {id:'service',label:'服务台前',description:'站在服务台前核对出行资料，预留问询与整理车票的站位。',action:'wait',gesture:'rest',target:{x:-4.25,z:-2.27},heading:Math.PI,furniture:'service-counter'},
    {id:'luggage',label:'行李放置处',description:'将随身行李放上架板，候车时留在这里，离开前取回。',action:'wait',gesture:'rest',target:{x:1.56,z:-2.32},heading:Math.PI,furniture:'luggage-shelf'},
    {id:'waiting',label:'坐着候车',description:'坐在候车长椅上等待，可从入口走来、坐下，再起身去站台或出口。',action:'wait',gesture:'rest',target:seats.waiting.approach,heading:seats.waiting.heading,seat:seats.waiting,furniture:'waiting-bench'},
    {id:'reading',label:'候车时阅读',description:'在另一排长椅上坐着翻看随身资料，保留走回站台和出口的通道。',action:'read',gesture:'read',target:seats.reading.approach,heading:seats.reading.heading,seat:seats.reading,furniture:'reading-bench'},
    {id:'platform',label:'站台内侧等候',description:'站在安全线内侧等候；列车停靠在黄线外，保留安全候车位置。',action:'wait',gesture:'rest',target:{x:4.24,z:.95},heading:Math.PI/2,furniture:'platform-edge'},
    {id:'departure',label:'出发准备位置',description:'从候车座起身后走到站台内侧准备出发，列车在轨道上停靠、离开，小人留在安全线内。',action:'wait',gesture:'rest',target:{x:4.24,z:-1.73},heading:Math.PI/2,furniture:'platform-edge'},
    {id:'exit',label:'起身离开候车区',description:'等待结束后沿中央通道离开，供通勤、出差和旅行日程使用。',action:'rest',gesture:'rest',target:{x:0,z:4},heading:0,furniture:'Threshold'}
  ],tour:['entrance','information','service','luggage','waiting','reading','platform','departure','exit']
};

function luggageRack(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  for(const x of [-p.w/2+.04,p.w/2-.04])kit.box('rack-side',{x,y:FLOOR+p.top/2,w:.08,h:p.top,d:p.d,color:'#94aaa0'},g);
  for(const y of [.12,p.top-.025])kit.box('rack-board',{y:FLOOR+y,w:p.w,h:.05,d:p.d,color:'#c4cfbf'},g);
  for(let i=0;i<1;i++){
    const x=-.36+i*.7,bag=kit.group('Luggage-'+i,{x,y:FLOOR+p.top,z:0},g);
    kit.box('suitcase',{y:.31,w:.5,h:.55,d:.36,color:i?'#b8ac91':'#8ca49a'},bag);
    kit.box('case-stripe',{y:.31,z:.187,w:.035,h:.47,d:.014,color:'#d0d8c6'},bag);
    for(const a of [-1,1])kit.cylinder('case-wheel',{x:a*.17,y:.034,z:.12,r:.033,h:.04,color:'#71897e',rotation:[0,0,Math.PI/2]},bag);
    for(const a of [-1,1])kit.box('handle-stem',{x:a*.115,y:.65,z:0,w:.018,h:.18,d:.02,color:'#7b8d7d',radius:.004},bag);
    kit.box('case-handle',{y:.74,w:.26,h:.033,d:.05,color:'#7b8d7d'},bag);
  }
}
function stationSign(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box('sign-foot',{y:FLOOR+.035,w:.82,h:.07,d:.22,color:'#93a89e'},g);
  for(const x of [-.34,.34])kit.box('sign-post',{x,y:FLOOR+1.16,w:.045,h:2.32,d:.045,color:'#819d90'},g);
  kit.box('sign-board',{y:FLOOR+1.96,w:.9,h:.72,d:.1,color:'#789689'},g);
  kit.sign('PlatformName',{text:'站台',y:FLOOR+2.12,z:.055,w:.78,h:.28,color:'#789689',ink:'#f3efdf'},g);
  kit.sign('PlatformDirection',{text:'候车区 →',y:FLOOR+1.81,z:.056,w:.8,h:.19,color:'#789689',ink:'#f3efdf'},g);
}
function wallAndPlatform(kit){
  kit.box('waiting-floor',{x:-1.72,y:FLOOR+.005,z:-.77,w:5.9,h:.009,d:6.1,color:'#e1d8c8',radius:.02});
  kit.box('platform-floor',{x:4.25,y:FLOOR+.006,z:-.3,w:2.3,h:.01,d:7.22,color:'#bfc6b8',radius:.01});
  kit.box('platform-yellow-line',{x:5.06,y:FLOOR+.014,z:-.3,w:.18,h:.005,d:7.22,color:'#d3b76e',radius:0});
  for(let i=0;i<24;i++)kit.box('tactile-strip',{x:4.93,y:FLOOR+.023,z:-3.58+i*.28,w:.4,h:.012,d:.045,color:'#d9c388',radius:.002});
  // The fixed edge is both visible and collidable; rail decoration stays outside walk bounds.
  for(let i=0;i<13;i++)kit.box('track-sleeper',{x:6.67,y:-.02,z:-3.6+i*.56,w:1.76,h:.13,d:.16,color:'#a7967f'});
  for(const x of [6.18,7.17])kit.box('short-rail',{x,y:.07,z:-.25,w:.065,h:.09,d:7.5,color:'#87998d',radius:.008});
  kit.box('track-bed',{x:6.67,y:-.14,z:-.25,w:1.8,h:.16,d:7.64,color:'#aaa895',radius:.02});
  const board=kit.group('DepartureBoard',{x:-.74,y:2.45,z:-4.35});
  kit.box('board-frame',{w:3.43,h:1.18,d:.075,color:'#91a69b'},board);
  kit.sign('WaitingName',{text:'候车',y:.25,z:.043,w:3.24,h:.42,color:'#91a69b',ink:'#f1eddd'},board);
  kit.sign('WaitingDirection',{text:'候车座 · 站台 · 出口',y:-.24,z:.044,w:3.24,h:.25,color:'#91a69b',ink:'#f1eddd'},board);
  const clock=kit.group('StationClock',{x:-4.3,y:2.45,z:-4.33});
  kit.cylinder('clock-frame',{r:.32,h:.07,color:'#8da397',rotation:[Math.PI/2,0,0]},clock);
  kit.cylinder('clock-face',{z:.043,r:.27,h:.018,color:'#eee9d9',rotation:[Math.PI/2,0,0]},clock);
  kit.box('clock-hand-long',{y:.105,z:.06,w:.015,h:.22,d:.008,color:'#708b7e',radius:0},clock);
  kit.box('clock-hand-short',{x:.065,z:.063,w:.14,h:.018,d:.008,color:'#708b7e',radius:0},clock);
  kit.sign('StationSafety',{text:'请留在黄线内',x:4.08,y:2.58,z:-4.35,w:2.1,h:.35});
}
function stationTrain(kit){
 const train=kit.replaceableGroup('DayStationTrain',{x:6.7});train.userData.vehicle='tram';
 kit.box('TramBody',{y:.91,w:1.1,h:1.52,d:5.6,color:'#92b7aa',radius:.12},train);
 kit.box('TramRoof',{y:1.72,w:1.15,h:.18,d:5.5,color:'#e5e6d5',radius:.08},train);
 kit.box('TramStripe',{x:-.559,y:.58,w:.014,h:.14,d:5.3,color:'#eadbbb',radius:0},train);
 for(const z of [-1.95,-.9,.9,1.95])kit.box('TramWindow',{x:-.566,y:1.22,z,w:.012,h:.53,d:.76,color:'#c4dbe0',radius:.035},train);
 const door=kit.replaceableGroup('TramDoor',{x:-.575,y:.98,z:0},train);kit.box('TramDoorPanel',{w:.025,h:1.21,d:.79,color:'#d2ddcc'},door);
 for(const sign of [-1,1]){kit.box('TramFrontWindow',{y:1.23,z:sign*2.807,w:.72,h:.46,d:.013,color:'#b7d2d8'},train);kit.box('TramLamp',{x:-.34,y:.56,z:sign*2.81,w:.15,h:.12,d:.015,color:'#f0deb1'},train);}
 for(const x of [-.4,.4])for(const z of [-1.85,1.85])kit.cylinder('TramWheel',{x,y:.2,z,r:.19,h:.12,color:'#71877e',rotation:[0,0,Math.PI/2]},train);
 kit.sign('TramName',{text:'小世界列车',x:-.586,y:.75,z:-1.6,w:1.1,h:.18,heading:-Math.PI/2,color:'#92b7aa',ink:'#f8f0dc'},train);
}
export function createStation(){
  const kit=createRoomKit();kit.room({w:12,d:9,floorColor:'#cbc3af',wallColor:'#e7e2d4',accent:'#96aa9e'});
  kit.root.name='DayStation';kit.root.userData.furniture=furniture;
  wallAndPlatform(kit);stationTrain(kit);
  for(const p of furniture){
    if(p.kind==='bench')kit.bench(p);
    else if(p.kind==='counter'){const g=kit.table(p);kit.box('counter-front',{y:FLOOR+.48,z:p.d/2-.04,w:p.w-.13,h:.82,d:.075,color:'#cfc6ab'},g);kit.sign('ServiceName',{text:'服务台',x:p.x,y:.66,z:p.z+p.d/2+.005,w:1.52,h:.23,color:'#cfc6ab'});}
    else if(p.kind==='shelf')luggageRack(kit,p);
    else if(p.kind==='edge')kit.box(p.id,{x:p.x,z:p.z,y:FLOOR+p.h/2,w:p.w,h:p.h,d:p.d,color:'#90a699',radius:.015});
    else if(p.kind==='sign')stationSign(kit,p);
    else if(p.kind==='plant')kit.plant(p.x,p.z);
  }
  return kit.finish();
}
