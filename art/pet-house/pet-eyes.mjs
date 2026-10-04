// Eyelids follow the authored, skinned face through rest-position shader masks.
// Closed lids replace iris color, engraved normals and reflective maps together.
// Keep authored geometry/shadows and nose/mouth dye protection intact.
export function createPetEyes(model,species){
 const dog=species==='dog',closed={value:0};
 model.traverse(o=>{if(!o.isMesh)return;const before=o.material.onBeforeCompile,key=o.material.customProgramCacheKey;
  o.material.onBeforeCompile=shader=>{before(shader);shader.uniforms.uEyeClosed=closed;
   const eyeMask=`vec2 lidP=vec2((abs(position.x)-${dog?'.083':'.110'})/${dog?'.070':'.078'},(position.y-${dog?'.617':'.518'})/${dog?'.067':'.077'});float lidCover=(1.-smoothstep(1.,1.32,length(lidP)))*smoothstep(${dog?'.27,.32':'.30,.345'},position.z)*${dog?'(1.-smoothstep(.465,.480,position.z))*':''}uEyeClosed;`;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;').replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\n${eyeMask}\nobjectNormal=normalize(mix(objectNormal,vec3(sign(position.x)*.23,.03,1.),lidCover));`).replace('#include <begin_vertex>',`#include <begin_vertex>\nvEyeRest=position;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;').replace('#include <color_fragment>',`#include <color_fragment>
    vec2 ep=vec2((abs(vEyeRest.x)-${dog?'.083':'.110'})/${dog?'.070':'.078'},(vEyeRest.y-${dog?'.617':'.518'})/${dog?'.067':'.077'});
    float face=smoothstep(${dog?'.27,.32':'.30,.345'},vEyeRest.z)${dog?'*(1.-smoothstep(.465,.480,vEyeRest.z))':''};
    float cover=(1.-smoothstep(1.04,1.30,length(ep)))*face*uEyeClosed;
    float crease=exp(-pow((ep.y-(-.17+.24*ep.x*ep.x))/.080,2.))*(1.-smoothstep(.75,.94,abs(ep.x)));
    vec3 lid=mix(uFurBase,uBaseRef,uFurOriginal)*(1.-.065*(1.-ep.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(lid,vec3(.065,.038,.022),crease*.98),cover);
   `).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,cover));').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,1.,cover);').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,cover);');
  };o.material.customProgramCacheKey=()=>key()+'-rest-eyelids-v3-'+species;o.material.needsUpdate=true;
 });
 return {update(lie,time){const phase=(time%6.7),blink=phase>6.48?Math.sin((phase-6.48)/.22*Math.PI)**2:0;closed.value=Math.max(lie,blink);},get closed(){return closed.value;}};
}
