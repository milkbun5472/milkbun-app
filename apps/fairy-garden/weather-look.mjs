import {MAPS,seasonOf,weather,walkable,floorHeight,inPolygon} from './world.mjs?v=fg-e69020e9199c9dc0';
// Visual profiles consume the existing seeded weather; they never draw new weather or change saves.
const PALETTES=[
 {leaf:'#acd69a',ground:'#a8bd83',water:'#80b9ae',sky:'#d9e7cf',fog:'#dce5cf',rainSky:'#abbeb7',drift:'#f5c6d2',sun:'#fff0cd'},
 {leaf:'#4e8b58',ground:'#729961',water:'#59a9ad',sky:'#c7e3df',fog:'#c6dad7',rainSky:'#8ba7b3',drift:'#e8e9a0',sun:'#fff4d8'},
 {leaf:'#c98a43',ground:'#ac9467',water:'#8baca0',sky:'#ecd9bc',fog:'#d9c8b0',rainSky:'#a2aaa5',drift:'#c9863e',sun:'#ffd7a2'},
 {leaf:'#9cb1b5',ground:'#d3dfe1',water:'#bad9df',sky:'#dce8ef',fog:'#d1dce4',rainSky:'#bacbd9',drift:'#e4f4ff',sun:'#e9f3ff'}
];
export function weatherLook(s){const season=seasonOf(s.day),index=season.index%4,kind=weather(s.day,s.epoch),p=PALETTES[index],rain=kind==='细雨',snow=kind==='细雪',mist=kind==='薄雾',night=s.minute>=season.dusk+90;
 return {...p,key:index+':'+kind,season:index,kind,rain,snow,mist,night,
  sky:mist?p.fog:rain?p.rainSky:snow?'#c3d3e0':p.sky,
  sunScale:rain?[.48,.35,.4,.4][index]:snow?.48:mist?.5:1,
  ambientScale:rain?.82:mist?.92:snow?.94:1,
  sunColor:rain?'#c5dce6':mist?p.fog:p.sun,
  fogNear:mist?[9,11,8,7][index]:rain?16:snow?13:27,
  fogFar:mist?[34,38,30,29][index]:rain?[45,42,43,43][index]:snow?43:62,
  fallCount:rain?[400,620,490,490][index]:snow?380:0,
  fallSize:rain?[23,29,26,26][index]:snow?5.5:0,
  fallSpeed:rain?[5.8,8,6.6,6.6][index]:snow?.58:0,
  wind:rain?[.8,1.8,2.4,2.4][index]:snow?.7:mist?.22:[.35,.18,.85,.18][index],
  driftCount:Math.round([58,night?42:28,78,24][index]*(rain?.45:mist?.4:snow?.3:1)),
  driftSize:[6,night?3.5:2.5,7,2.5][index],
  mistOpacity:mist?[.14,.1,.17,.16][index]:rain?.04:snow?.04:0,
  snowCover:index===3?(snow?.98:mist?.87:.78):0,
  wet:rain,roughness:rain?.3:0
 };
}
// Contact effects use the same collision/surface data as walking. No splashes on invisible roofs.
export function rainSurface(s,x,z){
 if(!MAPS[s.map]?.outdoor)return null;
 if(walkable(x,z,s.map,s))return {y:floorHeight(s.map,{x,z},s)+.015,water:false};
 const m=MAPS[s.map],lake=m.lake;
 if(lake&&inPolygon(x,z,lake.shore)&&seasonOf(s.day).index%4!==3)return {y:lake.waterHeight+.018,water:true};
 const pond=m.obstacles.find(o=>Number.isFinite(o.waterHeight)&&Math.hypot(x-o.x,z-o.z)<o.r);
 return pond?{y:pond.waterHeight+.018,water:true}:null;
}
