import {createRoomKit,roomObstacles,roomSeat} from './room-kit.mjs?v=fg-8c013226fd2a4c96';

const FLOOR=.08,SEAT=.45,DESK=.85;
const COLORS={wood:'#bd9b73',darkWood:'#a88864',wall:'#e9e3d2',sage:'#829b8a',paper:'#f1e8d6',blue:'#8fa6b0',ink:'#697c71'};
const BOOK_COLORS=['#7f9989','#a59a72','#bc9784','#879daa','#d0b994','#b2aca0','#6f8678'];

// The furniture's footprint is also its navigation obstacle; seats use these same centers.
const FURNITURE=[
  {id:'literature-shelf',kind:'shelf',x:-3.20,z:-4.03,w:2.50,d:.58,h:2.32},
  {id:'reference-shelf',kind:'shelf',x:-.46,z:-4.03,w:2.45,d:.58,h:2.32},
  {id:'periodical-cabinet',kind:'cabinet',x:-4.48,z:-1.18,w:.68,d:1.65,h:.78},
  {id:'reading-table',kind:'table',x:-.85,z:.05,w:3.10,d:1.35,top:DESK,work:{'study-notes':{x:-.93,y:DESK+.059,z:.63}},color:COLORS.wood},
  {id:'reading-chair-north',kind:'chair',x:-.85,z:-.88,w:.56,d:.57,heading:0,color:COLORS.sage},
  {id:'reading-chair-south',kind:'chair',x:-1.66,z:.98,w:.56,d:.57,heading:Math.PI,color:COLORS.sage},
  {id:'reading-chair-extra',kind:'chair',x:-.05,z:.98,w:.56,d:.57,heading:Math.PI,color:COLORS.sage},
  {id:'window-desk',kind:'table',x:3.02,z:-2.47,w:1.85,d:.82,top:DESK,color:COLORS.wood},
  {id:'window-chair',kind:'chair',x:3.02,z:-1.80,w:.56,d:.57,heading:Math.PI,color:COLORS.blue},
  {id:'loan-counter',kind:'counter',x:3.03,z:2.02,w:2.40,d:.94,top:DESK,color:COLORS.wood},
  {id:'entrance-plant',kind:'plant',x:-4.34,z:2.91,w:.55,d:.55},
  {id:'window-plant',kind:'plant',x:4.43,z:-3.29,w:.55,d:.55}
];
const PIECES=Object.fromEntries(FURNITURE.map(p=>[p.id,p]));
const SEATS={
  desk:roomSeat(FURNITURE,'reading-chair-north',{x:.01,z:-.88}),
  study:roomSeat(FURNITURE,'reading-chair-south',{x:-2.44,z:.98}),
  extra:roomSeat(FURNITURE,'reading-chair-extra',{x:.73,z:.98}),
  window:roomSeat(FURNITURE,'window-chair',{x:2.24,z:-1.80})
};

export const libraryMap={
  label:'图书馆／阅览室',renderer:'dayLibrary',radius:9,bounds:{w:10,d:9},floor:FLOOR,
  spawn:{x:0,z:4},view:{x:0,z:0},
  furniture:FURNITURE,
  obstacles:roomObstacles(FURNITURE),
  seats:SEATS,
  spots:[
    {id:'choose-book',label:'书架前挑书',description:'站在文学书架前挑选书本、查找资料。',action:'read',gesture:'read',target:{x:PIECES['literature-shelf'].x,z:-3.40},heading:Math.PI,furniture:'literature-shelf'},
    {id:'desk-reading',label:'桌前坐着阅读',description:'坐在阅读桌前看书、查资料，桌面留有书本和笔记。',action:'read',gesture:'read',target:SEATS.desk.approach,heading:SEATS.desk.heading,seat:SEATS.desk,furniture:'reading-table'},
    {id:'study-notes',label:'自习与备考',description:'坐在阅读桌另一侧整理笔记、做题或备考。',action:'work',gesture:'read',target:SEATS.study.approach,heading:SEATS.study.heading,seat:SEATS.study,furniture:'reading-table'},
    {id:'window-reading',label:'窗边独自阅读',description:'在窗边单人座安静阅读，桌边留有笔记和台灯。',action:'read',gesture:'read',target:SEATS.window.approach,heading:SEATS.window.heading,seat:SEATS.window,furniture:'window-desk'},
    {id:'return-book',label:'借阅台归还',description:'站在借阅台前归还书本，或整理要借走的资料。',action:'work',gesture:'read',target:{x:PIECES['loan-counter'].x,z:2.80},heading:Math.PI,furniture:'loan-counter'},
    {id:'exit',label:'入口与离开',description:'从南侧门口进入阅览室，阅读结束后沿通道离开。',action:'rest',gesture:'rest',target:{x:0,z:4},heading:0,furniture:'DoorPostWest'}
  ],
  tour:['choose-book','desk-reading','study-notes','window-reading','return-book','exit']
};

function bookcase(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-back',{y:FLOOR+p.h/2,w:p.w,h:p.h,d:.075,z:-p.d/2+.035,color:COLORS.darkWood},g);
  for(const x of [-p.w/2+.04,p.w/2-.04])kit.box(p.id+'-side',{x,y:FLOOR+p.h/2,w:.08,h:p.h,d:p.d,color:COLORS.wood},g);
  kit.box(p.id+'-plinth',{y:FLOOR+.09,w:p.w,h:.18,d:p.d,color:COLORS.darkWood},g);
  kit.box(p.id+'-cap',{y:FLOOR+p.h-.04,w:p.w+.045,h:.08,d:p.d+.035,color:COLORS.wood},g);
  for(let row=0;row<4;row++){
    const shelf=FLOOR+.23+row*.51;
    kit.box(p.id+'-shelf-'+row,{y:shelf,w:p.w-.11,h:.065,d:p.d-.025,color:COLORS.wood},g);
    let cursor=-p.w/2+.15;
    for(let n=0;n<(row===1||row===3?10:12);n++){
      const width=.12+(n%3)*.014,height=.32+((n+row*3)%5)*.025;
      kit.book(p.id+'-book-'+row+'-'+n,{x:cursor+width/2,y:shelf+.038+height/2,z:.035,w:width,h:height,d:.31,color:BOOK_COLORS[(n+row*2+(p.id==='reference-shelf'?3:0))%BOOK_COLORS.length]},g);
      cursor+=width+.026;
    }
    if(row===1||row===3){
      kit.book(p.id+'-flat-book-'+row,{x:p.w/2-.33,y:shelf+.077,z:.04,w:.37,d:.32,color:BOOK_COLORS[row],flat:true},g);
      kit.book(p.id+'-flat-book-top-'+row,{x:p.w/2-.34,y:shelf+.165,z:.035,w:.34,d:.29,color:BOOK_COLORS[row+1],flat:true},g);
    }
  }
  kit.box(p.id+'-label',{y:FLOOR+p.h-.04,z:p.d/2+.012,w:.57,h:.06,d:.025,color:COLORS.ink},g);
  for(const x of [-.14,0,.14])kit.box(p.id+'-label-mark',{x,y:FLOOR+p.h-.04,z:p.d/2+.028,w:.06,h:.018,d:.012,color:COLORS.paper,radius:0},g);
}

function openBook(kit,name,x,z,heading=0){
  const g=kit.group(name,{x,y:FLOOR+DESK+.027,z,heading});
  for(const side of [-1,1]){
    const yaw=side*.08;
    kit.box(name+'-cover',{x:side*.14,y:-.014,w:.29,h:.015,d:.37,color:COLORS.sage,heading:yaw,radius:.01},g);
    kit.box(name+'-page',{x:side*.14,y:.005,w:.26,h:.025,d:.34,color:COLORS.paper,heading:yaw,radius:.007},g);
    for(let line=0;line<4;line++)kit.box(name+'-line',{x:side*.14,y:.019,z:-.10+line*.059,w:.16,h:.002,d:.005,color:'#c0b9a8',heading:yaw,radius:0},g);
  }
}

function notebook(kit,name,x,z,heading=0){
  const g=kit.group(name,{x,y:FLOOR+DESK+.044,z,heading});
  kit.box(name+'-cover',{y:-.013,w:.35,h:.025,d:.34,color:COLORS.blue,radius:.012},g);
  kit.box(name+'-paper',{y:.005,w:.315,h:.014,d:.31,color:COLORS.paper,radius:.005},g);
  for(let n=0;n<5;n++)kit.box(name+'-line',{y:.014,z:-.11+n*.044,w:.225,h:.002,d:.004,color:'#beb8a8',radius:0},g);
  kit.box(name+'-pencil',{x:.26,y:.008,z:.025,w:.031,h:.031,d:.34,color:'#b79564',heading:.24,radius:.006},g);
}

function window(kit){
  const x=3.02,z=-4.365,y=1.96;
  kit.box('WindowFrame',{x,y,z,w:2.78,h:1.86,d:.075,color:COLORS.wood,radius:.025});
  kit.box('WindowGlass',{x,y,z:z+.048,w:2.57,h:1.64,d:.026,color:'#bbd0cc',radius:.014});
  kit.box('WindowLowerSky',{x,y:y-.42,z:z+.064,w:2.55,h:.72,d:.017,color:'#ccd6c8',radius:0});
  kit.box('WindowCenter',{x,y,z:z+.089,w:.074,h:1.70,d:.065,color:COLORS.paper,radius:.012});
  kit.box('WindowCrossbar',{x,y:y-.15,z:z+.092,w:2.62,h:.065,d:.065,color:COLORS.paper,radius:.012});
  for(const side of [-1,1])kit.box('WindowReflection',{x:x+side*.73,y:y+.26,z:z+.078,w:.06,h:.82,d:.015,color:'#dae2d8',heading:.12,radius:0});
  kit.box('WindowSill',{x,y:1.015,z:-4.245,w:2.92,h:.095,d:.32,color:COLORS.paper,radius:.028});
}

function cabinet(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-body',{y:FLOOR+p.h/2,w:p.w,h:p.h,d:p.d,color:COLORS.darkWood},g);
  kit.box(p.id+'-top',{y:FLOOR+p.h-.025,w:p.w+.06,h:.09,d:p.d+.04,color:COLORS.wood},g);
  for(const z of [-.48,.05,.57]){
    kit.box(p.id+'-drawer',{x:p.w/2+.016,y:FLOOR+.39,z,w:.045,h:.58,d:.45,color:'#cfb38e',radius:.014},g);
    kit.box(p.id+'-handle',{x:p.w/2+.05,y:FLOOR+.46,z,w:.055,h:.045,d:.15,color:COLORS.ink,radius:.01},g);
  }
  for(let n=0;n<3;n++)kit.book('Periodical-'+n,{x:0,y:FLOOR+p.h+.065+n*.087,z:-.38,w:.39,d:.48,color:BOOK_COLORS[n+2],flat:true},g);
}

function lendingCounter(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-body',{y:FLOOR+(p.top-.1)/2,w:p.w-.16,h:p.top-.1,d:p.d-.08,color:'#9bac9a'},g);
  kit.box(p.id+'-top',{y:FLOOR+p.top-.055,w:p.w,h:.11,d:p.d,color:COLORS.wood},g);
  kit.box(p.id+'-front-inset',{y:FLOOR+.42,z:p.d/2-.026,w:p.w-.38,h:.45,d:.055,color:'#b3c0aa'},g);
  kit.box(p.id+'-return-tray',{x:.66,y:FLOOR+p.top+.035,z:.025,w:.67,h:.07,d:.57,color:COLORS.darkWood},g);
  for(let n=0;n<3;n++)kit.book('ReturnedBook-'+n,{x:.64,y:FLOOR+p.top+.115+n*.09,z:.016,w:.43,d:.34,color:BOOK_COLORS[n],flat:true},g);
  kit.box(p.id+'-notice',{x:-.76,y:FLOOR+p.top+.16,z:-.19,w:.34,h:.30,d:.045,color:COLORS.paper},g);
  kit.box(p.id+'-notice-line',{x:-.76,y:FLOOR+p.top+.17,z:-.161,w:.23,h:.03,d:.015,color:COLORS.ink,radius:0},g);
  notebook(kit,'LoanNotebook',p.x-.27,p.z+.12,.04);
}

export function createLibrary(){
  const kit=createRoomKit();
  kit.room({w:libraryMap.bounds.w,d:libraryMap.bounds.d,floorColor:'#cdb898',wallColor:COLORS.wall,accent:COLORS.sage});
  kit.box('ReadingRug',{x:-.85,y:FLOOR+.016,z:.21,w:4.25,h:.025,d:3.20,color:'#d9dac3',radius:.14});
  kit.box('ReadingRugBorder',{x:-.85,y:FLOOR+.03,z:1.73,w:4.01,h:.003,d:.028,color:'#c2c7ac',radius:0});
  window(kit);
  for(const p of FURNITURE){
    if(p.kind==='shelf')bookcase(kit,p);
    else if(p.kind==='cabinet')cabinet(kit,p);
    else if(p.kind==='table')kit.table(p);
    else if(p.kind==='chair')kit.chair({...p,seat:SEAT});
    else if(p.kind==='counter')lendingCounter(kit,p);
    else if(p.kind==='plant'){const g=kit.plant(p.x,p.z);g.name=p.id;}
  }
  openBook(kit,'ReadingBook',-1.46,-.12,.08);
  notebook(kit,'StudyNotes',-1.78,.55,-.06);
  kit.book('DeskClosedBook',{x:-1.60,y:FLOOR+DESK+.062,z:.43,w:.34,d:.43,color:BOOK_COLORS[3],flat:true});
  openBook(kit,'WindowBook',3.02,-2.44,-.08);
  notebook(kit,'WindowNotes',3.53,-2.49,.03);
  const lamp=kit.group('WindowLamp',{x:2.38,z:-2.61});
  kit.cylinder('LampBase',{y:FLOOR+DESK+.025,r:.095,h:.045,color:COLORS.ink},lamp);
  kit.cylinder('LampStem',{y:FLOOR+DESK+.23,r:.017,h:.40,color:COLORS.darkWood},lamp);
  kit.box('LampShade',{x:.045,y:FLOOR+DESK+.43,w:.24,h:.12,d:.20,color:COLORS.sage,radius:.04},lamp);
  const picture=kit.group('BotanicalPicture',{x:-4.87,y:1.69,z:1.48,heading:Math.PI/2});
  kit.box('PictureFrame',{w:1.12,h:1.18,d:.08,color:COLORS.wood},picture);
  kit.box('PicturePaper',{z:.047,w:.95,h:1.01,d:.026,color:COLORS.paper},picture);
  kit.box('PictureStem',{z:.065,y:-.08,w:.025,h:.60,d:.012,color:COLORS.ink,radius:0},picture);
  for(const side of [-1,1])for(let n=0;n<3;n++)kit.box('PictureLeaf',{x:side*.10,y:-.21+n*.17,z:.069,w:.22,h:.085,d:.012,color:COLORS.sage,heading:side*.4,radius:.04},picture);
  kit.root.userData.furniture=FURNITURE.map(p=>({...p}));
  kit.root.userData.spots=libraryMap.spots.map(({id,target,seat,furniture})=>({id,target:{...target},seat:seat?{...seat}:null,furniture}));
  const result=kit.finish();result.root.name='DayLibrary';return result;
}
