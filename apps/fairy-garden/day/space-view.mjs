import {createRoomKit} from './places/room-kit.mjs?v=fg-02c90601f4c121f4';
import {CORE_SPACES,styleOf} from './spaces.mjs?v=fg-02c90601f4c121f4';

// Furniture remains in named, separate groups. Each group owns its material batches.
// Its layout record also supplies the collision footprint and activity anchors.
export function createSpaceView(id,style='warm'){
 const map=CORE_SPACES[id],p=styleOf(style),k=createRoomKit(),F=.08;
 const b=(name,v,g)=>k.box(name,{color:p.wood,...v},g);
 function window(x,z,w=2.3){
  b('WindowFrame',{x,y:1.95,z,w,h:1.7,d:.09});b('WindowGlass',{x,y:1.95,z:z+.058,w:w-.18,h:1.51,d:.025,color:p.glass});
  b('WindowCross',{x,y:1.95,z:z+.08,w:.06,h:1.53,d:.04,color:p.paper});b('WindowCross',{x,y:1.85,z:z+.08,w:w-.13,h:.055,d:.04,color:p.paper});
  b('WindowSill',{x,y:1.1,z:z+.13,w:w+.2,h:.08,d:.34,color:p.paper});
  for(const s of [-1,1])b('Curtain',{x:x+s*(w/2+.12),y:1.86,z:z+.13,w:.28,h:1.91,d:.1,color:p.fabric});
 }
 function cup(g,x=0,z=0,y=.98){k.cylinder('Cup',{x,z,y,r:.07,h:.13,color:p.paper},g);k.cylinder('Tea',{x,z,y:y+.068,r:.058,h:.008,color:p.dark},g);}
 function lamp(g,x=0,z=0,y=.9){k.cylinder('LampBase',{x,z,y:y+.025,r:.13,h:.05,color:p.dark},g);k.cylinder('LampStem',{x,z,y:y+.25,r:.02,h:.42,color:p.dark},g);k.cylinder('LampShade',{x,z,y:y+.5,r:.23,h:.22,color:p.fabric},g);}
 function notebook(g,x=0,z=0,top=.85){k.book('Notebook',{x,y:F+top+.055,z,w:.36,d:.43,color:p.accent,flat:true},g);b('Pencil',{x:x+.28,y:F+top+.026,z,w:.024,h:.024,d:.32,color:p.dark,heading:.3},g);}
 function books(g,a){
  b('ShelfBack',{y:1.08,w:a.w,h:2,d:.06,z:-a.d/2+.03,color:p.dark},g);
  for(const side of [-1,1])b('ShelfSide',{x:side*(a.w/2-.035),y:1.08,w:.07,h:2,d:a.d},g);
  for(let row=0;row<4;row++){const y=.18+row*.5;b('ShelfBoard',{y,w:a.w,h:.06,d:a.d},g);
   const n=Math.max(2,Math.floor((a.w-.2)/.2));for(let j=0;j<n;j++){const h=.3+(j%3)*.04;k.book('ShelfBook',{x:-a.w/2+.18+j*.2,y:y+h/2+.04,z:0,w:.14,h,d:Math.min(.29,a.d-.12),color:[p.fabric,p.accent,p.paper,p.dark][(j+row)%4]},g);}
  }
 }
 function furniture(a){
  let g;
  if(a.kind==='table'){g=k.table({...a,color:p.wood});
   if(/dining|cafe-table|window-table/.test(a.id)){b('TableRunner',{y:.941,w:a.w*.42,h:.01,d:a.d+.02,color:p.fabric},g);k.cylinder('Plate',{x:-a.w*.2,y:.959,r:.21,h:.025,color:p.paper},g);for(const x of [-a.w*.2-.08,-a.w*.2+.08])k.sphere('Fruit',{x,y:1.015,r:.07,color:p.accent},g);}
   else notebook(g,-a.w*.25,0,a.top||.85);
   cup(g,a.w*.25,0,F+(a.top||.85)+.075);}

  else if(a.kind==='chair')g=k.chair({...a,color:p.fabric});
  else if(a.kind==='plant'){g=k.plant(a.x,a.z);g.rotation.y=a.heading;}
  else {
   g=k.group(a.id,{x:a.x,z:a.z,heading:a.heading});
   if(a.kind==='bed'){
    for(const x of [-1.1,1.1])for(const z of [-1.3,1.3])b('BedLeg',{x,z,y:.22,w:.16,h:.32,d:.16,color:p.dark},g);
    b('BedFrame',{y:.4,w:a.w,h:.22,d:a.d},g);b('Mattress',{y:.6,w:a.w-.12,h:.22,d:a.d-.12,color:p.paper,radius:.08},g);
    b('Headboard',{y:.86,z:-a.d/2+.06,w:a.w+.08,h:1.2,d:.16,color:p.dark,radius:.08},g);
    b('Duvet',{y:.745,z:.53,w:a.w-.17,h:.12,d:a.d-1.0,color:p.fabric,radius:.08},g);
    b('DuvetFold',{y:.79,z:-.55,w:a.w-.15,h:.08,d:.24,color:p.accent},g);
    for(const x of [-.7,.7])b('Pillow',{x,y:.79,z:-1.05,w:1.05,h:.19,d:.58,color:p.paper,radius:.08},g);
   }else if(a.kind==='sofa'||a.kind==='bench'){
    const sofa=a.kind==='sofa';b('SeatBase',{y:.35,w:a.w,h:.3,d:a.d,color:sofa?p.fabric:p.wood},g);
    b('SeatCushion',{y:.49,w:a.w-.09,h:.09,d:a.d-.03,color:sofa?p.fabric:p.wood},g);
    b('SeatBack',{y:.79,z:-a.d/2+.1,w:a.w,h:.75,d:.16,color:sofa?p.fabric:p.wood},g);
    for(const s of [-1,1]){b('SeatLeg',{x:s*(a.w/2-.22),y:.19,w:.11,h:.24,d:a.d-.2,color:p.dark},g);if(sofa)b('SofaArm',{x:s*(a.w/2-.12),y:.6,w:.23,h:.49,d:a.d},g);}
    if(sofa)for(const x of [-a.w*.3,a.w*.3])b('SofaPillow',{x,y:.79,z:-.1,w:.48,h:.47,d:.15,color:p.accent,radius:.08},g);
   }else if(a.kind==='shelf'){if(a.w<a.d){g.rotation.y+=Math.PI/2;books(g,{...a,w:a.d,d:a.w});}else books(g,a);}
   else if(a.kind==='wardrobe'||a.kind==='cabinet'){
    const h=a.kind==='wardrobe'?2.25:.75;b('Cabinet',{y:F+h/2,w:a.w,h,d:a.d,color:p.wood},g);
    const front=a.w<a.d;for(const s of [-1,1]){b('CabinetDoor',{x:front?a.w/2+.016:s*a.w*.25,z:front?s*a.d*.25:a.d/2+.016,y:F+h/2,w:front?.035:a.w/2-.055,h:h-.12,d:front?a.d/2-.055:.035,color:p.fabric},g);b('Handle',{x:front?a.w/2+.042:s*.065,z:front?s*.08:a.d/2+.044,y:F+h*.55,w:.04,h:.15,d:.04,color:p.dark},g);}
    if(a.kind==='cabinet')lamp(g,0,0,F+h);
   }else if(a.kind==='kitchen'||a.kind==='counter'){
    b('CounterBody',{y:.48,w:a.w,h:.8,d:a.d,color:p.fabric},g);b('CounterTop',{y:.92,w:a.w+.06,h:.11,d:a.d+.07,color:p.paper},g);
    for(let n=0;n<Math.floor(a.w);n++){const x=-a.w/2+.5+n;b('CounterDoor',{x,y:.48,z:a.d/2+.016,w:.91,h:.65,d:.025},g);b('CounterHandle',{x,y:.62,z:a.d/2+.04,w:.2,h:.03,d:.025,color:p.dark},g);}
    if(a.kind==='kitchen'){b('Sink',{x:-.8,y:.982,w:.7,h:.015,d:.47,color:p.dark},g);b('SinkBasin',{x:-.8,y:.991,w:.53,h:.01,d:.32,color:p.glass},g);k.cylinder('Tap',{x:-.8,z:-.28,y:1.12,r:.028,h:.28,color:p.dark},g);b('CookTop',{x:.9,y:.984,w:.9,h:.02,d:.55,color:p.dark},g);for(const x of [.66,1.14])k.cylinder('Burner',{x,y:1.003,r:.14,h:.012,color:p.wood},g);}
    else {b('CoffeeMachine',{x:-.75,y:1.22,w:.65,h:.51,d:.44,color:p.dark},g);b('CoffeeMachineFront',{x:-.75,z:.24,y:1.22,w:.5,h:.24,d:.05,color:p.wood},g);cup(g,-.72,.29,1.04);b('PastryTray',{x:.92,y:1.01,w:1.15,h:.05,d:.6,color:p.wood},g);for(const x of [.6,.94,1.26])k.cylinder('Bun',{x,z:.02,y:1.09,r:.12,h:.1,color:p.accent},g);}
   }else if(a.kind==='facade'){
    const shop=a.id==='shop-front';b('Building',{y:a.h/2,w:a.w,h:a.h,d:a.d,color:shop?p.fabric:p.wall},g);
    b('RoofCornice',{y:a.h,w:a.w+.15,h:.22,d:a.d+.13,color:p.dark},g);
    b('Door',{x:shop?-1:0,y:1.05,z:a.d/2+.03,w:1.1,h:2.1,d:.07,color:p.wood},g);b('DoorGlass',{x:shop?-1:0,y:1.4,z:a.d/2+.08,w:.75,h:1,d:.03,color:p.glass},g);
    for(const x of shop?[.6]:[-1.2,1.2]){b('FacadeWindow',{x,y:2,z:a.d/2+.045,w:.8,h:1.1,d:.07,color:p.paper},g);b('FacadeGlass',{x,y:2,z:a.d/2+.09,w:.64,h:.9,d:.02,color:p.glass},g);}
    if(shop){b('ShopSign',{y:2.95,z:a.d/2+.1,w:2.7,h:.4,d:.12,color:p.paper},g);for(const x of [-.7,0,.7])b('SignMark',{x,y:2.95,z:a.d/2+.17,w:.25,h:.12,d:.025,color:p.dark},g);for(let n=0;n<10;n++)b('AwningStripe',{x:-a.w/2+.24+n*.48,y:2.45,z:a.d/2+.4,w:.48,h:.12,d:.85,color:n%2?p.paper:p.accent},g);}
   }else if(a.kind==='tree'){
    k.cylinder('TreeTrunk',{y:1,r:.13,h:1.8,color:p.dark},g);for(const [x,y,z,r]of [[0,2.3,0,.9],[-.4,2,.1,.6],[.4,2.1,.2,.65]]){k.sphere('TreeCrown',{x,y,z,r,color:p.fabric},g);}
   }else if(a.kind==='flowers'){
    b('FlowerBox',{y:.3,w:a.w,h:.44,d:a.d,color:p.wood},g);for(let n=0;n<7;n++){const x=-.65+n*.22;k.cylinder('Stem',{x,y:.63,r:.02,h:.3,color:p.fabric},g);b('Flower',{x,y:.82,w:.16,h:.12,d:.16,color:n%2?p.accent:p.paper,radius:.05},g);}
   }else if(a.kind==='lamp'){
    k.cylinder('StreetPole',{y:1.45,r:.045,h:2.8,color:p.dark},g);b('Lantern',{y:2.75,w:.38,h:.46,d:.38,color:p.paper},g);b('LanternRoof',{y:3,w:.48,h:.12,d:.48,color:p.dark},g);
   }
  }
  g.name=a.id;g.userData.furnitureId=a.id;g.userData.placement={x:a.x,z:a.z,heading:a.heading};return g;
 }
 if(map.outdoor){
  b('StreetGround',{y:-.07,w:16.3,h:.3,d:11.3,color:p.floor});b('WalkingLane',{y:.086,z:1.7,w:15.8,h:.012,d:4.9,color:p.paper,radius:.08});
  for(let n=0;n<18;n++)b('PavingJoint',{x:-7.8+n*.9,y:.094,z:1.7,w:.012,h:.002,d:4.9,color:p.floor,radius:0});
 }else{
  k.room({w:map.bounds.w,d:map.bounds.d,floorColor:p.floor,wallColor:p.wall,accent:p.dark});
  for(const a of map.structure)b(a.id,{x:a.x,z:a.z,y:a.h/2,w:a.w,h:a.h,d:a.d,color:p.wall});
  window(map.id==='dayHome'?3.4:map.id==='dayWork'?2.8:2.5,-map.bounds.d/2+.14, map.id==='dayHome'?3.1:2.5);
  if(id==='dayHome'){
   b('BedroomRug',{x:-4,y:.093,z:-2.8,w:4.65,h:.02,d:4.5,color:p.accent,radius:.12});
   b('LivingRug',{x:-3,y:.095,z:2.2,w:4.8,h:.025,d:3.2,color:p.fabric,radius:.12});
   b('KitchenTiles',{x:3.4,y:.09,z:-3.15,w:5.4,h:.02,d:3.75,color:p.paper,radius:.02});
   for(let n=0;n<6;n++)b('TileJoint',{x:.9+n*.9,y:.102,z:-3.15,w:.009,h:.002,d:3.75,color:p.floor,radius:0});
   b('FutureRug',{x:3.7,y:.092,z:3.35,w:3.5,h:.02,d:2.6,color:p.paper,radius:.15});
   b('BedroomPicture',{x:-4,y:2.1,z:-5.32,w:1.4,h:.87,d:.05,color:p.dark});b('PictureCanvas',{x:-4,y:2.1,z:-5.285,w:1.2,h:.7,d:.02,color:p.paper});
   for(const [x,y]of [[-4.25,2.05],[-3.8,2.2]])b('PictureLeaf',{x,y,z:-5.27,w:.35,h:.24,d:.02,color:p.fabric,radius:.08});
  }else if(id==='dayWork'){
   b('DeskRug',{x:-2.5,y:.094,z:-.4,w:3.8,h:.02,d:3,color:p.paper,radius:.1});
   b('BoardFrame',{x:-2.6,y:2.65,z:-4.35,w:2.9,h:.78,d:.07,color:p.wood});b('Board',{x:-2.6,y:2.65,z:-4.3,w:2.73,h:.61,d:.02,color:p.fabric});
   for(let n=0;n<4;n++)b('PinnedNote',{x:-3.4+n*.54,y:2.66,z:-4.28,w:.32,h:.34,d:.012,color:p.paper,heading:(n%2?1:-1)*.08});
  }else{
   b('CafeRug',{x:-2.4,y:.095,z:1.9,w:3.6,h:.02,d:2.7,color:p.fabric,radius:.12});
   b('MenuFrame',{x:-2.7,y:2.65,z:-4.33,w:2.6,h:.82,d:.06,color:p.wood});b('MenuBoard',{x:-2.7,y:2.65,z:-4.29,w:2.4,h:.64,d:.03,color:p.dark});
   for(let n=0;n<3;n++)b('MenuLine',{x:-2.7,y:2.85-n*.19,z:-4.27,w:1.65-n*.2,h:.025,d:.01,color:p.paper});
  }
 }
 for(const a of map.furniture)furniture(a);
 const shell=k.group('RoomShell');shell.userData.shellPart=true;
 for(const o of [...k.root.children])if(o!==shell&&!o.userData.furnitureId)shell.add(o);
 k.root.userData.layout={id,style,furniture:map.furniture.map(a=>({...a})),zones:map.zones};
 const result=k.finish();result.root.name=id;return result;
}
