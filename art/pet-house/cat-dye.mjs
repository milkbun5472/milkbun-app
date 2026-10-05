export const CAT_LOOK_KEY='lisa-pet-house-cat-look-v1';
export const CAT_PALETTES=[
 {id:'original',label:'原色',base:null,patch:null},
 {id:'orange',label:'橘白',base:'#f4eee0',patch:'#d5a064'},
 {id:'tea',label:'奶茶',base:'#eee1cb',patch:'#a98565'},
 {id:'tuxedo',label:'黑白',base:'#f2eee6',patch:'#494743'},
 {id:'lilac',label:'浅紫',base:'#eee8ef',patch:'#ada0c0'}
];
const valid=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
export function normalizeCatLook(value){
 if(value?.id==='original')return {id:'original',base:null,patch:null};
 if(valid(value?.base)&&valid(value?.patch))return {id:'custom',base:value.base,patch:value.patch};
 return {id:'original',base:null,patch:null};
}
// The atlas mask's coverage includes an old colour/chroma filter. Keep that
// protection around facial details, while shaded cream fur receives full dye.
// Preserve scalar shading and the authored patch split, replacing its hue.
const furShader=`
uniform sampler2D uFurMask;uniform vec3 uFurBase,uFurPatch,uBaseRef,uPatchRef;
uniform float uFurOriginal,uFurDog;varying vec3 vFurRest;
float furFeature(vec3 p,vec3 center,vec3 radius){return 1.-smoothstep(.70,1.05,dot((p-center)/radius,(p-center)/radius));}
vec3 petFurPalette(vec3 color,vec2 fm,float coverage){
 float covered=clamp(fm.x+fm.y,0.,1.);
 float luminance=dot(color,vec3(.2126,.7152,.0722));
 float baseLight=dot(uBaseRef,vec3(.2126,.7152,.0722));
 float patchLight=dot(uPatchRef,vec3(.2126,.7152,.0722));
 float patchAmount=covered>.01?fm.x/max(covered,.001):1.-smoothstep(patchLight,baseLight,luminance);
 patchAmount=smoothstep(.25,.75,patchAmount);
 float shade=luminance/max(mix(baseLight,patchLight,patchAmount),.001);
 vec3 dyed=mix(uFurBase,uFurPatch,patchAmount)*shade;
 return mix(mix(color,dyed,coverage),color,uFurOriginal);
}
vec3 petFurSample(vec3 color,vec2 uv){return petFurPalette(color,texture2D(uFurMask,uv).rg,1.);}
vec3 petFurDye(vec3 color,vec2 uv){
 vec2 fm=texture2D(uFurMask,uv).rg;float covered=clamp(fm.x+fm.y,0.,1.);
 vec3 p=vec3(abs(vFurRest.x),vFurRest.yz);
 vec2 eyeP=(p.xy-mix(vec2(.110,.518),vec2(.089,.600),uFurDog))/mix(vec2(.063,.062),vec2(.048,.047),uFurDog);
 float eye=(1.-smoothstep(.72,1.10,dot(eyeP,eyeP)))*smoothstep(.30,.345,p.z);
 float nose=furFeature(p,mix(vec3(0.,.425,.455),vec3(0.,.555,.489),uFurDog),mix(vec3(.026,.018,.022),vec3(.058,.029,.038),uFurDog));
 float mouth=uFurDog*furFeature(p,vec3(0.,.490,.445),vec3(.040,.029,.030));
 float pink=smoothstep(.28,.42,(color.r-color.g)/max(color.r,.001));
 float coverage=max(covered,(1.-eye)*(1.-max(nose,mouth))*(1.-pink));
 return petFurPalette(color,fm,coverage);
}`;
export function createCatDye(T,cat,mask,meta,{species='cat'}={}){
 mask.flipY=false;mask.colorSpace=T.NoColorSpace;mask.minFilter=T.LinearFilter;mask.magFilter=T.LinearFilter;
 const uniforms={uFurMask:{value:mask},uFurBase:{value:new T.Color()},uFurPatch:{value:new T.Color()},
  uFurOriginal:{value:1},uFurDog:{value:species==='dog'?1:0},uBaseRef:{value:new T.Color(meta.baseReference)},uPatchRef:{value:new T.Color(meta.patchReference)}};
 cat.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.vertexColors=false;
  o.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vFurRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFurRest=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+furShader)
    .replace('#include <map_fragment>',`#include <map_fragment>
    #ifdef USE_MAP
    diffuseColor.rgb=petFurDye(diffuseColor.rgb,vMapUv);
    #endif`);
  };o.material.customProgramCacheKey=()=>'pet-fur-dye-v4-'+species;o.material.needsUpdate=true;
 });
 let look={id:'original',base:null,patch:null};
 function set(value){look=normalizeCatLook(value);uniforms.uFurOriginal.value=look.id==='original'?1:0;
  if(look.id!=='original'){uniforms.uFurBase.value.set(look.base);uniforms.uFurPatch.value.set(look.patch);}return {...look};}
 return {set,snapshot:()=>({...look}),uniforms};
}
