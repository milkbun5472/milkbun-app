import * as T from 'three';
import {createRoomKit} from './places/room-kit.mjs?v=fg-bf2a8f69e3079bf5';
import {DAY_PLACES} from './places/maps.mjs?v=fg-bf2a8f69e3079bf5';
import {PROFESSIONAL_OPTIONS} from './professional.mjs?v=fg-bf2a8f69e3079bf5';

const palettes={
 warm:{floor:'#c6aa86',paper:'#efe4cf',wood:'#b79168',accent:'#8eaa86',dark:'#5c5343'},
 clean:{floor:'#ccd4c7',paper:'#edf0e7',wood:'#c5cbbd',accent:'#81a4ad',dark:'#4d6265'},
 ink:{floor:'#967158',paper:'#d9cbb5',wood:'#7e5746',accent:'#8d9687',dark:'#3e3634'},
 soft:{floor:'#dacdc1',paper:'#f0e5df',wood:'#d6c5b8',accent:'#c3a4b0',dark:'#776468'}
};
const decorTypes={literature:'books',research:'index',travel:'map',commute:'index',strength:'records',stretch:'roll',fresh:'produce',daily:'parcel',creative:'swatches',technical:'circuit',science:'model',field:'radio',analysis:'index',coffee:'coffee',bakery:'bakery',cinema:'film',portrait:'swatches',music:'record',voice:'books',consultation:'index',hearing:'records',physical:'records',craft:'clay',woodwork:'wood',strategy:'map',art:'swatches'};
const primaryDesk={dayWorkshop:'repair-bench',dayStudy:'ink-desk',dayLegal:'law-desk',dayTraining:'map-table'};

export function applyProfessionalView(view,id,options={}){
 if(!view?.root)return view;
 const palette=palettes[options?.style],root=view.root;
 if(palette){
  const done=new Set();root.traverse(o=>{for(const mat of Array.isArray(o.material)?o.material:[o.material]){
   if(!mat?.color||mat.map||mat.userData.dayTone==='landscape'||done.has(mat))continue;done.add(mat);
   const hsl=mat.color.getHSL({},T.SRGBColorSpace),tone=mat.userData.dayTone||(hsl.l<.28?'dark':hsl.l>.79?'paper':hsl.s<.13?'paper':hsl.h>.18&&hsl.h<.65?'accent':'wood');
   mat.color.set(palette[tone]);mat.color.offsetHSL(0,0,Math.max(-.12,Math.min(.1,(hsl.l-.55)*.24)));
  }});
 }
 const option=PROFESSIONAL_OPTIONS[id],choice=options?.[option?.field],defaults=Object.keys(option?.values||{})[0];
 if(option?.field==='display'&&choice&&choice!==defaults){
  const map=DAY_PLACES[id],p=map.furniture.find(p=>p.id===primaryDesk[id])||map.furniture.find(p=>p.kind==='table')||map.furniture.find(p=>p.kind==='counter');
  if(p){
   const k=createRoomKit(),g=k.group('ProfessionalDecor:'+id+':'+choice,{x:p.x,z:p.z,heading:p.heading||0});g.userData.replaceable=true;
   const color=palette||{wood:'#b89575',paper:'#eadfcc',accent:'#91aa98',dark:'#5c716a'},y=.08+(p.top||.85),x=p.w/2-.40,z=-p.d/2+.27;
   const b=(name,v)=>k.box(name,{x,y:y+.06,z,color:color.accent,...v},g);
   const type=decorTypes[choice]||'books';
   if(['books','index','records'].includes(type)){
    for(let i=0;i<(type==='index'?4:3);i++)k.book('PersonalBook',{x:x-i*.035,y:y+.045+i*.073,z,w:.34,h:.30,d:.40,color:i%2?color.wood:color.accent,flat:true},g);
    if(type==='index')b('IndexTabs',{x:x+.18,y:y+.20,w:.07,h:.035,d:.30,color:color.paper});
   }else if(type==='map'){
    b('FoldedMap',{w:.58,h:.018,d:.38,color:color.paper});for(let i=0;i<3;i++)b('MapRoute',{x:x-.18+i*.17,y:y+.073,w:.012,h:.003,d:.31,color:color.accent,radius:0});
    k.cylinder('MapRoll',{x:x+.24,y:y+.13,z:z-.14,r:.055,h:.5,color:color.wood,rotation:[0,0,Math.PI/2]},g);
   }else if(['clay','coffee','bakery','produce'].includes(type)){
    k.cylinder('PersonalTray',{x,y:y+.025,z,r:.25,h:.04,color:color.wood},g);
    if(type==='clay'){k.cylinder('ClayBowl',{x,y:y+.10,z,r:.16,h:.13,color:'#b38c74'},g);k.cylinder('ClayBowlInside',{x,y:y+.17,z,r:.12,h:.008,color:'#756d60'},g);}
    else for(let i=0;i<4;i++){const a=i*2.4;k.ellipsoid('PersonalSample',{x:x+Math.sin(a)*.14,y:y+.095,z:z+Math.cos(a)*.13,w:.14,h:type==='coffee'?.06:.11,d:.12,color:type==='produce'?(i%2?'#9ab47b':'#d6a177'):type==='coffee'?'#7d5c44':'#d5bc94'},g);}
   }else if(['circuit','wood','swatches'].includes(type)){
    for(let i=0;i<4;i++){b('MaterialSample',{x:x-.17+i*.11,y:y+.04+i*.012,w:.09,h:.05,d:.33,color:type==='wood'?['#916d49','#bca480','#d5c2a1','#6b5140'][i]:[color.accent,color.paper,color.wood,color.dark][i]});}
    if(type==='circuit')for(let i=0;i<4;i++)b('CircuitChip',{x:x-.15+i*.1,y:y+.12,w:.065,h:.025,d:.1,color:color.dark});
   }else if(['record','film'].includes(type)){
    k.cylinder('PersonalDisc',{x,y:y+.04,z,r:.22,h:.027,color:color.dark},g);k.cylinder('DiscLabel',{x,y:y+.056,z,r:.065,h:.006,color:color.paper},g);
    if(type==='film')for(let i=0;i<5;i++){const a=i*Math.PI*2/5;k.cylinder('ReelHole',{x:x+Math.sin(a)*.14,y:y+.057,z:z+Math.cos(a)*.14,r:.035,h:.006,color:color.paper},g);}
   }else if(type==='radio'){
    b('FieldRadio',{y:y+.17,w:.22,h:.31,d:.13,color:color.dark});b('RadioSpeaker',{y:y+.19,z:z+.071,w:.15,h:.12,d:.012,color:color.accent});b('RadioAntenna',{x:x+.065,y:y+.40,w:.014,h:.20,d:.014,color:color.dark});
   }else if(type==='roll')k.cylinder('RolledMat',{x,y:y+.11,z,r:.11,h:.53,color:color.accent,rotation:[0,0,Math.PI/2]},g);
   else if(type==='model'){k.sphere('ScienceCore',{x,y:y+.21,z,r:.11,color:color.accent},g);for(const sign of [-1,1])k.sphere('ScienceOrbit',{x:x+sign*.16,y:y+.14,z,r:.055,color:color.wood},g);}
   else b('PersonalParcel',{y:y+.13,w:.38,h:.24,d:.33,color:color.paper});
   root.add(k.finish().root);
   root.userData.professionalDecor={choice,type,piece:p.id};
  }
 }
 root.userData.professional={...(options||{})};
 return view;
}
