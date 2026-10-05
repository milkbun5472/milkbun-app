// Eyelids follow the authored, skinned face through rest-position shader masks.
// Closed lids replace iris color, engraved normals and reflective maps together.
// Keep authored geometry/shadows and nose/mouth dye protection intact.
// A small skinned backing seals the export's open eye-rim seams while closed.
// It sits behind the authored eye surface, follows the same head bone, and
// fades out with the lid. No source geometry or open-eye texture is changed.
function dogEyeBacking(mesh){
 const geo=new mesh.geometry.constructor(),p=[],n=[],uv=[],skin=[],weights=[],index=[],head=mesh.skeleton.bones.findIndex(b=>b.name==='head'),segments=48,rings=8;
 for(const sign of [-1,1]){const start=p.length/3;
  for(let ring=0;ring<=rings;ring++)for(let j=0;j<segments;j++){const angle=j/segments*Math.PI*2,r=ring/rings,x=sign*.083+Math.cos(angle)*.053*r,y=.600+Math.sin(angle)*.049*r;p.push(x,y,.420-.70*Math.abs(x));n.push(sign*.23,.03,1);uv.push(0,0);skin.push(head,0,0,0);weights.push(1,0,0,0);}
  for(let ring=0;ring<rings;ring++)for(let j=0;j<segments;j++){const a=start+ring*segments+j,b=start+ring*segments+(j+1)%segments,c=a+segments,d=b+segments;if(ring)index.push(a,c,b);index.push(b,c,d);}
 }
 for(const[name,values]of Object.entries({position:p,normal:n,uv,skinIndex:skin,skinWeight:weights})){const original=mesh.geometry.attributes[name];geo.setAttribute(name,new original.constructor(new original.array.constructor(values),original.itemSize));}geo.setIndex(index);
 const material=mesh.material.clone(),compile=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey();material.transparent=true;material.depthWrite=false;material.onBeforeCompile=shader=>{compile(shader);shader.uniforms.uLidBacking.value=1;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=uEyeClosed;\n#include <opaque_fragment>');};material.customProgramCacheKey=()=>key+'-eye-backing';
 const backing=new mesh.constructor(geo,material);backing.name='closed-eye-seams';backing.userData.eyeBacking=true;backing.position.copy(mesh.position);backing.rotation.copy(mesh.rotation);backing.scale.copy(mesh.scale);backing.bind(mesh.skeleton,mesh.bindMatrix);backing.visible=false;mesh.parent.add(backing);return backing;
}
// Read authored brow/cheek colors through the same fur dye path as the body.
function dogFurUV(mesh){
 const refs={lower:[],upper:[]},position=mesh.geometry?.attributes.position,uv=mesh.geometry?.attributes.uv;if(!position||!uv)return {lower:new Float32Array(4),upper:new Float32Array(4)};
 for(const sign of [-1,1])for(const part of ['lower','upper']){const goal=[sign*.088,part==='upper'?.658:.547,.384];let id=0,best=Infinity;for(let i=0;i<position.count;i++){const d=(position.getX(i)-goal[0])**2+(position.getY(i)-goal[1])**2+(position.getZ(i)-goal[2])**2;if(d<best){best=d;id=i;}}refs[part].push(uv.getX(id),uv.getY(id));}return {lower:new Float32Array(refs.lower),upper:new Float32Array(refs.upper)};
}
export function createPetEyes(model,species){
 const dog=species==='dog',closed={value:0},backings=[];
 model.traverse(o=>{if(!o.isMesh||o.userData?.eyeBacking)return;const before=o.material.onBeforeCompile,key=o.material.customProgramCacheKey,refs=dog?dogFurUV(o):null;
  o.material.onBeforeCompile=shader=>{before(shader);shader.uniforms.uEyeClosed=closed;if(dog){shader.uniforms.uLidBacking={value:0};shader.uniforms.uDogLowerUV={value:refs.lower};shader.uniforms.uDogUpperUV={value:refs.upper};}
   const eyeMask=`vec2 lidP=vec2((abs(position.x)-${dog?'.089':'.110'})/${dog?'.053':'.078'},(position.y-${dog?'.600':'.518'})/${dog?'.049':'.077'});float lidCover=(1.-smoothstep(1.,1.32,length(lidP)))*smoothstep(${dog?'.27,.32':'.30,.345'},position.z)*${dog?'(1.-smoothstep(.465,.480,position.z))*':''}uEyeClosed;`;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;'+(dog?'\nvarying vec3 vDogLidNormal;':'')).replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>\n${eyeMask}\n${dog?'':'objectNormal=normalize(mix(objectNormal,vec3(sign(position.x)*.23,.03,1.),lidCover));'}`).replace('#include <begin_vertex>',`#include <begin_vertex>\nvEyeRest=position;`);
   if(dog)shader.vertexShader=shader.vertexShader.replace('#include <skinnormal_vertex>','#include <skinnormal_vertex>\nvDogLidNormal=normalize(normalMatrix*(skinMatrix*vec4(sign(position.x)*.23,.03,1.,0.)).xyz);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vEyeRest;uniform float uEyeClosed;'+(dog?'\nuniform float uLidBacking;uniform vec2 uDogLowerUV[2],uDogUpperUV[2];varying vec3 vDogLidNormal;':'')).replace('#include <color_fragment>',`#include <color_fragment>
    vec2 ep=vec2((abs(vEyeRest.x)-${dog?'.089':'.110'})/${dog?'.053':'.078'},(vEyeRest.y-${dog?'.600':'.518'})/${dog?'.049':'.077'});
    float face=smoothstep(${dog?'.27,.32':'.30,.345'},vEyeRest.z)${dog?'*(1.-smoothstep(.465,.480,vEyeRest.z))':''};
    float cover=(1.-smoothstep(1.04,1.30,length(ep)))*face*uEyeClosed${dog?'*mix(1.-clamp(dot(texture2D(uFurMask,vMapUv).rg,vec2(1.)),0.,1.),1.,uLidBacking)':''};
    float crease=exp(-pow((ep.y-(-.17+.24*ep.x*ep.x))/${dog?'.056':'.080'},2.))*(1.-smoothstep(${dog?'.49,.68':'.75,.94'},abs(ep.x)));
    vec3 lid=${dog?'mix(petFurDye(texture2D(map,mix(uDogLowerUV[0],uDogLowerUV[1],step(0.,vEyeRest.x))).rgb,mix(uDogLowerUV[0],uDogLowerUV[1],step(0.,vEyeRest.x))),petFurDye(texture2D(map,mix(uDogUpperUV[0],uDogUpperUV[1],step(0.,vEyeRest.x))).rgb,mix(uDogUpperUV[0],uDogUpperUV[1],step(0.,vEyeRest.x))),smoothstep(.585,.610,vEyeRest.y))':'mix(uFurBase,uBaseRef,uFurOriginal)*(1.-.065*(1.-ep.y))'};
    diffuseColor.rgb=mix(diffuseColor.rgb,mix(lid,vec3(.065,.038,.022),crease*.98),cover);
   `).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=normalize(mix(normal,'+(dog?'vDogLidNormal':'nonPerturbedNormal')+',cover));').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,1.,cover);').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,cover);');
  };o.material.customProgramCacheKey=()=>key()+'-rest-eyelids-'+(dog?'v6':'v3')+'-'+species;o.material.needsUpdate=true;if(dog&&o.isSkinnedMesh)backings.push(dogEyeBacking(o));
 });
 return {update(lie,time){const phase=(time%6.7),blink=phase>6.48?Math.sin((phase-6.48)/.22*Math.PI)**2:0;closed.value=Math.max(lie,blink);backings.forEach(o=>o.visible=closed.value>.001);},get closed(){return closed.value;}};
}
