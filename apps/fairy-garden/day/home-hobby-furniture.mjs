import './home-hobbies.js?v=fg-90b53e2779ab7a1c';
import {rounded,arch} from './home-shapes.mjs?v=fg-90b53e2779ab7a1c';
import {WORK_CHAIR} from './work-contacts.mjs?v=fg-90b53e2779ab7a1c';
const F=.08;
export function createHomeHobbyFurniture(k,a,p,g){
 if(!globalThis.CharDayHomeHobbies.activities[a.hobby])return false;
 const box=(n,q,parent=g)=>k.box(n,{color:p.wood,...q},parent),flat=(n,w,d,y,color)=>k.profile(n,{shape:rounded(w,d,.06),horizontal:true,y,depth:.035,color},g);
 if(a.hobby==='piano'){
  const hobby=globalThis.CharDayHomeHobbies.activities.piano,keys=hobby.contact.y,stool=hobby.seat.z+WORK_CHAIR.forward;
  box('PianoCase',{z:-.44,y:F+.61,w:a.w,h:1.12,d:.68});
  k.profile('PianoArchedBack',{shape:arch(a.w-.1,1.31),y:F+.16,z:-.73,depth:.08,color:p.wood},g);
  box('PianoFrontPanel',{z:-.08,y:F+.80,w:a.w-.17,h:.50,d:.035,color:p.fabric});
  flat('PianoKeyboardTray',1.91,.54,F+keys-.0345,p.dark);g.getObjectByName('PianoKeyboardTray').position.z=.12;
  for(let i=0;i<21;i++){
   const key=k.replaceableGroup('PianoKey-'+i,{x:-.84+i*.084,y:F+keys-.009,z:.06},g);key.userData.key=i;key.userData.homePiano=a.id;
   box('PianoWhiteKey',{y:0,z:.14,w:.079,h:.018,d:.31,color:p.paper,radius:.002},key);
   if(i<20&&![2,6].includes(i%7))box('PianoBlackKey',{x:.041,y:.022,z:.015,w:.045,h:.035,d:.18,color:p.dark,radius:.003},key);
  }
  box('PianoScoreStand',{y:F+1.22,z:-.24,w:.62,h:.36,d:.045,color:p.dark});
  box('PianoScorePaper',{y:F+1.23,z:-.21,w:.54,h:.29,d:.012,color:p.paper});
  for(let i=0;i<5;i++)box('PianoScoreLine',{y:F+1.17+i*.023,z:-.199,w:.43,h:.004,d:.002,color:p.dark,radius:0});
  for(const x of [-.18,0,.18])box('PianoPedal',{x,y:F+.14,z:-.015,w:.055,h:.04,d:.20,color:p.accent});
  for(const x of [-.21,.21])for(const side of [-1,1])k.cylinder('PianoStoolFoot',{x,z:stool+side*(WORK_CHAIR.depth/2-.04),y:F+(hobby.seat.rise-.035)/2,r:.028,h:hobby.seat.rise-.035,color:p.dark},g);
  flat('PianoStoolSeat',.55,WORK_CHAIR.depth,F+hobby.seat.rise-.0175,p.fabric);g.getObjectByName('PianoStoolSeat').position.z=stool;
 }else if(a.hobby==='paint'){
  for(const side of [-1,1]){const leg=box('EaselFrontLeg',{x:side*.43,z:.18,y:F+.8,w:.075,h:1.6,d:.075,color:p.dark});leg.rotation.z=side*.09;}
  const back=box('EaselRearLeg',{z:-.25,y:F+.77,w:.07,h:1.54,d:.07,color:p.dark});back.rotation.x=.14;
  box('EaselMast',{z:.02,y:F+.98,w:.09,h:1.92,d:.075});
  box('EaselCanvasFrame',{z:.27,y:F+1.01,w:.90,h:.88,d:.07});
  box('EaselCanvasPaper',{z:.314,y:F+1.01,w:.79,h:.77,d:.016,color:p.paper});
  box('EaselCanvasTray',{z:.22,y:F+.57,w:1.04,h:.06,d:.38});
  for(let i=0;i<12;i++){const stroke=k.replaceableGroup('EaselBrushStroke:'+i,{x:-.27+(i%4)*.16,z:.327+i*.0002,y:F+.75+Math.floor(i/4)*.18},g);box('BrushStroke',{w:.15,h:.11,d:.003,color:[p.fabric,p.accent,p.dark][Math.floor(i/4)],radius:.015},stroke);stroke.userData.workStroke=i;stroke.userData.workKind='paint';stroke.userData.workFurniture=a.id;}
  k.cylinder('EaselPaintCup',{x:.45,z:.24,y:F+.65,r:.055,h:.13,color:p.accent},g);
 }else if(a.hobby==='guitar'){
  const instrument=k.replaceableGroup('AcousticGuitar',{y:F+.34,z:-.10},g);instrument.userData.homeInstrument=a.id;
  for(const [y,r]of [[.13,.19],[.36,.145]])k.ellipsoid('GuitarBody',{y,w:r*2,h:r*2,d:.13,color:p.wood},instrument);
  box('GuitarNeck',{y:.70,w:.065,h:.65,d:.045,color:p.dark},instrument);box('GuitarHead',{y:1.02,w:.10,h:.14,d:.05,color:p.wood},instrument);
  k.cylinder('GuitarSoundHole',{y:.29,z:.069,r:.055,h:.008,color:p.dark,rotation:[Math.PI/2,0,0]},instrument);
  for(let i=0;i<6;i++)box('GuitarString',{x:-.023+i*.009,y:.52,z:.077,w:.0018,h:.78,d:.002,color:p.paper,radius:0},instrument);
  k.cylinder('GuitarStandFoot',{y:F+.03,r:.24,h:.05,color:p.dark},g);box('GuitarStandSpine',{y:F+.36,z:-.14,w:.035,h:.64,d:.04,color:p.dark});
  box('GuitarScoreTray',{x:.30,y:F+.9,z:.12,w:.30,h:.33,d:.035,color:p.dark});box('GuitarScorePaper',{x:.30,y:F+.9,z:.143,w:.24,h:.25,d:.009,color:p.paper});
 }else if(a.hobby==='weights'){
  for(const x of [-.49,.49])box('WeightRackFoot',{x,y:F+.25,w:.055,h:.50,d:a.d,color:p.dark});
  for(const y of [.22,.48]){box('WeightRackTray',{y:F+y,w:a.w,h:.035,d:.44});for(const x of [-.29,.29]){
   const weight=k.replaceableGroup('HomeRackWeight',{x,y:F+y+.083},g);weight.userData.dayWeights=a.id;
   k.cylinder('WeightBar',{r:.022,h:.25,color:p.accent,rotation:[0,0,Math.PI/2]},weight);
   for(const side of [-1,1])k.cylinder('WeightDisc',{x:side*.13,r:.075,h:.07,color:p.dark,rotation:[0,0,Math.PI/2]},weight);
  }}
 }else{
  flat('ExerciseMat',a.w,a.d,F+.0175,p.fabric);
  for(const side of [-1,1])box('MatBorder',{x:side*(a.w/2-.06),y:F+.036,w:.018,h:.003,d:a.d-.19,color:p.paper,radius:0});
  for(let i=0;i<4;i++)box('MatGripLine',{z:-.65+i*.43,y:F+.037,w:.55,h:.002,d:.008,color:p.accent,radius:0});
 }
 return true;
}
