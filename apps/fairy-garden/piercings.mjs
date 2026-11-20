// Attachment positions use HeadAnchor space, shared by the expression atlases.
import * as T from 'three';

const lipSurface={
 default:[-.774,.863], cozy:[-.789,.851], proud:[-.789,.851],
 gloomy:[-.751,.878], sad:[-.751,.878], irritated:[-.751,.878],
 amazed:[-.896,.731], happy:[-.896,.731], relax:[-.889,.744], surprise:[-.881,.756]
};

export function createPiercings(anchor){
 const mounts=new Map();
 const bead=new T.SphereGeometry(1,16,12),hoop=new T.TorusGeometry(.073,.016,10,32);
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
   const dot=(r,x=0,y=0,z=0)=>{
    const mesh=new T.Mesh(bead,material);mesh.position.set(x,y,z);mesh.scale.set(r,r,r*.80);group.add(mesh);
   };
   if(style==='hoop'){
    const ring=new T.Mesh(hoop,material),side=slot==='leftEar'?1:-1;
    // Sink the upper arc into the lobe; the lower arc wraps underneath.
    ring.position.set(side*.010,-.050,-.035);
    ring.rotation.set(-.36,side*1.05,0,'YXZ');
    group.add(ring);
   }
   else if(style==='double'){dot(.038);dot(.027,slot==='leftEar'?.065:-.065,.045,-.015);}
   else if(style==='pearl'||style==='stud')dot(slot==='lipStud'?.025:style==='pearl'?.055:.043);
  }
  group.visible=!!style;
  if(!style)return;
  material.color.set(color);material.metalness=style==='pearl'?.08:.32;
  if(slot==='lipStud'){
   const [y,z]=Object.hasOwn(lipSurface,face)?lipSurface[face]:lipSurface.default;
   group.position.set(.086,y-.006,z+.009);
  }else if(slot==='leftEar')group.position.set(.972,-.644,.037);
  else group.position.set(-1.015,-.644,.069);
 }
 return {update,dispose(){for(const {group,material} of mounts.values()){group.removeFromParent();material.dispose();}bead.dispose();hoop.dispose();}};
}
