import {homeBathroom,bathroomStructure,BASIN_USE} from './bathroom-layout.mjs?v=fg-90b53e2779ab7a1c';
import {rounded,rimShape,shift} from './home-shapes.mjs?v=fg-90b53e2779ab7a1c';
import {homeSurface} from './home-surfaces.mjs?v=fg-90b53e2779ab7a1c';

export function createBathroomShell(k,map,p){
 const a=homeBathroom(map.room),g=k.group('HomeBathroom',{x:a.x,z:0});g.userData.architecture='bathroom-wing';
 const box=(name,v)=>k.box(name,{color:p.paper,...v},g);
 box('BathroomFoundation',{y:-.155,w:a.w+.15,h:.31,d:a.d+.2,color:p.dark,radius:.08});
 homeSurface(box('BathroomTileFloor',{y:.025,w:a.w+.1,h:.11,d:a.d+.1,color:p.paper,radius:.03}),'tile','floor');
 homeSurface(box('BathroomBackWall',{y:1.4,z:-a.d/2,w:a.w+.12,h:2.64,d:.14,color:p.wall}),'tile','back');
 box('BathroomSkirting',{y:.2,z:-a.d/2+.09,w:a.w,h:.24,d:.06,color:p.fabric});
 box('BathroomLowFront',{y:.4,z:a.d/2,w:a.w,h:.64,d:.13,color:p.wall});
 box('BathroomLowRight',{x:a.w/2,y:.4,w:.13,h:.64,d:a.d,color:p.wall});
 for(const s of bathroomStructure(map.room)){box('BathroomDivider',{x:s.x-a.x,z:s.z,y:.08+s.h/2,w:s.w,h:s.h,d:s.d,color:p.wall});box('BathroomDividerCap',{x:s.x-a.x,z:s.z,y:.08+s.h,w:.19,h:.06,d:s.d,color:p.wood});}
 box('BathroomDoorLintel',{x:a.edge+.32-a.x,y:2.4,w:.18,h:.14,d:a.door+.1,color:p.wood});
 for(const side of [-1,1])box('BathroomDoorJamb',{x:a.edge+.32-a.x,z:side*(a.door/2+.04),y:1.27,w:.18,h:2.4,d:.09,color:p.wood});
 k.sign('BathroomPlaque',{text:'浴室',x:a.edge+.42-a.x,y:1.93,z:1.57,w:.64,h:.25,heading:Math.PI/2,color:p.paper,ink:p.dark},g);
 return g;
}
export function createBathroomFurniture(k,a,p,g){
 if(!['shower','basin','toilet'].includes(a.kind))return false;
 const box=(name,v)=>k.box(name,{color:p.paper,...v},g),flat=(name,shape,v)=>k.profile(name,{shape,horizontal:true,...v},g);
 const metal=(name,v)=>{const o=k.tube(name,{r:.024,color:p.dark,...v},g);o.material=o.material.clone();o.material.metalness=.5;o.material.roughness=.25;return o;};
 if(a.kind==='shower'){
  flat('ShowerTray',rimShape(rounded(a.w,a.d,.18),rounded(a.w-.18,a.d-.18,.12)),{y:.13,depth:.09,color:p.paper});
  flat('ShowerFloor',rounded(a.w-.15,a.d-.15,.12),{y:.086,depth:.012,color:p.glass});
  k.cylinder('ShowerDrain',{z:.25,y:.098,r:.10,h:.01,color:p.dark},g);for(const x of [-.035,0,.035])box('ShowerDrainSlot',{x,z:.25,y:.105,w:.012,h:.004,d:.11,color:p.paper,radius:0});
  box('ShowerTileBack',{z:-a.d/2+.045,y:1.35,w:a.w,h:2.54,d:.09,color:p.fabric});
  for(let x=-a.w/2+.35;x<a.w/2;x+=.35)box('ShowerTileJoint',{x,z:-a.d/2+.095,y:1.35,w:.009,h:2.5,d:.005,color:p.paper,radius:0});
  for(let y=.35;y<2.6;y+=.35)box('ShowerTileJoint',{z:-a.d/2+.095,y,w:a.w-.05,h:.009,d:.005,color:p.paper,radius:0});
  const glass=box('ShowerGlass',{x:a.w/2-.035,y:1.31,w:.035,h:2.45,d:a.d-.12,color:p.glass,radius:0});glass.material=glass.material.clone();glass.material.transparent=true;glass.material.opacity=.22;glass.material.depthWrite=false;glass.castShadow=false;
  metal('ShowerPipe',{points:[[0,.82,-a.d/2+.15],[0,2.38,-a.d/2+.15],[0,2.52,-.3],[0,2.52,0]]});
  k.cylinder('ShowerHead',{y:2.47,r:.18,h:.06,color:p.dark},g);box('ShowerMixer',{y:1.02,z:-a.d/2+.13,w:.38,h:.075,d:.09,color:p.dark});
  metal('ShowerCurtainRail',{points:[[-a.w/2+.04,2.58,a.d/2-.08],[a.w/2-.04,2.58,a.d/2-.08]]});
  for(let i=0;i<4;i++)box('ShowerFoldedCurtain',{x:-a.w/2+.055+i*.06,y:1.39,z:a.d/2-.08,w:.055,h:2.3,d:.09,color:p.paper});
  box('ShowerSoapShelf',{x:.47,y:1.19,z:-a.d/2+.19,w:.33,h:.045,d:.19,color:p.paper});k.cylinder('ShowerSoapBottle',{x:.46,y:1.3,z:-a.d/2+.18,r:.065,h:.16,color:p.accent},g);
 }else if(a.kind==='basin'){
  box('BasinCabinet',{y:.49,w:a.w-.07,h:.78,d:a.d-.05,color:p.wood});for(const x of [-a.w/4,a.w/4]){box('BasinDoor',{x,y:.5,z:a.d/2,w:a.w/2-.055,h:.62,d:.025,color:p.fabric});box('BasinHandle',{x,y:.69,z:a.d/2+.025,w:.16,h:.027,d:.035,color:p.dark});}
  flat('BasinRim',rimShape(rounded(a.w+.03,a.d+.04,.16),shift(rounded(.69,.40,.15),0,-BASIN_USE.bowlZ)),{y:.94,depth:.09,color:p.paper});
  flat('BasinBowl',rounded(.68,.39,.15),{y:.902,z:BASIN_USE.bowlZ,depth:.012,color:p.glass});
  metal('BasinTap',{points:[[0,.98,-.26],[0,1.27,-.26],[0,1.31,-.1],[0,BASIN_USE.tapY,BASIN_USE.z]]});
  const frame=box('BasinMirrorFrame',{y:1.8,z:-a.d/2+.035,w:a.w*.82,h:1.15,d:.055,color:p.wood,radius:.12}),mirror=box('BasinMirrorGlass',{y:1.8,z:-a.d/2+.07,w:a.w*.82-.09,h:1.05,d:.012,color:p.glass,radius:.09});mirror.material=mirror.material.clone();mirror.material.metalness=.65;mirror.material.roughness=.15;
  box('BasinMirrorGlint',{x:.22,y:1.95,z:-a.d/2+.08,w:.02,h:.43,d:.006,color:p.paper,radius:0});
  k.cylinder('BasinSoap',{x:-a.w*.35,y:1.08,z:.12,r:.065,h:.18,color:p.accent},g);box('BasinSoapPump',{x:-a.w*.35,y:1.19,z:.15,w:.11,h:.03,d:.045,color:p.dark});
  metal('BasinTowelRail',{points:[[-a.w/2+.07,.64,a.d/2+.09],[a.w/2-.07,.64,a.d/2+.09]]});
  for(const x of [-.23,.23]){box('BasinTowel',{x,y:.47,z:a.d/2+.12,w:.25,h:.37,d:.035,color:x<0?p.accent:p.paper});for(const y of [.32,.34])box('BasinTowelStripe',{x,y,z:a.d/2+.141,w:.23,h:.014,d:.004,color:p.fabric,radius:0});}
 }else{
  k.ellipsoid('ToiletPedestal',{y:.29,z:.03,w:.52,h:.42,d:.75,color:p.paper},g);
  flat('ToiletBowl',rimShape(rounded(a.w-.03,.88,.36),rounded(a.w-.21,.61,.26)),{y:.51,z:.13,depth:.12,color:p.paper});
  flat('ToiletWater',rounded(a.w-.23,.60,.26),{y:.465,z:.13,depth:.012,color:p.glass});
  flat('ToiletSeat',rimShape(rounded(a.w,.90,.36),rounded(a.w-.18,.64,.27)),{y:.59,z:.13,depth:.035,color:p.fabric});
  box('ToiletTank',{y:.75,z:-a.d/2+.23,w:a.w-.04,h:.67,d:.36,color:p.paper,radius:.1});box('ToiletTankLid',{y:1.10,z:-a.d/2+.23,w:a.w,h:.055,d:.39,color:p.paper});
  k.cylinder('ToiletFlush',{y:1.135,z:-a.d/2+.23,r:.06,h:.013,color:p.dark},g);
  const lid=flat('ToiletRaisedLid',rounded(a.w-.025,.86,.33),{y:0,depth:.045,color:p.paper});lid.rotation.x=1.40;lid.position.set(0,.91,-.38);
  metal('ToiletRollHolder',{points:[[a.w/2-.10,.75,-.3],[a.w/2+.03,.75,-.3],[a.w/2+.03,.75,0]]});k.cylinder('ToiletPaper',{x:a.w/2+.03,y:.75,z:-.12,r:.09,h:.18,rotation:[Math.PI/2,0,0],color:p.paper},g);
 }
 return true;
}
