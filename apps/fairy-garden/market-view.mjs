import * as T from 'three';
import {MAPS,MARKET_GOODS,marketOpen,marketError} from './world.mjs?v=fg-889d70de4a4db0b3';
import {createTraveler} from './traveler.mjs?v=fg-889d70de4a4db0b3';
// 集市做成场景（她 2026-09-18：「不然一直点点点好单调」）：货真摆在摊面上，摊主站在摊后，
// 点货物就走过去买。⚠️货和价仍旧只在 world.MARKET_GOODS 一处；这儿只负责摆出来、被点到、飞进背包。
// ⚠️摊位几何来自 rules 的 garden.market.stalls（codex 盖的那四座），不另抄一份坐标。
const STALL_OF={herb:'herbs',mushroom:'herbs',flower:'flowers',dew:'tea',sand:'curios'};
export function makeMarketView(){
 const root=new T.Group();root.name='MarketGoods';root.visible=false;
 const stalls=Object.fromEntries(MAPS.garden.market.stalls.map(s=>[s.kind,s]));
 const mat=(color,glow=0)=>new T.MeshStandardMaterial({color,roughness:.8,emissive:color,emissiveIntensity:glow});
 const goods={},flying=[];
 // 摊面前沿那一点：她走到这儿买（heading 是摊子朝向，前沿在朝向那一侧）
 const front=s=>({x:s.x+Math.sin(s.heading)*(s.d/2+.7),z:s.z+Math.cos(s.heading)*(s.d/2+.7)});
 const byStall={};for(const [id,g] of Object.entries(MARKET_GOODS)){(byStall[STALL_OF[id]]=byStall[STALL_OF[id]]||[]).push(id);}
 for(const [kind,ids] of Object.entries(byStall)){const s=stalls[kind];if(!s)continue;ids.forEach((id,i)=>{const g=new T.Group();const along=(i-(ids.length-1)/2)*.55;const dx=Math.cos(s.heading)*along,dz=-Math.sin(s.heading)*along;g.position.set(s.x+dx,.92,s.z+dz);
  const shape=id==='dew'?new T.SphereGeometry(.11,10,8):id==='sand'?new T.IcosahedronGeometry(.11,0):id==='flower'?new T.SphereGeometry(.1,10,7):id==='mushroom'?new T.ConeGeometry(.11,.16,10):new T.BoxGeometry(.2,.09,.14);
  const color=id==='dew'?'#bfe8ea':id==='sand'?'#e9d7a6':id==='flower'?'#d6c8f0':id==='mushroom'?'#cfe6a4':'#9fb783';
  const m=new T.Mesh(shape,mat(color,.18));m.castShadow=true;g.add(m);
  const tag=new T.Mesh(new T.BoxGeometry(.16,.09,.01),mat('#f3edd8'));tag.position.set(0,-.14,.12);g.add(tag);
  g.userData.good=id;root.add(g);goods[id]={group:g,mesh:m,home:g.position.clone(),stall:s};});}
 const keepers=[];let dollReady=false;
 return {root,goods,front,
  // 摊主：布偶来了才立（doll.glb 是异步的）。两位就够，北边那一排一人一座
  setDoll(source){if(dollReady||!source)return;dollReady=true;for(const kind of ['herbs','curios']){const s=stalls[kind];if(!s)continue;const avatar=createTraveler(source,true,{hair:kind==='herbs'?'bun':'pixie',cloth:kind==='herbs'?'#8a9a6a':'#7f6d8f'});avatar.root.name='Keeper:'+kind;avatar.root.position.set(s.x-Math.sin(s.heading)*(s.d/2+.55),.08,s.z-Math.cos(s.heading)*(s.d/2+.55));avatar.root.rotation.y=s.heading+Math.PI;root.add(avatar.root);keepers.push({avatar,s});}},
  pick(ray){if(!root.visible)return null;const hits=ray.intersectObjects(Object.values(goods).map(x=>x.group),true);let o=hits[0]?.object;while(o&&!o.userData.good)o=o.parent;return o?o.userData.good:null;},
  stallFront(id){const g=goods[id];return g?front(g.stall):null;},
  fly(id,to){const g=goods[id];if(!g)return;flying.push({id,t:0,from:g.group.position.clone(),to:new T.Vector3(to.x,to.y||.8,to.z)});},
  update(s,time,dt=0){root.visible=s.map==='garden'&&marketOpen(s);if(!root.visible)return;
   for(const [id,g] of Object.entries(goods)){const err=marketError({...s,position:g.stall,map:'garden'},id);const can=!err||/先走到/.test(err);g.mesh.material.emissiveIntensity=can?.18+Math.sin(time*2)*.08:.02;g.mesh.material.opacity=1;g.group.rotation.y=time*.5;g.group.position.y=g.home.y+Math.sin(time*1.6+id.length)*.02;}
   for(let i=flying.length-1;i>=0;i--){const f=flying[i];f.t+=dt/.7;const g=goods[f.id];if(f.t>=1){g.group.position.copy(g.home);flying.splice(i,1);continue;}const e=f.t*f.t*(3-2*f.t);g.group.position.lerpVectors(f.from,f.to,e);g.group.position.y+=Math.sin(f.t*Math.PI)*.5;}
   keepers.forEach(({avatar},i)=>avatar.animate(time,{moving:false,gesture:'rest',height:.08}));}
 };
}
