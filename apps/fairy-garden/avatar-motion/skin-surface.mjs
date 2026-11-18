
export function install(q){const T=q.T,o=q.body,m=o.material,old=m.onBeforeCompile,oldKey=m.customProgramCacheKey.bind(m);
// Median of 37 original chest texture samples, kept in the original texture's sRGB space.
// Face/hands/lower body retain their original UV/map.
const base=new T.Color().setRGB(246/255,206/255,184/255,T.SRGBColorSpace);
if(!o.geometry.getAttribute('repairSkin'))throw Error('Hybrid skin mask missing');
m.onBeforeCompile=function(sh,r){old.call(this,sh,r);sh.uniforms.uHybridSkin={value:base};sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float repairSkin;varying float vHybridSkin;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHybridSkin=repairSkin;');sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vHybridSkin;uniform vec3 uHybridSkin;').replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuse*uHybridSkin,vHybridSkin);diffuseColor.a=mix(diffuseColor.a,opacity,vHybridSkin);').replace('#include <normal_fragment_maps>','vec3 baseHybridNormal=normal;\n#include <normal_fragment_maps>\nnormal=normalize(mix(normal,baseHybridNormal,vHybridSkin));').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.85,vHybridSkin);').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,vHybridSkin);');};m.customProgramCacheKey=()=>oldKey()+'-avatar-hybrid-skin';m.needsUpdate=true;
}
