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
export function createCatDye(T,cat,mask,meta){
 mask.flipY=false;mask.colorSpace=T.NoColorSpace;mask.minFilter=T.LinearFilter;mask.magFilter=T.LinearFilter;
 const uniforms={uFurMask:{value:mask},uFurBase:{value:new T.Color()},uFurPatch:{value:new T.Color()},
  uFurOriginal:{value:1},uBaseRef:{value:new T.Color(meta.baseReference)},uPatchRef:{value:new T.Color(meta.patchReference)}};
 cat.traverse(o=>{if(!o.isMesh)return;o.material=o.material.clone();o.material.vertexColors=false;
  o.material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uFurMask;uniform vec3 uFurBase,uFurPatch,uBaseRef,uPatchRef;uniform float uFurOriginal;\nvec3 petFurDye(vec3 color,vec2 uv){vec2 fm=texture2D(uFurMask,uv).rg;vec3 dyed=color*(1.-fm.x-fm.y)+fm.x*color*uFurPatch/max(uPatchRef,vec3(.001))+fm.y*color*uFurBase/max(uBaseRef,vec3(.001));return mix(dyed,color,uFurOriginal);}')
    .replace('#include <map_fragment>',`#include <map_fragment>
    #ifdef USE_MAP
    diffuseColor.rgb=petFurDye(diffuseColor.rgb,vMapUv);
    #endif`);
  };o.material.customProgramCacheKey=()=>'kitten-fur-dye-v3';o.material.needsUpdate=true;
 });
 let look={id:'original',base:null,patch:null};
 function set(value){look=normalizeCatLook(value);uniforms.uFurOriginal.value=look.id==='original'?1:0;
  if(look.id!=='original'){uniforms.uFurBase.value.set(look.base);uniforms.uFurPatch.value.set(look.patch);}return {...look};}
 return {set,snapshot:()=>({...look}),uniforms};
}
