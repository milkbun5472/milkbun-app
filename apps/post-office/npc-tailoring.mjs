import * as T from 'three';
import {mergeGeometries} from '../fairy-garden/vendor/BufferGeometryUtils.js?v=fg-b149ac3dbf94ecd5';
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
 function mesh(name,g,color,pattern='linen',rig='body',metal=0){const m=new T.SkinnedMesh(g.attributes.skinIndex?g:bind(g,rig),material(color,pattern,metal));m.name='NPCCostume:'+style+':'+name;m.userData={outfit:id,npcCostume:style};m.bind(body.skeleton,body.bindMatrix);model.add(m);return m;}
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
 function sleeve(side,color,{pattern='linen',short=false,puff=false,cuff=true}={}){const a=new T.Vector3(side*.145,.666,0),b=new T.Vector3(side*(short?.227:.267),short?.535:.452,0),axis=b.clone().sub(a).normalize(),across=new T.Vector3(axis.y,-axis.x,0).normalize(),depth=new T.Vector3(0,0,1),radii=[0,puff?.072:.062,puff?.065:.054,.047];
  const point=(u,v)=>{const angle=u*Math.PI*2,k=v*3,j=Math.min(2,Math.floor(k)),radius=T.MathUtils.lerp(radii[j],radii[j+1],k-j),c=a.clone().lerp(b,v);c.addScaledVector(across,Math.cos(angle)*radius).addScaledVector(depth,Math.sin(angle)*radius*.94);return c.toArray();};const g=grid(12,20,point,[1,1]);mesh((side<0?'Left':'Right')+'SetInSleeve',g,color,pattern,'surface');
  if(cuff){const q=grid(2,20,(u,v)=>{const c=new T.Vector3(...point(u,.91+v*.09)),normal=new T.Vector3(...point(u,.95)).sub(a.clone().lerp(b,.95)).normalize();return c.addScaledVector(normal,.003).toArray();},[1,.12]);mesh('BoundCuff',q,color,'knit','surface');line('CuffTopstitch',Array.from({length:17},(_,i)=>point(i/16,.92)),color,.001,'surface');}
 }
 function trousers(color,{roll=false}={}){const waist=loft('TrouserWaist',[[.292,.15,.124],[.337,.153,.124],[.372,.148,.117]],color,{uv:[2,.5]}).mesh;waist.userData.skinCoverage={torsoBelow:.692,torsoAbove:.085,feet:.105};for(const side of [-1,1]){const rig=side<0?'leftLeg':'rightLeg',x=side*.08;loft('ShapedTrouserLeg',[[.119,.066,.081],[.16,.069,.086],[.24,.068,.09],[.31,.069,.099],[.345,.07,.104]],color,{rig,x,uv:[1,1.5]});loft(roll?'RolledTrouserCuff':'TurnedTrouserHem',[[.115,.068,.083],[roll?.138:.126,.071,.087],[roll?.15:.137,.068,.084]],color,{rig,x,uv:[1,.2]});line('PressedTrouserSeam',[[side*.092,.315,.106],[side*.105,.21,.099],[side*.099,.14,.092]],'#a49b85',.0008,rig);}}
 function shoes(color='#66564a'){for(const side of [-1,1]){const rig=side<0?'leftLeg':'rightLeg',x=side*.09;ball('LeatherShoe',x,.061,.034,.067,.054,.098,color,{rig,pattern:'leather'});ball('SewnSole',x,.026,.039,.068,.015,.098,'#8c7760',{rig,pattern:'plain'});for(const y of [.063,.077,.089])line('Lace',[[x-.024,y,.111],[x,y+.003,.116],[x+.024,y,.111]],'#d6c7a7',.0018,rig);}}
 function headMesh(name,g,color,pattern='linen'){const m=new T.Mesh(g,material(color,pattern));m.name='NPCCostume:'+style+':'+name;m.userData={outfit:id,npcCostume:style};model.add(m);model.updateMatrixWorld(true);(model.getObjectByName('HeadAnchor')||model).attach(m);return m;}
 function headBall(name,x,y,z,rx,ry,rz,color,pattern='linen'){const g=new T.SphereGeometry(1,24,16);g.scale(rx,ry,rz);g.translate(x,y,z);return headMesh(name,g,color,pattern);}
 function headLine(name,points,color,r=.002){return headMesh(name,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,r,6,false),color,'plain');}
 function finish(){
  // Many tiny stitches/buttons share a fabric and skeleton. Batch them before
  // the actor is prepared, so detail does not cost a draw call per stitch.
  const groups=new Map();for(const m of [...model.children])if(m.isSkinnedMesh&&m.userData.npcCostume===style){if(!groups.has(m.material))groups.set(m.material,[]);groups.get(m.material).push(m);}
  let batch=0;for(const [mat,parts]of groups){if(parts.length<2)continue;const geometries=parts.map(m=>m.geometry.index?m.geometry.toNonIndexed():m.geometry),g=mergeGeometries(geometries,false);if(!g)throw Error('Customer fabric pieces could not be joined.');const combined=new T.SkinnedMesh(g,mat);combined.name='NPCCostume:'+style+':SewnFabric:'+batch++;combined.userData={outfit:id,npcCostume:style,pieces:parts.map(m=>m.name),...parts.find(m=>m.userData.skinCoverage)?.userData};combined.bind(body.skeleton,body.bindMatrix);model.add(combined);parts.forEach(m=>{m.geometry.dispose();m.removeFromParent();});geometries.forEach(g=>g.dispose());}
 }
 return {id,body,mesh,grid,loft,panel,line,ball,box,button,pocket,collar,sleeve,trousers,shoes,headMesh,headBall,headLine,finish};
}
