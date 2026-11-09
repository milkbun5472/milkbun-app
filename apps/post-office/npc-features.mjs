import * as T from 'three';

// Static accessories use the same sewn pieces and original NPC skeleton.
// Hand-held items and pets live in npc-props so a letter can take the free hand.
export function addNpcFeatures(k,d,look,parts){
 const {box,line,ball,panel,headMesh,headBall,headLine}=k,f=look.npcFeature,rare=look.npcRare;
 if(f==='strawHat'||f==='sun')parts.sunHat();
 if(f==='rainBoots'){
  k.fitted('FeatureRubberBoots','#6e7965',{maxY:.21,maxArm:.15,offset:.014,pattern:'leather'});
  k.fitted('BootTopBinding','#a99b69',{minY:.195,maxY:.213,maxArm:.15,offset:.016,pattern:'plain'});
 }
 if(f==='late'){panel('LooseCollar',[[.025,.677],[.09,.651],[.054,.61]],d.trim,{z:.13});box('WatchBand',.273,.416,.025,.052,.018,.04,'#977b60',{rig:'rightArm',pattern:'leather'});ball('WatchFace',.273,.425,.044,.013,.004,.013,'#e5d9b7',{rig:'rightArm',pattern:'plain',metal:.3});}
 if(f==='drawingBoard'){
  box('BackDrawingBoard',0,.52,-.188,.30,.37,.019,'#b79a6c');box('DrawingPaper',0,.52,-.203,.263,.33,.004,'#eee2c7');line('BoardDiagonalStrap',[[-.12,.66,.08],[0,.49,.153],[.14,.34,.09]],'#8b7355',.012);
 }
 if(f==='clothBag'){box('SmallClothBag',.193,.35,.045,.11,.14,.07,'#a38c70');parts.strap([[-.11,.67,.03],[0,.53,.153],[.14,.40,.12],[.19,.40,.07]],'#9c8767',.019);}
 if(f==='glasses')parts.spectacles();
 if(f==='bicycle'){for(const side of [-1,1])box('TrouserClip',side*.08,.12,.045,.043,.012,.065,'#b5b4a4',{rig:side<0?'leftLeg':'rightLeg',pattern:'plain'});ball('BikeBellCharm',-.12,.38,.11,.018,.016,.018,'#b6a87e',{pattern:'plain',metal:.5});line('BellLoop',[[-.12,.43,.11],[-.12,.40,.11]],'#756956',.002);}
 if(f==='scarf'){k.loft('RedScarfWrap',[[.66,.085,.09],[.70,.077,.083]],'#aa5950',{pattern:'knit'});panel('RedScarfTail',[[.022,.66],[.062,.65],[.084,.46],[.041,.44]],'#b45f55',{z:.17,pattern:'knit'});}
 if(f==='uniform'){for(const side of [-1,1])box('UniformEpaulette',side*.155,.687,.01,.052,.012,.073,'#d0b574',{rig:side<0?'leftArm':'rightArm'});for(const y of [.42,.49,.56])k.button(.025,y,.158,'#c2a266',.005);}
 if(f==='pigtails'){for(const side of [-1,1]){headLine('TwinTail',[[side*.145,1.105,-.035],[side*.208,1.07,-.075],[side*.215,.985,-.065],[side*.24,.94,-.035]],look.hairColor||'#5e4d40',.041);headBall('HairRibbon',side*.18,1.075,-.055,.032,.015,.028,'#b77873','plain');}}
 if(f==='headphones'){headLine('HeadphoneBand',[[-.23,.86,.06],[-.23,1.13,.02],[0,1.258,-.015],[.23,1.13,.02],[.23,.86,.06]],'#616b6c',.013);for(const side of [-1,1]){headBall('EarPad',side*.225,.86,.06,.026,.053,.045,'#646d6c');headBall('EarCup',side*.249,.86,.06,.018,.048,.041,'#bd9d76','plain');}}
 if(f==='flour')k.flour();
 if(f==='suit'){
  k.loft('OuterSuitJacket',[[.28,.181,.169],[.40,.178,.17],[.57,.177,.151],[.67,.147,.11]],'#5f6873',{open:.22,uv:[2,2]});
  for(const side of [-1,1]){k.fitted('OuterSuitSleeve','#5f6873',{minY:.44,maxY:.706,minArm:.3,side,offset:.018});panel('OuterSuitLapel',[[side*.018,.672],[side*.10,.64],[side*.085,.59],[side*.12,.57],[side*.025,.50]],'#737c85',{z:.173,bulge:.025});}
 }
 if(rare==='kid'){k.loft('GirlsPinafore',[[.15,.21,.16],[.35,.177,.143],[.375,.176,.142]],d.cloth,{pleat:.007});for(const side of [-1,1])parts.strap([[side*.07,.64,.12],[side*.10,.67,.02],[side*.11,.52,-.13]],d.trim,.025);}
 if(rare==='collector'){
  parts.jacket(d.cloth);const ring=new T.TorusGeometry(.043,.004,6,24);ring.translate(.062,.855,.181);headMesh('Monocle',ring,'#c7ad73','plain');headLine('MonocleChain',[[.103,.851,.18],[.12,.755,.15],[.09,.685,.12]],'#c7ad73',.002);
 }
 if(rare==='snow'){
  k.loft('WinterCape',[[.27,.245,.195],[.46,.225,.18],[.64,.19,.148],[.70,.075,.079]],d.cloth,{open:.24,pattern:'knit'});box('HikingPack',0,.49,-.25,.28,.32,.14,'#786c5b');for(const side of [-1,1])parts.strap([[side*.10,.67,-.02],[side*.14,.57,.15],[side*.13,.40,.14]],'#a08d6c',.026);
  for(let i=0;i<9;i++)headBall('SnowOnHair',Math.sin(i*2.1)*.14,1.18+Math.cos(i*1.3)*.035,Math.cos(i*2.1)*.12,.035,.012,.029,'#f2f0e4','plain');
  for(const side of [-1,1])ball('SnowOnShoulder',side*.147,.69,.005,.052,.014,.067,'#f2f0e4',{pattern:'plain'});
 }
}
