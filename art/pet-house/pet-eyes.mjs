// Eyelids follow the authored, skinned face through rest-position shader masks.
// Closed lids replace iris color, engraved normals and reflective maps together.
// Keep authored geometry/shadows and nose/mouth dye protection intact.
// A small skinned backing seals the export's open eye-rim seams while closed.
// It sits behind the authored eye surface, follows the same head bone, and
// fades out with the lid. No source geometry or open-eye texture is changed.
function dogEyeBacking(mesh){
 const geo=new mesh.geometry.constructor(),p=[],n=[],uv=[],skin=[],weights=[],index=[],head=mesh.skeleton.bones.findIndex(b=>b.name==='head'),segments=48,rings=8;
 for(const sign of [-1,1]){const start=p.length/3;
  for(let ring=0;ring<=rings;ring++)for(let j=0;j<segments;j++){const angle=j/segments*Math.PI*2,r=ring/rings,x=sign*.083+Math.cos(angle)*.067*r,y=.617+Math.sin(angle)*.065*r;p.push(x,y,.420-.70*Math.abs(x));n.push(sign*.23,.03,1);uv.push(0,0);skin.push(head,0,0,0);weights.push(1,0,0,0);}
  for(let ring=0;ring<rings;ring++)for(let j=0;j<segments;j++){const a=start+ring*segments+j,b=start+ring*segments+(j+1)%segments,c=a+segments,d=b+segments;if(ring)index.push(a,c,b);index.push(b,c,d);}
 }
 for(const[name,values]of Object.entries({position:p,normal:n,uv,skinIndex:skin,skinWeight:weights})){const original=mesh.geometry.attributes[name];geo.setAttribute(name,new original.constructor(new original.array.constructor(values),original.itemSize));}geo.setIndex(index);
 const material=mesh.material.clone(),compile=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey();material.transparent=true;material.depthWrite=false;material.onBeforeCompile=shader=>{compile(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=uEyeClosed;\n#include <opaque_fragment>');};material.customProgramCacheKey=()=>key+'-eye-backing';
 const backing=new mesh.constructor(geo,material);backing.name='closed-eye-seams';backing.userData.eyeBacking=true;backing.position.copy(mesh.position);backing.rotation.copy(mesh.rotation);backing.scale.copy(mesh.scale);backing.bind(mesh.skeleton,mesh.bindMatrix);backing.visible=false;mesh.parent.add(backing);return backing;
}
export function createPetEyes(model,species){
 const dog=species==='dog',closed={value:0},backings=[];
 model.traverse(o=>{if(!o.isMesh||o.userData?.eyeBacking)return;const before=o.material.onBeforeCompile,key=o.material.customProgramCacheKey;
  o.material.onBeforeCompile=shader=>{before(shader);shader.uniforms.uEyeClosed=closed;
   const eyeMask=`vec2 lidP=vec2((abs(position.x)-${dog?'.083':'.110'})/${dog?'.070':'.078'},(position.y-${dog?'.617':'.518'})/${dog?'.067':'.077'});float lidCover=(1.-smoothstep(1.,1.32,length(lidP)))*smoothstep(${dog?'.27,.32':'.30,.345'},position.z)*${dog?'(1.-smoothstep(.465,.480,position.z))*':''}uEyeClosed;`;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;').replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\n${eyeMask}\nobjectNormal=normalize(mix(objectNormal,vec3(sign(position.x)*.23,.03,1.),lidCover));`).replace('#include <begin_vertex>',`#include <begin_vertex>\nvEyeRest=position;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;').replace('#include <color_fragment>',`#include <color_fragment>
    vec2 ep=vec2((abs(vEyeRest.x)-${dog?'.083':'.110'})/${dog?'.070':'.078'},(vEyeRest.y-${dog?'.617':'.518'})/${dog?'.067':'.077'});
    float face=smoothstep(${dog?'.27,.32':'.30,.345'},vEyeRest.z)${dog?'*(1.-smoothstep(.465,.480,vEyeRest.z))':''};
    float cover=(1.-smoothstep(1.04,1.30,length(ep)))*face*uEyeClosed;
    float crease=exp(-pow((ep.y-(-.17+.24*ep.x*ep.x))/${dog?'.065':'.080'},2.))*(1.-smoothstep(${dog?'.49,.68':'.75,.94'},abs(ep.x)));
    vec3 lid=mix(uFurBase,uBaseRef,uFurOriginal)*(1.-.065*(1.-ep.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(lid,vec3(.065,.038,.022),crease*.98),cover);
   `).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,nonPerturbedNormal,cover));').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,1.,cover);').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,cover);');
  };o.material.customProgramCacheKey=()=>key()+'-rest-eyelids-'+(dog?'v4':'v3')+'-'+species;o.material.needsUpdate=true;if(dog&&o.isSkinnedMesh)backings.push(dogEyeBacking(o));
 });
 return {update(lie,time){const phase=(time%6.7),blink=phase>6.48?Math.sin((phase-6.48)/.22*Math.PI)**2:0;closed.value=Math.max(lie,blink);backings.forEach(o=>o.visible=closed.value>.001);},get closed(){return closed.value;}};
}
