import {rounded,arch,rimShape,pebble,ceramicCup,shift} from './home-shapes.mjs?v=fg-337e28073d0dffaf';
import {HOME_WALLS,HOME_FLOORS} from './home-catalog.mjs?v=fg-337e28073d0dffaf';

// All raised pieces sit on the boundary or the partition footprint. The actual
// walking plane, furniture positions and doorway remain the saved map's .08.
export function createHomeShell(k,map,p){
 const wall=HOME_WALLS[map.room.wall]||{},floor=HOME_FLOORS[map.room.floor]||{},wallColor=map.room.wallColor||wall.color||p.wall,floorColor=map.room.floorColor||floor.color||p.floor;
 const w=map.bounds.w,d=map.bounds.d,back=-d/2,edge=-w/2;
 const b=(name,v,g)=>k.box(name,{color:p.wood,...v},g),flat=(name,shape,v,g)=>k.profile(name,{shape,horizontal:true,...v},g);
 const shell=k.group('WindowHome');shell.userData.architecture='arched-window-home';
 flat('Foundation',rounded(w+.42,d+.42,.18),{y:-.155,depth:.31,color:p.dark},shell);
 flat('WalkingFloor',rounded(w+.28,d+.28,.12),{y:.025,depth:.11,color:floorColor,bevel:.005},shell);
 // A staggered brick parquet gives the house a rhythm beyond a plank grid.
 const tile=floor.pattern==='tile'||floor.pattern==='stone',gap=tile?.9:.48;
 for(let x=edge+.08;x<w/2;x+=gap){b('FloorJoint',{x,y:.082,w:.009,h:.001,d:d-.05,color:p.dark,radius:0},shell);
  if(!tile)for(let z=back+.16+(Math.round((x-edge)/gap)%2)*1.15;z<d/2;z+=2.3)b('ParquetEnd',{x:x+gap/2,y:.083,z,w:gap,h:.001,d:.008,color:p.dark,radius:0},shell);}
 if(tile)for(let z=back+.9;z<d/2;z+=.9)b('TileJoint',{z,y:.083,w,h:.001,d:.01,color:p.dark,radius:0},shell);
 // Bedroom wall has a gently rising shoulder. Window wall is actually open.
 k.profile('BedroomWall',{shape:arch(6.25,4.15),x:-3.8,y:.08,z:back,depth:.18,color:wallColor,bevel:.008},shell);
 const windowX=3.3,windowW=4.5,windowH=2.95,windowBase=1.08;
 const rightWall=rounded(7.9,4.05,.2),opening=shift(arch(windowW,windowH),windowX-3.03,windowBase-(.08+4.05/2));
 k.profile('WindowWall',{shape:rimShape(rightWall,opening),x:3.03,y:.08+4.05/2,z:back,depth:.18,color:wallColor,bevel:.005},shell);
 // Lower front corner opens the dollhouse; the room still has one level floor.
 b('LeftWall',{x:edge,y:1.36,z:-1.2,w:.18,h:2.56,d:8.6,color:wallColor,radius:.07},shell);
 b('LowCornerWall',{x:edge,y:.56,z:4.3,w:.18,h:.96,d:2.4,color:wallColor,radius:.08},shell);
 k.tube('WallCoping',{points:[[edge,2.68,back],[edge,2.68,-.7],[edge,2.46,1.2],[edge,1.36,2.4],[edge,1.07,3.1],[edge,1.07,d/2]],r:.065,color:p.paper},shell);
 b('BackSkirting',{y:.28,z:back+.115,w,h:.36,d:.075,color:p.dark,radius:.01},shell);b('LeftSkirting',{x:edge+.115,y:.28,w:.075,h:.36,d,color:p.dark,radius:.01},shell);
 if(wall.pattern){const spacing=wall.pattern==='stripe'?.26:.62;
  for(let x=edge+.25;x<-1;x+=spacing)b('WallPaperSeam',{x,y:1.28,z:back+.1,w:.015,h:2.4,d:.006,color:wall.pattern==='stripe'?p.paper:p.dark,radius:0},shell);
  for(let z=back+.3;z<2.7;z+=spacing)b('WallPaperSeam',{x:edge+.1,y:1.25,z,w:.006,h:2.3,d:.015,color:wall.pattern==='stripe'?p.paper:p.dark,radius:0},shell);}
 const win=k.group('ArchedWindow',{x:windowX,y:windowBase,z:back},shell);
 const glass=k.profile('WindowGlass',{shape:arch(windowW-.13,windowH-.08),depth:.035,z:-.025,color:p.glass,bevel:0},win);glass.material=glass.material.clone();glass.material.emissive.set(p.glass);glass.material.emissiveIntensity=.1;
 // Layered paper-garden silhouettes live within the glazing, like a toy theatre.
 for(const [x,h,c]of [[-1.7,.36,p.fabric],[-.96,.52,p.accent],[.23,.32,p.paper],[1.5,.5,p.fabric]])k.ellipsoid('WindowGarden',{x,y:.28,z:.005,w:1.2,h,d:.012,color:c},win);
 const inner=shift(arch(windowW-.24,windowH-.12),0,.08);
 k.profile('WindowSurround',{shape:rimShape(arch(windowW+.2,windowH+.16),inner),depth:.16,z:.07,color:p.dark,bevel:.01},win);
 for(const x of [-1.42,0,1.42]){const top=windowH-windowW/2+Math.sqrt((windowW/2)**2-x*x);b('WindowMullion',{x,y:top/2,z:.12,w:.065,h:top,d:.065,color:p.paper},win);}
 b('WindowRail',{y:1.12,z:.13,w:windowW-.15,h:.07,d:.065,color:p.paper},win);
 b('DeepWindowSill',{x:windowX,y:1.015,z:back+.14,w:windowW+.32,h:.14,d:.43,color:p.wood,radius:.08},shell);
 // The alcove is outside the usable floor; no invisible step under the avatar.
 b('WindowApron',{x:windowX,y:.71,z:back+.08,w:windowW+.18,h:.42,d:.2,color:p.fabric,radius:.07},shell);
 for(const side of [-1,1]){const x=windowX+side*(windowW/2+.2);for(let i=0;i<4;i++)k.cylinder('CurtainFold',{x:x+(i-1.5)*.08,y:2.09,z:back+.17,r:.065,h:2.16,color:p.fabric},shell);k.tube('CurtainTie',{points:[[x-.16,1.7,back+.24],[x,1.64,back+.31],[x+.16,1.7,back+.24]],r:.035,color:p.accent},shell);}
 // A climbing branch follows the high window shoulder and breaks the straight
 // wall silhouette. It is entirely above the boundary, outside walking space.
 k.tube('WindowVine',{points:[[5.73,1.8,back+.2],[5.83,2.8,back+.2],[5.45,3.63,back+.22],[4.67,4.05,back+.22],[4.07,3.85,back+.23]],r:.022,color:p.dark},shell);
 for(const [x,y,angle]of [[5.79,2.25,-.55],[5.71,2.75,.5],[5.51,3.24,-.65],[5.18,3.69,.45],[4.77,3.91,-.55],[4.31,3.91,.4]]){const leaf=k.ellipsoid('WindowVineLeaf',{x,y,z:back+.26,w:.25,h:.44,d:.07,color:p.fabric},shell);leaf.rotation.z=angle;}
 ceramicCup(k,shell,p,{x:windowX-1.5,z:back+.17,y:1.16});k.book('WindowBook',{x:windowX-1.15,y:1.14,z:back+.17,w:.4,d:.27,color:p.accent,flat:true},shell);
 // Rounded screen and a slim timber crest are exactly inside the old divider.
 for(const a of map.structure){b(a.id,{x:a.x,z:a.z,y:.82,w:a.w,h:1.48,d:a.d,color:wallColor,radius:.04},shell);b('ScreenCrest',{x:a.x,y:1.59,z:a.z,w:a.w+.03,h:.1,d:a.d,color:p.wood,radius:.04},shell);
  for(let z=a.z-a.d/2+.24;z<a.z+a.d/2;z+=.34)b('ScreenReed',{x:a.x+.077,y:.96,z,w:.018,h:1.17,d:.024,color:p.wood,radius:.008},shell);}
 flat('BedroomRug',rounded(4.55,4.3,.65),{x:-4,y:.096,z:-2.8,depth:.02,color:p.accent,bevel:0},shell);
 flat('LivingRug',pebble(5.1,3.45),{x:-3,y:.097,z:2.2,depth:.023,color:p.fabric,bevel:0},shell);
 const rugRim=rimShape(rounded(3.48,2.43,.72),rounded(3.34,2.29,.65));flat('FreeCornerRug',rounded(3.5,2.45,.72),{x:3.7,y:.094,z:3.35,depth:.019,color:p.paper,bevel:0},shell);flat('FreeCornerRugBorder',rugRim,{x:3.7,y:.105,z:3.35,depth:.005,color:p.accent,bevel:0},shell);
 for(let i=0;i<12;i++)b('RugFringe',{x:2.35+i*.245,y:.095,z:4.64,w:.04,h:.015,d:.19,color:p.paper,radius:.005},shell);
 // Objects stay on the wall, leaving the entire free corner available to furnish.
 const collage=k.group('TwoPeopleWall',{x:-4.05,y:2.46,z:back+.15},shell);
 for(const [x,y,ww,hh]of [[-.74,.08,.56,.75],[.06,.28,.76,.62],[.86,-.07,.5,.63]]){b('KeepsakeFrame',{x,y,w:ww,h:hh,d:.075,color:p.wood,radius:.05},collage);b('KeepsakePaper',{x,y,z:.041,w:ww-.12,h:hh-.12,d:.012,color:p.paper,radius:.025},collage);k.ellipsoid('KeepsakeMotif',{x,y:y-.06,z:.055,w:ww*.37,h:hh*.35,d:.01,color:p.fabric},collage);}
 k.tube('MemoryString',{points:[[-5.5,3.04,back+.16],[-4.65,2.93,back+.17],[-3.8,3.02,back+.16],[-2.65,3.21,back+.16]],r:.016,color:p.dark},shell);
 for(const [x,y,c]of [[-5.25,2.83,p.paper],[-4.3,2.78,p.accent],[-3.12,2.95,p.paper]])b('MemoryPostcard',{x,y,z:back+.18,w:.27,h:.34,d:.012,color:c,radius:.005},shell);
 // An offset round wall clock gives the second corner its own focal point.
 const clock=k.group('WallClock',{x:6.15,y:3.07,z:back+.16},shell);
 k.cylinder('ClockRim',{r:.34,h:.06,rotation:[Math.PI/2,0,0],color:p.dark},clock);k.cylinder('ClockFace',{z:.036,r:.29,h:.015,rotation:[Math.PI/2,0,0],color:p.paper},clock);
 for(const [name,length,r]of [['HomeClockHour',.15,.02],['HomeClockMinute',.22,.014]]){const hand=k.replaceableGroup(name,{},clock);k.tube('ClockHand',{points:[[0,-.035,.055],[0,length,.055]],r,color:p.accent},hand);}
 for(const x of [-.97,.97]){k.cylinder('DoorPost',{x,y:.42,z:d/2-.04,r:.065,h:.67,color:p.dark},shell);k.sphere('DoorFinial',{x,y:.8,z:d/2-.04,r:.085,color:p.accent},shell);}
 b('Threshold',{y:.09,z:d/2-.05,w:1.8,h:.02,d:.2,color:p.wood,radius:.04},shell);
 return shell;
}
export function setHomeClock(root,minute=720){
 if(!root||root.userData.clockMinute===minute)return;root.userData.clockMinute=minute;
 const hour=root?.getObjectByName('HomeClockHour'),hand=root?.getObjectByName('HomeClockMinute');minute=Number.isFinite(minute)?minute:720;
 if(hour)hour.rotation.z=-((minute%720)/720)*Math.PI*2;if(hand)hand.rotation.z=-((minute%60)/60)*Math.PI*2;
}
