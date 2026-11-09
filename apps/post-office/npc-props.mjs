import * as T from 'three';
import {createAnimalFigure} from '../fairy-garden/animal-figure.mjs?v=fg-8471d3c70eba9722';
import {storyHandPoint} from '../fairy-garden/story-motion.mjs?v=fg-8471d3c70eba9722';
import {mergeGeometries} from '../fairy-garden/vendor/BufferGeometryUtils.js?v=fg-8471d3c70eba9722';

export function makeNpcLeaf(){
 const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(-.05,.055,0,.105);shape.quadraticCurveTo(.05,.055,0,0);const g=new T.ShapeGeometry(shape,12),m=new T.Mesh(g,new T.MeshStandardMaterial({color:'#8f9d65',roughness:.9,side:T.DoubleSide}));m.name='CatsLetterLeaf';return m;
}
export function applyNpcPresence(root,look){if(look.npcRare==='ghost')root.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){m.transparent=true;m.opacity=.56;m.depthWrite=false;m.needsUpdate=true;}});}
export function settleNpcHeadwear(root,look={}){
 if(['strawHat','sun'].includes(look.npcFeature))root.traverse(o=>{if(o.isMesh&&!o.isSkinnedMesh&&o.userData.npcCostume&&/Hat|Cap|Beret|Toque|Piping|Peak|Emblem/.test(o.name)&&!/SunHat|BoundBrim/.test(o.name))o.visible=false;});
 root.updateMatrixWorld(true);const hair=new T.Box3(),hat=new T.Box3(),parts=[];let veil=null;
 root.traverse(o=>{if(!o.isMesh||!o.visible)return;if(/^hair_/.test(o.name))hair.union(new T.Box3().setFromObject(o,true));if(!o.userData.npcCostume||o.isSkinnedMesh)return;
  if(/WeddingVeil/.test(o.name)){veil=o;return;}if(/Hat|Cap|Beret|Toque|Brim|Piping|Peak|Emblem|FlowerCrown|SnowOnHair/.test(o.name)){parts.push(o);hat.union(new T.Box3().setFromObject(o,true));}
 });
 if(!hair.isEmpty())root.traverse(o=>{if(!o.isMesh||!o.userData.npcCostume||!o.name.includes('HeadphoneBand'))return;const before=new T.Box3().setFromObject(o,true),height=before.max.y-before.min.y,target=hair.max.y+.01;if(height>.01){o.scale.y*=T.MathUtils.clamp((target-before.min.y)/height,.5,1.5);root.updateMatrixWorld(true);const after=new T.Box3().setFromObject(o,true);o.position.y+=(before.min.y-after.min.y)/(o.parent.getWorldScale(new T.Vector3()).y||1);root.updateMatrixWorld(true);}});
 if(hair.isEmpty()||hat.isEmpty())return;const overlap=parts.some(o=>/Hat|Cap|Beret|Toque|Brim|Peak/.test(o.name))?.075:.018,delta=T.MathUtils.clamp(hair.max.y-overlap-hat.min.y,-.12,.12);if(veil)parts.push(veil);for(const part of parts)part.position.y+=delta/(part.parent.getWorldScale(new T.Vector3()).y||1);root.updateMatrixWorld(true);
}

export function createNpcProps(scene,avatar,look,{walkable=()=>true}={}){
 const root=new T.Group(),materials=new Map(),geometries=new Set(),animals=[],feature=look.npcFeature,rare=look.npcRare;scene.add(root);
 const material=(color,opacity=1)=>{const key=color+':'+opacity;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.8,metalness:color==='#aaa99b'?.45:0,transparent:opacity<1,opacity,depthWrite:opacity===1}));return materials.get(key);};
 function shape(g,color,x=0,y=0,z=0,opacity=1,parent=root){const mesh=new T.Mesh(g,material(color,opacity));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);geometries.add(g);return mesh;}
 const ball=(name,x,y,z,rx,ry,rz,color,parent=root)=>{const g=new T.SphereGeometry(1,12,8);g.scale(rx,ry,rz);const m=shape(g,color,x,y,z,1,parent);m.name=name;return m;};
 const box=(x,y,z,w,h,d,color,parent=root)=>shape(new T.BoxGeometry(w,h,d),color,x,y,z,1,parent);
 const cylinder=(x,y,z,r,h,color,opacity=1,parent=root)=>shape(new T.CylinderGeometry(r,r,h,16),color,x,y,z,opacity,parent);
 const wire=(points,color,r=.003,parent=root)=>shape(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*4),r,5,false),color,0,0,0,1,parent);
 let mode=null,kind=null,currentHand=null;
 if(feature==='birdcage'){
  mode='hand';kind='birdcage';cylinder(0,-.20,0,.075,.012,'#b5a079');
  for(const y of [-.20,-.07]){const m=shape(new T.TorusGeometry(.075,.003,5,24),'#a18b67',0,y);m.rotation.x=Math.PI/2;}
  for(let i=0;i<10;i++){const a=i*Math.PI/5,x=Math.sin(a)*.075,z=Math.cos(a)*.075;wire([[x,-.20,z],[x,-.07,z],[x*.5,-.025,z*.5],[0,0,0]],'#a18b67',.002);}
  wire([[-.02,0,0],[-.02,.035,0],[.02,.035,0],[.02,0,0]],'#a18b67');ball('SmallBird',0,-.14,0,.025,.028,.04,'#c6aa68');ball('BirdHead',0,-.113,.017,.02,.02,.02,'#d3bd83');ball('BirdEye',.013,-.11,.03,.003,.003,.002,'#514b41');
 }else if(feature==='thermos'){
  mode='hand';kind='thermos';cylinder(0,-.13,0,.057,.18,'#7b9a8d');cylinder(0,-.034,0,.06,.024,'#aaa99b');cylinder(0,-.22,0,.06,.02,'#aaa99b');wire([[-.05,-.03,0],[-.065,.025,0],[.065,.025,0],[.05,-.03,0]],'#6e766a',.007);
 }else if(feature==='map'){
  mode='hand';kind='map';for(let i=0;i<3;i++){const m=box((i-1)*.054,-.015,0,.055,.135,.004,'#e6d7b5');m.rotation.y=(i%2?1:-1)*.18;}
  for(let i=0;i<4;i++)wire([[-.075,-.055+i*.027,.009],[-.015,-.04+i*.02,.012],[.06,-.06+i*.03,.008]],i%2?'#9cad91':'#baa47d',.0018);
 }else if(feature==='cane'){
  mode='hand';kind='cane';cylinder(0,-.28,0,.009,.56,'#8c7150');wire([[-.045,-.014,0],[-.035,.02,0],[.015,.02,0],[.02,-.02,0]],'#8c7150',.01);cylinder(0,-.565,0,.015,.018,'#665d4e');
 }
 if(feature==='heldCat'){
  mode='carry';kind='heldCat';const cat=createAnimalFigure({scale:.52});root.add(cat.root);cat.root.position.set(0,-.12,0);cat.root.rotation.y=Math.PI/2;animals.push(cat);
 }
 if(rare==='rainman'){
  mode='left';kind='umbrella';cylinder(0,.34,0,.008,.87,'#8e826d');const canopy=shape(new T.ConeGeometry(.36,.15,24),'#424449',0,.80,0);canopy.material.side=T.DoubleSide;
  for(let i=0;i<8;i++){const a=i*Math.PI/4;wire([[0,.875,0],[Math.sin(a)*.18,.80,Math.cos(a)*.18],[Math.sin(a)*.36,.725,Math.cos(a)*.36]],'#77786f',.002);}
  wire([[0,-.09,0],[0,-.15,0],[.035,-.165,0],[.055,-.13,0]],'#7f715d',.012);
 }else if(rare==='collector'){
  mode='hand';kind='magnifier';cylinder(0,.025,0,.006,.08,'#9b825a');shape(new T.TorusGeometry(.047,.005,6,24),'#bdab7c',0,.108,0);shape(new T.CircleGeometry(.041,24),'#b9d5d2',0,.108,0,.28);
 }else if(rare==='kid'){
  mode='carry';kind='coinJar';cylinder(0,.03,0,.073,.16,'#c9dbcf',.32);cylinder(0,.115,0,.076,.012,'#b7a37e');cylinder(0,-.055,0,.07,.01,'#d3dbc9',.5);for(let i=0;i<12;i++){const coin=cylinder(Math.sin(i*2)*.045,-.035+(i%3)*.015,Math.cos(i*2)*.04,.018,.005,'#c8af6b');coin.rotation.z=(i%3)*.2;}
 }else if(rare==='author'){
  mode='carry';kind='manuscript';for(let i=0;i<14;i++)box(Math.sin(i*1.8)*.008,-.03+i*.0045,Math.cos(i)*.005,.17,.003,.115,i%2?'#eadfc7':'#ded2b7');for(let i=0;i<5;i++)wire([[-.06,.035,-.035+i*.015],[.056,.035,-.035+i*.015]],'#9f9583',.001);
 }
 // Batch rigid prop pieces by material; animals keep their articulated groups.
 root.updateMatrixWorld(true);for(const mat of materials.values()){const parts=root.children.filter(o=>o.isMesh&&o.material===mat);if(parts.length<2)continue;const gs=parts.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g;}),g=mergeGeometries(gs,false);if(g){const m=new T.Mesh(g,mat);root.add(m);geometries.add(g);parts.forEach(m=>m.removeFromParent());}gs.forEach(g=>g.dispose());}
 let dog=null,leash=null;if(feature==='shiba'){dog=createAnimalFigure({species:'dog',coat:'shiba',scale:.68});scene.add(dog.root);animals.push(dog);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(9),3));const m=new T.LineBasicMaterial({color:'#90765c'});leash=new T.Line(g,m);scene.add(leash);geometries.add(g);materials.set('leash',m);}
 let start=null,effect=null,effectGeometry=null;
 if(rare==='ghost'||rare==='snow'){
  effectGeometry=new T.BufferGeometry();effectGeometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(18*3),3));const m=new T.PointsMaterial({color:rare==='ghost'?'#bec6b8':'#f5f2e8',size:rare==='ghost'?28:5,sizeAttenuation:false,transparent:true,opacity:.32,depthWrite:false});const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d'),gradient=c.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#ffffffdd');gradient.addColorStop(1,'#ffffff00');c.fillStyle=gradient;c.fillRect(0,0,64,64);m.map=new T.CanvasTexture(cv);materials.set('entryEffect',m);effect=new T.Points(effectGeometry,m);scene.add(effect);geometries.add(effectGeometry);
 }
 function update(time,u,sceneClock=time){
  const moving=!!u.path?.length;for(const animal of animals)animal.animate(time,{moving:animal===dog&&moving,held:animal!==dog});
  if(start==null&&u.phase!=='waiting-entry')start=time;
  if(effect){const age=Number.isFinite(u.enteredAt)?sceneClock-u.enteredAt:start==null?99:time-start;effect.visible=age<2.8&&u.phase!=='waiting-entry';if(effect.visible){const a=effectGeometry.attributes.position;for(let i=0;i<a.count;i++){const angle=i*2.4;a.setXYZ(i,u.position.x+Math.sin(angle)*(.08+i%4*.06),rare==='ghost'?.10+(age*.035+i%4*.03):1.1-age*.23+i%5*.07,u.position.z+Math.cos(angle)*.2);}a.needsUpdate=true;effect.material.opacity=(rare==='ghost'?.44:.3)*(1-age/2.8);}}
  root.visible=!!mode&&u.phase!=='waiting-entry';if(mode){
   const side=mode==='left'||mode==='carry'||u.letter?'left':'right',heading=u.heading||0;currentHand=side;
   if(mode==='carry'){
    const pos=avatar.root.position,target=new T.Vector3(pos.x+Math.sin(heading)*.19,pos.y+.58,pos.z+Math.cos(heading)*.19),left=target.clone().add(new T.Vector3(Math.cos(heading)*.055,-.02,-Math.sin(heading)*.055));
    const right=target.clone().add(new T.Vector3(-Math.cos(heading)*.065,-.02,Math.sin(heading)*.065));avatar.contactPose({left,right:u.letter?null:right});root.position.copy(target);root.rotation.set(0,heading,0);
   }else{if(kind==='umbrella'){const pos=avatar.root.position;avatar.contactPose({left:new T.Vector3(pos.x-Math.cos(heading)*.20+Math.sin(heading)*.13,pos.y+.72,pos.z+Math.sin(heading)*.20+Math.cos(heading)*.13)});}root.position.copy(storyHandPoint(avatar,side));root.rotation.set(0,heading,Math.sin(time*3)*.025*(moving?1:0));if(kind==='cane')root.scale.y=Math.max(.5,(root.position.y-.08)/.57);}
  }
  if(dog){const s=Math.sin(u.heading||0),c=Math.cos(u.heading||0),offsets=[[-.42,-.24],[.42,-.24],[0,-.58]],candidate=offsets.map(([x,z])=>({x:u.position.x+x*c+z*s,z:u.position.z-x*s+z*c})).find(p=>walkable(p.x,p.z))||u.position;dog.root.position.set(candidate.x,.08,candidate.z);dog.root.rotation.y=u.heading||0;dog.root.visible=u.phase!=='waiting-entry';const hand=storyHandPoint(avatar,'left'),collar=dog.root.position.clone().add(new T.Vector3(s*.13,.22,c*.13)),mid=hand.clone().lerp(collar,.5);mid.y-=.07;leash.geometry.setFromPoints([hand,mid,collar]);leash.visible=dog.root.visible;}
 }
 return {update,inspect:()=>({feature,rare,kind,hand:currentHand,position:root.position.toArray(),animal:dog?'shiba':feature==='heldCat'?'cat':null,entranceEffect:!!effect?.visible}),dispose(){for(const animal of animals)animal.dispose();for(const g of geometries)g.dispose();for(const m of materials.values()){m.map?.dispose();m.dispose();}effect?.removeFromParent();leash?.removeFromParent();root.removeFromParent();root.clear();}};
}
