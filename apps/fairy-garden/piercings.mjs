// Attachment positions use HeadAnchor space, shared by the expression atlases.
import * as T from 'three';

const lipSurface={
 default:[-.774,.863], cozy:[-.789,.851], proud:[-.789,.851],
 gloomy:[-.751,.878], sad:[-.751,.878], irritated:[-.751,.878],
 amazed:[-.896,.731], happy:[-.896,.731], relax:[-.889,.744], surprise:[-.881,.756]
};

const earSites={
 leftEar:[.972,-.644,.037],leftEarMid:[1.133,-.560,-.036],leftEarUpper:[1.178,-.369,-.057],
 rightEar:[-1.015,-.644,.069],rightEarMid:[-1.175,-.560,.010],rightEarUpper:[-1.213,-.369,-.004]
};

export function createPiercings(anchor){
 const mounts=new Map();
 const bead=new T.SphereGeometry(1,16,12),hoop=new T.TorusGeometry(.073,.016,10,32);
 const charms=new Map();
 function charm(style){
  if(charms.has(style))return charms.get(style);
  const shape=new T.Shape();
  if(style==='star'){
   shape.moveTo(0,.068);
   for(const [x,y] of [[.016,.018],[.052,0],[.016,-.016],[0,-.067],[-.016,-.016],[-.052,0],[-.016,.018]])shape.lineTo(x,y);
  }else if(style==='leaf'){
   shape.moveTo(0,-.034);
   shape.quadraticCurveTo(-.032,-.002,0,.039);
   shape.quadraticCurveTo(.023,.008,0,-.034);
  }else{
   shape.moveTo(.030,.055);
   shape.bezierCurveTo(-.063,.056,-.073,-.065,.031,-.052);
   shape.bezierCurveTo(-.019,-.025,-.019,.025,.030,.055);
  }
  shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:.012,bevelThickness:.005,bevelSize:.004,bevelSegments:3,curveSegments:12});
  charms.set(style,geo);return geo;
 }
 function update(slot,style,color,face){
  let mount=mounts.get(slot);
  if(!mount&&!style)return;
  if(!mount){
   const group=new T.Group(),material=new T.MeshStandardMaterial({metalness:.32,roughness:.34});
   group.name=slot;anchor.add(group);mount={group,material};mounts.set(slot,mount);
  }
  const {group,material}=mount;
  if(style!==mount.style){
   group.clear();mount.style=style;
   const side=slot.startsWith('leftEar')?1:-1;
   const dot=(r,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(bead,material);mesh.position.set(x,y,z);mesh.scale.set(r,r,r*.80);group.add(mesh);
   };
   if(style==='hoop'||style==='drop'||style==='twincuff'){
    const ring=new T.Mesh(hoop,material);
    ring.position.set(side*.010,-.050,-.035);
    ring.rotation.set(-.36,side*1.05,0,'YXZ');
    // At the helix the hoop wraps the outside edge, rather than hanging
    // straight down into the next piercing.
    if(slot.endsWith('Upper')){
     ring.rotateOnWorldAxis(new T.Vector3(0,0,1),side*1.28);
     ring.position.set(side*.046,-.010,-.032);
    }
    group.add(ring);
    if(style==='twincuff'){
     ring.scale.setScalar(side<0?.74:.84);
     // The helix on the viewer's left sits further inside its anchor.
     if(side<0){ring.position.x+=.035;ring.position.z-=.009;}
     ring.position.y+=.018;
     const second=ring.clone();
     second.position.y-=.054;second.position.x+=side*.006;
     group.add(second);
    }
    if(style==='drop'){
     // Find the bottom of the actual rotated hoop in its local plane,
     // so the bead stays suspended even when the ear site tips the hoop.
     const low=new T.Vector3(0,-1,0).applyQuaternion(ring.quaternion.clone().invert());
     low.z=0;low.normalize().multiplyScalar(.073).applyQuaternion(ring.quaternion).add(ring.position);
     dot(.043,low.x,low.y-.044,low.z);
    }
   }
   else if(style==='star'||style==='moon'){
    const face=new T.Mesh(charm(style),material);
    face.rotation.y=side*.30;
    if(style==='moon'&&side<0)face.scale.x=-1;
    group.add(face);
   }else if(style==='laurel'){
    for(let i=0;i<3;i++){
     const leaf=new T.Mesh(charm('leaf'),material);
     leaf.position.set(side*(.014-i*.017),-.052+i*.052,.013+i*.004);
     leaf.rotation.z=side*(i===1?-.64:.62);
     group.add(leaf);
    }
   }else if(style==='pearls'){
    dot(.031,side*.012,-.063,.004);
    dot(.025,0,0,.009);
    dot(.019,-side*.031,.049,.014);
   }else if(style==='pair'){
    dot(.020);dot(.016,-.040,-.005,.005);
   }
   else if(style==='double'){dot(.038);dot(.027,side*.065,.045,-.015);}
   else if(style==='pearl'||style==='stud')dot(slot==='lipStud'?.025:style==='pearl'?.055:.043);
  }
  group.visible=!!style;
  if(!style)return;
  material.color.set(color);material.metalness=style==='pearl'||style==='pearls'||style==='drop'?.08:.32;
  if(slot==='lipStud'){
   const [y,z]=Object.hasOwn(lipSurface,face)?lipSurface[face]:lipSurface.default;
   group.position.set(.086,y-.006,z+.009);
  }else group.position.fromArray(earSites[slot]);
 }
 return {update,dispose(){for(const {group,material} of mounts.values()){group.removeFromParent();material.dispose();}bead.dispose();hoop.dispose();for(const geo of charms.values())geo.dispose();}};
}
