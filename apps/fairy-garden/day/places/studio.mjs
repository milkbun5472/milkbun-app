import {createRoomKit,roomObstacles,roomSeat,ROOM_SCALE} from './room-kit.mjs?v=fg-15cba47296d70fc5';

const {floor:FLOOR,seat:SEAT,desk:DESK}=ROOM_SCALE;
const C={wood:'#bd9b73',darkWood:'#a88864',paper:'#f0e6d2',sage:'#8b9e89',blue:'#8da5ae',clay:'#ba9687',cream:'#ded3bb',ink:'#71837a'};
const furniture=[
  {id:'studio-easel',kind:'easel',x:-2.42,z:-2.53,w:1.26,d:1.10,h:2.12,work:{easel:{x:-.12,y:.88,z:.418}}},
  {id:'work-table',kind:'table',x:-.40,z:-.20,w:3.30,d:1.55,top:DESK,color:C.wood},
  {id:'drawing-chair',kind:'chair',x:-.40,z:-1.25,w:.56,d:.57,seat:SEAT,heading:0,color:C.sage},
  {id:'handcraft-chair',kind:'chair',x:-.95,z:.85,w:.56,d:.57,seat:SEAT,heading:Math.PI,color:C.clay},
  {id:'spare-chair',kind:'chair',x:.65,z:.85,w:.56,d:.57,seat:SEAT,heading:Math.PI,color:C.sage},
  {id:'materials-rack',kind:'materials',x:-4.40,z:-2.30,w:.74,d:2.20,h:2.16,levels:[.18,.69,1.20,1.71]},
  {id:'materials-cabinet',kind:'cabinet',x:-4.42,z:.55,w:.76,d:1.50,h:.82},
  {id:'paint-cart',kind:'cart',x:-1.78,z:-3.97,w:1.22,d:.61,top:.68},
  {id:'gallery-wall',kind:'gallery',x:2.67,z:-4.315,w:3.35,d:.19,h:1.76},
  {id:'gallery-console',kind:'console',x:2.67,z:-3.82,w:2.90,d:.62,h:.65},
  {id:'drying-rack',kind:'drying',x:3.18,z:-.55,w:1.55,d:1.00,h:1.25},
  {id:'canvas-storage',kind:'canvasStorage',x:-2.74,z:2.62,w:1.38,d:.72,h:1.20},
  {id:'rest-chair',kind:'chair',x:3.42,z:2.55,w:.57,d:.56,seat:SEAT,heading:-Math.PI/2,color:C.blue},
  {id:'rest-side-table',kind:'table',x:4.42,z:2.77,w:.60,d:.64,top:.57,color:C.wood},
  {id:'entrance-plant',kind:'plant',x:-4.36,z:3.43,w:.66,d:.66},
  {id:'gallery-plant',kind:'plant',x:4.42,z:-2.82,w:.66,d:.66}
];
const piece=id=>furniture.find(p=>p.id===id);
const seats={
  drawing:roomSeat(furniture,'drawing-chair',{x:.40,z:-1.25}),
  handcraft:roomSeat(furniture,'handcraft-chair',{x:-1.78,z:.85}),
  spare:roomSeat(furniture,'spare-chair',{x:1.46,z:.85}),
  rest:roomSeat(furniture,'rest-chair',{x:2.60,z:2.55})
};

export const studioMap={
  label:'创作工作室',renderer:'dayStudio',radius:9,bounds:{w:10,d:9},floor:FLOOR,
  spawn:{x:0,z:4},view:{x:0,z:0},furniture,obstacles:roomObstacles(furniture),seats,
  spots:[
    {id:'entrance',label:'工作室入口',description:'从南侧进入工作室，沿中央通路走向画架、工作桌和展示区。',action:'rest',gesture:'rest',target:{x:0,z:3.30},heading:Math.PI,furniture:'Threshold'},
    {id:'easel',label:'画架前站位',description:'站着持画笔在画布上作画，再退后查看作品。',action:'work',gesture:'rest',target:{x:piece('studio-easel').x,z:-1.70},heading:Math.PI,furniture:'studio-easel'},
    {id:'drawing',label:'画桌坐位',description:'坐着持笔绘画、设计和整理草图，笔尖落在桌面纸上。',action:'work',gesture:'rest',target:seats.drawing.approach,heading:seats.drawing.heading,seat:seats.drawing,furniture:'work-table'},
    {id:'handcraft',label:'手作坐位',description:'适合坐着做手工、裁剪和整理作品的位置，桌面材料可按创作方向替换。',action:'work',gesture:'rest',target:seats.handcraft.approach,heading:seats.handcraft.heading,seat:seats.handcraft,furniture:'work-table'},
    {id:'materials',label:'材料架前',description:'在架前挑选颜料、布料或手工材料，随后走向画架或工作桌。',action:'work',gesture:'rest',target:{x:-3.42,z:piece('materials-rack').z},heading:-Math.PI/2,furniture:'materials-rack'},
    {id:'storage',label:'收纳柜前',description:'在柜前打开柜门，整理备用材料、工具和作品资料。',action:'work',gesture:'rest',target:{x:-3.37,z:piece('materials-cabinet').z},heading:-Math.PI/2,furniture:'materials-cabinet'},
    {id:'gallery',label:'站着看作品',description:'留出退后观察作品、比对颜色和挑选展示内容的距离。',action:'rest',gesture:'rest',target:{x:piece('gallery-wall').x,z:-2.65},heading:Math.PI,furniture:'gallery-wall'},
    {id:'drying',label:'整理与晾放作品',description:'创作结束后走到架前整理画纸、半成品与完成作品。',action:'work',gesture:'rest',target:{x:piece('drying-rack').x,z:.68},heading:Math.PI,furniture:'drying-rack'},
    {id:'rest',label:'创作间隙休息',description:'坐着休息、翻看草图或思考下一件作品的位置。',action:'rest',gesture:'rest',target:seats.rest.approach,heading:seats.rest.heading,seat:seats.rest,furniture:'rest-chair'},
    {id:'exit',label:'整理后离开',description:'结束创作后沿通路走回南侧出口。',action:'rest',gesture:'rest',target:{x:0,z:4},heading:0,furniture:'Threshold'}
  ],
  tour:['entrance','materials','easel','drawing','handcraft','storage','gallery','drying','rest','exit']
};

function artPanel(kit,name,{x=0,y=0,z=0,w=1,h=1,colors=[C.blue,C.sage,C.clay]}={},parent=kit.root){
  const g=kit.group(name,{x,y,z},parent);
  kit.box(name+'-frame',{w,h,d:.08,color:C.wood,radius:.015},g);
  kit.box(name+'-canvas',{z:.048,w:w-.12,h:h-.12,d:.025,color:C.paper,radius:.007},g);
  kit.box(name+'-sky',{x:0,y:h*.17,z:.066,w:w*.71,h:h*.29,d:.008,color:colors[0],radius:0},g);
  kit.box(name+'-horizon',{x:w*.04,y:-h*.13,z:.073,w:w*.73,h:h*.30,d:.009,color:colors[1],radius:0},g);
  const hill=kit.box(name+'-hill',{x:-w*.16,y:-h*.20,z:.082,w:w*.40,h:h*.22,d:.009,color:colors[2],radius:0},g);hill.rotation.z=-.10;
  kit.cylinder(name+'-sun',{x:w*.21,y:h*.24,z:.075,r:Math.min(w,h)*.075,h:.012,color:C.cream,rotation:[Math.PI/2,0,0]},g);
  return g;
}

function easel(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  for(const side of [-1,1]){
    const leg=kit.box(p.id+'-front-leg',{x:side*.40,y:FLOOR+.93,z:.30,w:.085,h:1.86,d:.085,color:C.darkWood},g);leg.rotation.z=side*.09;
  }
  const rear=kit.box(p.id+'-rear-leg',{y:FLOOR+.90,z:-.25,w:.085,h:1.80,d:.085,color:C.darkWood},g);rear.rotation.x=.15;
  kit.box(p.id+'-mast',{y:FLOOR+1.06,z:.045,w:.095,h:p.h,d:.085,color:C.wood},g);
  kit.box(p.id+'-canvas-tray',{y:FLOOR+.57,z:.36,w:1.04,h:.085,d:.44,color:C.wood},g);
  const canvas=artPanel(kit,'EaselCanvas',{y:FLOOR+.95,z:.35,w:.98,h:.90},g);canvas.rotation.x=0;
  kit.box(p.id+'-canvas-clip',{y:FLOOR+1.46,z:.35,w:.20,h:.08,d:.11,color:C.darkWood},g);
}

function materialsRack(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-back',{x:-p.w/2+.035,y:FLOOR+p.h/2,w:.07,h:p.h,d:p.d,color:C.darkWood},g);
  for(const side of [-1,1])kit.box(p.id+'-side',{y:FLOOR+p.h/2,z:side*(p.d/2-.035),w:p.w,h:p.h,d:.07,color:C.wood},g);
  for(const level of [...p.levels,p.h])kit.box(p.id+'-shelf',{y:FLOOR+level-.035,w:p.w,h:.07,d:p.d,color:C.wood},g);
  for(const z of [-.70,0,.70]){
    kit.box(p.id+'-basket',{x:.025,y:FLOOR+p.levels[0]+.135,z,w:.55,h:.24,d:.55,color:C.cream,radius:.025},g);
    kit.box(p.id+'-basket-label',{x:.315,y:FLOOR+p.levels[0]+.14,z,w:.016,h:.095,d:.19,color:C.paper,radius:.002},g);
  }
}

function cabinet(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-back',{x:-p.w/2+.035,y:FLOOR+p.h/2,w:.07,h:p.h,d:p.d-.04,color:C.darkWood},g);
  for(const side of [-1,1])kit.box(p.id+'-side',{y:FLOOR+p.h/2,z:side*(p.d/2-.035),w:p.w,h:p.h,d:.07,color:C.wood},g);
  for(const level of [.06,.4])kit.box(p.id+'-shelf',{y:FLOOR+level,w:p.w,h:.06,d:p.d-.10,color:C.wood},g);
  for(const z of [-.42,.35])kit.box(p.id+'-supplies',{x:-.08,y:FLOOR+.18,z,w:.44,h:.20,d:.36,color:C.cream,radius:.014},g);
  kit.box(p.id+'-top',{y:FLOOR+p.h-.04,w:p.w,h:.08,d:p.d,color:C.wood},g);
  for(const z of [-p.d/4,p.d/4]){
    kit.hingedDoor(p.id+'-door',{x:p.w/2-.025,y:FLOOR+p.h/2,z,w:.04,h:p.h-.12,d:p.d/2-.065,color:C.sage,axis:'x',sign:z<0?-1:1,furniture:p.id},g);
  }
  kit.box('StoragePortfolio',{y:FLOOR+p.h+.052,z:.35,w:.51,h:.09,d:.54,color:C.blue,radius:.015},g);
}

function cart(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  for(const x of [-p.w/2+.10,p.w/2-.10])for(const z of [-p.d/2+.09,p.d/2-.09]){
    kit.box(p.id+'-leg',{x,y:FLOOR+p.top/2,z,w:.06,h:p.top-.05,d:.06,color:C.darkWood},g);
    kit.cylinder(p.id+'-wheel',{x,y:FLOOR+.063,z,r:.055,h:.043,color:C.ink,rotation:[0,0,Math.PI/2]},g);
  }
  for(const top of [.18,p.top])kit.box(p.id+'-tray',{y:FLOOR+top-.045,w:p.w,h:.09,d:p.d,color:C.sage},g);
  kit.box(p.id+'-lower-box',{y:FLOOR+.33,w:.60,h:.22,d:.42,color:C.cream},g);
}

function gallery(kit,p){
  const g=kit.group(p.id,{x:p.x,y:2.05,z:p.z-.02});
  kit.box('GalleryRail',{y:.80,z:-.03,w:p.w-.15,h:.055,d:.055,color:C.darkWood,radius:.009},g);
  artPanel(kit,'GalleryPictureLeft',{x:-.78,y:0,z:0,w:1.22,h:1.36},g);
  artPanel(kit,'GalleryPictureRight',{x:.78,y:.05,z:0,w:1.22,h:1.11,colors:[C.clay,C.blue,C.sage]},g);
  for(const x of [-.78,.78])kit.box('GalleryLabel',{x,y:-.76,z:.05,w:.43,h:.07,d:.022,color:C.paper,radius:.002},g);
}

function console(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-body',{y:FLOOR+p.h/2,w:p.w,h:p.h-.08,d:p.d-.045,color:C.sage},g);
  kit.box(p.id+'-top',{y:FLOOR+p.h-.025,w:p.w,h:.075,d:p.d,color:C.wood},g);
  for(const x of [-.9,0,.9]){
    kit.box(p.id+'-door',{x,y:FLOOR+p.h*.48,z:p.d/2-.025,w:.77,h:p.h-.17,d:.035,color:'#b7bda2'},g);
    kit.box(p.id+'-handle',{x,y:FLOOR+p.h*.59,z:p.d/2-.012,w:.17,h:.022,d:.015,color:C.ink,radius:.002},g);
  }
  kit.book('PortfolioAlbum',{x:-.69,y:FLOOR+p.h+.06,z:.005,w:.51,d:.45,color:C.blue,flat:true},g);
  kit.box('GallerySculptureBase',{x:.80,y:FLOOR+p.h+.025,z:.01,w:.30,h:.05,d:.30,color:C.darkWood},g);
  kit.cylinder('GalleryClayStudy',{x:.80,y:FLOOR+p.h+.19,z:.01,r:.11,h:.28,color:C.clay},g);
}

function dryingRack(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  for(const x of [-p.w/2+.07,p.w/2-.07])for(const z of [-p.d/2+.06,p.d/2-.06])kit.box(p.id+'-leg',{x,y:FLOOR+p.h/2,z,w:.065,h:p.h,d:.065,color:C.darkWood},g);
  for(const height of [.24,.66,1.08]){
    kit.box(p.id+'-shelf',{y:FLOOR+height,w:p.w,h:.055,d:p.d,color:C.wood},g);
    kit.box(p.id+'-paper',{x:-.11,y:FLOOR+height+.04,z:.035,w:1.12,h:.018,d:.72,color:C.paper,radius:.005},g);
    kit.box(p.id+'-study',{x:-.15,y:FLOOR+height+.052,z:.035,w:.75,h:.006,d:.44,color:height===.66?C.clay:C.blue,radius:0},g);
    kit.box(p.id+'-study-patch',{x:.03,y:FLOOR+height+.057,z:.05,w:.30,h:.004,d:.30,color:C.sage,radius:0},g);
  }
}

function canvasStorage(kit,p){
  const g=kit.group(p.id,{x:p.x,z:p.z});
  kit.box(p.id+'-base',{y:FLOOR+.045,w:p.w,h:.09,d:p.d,color:C.darkWood},g);
  for(const x of [-p.w/2+.04,p.w/2-.04])kit.box(p.id+'-side',{x,y:FLOOR+.55,w:.07,h:1.10,d:p.d,color:C.wood},g);
  for(let n=0;n<4;n++){
    const z=-.24+n*.145,h=.79+(n%2)*.16;
    kit.box(p.id+'-frame',{y:FLOOR+.10+h/2,z,w:1.12,h,d:.065,color:n%2?C.clay:C.wood,radius:.006},g);
    kit.box(p.id+'-blank-canvas',{y:FLOOR+.10+h/2,z:z+.036,w:.99,h:h-.12,d:.01,color:C.paper,radius:0},g);
  }
}

function surfaceAnchor(kit,id,parent){
  const p=piece(id),top=p.top??p.h;
  const g=kit.group('StudioSurface:'+id,{x:p.x,y:FLOOR+top,z:p.z},parent);
  g.userData.furniture=id;g.userData.surface=FLOOR+top;return g;
}

function paintMaterials(kit,parent){
  const desk=surfaceAnchor(kit,'work-table',parent),cart=surfaceAnchor(kit,'paint-cart',parent),rack=piece('materials-rack');
  kit.cylinder('PaintPalette',{x:-.36,y:.030,z:.17,r:.25,h:.035,color:C.cream},desk);
  for(let n=0;n<5;n++){const a=n*.95;kit.cylinder('PaintSwatch',{x:-.36+Math.sin(a)*.15,y:.054,z:.17+Math.cos(a)*.15,r:.031,h:.014,color:[C.clay,C.sage,C.blue,C.paper,C.ink][n]},desk);}
  kit.cylinder('BrushPot',{x:1.11,y:.115,z:-.39,r:.105,h:.23,color:C.clay},desk);
  for(let n=0;n<4;n++){
    kit.box('BrushHandle',{x:1.055+n*.035,y:.29,z:-.39,w:.016,h:.35,d:.016,color:C.darkWood,radius:.002},desk);
    kit.box('BrushBristle',{x:1.055+n*.035,y:.46,z:-.39,w:.024,h:.075,d:.027,color:n%2?C.paper:C.blue,radius:.003},desk);
  }
  for(let n=0;n<3;n++){
    kit.cylinder('PaintTube',{x:-1.15+n*.20,y:.055,z:-.39,r:.040,h:.16,color:[C.sage,C.clay,C.blue][n],rotation:[Math.PI/2,0,0]},desk);
    kit.cylinder('PaintTubeCap',{x:-1.15+n*.20,y:.055,z:-.30,r:.029,h:.035,color:C.paper,rotation:[Math.PI/2,0,0]},desk);
  }
  kit.cylinder('WaterJar',{x:-.27,y:.14,z:.005,r:.105,h:.28,color:C.blue},cart);
  kit.cylinder('WaterJarRim',{x:-.27,y:.286,z:.005,r:.11,h:.025,color:C.paper},cart);
  kit.box('CartPaintTray',{x:.28,y:.028,z:0,w:.40,h:.055,d:.38,color:C.cream},cart);
  for(let n=0;n<3;n++)kit.cylinder('CartPaintPot',{x:.19+n*.10,y:.104,z:0,r:.045,h:.12,color:[C.clay,C.sage,C.blue][n]},cart);
  const supply=kit.group('StudioSurface:materials-rack',{x:rack.x,z:rack.z},parent);supply.userData.furniture=rack.id;
  for(const level of rack.levels.slice(1))for(let n=0;n<4;n++){
    const z=-.76+n*.50,y=FLOOR+level;
    kit.cylinder('ShelfPaintJar',{x:.03,y:y+.13,z,r:.105,h:.26,color:[C.clay,C.sage,C.blue,C.cream][n]},supply);
    kit.cylinder('ShelfPaintLid',{x:.03,y:y+.27,z,r:.11,h:.035,color:C.paper},supply);
  }
}

function fabricMaterials(kit,parent){
  const desk=surfaceAnchor(kit,'work-table',parent),cart=surfaceAnchor(kit,'paint-cart',parent),rack=piece('materials-rack');
  kit.box('FabricWorkcloth',{x:-.18,y:.022,z:.08,w:1.52,h:.035,d:.76,color:C.blue,radius:.009},desk);
  kit.box('FabricFold',{x:-.44,y:.042,z:.08,w:.47,h:.025,d:.74,color:C.sage,radius:.004},desk);
  for(let n=0;n<5;n++)kit.box('FabricSeam',{x:-.52+n*.16,y:.061,z:.08,w:.008,h:.002,d:.56,color:C.paper,radius:0},desk);
  kit.box('SewingBox',{x:1.10,y:.095,z:-.33,w:.39,h:.19,d:.38,color:C.clay},desk);
  kit.box('SewingBoxLid',{x:1.10,y:.197,z:-.33,w:.41,h:.035,d:.40,color:C.cream,radius:.014},desk);
  for(let n=0;n<3;n++)kit.cylinder('ThreadSpool',{x:-1.31+n*.17,y:.082,z:-.39,r:.050,h:.16,color:[C.sage,C.clay,C.cream][n]},desk);
  kit.box('PatternPaper',{x:.88,y:.012,z:.23,w:.64,h:.018,d:.46,color:C.paper,radius:.003},desk);
  kit.box('PatternLine',{x:.88,y:.024,z:.23,w:.25,h:.003,d:.31,color:C.cream,radius:0},desk);
  kit.box('FabricCartBasket',{y:.14,w:.98,h:.28,d:.46,color:C.cream},cart);
  for(let n=0;n<3;n++)kit.cylinder('BasketFabricRoll',{x:-.30+n*.30,y:.31,z:.005,r:.105,h:.32,color:[C.sage,C.blue,C.clay][n],rotation:[Math.PI/2,0,0]},cart);
  const supply=kit.group('StudioSurface:materials-rack',{x:rack.x,z:rack.z},parent);supply.userData.furniture=rack.id;
  for(let level=1;level<rack.levels.length;level++)for(let n=0;n<3;n++){
    const y=FLOOR+rack.levels[level],z=-.70+n*.70;
    kit.cylinder('ShelfFabricRoll',{x:.015,y:y+.12,z,r:.12,h:.55,color:[C.sage,C.blue,C.clay][(n+level)%3],rotation:[0,0,Math.PI/2]},supply);
    kit.cylinder('FabricRollCore',{x:.298,y:y+.12,z,r:.036,h:.018,color:C.paper,rotation:[0,0,Math.PI/2]},supply);
  }
}

function craftMaterials(kit,parent){
  const desk=surfaceAnchor(kit,'work-table',parent),cart=surfaceAnchor(kit,'paint-cart',parent),rack=piece('materials-rack');
  kit.box('CraftToolTray',{x:-.30,y:.029,z:.12,w:1.18,h:.055,d:.62,color:C.sage},desk);
  kit.box('HammerHandle',{x:-.58,y:.077,z:.12,w:.035,h:.035,d:.42,color:C.darkWood,heading:.18,radius:.003},desk);
  kit.box('HammerHead',{x:-.62,y:.077,z:-.05,w:.21,h:.09,d:.07,color:C.ink,radius:.012},desk);
  for(const side of [-1,1]){
    kit.box('ScissorBlade',{x:-.02+side*.030,y:.073,z:.15,w:.022,h:.02,d:.25,color:C.cream,heading:side*.18,radius:.002},desk);
    kit.box('ScissorGrip',{x:-.02+side*.064,y:.077,z:.29,w:.075,h:.035,d:.14,color:C.clay,heading:side*.18,radius:.012},desk);
  }
  kit.box('CraftKnife',{x:.20,y:.07,z:.10,w:.04,h:.025,d:.33,color:C.wood,heading:-.12,radius:.003},desk);
  for(let n=0;n<3;n++)kit.box('CraftPaperStack',{x:1.18,y:.02+n*.017,z:-.24,w:.50,h:.018,d:.67,color:[C.paper,C.clay,C.blue][n],radius:.003},desk);
  kit.box('CraftBlock',{x:-1.27,y:.062,z:-.38,w:.28,h:.12,d:.23,color:C.clay},desk);
  kit.box('CraftCartBox',{y:.135,w:.95,h:.27,d:.47,color:C.blue},cart);
  kit.box('CraftCartLid',{y:.284,w:.97,h:.035,d:.49,color:C.cream},cart);
  const supply=kit.group('StudioSurface:materials-rack',{x:rack.x,z:rack.z},parent);supply.userData.furniture=rack.id;
  for(let level=1;level<rack.levels.length;level++)for(let n=0;n<3;n++){
    const y=FLOOR+rack.levels[level],z=-.70+n*.70;
    kit.box('ShelfCraftBox',{x:.005,y:y+.15,z,w:.56,h:.30,d:.58,color:[C.clay,C.blue,C.cream][(n+level)%3]},supply);
    kit.box('CraftBoxLabel',{x:.292,y:y+.16,z,w:.014,h:.105,d:.24,color:C.paper,radius:.003},supply);
  }
}

export function createStudio({materials='paint'}={}){
  const kit=createRoomKit(),mode=['paint','fabric','craft','none'].includes(materials)?materials:'paint';
  kit.room({w:10,d:9,floorColor:'#d1bfa5',wallColor:'#ece2d4',accent:C.clay});
  kit.box('WorkAreaRug',{x:-.40,y:FLOOR+.012,z:.17,w:4.02,h:.02,d:3.34,color:'#d9d6bc',radius:.12});
  for(const p of furniture){
    if(p.kind==='easel')easel(kit,p);
    else if(p.kind==='table')kit.table(p);
    else if(p.kind==='chair')kit.chair(p);
    else if(p.kind==='materials')materialsRack(kit,p);
    else if(p.kind==='cabinet')cabinet(kit,p);
    else if(p.kind==='cart')cart(kit,p);
    else if(p.kind==='gallery')gallery(kit,p);
    else if(p.kind==='console')console(kit,p);
    else if(p.kind==='drying')dryingRack(kit,p);
    else if(p.kind==='canvasStorage')canvasStorage(kit,p);
    else if(p.kind==='plant'){const g=kit.plant(p.x,p.z);g.name=p.id;}
  }
  const p=piece('work-table'),top=FLOOR+p.top,sketch=kit.group('StudioSketchbook',{x:p.x+.12,y:top+.045,z:p.z-.60});
  kit.box('SketchbookCover',{w:.65,h:.045,d:.47,color:C.cream,radius:.015},sketch);
  kit.box('SketchbookPaper',{y:.028,w:.60,h:.012,d:.43,color:C.paper,radius:.005},sketch);
  kit.box('SketchbookDrawing',{x:-.10,y:.036,z:.005,w:.19,h:.002,d:.26,color:C.sage,radius:0},sketch);
  kit.box('HandcraftMat',{x:-1.07,y:top+.025,z:.48,w:.58,h:.045,d:.28,color:C.cream,radius:.01});
  kit.box('HandcraftFabric',{x:-1.07,y:top+.055,z:.48,w:.38,h:.018,d:.23,color:C.clay,radius:.01});
  const rest=piece('rest-side-table');
  kit.book('RestArtBook',{x:rest.x,y:FLOOR+rest.top+.055,z:rest.z-.035,w:.30,d:.36,color:C.blue,flat:true});
  const group=kit.replaceableGroup('StudioMaterials');group.userData.materials=mode;
  if(mode==='paint')paintMaterials(kit,group);
  else if(mode==='fabric')fabricMaterials(kit,group);
  else if(mode==='craft')craftMaterials(kit,group);
  kit.root.userData.furniture=furniture;
  kit.root.userData.materials=mode;
  kit.root.userData.materialAnchors=['work-table','paint-cart'].map(id=>{const p=piece(id);return {furniture:id,x:p.x,z:p.z,w:p.w,d:p.d,surface:FLOOR+p.top};});
  const rack=piece('materials-rack');kit.root.userData.materialAnchors.push({furniture:rack.id,x:rack.x,z:rack.z,w:rack.w,d:rack.d,surfaces:rack.levels.map(level=>FLOOR+level)});
  const work=kit.replaceableGroup('DayWorkProgress');work.userData.dayWork=true;
  const easelPiece=piece('studio-easel');
  for(let n=0;n<12;n++){const stroke=kit.replaceableGroup('WorkStroke:'+n,{x:easelPiece.x-.28+(n%4)*.17,y:FLOOR+.76+Math.floor(n/4)*.09,z:easelPiece.z+.434},work);stroke.userData.workStroke=n;stroke.userData.workKind='paint';kit.box('PaintStroke',{w:.13,h:.025,d:.012,color:[C.sage,C.clay,C.blue][n%3]},stroke);stroke.visible=false;}
  const completed=kit.replaceableGroup('WorkCraftResult',{x:p.x+.35,y:top+.04,z:p.z+.05});completed.userData.workStroke=10;completed.userData.workKind='craft';
  if(mode==='fabric'){kit.box('FinishedFabric',{w:.65,h:.055,d:.38,color:C.blue},completed);for(let n=0;n<6;n++)kit.box('FinishedSeam',{x:-.26+n*.105,y:.03,w:.005,h:.003,d:.29,color:C.paper},completed);}
  else{kit.cylinder('ClayWork',{y:.12,r:.12,h:.24,color:C.clay},completed);kit.cylinder('ClayRim',{y:.245,r:.13,h:.025,color:C.cream},completed);}
  completed.visible=false;
  const result=kit.finish();result.root.name='DayStudio';return result;
}
