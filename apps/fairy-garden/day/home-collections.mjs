import {rounded,arch,pebble,rimShape,shift,ceramicCup} from './home-shapes.mjs?v=fg-87e36a9d89c69f3f';
import {furnitureSeatSurface} from './home-catalog.mjs?v=fg-87e36a9d89c69f3f';

// Collections change construction as well as their default palette. All seats
// end at .53 and all mattresses share the existing bed contact surface.
export function createCollectionFurniture(k,a,p,g){
 if(!a.collection)return false;
 const style=a.collection,W=a.w,D=a.d,materials=new Map();
 function surface(mesh,type){
  const key=type+mesh.material.color.getHexString();
  if(!materials.has(key)){const m=mesh.material.clone();m.roughness=type==='metal'?.3:type==='glass'?.12:type==='fabric'?.98:.82;m.metalness=type==='metal'?.78:0;
   if(type==='glass'||type==='sheer'){m.transparent=true;m.opacity=type==='sheer'?.38:.42;m.depthWrite=false;}materials.set(key,m);}
  mesh.material=materials.get(key);return mesh;
 }
 const b=(n,v,type='wood')=>surface(k.box(n,{color:p.wood,...v},g),type);
 const c=(n,v,type='wood')=>surface(k.cylinder(n,{color:p.wood,...v},g),type);
 const e=(n,v,type='fabric')=>surface(k.ellipsoid(n,{color:p.fabric,...v},g),type);
 const t=(n,points,r=.025,color=p.wood,type='wood')=>surface(k.tube(n,{points,r,color},g),type);
 const flat=(n,shape,v,type='wood')=>surface(k.profile(n,{shape,horizontal:true,color:p.wood,...v},g),type);
 const up=(n,shape,v,type='wood')=>surface(k.profile(n,{shape,color:p.wood,...v},g),type);
 const steel=p.metal||p.dark;
 function feet(top=.39){for(const x of [-W/2+.13,W/2-.13])for(const z of [-D/2+.12,D/2-.12])c('CollectionFoot',{x,z,y:.08+top/2,r:.035,h:top,color:p.dark});}
 function weave(w,h,z,y=0,x=0){
  for(let n=0;n<Math.floor(w/.12);n++)b('WovenUpright',{x:x-w/2+.075+n*.12,y:y+h/2,z,w:.018,h,d:.016,color:p.dark});
  for(let n=0;n<Math.floor(h/.12);n++)b('WovenCrossing',{x,y:y+.06+n*.12,z:z+.012,w,h:.018,d:.016,color:p.accent});
 }
 function bedding(){
  flat('CollectionMattress',rounded(W-.18,D-.18,.13),{y:.605,depth:.21,color:p.paper},'fabric');
  flat('CollectionDuvet',rounded(W-.26,D-1.06,.12),{y:.755,z:.49,depth:.11,color:p.fabric},'fabric');
  flat('CollectionFold',rounded(W-.27,.28,.07),{y:.809,z:-.52,depth:.055,color:p.accent},'fabric');
  for(const x of [-.67,.67])e('CollectionPillow',{x,y:.785,z:-1.03,w:1.05,h:.23,d:.58,color:p.paper});
 }
 const seated=furnitureSeatSurface(a);
 function seat(){flat('CollectionSeat',rounded(W-.20,seated.d,.13),{y:.475,z:seated.z,depth:.11,color:p.fabric},'fabric');}
 if(a.kind==='bed'){
  const z=-D/2+.11;
  if(style==='craft'){
   feet(.3);b('CanopyRaft',{y:.405,w:W-.02,h:.22,d:D-.02});
   for(const x of [-W/2+.08,W/2-.08])for(const zz of [-D/2+.08,D/2-.08]){c('CanopyPost',{x,z:zz,y:1.2,r:.046,h:2.24});c('CanopyFinial',{x,z:zz,y:2.34,r:.065,h:.1});}
   for(const x of [-W/2+.08,W/2-.08])b('CanopySideRail',{x,y:2.26,w:.075,h:.08,d:D-.10});
   for(const zz of [-D/2+.08,D/2-.08])b('CanopyEndRail',{z:zz,y:2.26,w:W-.10,h:.08,d:.075});
   b('WovenHeadFrame',{y:1.04,z,w:W-.14,h:.87,d:.075});weave(W-.30,.7,z+.047,.67);
   for(const x of [-W/2+.22,W/2-.22])for(const zz of [z+.1,D/2-.17]){up('GatheredCanopyCurtain',rounded(.32,1.72,.05),{x,y:1.36,z:zz,depth:.022,color:p.paper},'sheer');for(const dx of [-.09,0,.09])b('CurtainFold',{x:x+dx,y:1.36,z:zz+.018,w:.012,h:1.67,d:.016,color:p.paper},'sheer');}
  }else if(style==='vintage'){
   feet(.3);b('SpindleBedFrame',{y:.405,w:W-.02,h:.22,d:D-.02});
   for(const zz of [z,D/2-.09]){const H=zz<0?1.43:.93;
    for(const x of [-W/2+.09,W/2-.09]){c('TurnedBedPost',{x,z:zz,y:H/2+.08,r:.065,h:H});e('BedPostFinial',{x,y:H+.13,z:zz,w:.16,h:.19,d:.16,color:p.accent},'wood');}
    b('SpindleTopRail',{y:H,z:zz,w:W-.12,h:.08,d:.08});b('SpindleLowerRail',{y:.54,z:zz,w:W-.12,h:.1,d:.08});
    for(let i=0;i<12;i++)c('BedSpindle',{x:-W/2+.25+i*(W-.5)/11,z:zz,y:(H+.54)/2,r:.026,h:H-.54});
   }
  }else if(style==='soft'){
   flat('FloatingBedBase',rounded(W-.02,D-.02,.24),{y:.39,depth:.25,color:p.wood});b('RecessedBedPlinth',{y:.20,w:W-.5,h:.22,d:D-.5,color:p.dark});
   for(let i=0;i<5;i++)up('PaddedHeadPanel',rounded((W-.12)/5-.025,1.22,.18),{x:(i-2)*(W-.12)/5,y:.97,z,depth:.18,color:p.fabric},'fabric');
  }else{
   for(const x of [-W/2+.08,W/2-.08])for(const zz of [z,D/2-.09])c('SteelBedPost',{x,z:zz,y:.68,r:.038,h:1.2,color:steel},'metal');
   for(const zz of [z,D/2-.09]){t('SteelBedArch',[[-W/2+.08,.82,zz],[-W/2+.1,1.29,zz],[0,1.45,zz],[W/2-.1,1.29,zz],[W/2-.08,.82,zz]],.038,steel,'metal');
    for(let i=0;i<9;i++)c('SteelBedRod',{x:-W/2+.28+i*(W-.56)/8,y:.85,z:zz,r:.018,h:.66,color:steel},'metal');}
   b('SteelMattressTray',{y:.415,w:W-.03,h:.19,d:D-.03,color:p.dark},'metal');
  }
  bedding();
 }else if(a.kind==='sofa'){
  if(style==='craft'){
   feet(.30);flat('RattanSofaRaft',rounded(W-.03,D-.03,.14),{y:.34,depth:.12});
   up('RattanBackFrame',rounded(W-.08,.68,.13),{y:.84,z:-D/2+.08,depth:.07});weave(W-.25,.51,-D/2+.124,.61);
   for(const x of [-W/2+.08,W/2-.08])t('RattanArm',[[x,.36,.38],[x,.72,.35],[x,.78,-.25],[x,.49,-.43]],.04);
   seat();
  }else if(style==='vintage'){
   feet(.28);flat('VelvetSofaBase',rounded(W-.03,D-.02,.18),{y:.34,depth:.14,color:p.wood});seat();
   up('TuftedSofaBack',rounded(W-.26,.68,.19),{y:.86,z:-D/2+.16,depth:.2,color:p.fabric},'fabric');
   for(const x of [-W/2+.14,W/2-.14])e('RolledVelvetArm',{x,y:.67,z:.035,w:.28,h:.37,d:D-.05});
   for(let i=0;i<8;i++)for(const y of [.76,.98])e('UpholsteryButton',{x:-W/2+.4+i*(W-.8)/7,y,z:-D/2+.267,w:.042,h:.042,d:.018,color:p.accent});
  }else if(style==='soft'){
   b('CloudHiddenBase',{y:.23,w:W-.4,h:.29,d:D-.28,color:p.dark});
   for(const x of [-.73,.73])flat('CloudSeatModule',rounded(1.48,seated.d,.25),{x,y:.455,z:seated.z,depth:.15,color:p.fabric},'fabric');
   for(const x of [-.91,0,.91])e('CloudBackLobe',{x,y:.91,z:-D/2+.15,w:1.17,h:.77,d:.31});
   for(const x of [-W/2+.13,W/2-.13])e('CloudSoftArm',{x,y:.67,z:.04,w:.26,h:.38,d:D-.06});
  }else{
   for(const x of [-W/2+.05,W/2-.05])t('SofaSteelLoop',[[x,.12,.4],[x,.68,.4],[x,.71,-.35],[x,.12,-.4],[x,.12,.4]],.034,steel,'metal');
   b('SofaSuspensionRail',{y:.35,w:W-.1,h:.06,d:D-.1,color:p.dark},'metal');seat();
   up('LeatherBackPad',rounded(W-.22,.56,.08),{y:.86,z:-D/2+.13,depth:.17,color:p.fabric},'fabric');
   for(const x of [-W*.22,W*.22])b('LeatherSeatSeam',{x,y:.533,z:.03,w:.008,h:.004,d:D-.27,color:p.paper},'fabric');
  }
 }else if(a.kind==='table'){
  const shape=a.variant==='round'?rounded(W-.02,D-.02,W/2):rounded(W-.03,D-.03,style==='soft'?.5:.1);
  flat('CollectionTableTop',shape,{y:.875,depth:.11,color:style==='studio'?p.glass:p.wood},style==='studio'?'glass':'wood');
  if(style==='craft'){
   for(const x of [-W*.31,W*.31]){for(const z of [-D*.32,D*.32])b('TrestleSplayedFoot',{x,y:.44,z,w:.13,h:.72,d:.13});b('TrestleEndCrossbar',{x,y:.24,w:.14,h:.09,d:D*.83});}
   b('TrestleLongBeam',{y:.28,w:W*.68,h:.13,d:.13,color:p.dark});
  }else if(style==='vintage'){
   c('CarvedPedestal',{y:.49,r:.14,h:.74});
   for(let i=0;i<4;i++){const angle=i*Math.PI/2,xx=Math.sin(angle)*.49,zz=Math.cos(angle)*.49;t('CurvedClawLeg',[[0,.57,0],[xx*.5,.37,zz*.5],[xx,.13,zz],[xx*1.13,.12,zz*1.13]],.054);}
  }else if(style==='soft')for(const x of [-W*.27,W*.27])c('PillTableColumn',{x,y:.49,r:.19,h:.73});
  else{
   for(const z of [-D*.31,D*.31])for(const side of [-1,1])t('CrossedSteelTrestle',[[side*W*.37,.12,z],[-side*W*.3,.82,z]],.031,steel,'metal');
   b('SteelTableBrace',{y:.49,w:W*.52,h:.035,d:.035,color:steel},'metal');
  }
  for(const side of [-1,1]){c('CollectionDinnerPlate',{x:side*W*.24,y:.943,r:.16,h:.025,color:p.paper});ceramicCup(k,g,p,{x:side*W*.24,z:side*.27,y:1.015});}
 }else if(a.kind==='chair'){
  flat('CollectionChairSeat',rounded(W-.025,seated.d,.15),{y:.485,z:seated.z,depth:.09,color:style==='vintage'?p.wood:p.fabric},style==='vintage'?'wood':'fabric');
  if(style==='studio'){
   for(const x of [-.245,.245])t('CantileverChairFrame',[[x,.11,-.27],[x,.11,.27],[x,.49,.27],[x,.51,-.25],[x,1.05,-.25]],.025,steel,'metal');
   up('CantileverBackPad',rounded(W-.06,.32,.04),{y:.91,z:-.25,depth:.055,color:p.fabric},'fabric');
  }else{
   feet(.36);
   if(style==='craft'){up('WovenChairFrame',rimShape(shift(arch(W-.06,.53),0,.03),shift(arch(W-.16,.43),0,.05)),{y:.55,z:-.275,depth:.045});weave(W-.18,.35,-.241,.65);}
   else if(style==='vintage'){t('WindsorBow',[[-.26,.58,-.265],[-.25,1.03,-.265],[0,1.15,-.265],[.25,1.03,-.265],[.26,.58,-.265]],.027);for(const x of [-.18,-.09,0,.09,.18])c('WindsorSpindle',{x,y:.81,z:-.265,r:.015,h:.49});}
   else up('ShellChairBack',rounded(W-.045,.50,.2),{y:.84,z:-.255,depth:.07,color:p.fabric},'fabric');
  }
 }else if(a.kind==='shelf'||a.kind==='cabinet'){
  const H=style==='vintage'?1.24:1.92;
  feet(.13);
  if(style==='vintage'){
   b('ApothecaryBody',{y:.76,w:W-.02,h:1.09,d:D-.025});
   for(let row=0;row<4;row++)for(let col=0;col<3;col++){const x=(col-1)*(W-.1)/3,y=.37+row*.25;b('IndividualDrawer',{x,y,z:D/2-.013,w:(W-.1)/3-.025,h:.22,d:.035,color:p.dark});b('DrawerLabel',{x,y:y+.045,z:D/2+.011,w:.13,h:.054,d:.008,color:p.paper});t('DrawerLoopPull',[[x-.04,y-.025,D/2+.011],[x,y-.05,D/2+.014],[x+.04,y-.025,D/2+.011]],.009,p.accent,'metal');}
   b('ApothecaryCornice',{y:1.34,w:W-.01,h:.065,d:D-.01});
  }else{
   for(const x of [-W/2+.035,W/2-.035])b('ShelfUpright',{x,y:1.06,w:.055,h:H,d:D-.02,color:style==='studio'?steel:p.wood},style==='studio'?'metal':'wood');
   for(let row=0;row<4;row++){const y=.24+row*.51;b('CollectionShelfBoard',{y,w:W-.04,h:.055,d:D-.02,color:style==='studio'?p.dark:p.wood},style==='studio'?'metal':'wood');
    if(style==='craft'&&row<3){for(const x of [-.35,.35]){b('BasketBody',{x,y:y+.19,w:.57,h:.3,d:D-.1,color:p.fabric});weave(.5,.25,D/2-.036,y+.055,x);b('BasketHandle',{x,y:y+.24,z:D/2-.015,w:.15,h:.032,d:.014,color:p.dark});}}
    else if(style==='soft'&&row<3)b('OffsetCubbyDivider',{x:row%2?-.22:.22,y:y+.27,w:.06,h:.49,d:D-.025});
    else if(style==='studio')for(const x of [-.48,0,.48])k.book('RackBook',{x,y:y+.18,w:.15,h:.3,d:.26,color:[p.fabric,p.paper,p.accent][row%3]},g);
   }
   if(style==='studio'){for(const x of [-W/2+.07,W/2-.07])t('RackBackBrace',[[x,.24,-D/2+.04],[-x,1.78,-D/2+.04]],.013,steel,'metal');}
   if(style==='soft'){e('DisplayVase',{x:-.35,y:.48,w:.2,h:.42,d:.2,color:p.accent},'wood');for(const x of [.14,.31,.48])k.book('DisplayBook',{x,y:1.43,w:.12,h:.32,d:.28,color:p.fabric},g);e('DisplayBowl',{x:-.28,y:1.9,w:.35,h:.15,d:.3,color:p.paper},'wood');}
  }
 }else if(a.kind==='light'){
  if(style==='craft'){
   for(const x of [-.18,.18])for(const z of [-.18,.18])b('LanternBambooLeg',{x,z,y:.35,w:.035,h:.52,d:.035});
   e('PaperLanternEnvelope',{y:.85,w:.6,h:.69,d:.6,color:p.paper});
   for(let i=0;i<8;i++){const y=.56+i*.077,r=.13+Math.sin((i+.5)/8*Math.PI)*.16;t('LanternBambooRing',Array.from({length:17},(_,n)=>[Math.sin(n*Math.PI/8)*r,y,Math.cos(n*Math.PI/8)*r]),.007,p.wood);}
  }else if(style==='vintage'){
   c('FlowerLampFoot',{y:.13,r:.20,h:.1,color:p.dark});c('FlowerLampStem',{y:.51,r:.027,h:.72,color:p.accent},'metal');
   for(let i=0;i<8;i++){const angle=i*Math.PI/4,x=Math.sin(angle)*.17,z=Math.cos(angle)*.17,mesh=e('StainedGlassPetal',{x,y:.91,z,w:.23,h:.3,d:.24,color:i%2?p.fabric:p.accent},'glass');mesh.rotation.z=-Math.sin(angle)*.42;mesh.rotation.x=Math.cos(angle)*.42;}
   e('StainedGlassCrown',{y:1.065,w:.18,h:.10,d:.18,color:p.accent},'metal');
  }else if(style==='soft'){
   c('MushroomFoot',{y:.13,r:.17,h:.10,color:p.wood});c('MushroomStem',{y:.40,r:.10,h:.49,color:p.fabric},'fabric');
   e('MushroomDome',{y:.72,w:.62,h:.34,d:.62,color:p.fabric});c('MushroomDiffuser',{y:.65,r:.24,h:.035,color:p.paper});
  }else{
   c('ArcLampFoot',{x:-.25,y:.13,r:.18,h:.1,color:p.dark},'metal');
   t('ArcLampArm',[[-.25,.16,0],[-.25,1.5,0],[-.08,1.85,0],[.22,1.87,0],[.30,1.72,0]],.023,steel,'metal');
   e('ArcLampDome',{x:.30,y:1.67,w:.29,h:.16,d:.29,color:p.dark},'metal');c('ArcLampDiffuser',{x:.30,y:1.62,r:.12,h:.02,color:p.paper});
  }
 }else if(a.kind==='rug'){
  const outline=style==='craft'?rounded(W-.06,D-.06,(D-.06)/2):style==='soft'?pebble(W-.09,D-.09):rounded(W-.05,D-.05,.04);
  flat('RugBacking',outline,{y:.122,depth:.018,bevel:0,color:p.fabric},'fabric');
  if(style==='craft')for(let i=0;i<11;i++){const w=W-.15-i*.11,d=D-.15-i*.10;if(d<.25)break;flat('BraidedRugLoop',rimShape(rounded(w,d,d/2),rounded(w-.034,d-.034,(d-.034)/2)),{y:.136,depth:.006,bevel:0,color:i%2?p.paper:p.accent},'fabric');}
  else if(style==='vintage'){
   for(let i=0;i<3;i++)flat('RugBorder',rimShape(rounded(W-.14-i*.13,D-.14-i*.13,.03),rounded(W-.20-i*.13,D-.20-i*.13,.03)),{y:.135,depth:.005,bevel:0,color:i%2?p.paper:p.accent},'fabric');
   for(const x of [-.62,0,.62]){const diamond=flat('RugDiamond',rounded(.38,.38,.01),{x,y:.137,depth:.005,bevel:0,color:p.accent},'fabric');diamond.rotation.y=Math.PI/4;}
  }else if(style==='soft')for(const [x,z,w,d,color]of [[-.51,.04,1.3,1.15,p.paper],[.53,-.14,1.05,.91,p.accent],[.23,.49,.63,.41,p.wood]])flat('RugColorIsland',pebble(w,d),{x,z,y:.137,depth:.005,bevel:0,color},'fabric');
  else for(let i=0;i<9;i++)b('RugWovenStripe',{x:-W/2+.2+i*.26,y:.136,w:.085,h:.005,d:D-.12,color:i%2?p.paper:p.dark,radius:0},'fabric');
 }else if(a.kind==='screen'){
  for(const x of [-.6,.6])b('ScreenFoot',{x,y:.12,w:.18,h:.08,d:D-.02});
  if(style==='craft')for(let i=0;i<3;i++){const x=(i-1)*.53,outline=rounded(.51,1.75,.07),inside=rounded(.41,1.64,.045);up('ScreenPanelFrame',rimShape(outline,inside),{x,y:1.05,z:i===1?.10:-.1,depth:.05});weave(.4,1.6,(i===1?.10:-.1)+.032,.25,x);}
  else for(let i=0;i<7;i++){const x=(i-3)*.225;up('WaveScreenPanel',rounded(.24,1.82-Math.abs(i-3)*.055,.12),{x,y:1.1,z:Math.sin(i*.9)*.14,depth:.10,color:i%2?p.fabric:p.paper},'fabric');}
 }else if(a.kind==='decor'){
  if(style==='vintage'){
   feet(.27);b('RecordCabinet',{y:.52,w:W-.03,h:.44,d:D-.02});
   for(let i=0;i<7;i++)b('RecordSleeve',{x:-W*.32+i*.063,y:.51,z:D/2-.016,w:.039,h:.28,d:.025,color:i%2?p.dark:p.accent});
   b('TurntableDeck',{y:.79,w:W-.11,h:.07,d:D-.11,color:p.dark});c('TurntableRecord',{x:-.2,y:.84,r:.19,h:.009,color:'#393735'});c('RecordLabel',{x:-.2,y:.847,r:.06,h:.006,color:p.accent});
   t('TurntableTonearm',[[.32,.86,-.15],[.29,.87,.12],[.11,.87,.10]],.009,p.accent,'metal');
   c('GramophoneNeck',{x:.29,z:-.05,y:1.02,r:.023,h:.3,color:p.accent},'metal');e('GramophoneHorn',{x:.29,z:-.02,y:1.28,w:.43,h:.28,d:.4,color:p.accent},'metal');e('HornOpening',{x:.29,z:.145,y:1.3,w:.32,h:.19,d:.013,color:p.dark},'metal');
  }else{
   feet(.4);b('TerrariumStand',{y:.49,w:W-.04,h:.1,d:D-.04,color:p.wood});
   b('TerrariumSoil',{y:.57,w:W-.14,h:.07,d:D-.14,color:p.dark});
   for(const x of [-W/2+.045,W/2-.045])for(const z of [-D/2+.045,D/2-.045])t('TerrariumCorner',[[x,.53,z],[x,1.13,z],[0,1.43,z]],.015,steel,'metal');
   for(const x of [-W/2+.05,W/2-.05])b('TerrariumGlassSide',{x,y:.84,w:.012,h:.55,d:D-.08,color:p.glass},'glass');
   for(const z of [-D/2+.05,D/2-.05])b('TerrariumGlassFront',{y:.84,z,w:W-.08,h:.55,d:.012,color:p.glass},'glass');
   for(let i=0;i<7;i++){const angle=i*2.4;e('TerrariumSucculent',{x:Math.sin(angle)*.23,z:Math.cos(angle)*.16,y:.72+i*.025,w:.19,h:.27,d:.085,color:p.accent});}
  }
 }
 return true;
}
