import {rounded,arch,scallop,pebble,rimShape,shift,ceramicCup} from './home-shapes.mjs?v=fg-562bc471e8a6c8b7';

// Movable meshes use the catalogue footprint and the traveler's original bed /
// chair surfaces. Details belong to their instance, including the thumbnail.
export function createHomeFurniture(k,a,p){
 const g=k.group(a.id,{x:a.x,z:a.z,heading:a.heading}),F=.08;
 const b=(name,v,parent=g)=>k.box(name,{color:p.wood,...v},parent);
 const upright=(name,shape,v,parent=g)=>k.profile(name,{shape,...v},parent);
 const flat=(name,shape,v,parent=g)=>upright(name,shape,{horizontal:true,...v},parent);
 const leg=(x,z,top=.39)=>k.cylinder('TurnedFoot',{x,z,y:F+top/2,r:.045,h:top,color:p.dark},g);
 const book=(x,z,y,color=p.accent)=>k.book('OpenLifeBook',{x,z,y,w:.31,d:.39,color,flat:true},g);
 function tableware(top){
  const y=F+top;
  if(a.dining){const spread=a.variant==='round'?.27:a.w*.24;
   for(const side of [-1,1]){const x=side*spread;k.cylinder('DinnerPlate',{x,y:y+.023,r:.17,h:.025,color:p.paper},g);k.cylinder('PlateWell',{x,y:y+.039,r:.12,h:.005,color:p.accent},g);ceramicCup(k,g,p,{x,z:side*.23,y:y+.09,color:side<0?p.fabric:p.paper,handle:side});b('Chopsticks',{x:x+.22,y:y+.016,z:0,w:.012,h:.012,d:.29,color:p.dark,radius:.005});}
   k.cylinder('BudVase',{y:y+.15,r:.065,h:.29,color:p.fabric},g);k.tube('SingleStem',{points:[[0,y+.27,0],[.025,y+.43,0],[.075,y+.5,.035]],r:.009,color:p.dark},g);k.ellipsoid('VaseLeaf',{x:.06,y:y+.47,z:.02,w:.12,h:.15,d:.025,color:p.accent},g);
  }else {book(-a.w*.22,0,y+.05);ceramicCup(k,g,p,{x:a.w*.24,z:-.02,y:y+.09});b('Bookmark',{x:-a.w*.25,y:y+.095,z:.19,w:.035,h:.006,d:.17,color:p.fabric,radius:0});}
 }
 if(a.kind==='bed'){
  for(const x of [-a.w*.4,a.w*.4])for(const z of [-a.d*.42,a.d*.42]){leg(x,z,.3);k.sphere('FootCollar',{x,z,y:.31,r:.075,color:p.wood},g);}
  flat('BedTimber',rounded(a.w-.015,a.d-.015,.2),{y:.41,depth:.23,color:p.wood});
  for(let n=0;n<12;n++)b('FrameReed',{x:-a.w/2+.17+n*(a.w-.34)/11,y:.43,z:a.d/2-.016,w:.065,h:.19,d:.025,color:p.dark,radius:.016});
  flat('Mattress',rounded(a.w-.14,a.d-.15,.17),{y:.605,depth:.21,color:p.paper});
  const headZ=-a.d/2+.09;
  upright('ScallopedHeadboard',scallop(a.w-.035,1.28),{y:.39,z:headZ,depth:.14,color:a.variant==='soft'?p.fabric:p.wood,bevel:.025});
  if(a.variant==='soft')for(const side of [-1,1])upright('PaddedHeadPetal',arch(1.22,.87),{x:side*.68,y:.6,z:headZ+.092,depth:.06,color:p.fabric});
  else for(let i=0;i<11;i++)b('HeadboardFlute',{x:-a.w/2+.2+i*(a.w-.4)/10,y:.95,z:headZ+.08,w:.045,h:.84-Math.abs(i-5)*.058,d:.015,color:p.dark,radius:.015});
  flat('Quilt',rounded(a.w-.21,a.d-1.02,.16),{y:.755,z:.49,depth:.11,color:p.fabric});
  flat('QuiltTurnback',rounded(a.w-.22,.28,.075),{y:.806,z:-.53,depth:.075,color:p.accent});
  for(let i=0;i<6;i++)b('QuiltStitch',{x:-a.w/2+.28+i*.46,y:.814,z:.55,w:.008,h:.003,d:1.86,color:p.paper,radius:0});
  for(const x of [-.67,.67]){k.ellipsoid('Pillow',{x,y:.785,z:-1.03,w:1.07,h:.23,d:.58,color:p.paper},g);k.tube('PillowSeam',{points:[[x-.35,.83,-.9],[x,.86,-.88],[x+.35,.83,-.9]],r:.008,color:p.accent},g);}
 }else if(a.kind==='sofa'){
  for(const side of [-1,1])for(const z of [-.3,.3])leg(side*(a.w/2-.22),z,.28);
  flat('SofaTimberRaft',rounded(a.w-.02,a.d-.02,.22),{y:.34,depth:.12,color:p.wood});
  const back=rounded(a.w-.04,.65,.22);upright('CurvedSofaBack',back,{y:.81,z:-a.d/2+.105,depth:.18,color:p.wood});
  upright('UpholsteredBack',rounded(a.w-.26,.53,.18),{y:.83,z:-a.d/2+.225,depth:.1,color:p.fabric});
  for(const side of [-1,1]){flat('SofaSeat',rounded((a.w-.38)/2,a.d-.31,.15),{x:side*(a.w-.36)/4,y:.475,z:.065,depth:.11,color:p.fabric});k.ellipsoid('SofaBolster',{x:side*(a.w/2-.17),y:.66,z:.03,w:.27,h:.29,d:a.d-.17,color:p.fabric},g);}
  for(const [side,color]of [[-1,p.accent],[1,p.paper]]){const cushion=upright('SofaCushion',rounded(.43,.43,.12),{x:side*a.w*.32,y:.77,z:-.06,depth:.14,color});cushion.rotation.z=side*.17;}
  for(const x of [-.31,.31])b('BackJoinery',{x,y:.81,z:-a.d/2+.005,w:.065,h:.56,d:.014,color:p.dark,radius:.02});
 }else if(a.kind==='table'){
  const top=a.top||.85,shape=a.variant==='round'?rounded(a.w-.015,a.d-.015,a.w/2):a.top?pebble(a.w-.025,a.d-.025):rounded(a.w-.02,a.d-.02,.28);
  flat('CarvedTableTop',shape,{y:F+top-.055,depth:.11,color:p.wood});
  if(a.variant==='round'){k.cylinder('PedestalStem',{y:F+(top-.13)/2,r:.13,h:top-.13,color:p.dark},g);flat('PedestalFoot',rounded(.7,.7,.3),{y:.14,depth:.1,color:p.wood});}
  else {for(const side of [-1,1]){upright('TrestleLeg',arch(.48,top-.13),{x:side*(a.w*.3),y:F,z:0,depth:a.d*.68,color:p.dark});}b('TableStretcher',{y:.25,w:a.w*.6,h:.055,d:.065,color:p.wood,radius:.02});}
  tableware(top);
 }else if(a.kind==='chair'){
  for(const x of [-.185,.185])for(const z of [-.19,.19])leg(x,z,.36);
  flat('RoundChairSeat',rounded(a.w-.018,a.d-.018,.2),{y:F+.45-.045,depth:.09,color:p.fabric});
  const back=arch(a.w-.02,.51);upright('PetalChairBack',back,{y:.61,z:-.235,depth:.072,color:p.fabric,bevel:.012});
  for(const x of [-.2,.2])b('ChairBackSupport',{x,y:.6,z:-.225,w:.045,h:.45,d:.04,color:p.dark,radius:.018});
  if(a.variant==='slat'){upright('ChairBackInset',shift(arch(.38,.36),0,.02),{y:.665,z:-.19,depth:.006,color:p.paper,bevel:0});for(const x of [-.12,0,.12])b('ChairReed',{x,y:.835,z:-.18,w:.032,h:.28,d:.01,color:p.fabric,radius:.008});}
 }else if(a.kind==='wardrobe'||a.kind==='cabinet'||a.kind==='shelf'){
  // Side-facing legacy cabinets retain their width/depth and physical center.
  const side=a.w<a.d,W=side?a.d:a.w,D=side?a.w:a.d,body=k.group('StorageBody',{heading:side?Math.PI/2:0},g),H=a.kind==='wardrobe'?2.2:a.kind==='shelf'?1.95:.72;
  const bb=(name,v)=>b(name,v,body),up=(name,shape,v)=>upright(name,shape,v,body);
  for(const x of [-W/2+.13,W/2-.13])for(const z of [-D/2+.12,D/2-.12])k.cylinder('StorageFoot',{x,z,y:.13,r:.045,h:.11,color:p.dark},body);
  const outline=arch(W-.025,H),inside=shift(arch(W-.19,H-.15),0,.06);
  up('ArchedStorageCarcass',a.kind==='shelf'?rimShape(outline,inside):outline,{y:.19,z:0,depth:D-.035,color:p.wood,bevel:.014});
  if(a.kind==='shelf'){
   up('ShelfInnerShadow',inside,{y:.19,z:-D/2+.02,depth:.025,color:p.dark,bevel:0});
   for(let row=0;row<3;row++){const y=.32+row*.49;bb('ShelfLedge',{y,w:W-.15,h:.06,d:D-.04,color:p.wood});
    if(row===1){k.ellipsoid('CeramicShelfVase',{x:-W*.25,y:y+.17,z:.05,w:.2,h:.31,d:.2,color:p.paper},body);k.cylinder('VaseMouth',{x:-W*.25,y:y+.32,z:.05,r:.055,h:.04,color:p.accent},body);}
    const count=Math.max(2,Math.floor((W-.4)/.19));for(let n=0;n<count;n++){if(row===1&&n<2)continue;const hh=.25+(n%3)*.045;k.book('ShelfBook',{x:-W/2+.24+n*.18,y:y+hh/2+.04,z:.035,w:.12,h:hh,d:Math.min(.25,D-.14),color:[p.paper,p.fabric,p.accent][(row+n)%3]},body);}
   }
  }else if(a.variant==='drawers'){
   for(const y of [.31,.49,.67]){up('RoundedDrawer',rounded(W-.17,.16,.05),{y,z:D/2+.006,depth:.025,color:p.wood});bb('BrassDrawerPull',{y,z:D/2+.012,w:.25,h:.025,d:.025,color:p.accent});}
  }else {const face=shift(arch(W-.13,H-.13),0,.04);up('CabinetFace',face,{y:.19,z:D/2-.006,depth:.034,color:a.kind==='wardrobe'?p.fabric:p.wood});
   if(a.kind==='wardrobe')for(let n=0;n<Math.floor(W/.11);n++)bb('TambourReed',{x:-W/2+.1+n*.11,y:.85,z:D/2+.015,w:.025,h:1.12,d:.012,color:p.wood,radius:.008});
   for(const x of [-.065,.065])k.ellipsoid('CabinetKnob',{x,y:H*.53,z:D/2+.008,w:.06,h:.1,d:.04,color:p.accent},body);
  }
  if(a.kind==='cabinet'){flat('CabinetTop',rounded(W-.02,D-.02,.08),{y:.82,depth:.065,color:p.wood},body);k.ellipsoid('BedsideLampShade',{x:0,y:1.06,z:0,w:.27,h:.22,d:.27,color:p.paper},body);k.cylinder('BedsideLampStem',{y:.92,r:.025,h:.2,color:p.accent},body);k.cylinder('LampFoot',{y:.862,r:.09,h:.025,color:p.dark},body);}
 }else if(a.kind==='kitchen'||a.kind==='counter'){
  flat('KitchenPlinth',rounded(a.w-.04,a.d-.04,.13),{y:.18,depth:.17,color:p.dark});flat('KitchenBody',rounded(a.w-.025,a.d-.025,.13),{y:.52,depth:.62,color:p.fabric});flat('KitchenWorktop',rounded(a.w-.015,a.d-.015,.13),{y:.92,depth:.11,color:p.paper});
  const count=Math.max(2,Math.floor(a.w/.76)),unit=(a.w-.13)/count;for(let i=0;i<count;i++){const x=-a.w/2+.065+unit*(i+.5);upright('InsetCounterDoor',rounded(unit-.035,.56,.09),{x,y:.51,z:a.d/2-.015,depth:.027,color:p.wood});k.ellipsoid('CounterKnob',{x,y:.65,z:a.d/2+.012,w:.095,h:.028,d:.026,color:p.dark},g);}
  if(a.kind==='kitchen'){
   flat('SinkRim',rounded(.72,.45,.13),{x:-.8,y:.982,depth:.012,color:p.dark});flat('SinkBowl',rounded(.57,.32,.11),{x:-.8,y:.99,depth:.005,color:p.glass});k.tube('GooseneckTap',{points:[[-.8,.98,-.29],[-.8,1.23,-.29],[-.8,1.3,-.15],[-.8,1.21,-.06]],r:.023,color:p.dark},g);
   flat('Cooktop',rounded(.86,.49,.09),{x:.85,y:.982,depth:.018,color:p.dark});for(const x of [.65,1.08])k.cylinder('CookingRing',{x,y:1.001,r:.13,h:.013,color:p.wood},g);
   k.cylinder('SoupPot',{x:1.08,y:1.09,r:.13,h:.16,color:p.accent},g);k.ellipsoid('PotLid',{x:1.08,y:1.183,w:.26,h:.045,d:.26,color:p.paper},g);k.sphere('LidKnob',{x:1.08,y:1.22,r:.026,color:p.dark},g);
   flat('CuttingBoard',rounded(.4,.32,.06),{x:1.8,y:.994,depth:.025,color:p.wood});ceramicCup(k,g,p,{x:-1.8,z:0,y:1.06});
  }else {flat('CuttingBoard',pebble(.7,.46),{x:-.3,y:.995,depth:.035,color:p.wood});ceramicCup(k,g,p,{x:.53,y:1.06});k.ellipsoid('BreadLoaf',{x:-.34,y:1.08,w:.32,h:.13,d:.2,color:p.accent},g);}
 }else if(a.kind==='plant'){
  const tall=a.variant==='tall',potW=a.w*.68;k.ellipsoid('CeramicPot',{y:.25,w:potW,h:.32,d:potW,color:p.accent},g);k.cylinder('PotLip',{y:.385,r:potW*.41,h:.038,color:p.wood},g);k.cylinder('PotSoil',{y:.408,r:potW*.35,h:.006,color:p.dark},g);
  for(let i=0;i<(tall?6:7);i++){const t=i*2.4,Y=(tall?.72:.48)+i*(tall?.12:.035),X=Math.sin(t)*a.w*.19,Z=Math.cos(t)*a.d*.18;k.tube('LeafStem',{points:[[0,.4,0],[X*.5,Y-.12,Z*.5],[X,Y,Z]],r:.01,color:p.dark},g);const leaf=k.ellipsoid('PlantLeaf',{x:X,y:Y+.07,z:Z,w:a.w*.28,h:tall?.34:.21,d:.04,color:p.fabric},g);leaf.rotation.set(.4*Math.cos(t),t,.35*Math.sin(t));}
 }else if(a.kind==='light'){
  const short=a.variant==='short',top=short?1.02:1.62;k.cylinder('LightFoot',{y:.14,r:a.w*.43,h:.1,color:p.wood},g);k.tube('BentLampStem',{points:[[0,.19,0],[0,top-.3,0],[a.w*.13,top-.08,0],[a.w*.18,top,0]],r:.024,color:p.dark},g);
  k.ellipsoid('PetalLampShade',{x:a.w*.1,y:top,w:a.w*.88,h:.34,d:a.d*.88,color:p.fabric},g);k.cylinder('LampDiffuser',{x:a.w*.1,y:top-.135,r:a.w*.31,h:.025,color:p.paper},g);
  for(let i=0;i<10;i++){const t=i*Math.PI/5;k.tube('ShadeRib',{points:[[a.w*.1+Math.sin(t)*a.w*.13,top+.15,Math.cos(t)*a.d*.13],[a.w*.1+Math.sin(t)*a.w*.42,top,Math.cos(t)*a.d*.42],[a.w*.1+Math.sin(t)*a.w*.31,top-.13,Math.cos(t)*a.d*.31]],r:.008,color:p.paper},g);}
 }
 return g;
}
