import {rounded,arch,pebble,rimShape} from './home-shapes.mjs?v=fg-b80ee10be1013554';

// These ornaments share their catalogue footprint with picking and validation.
export function createHomeDecor(k,a,p,g){
 if(a.kind!=='ornament')return false;
 const id=a.catalogId||a.id;
 const b=(name,v)=>k.box(name,{color:p.wood,...v},g),e=(name,v)=>k.ellipsoid(name,{color:p.accent,...v},g),c=(name,v)=>k.cylinder(name,{color:p.accent,...v},g);
 const tube=(name,points,r=.018,color=p.dark)=>k.tube(name,{points,r,color},g);
 const profile=(name,shape,v)=>k.profile(name,{shape,...v},g),W=a.w,H=a.height,D=a.d,F=.08;
 const frame=(shape,inner,color=p.wood)=>profile('Frame',rimShape(shape,inner),{depth:D*.7,color,bevel:.01});
 const mirror=shape=>{const m=profile('MirrorGlass',shape,{z:D*.38,depth:.014,color:p.glass,bevel:0});m.material=m.material.clone();m.material.metalness=.78;m.material.roughness=.12;m.material.emissive.set(p.glass);m.material.emissiveIntensity=.18;
  tube('MirrorGlint',[[-W*.19,-H*.12,D*.45],[W*.09,H*.17,D*.45]],.012,p.paper);};
 const stem=(x,y,z,top,flower=true)=>{tube('FlowerStem',[[x,y,z],[x-.025,y+(top-y)*.6,z],[x+.035,top,z]],.012,p.dark);e('Leaf',{x:x-.07,y:(y+top)/2,z,w:.16,h:.1,d:.045,color:p.fabric});if(flower)for(let i=0;i<5;i++){const angle=i*Math.PI*2/5;e('Petal',{x:x+.035+Math.cos(angle)*.075,y:top+Math.sin(angle)*.075,z,w:.13,h:.13,d:.065,color:i%2?p.accent:p.paper});}};
 const vase=(x,z,y,r,h,color=p.accent)=>{e('VaseBody',{x,z,y:y+h*.38,w:r*2,h:h*.78,d:r*2,color});c('VaseNeck',{x,z,y:y+h*.82,r:r*.55,h:h*.35,color});c('VaseMouth',{x,z,y:y+h,r:r*.57,h:.022,color:p.dark});};
 const pedestal=(height=.42)=>{b('PedestalFoot',{y:F+.06,w:W*.85,h:.12,d:D*.85});b('Pedestal',{y:F+height/2,w:W*.58,h:height,d:D*.58,color:p.paper});b('PedestalCap',{y:F+height,w:W*.82,h:.08,d:D*.82});};
 if(a.mount){
  if(id==='botanical-frame'){
   frame(rounded(W,H,.035),rounded(W-.12,H-.12,.02));b('SpecimenPaper',{z:D*.33,w:W-.12,h:H-.12,d:.015,color:p.paper,radius:.02});
   tube('PressedStem',[[0,-H*.36,D*.44],[.04,0,D*.44],[-.08,H*.33,D*.44]],.012,p.dark);
   for(let i=0;i<6;i++){const side=i%2?-1:1;e('PressedLeaf',{x:side*.1,y:-H*.25+i*.095,z:D*.45,w:.21,h:.105,d:.014,color:p.fabric});}
  }else if(id==='macrame'){
   c('HangingRod',{y:H*.43,r:.022,h:W*.9,rotation:[0,0,Math.PI/2],color:p.wood});
   for(let i=0;i<9;i++){const x=-W*.38+i*W*.095,low=-H*.26-Math.abs(i-4)*.035;tube('WovenCord',[[x,H*.4,0],[x*.35,H*.04,.035],[x,low,.025]],.017,p.fabric);tube('Tassel',[[x,low,.025],[x,-H*.48,.025]],.018,p.fabric);}
   for(const y of [.22,.06,-.1])tube('DiamondKnot',[[-W*.31,y,0],[0,y-.2,.035],[W*.31,y,0]],.024,p.fabric);
  }else if(id==='woven-wall-trio'){
   for(const [x,y,r]of [[-W*.28,-H*.04,.24],[0,H*.15,.23],[W*.28,-H*.1,.23]]){c('WovenPlate',{x,y,r,h:.045,rotation:[Math.PI/2,0,0],color:p.wood});for(let i=0;i<4;i++){const rr=r*(.3+i*.17),points=Array.from({length:25},(_,n)=>[x+Math.cos(n*Math.PI/12)*rr,y+Math.sin(n*Math.PI/12)*rr,.03]);tube('PlateBraid',points,.008,i%2?p.dark:p.paper);}}
  }else if(id==='oval-mirror'){
   const oval=pebble(W,H);frame(oval,pebble(W-.14,H-.14));mirror(pebble(W-.14,H-.14));
   for(const x of [-.19,0,.19])e('CarvedCrest',{x,y:H*.39,z:.04,w:.13,h:.14,d:.04,color:p.wood});
  }else if(id==='pendulum-clock'){
   profile('ClockCase',arch(W,H),{y:-H/2,depth:D,color:p.wood});c('ClockFace',{y:H*.13,z:D*.46,r:W*.34,h:.018,rotation:[Math.PI/2,0,0],color:p.paper});
   for(const [name,length]of [['DecorClockHour',.1],['DecorClockMinute',.15]]){const hand=k.replaceableGroup(name,{y:H*.13,z:D*.48},g);k.tube('Hand',{points:[[0,0,0],[0,length,0]],r:.012,color:p.dark},hand);}
   tube('Pendulum',[[0,-.11,D*.4],[0,-H*.35,D*.4]],.014,p.dark);c('PendulumBob',{y:-H*.35,z:D*.42,r:.085,h:.025,rotation:[Math.PI/2,0,0]});
  }else if(id==='landscape-frame'){
   frame(rounded(W,H,.025),rounded(W-.12,H-.12,.012));b('PaintingSky',{z:D*.34,w:W-.13,h:H-.13,d:.014,color:p.paper,radius:.01});
   for(const [x,y,w,h,color]of [[-.24,-.13,.7,.4,p.fabric],[.22,-.17,.68,.35,p.accent]])profile('PaintedHill',arch(w,h),{x,y:y-h/2,z:D*.43,depth:.008,color,bevel:0});c('PaintedSun',{x:.3,y:.18,z:D*.45,r:.08,h:.01,rotation:[Math.PI/2,0,0],color:p.accent});
  }else if(id==='bubble-mirror'){
   frame(pebble(W,H),pebble(W-.17,H-.17),p.fabric);mirror(pebble(W-.17,H-.17));
  }else if(id==='arch-art'){
   profile('ArchPaper',arch(W,H),{y:-H/2,depth:D*.6,color:p.paper});profile('ColourArch',arch(W*.7,H*.76),{x:-W*.03,y:-H/2+.03,z:D*.35,depth:.02,color:p.fabric});profile('ArchOpening',arch(W*.34,H*.5),{x:W*.07,y:-H/2+.03,z:D*.43,depth:.01,color:p.accent});
  }else if(id==='cloud-wall-shelf'){
   profile('CloudBack',pebble(W,H*.67),{y:.08,z:-D*.36,depth:.07,color:p.wood});b('CloudShelf',{y:-H*.35,w:W,h:.07,d:D,radius:.06});vase(-.24,0,-H*.3,.075,.24,p.fabric);stem(-.24,-.12,0,.24);k.book('ShelfBook',{x:.2,y:-.13,z:0,w:.18,h:.27,d:.18,color:p.accent},g);
  }else if(id==='geometric-poster'){
   frame(rounded(W,H,.012),rounded(W-.08,H-.08,.008),p.dark);b('PosterPaper',{z:D*.3,w:W-.09,h:H-.09,d:.012,color:p.paper,radius:0});b('PosterBlock',{x:-.22,y:-.08,z:D*.42,w:.36,h:.44,d:.012,color:p.fabric,radius:0});c('PosterCircle',{x:.23,y:.12,z:D*.43,r:.17,h:.013,rotation:[Math.PI/2,0,0],color:p.accent});tube('PosterLine',[[-.08,-.26,D*.47],[.42,-.26,D*.47]],.016,p.dark);
  }else if(id==='rail-wall-shelf'){
   for(const x of [-W*.38,W*.38])b('ShelfRail',{x,z:-D*.42,w:.035,h:H,d:.03,color:p.dark,radius:.006});
   for(const y of [-H*.35,H*.08])b('MetalShelf',{y,w:W,h:.04,d:D,color:p.dark,radius:.01});
   for(let i=0;i<3;i++)k.book('ShelfBooks',{x:-.35+i*.17,y:-.1,z:0,w:.12,h:.3,d:.22,color:i%2?p.fabric:p.paper},g);vase(.27,0,.1,.075,.25,p.accent);
  }else if(id==='hanging-planter'){
   tube('HangerHook',[[0,H*.48,-D*.4],[0,H*.48,0],[0,H*.2,0]],.025,p.dark);
   for(const side of [-1,1])tube('Suspension',[[0,H*.25,0],[side*.22,-H*.02,0]],.012,p.paper);
   vase(0,0,-H*.17,.19,.27,p.accent);
   for(let i=0;i<5;i++){const x=(i-2)*.09; tube('TrailingStem',[[x,.05,0],[x*1.3,-.21,.07],[x*1.1,-.43,.09]],.012,p.dark);for(let j=0;j<3;j++)e('TrailingLeaf',{x:x*1.2+(j%2?.045:-.045),y:.01-j*.17,z:.11,w:.13,h:.13,d:.045,color:p.fabric});}
  }
 }else if(id==='flower-basket'){
  e('Basket',{y:F+.25,w:W*.88,h:.5,d:D*.88,color:p.wood});for(let i=0;i<6;i++)tube('BasketWeave',[[-W*.37,F+.08+i*.06,D*.26],[0,F+.05+i*.065,D*.44],[W*.37,F+.08+i*.06,D*.26]],.012,p.dark);
  tube('BasketHandle',[[-W*.32,.35,0],[-W*.25,.82,0],[W*.25,.82,0],[W*.32,.35,0]],.024,p.wood);for(let i=0;i<5;i++)stem((i-2)*.11,.45,(i%2?1:-1)*.1,.85+(i%2)*.13);
 }else if(id==='dried-vases'){
  vase(-.18,0,F,.19,.5);vase(.23,.05,F,.13,.36,p.paper);for(let i=0;i<5;i++){const x=-.18+(i-2)*.04;stem(x,.48,0,1.06+(i%2)*.1,false);e('DriedSeed',{x:x+.035,y:1.08+(i%2)*.1,w:.065,h:.15,d:.04,color:p.paper});}
 }else if(id==='bust-pedestal'){
  pedestal(.7);e('SculptureShoulders',{y:1.03,w:.48,h:.35,d:.32});e('SculptureNeck',{y:1.22,w:.14,h:.3,d:.13});e('SculptureHead',{y:1.38,w:.29,h:.38,d:.28});e('SculptureNose',{y:1.4,z:.145,w:.065,h:.11,d:.06});for(const x of [-.075,.075])e('SculptureEye',{x,y:1.45,z:.125,w:.03,h:.015,d:.014,color:p.dark});
 }else if(id==='candle-pedestal'){
  c('CandleBase',{y:F+.04,r:.22,h:.08,color:p.wood});c('CandleStem',{y:.42,r:.035,h:.68});tube('CandleArms',[[-.22,.78,0],[-.22,.57,0],[0,.48,0],[.22,.57,0],[.22,.78,0]],.025,p.accent);
  for(const x of [-.22,0,.22]){const y=x===0?.92:.8;c('CandleCup',{x,y,r:.08,h:.05});c('WaxCandle',{x,y:y+.13,r:.042,h:.25,color:p.paper});e('CandleFlame',{x,y:y+.29,w:.045,h:.1,d:.045,color:p.accent});}
 }else if(id==='loop-sculpture'){
  pedestal(.32);profile('CeramicLoop',rimShape(rounded(W*.8,.77,.27),rounded(W*.37,.44,.13)),{y:.83,depth:.25,color:p.accent,bevel:.04});
 }else if(id==='plush-bear'){
  e('BearBody',{y:.39,w:.4,h:.54,d:.34,color:p.fabric});e('BearHead',{y:.69,w:.42,h:.35,d:.32,color:p.fabric});for(const side of [-1,1]){e('BearEar',{x:side*.18,y:.82,w:.15,h:.16,d:.1,color:p.fabric});e('BearArm',{x:side*.23,y:.44,w:.15,h:.32,d:.18,color:p.fabric});e('BearFoot',{x:side*.17,y:.17,z:.15,w:.22,h:.19,d:.28,color:p.fabric});e('BearEye',{x:side*.095,y:.72,z:.151,w:.025,h:.035,d:.02,color:p.dark});}e('BearMuzzle',{y:.65,z:.164,w:.2,h:.13,d:.07,color:p.paper});e('BearNose',{y:.677,z:.205,w:.055,h:.035,d:.023,color:p.dark});b('BearRibbon',{y:.54,z:.18,w:.24,h:.06,d:.035,color:p.accent});
 }else if(id==='kinetic-sculpture'){
  pedestal(.25);c('SculptureRod',{y:.83,r:.018,h:1.13,color:p.dark});tube('BalanceBar',[[-.27,1.16,0],[.25,1.3,0]],.015,p.dark);e('MobileDisc',{x:-.26,y:1.1,w:.16,h:.23,d:.045});e('MobileDisc',{x:.23,y:1.32,w:.19,h:.16,d:.045,color:p.fabric});tube('LowerBar',[[-.23,.86,0],[.22,.96,0]],.015,p.dark);e('MobileDisc',{x:.2,y:.86,w:.2,h:.18,d:.045,color:p.paper});
 }else if(id==='glass-vase'){
  pedestal(.25);vase(0,0,.34,.15,.38,p.glass);for(let i=0;i<3;i++)stem((i-1)*.08,.61,0,.91+i*.06);g.traverse(o=>{if(o.isMesh&&o.material.color.getHexString()===p.glass.slice(1)){o.material=o.material.clone();o.material.metalness=.1;o.material.roughness=.12;o.material.transparent=true;o.material.opacity=.62;o.material.depthWrite=false;}});
 }
 return true;
}
