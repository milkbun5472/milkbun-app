import * as T from 'three';
import {createRoomKit} from '../fairy-garden/day/places/room-kit.mjs?v=fg-cde9b8759c1380df';
// The neighboring street is local scene geometry; it never downloads a new model.
export function createShopExterior(scene){
 const k=createRoomKit(),{root,box,cylinder,ellipsoid,group,sign}=k;root.name='PostOfficeStreet';scene.add(root);
 const paving=box('OutsidePaving',{z:-6,y:-.07,w:15,h:.18,d:6.6,color:'#b8b5a7',radius:0}),grass=box('SeasonGround',{x:5.9,z:-5.5,y:.03,w:2.6,h:.08,d:4,color:'#9aab80',radius:0});
 for(let row=0;row<3;row++)for(let i=0;i<15;i++)box('Cobble',{x:-7+i+row%2*.4,z:-3.85-row*.68,y:.035,w:.91,d:.6,h:.045,color:row%2?'#c9c4b0':'#c2bfad',radius:.025});
 const windows=[],trees=[],leaves=[];
 for(const [i,x]of [-4.7,0,4.7].entries()){
  const house=group('NeighborHouse:'+i,{x,z:-8});box('NeighborWall',{y:1.35,w:3.8,h:2.7,d:2.5,color:['#b4c0b0','#dac7a7','#b9c4c5'][i]},house);
  for(const side of [-1,1]){const roof=box('NeighborRoof',{x:side*.99,y:3.02,w:2.2,h:.13,d:2.9,color:['#889b8c','#a58a70','#7e9797'][i]},house);roof.rotation.z=side*-.28;}
  box('NeighborDoor',{x:.7,y:.85,z:1.27,w:.75,h:1.7,d:.06,color:'#7a8f80'},house);
  for(const xx of [-1.15,-.1]){const frame=box('NeighborWindowFrame',{x:xx,y:1.6,z:1.28,w:.78,h:.95,d:.07,color:'#71877b'},house),pane=box('NeighborWindow',{x:xx,y:1.6,z:1.33,w:.66,h:.81,d:.025,color:'#c5d3be'},house);windows.push(pane.material);box('NeighborMullion',{x:xx,y:1.6,z:1.36,w:.04,h:.83,d:.025,color:'#71877b'},house);}
  sign('NeighborSign',{text:['花与茶','巷口书屋','慢慢面包'][i],x:0,y:2.58,z:1.31,w:2.35,h:.33,color:'#e4d9bd',ink:'#667568'},house);
 }
 for(const [i,x]of [-5.7,5.6].entries()){
  const tree=group('SeasonTree:'+i,{x,z:-4.9});tree.userData.replaceable=true;trees.push(tree);cylinder('TreeTrunk',{y:1.1,r:.11,h:2.2,color:'#8e795b'},tree);
  for(const [xx,y,zz,w]of [[0,2.6,0,1.65],[-.45,2.2,.1,1.18],[.5,2.28,-.1,1.3]]){const leaf=ellipsoid('SeasonLeaves',{x:xx,y,z:zz,w,h:w*.78,d:w*.84,color:'#a1b78b'},tree);leaves.push(leaf.material);}
  box('TreePlanter',{y:.15,w:1.8,h:.3,d:1.5,color:'#afa58a'},tree);
 }
 for(const x of [-2.4,3.4]){cylinder('StreetLamp',{x,y:1.5,z:-5.1,r:.055,h:3,color:'#6d8173'});box('StreetLantern',{x,y:3.04,z:-5.1,w:.34,h:.48,d:.34,color:'#dfd3aa'});box('LanternRoof',{x,y:3.33,z:-5.1,w:.47,h:.1,d:.47,color:'#758878'});}
 const mailbox=group('StreetPostbox',{x:-4.9,z:4.1});box('PostboxLeg',{y:.45,w:.18,h:.85,d:.2,color:'#6c8074'},mailbox);box('PostboxBody',{y:1.12,w:.75,h:.85,d:.48,color:'#a97660'},mailbox);box('LetterSlot',{y:1.28,z:.25,w:.49,h:.07,d:.015,color:'#5e6256'},mailbox);sign('PostboxMark',{text:'信',y:.95,z:.26,w:.35,h:.31,color:'#a97660',ink:'#f2dfb9'},mailbox);
 const mist=new T.Mesh(new T.PlaneGeometry(15,4),new T.MeshBasicMaterial({color:'#bfcfc8',transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide}));mist.name='StreetMist';mist.position.set(0,1.8,-6.1);mist.visible=false;
 const windPositions=new Float32Array(16*6),windGeometry=new T.BufferGeometry();windGeometry.setAttribute('position',new T.BufferAttribute(windPositions,3));const gusts=new T.LineSegments(windGeometry,new T.LineBasicMaterial({color:'#f8f1dc',transparent:true,opacity:.52,depthWrite:false}));gusts.name='StreetWind';gusts.frustumCulled=false;gusts.visible=false;
 k.finish();root.add(mist,gusts);let state=null,key='';
 function sync(env){if(!env)return;state=env;const next=env.season+':'+env.kind+':'+env.night+':'+env.phase;if(next===key)return;key=next;
  for(const material of new Set(leaves))material.color.set(env.leaf);
  grass.material.color.set(env.season===3?'#d5dfda':env.ground);paving.material.color.set(env.wet?'#9daba5':env.season===3?'#cfd7d0':'#b8b5a7');paving.material.roughness=env.wet?.48:.88;
  for(const material of new Set(windows)){material.emissive.set('#e4bd72');material.emissiveIntensity=env.night?.6:env.phase==='傍晚'?.3:0;}
  mist.visible=!!env.mist;gusts.visible=!!env.windy;
 }
 function tick(time){for(const [i,tree]of trees.entries())tree.rotation.z=Math.sin(time*(state?.windy?1.8:.7)+i)*.02*(state?.wind||.3);if(gusts.visible){for(let i=0;i<16;i++){const x=((time*2.7+i*1.37)%15)-7.5,y=.4+i%6*.35,z=-4.3-i%5*.7;windPositions.set([x,y,z,x-.38-i%3*.1,y+.025,z],i*6);}windGeometry.attributes.position.needsUpdate=true;}}
 return {root,sync,tick,snapshot:()=>({houses:3,trees:trees.length,windowStreet:true,season:state?.season,seasonName:state?.seasonName,weather:state?.kind,source:state?.source||'shared-town',rain:!!state?.rain,snow:!!state?.snow,mist:mist.visible,wind:state?.wind||0,windStreaks:gusts.visible?16:0,treeSway:trees.map(t=>t.rotation.z)})};
}
