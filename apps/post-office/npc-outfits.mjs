import * as T from 'three';
import {NPC_COSTUMES} from './npc-appearance.mjs?v=fg-14dcba4c9a64c8fb';
// The customer's outfit is drawn here, on an independent shell of the common
// body. Original skin weights keep cuffs/trousers attached to the same walking
// and letter-holding skeleton. No character outfit mesh or texture is used.
export function makeNpcCostume(model,style='postcard'){
 const design=NPC_COSTUMES[style]||NPC_COSTUMES.postcard,id='post-npc-'+style,body=model.getObjectByName('DollBody');
 if(!body?.isSkinnedMesh)throw Error('Missing common doll body for the customer costume.');
 const src=body.geometry,p=src.attributes.position,n=src.attributes.normal,si=src.attributes.skinIndex,sw=src.attributes.skinWeight,bones=body.skeleton.bones;
 const arm=i=>{let w=0;for(let k=0;k<4;k++)if(/Arm|Forearm/.test(bones[si.getComponent(i,k)]?.name||''))w+=sw.getComponent(i,k);return w;};
 function garment(name,geometry,color,map=null){const material=new T.MeshStandardMaterial({color,roughness:.95,side:T.DoubleSide,map});const mesh=new T.SkinnedMesh(geometry,material);mesh.name='NPCCostume:'+style+':'+name;mesh.userData={outfit:id,npcCostume:style};mesh.bind(body.skeleton,body.bindMatrix);model.add(mesh);return mesh;}
 // Keep every body's source vertex/morph/skin attribute untouched and owned by
 // the source cache. Only this instance's garment geometry is offset/cropped.
 const shell=src.clone(),pos=shell.attributes.position,colors=new Float32Array(p.count*3),palette={top:new T.Color(design.cloth),bottom:new T.Color(design.bottom),shoe:new T.Color('#594e42')};
 const valid=i=>p.getY(i)<.704&&(arm(i)>.35?p.getY(i)>.455:true);
 for(let i=0;i<p.count;i++){const y=p.getY(i),a=arm(i),loose=a<.35&&y>.30&&y<.68?1.14:1.07;pos.setXYZ(i,p.getX(i)*loose+n.getX(i)*.009,y+n.getY(i)*.009,p.getZ(i)*loose+n.getZ(i)*.013);const c=y<.105&&a<.35?palette.shoe:y<.335&&a<.35?palette.bottom:palette.top;c.toArray(colors,i*3);}
 const indices=[],old=src.index;for(let j=0;j<(old?.count||p.count);j+=3){const tri=[0,1,2].map(k=>old?old.getX(j+k):j+k);if(tri.every(valid))indices.push(...tri);}shell.setIndex(indices);shell.setAttribute('color',new T.BufferAttribute(colors,3));shell.computeVertexNormals();shell.computeBoundingSphere();const outfit=garment('TailoredShell',shell,'#ffffff');outfit.material.vertexColors=true;outfit.userData.skinCoverage={torsoBelow:.695,torsoAbove:.095,feet:.105};
 // Bind an authored accessory to its nearest original body vertex, so a seam,
 // apron or skirt follows the same arms/hips instead of hovering in world space.
 function bind(geometry){const a=geometry.attributes.position,ids=new Uint16Array(a.count*4),weights=new Float32Array(a.count*4);for(let i=0;i<a.count;i++){let nearest=0,d=Infinity;for(let j=0;j<p.count;j++){const v=(a.getX(i)-p.getX(j))**2+(a.getY(i)-p.getY(j))**2+(a.getZ(i)-p.getZ(j))**2;if(v<d){d=v;nearest=j;}}for(let k=0;k<4;k++){ids[i*4+k]=si.getComponent(nearest,k);weights[i*4+k]=sw.getComponent(nearest,k);}}geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute(ids,4));geometry.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));return geometry;}
 function sphere(name,x,y,z,rx,ry,rz,color){const g=new T.SphereGeometry(1,12,8);g.scale(rx,ry,rz);g.translate(x,y,z);return garment(name,bind(g),color);}
 function box(name,x,y,z,w,h,d,color){const g=new T.BoxGeometry(w,h,d);g.translate(x,y,z);return garment(name,bind(g),color);}
 function panel(name,w,h,x,y,z,texture,color='#ffffff'){
  const g=new T.PlaneGeometry(w,h,8,8),q=g.attributes.position;for(let i=0;i<q.count;i++){const xx=q.getX(i);q.setXYZ(i,xx+x,q.getY(i)+y,z+.018*(1-(xx/(w*.5))**2));}g.computeVertexNormals();return garment(name,bind(g),color,texture);
 }
 function drawing(kind){const cv=document.createElement('canvas');cv.width=256;cv.height=320;const c=cv.getContext('2d');c.fillStyle=kind==='flowers'||kind==='paint'?design.trim:design.cloth;c.fillRect(0,0,256,320);c.strokeStyle='#f7eedb';c.globalAlpha=.18;c.lineWidth=1;for(let x=8;x<256;x+=8){c.beginPath();c.moveTo(x,0);c.lineTo(x,320);c.stroke();}c.globalAlpha=1;c.strokeStyle=design.trim;c.lineWidth=2;if(kind==='paint'||kind==='flowers')c.strokeRect(9,8,238,304);
  const line=(x1,y1,x2,y2,color=design.trim,width=4)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const pocket=(x=146,y=177)=>{c.strokeStyle=design.trim;c.lineWidth=4;c.strokeRect(x,y,75,72);line(x+5,y+8,x+70,y+8);};
  if(kind==='floral'){for(let y=35;y<300;y+=54)for(let x=32;x<240;x+=52){c.fillStyle='#dfc8ab';for(let i=0;i<5;i++){c.beginPath();c.ellipse(x+Math.sin(i*1.256)*7,y+Math.cos(i*1.256)*7,5,7,i*1.256,0,7);c.fill();}c.fillStyle='#a58b58';c.beginPath();c.arc(x,y,3,0,7);c.fill();}line(128,0,128,320);}
  else if(kind==='stripes'){for(let y=24;y<320;y+=42){c.fillStyle=design.trim;c.fillRect(0,y,256,11);}pocket();}
  else if(kind==='check'){for(let x=28;x<256;x+=48)line(x,0,x,320,design.trim,9);for(let y=35;y<320;y+=52)line(0,y,256,y,design.trim,9);pocket();}
  else if(kind==='paint'){pocket(93,180);for(const [x,y,color]of [[85,80,'#9c6960'],[190,105,'#7c9b98'],[75,253,'#bba15e']]){c.fillStyle=color;c.beginPath();c.ellipse(x,y,10,17,-.45,0,7);c.fill();}for(let i=0;i<3;i++)line(110+i*19,133,115+i*19,199,'#72583e',6);}
  else if(kind==='flowers'){pocket(89,193);for(let i=0;i<3;i++){line(130,229,90+i*45,114,'#647e54',5);c.fillStyle=['#d8a59b','#e4d5a3','#be8eaa'][i];for(let a=0;a<5;a++){c.beginPath();c.arc(90+i*45+Math.sin(a*1.256)*10,114+Math.cos(a*1.256)*10,8,0,7);c.fill();}}}
  else if(kind==='satchel'||kind==='map'){line(23,0,225,320,design.trim,34);pocket(146,172);line(149,192,215,192,design.bottom,4);}
  else if(kind==='post'||kind==='inspect'){line(20,38,235,38,design.trim,18);line(128,55,128,320,design.trim,4);pocket(143,122);c.fillStyle=design.trim;c.fillRect(35,110,55,43);line(35,110,63,136,design.cloth,3);line(90,110,63,136,design.cloth,3);}
  else if(kind==='rival'){line(0,20,75,105,design.trim,18);line(256,20,180,105,design.trim,18);line(128,70,128,320,design.trim,4);pocket(146,180);}
  else{pocket(142,175);line(35,68,94,68);line(35,86,80,86);}
  if(!['flowers','paint','floral','stripes','check','satchel','map'].includes(kind))for(let y=90;y<300;y+=58){c.fillStyle=design.trim;c.beginPath();c.arc(128,y,5,0,7);c.fill();}
  const t=new T.CanvasTexture(cv);t.colorSpace=T.SRGBColorSpace;t.anisotropy=2;return t;
 }
 const apron=['paint','flowers'].includes(design.detail);panel('HandDrawnFront',apron?.245:.25,apron?.40:.31,0,apron?.46:.507,.15,drawing(design.detail));
 if(['granny','student'].includes(style))for(const x of [-.044,.044])sphere('CreamCollar',x,.68,.113,.042,.024,.015,design.trim);
 if(design.skirt||design.coat){const points=[new T.Vector2(.135,.385),new T.Vector2(design.skirt?.20:.165,.25),new T.Vector2(design.skirt?.22:.18,.17)];const g=new T.LatheGeometry(points,24);g.scale(1,1,.73);garment(design.skirt?'BellSkirt':'CoatHem',bind(g),design.skirt?design.bottom:design.cloth);}
 if(['satchel','map','post'].includes(design.detail)){box('ShoulderBag',-.19,.37,.105,.12,.13,.07,design.trim);box('BagFlap',-.19,.418,.15,.13,.05,.02,design.bottom);}
 if(design.detail==='inspect')box('BreastBadge',-.075,.58,.184,.048,.063,.014,design.trim);
 if(design.beret||design.hat){
  const head=model.getObjectByName('HeadAnchor')||model;model.updateMatrixWorld(true);
  const cap=(name,x,y,z,rx,ry,rz,color)=>{const g=new T.SphereGeometry(1,20,12);g.scale(rx,ry,rz);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.95}));m.name='NPCCostume:'+style+':'+name;m.userData={outfit:id,npcCostume:style};model.add(m);head.attach(m);return m;};
  if(design.beret){cap('Beret',-.018,1.205,-.005,.205,.065,.18,design.trim);cap('BeretButton',-.025,1.267,-.005,.024,.022,.024,design.trim);}
  else if(design.hat==='sun'){cap('SunHatBrim',0,1.16,0,.25,.018,.23,design.trim);cap('SunHatCrown',0,1.215,-.01,.157,.075,.15,design.cloth);}
  else{cap('UniformCap',0,1.205,-.005,.184,.065,.17,design.cloth);cap('UniformBand',0,1.162,0,.186,.018,.171,design.trim);cap('CapPeak',0,1.145,.14,.18,.015,.11,design.cloth);}
 }
 if(design.glasses){const head=model.getObjectByName('HeadAnchor')||model;model.updateMatrixWorld(true);for(const x of [-.065,.065]){const g=new T.TorusGeometry(.044,.005,5,18);g.translate(x,.94,.176);const mesh=new T.Mesh(g,new T.MeshStandardMaterial({color:'#796d5e',roughness:.7}));mesh.name='NPCCostume:'+style+':Glasses';mesh.userData={outfit:id,npcCostume:style};model.add(mesh);head.attach(mesh);}}
 return {id};
}
