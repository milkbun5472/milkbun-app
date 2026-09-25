import * as T from 'three';
import {MAPS,MARKET_GOODS,MARKET_RARE,FOODS,marketStock,marketOpen,marketError,nightStock,nightMarketOpen,foodError,stallOf,vendorAt,vendorSpot} from './world.mjs?v=fg-7eaaa9dfa3dee45b';
import {createTraveler} from './traveler.mjs?v=fg-7eaaa9dfa3dee45b';
// 集市做成场景（她 2026-09-18：「不然一直点点点好单调」）：货真摆在摊面上，摊主站在摊后，
// 点货物就走过去买。⚠️货和价仍旧只在 world.MARKET_GOODS／FOODS 一处；这儿只负责摆出来、被点到、飞进背包。
// ⚠️摊位几何来自 rules 的 garden.market.stalls（codex 盖的那四座），不另抄一份坐标。
// 夜市（她 2026-09-18：「做夜市，卖的跟吃的有关」）：同一排摊子，天黑后换上吃的和做法，摊顶挂一串灯；
//   摊后站的是村里的邻居（谁站哪座在 world.vendorAt），有邻居那座白天的摊主就退到一边。
export function makeMarketView(){
 const root=new T.Group();root.name='MarketGoods';root.visible=false;
 const stalls=Object.fromEntries(MAPS.garden.market.stalls.map(s=>[s.kind,s]));
 const mat=(color,glow=0)=>new T.MeshStandardMaterial({color,roughness:.8,emissive:color,emissiveIntensity:glow});
 const goods={},flying=[];
 // 摊面前沿那一点：她走到这儿买（heading 是摊子朝向，前沿在朝向那一侧）
 const front=s=>({x:s.x+Math.sin(s.heading)*(s.d/2+.7),z:s.z+Math.cos(s.heading)*(s.d/2+.7)});
 const dayIds=[...Object.keys(MARKET_GOODS),...Object.keys(MARKET_RARE)],nightIds=[...Object.keys(FOODS),...Object.keys(FOODS).filter(id=>FOODS[id].cook).map(id=>'recipe:'+id)];
 const shapeOf=id=>id.startsWith('recipe:')?new T.BoxGeometry(.14,.05,.2):FOODS[id]?(['tea','summer','winter','wine'].includes(id)?new T.CylinderGeometry(.07,.05,.1,12):['soup','dumpling'].includes(id)?new T.CylinderGeometry(.11,.08,.07,14):id==='skewer'?new T.CylinderGeometry(.012,.012,.3,6):new T.BoxGeometry(.16,.07,.12)):id==='seed'?new T.IcosahedronGeometry(.1,2):id==='whole'?new T.OctahedronGeometry(.12):id==='dew'?new T.SphereGeometry(.11,10,8):id==='sand'?new T.IcosahedronGeometry(.11,0):id==='flower'?new T.SphereGeometry(.1,10,7):id==='mushroom'?new T.ConeGeometry(.11,.16,10):new T.BoxGeometry(.2,.09,.14);
 const colorOf=id=>id.startsWith('recipe:')?'#f3e6c2':FOODS[id]?({tea:'#c9a45a',roast:'#cfe6a4',candy:'#dff0ee',cake:'#e9dcb0',dumpling:'#f4efe4',soup:'#e0b98a',wine:'#f2d9c4',skewer:'#e5c3d8',spring:'#e6d3a0',summer:'#bfe8ea',autumn:'#e9c48c',winter:'#f1e2c2'})[id]:id==='seed'?'#c2a2ee':id==='whole'?'#f2e6b8':id==='dew'?'#bfe8ea':id==='sand'?'#e9d7a6':id==='flower'?'#d6c8f0':id==='mushroom'?'#cfe6a4':'#9fb783';
 // 白天的货一排、夜里的吃的一排：同一座摊上两排各自等距摆，同一时刻只有一排看得见
 for(const ids of [dayIds,nightIds]){const byStall={};for(const id of ids){const k=stallOf(id);if(k)(byStall[k]=byStall[k]||[]).push(id);}
  for(const [kind,list] of Object.entries(byStall)){const s=stalls[kind];if(!s)continue;list.forEach((id,i)=>{const g=new T.Group();const along=(i-(list.length-1)/2)*Math.min(.55,(s.w-.4)/Math.max(1,list.length));const dx=Math.cos(s.heading)*along,dz=-Math.sin(s.heading)*along;g.position.set(s.x+dx,.92,s.z+dz);
   const m=new T.Mesh(shapeOf(id),mat(colorOf(id),.18));m.castShadow=true;if(id==='skewer')m.rotation.z=.5;g.add(m);
   const tag=new T.Mesh(new T.BoxGeometry(.16,.09,.01),mat('#f3edd8'));tag.position.set(0,-.14,.12);g.add(tag);
   g.userData.good=id;root.add(g);goods[id]={group:g,mesh:m,home:g.position.clone(),stall:s,night:ids===nightIds};});}}
 // 夜市的灯串：每座摊顶一串五盏，只在夜市开着的时候亮
 const lanterns=new T.Group();lanterns.name='NightLanterns';root.add(lanterns);
 for(const s of Object.values(stalls)){for(let i=0;i<5;i++){const along=(i-2)*(s.w/5);const l=new T.Mesh(new T.SphereGeometry(.07,8,6),new T.MeshStandardMaterial({color:'#ffd98a',emissive:'#ffb85a',emissiveIntensity:1.2,roughness:.6}));l.position.set(s.x+Math.cos(s.heading)*along,2.05+Math.sin(i*1.7)*.05,s.z-Math.sin(s.heading)*along);lanterns.add(l);}}
 const keepers=[];let dollReady=false;
 return {root,goods,front,
  // 摊主：布偶来了才立（doll.glb 是异步的）。两位就够，北边那一排一人一座
  setDoll(source){if(dollReady||!source)return;dollReady=true;for(const kind of ['herbs','curios']){const s=stalls[kind];if(!s)continue;const avatar=createTraveler(source,true,{hair:kind==='herbs'?'bun':'pixie',cloth:kind==='herbs'?'#8a9a6a':'#7f6d8f'});avatar.root.name='Keeper:'+kind;const spot=vendorSpot(kind);avatar.root.position.set(spot.x,.08,spot.z);avatar.root.rotation.y=spot.heading;root.add(avatar.root);keepers.push({avatar,s,kind});}},
  pick(ray){if(!root.visible)return null;const hits=ray.intersectObjects(Object.values(goods).filter(x=>x.group.visible).map(x=>x.group),true);let o=hits[0]?.object;while(o&&!o.userData.good)o=o.parent;return o?o.userData.good:null;},
  stallFront(id){const g=goods[id];return g?front(g.stall):null;},
  fly(id,to){const g=goods[id];if(!g)return;flying.push({id,t:0,from:g.group.position.clone(),to:new T.Vector3(to.x,to.y||.8,to.z)});},
  update(s,time,dt=0){const night=nightMarketOpen(s);root.visible=s.map==='garden'&&(marketOpen(s)||night);if(!root.visible)return;
   const stock=night?nightStock(s):marketStock(s);lanterns.visible=night;
   for(const [id,g] of Object.entries(goods)){g.group.visible=g.night===night&&stock.includes(id);if(!g.group.visible)continue;const err=(night?foodError:marketError)({...s,position:g.stall,map:'garden'},id);const can=!err||/先走到/.test(err);g.mesh.material.emissiveIntensity=can?.18+Math.sin(time*2)*.08:.02;g.mesh.material.opacity=1;g.group.rotation.y=time*.5;g.group.position.y=g.home.y+Math.sin(time*1.6+id.length)*.02;}
   if(night)lanterns.children.forEach((l,i)=>{l.material.emissiveIntensity=1+Math.sin(time*3+i)*.25;});
   for(let i=flying.length-1;i>=0;i--){const f=flying[i];f.t+=dt/.7;const g=goods[f.id];if(f.t>=1){g.group.position.copy(g.home);flying.splice(i,1);continue;}const e=f.t*f.t*(3-2*f.t);g.group.position.lerpVectors(f.from,f.to,e);g.group.position.y+=Math.sin(f.t*Math.PI)*.5;}
   // 夜市上那座摊有邻居站着，白天的摊主就不站了
   keepers.forEach(({avatar,kind})=>{avatar.root.visible=!(night&&vendorAt(s,kind));if(avatar.root.visible)avatar.animate(time,{moving:false,gesture:'rest',height:.08});});}
 };
}
