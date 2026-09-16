import * as T from 'three';
import {NODES} from './world.mjs?v=fg-40de915a77c169e3';
// 星井：一口一层层往下的井。手绘质感和林地那支同一套路（画布上刷颜料，不要生成图）。
// ⚠️每一层的矿脉位置是固定的（rules.js 的 depthNodes 算出来），这里一次把十二层都建好，
//   update 时只显示当前这一层——不然每下一层就要重建一次场景。
export function makeDepths(){
 const root=new T.Group(),layers=new Map(),mats=new Map(),sparks=[];let seed=913;
 const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 function mat(color,rough=1){const key=color+rough;if(mats.has(key))return mats.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
  c.fillStyle=color;c.fillRect(0,0,128,128);
  for(let i=0;i<620;i++){c.fillStyle=rnd()>.5?'rgba(226,232,255,.05)':'rgba(8,10,20,.09)';c.beginPath();
   c.ellipse(rnd()*128,rnd()*128,2+rnd()*9,1+rnd()*4,rnd(),0,Math.PI*2);c.fill();}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
  const m=new T.MeshStandardMaterial({map:tex,color:'#9aa0b4',roughness:rough});mats.set(key,m);return m;}
 function mesh(geo,color,x,y,z,sx=1,sy=1,sz=1,parent=root){const m=new T.Mesh(geo,mat(color));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
 const sphere=new T.IcosahedronGeometry(1,2),cyl=new T.CylinderGeometry(1,1,1,12),cone=new T.ConeGeometry(1,1,7);
 // ⚠️井底自己的地要【盖住整个视野】：外面那层草地和远树在这张地图上是关掉的，
 //   不铺这一块，镜头就直接看见空背景。
 mesh(cyl,'#23252f',0,.02,0,30,.04,30);
 mesh(cyl,'#4a4a58',0,.05,0,3.5,.08,3.5);
 // ⚠️墙只在【镜头背面】那半圈长高：斜视角下，近处的墙长起来就把井底整个挡住了
 //   （试出来的——四米高的一圈石柱，屏幕上只剩一个黑桶）。
 //   镜头在 +x/+z 那头，所以 x+z 为正的是近处，压到半米当矮石台。
 for(let i=0;i<26;i++){const a=i*Math.PI/13,r=3.55+rnd()*.4,x=Math.cos(a)*r,z=Math.sin(a)*r;
  const near=(x+z)>1.6,h=near?.5+rnd()*.25:3.6+rnd()*1.5;
  const w=mesh(cyl,i%3?'#3b3d4c':'#474a5c',x,h/2,z,.6+rnd()*.32,h,.55+rnd()*.3);
  w.rotation.y=a;w.rotation.z=(rnd()-.5)*.1;}
 for(let i=0;i<22;i++){const a=rnd()*Math.PI*2,r=1.1+rnd()*2.2;
  mesh(sphere,rnd()>.5?'#54576a':'#3f4252',Math.cos(a)*r,.09,Math.sin(a)*r,.12+rnd()*.28,.07,.14+rnd()*.2);}
 // 上去的梯子（靠井壁），和再往下的那个洞口
 const ladder=new T.Group();ladder.position.set(0,0,2.6);root.add(ladder);
 for(const x of [-.17,.17])mesh(cyl,'#7c6a4e',x,1.15,0,.045,2.3,.045,ladder);
 for(let i=0;i<7;i++)mesh(cyl,'#8a7756',0,.24+i*.31,0,.04,.34,.04,ladder).rotation.z=Math.PI/2;
 const pit=new T.Group();pit.position.set(0,0,-2.35);root.add(pit);
 mesh(cyl,'#20222e',0,.055,0,.62,.04,.62,pit);
 for(let i=0;i<9;i++){const a=i*Math.PI*2/9;mesh(cone,'#5a5d70',Math.cos(a)*.66,.16,Math.sin(a)*.66,.11,.26,.11,pit).rotation.z=Math.cos(a)*.3;}
 // 十二层的矿脉，一次建好，按层显示
 for(const n of NODES.filter(n=>n.map==='depths')){
  const g=new T.Group();g.position.set(n.x,.08,n.z);g.userData.nodeId=n.id;g.visible=false;root.add(g);
  const vein=new T.Group();g.add(vein);
  if(!layers.has(n.depth))layers.set(n.depth,[]);
  layers.get(n.depth).push({g,vein,id:n.id});
  mesh(sphere,'#3f4252',0,0,0,.42,.1,.34,g);
  const tone=n.kind==='stone'?'#cfd9ff':'#e6d7a6';
  for(let j=0;j<(n.kind==='stone'?5:4);j++){const a=j*2.1+n.depth;
   const crystal=mesh(cone,tone,Math.cos(a)*.14,.2+(j%2)*.07,Math.sin(a)*.14,.075,.34+(j%3)*.12,.075,vein);
   crystal.material=crystal.material.clone();
   crystal.material.emissive.set(n.kind==='stone'?'#8fa6ff':'#c9a75f');
   crystal.material.emissiveIntensity=n.kind==='stone'?.95:.6;
   crystal.rotation.z=Math.cos(a)*.34;crystal.rotation.x=Math.sin(a)*.3;
   sparks.push(crystal);}
 }
 return {root,
  pick(ray){const hit=ray.intersectObjects(root.children,true).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
   let o=hit?.object;while(o&&!o.userData.nodeId)o=o.parent;return o?.userData.nodeId;},
  update(s,time){
   for(const [depth,rows]of layers)for(const row of rows){
    row.g.visible=depth===s.depth;
    row.vein.visible=!s.picked.includes(row.id);}
   for(const [i,c]of sparks.entries())c.material.emissiveIntensity=(c.material.emissive.getHex()===0x8fa6ff?.9:.55)+Math.sin(time*1.6+i)*.16;}};
}
