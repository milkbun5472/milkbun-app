import {MAPS} from './world.mjs?v=fg-af76e1a1730b6e25';
// The fixed isometric camera sees the beds through the cottage roof. Reveal their work area
// while tending or inspecting it, including a house district that finishes loading later.
export function makeFlowerbedVisibility(){
 const originals=new WeakMap();
 return {update(state,roots,focus){const site=MAPS.garden.stations.garden,near=p=>p&&Math.hypot(p.x-site.x,p.z-site.z)<2.7;
  const reveal=state.map==='garden'&&(near(state.position)||near(focus));
  for(const root of roots){if(root.userData?.districtId!=='home')continue;let entry=originals.get(root);if(!entry){const materials=new Set(),meshes=[];root.traverse(o=>{if(o.isMesh){meshes.push([o,o.castShadow]);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);}});entry={revealed:false,meshes,materials:[...materials].map(m=>[m,m.opacity,m.transparent,m.depthWrite])};originals.set(root,entry);}
   if(entry.revealed===reveal)continue;entry.revealed=reveal;
   for(const [m,opacity,transparent,depthWrite]of entry.materials){m.opacity=reveal?.12:opacity;m.transparent=reveal||transparent;m.depthWrite=reveal?false:depthWrite;m.needsUpdate=true;}
   for(const [o,shadow]of entry.meshes)o.castShadow=reveal?false:shadow;
  }
 }};
}
