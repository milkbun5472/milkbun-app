import * as T from 'three';
import {MAPS,spotParse} from './world.mjs?v=fg-d827b61930e4de0b';
import {makeCurio} from './curio-view.mjs?v=fg-d827b61930e4de0b';
export function makeDreamFlower(){
 const root=new T.Group(),plant=new T.Group(),flower=new T.Group();root.add(plant);plant.add(flower);flower.position.y=.57;
 const green=new T.MeshStandardMaterial({color:'#729b8d',roughness:.8}),purple=new T.MeshStandardMaterial({color:'#bfa5df',roughness:.7,emissive:'#a688d0',emissiveIntensity:.3}),gold=new T.MeshStandardMaterial({color:'#e9d5a6',roughness:.8});
 const add=(g,geo,m,x,y,z)=>{const o=new T.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o;};
 add(plant,new T.CylinderGeometry(.024,.035,.55,8),green,0,.28,0);
 for(const k of [-1,1]){const leaf=add(plant,new T.SphereGeometry(.12,12,8),green,k*.09,.22,0);leaf.scale.set(1.3,.25,.65);leaf.rotation.z=k*.55;}
 for(let i=0;i<6;i++){const a=i*Math.PI/3,p=add(flower,new T.SphereGeometry(.14,12,8),purple,Math.cos(a)*.14,0,Math.sin(a)*.14);p.scale.set(1,.5,1.4);p.rotation.y=-a;}
 add(flower,new T.SphereGeometry(.085,12,8),gold,0,.02,0);
 root.userData.plant=plant;root.userData.flower=flower;return root;
}
// 灯会那晚放进月潭又捞回来的那一盏（v70.81）
export function makeLantern(){
 const g=new T.Group(),cork=new T.MeshStandardMaterial({color:'#b89661',roughness:.8}),mat=new T.MeshStandardMaterial({color:'#f6d58d',emissive:'#efb855',emissiveIntensity:.55,roughness:.8});
 const base=new T.Mesh(new T.CylinderGeometry(.16,.19,.05,8),cork);base.castShadow=true;g.add(base);
 const shade=new T.Mesh(new T.CylinderGeometry(.11,.13,.22,8,1,true),mat);shade.position.y=.13;g.add(shade);
 const flame=new T.Mesh(new T.SphereGeometry(.035,8,6),new T.MeshBasicMaterial({color:'#fff5c7'}));flame.scale.y=1.6;flame.position.y=.15;g.add(flame);
 g.name='FestivalLantern';return g;
}
// ⚠️她 2026-09-18 问：「很多家具都说可以在上面摆东西，是真的有模型摆上去吗」。
//   原来只有梦花／修好的旧物／灯笼这三样有模型，别的摆上去【只有那一句文字】，
//   场上什么都看不见——说了能摆却看不见，那句话就是空的。
//   现在按它出自井里的哪一类给一个小物件（回声石→螺、梦屑→种、感官晶→丝、旧物→残件），
//   每一样摆上去都真的在那儿。
const KIND_FORM={echo:'shell',dream:'seed',sense:'thread',relic:'relic'};
export function makeTravelFrame(t){const g=new T.Group(),wood=new T.MeshStandardMaterial({color:'#836240',roughness:.8}),image=new T.TextureLoader().load(t.image);image.colorSpace=T.SRGBColorSpace;const back=new T.Mesh(new T.BoxGeometry(.9,.64,.055),wood);back.position.y=.34;g.add(back);const face=new T.Mesh(new T.PlaneGeometry(.82,.55),new T.MeshBasicMaterial({map:image,toneMapped:false}));face.position.set(0,.34,.031);g.add(face);const foot=new T.Mesh(new T.BoxGeometry(.5,.03,.28),wood);foot.position.set(0,.025,-.05);g.add(foot);g.name='TravelFrame';return g;}
export function disposeKeepsake(model){model.traverse(o=>{o.geometry?.dispose();const rows=Array.isArray(o.material)?o.material:[o.material];for(const m of rows){m?.map?.dispose();m?.dispose();}});}
export const isKeepsake=t=>!!t&&(['dreamflower','repairedrelic','festivallantern','travelframe'].includes(t.recipe)||!!KIND_FORM[t.kind]);
export const makeKeepsake=t=>t.recipe==='travelframe'?makeTravelFrame(t):t.recipe==='repairedrelic'?makeCurio('restored'):t.recipe==='festivallantern'?makeLantern()
 :t.recipe==='dreamflower'?makeDreamFlower():makeCurio(KIND_FORM[t.kind]||'relic');
export function makePlacedKeepsakes(scene,getViews){const placed=new Map();let lastThings=null;return {update(s,time){
 if(lastThings!==s.things){lastThings=s.things;for(const [id,p]of placed)if(!s.things.some(t=>t.id===id&&t.spot===p.spot)){scene.remove(p.model);disposeKeepsake(p.model);placed.delete(id);}for(const t of s.things.filter(t=>isKeepsake(t)&&t.spot)){if(placed.has(t.id))continue;const parsed=spotParse(t.spot),legacy={sill:MAPS.garden.stations.rest,eaves:MAPS.garden.stations.rest,pond:MAPS.garden.seats.pond},piece=parsed?.piece||legacy[t.spot];if(!piece)continue;const model=makeKeepsake(t);model.scale.setScalar(.7);model.position.set(piece.x,(piece.h||piece.height||.7)+.14,piece.z);scene.add(model);placed.set(t.id,{model,map:parsed?.map||'garden',spot:t.spot});}}
 for(const p of placed.values()){p.model.visible=s.map===p.map;p.model.rotation.z=Math.sin(time)*.025;if(p.model.visible&&p.view!==getViews()[p.map]){p.view=getViews()[p.map];if(p.view){p.view.root.updateMatrixWorld(true);const ray=new T.Raycaster(new T.Vector3(p.model.position.x,8,p.model.position.z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(p.view.root,true).find(h=>h.point.y<3);if(hit)p.model.position.y=hit.point.y+.025;}}}
},inspect(){return [...placed.values()].map(p=>({visible:p.model.visible,x:p.model.position.x,y:p.model.position.y,z:p.model.position.z}));}};}
