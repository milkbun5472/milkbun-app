import {attachRegionDye,dyeRegions} from './outfit-dye.mjs?v=fg-8e92d657ad09bbcc';
import {emotionPose} from './emotion-pose.mjs?v=fg-8e92d657ad09bbcc';
import {makeDollLife} from './doll-life.mjs?v=fg-8e92d657ad09bbcc';
import {OUTFITS,mergeLook,outfitId,outfitColors,hairId,hairModeOf,DEFAULT_LOOK,COMPANION_LOOK,DEFAULT_EYE} from './wardrobe.mjs?v=fg-8e92d657ad09bbcc';
import * as T from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js?v=fg-8e92d657ad09bbcc';
import {DRACOLoader} from './vendor/DRACOLoader.js?v=fg-8e92d657ad09bbcc';
// 衣服按需加载（她 2026-09-26）：doll.glb 只有身体、骨架和头发，每套衣服是 outfits/<id>.glb，
// 穿到哪套才下哪套。同一套全页只下一次（下面这张表），每个小人再各克隆一份、按骨头名字接到自己的骨架上。
// 文件由 art/fairy-garden/doll/split_outfits.py 从完整娃娃拆出来；版本指纹跟着本模块自己的 ?v=。
const OUTFIT_FILES=new Map(),OUTFIT_READY=new Map();let outfitLoader=null;
function outfitSource(id){
 if(!OUTFIT_FILES.has(id)){
  if(!outfitLoader){const draco=new DRACOLoader();draco.setDecoderPath(new URL('./vendor/draco/',import.meta.url).href);outfitLoader=new GLTFLoader();outfitLoader.setDRACOLoader(draco);}
  const url=new URL('./outfits/'+id+'.glb'+new URL(import.meta.url).search,import.meta.url).href;
  // 失败了不留在表里：下次换衣服还能重试，不会一次网抖就永远穿不上
  OUTFIT_FILES.set(id,outfitLoader.loadAsync(url).then(g=>(OUTFIT_READY.set(id,g.scene),g.scene),e=>{OUTFIT_FILES.delete(id);throw e;}));
 }
 return OUTFIT_FILES.get(id);
}
// 先把这几套下好：之后新建的小人当场就穿上，不用等（验图脚本、列车同时上好几个人时用）
export const preloadOutfits=(ids=Object.keys(OUTFITS))=>Promise.all(ids.map(outfitSource));
// 头发也按需加载（她 2026-09-27：「以后一直加衣服发型文件太大会不会炸」）：hair/<style>.glb 一款一个文件，
//   头发挂在 HeadAnchor 下（不蒙皮），文件里带着同名的 DollRig/HeadAnchor，接的时候挂到这个人自己的 HeadAnchor 底下。
//   和衣服同一套：全页每款只下一次，失败了不留在表里，下次还能重试。
const HAIR_FILES=new Map(),HAIR_READY=new Map();
function hairSource(id){
 if(!HAIR_FILES.has(id)){
  if(!outfitLoader){const draco=new DRACOLoader();draco.setDecoderPath(new URL('./vendor/draco/',import.meta.url).href);outfitLoader=new GLTFLoader();outfitLoader.setDRACOLoader(draco);}
  const url=new URL('./hair/'+id+'.glb'+new URL(import.meta.url).search,import.meta.url).href;
  HAIR_FILES.set(id,outfitLoader.loadAsync(url).then(g=>(HAIR_READY.set(id,g.scene),g.scene),e=>{HAIR_FILES.delete(id);throw e;}));
 }
 return HAIR_FILES.get(id);
}
export const preloadHair=(ids=HAIR_STYLES)=>Promise.all(ids.map(hairSource));
// 两位旅人共用同一个模型、同一套枢轴与动画规则。
// 模型是 doll.glb：一个身体 ＋ 十二款头发（hair_<style> 各自成网格），每个人只显示一款。
// ⚠️名字里不能带点：GLTFLoader 会把节点名里的点洗掉，hair.korean 到网页里就认不出来了。
// ⚠️不要改回 traveler.glb——那一份是 art/fairy-garden 那套脚本自己的输入（doll_hair.SRC 读它）。
export const HAIR_STYLES=['korean','curtains','airbang','bob','pixie','fluffy','longpart'];
// 体型：六个参数以 1 为中性。形变规则只写在 clay_doll.deform 里，导出成形态键；
// 这儿只把「值 - 1」送进 morphTargetInfluences，和 Blender 那边同一个算法。
// ⚠️不要在这儿再实现一遍形变——那就是同一层活在两处。
const DIMS=['height','shoulder','waist','flare','build','head'];
const DEFAULT=DEFAULT_LOOK,COMPANION=COMPANION_LOOK;
// 发色：材质颜色留白，在着色器里按这根头发自己局部坐标（HeadAnchor 空间，头顶朝 +y、左右是 x）混两种颜色。
// 每个实例的材质各一份（见下面 mine），所以两个人的花样互不影响。
const MODE_NUM={solid:0,gradient:1,split:2,streak:3};
function hairShader(o){const u={uC1:{value:new T.Color()},uC2:{value:new T.Color()},uMode:{value:0},uTop:{value:1},uBot:{value:-1}};
 o.geometry.computeBoundingBox();u.uTop.value=o.geometry.boundingBox.max.y;u.uBot.value=o.geometry.boundingBox.min.y;o.userData.hairDye=u;
 o.material.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHairPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvHairPos=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHairPos;uniform vec3 uC1,uC2;uniform float uMode,uTop,uBot;')
   .replace('#include <color_fragment>',`#include <color_fragment>
   float hk=0.;float hh=uTop-uBot;
   if(uMode>.5&&uMode<1.5)hk=smoothstep(uTop-hh*.30,uBot+hh*.15,vHairPos.y);
   else if(uMode>1.5&&uMode<2.5)hk=smoothstep(-.02,.02,vHairPos.x);
   else if(uMode>2.5)hk=smoothstep(.55,.75,sin(atan(vHairPos.x,vHairPos.z)*7.+vHairPos.y*.8));
   diffuseColor.rgb*=mix(uC1,uC2,hk);`);};
 o.material.customProgramCacheKey=()=>'hairDye';o.material.needsUpdate=true;}
function dyeHair(o,look){const u=o.userData.hairDye;if(!u)return;o.material.color.set('#ffffff');u.uC1.value.set(look.hairColor);u.uC2.value.set(look.hairColor2||look.hairColor);u.uMode.value=MODE_NUM[hairModeOf(look)];}
// 衣服配色（v2）：每个面在 COLOR_0.r 里记着它属于哪一格（0 衣服主色 / 1 衬衫领边 / 2 裤子 / 3 领带点缀），
// 着色器按「选的颜色 ÷ 贴图里这一格原来的颜色」给贴图上色——针织纹、褶子都留着。
const SLOTS=['cloth','trim','bottom','accent'];
function outfitShader(o){const base=o.userData.slotBase||o.parent?.userData?.slotBase;if(!base)return;
 // Blender 会连带导出一层全白的 COLOR_0，格子号可能在 color 也可能在 color_1：挑真有好几种值的那一层
 const pick=['color','color_1','color_2'].find(n=>{const a=o.geometry.attributes[n];if(!a)return false;const seen=new Set();for(let i=0;i<a.count&&seen.size<2;i+=97)seen.add(Math.round(a.getX(i)*8));return seen.size>1;})
  // 底衣那一小块全是同一格：那一层没有「好几种值」，但它也不是 Blender 附带的全白层（值 < 1）
  ||['color_1','color','color_2'].find(n=>{const a=o.geometry.attributes[n];return a&&a.getX(0)<.9;});if(!pick)return;
 // C02's collar edge crosses reduced triangles. Dye its actual texels so a
 // white collar cannot inherit a neighbouring brown dress face's colour slot.
 // C03's dark bag/front strap likewise keep the accessory dye across mixed UV faces.
 const repair=!!o.userData.repairKnit||!!o.userData.repairAtlas,textureSlots=o.userData.textureSlots==='garden',bagSlots=o.userData.textureSlots==='ranger';
 const u={uTint:{value:SLOTS.map(()=>new T.Vector3(1,1,1))}};o.userData.slotDye={u,base};
 // GLTFLoader 看到 COLOR_0 就开 vertexColors，会拿格子号去乘颜色（还会重复声明 color）——这里它只是格子号
 o.material.vertexColors=false;
 o.material.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 '+pick+';varying float vSlot;varying vec3 vOutfitRest;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSlot='+pick+'.r*4.;vOutfitRest=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSlot;varying vec3 vOutfitRest;uniform vec3 uTint[4];')
   .replace('#include <color_fragment>','#include <color_fragment>\n int si=int(clamp(floor(vSlot+.25),0.,3.));'+(textureSlots?'vec3 sc=pow(max(diffuseColor.rgb,vec3(0.)),vec3(1./2.2));float spread=max(sc.r,max(sc.g,sc.b))-min(sc.r,min(sc.g,sc.b));si=(sc.b>.52||(sc.b>.38&&spread<.10))?1:0;':bagSlots?'vec3 sc=pow(max(diffuseColor.rgb,vec3(0.)),vec3(1./2.2));float spread=max(sc.r,max(sc.g,sc.b))-min(sc.r,min(sc.g,sc.b));if(vOutfitRest.y>.35&&vOutfitRest.z>.05&&max(sc.r,max(sc.g,sc.b))<.43&&spread<.16)si=3;':'')+'vec3 tt=si==0?uTint[0]:si==1?uTint[1]:si==2?uTint[2]:uTint[3];diffuseColor.rgb*=tt;');};
 if(repair){
  u.uClothAtlas={value:new T.Vector4().fromArray(o.userData.repairAtlas||[.285,.615,.085,.105])};
  const dyeCompile=o.material.onBeforeCompile;
  o.material.onBeforeCompile=sh=>{
   dyeCompile(sh);
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying float vKnitBlend;varying vec2 vKnitUv;uniform vec4 uClothAtlas;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\nvKnitBlend='+pick+'.g;vKnitUv=vec2(uClothAtlas.x+uClothAtlas.z*clamp((position.z+.15)/.3,0.,1.),1.-(uClothAtlas.y+uClothAtlas.w*clamp((position.y-.43)/.27,0.,1.)));');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vKnitBlend;varying vec2 vKnitUv;')
    .replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb=mix(diffuseColor.rgb,texture2D(map,vKnitUv).rgb*diffuse,clamp(vKnitBlend,0.,1.));\n#endif');
  };
 }
 o.material.customProgramCacheKey=()=>'slotDye'+pick+(repair?'knit':'')+(textureSlots?'textureSlots':bagSlots?'rangerBag':'');attachRegionDye(o,o.material.onBeforeCompile);o.material.needsUpdate=true;}
const _a=new T.Color(),_b=new T.Color();
// Coverage is authored on the outfit in rest coordinates. The same mask is used
// for colour and shadow passes, and each avatar owns its uniform values.
function coveredSkinShader(o){
 const coverage={feet:{value:-1},torso:{value:-1},torsoAbove:{value:-1},sleeve:{value:new T.Vector4(-1,0,0,0)},axis:{value:new T.Vector4(.165,.655,.11,-.255)},eye:{value:new T.Color()},eyeOn:{value:0}};
 if(!o.geometry.getAttribute('skinArmInfluence')){
  const weights=o.geometry.getAttribute('skinWeight'),indices=o.geometry.getAttribute('skinIndex'),values=new Float32Array(o.geometry.getAttribute('position').count);
  if(weights&&indices)for(let i=0;i<values.length;i++)for(let k=0;k<4;k++)if(/(?:Arm|Forearm)$/.test(o.skeleton.bones[indices.getComponent(i,k)]?.name||''))values[i]+=weights.getComponent(i,k);
  o.geometry.setAttribute('skinArmInfluence',new T.BufferAttribute(values,1));
 }
 o.userData.skinCoverageUniforms=coverage;o.userData.coveredFeet=coverage.feet;
 const patch=m=>{m.onBeforeCompile=sh=>{
  // 眼睛颜色：脸贴图的透明通道记着眼珠在哪（art/fairy-garden/doll/eye_mask.py：皮肤 1、眼珠中心 .5）。
  //   直接把这一块换成选的颜色——不乘肤色，不然选的蓝眼睛会跟着肤色变深浅。
  if(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial){sh.uniforms.uEye=coverage.eye;sh.uniforms.uEyeOn=coverage.eyeOn;
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 uEye;uniform float uEyeOn;').replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\ndiffuseColor.rgb=mix(diffuseColor.rgb,uEye,clamp((1.-sampledDiffuseColor.a)*2.,0.,1.)*uEyeOn);diffuseColor.a=1.;\n#endif');}
  sh.uniforms.uCoveredFeet=coverage.feet;sh.uniforms.uCoveredTorso=coverage.torso;sh.uniforms.uCoveredTorsoAbove=coverage.torsoAbove;sh.uniforms.uSleeve=coverage.sleeve;sh.uniforms.uArmAxis=coverage.axis;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSkinRest;attribute float skinArmInfluence;varying float vSkinArm;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSkinRest=position;vSkinArm=skinArmInfluence;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSkinRest;varying float vSkinArm;uniform float uCoveredFeet;uniform float uCoveredTorso;uniform float uCoveredTorsoAbove;uniform vec4 uSleeve;uniform vec4 uArmAxis;')
   .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nfloat sleeveAlong=dot(vec2(abs(vSkinRest.x),vSkinRest.y)-uArmAxis.xy,normalize(uArmAxis.zw));\nif((vSkinRest.y<uCoveredFeet && vSkinArm<.5) || (vSkinRest.y<uCoveredTorso && vSkinRest.y>uCoveredTorsoAbove && vSkinArm<.5) || (uSleeve.x>0. && abs(vSkinRest.x)>uSleeve.w && sleeveAlong<uSleeve.x && vSkinRest.y>uSleeve.y && vSkinRest.y<uSleeve.z)) discard;');
 };m.customProgramCacheKey=()=>'coveredSkin-v3';};
 patch(o.material);
 o.customDepthMaterial=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});patch(o.customDepthMaterial);
 o.customDistanceMaterial=new T.MeshDistanceMaterial();patch(o.customDistanceMaterial);
 o.material.addEventListener('dispose',()=>{o.customDepthMaterial.dispose();o.customDistanceMaterial.dispose();});
}
function dyeOutfit(o,colors){dyeRegions(o,colors);const d=o.userData.slotDye;if(!d)return;SLOTS.forEach((k,i)=>{if(!d.base[k]||!colors[k])return d.u.uTint.value[i].set(1,1,1);_a.set(colors[k]);_b.set(d.base[k]);d.u.uTint.value[i].set(_a.r/Math.max(_b.r,.02),_a.g/Math.max(_b.g,.02),_a.b/Math.max(_b.b,.02));});}
// 表情：同一个身体，换脸上的贴图（faces/<id>.webp，和身体原贴图同一套 UV）。所有小人共用一份贴图缓存。
const FACE_TEX=new Map(),faceLoader=new T.TextureLoader();let FACE_BASE=new URL('./faces/',import.meta.url).href;
// 陪伴（桌宠）用 2K 的脸：换一个目录，缓存跟着清掉
export function setFaceBase(url){FACE_BASE=url;FACE_TEX.clear();}
function faceTexture(id){if(!FACE_TEX.has(id)){const t=faceLoader.load(FACE_BASE+id+'.webp');t.flipY=false;t.colorSpace=T.SRGBColorSpace;FACE_TEX.set(id,t);}return FACE_TEX.get(id);}
const FACE_ID=/^[a-z]{2,16}$/;
export function createTraveler(source,companion=false,look={}){
 const want=Object.assign({},companion?COMPANION:DEFAULT,look||{});
 const style=HAIR_STYLES.includes(hairId(want.hair))?hairId(want.hair):(companion?COMPANION.hair:DEFAULT.hair);
 const root=new T.Group(),model=source.clone(true),rig=[];model.name='TravelerVisual';root.add(model);
 // v2 娃娃是蒙皮网格：clone(true) 复制出来的 SkinnedMesh 还绑着【源模型】的骨头，
 // 不重绑的话两个人共用一副骨架、谁也动不了。按骨头名字在自己这份里重新找一遍。
 // 多材质的网格在 GLTFLoader 里是「一个 Group + 几个子网格」，extras 和名字挂在 Group 上，往下传给子网格。
 const adopt=part=>part.traverse(o=>{if(!o.isMesh)return;const g=o.parent;if(g&&!o.userData.outfit&&!o.userData.hair&&(g.userData.outfit||g.userData.hair)){Object.assign(o.userData,g.userData);o.name=g.name;}
  // ⚠️boneInverses 也要各自一份：Skeleton 收的是【同一个数组】，体型重绑时 calculateInverses 会原地改它，
  //   不复制的话一个人换体型，所有小人的骨架都被改掉（她 2026-09-25：「中间那个大只的也太奇怪了」）。
  //   后下载的衣服也走这里：它带着自己那副同名骨架，一样按名字换成这个人的骨头。
  if(o.isSkinnedMesh)o.bind(new T.Skeleton(o.skeleton.bones.map(b=>model.getObjectByName(b.name)),o.skeleton.boneInverses.map(m=>m.clone())),o.bindMatrix);});
 adopt(model);
 // ⚠️clone(true) 只克隆节点，【材质仍然是同一份】：不给每个实例各一份，
 //   改一个人的发色，另一个人的头发会跟着一起变（美术脚本那头也踩过同一个坑）。
 const isHair=o=>/^hair[._]/i.test(o.name),hairName='hair_'+style;
 const mine=new Map(),coverageByOutfit=new Map();
 const coverOf=part=>part.traverse(o=>{if(!o.userData.outfit)return;const id=o.userData.outfit,c=coverageByOutfit.get(id)||{};
  if(Number.isFinite(o.userData.coversFeetBelow))c.feet=o.userData.coversFeetBelow;
  if(o.userData.skinCoverage)Object.assign(c,o.userData.skinCoverage);coverageByOutfit.set(id,c);
 });
 const prep=part=>part.traverse(o=>{if(!o.isMesh)return;
  // ⚠️藏起来的那十一款头发也要克隆材质：以后 setLook 换到其中一款时它才有自己的一份。
  //   跳过不克隆的话，换完发型两个人共用同一份材质，谁后设色谁说了算（实测两个小人一起变色）。
  if(isHair(o))o.visible=o.name===hairName;
  o.castShadow=true;o.receiveShadow=true;
  if(!mine.has(o.material))mine.set(o.material,o.material.clone());
  o.material=mine.get(o.material);
  if(o.material.name==='Character warm peach')o.userData.skin=true;
  if(o.userData.skinBase){o.userData.bodyMap=o.material.map;coveredSkinShader(o);}
  if(o.userData.outfit)outfitShader(o);
  if(o.name.endsWith('_shoes_sock'))o.userData.colorSlot='socks';
  if(o.name.endsWith('_shoes_detail'))o.userData.colorSlot='boots';
  if(o.userData.colorSlot||o.userData.skin){o.material=o.material.clone();if(!o.userData.dyeTexture)o.material.map=null;o.material.needsUpdate=true;} // Colored source textures would multiply the chosen dye (brown shoes stayed black).
  // 头发的纹理材质进不了 GLB（GLTF 只收基础 PBR），颜色一律在这儿给
  if(isHair(o)){hairShader(o);dyeHair(o,want);o.material.roughness=.85;}
  else if(!o.userData.slotDye&&/Tunic|sleeve/i.test(o.name))o.material.color.set(want.cloth);
 });
 coverOf(model);prep(model);
 // 这个人身上已经有哪几套（旧的整包模型里五套全在；拆开以后一开始一套都没有）
 const worn=new Set();model.traverse(o=>{if(o.userData.outfit)worn.add(o.userData.outfit);});
 const fetching=new Set();let shown=null,dressed=Promise.resolve(),built=false;
 // 把一套衣服接到这个人身上。建人的时候（built 之前）后面自会统一推形态键、收骨架、重绑；
 //   建好以后才到的，要自己补这三步。
 const put=(id,scene)=>{
  const part=scene.clone(true),pieces=[];
  part.traverse(o=>{if(o!==part&&o.userData.outfit&&!o.parent.userData.outfit)pieces.push(o);});
  // 挂回同名的父节点（DollRig）：和整包模型里一模一样的位置
  for(const o of pieces)(model.getObjectByName(o.parent.name)||model).add(o);
  for(const o of pieces){adopt(o);coverOf(o);prep(o);}worn.add(id);
  if(built){for(const o of pieces)o.traverse(m=>{if(m.isSkinnedMesh)skinned.push(m);});applyDims(want.dims);rebindBones(want.dims);}
 };
 // 头发：接到这个人自己的 HeadAnchor 下（HeadAnchor 会跟着头身比缩放，头发跟着走）
 const hairOn=new Set(),hairFetching=new Set();let hairShown=null,combed=Promise.resolve();
 const anchorOf=()=>model.getObjectByName('HeadAnchor')||model;
 const putHair=(id,scene)=>{const part=scene.clone(true),pieces=[];
  part.traverse(o=>{if(o!==part&&o.userData.hair&&!o.parent.userData.hair)pieces.push(o);});
  for(const o of pieces){anchorOf().add(o);adopt(o);prep(o);o.traverse(m=>{if(m.isMesh&&isHair(m))dyeHair(m,want);});}hairOn.add(id);};
 const comb=look=>{const id=HAIR_STYLES.includes(hairId(look.hair))?hairId(look.hair):style;
  if(!hairOn.has(id)){if(HAIR_READY.has(id))putHair(id,HAIR_READY.get(id));
   else if(!hairFetching.has(id)){hairFetching.add(id);combed=hairSource(id).then(scene=>{if(!hairOn.has(id))putHair(id,scene);comb(want);},e=>console.warn('hair',id,e)).finally(()=>{hairFetching.delete(id);reveal();});}}
  const on=hairOn.has(id)?id:hairShown;hairShown=on;
  model.traverse(o=>{if(o.isMesh&&isHair(o))o.visible=o.name==='hair_'+on;});reveal();};
 const wear=id=>{if(worn.has(id))return;if(OUTFIT_READY.has(id))return put(id,OUTFIT_READY.get(id));if(fetching.has(id))return;fetching.add(id);
  dressed=outfitSource(id).then(scene=>{if(!worn.has(id)){put(id,scene);dress(want);}},
   e=>{console.warn('outfit',id,e);if(!shown)model.visible=true;}).finally(()=>fetching.delete(id));};
 // 要穿的那套还在路上：先照旧穿着上一套（第一次还没有任何一套时整个人先不露面，免得闪一下光身子），
 //   到了再穿；这期间又换了别的，以到货时最新的 want 为准。
 // 第一次：衣服和头发都到了才露面（免得闪一下光身子或秃头）；到不了（下载失败）也照样露面，别让人整个消失
 const reveal=()=>{const outfitOk=!!shown||!fetching.size,hairOk=typeof hairShown==='undefined'||!!hairShown||!hairFetching.size;model.visible=outfitOk&&hairOk;};
 const dress=look=>{const id=outfitId(look),colors=outfitColors(look);model.userData.outfit=id;
  wear(id);const on=worn.has(id)?id:shown;shown=on;reveal();
  model.traverse(o=>{if(!o.isMesh)return;
   const covered=o.userData.skinCoverageUniforms;if(covered){const c=coverageByOutfit.get(on)||{};covered.feet.value=Math.max(c.feet??-1,OUTFITS[on]?.coveredLegsBelow??-1);covered.torso.value=c.torsoBelow??-1;covered.torsoAbove.value=c.torsoAbove??-1;covered.sleeve.value.fromArray(c.sleeve||[-1,0,0,0]);covered.axis.value.fromArray(c.armAxis||[.165,.655,.11,-.255]);}
   if(o.userData.skin)o.material.color.set(look.skin);
  // v2 身体：肤色＝选的颜色 ÷ 贴图自己的肤色（脸上的眼睛腮红跟着一起变深浅，不会被抹掉）；表情换贴图
  if(o.userData.skinBase){_a.set(look.skin||o.userData.skinBase);_b.set(o.userData.skinBase);o.material.color.setRGB(_a.r/_b.r,_a.g/_b.g,_a.b/_b.b);
   const eye=/^#[0-9a-fA-F]{6}$/.test(look.eye||'')&&look.eye.toLowerCase()!==DEFAULT_EYE?look.eye:null,cov=o.userData.skinCoverageUniforms;
   if(cov){cov.eyeOn.value=eye?1:0;if(eye)cov.eye.value.set(eye);}
   // 换了眼睛颜色时默认脸也走 faces/default.webp：模型自带那张贴图没有眼珠遮罩
   const face=FACE_ID.test(look.face||'')&&(look.face!=='default'||eye)?faceTexture(look.face||'default'):eye?faceTexture('default'):o.userData.bodyMap;if(o.material.map!==face){o.material.map=face;o.material.needsUpdate=true;}}
  if(o.userData.slotDye&&o.userData.outfit===id)dyeOutfit(o,colors);if(o.userData.outfit)o.visible=o.userData.outfit===on;if(o.userData.colorSlot&&o.userData.outfit===id)o.material.color.set(colors[o.userData.colorSlot]);});};
 dress(want);comb(want);
 const applyDims=dims=>{dims=dims||{};model.traverse(o=>{if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
   for(const key of DIMS){const i=o.morphTargetDictionary[key];if(i==null)continue;const v=Number(dims[key]);o.morphTargetInfluences[i]=isFinite(v)?v-1:0;}});};
 applyDims(want.dims);
 model.updateMatrixWorld(true);
 let authoredRig,rigMorphs,elbowRig;model.traverse(o=>{if(o.userData.dollRig){authoredRig=o.userData.dollRig;rigMorphs=o.userData.rigMorphs;elbowRig=o.userData.elbowRig;}});
 const pivotFor=(label,fallback)=>authoredRig?.[label]?new T.Vector3(...authoredRig[label]):fallback;
 // 当前模型自带枢轴和形变位移；数值后备只供旧模型缓存切换期间使用。
 // v2 娃娃带骨架（骨头名＝枢轴名）：枢轴组照旧建、动画照旧转它，每帧末尾把它的转角抄给同名骨头（syncBones）。
 //   手没有单独的网格，握点挂在前臂骨头上；旧缓存模型仍挂上臂。拿道具前先同步当前姿态。
 const HAND={leftArm:elbowRig?.hands?.left||[-.275,.40,0],rightArm:elbowRig?.hands?.right||[.275,.40,0]};
 function part(label,match,pivot){const p=new T.Group();p.name=label;p.position.copy(pivotFor(label,pivot));model.add(p);model.updateMatrixWorld(true);
  const bone=model.getObjectByName(label);if(bone?.isBone){p.userData.bone=bone;p.userData.rest=bone.quaternion.clone();
   if(HAND[label]){const forearm=model.getObjectByName(label.replace('Arm','Forearm'));if(elbowRig&&forearm?.isBone){p.userData.forearm=forearm;p.userData.forearmRest=forearm.quaternion.clone();}
    const hand=new T.Mesh(new T.BoxGeometry(.05,.05,.05));hand.visible=false;hand.userData.followBone=true;hand.name=(label==='leftArm'?'Left':'Right')+'_hand';model.updateMatrixWorld(true);const wp=model.localToWorld(new T.Vector3().fromArray(HAND[label]));const carrier=p.userData.forearm||bone;carrier.add(hand);hand.position.copy(carrier.worldToLocal(wp));}}   // 挂在骨头上：拿着的东西跟着真正的手走（抬手被压过角度也对得上）
  const picked=[];model.traverse(o=>{if(o.isMesh&&!o.userData.followBone&&(match.test(o.name)||o.userData.rigPart===label))picked.push(o);});picked.forEach(o=>p.attach(o));rig.push({p,label});}
 part('leftArm',/Left.sleeve|Left.hand/i,new T.Vector3(-.19,.935,0));part('rightArm',/Right.sleeve|Right.hand|Held.herb/i,new T.Vector3(.19,.935,0));
 // Exported doll parts have baked vertices and identical object origins (0,0,0).
 // Classify the actual mesh centre in model space, not the object's translation.
 const legs=[];model.traverse(o=>{if(o.isMesh&&/Linen.leggings|Rounded.boots/i.test(o.name)){
  const centre=new T.Box3().setFromObject(o,true).getCenter(new T.Vector3());
  legs.push({mesh:o,side:Math.sign(model.worldToLocal(centre).x)});
 }});
 for(const side of [-1,1]){const p=new T.Group(),label=side<0?'leftLeg':'rightLeg';p.name=label;p.position.copy(pivotFor(label,new T.Vector3(side*.115,.555,0)));model.add(p);model.updateMatrixWorld(true);
  {const bone=model.getObjectByName(label);if(bone?.isBone){p.userData.bone=bone;p.userData.rest=bone.quaternion.clone();}}
  for(const item of legs)if(item.side===side)p.attach(item.mesh);
  rig.push({p,label});}
 // v2：体型滑杆除了推形态键，还要把骨头（和 HeadAnchor）挪到新位置、在静止姿势下重新绑一次，
 // 否则手臂会绕着旧肩膀转。rigMorphs[label][key] 是滑杆＋1 时的位移，HeadAnchor 另有 scale（头身比）。
 const skinned=[];model.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o);});
 const anchor=model.getObjectByName('HeadAnchor'),boneBind=new Map();
 if(skinned.length){for(const b of skinned[0].skeleton.bones)boneBind.set(b,b.position.clone());if(anchor)boneBind.set(anchor,anchor.position.clone()),anchor.userData.bindScale=anchor.scale.clone();}
 const rebindBones=dims=>{if(!rigMorphs||!skinned.length)return;
  // Bind in the authored standing frame, even when a look change arrives mid-gesture.
  const poseObjects=[root,model,...rig.map(({p})=>p)],transforms=poseObjects.map(o=>[o.position.clone(),o.quaternion.clone()]);
  poseObjects.forEach((o,i)=>{if(i<2)o.position.set(0,0,0);o.quaternion.identity();});
  for(const [obj,pos] of boneBind){const next=pos.clone(),m=rigMorphs[obj.name]||{};
   for(const key of DIMS){const delta=Number(dims?.[key]??1)-1;if(Number.isFinite(delta)&&m[key])next.addScaledVector(new T.Vector3(...m[key]),delta);}obj.position.copy(next);
   if(obj===anchor){const hd=Number(dims?.head??1)-1;obj.scale.copy(anchor.userData.bindScale).multiplyScalar(1+(Number.isFinite(hd)?hd:0)*(m.scale?.head||0));}}
  const driven=rig.flatMap(({p})=>[[p.userData.bone,p.userData.rest],[p.userData.forearm,p.userData.forearmRest]]).filter(([b])=>b);
  const saved=driven.map(([b])=>[b,b.quaternion.clone()]);
  for(const [b,rest]of driven)b.quaternion.copy(rest);
  root.updateWorldMatrix(true,true);for(const m of skinned)m.bind(m.skeleton);for(const [b,q]of saved)b.quaternion.copy(q);poseObjects.forEach((o,i)=>{o.position.copy(transforms[i][0]);o.quaternion.copy(transforms[i][1]);});root.updateWorldMatrix(true,true);};
 const fitRig=dims=>{rebindBones(dims);if(!rigMorphs)return;for(const {p,label}of rig){const next=new T.Vector3(...authoredRig[label]);for(const key of DIMS){const delta=Number(dims?.[key]??1)-1;if(Number.isFinite(delta)&&rigMorphs[label]?.[key])next.addScaledVector(new T.Vector3(...rigMorphs[label][key]),delta);}const shift=next.clone().sub(p.position);p.position.copy(next);for(const child of p.children)if(!child.userData.follow)child.position.sub(shift);}};
 fitRig(want.dims);
 // Skate blades are shared by both avatars, attached to the same leg rig as their boots.
 const skateParts=[],bladeGeo=new T.BoxGeometry(.032,.055,.34),bladeMat=new T.MeshStandardMaterial({color:'#b9d3df',metalness:.65,roughness:.25});
 for(const {p,label}of rig)if(label.includes('Leg')){const blade=new T.Mesh(bladeGeo,bladeMat);blade.name='IceBlade';blade.position.set(0,-p.position.y+.015,.025);p.add(blade);skateParts.push(blade);}
 const prop=new T.Group();root.add(prop);prop.visible=false;
 const pages=new T.Mesh(new T.BoxGeometry(.30,.045,.21),new T.MeshStandardMaterial({color:'#ede4c5',roughness:1}));prop.add(pages);const cover=new T.Mesh(new T.BoxGeometry(.32,.025,.23),new T.MeshStandardMaterial({color:'#6f877d',roughness:1}));cover.position.y=-.027;prop.add(cover);prop.position.set(0,.845,.22);prop.rotation.x=.35;
 const life=makeDollLife(root,model,rig,prop,()=>syncBones());
 // Ordinary actions keep the authored elbow at rest. The companion chin pose
 // alone bends it and follows the current head anchor.
 const _q=new T.Quaternion();
 const chinPart=rig.find(r=>r.label==='rightArm')?.p,chinUpper=chinPart?.userData.bone,chinLower=chinPart?.userData.forearm;
 const chinHand=model.getObjectByName('Right_hand'),chinHead=model.getObjectByName('HeadAnchor');
 let poseBlend=1,armPose=null;const poseFrom=new Map();
 const smoothBone=b=>{const from=poseFrom.get(b);if(from){_q.copy(b.quaternion);b.quaternion.copy(from).slerp(_q,poseBlend);}};
 const syncBones=()=>{for(const {p,label}of rig){const b=p.userData.bone;if(!b)continue;
  b.quaternion.copy(p.quaternion).multiply(p.userData.rest);
  if(label.includes('Arm')){
   const forearm=p.userData.forearm;
   if(forearm){
    forearm.quaternion.copy(p.userData.forearmRest);
    const bend=armPose?.[label==='leftArm'?'leftElbow':'rightElbow'];
    if(bend)forearm.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),bend));
   }
  }
 }
 // 托腮只在这个动作里弯肘；目标随头身比和肩宽走，其他动作保持原整臂旋转。
 if(armPose?.chinHold){
  const upper=chinUpper,lower=chinLower,hand=chinHand,head=chinHead;
  if(upper&&lower&&hand&&head){
   root.updateWorldMatrix(true,true);
   const target=head.localToWorld(new T.Vector3(0,-.47,.64));
   target.lerp(hand.getWorldPosition(new T.Vector3()),1-armPose.chinHold);
   for(let i=0;i<16;i++)for(const bone of [lower,upper]){
    const origin=bone.getWorldPosition(new T.Vector3());
    const from=hand.getWorldPosition(new T.Vector3()).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
    const parent=bone.parent.getWorldQuaternion(new T.Quaternion());
    const delta=new T.Quaternion().setFromUnitVectors(from,to);
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent));
   }
  }
 }
 for(const {p,label}of rig)if(label.includes('Arm'))for(const b of [p.userData.bone,p.userData.forearm])if(b)smoothBone(b);
 };
 let sitBlend=0,lastPoseTime=null;built=true;
 return {root,handPoint:life.handPoint,
  // 身上这套衣服到了没有（按需加载）：验图脚本等它再截图
  ready:()=>Promise.all([dressed,combed]),
  // reset=true：整份换掉而不是叠在上一身上（陪伴换角色时用——她 2026-09-27「改了 a 换成 b 还是一样的外貌」：
  //   b 没设过的发色／肤色／衣服／眼睛原来会一直留着 a 的）。庭院、列车仍是叠改动。
  setLook(next,reset=false){const n=mergeLook(reset?Object.assign({},companion?COMPANION:DEFAULT):want,next||{});
   model.traverse(o=>{if(!o.isMesh)return;if(isHair(o))dyeHair(o,n);else if(!o.userData.slotDye&&/Tunic|sleeve/i.test(o.name))o.material.color.set(n.cloth);});
   dress(n);comb(n);if(DIMS.some(key=>Number(n.dims?.[key]??1)!==Number(want.dims?.[key]??1))){applyDims(n.dims);fitRig(n.dims);}
   if(reset)for(const k of Object.keys(want))if(!(k in n))delete want[k];
   Object.assign(want,n);},
  animate(time,{moving=false,skating=false,gesture='rest',height=.08,sleepPose=null,seated=false,progress=0,emotion=null}={}){armPose=null;const lying=!!sleepPose;skating=skating&&!lying&&gesture!=='sit';skateParts.forEach(b=>b.visible=skating);root.userData.posture=lying?'sleep':skating?'skate':gesture;model.rotation.x=lying?-Math.PI/2:skating&&moving?.07:0;model.rotation.z=skating&&moving?Math.sin(time*3.2)*.035:0;model.position.set(lying?sleepPose.x-root.position.x:0,0,lying?sleepPose.z-root.position.z:0);if(lying){root.rotation.y=0;height=sleepPose.y;gesture='sleep';moving=false;model.rotation.y=sleepPose.hug?sleepPose.toward*.45:0;}else model.rotation.y=0;seated=!moving&&!lying&&(seated||gesture==='sit');const dt=lastPoseTime==null?.1:Math.min(.1,Math.max(0,time-lastPoseTime));poseBlend=lastPoseTime==null?1:1-Math.exp(-dt*14);lastPoseTime=time;for(const {p,label}of rig)if(label.includes('Arm'))for(const b of [p.userData.bone,p.userData.forearm])if(b)poseFrom.set(b,b.quaternion.clone());sitBlend+=(Number(seated)-sitBlend)*Math.min(1,dt*9);model.traverse(o=>{const i=o.morphTargetDictionary?.seated;if(i!=null)o.morphTargetInfluences[i]=sitBlend;});root.position.y=height-sitBlend*.34+(skating?.035:moving?Math.abs(Math.sin(time*10))*.025:Math.sin(time*2)*.004);prop.visible=!moving&&gesture==='read';for(const {p,label}of rig){const side=label.startsWith('left')?1:-1;p.rotation.z=skating?(label.includes('Arm')?side*.3:Math.sin(time*3.2)*.085*side):0;p.rotation.y=skating&&moving&&label.includes('Leg')?Math.sin(time*3.2)*.16*side:0;const hugging=lying&&sleepPose.hug,reaching=hugging&&sleepPose.hugArm,inner=sleepPose?.toward>0?'leftArm':'rightArm';const standing=lying?(reaching&&label===inner?-1.05:0):skating?(label.includes('Leg')?(moving?Math.sin(time*3.2)*.17*side:0):-.15):moving?Math.sin(time*10)*.45*side*(label.includes('Leg')?-1:1):gesture==='read'&&label.includes('Arm')?-.75:gesture!=='rest'&&label==='rightArm'?-.65+Math.sin(time*7)*.12:Math.sin(time*2)*.015;if(reaching&&label===inner)p.rotation.z=side*.72;else if(hugging)p.rotation.z=0;p.rotation.x=standing*(1-sitBlend)+(label.includes('Leg')?-Math.PI/2:-.28)*sitBlend;if(!moving&&!lying&&label==='rightArm'){if(gesture==='stir'){p.rotation.x=-1.05+Math.sin(time*2.5)*.12;p.rotation.z=Math.cos(time*2.5)*.2;}else if(gesture==='hold')p.rotation.x=-1.3;}}life.update(time,{gesture:lying?'sleep':gesture,progress,moving,seated,height});
  root.userData.emotion=null;armPose=null;
  if(emotion&&!moving&&!lying&&!seated&&gesture==='rest'){
   root.userData.emotion=emotion;const pose=emotionPose(emotion,progress);armPose=pose;
   for(const {p,label} of rig){const a=label==='leftArm'?pose.left:label==='rightArm'?pose.right:null;if(a)p.rotation.set(...a);}
   model.rotation.x=pose.tilt;model.rotation.z=pose.roll;model.rotation.y=pose.yaw;root.position.y+=pose.lift;
  }
  syncBones();}};
}

// Scene callers share the compressed doll and decoder lifecycle.
let travelerSource;
export function loadTravelerSource(){
 if(!travelerSource)travelerSource=(async()=>{const draco=new DRACOLoader();draco.setDecoderPath(new URL('./vendor/draco/',import.meta.url).href);const loader=new GLTFLoader();loader.setDRACOLoader(draco);try{return(await loader.loadAsync(new URL('./doll.glb?v=fg-8e92d657ad09bbcc'+new URL(import.meta.url).search,import.meta.url).href)).scene;}finally{draco.dispose();}})().catch(e=>{travelerSource=null;throw e;});
 return travelerSource;
}
