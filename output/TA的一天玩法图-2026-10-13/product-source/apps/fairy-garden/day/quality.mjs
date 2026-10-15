export const QUALITY_LEVELS={
 high:{label:'细腻',pixelRatio:1.7,homeShadow:2048,shadow:1024,particles:200,smallShadows:true},
 balanced:{label:'平衡',pixelRatio:1.25,homeShadow:1024,shadow:768,particles:120,smallShadows:false},
 light:{label:'轻盈',pixelRatio:1,homeShadow:512,shadow:512,particles:64,smallShadows:false}
};
export function sceneLoad(root){let triangles=0,meshes=0;root?.traverse(o=>{if(o.isMesh){meshes+=Array.isArray(o.material)?o.material.length:1;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}});return {triangles,meshes,furniture:root?.userData.furniture?.length||root?.userData.layout?.furniture?.length||0};}
export function qualityFor(load={}){
 if(load.triangles>650000||load.meshes>450||load.furniture>90)return 'light';
 if(load.triangles>320000||load.meshes>240||load.furniture>55)return 'balanced';
 return 'high';
}
export function createQualityMonitor(){
 let base='high',level='high',slow=0,fast=0;
 const rank={high:0,balanced:1,light:2},names=Object.keys(rank);
 function reset(load){base=qualityFor(load);level=base;slow=fast=0;return level;}
 function observe(seconds,active=true){
  if(!active||!Number.isFinite(seconds)||seconds<=0||seconds>.25){slow=fast=0;return level;}
  if(seconds>.034){slow+=seconds;fast=0;}else if(seconds<.023){fast+=seconds;slow=Math.max(0,slow-seconds);}else{slow=Math.max(0,slow-seconds*.5);fast=0;}
  if(slow>4&&rank[level]<2){level=names[rank[level]+1];slow=fast=0;}
  if(fast>15&&rank[level]>rank[base]){level=names[rank[level]-1];slow=fast=0;}
  return level;
 }
 return {reset,observe,inspect:()=>({base,level,slow,fast})};
}
