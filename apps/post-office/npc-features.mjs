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
 if(f==='late')panel('LooseCollar',[[.025,.677],[.09,.651],[.054,.61]],d.trim,{z:.13});
 if(f==='drawingBoard'){
  box('BackDrawingBoard',0,.52,-.188,.30,.37,.019,'#b79a6c');box('DrawingPaper',0,.52,-.203,.263,.33,.004,'#eee2c7');line('BoardDiagonalStrap',[[-.12,.66,.08],[0,.49,.153],[.14,.34,.09]],'#8b7355',.012);
 }
 if(f==='clothBag'){box('SmallClothBag',.193,.35,.045,.11,.14,.07,'#a38c70');parts.strap([[-.11,.67,.03],[0,.53,.153],[.14,.40,.12],[.19,.40,.07]],'#9c8767',.019);}
 if(f==='glasses')parts.spectacles();
 if(f==='bicycle'){for(const side of [-1,1])box('TrouserClip',side*.08,.12,.045,.043,.012,.065,'#b5b4a4',{rig:side<0?'leftLeg':'rightLeg',pattern:'plain'});ball('BikeBellCharm',-.12,.38,.11,.018,.016,.018,'#b6a87e',{pattern:'plain',metal:.5});line('BellLoop',[[-.12,.43,.11],[-.12,.40,.11]],'#756956',.002);}
 if(f==='scarf'){
  k.fitted('RedScarfWrap','#a84943',{minY:.697,maxY:.733,maxArm:.15,offset:.017,pattern:'knit'});
  ball('ScarfKnot',.025,.693,.184,.038,.028,.025,'#b6524b',{pattern:'knit'});
  panel('RedScarfLongEnd',[[.006,.702],[.073,.685],[.092,.446],[.023,.432]],'#b95750',{z:.19,pattern:'knit'});
  panel('RedScarfShortEnd',[[-.017,.705],[-.078,.684],[-.114,.498],[-.052,.479]],'#a84943',{z:.179,pattern:'knit'});
  for(let i=0;i<5;i++)line('ScarfFringe',[[.029+i*.013,.436,.194],[.027+i*.013,.417,.195]],'#c47769',.002);
 }
 if(f==='uniform'){
  for(const side of [-1,1]){k.fitted('UniformShoulderBoard','#3e596a',{minY:.646,maxY:.698,minArm:.3,side,offset:.014,pattern:'plain'});k.fitted('UniformGoldBraid','#d8bd76',{minY:.662,maxY:.682,minArm:.3,side,offset:.017,pattern:'plain'});}
  panel('UniformButtonTape',[[-.023,.634],[.024,.634],[.024,.362],[-.023,.362]],'#496374',{z:.177,pattern:'plain'});
  for(const y of [.40,.46,.52,.58])k.button(0,y,.195,'#e0c47e',.009);
  panel('UniformChestBadge',[[-.11,.582],[-.05,.582],[-.05,.547],[-.08,.531],[-.11,.547]],'#d8bd76',{z:.183,pattern:'plain'});
  line('UniformBadgeStripe',[[-.10,.564,.193],[-.06,.564,.193]],'#466172',.003);
 }
 if(f==='pigtails'){for(const side of [-1,1]){headLine('TwinTail',[[side*.145,1.105,-.035],[side*.208,1.07,-.075],[side*.215,.985,-.065],[side*.24,.94,-.035]],look.hairColor||'#5e4d40',.041);headBall('HairRibbon',side*.18,1.075,-.055,.032,.015,.028,'#b77873','plain');}}
 if(f==='headphones'){headLine('HeadphoneBand',[[-.23,.86,.06],[-.23,1.13,.02],[0,1.258,-.015],[.23,1.13,.02],[.23,.86,.06]],'#616b6c',.013);for(const side of [-1,1]){headBall('EarPad',side*.225,.86,.06,.026,.053,.045,'#646d6c');headBall('EarCup',side*.249,.86,.06,.018,.048,.041,'#bd9d76','plain');}}
 if(f==='flour')k.flour();
 if(f==='suit'){
  k.loft('OuterSuitJacket',[[.28,.181,.169],[.40,.178,.17],[.57,.177,.151],[.67,.147,.11]],'#5f6873',{open:.22,uv:[2,2]});
  for(const side of [-1,1]){k.fitted('OuterSuitSleeve','#5f6873',{minY:.44,maxY:.706,minArm:.3,side,offset:.018});panel('OuterSuitLapel',[[side*.018,.672],[side*.10,.64],[side*.085,.59],[side*.12,.57],[side*.025,.50]],'#737c85',{z:.173,bulge:.025});}
 }
 if(rare==='kid'){k.loft('GirlsPinafore',[[.15,.21,.16],[.35,.177,.143],[.375,.176,.142]],d.cloth,{pleat:.007});for(const side of [-1,1])parts.strap([[side*.07,.64,.12],[side*.10,.67,.02],[side*.11,.52,-.13]],d.trim,.025);}
 if(rare==='collector'){
  parts.jacket(d.cloth);const ring=new T.TorusGeometry(.056,.006,8,32);ring.translate(.068,.861,.205);headMesh('Monocle',ring,'#d9b968','plain');headLine('MonocleChain',[[.12,.854,.208],[.143,.79,.194],[.128,.716,.176],[.09,.685,.14]],'#c7a55e',.003);
 }
 if(rare==='snow'){
  k.loft('WinterCape',[[.27,.245,.195],[.46,.225,.18],[.64,.19,.148],[.70,.075,.079]],d.cloth,{open:.24,pattern:'knit'});box('HikingPack',0,.49,-.25,.28,.32,.14,'#786c5b');for(const side of [-1,1])parts.strap([[side*.10,.67,-.02],[side*.14,.57,.15],[side*.13,.40,.14]],'#a08d6c',.026);
  k.headwear('winter',1.154,()=>{
   headBall('WinterKnittedCap',0,1.2,-.01,.184,.065,.167,d.bottom,'knit');headBall('WinterCapRib',0,1.165,-.008,.185,.025,.166,d.cloth,'knit');
   for(let i=0;i<13;i++){const a=i*2.4,r=.13*Math.sqrt(i/13);headBall('SettledSnow',Math.sin(a)*r,1.258-r*.18,Math.cos(a)*r-.01,.048,.019,.041,'#fff8ed','plain');}
  });
  for(const side of [-1,1])for(let i=0;i<5;i++)ball('SnowOnShoulder',side*(.105+i*.019),.695-(i-2)**2*.002,.025+(i%2)*.025,.047,.020,.054,'#fff8ed',{pattern:'plain'});
 }
}
