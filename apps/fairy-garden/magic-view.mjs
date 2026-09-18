import * as T from 'three';
import {seasonOf,MAPS} from './world.mjs?v=fg-4f326597fd151343';
export function makeMagicView(){
 const seed=new T.Group(),bed=new T.Group(),lamps=new T.Group();const seedSite=MAPS.forest.interactions.find(x=>x.kind==='seed'),bedSite=MAPS.garden.interactions.find(x=>x.kind==='star');seed.position.set(seedSite.x,.1,seedSite.z);bed.position.set(bedSite.x,.1,bedSite.z);
 const mat=(color,glow=false)=>new T.MeshStandardMaterial({color,roughness:.9,emissive:glow?color:'#000000',emissiveIntensity:glow?.45:0});
 const soil=mat('#8a7960'),leaf=mat('#73977e'),gold=mat('#d6c58a'),petal=mat('#d6c8f0',true);
 const add=(parent,geo,material,x,y,z)=>{const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 add(seed,new T.TorusGeometry(.32,.025,6,24),gold,0,.03,0).rotation.x=Math.PI/2;
 const pearl=add(seed,new T.IcosahedronGeometry(.13,2),petal,0,.32,0);
 add(bed,new T.CylinderGeometry(.33,.4,.16,14),soil,0,0,0);const plant=new T.Group();bed.add(plant);
 add(plant,new T.CylinderGeometry(.025,.03,.55,8),leaf,0,.3,0);
 for(const sign of [-1,1]){const l=add(plant,new T.SphereGeometry(.12,10,7),leaf,sign*.1,.25,0);l.scale.set(1,.3,1.7);l.rotation.z=sign*.6;}
 const flower=new T.Group();plant.add(flower);flower.position.y=.6;
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const p=add(flower,new T.SphereGeometry(.1,10,7),petal,Math.cos(a)*.1,0,Math.sin(a)*.1);p.scale.y=.6;}
 add(flower,new T.SphereGeometry(.045,8,6),gold,0,.03,0);
 const lights=[];for(const spot of MAPS.garden.decor.lamps){const lamp=new T.Group();lamp.position.set(spot.x,.08,spot.z);lamps.add(lamp);add(lamp,new T.CylinderGeometry(.04,.05,.8,8),gold,0,.4,0);const bulb=add(lamp,new T.IcosahedronGeometry(.14,2),petal,0,.86,0);add(lamp,new T.ConeGeometry(.23,.15,8),gold,0,1.04,0);const light=new T.PointLight('#e5d4ff',0,2.3,2);light.position.y=.9;lamp.add(light);lights.push({lamp,light,bulb});}
 return {seed,bed,lamps,update(s,time){const m=s.magic,season=seasonOf(s.day),night=s.minute>=season.dusk;seed.visible=s.map==='forest'&&m.seedSeason!==season.index;pearl.position.y=.32+Math.sin(time*1.8)*.06;pearl.rotation.y=time*.6;bed.visible=s.map==='garden';plant.visible=m.planted;plant.scale.setScalar(.55+m.growth*.23);flower.visible=m.growth>=2;lamps.visible=s.map==='garden';lights.forEach(({lamp,light,bulb},i)=>{lamp.visible=i<m.lamps;light.intensity=night?1.3:0;bulb.scale.setScalar(night?1+Math.sin(time*2+i)*.06:.85);});petal.emissiveIntensity=night?1.2:.4;}};
}
