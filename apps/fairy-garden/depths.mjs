import * as T from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js?v=fg-33d5ee5f40e66e30';
import {NODES} from './world.mjs?v=fg-33d5ee5f40e66e30';

// A cutaway of the old well: masonry, roots and a little lamplight, not a ring of pillars.
// All decoration stays outside the walking disc; node IDs and positions come from the rules.
export function makeDepths(){
 const root=new T.Group(),layers=new Map(),mats=new Map(),batches=new Map();let seed=913;
 root.name='星井 · 苔光石室';root.userData.seasonTint=false;
 const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function mat(color,glow){const key=color+(glow||'');if(mats.has(key))return mats.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  c.fillStyle=color;c.fillRect(0,0,128,128);
  for(let i=0;i<480;i++){c.fillStyle=rnd()>.5?'rgba(247,237,210,.045)':'rgba(11,28,32,.055)';c.beginPath();c.ellipse(rnd()*128,rnd()*128,3+rnd()*12,1+rnd()*4,rnd()*3,0,Math.PI*2);c.fill();}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const m=new T.MeshStandardMaterial({map:tex,roughness:.91,...(glow?{emissive:glow,emissiveIntensity:.65}:{})});mats.set(key,m);return m;
 }
 const rock=new T.IcosahedronGeometry(1,1),box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(1,1,1,16);
 function mesh(geo,material,x,y,z,sx=1,sy=1,sz=1,parent=root){const o=new T.Mesh(geo,typeof material==='string'?mat(material):material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function line(points,r,color,parent=root){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),18,r,5,false),color,0,0,0,1,1,1,parent);}
 function arc(r1,r2,a,b,height){const s=new T.Shape();s.absarc(0,0,r2,a,b,false);s.absarc(0,0,r1,b,a,true);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:height,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.018,bevelThickness:.015,curveSegments:5});g.rotateX(-Math.PI/2);return g;}
 const stone=['#637879','#748680','#657b7d','#7a8a80','#6b8080'];
 // Recessed foundation and a genuine hole: the descending steps are below the floor.
 mesh(cyl,new T.MeshStandardMaterial({color:'#203a42',roughness:1}),0,-.48,0,30,.12,30).receiveShadow=false;
 mesh(cyl,'#344f54',0,-.32,0,3.8,.58,3.8);
 const floor=new T.Shape();floor.absarc(0,0,3.43,0,Math.PI*2,false);
 const hole=new T.Path();hole.absarc(0,2.35,.57,0,Math.PI*2,true);floor.holes.push(hole);
 const floorGeo=new T.ShapeGeometry(floor,72);floorGeo.rotateX(-Math.PI/2);
 mesh(floorGeo,'#52686b',0,.07,0);
 // Hand-set flagstones, interrupted around the stair opening; no raised trip hazards.
 for(let ring=0;ring<6;ring++){const inner=ring*.55+.04,outer=(ring+1)*.55,count=ring?10+ring*6:6;
  for(let i=0;i<count;i++){const a=i*2*Math.PI/count+ring*.19,b=a+2*Math.PI/count-.022;
   const mid=(a+b)/2,r=(inner+outer)/2,x=Math.cos(mid)*r,z=-Math.sin(mid)*r;
   if(Math.hypot(x,z+2.35)<.9)continue;
   mesh(arc(inner,outer,a,b,.025),stone[(i+ring*3)%stone.length],0,.065,0);
  }
 }
 // Staggered curved stone courses. The near edge is cut away to keep the player visible.
 for(let row=0;row<7;row++)for(let i=0;i<30;i++){
  const a=(i+(row%2)*.5)*Math.PI*2/30,b=a+.202,mid=(a+b)/2;
  const x=Math.cos(mid)*3.6,z=-Math.sin(mid)*3.6,near=x+z>1.25;
  if(near&&row>0)continue;
  if(!near&&row>4&&x+z>-.1)continue;
  if(Math.abs(x)<.78&&z<-3&&row<4)continue; // old arched niche
  mesh(arc(3.43,3.88,a,b,.34),stone[(i+row*2)%stone.length],0,.1+row*.36,0);
 }
 // The far arch is a sealed, blue-lit recess, not an extra gameplay exit.
 const niche=new T.Group();niche.position.set(0,.08,-3.47);root.add(niche);
 mesh(box,'#193e48',0,.8,-.06,1.3,1.6,.16,niche);
 mesh(cyl,'#28505a',0,1.45,-.035,.65,.12,.65,niche).rotation.x=Math.PI/2;
 for(const x of [-.77,.77])for(let j=0;j<4;j++)mesh(box,stone[j],x,.18+j*.32,.07,.28,.3,.44,niche);
 for(let j=0;j<9;j++){const a=j*Math.PI/8;const o=mesh(box,stone[j%5],Math.cos(a)*.77,1.3+Math.sin(a)*.77,.07,.28,.3,.44,niche);o.rotation.z=a-Math.PI/2;}
 // A weathered moon seal in the alcove.
 mesh(new T.TorusGeometry(.26,.022,5,36),mat('#a9c9bd','#487a80'),0,1.03,.06,1,1,1,niche);
 mesh(new T.OctahedronGeometry(.085),mat('#bee3d3','#70b2b2'),0,1.03,.07,1,1.4,.5,niche);
 for(const x of [-.34,.34])line([[x,.32,.07],[x,.66,.07],[x*.8,.8,.07]],.009,'#7a9b93',niche);
 // Copper lamps and climbing roots frame the chamber rather than clutter its centre.
 const lampMat=mat('#ffdca0','#ffc16a');
 for(const [x,z]of [[-3.15,.3],[2.35,-2.6]]){
  mesh(box,'#4c4238',x,1.25,z,.12,.52,.12);
  mesh(cyl,lampMat,x,1.47,z,.115,.29,.115);
  mesh(cyl,'#51493d',x,1.29,z,.16,.06,.16);
  mesh(new T.ConeGeometry(.21,.16,6),'#74614a',x,1.68,z);
  for(const dx of [-.105,.105])mesh(box,'#51493d',x+dx,1.47,z,.026,.34,.035);
  const light=new T.PointLight('#ffca87',2.2,4,2);light.position.set(x,1.45,z+.15);root.add(light);
 }
 for(let i=0;i<9;i++){
  const a=2.55+i*.24+rnd()*.07,x=Math.cos(a)*3.35,z=Math.sin(a)*3.35;
  const end=.35+rnd()*.85;line([[x,2.45,z],[x+.1,1.8,z+.12],[x-.14,1.3,z+.12],[x+.13,end,z+.16]],.025+i%2*.012,'#5b6753');
  for(let j=0;j<5;j++){const y=end+j*.25;const leaf=mesh(rock,j%2?'#71917b':'#526f66',x+(j%2?.13:-.08),y,z+.13,.14,.065,.085);leaf.rotation.z=j%2?.55:-.6;}
 }
 // Moss cushions, pale mushrooms, tiny mineral seams confined to the perimeter.
 const capMat=mat('#a7d1c0','#518e85');
 for(let i=0;i<23;i++){const a=rnd()*Math.PI*2,r=3.28+rnd()*.06,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(Math.abs(x)<.55)continue;
  mesh(rock,i%2?'#4c7066':'#678273',x,.16,z,.22,.08,.15);
  if(i%3===0)for(let j=0;j<3;j++){const dx=x+j*.09,y=.18+j*.045;mesh(cyl,'#afc1a4',dx,y,z,.017,y,.017);mesh(new T.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI/2),capMat,dx,y*1.6,z,.075,.05,.075);}
 }
 // Entry ladder at the existing interaction point, with a little landing and rope rail.
 const ladder=new T.Group();ladder.position.set(0,0,2.65);ladder.rotation.x=.1;root.add(ladder);
 for(const x of [-.23,.23])mesh(box,'#927957',x,1.18,0,.075,2.35,.075,ladder);
 for(let i=0;i<9;i++)mesh(box,'#b3986d',0,.2+i*.245,-.025,.51,.065,.11,ladder);
 line([[-.37,.08,2.72],[-.39,1.2,2.7],[-.37,2.5,2.65]],.018,'#c2b28b');
 // Rim, dark water and stone steps clearly distinguish the route further down.
 mesh(arc(.58,.78,0,Math.PI*2,.075),'#a3aaa0',0,.08,-2.35);
 mesh(cyl,mat('#315a65','#1d4652'),0,-.34,-2.35,.56,.025,.56);
 for(let i=0;i<4;i++)mesh(box,stone[i],0,.03-i*.105,-1.94-i*.16,.68,.075,.19);
 const poolLight=new T.PointLight('#85cbd4',1.3,3.4,2);poolLight.position.set(0,.7,-2.65);root.add(poolLight);
 // Merge static decorations by material: fine masonry needn't mean hundreds of draw calls.
 root.updateMatrixWorld(true);const staticMeshes=[];root.traverse(o=>{if(o.isMesh)staticMeshes.push(o);});
 for(const o of staticMeshes){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(g);o.removeFromParent();}
 for(const [material,geos]of batches){const g=mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g));mesh(g,material,0,0,0);for(const geo of geos)geo.dispose();}
 // Shared faceted crystal materials: only the active layer's nodes are visible/pickable.
 const crystalMats={stone:mat('#c8e9e6','#639fad'),sand:mat('#e8c294','#a57644')};
 const crystalGeo=new T.CylinderGeometry(0,.1,.5,5,1),shaftGeo=new T.CylinderGeometry(.1,.105,.3,5,1);
 for(const n of NODES.filter(n=>n.map==='depths')){
  const g=new T.Group();g.position.set(n.x,.08,n.z);g.userData.nodeId=n.id;g.visible=false;root.add(g);
  const vein=new T.Group();g.add(vein);if(!layers.has(n.depth))layers.set(n.depth,[]);layers.get(n.depth).push({g,vein,id:n.id});
  mesh(rock,'#637775',0,.035,0,.36,.095,.3,g);
  for(let j=0;j<4;j++){const a=j*2.4+n.depth,size=j===0?1:.55+j*.07,stem=new T.Group();stem.position.set(Math.cos(a)*.14,.06,Math.sin(a)*.14);stem.rotation.set(Math.sin(a)*.22,0,Math.cos(a)*.24);stem.scale.setScalar(size);vein.add(stem);
   mesh(shaftGeo,crystalMats[n.kind],0,.15,0,1,1,1,stem);mesh(crystalGeo,crystalMats[n.kind],0,.55,0,1,1,1,stem);
  }
 }
 const dustGeo=new T.BufferGeometry(),dust=[];for(let i=0;i<38;i++)dust.push((rnd()-.5)*6,.3+rnd()*2.3,(rnd()-.5)*6);
 dustGeo.setAttribute('position',new T.Float32BufferAttribute(dust,3));const motes=new T.Points(dustGeo,new T.PointsMaterial({color:'#bddfca',size:.025,transparent:true,opacity:.5,depthWrite:false}));motes.raycast=()=>{};root.add(motes);
 return {root,
  pick(ray){const hit=ray.intersectObjects(root.children,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});let o=hit?.object;while(o&&!o.userData.nodeId)o=o.parent;return o?.userData.nodeId;},
  update(s,time){for(const [depth,rows]of layers)for(const row of rows){row.g.visible=depth===s.depth;row.vein.visible=!s.picked.includes(row.id);}crystalMats.stone.emissiveIntensity=.6+Math.sin(time*.8)*.09;motes.position.y=Math.sin(time*.18)*.065;}
 };
}
