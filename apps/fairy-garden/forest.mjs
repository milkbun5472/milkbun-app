import * as T from 'three';
import {TREES,NODES} from './world.mjs?v=fg-33d5ee5f40e66e30';
// Reusable geometry and hand-painted pigment textures; no generated-image requests.
export function makeForest(){
 const root=new T.Group(),nodes=new Map(),glows=[],mats=new Map();let seed=71;
 const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function mat(color){if(mats.has(color))return mats.get(color);const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=color;c.fillRect(0,0,128,128);for(let i=0;i<750;i++){c.fillStyle=rnd()>.5?'rgba(255,248,210,.055)':'rgba(22,55,49,.045)';c.beginPath();c.ellipse(rnd()*128,rnd()*128,2+rnd()*10,1+rnd()*3,rnd(),0,Math.PI*2);c.fill();}const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;const m=new T.MeshStandardMaterial({map:tex,color:'#bbc6b0',roughness:1});if(['#759369','#658d70','#91a477','#9aaf70'].includes(color))m.userData.seasonRole='leaf';mats.set(color,m);return m;}
 function mesh(geo,color,x,y,z,sx=1,sy=1,sz=1,parent=root){const m=new T.Mesh(geo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const sphere=new T.IcosahedronGeometry(1,2),cyl=new T.CylinderGeometry(1,1,1,12),cone=new T.ConeGeometry(1,1,10);
 // Ground and distant woodland are shared with the garden in surroundings.mjs.
 // Still water encircled with irregular mossy stones.
 const water=mesh(cyl,'#739f9d',-.7,.10,-1.1,1.24,.025,1.24);water.material=water.material.clone();water.material.metalness=.12;water.material.roughness=.4;
 for(let i=0;i<20;i++){const a=i*Math.PI/10;mesh(sphere,i%3?'#a8b396':'#7e9675',-.7+Math.cos(a)*1.29,.13,-1.1+Math.sin(a)*1.29,.23,.14,.18);}
 for(let i=0;i<5;i++){const a=i*2.4;mesh(cyl,'#9aaf70',-.7+Math.cos(a)*.7,.13,-1.1+Math.sin(a)*.7,.16,.02,.15);}
 for(const [i,[x,z]]of TREES.entries()){
  const h=1.9+(i%3)*.25;mesh(cyl,'#766345',x,h/2,z,.19,h,.2);
  for(let j=0;j<3;j++){const a=j*2.1;const foliage=mesh(sphere,['#759369','#658d70','#91a477'][i%3],x+Math.cos(a)*.38,h+.15+j*.28,z+Math.sin(a)*.38,.85,.9,.85);foliage.rotation.y=i+j;}
  for(let j=0;j<3;j++){const a=j*2.1;const r=mesh(sphere,'#877553',x+Math.cos(a)*.2,.13,z+Math.sin(a)*.2,.36,.09,.10);r.rotation.y=-a;}
 }
 // Footpath from the gate to the clearing.
 for(let i=0;i<10;i++){const t=i/9;const p=mesh(sphere,'#c4c2a0',-2.7+t*4.1,.09,3.05-Math.sin(t*Math.PI)*1.1,.29,.055,.2);p.rotation.y=t*7;}
 // Ancient portal with a hanging moon, marking the return path.
 for(const x of [-3.65,-2.55])mesh(cyl,'#b2b89c',x,.72,2.55,.18,1.35,.19);
 const arch=mesh(new T.TorusGeometry(.55,.16,7,18,Math.PI),'#a6b298',-3.1,1.39,2.55);arch.rotation.z=0;
 const moon=mesh(new T.TorusGeometry(.17,.045,6,16,Math.PI*1.55),'#eadca4',-3.1,1.55,2.54);moon.rotation.z=.8;
 for(const n of NODES.filter(n=>n.map==='forest')){const g=new T.Group();g.position.set(n.x,.1,n.z);g.userData.nodeId=n.id;root.add(g);const plant=new T.Group();g.add(plant);nodes.set(n.id,{g,plant});
  mesh(sphere,'#77946a',0,0,0,.38,.08,.28,g);
  if(n.kind==='herb'){
   for(let j=0;j<6;j++){const a=j*Math.PI/3;const leaf=mesh(sphere,'#a1c0a0',Math.cos(a)*.15,.2,Math.sin(a)*.15,.065,.26,.095,plant);leaf.rotation.z=Math.sin(a)*.5;leaf.rotation.x=Math.cos(a)*.5;}
   for(let j=0;j<3;j++){const x=(j-1)*.14;mesh(cyl,'#86a986',x,.3,0,.02,.48,.02,plant);const flower=mesh(sphere,'#e4d8b4',x,.58,0,.09,.095,.09,plant);glows.push(flower);}
  }else{
   for(let j=0;j<3;j++){const x=(j-1)*.2,z=j%2*.15;mesh(cyl,'#d6c9c6',x,.19,z,.045,.32,.045,plant);const cap=mesh(new T.SphereGeometry(1,12,8,0,Math.PI*2,0,Math.PI/2),'#a5b4d3',x,.34,z,.2,.17,.2,plant);cap.material=cap.material.clone();cap.material.emissive.set('#718ea8');cap.material.emissiveIntensity=.2;}
  }
 }
 // Ground details stay clear of the central walkable path.
 for(let i=0;i<36;i++){const a=rnd()*Math.PI*2,r=3.9+rnd()*1.2,x=Math.cos(a)*r,z=Math.sin(a)*r;mesh(sphere,i%3?'#97a978':'#bdbe9a',x,.13,z,.1+rnd()*.17,.09,.12);}
 const fireflies=new T.Group();root.add(fireflies);const dotGeo=new T.SphereGeometry(.026,5,4),dotMat=new T.MeshBasicMaterial({color:'#f7e6a4'});
 for(let i=0;i<28;i++){const m=new T.Mesh(dotGeo,dotMat);m.userData={x:(rnd()-.5)*7,z:(rnd()-.5)*7,y:.3+rnd()*1.2,phase:rnd()*6.28};fireflies.add(m);}
 return {root,pick(ray){const hit=ray.intersectObjects(root.children,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});let o=hit?.object;while(o&&!o.userData.nodeId)o=o.parent;return o?.userData.nodeId;},update(s,time){for(const [id,n]of nodes){n.plant.visible=!s.picked.includes(id);n.plant.rotation.z=Math.sin(time*1.4+n.g.position.x)*.035;}fireflies.children.forEach(m=>{const p=m.userData;m.position.set(p.x+Math.sin(time*.4+p.phase)*.2,p.y+Math.sin(time+p.phase)*.1,p.z+Math.cos(time*.35+p.phase)*.2);m.scale.setScalar(.65+Math.sin(time*2+p.phase)*.3);});}};
}
