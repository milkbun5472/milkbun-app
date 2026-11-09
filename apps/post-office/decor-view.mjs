import {SHOP_CUSHIONS} from './furniture.mjs?v=fg-16914e0f39f01666';
import * as T from 'three';
// Monthly names come from the text-shop catalogue. Small props occupy the shop's
// left display shelves; all variants use generated geometry/text only.
export function createShopDecor(kit,existing,monthly){
 const {group,box,cylinder,sphere,ellipsoid,tube,sign,plant,bench,material}=kit,decor=new Map();
 const add=(name,node,level=()=>{})=>{decor.set(name,{node,level});return node;};
 for(const [name,builder]of [['旧木招牌','sign'],['一盆绿萝','plant'],['暖黄的吊灯','lamp'],['靠窗的长凳','bench'],['铜铃门帘','bells']])add(name,existing[builder]);
 const signVariants=[];existing.sign.visible=false;
 for(let level=1;level<=3;level++){const p=group('SignLevel:'+level);box('SignBoard',{x:-3,y:3.18,z:-3.18,w:2.15,h:.42,d:.1,color:level===1?'#8a6b48':'#6c5035'},p);sign('SignLetters',{text:'慢慢寄 · 好好收',x:-3,y:3.18,z:-3.11,w:2,h:.27,color:level===1?'#8a6b48':'#6c5035',ink:level===1?'#f1e0ba':'#efc96c'},p);if(level===3)for(const y of [2.98,3.38])box('GoldTrim',{x:-3,y,z:-3.09,w:2.15,h:.025,d:.025,color:'#d9b661'},p);signVariants.push(p);}
 const signSet=group('SignSet');for(const node of signVariants)signSet.add(node);decor.set('旧木招牌',{node:signSet,level:l=>signVariants.forEach((n,i)=>n.visible=i+1===l)});
 const lamps=[existing.lamp];for(let i=1;i<3;i++){const p=group('ExtraPendant:'+i);cylinder('Cord',{x:.8+i*.8,y:3.1,z:.1,r:.025,h:.9,color:'#79694f'},p);cylinder('Shade',{x:.8+i*.8,y:2.65,z:.1,r:.34,h:.16,color:'#d4b26e'},p);sphere('Bulb',{x:.8+i*.8,y:2.54,z:.1,r:.12,color:'#ffe4a3'},p);lamps.push(p);}
 const lampSet=group('LampSet');lamps.forEach(n=>lampSet.add(n));decor.set('暖黄的吊灯',{node:lampSet,level:l=>lamps.forEach((n,i)=>n.visible=i<l)});
 decor.get('一盆绿萝').level=l=>existing.plant.scale.setScalar(1+(l-1)*.12);
 const cushions=[];for(let i=0;i<2;i++){const p=box('BenchCushion',SHOP_CUSHIONS[i]);existing.bench.attach(p);cushions.push(p);}decor.get('靠窗的长凳').level=l=>cushions.forEach((n,i)=>n.visible=l>i+1);
 decor.get('铜铃门帘').level=l=>existing.bells.traverse(o=>{if(o.isMesh&&o.name==='CopperBell')o.scale.setScalar(1+(l-1)*.18);});
 const cubbies=group('ExtraCubbies');box('Backing',{x:.88,y:2,z:-3.24,w:.55,h:2.2,d:.15,color:'#927452'},cubbies);for(let i=0;i<6;i++)box('Shelf',{x:.88,y:1+i*.4,z:-3.1,w:.6,h:.045,d:.35,color:'#b49569'},cubbies);const cubbyTrim=box('CubbyGoldTrim',{x:.88,y:3.13,z:-3.05,w:.64,h:.05,d:.05,color:'#d9b661'},cubbies);add('整面墙的信格',cubbies,l=>{cubbies.traverse(o=>{if(o.isMesh&&o!==cubbyTrim)o.material.color.set(l>1?'#bd9b61':'#927452');});cubbyTrim.visible=l>=3;});
 const clock=group('OldClock');box('Cabinet',{x:.9,y:1.05,z:-2.95,w:.55,h:1.95,d:.4,color:'#85694d'},clock);cylinder('ClockFace',{x:.9,y:1.65,z:-2.72,r:.22,h:.04,rotation:[Math.PI/2,0,0],color:'#ede2c2'},clock);box('ClockHand',{x:.9,y:1.72,z:-2.685,w:.025,h:.15,d:.02,color:'#66513c'},clock);add('会走的老座钟',clock,l=>clock.scale.setScalar(1+(l-1)*.025));
 const loft=group('LittleLoft');box('Mezzanine',{x:-2.15,y:3.63,z:-2.8,w:3.8,h:.14,d:1.2,color:'#ba9b73'},loft);for(let i=0;i<8;i++)box('LoftRail',{x:-3.85+i*.48,y:3.98,z:-2.2,w:.045,h:.7,d:.045,color:'#9d825e'},loft);box('LoftRailTop',{x:-2.15,y:4.3,z:-2.2,w:3.6,h:.06,d:.07,color:'#9d825e'},loft);const loftCurtain=box('LoftCurtain',{x:-.42,y:3.95,z:-2.2,w:.24,h:.58,d:.04,color:'#b88970'},loft);const loftLamp=sphere('LoftLantern',{x:-3.65,y:4,z:-2.28,r:.12,color:'#e0c278'},loft);add('二楼的小阁楼',loft,l=>{loftCurtain.visible=l>=2;loftLamp.visible=l>=3;});
 function mini(name,k,i){
  const p=group('Monthly:'+name,{x:-4.2,y:.65+Math.floor(i/6)*.72,z:-2.65+i%6*.88,heading:Math.PI/2});
  box('DisplayShelf',{y:-.05,w:.68,h:.07,d:.45,color:'#b89a6c'},p);
  const b=(n,o)=>box(n,o,p),c=(n,o)=>cylinder(n,o,p),s=(n,o)=>sphere(n,o,p),e=(n,o)=>ellipsoid(n,o,p),t=(n,o)=>tube(n,o,p);
  const label=(text,color='#e8d8b5')=>sign('PropLabel',{text,x:0,y:.2,z:.13,w:.4,h:.18,color,ink:'#725c42'},p);
  const branch=color=>{t('Branch',{points:[[-.2,0,0],[0,.25,0],[.15,.5,0]],r:.018,color:'#8a7754'});for(let n=0;n<6;n++)s('Blossom',{x:Math.sin(n*2)*.18,y:.22+n*.05,z:Math.cos(n*2)*.07,r:.055,color});};
  if(k==='窗花'){for(let j=0;j<4;j++)b('PaperCut',{y:.2,heading:j*Math.PI/4,w:.44,h:.045,d:.03,color:'#b55243'});}
  else if(k==='一碗腊八粥的香味'){c('PorridgeBowl',{y:.1,r:.2,h:.13,color:'#d4b79c'});c('Porridge',{y:.17,r:.18,h:.01,color:'#b39569'});for(let j=0;j<7;j++)s('Beans',{x:Math.sin(j*2)*.12,y:.19,z:Math.cos(j*2)*.12,r:.025,color:j%2?'#9d5e4d':'#e3c889'});}
  else if(k==='春联'){for(const x of [-.18,.18])sign('Couplet',{text:x<0?'春来':'信至',x,y:.3,w:.16,h:.55,color:'#ae4939',ink:'#e9c374'},p);}
  else if(k==='一串小灯笼'){for(const x of [-.16,.16]){c('LanternCord',{x,y:.45,r:.01,h:.25,color:'#97764b'});e('Lantern',{x,y:.25,w:.23,h:.32,d:.23,color:'#c65e41'});}}
  else if(k==='一枝早樱')branch('#e9b6b0');
  else if(k==='风筝挂饰'){const shape=new T.Shape();shape.moveTo(0,.5);shape.lineTo(.2,.25);shape.lineTo(0,0);shape.lineTo(-.2,.25);shape.closePath();kit.profile('Kite',{shape,depth:.015,color:'#9bb6ac'},p);t('KiteTail',{points:[[0,0,0],[.07,-.1,0],[-.03,-.2,0]],r:.012,color:'#b87b62'});}
  else if(k==='雨伞架'){c('UmbrellaStand',{y:.08,r:.15,h:.16,color:'#b08a65'});for(const x of [-.06,.06]){c('UmbrellaHandle',{x,y:.3,r:.017,h:.45,color:'#746b55'});e('FoldedUmbrella',{x,y:.31,w:.09,h:.32,d:.12,color:x<0?'#8ba89d':'#a07872'});}}
  else if(k==='一盆铃兰'){c('LilyPot',{y:.06,r:.13,h:.13,color:'#c8b18c'});for(let j=0;j<3;j++){t('LilyStem',{points:[[0,.1,0],[j*.04,.35,0],[j*.04+.07,.4,0]],r:.012,color:'#7b996c'});s('LilyBell',{x:j*.04+.07,y:.36,z:0,r:.05,color:'#ede9d5'});}}
  else if(k==='新茶的茶罐'){c('TeaTin',{y:.17,r:.17,h:.32,color:'#8b9b73'});c('TinLid',{y:.34,r:.185,h:.035,color:'#bca674'});label('新茶');}
  else if(k==='竹帘'){for(let j=0;j<9;j++)b('BambooStrip',{y:.06+j*.045,w:.47,h:.025,d:.04,color:j%2?'#a79c6e':'#b8ab78'});}
  else if(k==='驱蚊香包'){e('HerbalPouch',{y:.18,w:.29,h:.34,d:.2,color:'#8c9e79'});t('PouchString',{points:[[-.06,.36,0],[0,.5,0],[.06,.36,0]],r:.014,color:'#b49563'});}
  else if(k==='玻璃风铃'){e('GlassBell',{y:.3,w:.25,h:.25,d:.25,color:'#b8d6cf'});c('ChimeString',{y:.16,r:.008,h:.25,color:'#907d62'});b('WindPaper',{y:.02,w:.1,h:.15,d:.01,color:'#e2c99d'});}
  else if(k==='西瓜冰柜'){b('Cooler',{y:.16,w:.52,h:.3,d:.34,color:'#e5e1c6'});b('CoolerLid',{y:.32,w:.54,h:.04,d:.36,color:'#91b5a5'});s('Watermelon',{y:.39,r:.11,color:'#6c9164'});}
  else if(k==='一把蒲扇'){e('FanLeaf',{y:.27,w:.42,h:.36,d:.025,color:'#c7b886'});c('FanHandle',{y:.05,r:.016,h:.22,color:'#9f8e63'});}
  else if(k==='萤火虫灯'){c('FireflyJar',{y:.18,r:.16,h:.34,color:'#9bb7a2'});for(let j=0;j<5;j++)s('Firefly',{x:Math.sin(j)*.1,y:.1+j*.045,z:.14,r:.019,color:'#f2df90'});}
  else if(k==='星空窗贴'){for(let j=0;j<7;j++)s('StarSticker',{x:Math.sin(j*2)*.22,y:.22+Math.cos(j*2)*.17,z:0,r:j%2?.025:.04,color:'#dfc77c'});}
  else if(k==='一盒月饼'){b('MooncakeBox',{y:.06,w:.51,h:.1,d:.3,color:'#ab735b'});for(const x of [-.13,.13]){c('Mooncake',{x,y:.16,r:.1,h:.1,color:'#c79a5b'});sign('MoonMark',{text:'月',x,y:.17,z:.1,w:.12,h:.09,color:'#c79a5b'},p);}}
  else if(k==='桂花枝')branch('#e3bd62');
  else if(k==='南瓜灯'){for(let j=0;j<8;j++)e('PumpkinRib',{x:Math.sin(j*Math.PI/4)*.07,y:.2,z:Math.cos(j*Math.PI/4)*.07,w:.27,h:.32,d:.27,color:j%2?'#d78c43':'#c77b36'});c('PumpkinStem',{y:.39,r:.025,h:.12,color:'#71845a'});for(const x of [-.07,.07])b('PumpkinEye',{x,y:.24,z:.195,w:.045,h:.055,d:.01,color:'#f4d383'});b('PumpkinSmile',{y:.13,z:.2,w:.13,h:.025,d:.01,color:'#f4d383'});}
  else if(k==='一叠落叶书签'){for(let j=0;j<5;j++){const leaf=e('LeafBookmark',{x:(j-2)*.055,y:.06+j*.012,w:.09,h:.025,d:.32,color:j%2?'#b58a4f':'#a96949'});leaf.rotation.y=j*.2;}}
  else if(k==='围巾挂钩'){t('ScarfHook',{points:[[0,.46,0],[0,.56,.05],[.06,.56,.08]],r:.02,color:'#a78d5e'});b('Scarf',{x:-.04,y:.27,w:.12,h:.45,d:.055,color:'#b87663'});b('ScarfEnd',{x:.06,y:.18,w:.1,h:.27,d:.05,color:'#b87663'});}
  else if(k==='热可可的小炉'){c('Stove',{y:.1,r:.2,h:.18,color:'#766750'});c('CocoaPot',{y:.28,r:.15,h:.19,color:'#9c6d51'});c('Cocoa',{y:.38,r:.13,h:.01,color:'#79543e'});t('Steam',{points:[[0,.4,0],[.035,.49,0],[0,.57,0]],r:.01,color:'#ddd3b7'});}
  else if(k==='小圣诞树'){for(let j=0;j<3;j++){const mesh=new T.Mesh(new T.ConeGeometry(.22-j*.05,.27,12),material('#6c9475'));mesh.position.y=.16+j*.14;p.add(mesh);}for(let j=0;j<5;j++)s('TreeOrnament',{x:Math.sin(j*2)*.13,y:.17+j*.06,z:Math.cos(j*2)*.13,r:.03,color:j%2?'#d6b76c':'#b56a52'});}
  else if(k==='一墙贺卡'){for(let j=0;j<4;j++)sign('GreetingCard',{text:['冬','安','信','好'][j],x:(j%2-.5)*.23,y:.16+Math.floor(j/2)*.22,z:0,w:.18,h:.2,color:j%2?'#ddbaa2':'#a7ba9c'},p);}
  const trim=b('RenovatedStand',{y:-.015,w:.66,h:.035,d:.44,color:'#d3b66d'}),ribbon=b('DisplayRibbon',{y:.02,z:.21,w:.16,h:.035,d:.03,color:'#af7461'});add(name,p,l=>{p.scale.setScalar(1+(l-1)*.1);trim.visible=l>=2;ribbon.visible=l>=3;});return p;
 }
 Object.values(monthly).flat().forEach((x,i)=>mini(x[0],x[0],i));
 const ghosts=new Map();
 for(const [name,entry]of decor){entry.node.updateWorldMatrix(true,true);const bounds=new T.Box3().setFromObject(entry.node),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());const shape=new T.BoxGeometry(Math.max(.3,size.x),Math.max(.3,size.y),Math.max(.2,size.z)),edges=new T.EdgesGeometry(shape),ghost=new T.LineSegments(edges,new T.LineDashedMaterial({color:'#9caa93',dashSize:.08,gapSize:.055,transparent:true,opacity:.45}));shape.dispose();ghost.computeLineDistances();ghost.position.copy(center);ghost.name='Buy:'+name;kit.root.add(ghost);ghosts.set(name,ghost);}
 function sync(next){const owned=new Map(next.decor.map(d=>[d.name,d]));for(const [name,e]of decor){const d=owned.get(name);e.node.visible=!!d;if(d)e.level(d.level);ghosts.get(name).visible=!d&&next.availableDecor.some(a=>a.name===name);}}
 function hit(ray){for(const [name,e]of decor){const node=e.node.visible?e.node:ghosts.get(name);if(node.visible&&(e.node.visible?ray.intersectObject(node,true).length:ray.ray.intersectsBox(new T.Box3().setFromObject(node))))return name;}return null;}
 return {sync,hit,lamps,entries:decor,ghosts};
}
