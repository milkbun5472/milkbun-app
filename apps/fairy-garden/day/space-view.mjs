import {HOME_WALLS,HOME_FLOORS,furniturePrimary,furniturePalette} from './home-catalog.mjs?v=fg-f9a3c901abadb37b';
import {furnitureFinish} from './home-finish.mjs?v=fg-f9a3c901abadb37b';
import {createHomeShell} from './home-shell.mjs?v=fg-f9a3c901abadb37b';
import {createHomeFurniture} from './home-furniture.mjs?v=fg-f9a3c901abadb37b';
import {createRoomKit} from './places/room-kit.mjs?v=fg-f9a3c901abadb37b';
import {CORE_SPACES,styleOf} from './spaces.mjs?v=fg-f9a3c901abadb37b';

// Furniture remains in named, separate groups. Each group owns its material batches.
// Its layout record also supplies the collision footprint and activity anchors.
export function createSpaceView(id,style='warm',layout=CORE_SPACES[id],{furnitureOnly=false}={}){
 const map=layout,base=styleOf(style),k=createRoomKit(),F=.08;let p=base;
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
  const finish=furniturePrimary(a,base),primary=finish.color;p={...furniturePalette(a,base),...(a.color?{[finish.field]:a.color}:{})};
  let g;
  if(id==='dayHome')g=createHomeFurniture(k,a,p);
  else if(a.kind==='table'){g=k.table({...a,color:p.wood});g.rotation.y=a.heading;
   if(a.variant==='round'){const top=g.children.find(o=>o.name===a.id+'-top');top.parent.remove(top);top.geometry.dispose();k.cylinder('RoundTableTop',{y:F+(a.top||.85)-.055,r:a.w/2,h:.11,color:p.wood},g);}
   if(a.dining||/dining|cafe-table|window-table/.test(a.id)){b('TableRunner',{y:.941,w:a.w*.42,h:.01,d:a.d+.02,color:p.fabric},g);k.cylinder('Plate',{x:-a.w*.2,y:.959,r:.21,h:.025,color:p.paper},g);for(const x of [-a.w*.2-.08,-a.w*.2+.08])k.sphere('Fruit',{x,y:1.015,r:.07,color:p.accent},g);}
   else notebook(g,-a.w*.25,0,a.top||.85);
   cup(g,a.w*.25,0,F+(a.top||.85)+.075);}

  else if(a.kind==='chair'){g=k.chair({...a,color:p.fabric});if(a.variant==='slat'){const back=g.children.find(o=>o.name===a.id+'-back');back.parent.remove(back);back.geometry.dispose();for(const x of [-.22,0,.22])b('ChairSlat',{x,y:.83,z:-.245,w:.06,h:.54,d:.075,color:p.fabric},g);}}
  else if(a.kind==='bench')g=k.bench({...a,color:p.wood,legColor:p.dark,solid:true});
  else if(a.kind==='plant'){g=k.group(a.id,{x:a.x,z:a.z,heading:a.heading});k.cylinder('PlantPot',{y:.25,r:a.w*.36,h:.34,color:p.accent},g);const tall=a.variant==='tall';if(tall)k.cylinder('PlantStem',{y:.83,r:.035,h:1.25,color:p.dark},g);for(let i=0;i<7;i++){const angle=i*2.4,leaf=b('PlantLeaf',{x:Math.sin(angle)*a.w*.26,y:(tall?.87:.58)+i*.04,z:Math.cos(angle)*a.d*.26,w:a.w*.28,h:tall?.55:.4,d:.075,color:p.fabric},g);leaf.rotation.z=Math.sin(angle)*.5;}}
  else {
   g=k.group(a.id,{x:a.x,z:a.z,heading:a.heading});
   if(a.kind==='bed'){
    for(const x of [-a.w*.37,a.w*.37])for(const z of [-a.d*.39,a.d*.39])b('BedLeg',{x,z,y:.22,w:.16,h:.32,d:.16,color:p.dark},g);
    b('BedFrame',{y:.4,w:a.w,h:.22,d:a.d},g);b('Mattress',{y:.6,w:a.w-.12,h:.22,d:a.d-.12,color:p.paper,radius:.08},g);
    b('Headboard',{y:.86,z:-a.d/2+.06,w:a.w+.08,h:1.2,d:.16,color:a.variant==='soft'?p.fabric:p.dark,radius:a.variant==='soft'?.13:.08},g);
    if(a.variant==='soft')for(const x of [-.7,0,.7])b('HeadboardSeam',{x,y:.94,z:-a.d/2+.15,w:.012,h:.86,d:.008,color:p.paper,radius:0},g);
    b('Duvet',{y:.745,z:.53,w:a.w-.17,h:.12,d:a.d-1.0,color:p.fabric,radius:.08},g);
    b('DuvetFold',{y:.79,z:-.55,w:a.w-.15,h:.08,d:.24,color:p.accent},g);
    for(const x of [-.7,.7])b('Pillow',{x,y:.79,z:-1.05,w:1.05,h:.19,d:.58,color:p.paper,radius:.08},g);
   }else if(a.kind==='sofa'){
    b('SeatBase',{y:.35,w:a.w,h:.3,d:a.d,color:p.fabric},g);
    b('SeatCushion',{y:.49,w:a.w-.09,h:.09,d:a.d-.03,color:p.fabric},g);
    b('SeatBack',{y:.79,z:-a.d/2+.1,w:a.w,h:.75,d:.16,color:p.fabric},g);
    for(const s of [-1,1]){b('SeatLeg',{x:s*(a.w/2-.22),y:.19,w:.11,h:.24,d:a.d-.2,color:p.dark},g);b('SofaArm',{x:s*(a.w/2-.12),y:.6,w:.23,h:.49,d:a.d},g);}
    for(const x of [-a.w*.3,a.w*.3])b('SofaPillow',{x,y:.79,z:-.1,w:.48,h:.47,d:.15,color:p.accent,radius:.08},g);
   }else if(a.kind==='shelf'){if(a.w<a.d){g.rotation.y+=Math.PI/2;books(g,{...a,w:a.d,d:a.w});}else books(g,a);}
   else if(a.kind==='wardrobe'||a.kind==='cabinet'){
    const h=a.kind==='wardrobe'?2.25:.75;b('Cabinet',{y:F+h/2,w:a.w,h,d:a.d,color:p.wood},g);
    const front=a.w<a.d;for(const s of [-1,1]){b('CabinetDoor',{x:front?a.w/2+.016:s*a.w*.25,z:front?s*a.d*.25:a.d/2+.016,y:F+h/2,w:front?.035:a.w/2-.055,h:h-.12,d:front?a.d/2-.055:.035,color:p.fabric},g);b('Handle',{x:front?a.w/2+.042:s*.065,z:front?s*.08:a.d/2+.044,y:F+h*.55,w:.04,h:.15,d:.04,color:p.dark},g);}
    if(a.variant==='drawers'){for(const y of [.25,.48,.7]){b('DrawerLine',{y,z:a.d/2+.022,w:a.w-.1,h:.012,d:.01,color:p.dark},g);b('DrawerPull',{y:y-.07,z:a.d/2+.05,w:.24,h:.04,d:.04,color:p.dark},g);}}else if(a.kind==='cabinet')lamp(g,0,0,F+h);
   }else if(a.kind==='kitchen'||a.kind==='counter'){
    b('CounterBody',{y:.48,w:a.w,h:.8,d:a.d,color:p.fabric},g);b('CounterTop',{y:.92,w:a.w+.06,h:.11,d:a.d+.07,color:p.paper},g);
    for(let n=0;n<Math.floor(a.w);n++){const x=-a.w/2+.5+n;b('CounterDoor',{x,y:.48,z:a.d/2+.016,w:.91,h:.65,d:.025},g);b('CounterHandle',{x,y:.62,z:a.d/2+.04,w:.2,h:.03,d:.025,color:p.dark},g);}
    if(a.kind==='kitchen'){b('Sink',{x:-.8,y:.982,w:.7,h:.015,d:.47,color:p.dark},g);b('SinkBasin',{x:-.8,y:.991,w:.53,h:.01,d:.32,color:p.glass},g);k.cylinder('Tap',{x:-.8,z:-.28,y:1.12,r:.028,h:.28,color:p.dark},g);b('CookTop',{x:.9,y:.984,w:.9,h:.02,d:.55,color:p.dark},g);for(const x of [.66,1.14])k.cylinder('Burner',{x,y:1.003,r:.14,h:.012,color:p.wood},g);}
    else if(a.variant==='home'){b('CuttingBoard',{x:-.3,y:1.01,w:.7,h:.04,d:.5,color:p.wood},g);cup(g,.55,0,1.06);}
    else {b('CoffeeMachine',{x:-.75,y:1.22,w:.65,h:.51,d:.44,color:p.dark},g);b('CoffeeMachineFront',{x:-.75,z:.24,y:1.22,w:.5,h:.24,d:.05,color:p.wood},g);cup(g,-.72,.29,1.04);b('PastryTray',{x:.92,y:1.01,w:1.15,h:.05,d:.6,color:p.wood},g);for(const x of [.6,.94,1.26])k.cylinder('Bun',{x,z:.02,y:1.09,r:.12,h:.1,color:p.accent},g);}
   }else if(a.kind==='light'){const y=a.variant==='short'?.75:1.25;if(a.variant==='short')b('LampStand',{y:.33,w:a.w,h:.5,d:a.d,color:p.wood},g);k.cylinder('LightBase',{y:a.variant==='short'?.63:.12,r:.22,h:.06,color:p.dark},g);k.cylinder('LightStem',{y:y/2+.2,r:.025,h:y,color:p.dark},g);k.cylinder('LightShade',{y:y+.28,r:.25,h:.26,color:p.fabric},g);k.sphere('LightBulb',{y:y+.2,r:.075,color:p.paper},g);
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
  g.name=a.id;g.userData.furnitureId=a.id;g.userData.placement={x:a.x,z:a.z,heading:a.heading};g.userData.finish=a.material;g.userData.primary=primary;return g;
 }
 if(!furnitureOnly){
 if(map.outdoor){
  b('StreetGround',{y:-.07,w:16.3,h:.3,d:11.3,color:p.floor});b('WalkingLane',{y:.086,z:1.7,w:15.8,h:.012,d:4.9,color:p.paper,radius:.08});
  for(let n=0;n<18;n++)b('PavingJoint',{x:-7.8+n*.9,y:.094,z:1.7,w:.012,h:.002,d:4.9,color:p.floor,radius:0});
 }else if(id==='dayHome')createHomeShell(k,map,p);
 else{
  const wall=HOME_WALLS[map.room?.wall]||{},floor=HOME_FLOORS[map.room?.floor]||{},wallColor=map.room?.wallColor||wall.color||p.wall,floorColor=map.room?.floorColor||floor.color||p.floor;
  k.room({w:map.bounds.w,d:map.bounds.d,floorColor,wallColor,accent:p.dark,joins:!floor.pattern});
  if(floor.pattern){const gap=floor.pattern==='wood'?.55:1;for(let x=-map.bounds.w/2+gap;x<map.bounds.w/2;x+=gap)b('CustomFloorJoint',{x,y:.084,w:.014,h:.002,d:map.bounds.d,color:p.dark,radius:0});if(floor.pattern!=='wood')for(let z=-map.bounds.d/2+gap;z<map.bounds.d/2;z+=gap)b('CustomFloorJoint',{z,y:.084,w:map.bounds.w,h:.002,d:.014,color:p.dark,radius:0});}
  if(wall.pattern){const gap=wall.pattern==='stripe'?.3:.7,line=wall.pattern==='stripe'?.025:.018;for(let x=-map.bounds.w/2+gap;x<map.bounds.w/2;x+=gap)b('WallpaperLine',{x,y:wall.pattern==='panel'?.77:1.66,z:-map.bounds.d/2+.105,w:line,h:wall.pattern==='panel'?1.3:3.2,d:.012,color:wall.pattern==='stripe'?p.paper:p.dark,radius:0});for(let z=-map.bounds.d/2+gap;z<map.bounds.d/2;z+=gap)b('WallpaperLine',{x:-map.bounds.w/2+.105,y:wall.pattern==='panel'?.77:1.66,z,w:.012,h:wall.pattern==='panel'?1.3:3.2,d:line,color:wall.pattern==='stripe'?p.paper:p.dark,radius:0});}
  for(const a of map.structure)b(a.id,{x:a.x,z:a.z,y:a.h/2,w:a.w,h:a.h,d:a.d,color:wallColor});
  window(map.id==='dayHome'?3.4:map.id==='dayWork'?2.8:2.5,-map.bounds.d/2+.14, map.id==='dayHome'?3.1:2.5);
  if(id==='dayWork'){
   b('DeskRug',{x:-2.5,y:.094,z:-.4,w:3.8,h:.02,d:3,color:p.paper,radius:.1});
   b('BoardFrame',{x:-2.6,y:2.65,z:-4.35,w:2.9,h:.78,d:.07,color:p.wood});b('Board',{x:-2.6,y:2.65,z:-4.3,w:2.73,h:.61,d:.02,color:p.fabric});
   for(let n=0;n<4;n++)b('PinnedNote',{x:-3.4+n*.54,y:2.66,z:-4.28,w:.32,h:.34,d:.012,color:p.paper,heading:(n%2?1:-1)*.08});
  }else{
   b('CafeRug',{x:-2.4,y:.095,z:1.9,w:3.6,h:.02,d:2.7,color:p.fabric,radius:.12});
   b('MenuFrame',{x:-2.7,y:2.65,z:-4.33,w:2.6,h:.82,d:.06,color:p.wood});b('MenuBoard',{x:-2.7,y:2.65,z:-4.29,w:2.4,h:.64,d:.03,color:p.dark});
   for(let n=0;n<3;n++)b('MenuLine',{x:-2.7,y:2.85-n*.19,z:-4.27,w:1.65-n*.2,h:.025,d:.01,color:p.paper});
  }
 }
 }
 for(const a of map.furniture)furniture(a);p=base;
 const shell=k.group('RoomShell');shell.userData.shellPart=true;
 for(const o of [...k.root.children])if(o!==shell&&!o.userData.furnitureId)shell.add(o);
 k.root.userData.layout={id,style,furniture:map.furniture.map(a=>({...a})),zones:map.zones,room:map.room};
 const result=k.finish();furnitureFinish(result.root);result.root.name=id;return result;
}
