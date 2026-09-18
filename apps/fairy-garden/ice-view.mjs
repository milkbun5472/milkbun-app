import * as T from 'three';
import {MAPS,lakeFrozen,onLakeIce} from './world.mjs?v=fg-d0e60d81e8657608';
// One small procedural surface shares the Blender shoreline; no second winter GLB or generated image.
export function makeIceView(){
 const l=MAPS.garden.lake,root=new T.Group();root.name='冬日月湖';root.visible=false;
 const shape=new T.Shape(l.shore.map(p=>new T.Vector2(p.x,-p.z))),hole=new T.Path();hole.absellipse(l.island.x,-l.island.z,l.island.rx,l.island.rz,0,Math.PI*2,true);shape.holes.push(hole);
 const mat=new T.MeshStandardMaterial({color:'#91bfd3',roughness:.32,metalness:.12});
 mat.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 iceUV;').replace('#include <begin_vertex>','#include <begin_vertex>\niceUV=position.xy;');shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 iceUV;').replace('#include <color_fragment>','#include <color_fragment>\nfloat frost=sin(iceUV.x*1.7+sin(iceUV.y*.8))*sin(iceUV.y*2.2+iceUV.x*.5);float grain=fract(sin(dot(iceUV,vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.85,.94,.97),.13+.07*frost+.025*grain);');};
 const sheet=new T.Mesh(new T.ShapeGeometry(shape,12),mat);sheet.rotation.x=-Math.PI/2;sheet.position.y=l.iceHeight;sheet.receiveShadow=true;root.add(sheet);
 // Frosted swirls follow the pond's storybook art; these are decorations, not dangerous cracks.
 const lines=[];for(const [cx,cz,rx,rz]of [[12,5,2,1],[16,-1,2.2,.7],[24,-1,1.4,.8],[10,8,.8,.4]])for(let i=0;i<32;i++){const a=i/32*4.2,b=(i+1)/32*4.2;lines.push(cx+Math.cos(a)*rx,l.iceHeight+.006,cz+Math.sin(a)*rz,cx+Math.cos(b)*rx,l.iceHeight+.006,cz+Math.sin(b)*rz);}
 const frost=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(lines,3)),new T.LineBasicMaterial({color:'#f3faf6',transparent:true,opacity:.32,depthWrite:false}));root.add(frost);
 const cap=120,positions=new Float32Array(cap*6),times=new Float64Array(cap).fill(-100),geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));const tracks=new T.LineSegments(geometry,new T.LineBasicMaterial({color:'#f7ffff',transparent:true,opacity:.44,depthWrite:false}));tracks.frustumCulled=false;root.add(tracks);let cursor=0,last=[null,null],was=false;
 function clear(){positions.fill(0);times.fill(-100);last=[null,null];geometry.attributes.position.needsUpdate=true;}
 return {root,update(s,time,loaded){const frozen=lakeFrozen(s);root.visible=s.map==='garden'&&frozen&&loaded.some(x=>x==='pond'||x==='lake-far');if(!root.visible){if(was)clear();was=false;return;}was=true;
  for(const [i,person]of [s,s.companion].entries()){const p=person.position;if(!onLakeIce(person.map,p,s)){last[i]=null;continue;}const a=last[i],distance=a?Math.hypot(p.x-a.x,p.z-a.z):0;if(!a){last[i]={...p};continue;}if(distance<.16)continue;if(distance<1){const nx=-(p.z-a.z)/distance,nz=(p.x-a.x)/distance;for(const side of [-1,1]){const offset=side*.11;positions.set([a.x+nx*offset,l.iceHeight+.012,a.z+nz*offset,p.x+nx*offset,l.iceHeight+.012,p.z+nz*offset],cursor*6);times[cursor]=time;cursor=(cursor+1)%cap;}}last[i]={...p};}
  for(let i=0;i<cap;i++)if(time-times[i]>9){positions.fill(0,i*6,i*6+6);times[i]=-100;}geometry.attributes.position.needsUpdate=true;
 },inspect:()=>({ice:root.visible,tracks:times.filter(t=>t>-100).length})};
}
