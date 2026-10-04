// Eyelids follow the authored, skinned face through rest-position shader masks.
// No floating stickers, extra textures or changes to the eye/nose dye mask.
export function createPetEyes(model,species){
 const dog=species==='dog',closed={value:0};
 model.traverse(o=>{if(!o.isMesh)return;const before=o.material.onBeforeCompile,key=o.material.customProgramCacheKey;
  o.material.onBeforeCompile=shader=>{before(shader);shader.uniforms.uEyeClosed=closed;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEyeRest=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;').replace('#include <color_fragment>',`#include <color_fragment>
    vec2 ep=vec2((abs(vEyeRest.x)-${dog?'.083':'.096'})/${dog?'.070':'.075'},(vEyeRest.y-${dog?'.602':'.541'})/${dog?'.067':'.068'});
    float face= smoothstep(${dog?'.27,.32':'.30,.345'},vEyeRest.z);
    float cover=(1.-smoothstep(.85,1.04,length(ep)))*face*uEyeClosed;
    float crease=exp(-pow((ep.y-(-.17+.24*ep.x*ep.x))/.080,2.))*(1.-smoothstep(.75,.94,abs(ep.x)));
    vec3 lid=mix(uFurBase,uBaseRef,uFurOriginal)*(1.-.065*(1.-ep.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(lid,vec3(.065,.038,.022),crease*.98),cover);
   `);
  };o.material.customProgramCacheKey=()=>key()+'-rest-eyelids-v1';o.material.needsUpdate=true;
 });
 return {update(lie,time){const phase=(time%6.7),blink=phase>6.48?Math.sin((phase-6.48)/.22*Math.PI)**2:0;closed.value=Math.max(lie,blink);},get closed(){return closed.value;}};
}
