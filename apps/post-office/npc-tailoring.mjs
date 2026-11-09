import * as T from 'three';
import {FIT_EPSILON,clipFitPolygon,CLOTH_WAIST,CLOTH_HEM,clothFall,drapeFitVertex,clothLevels} from './npc-fit.mjs?v=fg-5886d33935856535';
import {mergeGeometries} from '../fairy-garden/vendor/BufferGeometryUtils.js?v=fg-5886d33935856535';
// Shared pattern pieces for the public customers. Geometry belongs to the actor;
// binding uses its original doll skeleton, never a character's wardrobe asset.
export function createNpcTailoring(model,style){
 const id='post-npc-'+style,body=model.getObjectByName('DollBody');
 if(!body?.isSkinnedMesh)throw Error('Missing common doll body for the customer costume.');
 const src=body.geometry,p=src.attributes.position,si=src.attributes.skinIndex,sw=src.attributes.skinWeight,bones=body.skeleton.bones,materials=new Map();
 function fabric(color,pattern){
  const cv=document.createElement('canvas');cv.width=cv.height=256;const c=cv.getContext('2d');c.fillStyle=color;c.fillRect(0,0,256,256);
  let seed=7941;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<5000;i++){c.fillStyle=i%2?'#ffffff':'#42372d';c.globalAlpha=.01+random()*.02;c.fillRect(random()*256,random()*256,1,1);}
  c.globalAlpha=.025;c.strokeStyle='#fff8e9';c.lineWidth=1;
  for(let x=0;x<256;x+=4){c.beginPath();c.moveTo(x,0);c.lineTo(x,256);c.stroke();}
  for(let y=0;y<256;y+=4){c.beginPath();c.moveTo(0,y);c.lineTo(256,y);c.stroke();}
  if(pattern==='knit'){c.globalAlpha=.055;c.strokeStyle='#fff7e4';for(let y=0;y<256;y+=12)for(let x=0;x<256;x+=10){c.beginPath();c.moveTo(x,y);c.lineTo(x+4,y+8);c.lineTo(x+8,y);c.stroke();}}
  if(pattern==='check'){for(let i=0;i<256;i+=64){c.fillStyle='#e4d1ac';c.globalAlpha=.25;c.fillRect(i,0,13,256);c.fillRect(0,i,256,13);c.fillStyle='#594e42';c.globalAlpha=.16;c.fillRect(i+24,0,3,256);c.fillRect(0,i+24,256,3);}}
  if(pattern==='stripes'){c.globalAlpha=.68;c.fillStyle='#e7d6b1';for(let y=8;y<256;y+=64)c.fillRect(0,y,256,15);}
  if(pattern==='flowers'){c.globalAlpha=.65;for(let y=20;y<256;y+=62)for(let x=18+(y%3)*7;x<256;x+=62){for(let a=0;a<5;a++){c.fillStyle='#d3b4aa';c.beginPath();c.ellipse(x+Math.sin(a*1.256)*5,y+Math.cos(a*1.256)*5,3,5,a*1.256,0,7);c.fill();}c.fillStyle='#d9c699';c.beginPath();c.arc(x,y,2,0,7);c.fill();c.strokeStyle='#9caa85';c.lineWidth=2;c.beginPath();c.moveTo(x,y+6);c.lineTo(x+5,y+14);c.stroke();}}
  c.globalAlpha=1;const map=new T.CanvasTexture(cv);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=2;return map;
 }
 function material(color,pattern='linen',metal=0){const key=[color,pattern,metal].join('|');if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color:pattern==='plain'?color:'#ffffff',map:pattern==='plain'?null:fabric(color,pattern),roughness:metal?.42:pattern==='leather'?.7:.92,metalness:metal,side:T.DoubleSide}));return materials.get(key);}
 const boneIndex=name=>Math.max(0,bones.findIndex(b=>b.name===name));
 function bind(g,rig='body'){
  const a=g.attributes.position,ids=new Uint16Array(a.count*4),weights=new Float32Array(a.count*4);
  for(let i=0;i<a.count;i++){if(rig!=='surface'){ids[i*4]=boneIndex(rig);weights[i*4]=1;continue;}let nearest=0,d=Infinity;for(let j=0;j<p.count;j++){const dd=(a.getX(i)-p.getX(j))**2+(a.getY(i)-p.getY(j))**2+(a.getZ(i)-p.getZ(j))**2;if(dd<d){d=dd;nearest=j;}}for(let k=0;k<4;k++){ids[i*4+k]=si.getComponent(nearest,k);weights[i*4+k]=sw.getComponent(nearest,k);}}
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));return g;
 }
 function mesh(name,g,color,pattern='linen',rig='body',metal=0){if(!g.userData.bodyFitted){const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const q=fitDetail(pos.getX(i),pos.getY(i),pos.getZ(i));pos.setXYZ(i,...q);}g.computeVertexNormals();}const m=new T.SkinnedMesh(g.attributes.skinIndex?g:bind(g,rig),material(color,pattern,metal));m.name='NPCCostume:'+style+':'+name;m.userData={outfit:id,npcCostume:style};m.bind(body.skeleton,body.bindMatrix);model.add(m);return m;}
 // Accessory art was authored around the former padded torso. Fit it to
 // the real body's cross-sections; keep the head, body and skeleton unchanged.
 const profiles=new Map();
 const armOf=w=>w.reduce((sum,x,i)=>sum+(/Arm|Forearm/.test(bones[i]?.name||'')?x:0),0);
 function profile(y){const key=Math.round(Math.max(.335,Math.min(.685,y))*100);if(profiles.has(key))return profiles.get(key);const yy=key/100,pts=[];for(let i=0;i<p.count;i++){if(Math.abs(p.getY(i)-yy)>.012)continue;let arm=0;for(let j=0;j<4;j++)if(/Arm|Forearm/.test(bones[si.getComponent(i,j)]?.name||''))arm+=sw.getComponent(i,j);if(arm<.15)pts.push([p.getX(i),p.getZ(i)]);}const xs=pts.map(q=>q[0]),zs=pts.map(q=>q[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),out=pts.length?{w:(maxX-minX)/2+.006,d:(maxZ-minZ)/2+.006,cx:(maxX+minX)/2,cz:(maxZ+minZ)/2}:{w:.13,d:.1,cx:0,cz:0};profiles.set(key,out);return out;}
 function fitDetail(x,y,z){
  if(y>.72||y<.09)return [x,y,z];const target={...profile(y)};
  if(y<CLOTH_WAIST&&y>.24){const waist=profile(CLOTH_WAIST),fall=clothFall(y),blend=T.MathUtils.smoothstep(y,.24,CLOTH_HEM);target.w=T.MathUtils.lerp(target.w,Math.max(target.w,waist.w+.01*fall),blend);target.d=T.MathUtils.lerp(target.d,Math.max(target.d,waist.d+.004*fall),blend);target.cz=T.MathUtils.lerp(target.cz,waist.cz,blend);}
  const ys=[.335,.375,.49,.6,.654,.69],ws=[.166,.153,.161,.175,.161,.075],ds=[.128,.119,.126,.122,.103,.069],yy=Math.max(ys[0],Math.min(ys.at(-1),y));let i=0;while(i<ys.length-2&&ys[i+1]<yy)i++;const t=(yy-ys[i])/(ys[i+1]-ys[i]),w=T.MathUtils.lerp(ws[i],ws[i+1],t),d=T.MathUtils.lerp(ds[i],ds[i+1],t);return [x*Math.min(1,target.w/w)+target.cx,y,z*Math.min(1,target.d/d)+target.cz];
 }
 let fitVertices=null;
 function fitted(name,color,{minY=-1,maxY=2,minArm=0,maxArm=1,side=0,open=false,offset=.004,pattern='linen',drapeFrom=null}={}){
  const normal=src.attributes.normal,original=src.index,vertices=fitVertices||[];
  if(!fitVertices)for(let i=0;i<p.count;i++){const w=Array(bones.length).fill(0);for(let j=0;j<4;j++)w[si.getComponent(i,j)]+=sw.getComponent(i,j);vertices.push({p:[p.getX(i),p.getY(i),p.getZ(i)],n:[normal.getX(i),normal.getY(i),normal.getZ(i)],w});}fitVertices=vertices;
  const lerp=(a,b,t)=>({p:a.p.map((x,i)=>x+(b.p[i]-x)*t),n:a.n.map((x,i)=>x+(b.n[i]-x)*t),w:a.w.map((x,i)=>x+(b.w[i]-x)*t)});
  const bottom=drapeFrom??minY,planes=[v=>v.p[1]-bottom,v=>maxY-v.p[1]];if(minArm>0)planes.push(v=>armOf(v.w)-minArm);if(maxArm<1)planes.push(v=>maxArm-armOf(v.w));if(side)planes.push(v=>v.p[0]*side);if(open)planes.push(v=>Math.max(Math.abs(v.p[0])-(.013+Math.max(0,v.p[1]-.49)*.2),-v.p[2]));
  const positions=[],normals=[],uv=[],indices=[],weights=[];
  function push(v){const n=new T.Vector3(...v.n).normalize(),q=new T.Vector3(...v.p).addScaledVector(n,offset);positions.push(...q.toArray());normals.push(...n.toArray());uv.push(Math.atan2(v.p[0],v.p[2])*Math.PI**-1+1,(v.p[1]-.1)*3);const skin=v.w.map((w,i)=>({w,i})).sort((a,b)=>b.w-a.w).slice(0,4),sum=skin.reduce((n,x)=>n+x.w,0)||1;for(const x of skin){indices.push(x.i);weights.push(x.w/sum);}}
  // A shirt hangs from the waist instead of tracing the pelvis and inner legs.
  // Extend the exact cut edge, retaining its normals and weights at the join;
  // the lower edge stays horizontal and follows only the body's waist motion.
  const waist=drapeFrom==null?null:profile(drapeFrom),levels=waist?clothLevels(minY):[];
  for(let i=0;i<original.count;i+=3){let poly=[vertices[original.getX(i)],vertices[original.getX(i+1)],vertices[original.getX(i+2)]];for(const plane of planes){poly=clipFitPolygon(poly,plane,lerp);if(poly.length<3)break;}for(let j=1;j<poly.length-1;j++){push(poly[0]);push(poly[j]);push(poly[j+1]);}
   if(waist)for(let j=0;j<poly.length;j++){const a=poly[j],b=poly[(j+1)%poly.length];if(Math.abs(a.p[1]-bottom)>FIT_EPSILON||Math.abs(b.p[1]-bottom)>FIT_EPSILON)continue;for(let row=0;row<levels.length-1;row++){const y0=levels[row],y1=levels[row+1],a0=drapeFitVertex(a,y0,waist),b0=drapeFitVertex(b,y0,waist),a1=drapeFitVertex(a,y1,waist),b1=drapeFitVertex(b,y1,waist);push(b0);push(a0);push(a1);push(b0);push(a1);push(b1);}}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.userData.bodyFitted=true;const m=mesh(name,g,color,pattern);m.userData.bodyFitted={minY,maxY,minArm,maxArm,offset,drapeFrom};return m;
 }
 function grid(rows,cols,point,uvScale=[1,1]){const pos=[],uv=[],index=[];for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){pos.push(...point(i/cols,j/rows));uv.push(i/cols*uvScale[0],j/rows*uvScale[1]);}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;index.push(a,b,a+1,b,b+1,a+1);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;}
 function loft(name,sections,color,{open=0,pleat=0,pattern='linen',rig='body',thick=.003,uv=[2,1],x=0}={}){
  const points=sections.map(([y,w,d,z=0])=>({y,w,d,z}));
  const shape=(u,v,inset=0)=>{const k=v*(points.length-1),i=Math.min(points.length-2,Math.floor(k)),t=k-i,a=points[i],b=points[i+1],lerp=key=>T.MathUtils.lerp(a[key],b[key],t),y=lerp('y'),gap=typeof open==='function'?open(y):open,angle=gap+u*(Math.PI*2-gap*2),fold=pleat*(.5+.5*Math.cos(angle*12))*Math.pow(1-v,1.4),w=lerp('w')+fold-inset,d=lerp('d')+fold*.7-inset;return [Math.sin(angle)*w+x,y,Math.cos(angle)*d+lerp('z')];};
  const outside=grid((points.length-1)*3,40,(u,v)=>shape(u,v),uv);const result=mesh(name,outside,color,pattern,rig);
  if(thick){const hem=grid(1,40,(u,v)=>{const q=shape(u,0,thick*v);q[1]+=.003*v;return q;},[2,.08]);mesh(name+':TurnedHem',hem,color,pattern,rig);const neck=grid(1,40,(u,v)=>shape(u,1,thick*v),[1,.08]);mesh(name+':NeckFacing',neck,color,pattern,rig);}
  return {mesh:result,at:shape};
 }
 function panel(name,outline,color,{z=.15,bulge=.01,pattern='linen',rig='body',thickness=.003}={}){
  // A tailored polygon, with a curved front and a sewn return along its edge.
  const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelThickness:.0015,bevelSize:.0015,bevelSegments:2,curveSegments:4}),q=g.attributes.position;for(let i=0;i<q.count;i++)q.setZ(i,q.getZ(i)+(typeof z==='function'?z(q.getX(i),q.getY(i)):z)+bulge*(1-Math.min(1,(q.getX(i)/.2)**2)));g.computeVertexNormals();return mesh(name,g,color,pattern,rig);
 }
 function line(name,points,color,r=.0016,rig='body',pattern='plain'){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(name,new T.TubeGeometry(curve,Math.max(8,points.length*3),r,5,false),color,pattern,rig);}
 function ball(name,x,y,z,rx,ry,rz,color,{rig='body',pattern='plain',metal=0}={}){const tiny=Math.max(rx,ry,rz)<.005,small=Math.max(rx,ry,rz)<.013,g=new T.SphereGeometry(1,tiny?6:small?8:12,tiny?4:small?6:8);g.scale(rx,ry,rz);g.translate(x,y,z);return mesh(name,g,color,pattern,rig,metal);}
 function box(name,x,y,z,w,h,d,color,{rig='body',pattern='linen',radius=.005}={}){const sh=new T.Shape(),l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,rr=Math.min(radius,w/3,h/3);sh.moveTo(l+rr,b);sh.lineTo(r-rr,b);sh.quadraticCurveTo(r,b,r,b+rr);sh.lineTo(r,t-rr);sh.quadraticCurveTo(r,t,r-rr,t);sh.lineTo(l+rr,t);sh.quadraticCurveTo(l,t,l,t-rr);sh.lineTo(l,b+rr);sh.quadraticCurveTo(l,b,l+rr,b);const g=new T.ExtrudeGeometry(sh,{depth:d,bevelEnabled:true,bevelThickness:rr/2,bevelSize:rr/2,bevelSegments:2,curveSegments:4});g.translate(0,0,z-d/2);return mesh(name,g,color,pattern,rig);}
 function button(x,y,z,color='#bdab7f',r=.006){ball('Button',x,y,z,r,r,.0035,color,{metal:.35});for(const dx of [-.0018,.0018])ball('ButtonHole',x+dx,y,z+.0035,.0008,.0014,.0005,'#645642');}
 function pocket(name,x,y,w,h,color,z=null,{flap=false}={}){const at=xx=>z==null?.132*Math.sqrt(Math.max(.2,1-(xx/.184)**2))+.004:z,point=(xx,yy,offset=0)=>[xx,yy,at(xx)+offset];panel(name,[[x-w/2,y+h/2],[x+w/2,y+h/2],[x+w/2,y-h/2+.008],[x,y-h/2],[x-w/2,y-h/2+.008]],color,{z:xx=>at(xx),bulge:.002});line(name+':Topstitch',[point(x-w/2+.006,y+h/2-.004,.009),point(x-w/2+.006,y-h/2+.012,.009),point(x,y-h/2+.006,.009),point(x+w/2-.006,y-h/2+.012,.009),point(x+w/2-.006,y+h/2-.004,.009)],'#d5c6aa',.0009);if(flap){panel(name+':Flap',[[x-w/2-.002,y+h/2+.002],[x+w/2+.002,y+h/2+.002],[x+w/2,y+h/2-.026],[x,y+h/2-.032],[x-w/2,y+h/2-.026]],color,{z:xx=>at(xx)+.009,bulge:.003});button(x,y+h/2-.022,at(x)+.019,'#b9a579',.0035);}}
 function collar(color,{rounded=false}={}){loft('CollarStand',[[.667,.074,.073],[.684,.071,.069],[.698,.067,.065]],color,{uv:[1,.2]});for(const side of [-1,1]){const points=rounded?[[side*.012,.687],[side*.069,.692],[side*.109,.655],[side*.075,.632],[side*.028,.657]]:[[side*.008,.687],[side*.068,.694],[side*.115,.651],[side*.052,.622],[side*.025,.656]];panel('FoldedCollar',points,color,{z:.085,bulge:.035});line('CollarStitch',points.slice(1,4).map(([x,y])=>[x,y,.116]),'#e4dac3',.0008);}}
 function sleeve(side,color,{pattern='linen',short=false,cuff=true}={}){const y=short?.535:.455;fitted((side<0?'Left':'Right')+'FittedSleeve',color,{minY:y,maxY:.704,minArm:.3,side,offset:.006,pattern});if(cuff)fitted('FineCuff',color,{minY:y,maxY:y+.014,minArm:.3,side,offset:.008,pattern:'knit'});}
 function trousers(color,{roll=false}={}){const m=fitted('FittedTrousers',color,{minY:.105,maxY:.36,maxArm:.15,offset:.0045});m.userData.skinCoverage={torsoBelow:.692,torsoAbove:.085,feet:.105,arms:[.455,.704]};fitted(roll?'FineRolledHem':'FineTrouserHem',color,{minY:.105,maxY:roll?.122:.115,maxArm:.15,offset:.0065});}
 function shoes(color='#66564a'){fitted('FittedShoes',color,{maxY:.113,maxArm:.15,offset:.0055,pattern:'leather'});fitted('FineSole', '#8c7760',{maxY:.026,maxArm:.15,offset:.008,pattern:'plain'});}
 function headMesh(name,g,color,pattern='linen'){const m=new T.Mesh(g,material(color,pattern));m.name='NPCCostume:'+style+':'+name;m.userData={outfit:id,npcCostume:style};model.add(m);model.updateMatrixWorld(true);(model.getObjectByName('HeadAnchor')||model).attach(m);return m;}
 function headBall(name,x,y,z,rx,ry,rz,color,pattern='linen'){const g=new T.SphereGeometry(1,24,16);g.scale(rx,ry,rz);g.translate(x,y,z);return headMesh(name,g,color,pattern);}
 function headLine(name,points,color,r=.002){return headMesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,6,false),color,'plain');}
 function finish(){
  // Many tiny stitches/buttons share a fabric and skeleton. Batch them before
  // the actor is prepared, so detail does not cost a draw call per stitch.
  const groups=new Map();for(const m of [...model.children])if(m.isSkinnedMesh&&m.userData.npcCostume===style){if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(m);}
  let batch=0;for(const [mat,parts]of groups){if(parts.length<2)continue;const geometries=parts.map(m=>m.geometry.index?m.geometry.toNonIndexed():m.geometry),g=mergeGeometries(geometries,true);if(!g)throw Error('Customer fabric pieces could not be joined.');const combined=new T.SkinnedMesh(g,mat);combined.name='NPCCostume:'+style+':SewnFabric:'+batch++;combined.userData={outfit:id,npcCostume:style,pieces:parts.map(m=>m.name),fitParts:parts.map(m=>m.userData.bodyFitted||null),...parts.find(m=>m.userData.skinCoverage)?.userData};combined.bind(body.skeleton,body.bindMatrix);model.add(combined);parts.forEach(m=>{m.geometry.dispose();m.removeFromParent();});geometries.forEach(g=>g.dispose());}
 }
 return {id,body,mesh,grid,loft,panel,line,ball,box,button,pocket,collar,sleeve,trousers,shoes,headMesh,headBall,headLine,finish,fitted};
}
