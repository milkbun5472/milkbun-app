import {makeDollLife} from './doll-life.mjs?v=fg-a9d19360c953cb4a';
import {mergeLook,outfitId,outfitColors,hairId,hairModeOf,DEFAULT_LOOK,COMPANION_LOOK} from './wardrobe.mjs?v=fg-a9d19360c953cb4a';
import * as T from 'three';
// 两位旅人共用同一个模型、同一套枢轴与动画规则。
// 模型是 doll.glb：一个身体 ＋ 十二款头发（hair_<style> 各自成网格），每个人只显示一款。
// ⚠️名字里不能带点：GLTFLoader 会把节点名里的点洗掉，hair.korean 到网页里就认不出来了。
// ⚠️不要改回 traveler.glb——那一份是 art/fairy-garden 那套脚本自己的输入（doll_hair.SRC 读它）。
export const HAIR_STYLES=['korean','curtains','airbang','bob','pixie'];
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
 const u={uTint:{value:SLOTS.map(()=>new T.Vector3(1,1,1))}};o.userData.slotDye={u,base};
 // GLTFLoader 看到 COLOR_0 就开 vertexColors，会拿格子号去乘颜色（还会重复声明 color）——这里它只是格子号
 o.material.vertexColors=false;
 o.material.onBeforeCompile=sh=>{Object.assign(sh.uniforms,u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 '+pick+';varying float vSlot;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSlot='+pick+'.r*4.;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vSlot;uniform vec3 uTint[4];')
   .replace('#include <color_fragment>','#include <color_fragment>\n int si=int(clamp(floor(vSlot+.25),0.,3.));vec3 tt=si==0?uTint[0]:si==1?uTint[1]:si==2?uTint[2]:uTint[3];diffuseColor.rgb*=tt;');};
 o.material.customProgramCacheKey=()=>'slotDye'+pick;o.material.needsUpdate=true;}
const _a=new T.Color(),_b=new T.Color();
function dyeOutfit(o,colors){const d=o.userData.slotDye;if(!d)return;SLOTS.forEach((k,i)=>{if(!d.base[k]||!colors[k])return d.u.uTint.value[i].set(1,1,1);_a.set(colors[k]);_b.set(d.base[k]);d.u.uTint.value[i].set(_a.r/Math.max(_b.r,.02),_a.g/Math.max(_b.g,.02),_a.b/Math.max(_b.b,.02));});}
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
 model.traverse(o=>{if(!o.isMesh)return;const g=o.parent;if(g&&!o.userData.outfit&&!o.userData.hair&&(g.userData.outfit||g.userData.hair)){Object.assign(o.userData,g.userData);o.name=g.name;}
  // ⚠️boneInverses 也要各自一份：Skeleton 收的是【同一个数组】，体型重绑时 calculateInverses 会原地改它，
  //   不复制的话一个人换体型，所有小人的骨架都被改掉（她 2026-09-25：「中间那个大只的也太奇怪了」）。
  if(o.isSkinnedMesh)o.bind(new T.Skeleton(o.skeleton.bones.map(b=>model.getObjectByName(b.name)),o.skeleton.boneInverses.map(m=>m.clone())),o.bindMatrix);});
 // ⚠️clone(true) 只克隆节点，【材质仍然是同一份】：不给每个实例各一份，
 //   改一个人的发色，另一个人的头发会跟着一起变（美术脚本那头也踩过同一个坑）。
 const isHair=o=>/^hair[._]/i.test(o.name),hairName='hair_'+style;
 const mine=new Map();
 model.traverse(o=>{if(!o.isMesh)return;
  // ⚠️藏起来的那十一款头发也要克隆材质：以后 setLook 换到其中一款时它才有自己的一份。
  //   跳过不克隆的话，换完发型两个人共用同一份材质，谁后设色谁说了算（实测两个小人一起变色）。
  if(isHair(o))o.visible=o.name===hairName;
  o.castShadow=true;o.receiveShadow=true;
  if(!mine.has(o.material))mine.set(o.material,o.material.clone());
  o.material=mine.get(o.material);
  if(o.material.name==='Character warm peach')o.userData.skin=true;
  if(o.userData.skinBase){o.userData.bodyMap=o.material.map;}
  if(o.userData.outfit)outfitShader(o);
  if(o.userData.colorSlot||o.userData.skin){o.material=o.material.clone();if(!o.userData.dyeTexture)o.material.map=null;o.material.needsUpdate=true;} // Colored source textures would multiply the chosen dye (brown shoes stayed black).
  // 头发的纹理材质进不了 GLB（GLTF 只收基础 PBR），颜色一律在这儿给
  if(isHair(o)){hairShader(o);dyeHair(o,want);o.material.roughness=.85;}
  else if(/Tunic|sleeve/i.test(o.name))o.material.color.set(want.cloth);
 });
 const dress=look=>{const id=outfitId(look),colors=outfitColors(look);model.userData.outfit=id;model.traverse(o=>{if(!o.isMesh)return;if(o.userData.skin)o.material.color.set(look.skin);
  // v2 身体：肤色＝选的颜色 ÷ 贴图自己的肤色（脸上的眼睛腮红跟着一起变深浅，不会被抹掉）；表情换贴图
  if(o.userData.skinBase){_a.set(look.skin||o.userData.skinBase);_b.set(o.userData.skinBase);o.material.color.setRGB(_a.r/_b.r,_a.g/_b.g,_a.b/_b.b);
   const face=FACE_ID.test(look.face||'')&&look.face!=='default'?faceTexture(look.face):o.userData.bodyMap;if(o.material.map!==face){o.material.map=face;o.material.needsUpdate=true;}}
  if(o.userData.slotDye)dyeOutfit(o,colors);if(o.userData.outfit)o.visible=o.userData.outfit===id;if(o.userData.colorSlot)o.material.color.set(colors[o.userData.colorSlot]);});};
 dress(want);
 const applyDims=dims=>{dims=dims||{};model.traverse(o=>{if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
   for(const key of DIMS){const i=o.morphTargetDictionary[key];if(i==null)continue;const v=Number(dims[key]);o.morphTargetInfluences[i]=isFinite(v)?v-1:0;}});};
 applyDims(want.dims);
 model.updateMatrixWorld(true);
 let authoredRig,rigMorphs;model.traverse(o=>{if(o.userData.dollRig){authoredRig=o.userData.dollRig;rigMorphs=o.userData.rigMorphs;}});
 const pivotFor=(label,fallback)=>authoredRig?.[label]?new T.Vector3(...authoredRig[label]):fallback;
 // 当前模型自带枢轴和形变位移；数值后备只供旧模型缓存切换期间使用。
 // v2 娃娃带骨架（骨头名＝枢轴名）：枢轴组照旧建、动画照旧转它，每帧末尾把它的转角抄给同名骨头（syncBones）。
 //   手没有单独的网格，在枢轴组里放一个看不见的小块当「手」，拿东西的位置照旧从它算。
 const HAND={leftArm:[-.275,.40,0],rightArm:[.275,.40,0]};
 function part(label,match,pivot){const p=new T.Group();p.name=label;p.position.copy(pivotFor(label,pivot));model.add(p);model.updateMatrixWorld(true);
  const bone=model.getObjectByName(label);if(bone?.isBone){p.userData.bone=bone;p.userData.rest=bone.quaternion.clone();
   if(HAND[label]){const hand=new T.Mesh(new T.BoxGeometry(.05,.05,.05));hand.visible=false;hand.name=(label==='leftArm'?'Left':'Right')+'_hand';model.updateMatrixWorld(true);const wp=model.localToWorld(new T.Vector3().fromArray(HAND[label]));bone.add(hand);hand.position.copy(bone.worldToLocal(wp));}}   // 挂在骨头上：拿着的东西跟着真正的手走（抬手被压过角度也对得上）
  const picked=[];model.traverse(o=>{if(o.isMesh&&(match.test(o.name)||o.userData.rigPart===label))picked.push(o);});picked.forEach(o=>p.attach(o));rig.push({p,label});}
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
  for(const [obj,pos] of boneBind){const next=pos.clone(),m=rigMorphs[obj.name]||{};
   for(const key of DIMS){const delta=Number(dims?.[key]??1)-1;if(Number.isFinite(delta)&&m[key])next.addScaledVector(new T.Vector3(...m[key]),delta);}obj.position.copy(next);
   if(obj===anchor){const hd=Number(dims?.head??1)-1;obj.scale.copy(anchor.userData.bindScale).multiplyScalar(1+(Number.isFinite(hd)?hd:0)*(m.scale?.head||0));}}
  const saved=rig.map(({p})=>p.userData.bone?[p.userData.bone,p.userData.bone.quaternion.clone()]:null).filter(Boolean);
  for(const {p}of rig)if(p.userData.bone)p.userData.bone.quaternion.copy(p.userData.rest);
  model.updateMatrixWorld(true);for(const m of skinned)m.bind(m.skeleton);for(const [b,q]of saved)b.quaternion.copy(q);};
 const fitRig=dims=>{rebindBones(dims);if(!rigMorphs)return;for(const {p,label}of rig){const next=new T.Vector3(...authoredRig[label]);for(const key of DIMS){const delta=Number(dims?.[key]??1)-1;if(Number.isFinite(delta)&&rigMorphs[label]?.[key])next.addScaledVector(new T.Vector3(...rigMorphs[label][key]),delta);}const shift=next.clone().sub(p.position);p.position.copy(next);for(const child of p.children)if(!child.userData.follow)child.position.sub(shift);}};
 fitRig(want.dims);
 // Skate blades are shared by both avatars, attached to the same leg rig as their boots.
 const skateParts=[],bladeGeo=new T.BoxGeometry(.032,.055,.34),bladeMat=new T.MeshStandardMaterial({color:'#b9d3df',metalness:.65,roughness:.25});
 for(const {p,label}of rig)if(label.includes('Leg')){const blade=new T.Mesh(bladeGeo,bladeMat);blade.name='IceBlade';blade.position.set(0,-p.position.y+.015,.025);p.add(blade);skateParts.push(blade);}
 const prop=new T.Group();root.add(prop);prop.visible=false;
 const pages=new T.Mesh(new T.BoxGeometry(.30,.045,.21),new T.MeshStandardMaterial({color:'#ede4c5',roughness:1}));prop.add(pages);const cover=new T.Mesh(new T.BoxGeometry(.32,.025,.23),new T.MeshStandardMaterial({color:'#6f877d',roughness:1}));cover.position.y=-.027;prop.add(cover);prop.position.set(0,.845,.22);prop.rotation.x=.35;
 const life=makeDollLife(root,model,rig,prop);
 // 手臂抬过肩（挥手、伸懒腰、举灯）时，肩膀那圈蒙皮撑不住，袖子会被撕开（她 2026-09-26 截图）。
 // 骨头上把抬手角度压一压：过了 1.2 弧度以后只走剩下的三成——动作还认得出，布料不再裂。
 const _e=new T.Euler(),_q=new T.Quaternion(),soft=a=>{const m=.8,s=Math.sign(a),v=Math.abs(a);return v<=m?a:s*(m+(v-m)*.2);};
 const syncBones=()=>{for(const {p,label}of rig){const b=p.userData.bone;if(!b)continue;
  if(label.includes('Arm')){_e.copy(p.rotation);_e.x=soft(_e.x);_e.z=soft(_e.z);_q.setFromEuler(_e);b.quaternion.copy(_q).multiply(p.userData.rest);}
  else b.quaternion.copy(p.quaternion).multiply(p.userData.rest);}};
 let sitBlend=0,lastPoseTime=0;
 return {root,handPoint:life.handPoint,setLook(next){const n=mergeLook(want,next||{});if(HAIR_STYLES.includes(hairId(n.hair))){model.traverse(o=>{if(o.isMesh&&isHair(o))o.visible=o.name==='hair_'+hairId(n.hair);});}
   model.traverse(o=>{if(!o.isMesh)return;if(isHair(o))dyeHair(o,n);else if(/Tunic|sleeve/i.test(o.name))o.material.color.set(n.cloth);});
   dress(n);applyDims(n.dims);fitRig(n.dims);
   Object.assign(want,n);},
  animate(time,{moving=false,skating=false,gesture='rest',height=.08,sleepPose=null,seated=false,progress=0}={}){const lying=!!sleepPose;skating=skating&&!lying&&gesture!=='sit';skateParts.forEach(b=>b.visible=skating);root.userData.posture=lying?'sleep':skating?'skate':gesture;model.rotation.x=lying?-Math.PI/2:skating&&moving?.07:0;model.rotation.z=skating&&moving?Math.sin(time*3.2)*.035:0;model.position.set(lying?sleepPose.x-root.position.x:0,0,lying?sleepPose.z-root.position.z:0);if(lying){root.rotation.y=0;height=sleepPose.y;gesture='sleep';moving=false;model.rotation.y=sleepPose.hug?sleepPose.toward*.45:0;}else model.rotation.y=0;seated=!moving&&!lying&&(seated||gesture==='sit');const dt=Math.min(.1,Math.max(0,time-lastPoseTime));lastPoseTime=time;sitBlend+=(Number(seated)-sitBlend)*Math.min(1,dt*9);model.traverse(o=>{const i=o.morphTargetDictionary?.seated;if(i!=null)o.morphTargetInfluences[i]=sitBlend;});root.position.y=height-sitBlend*.34+(skating?.035:moving?Math.abs(Math.sin(time*10))*.025:Math.sin(time*2)*.004);prop.visible=!moving&&gesture==='read';for(const {p,label}of rig){const side=label.startsWith('left')?1:-1;p.rotation.z=skating?(label.includes('Arm')?side*.3:Math.sin(time*3.2)*.085*side):0;p.rotation.y=skating&&moving&&label.includes('Leg')?Math.sin(time*3.2)*.16*side:0;const hugging=lying&&sleepPose.hug,reaching=hugging&&sleepPose.hugArm,inner=sleepPose?.toward>0?'leftArm':'rightArm';const standing=lying?(reaching&&label===inner?-1.05:0):skating?(label.includes('Leg')?(moving?Math.sin(time*3.2)*.17*side:0):-.15):moving?Math.sin(time*10)*.45*side*(label.includes('Leg')?-1:1):gesture==='read'&&label.includes('Arm')?-.75:gesture!=='rest'&&label==='rightArm'?-.65+Math.sin(time*7)*.12:Math.sin(time*2)*.015;if(reaching&&label===inner)p.rotation.z=side*.72;else if(hugging)p.rotation.z=0;p.rotation.x=standing*(1-sitBlend)+(label.includes('Leg')?-Math.PI/2:-.28)*sitBlend;if(!moving&&!lying&&label==='rightArm'){if(gesture==='stir'){p.rotation.x=-1.05+Math.sin(time*2.5)*.12;p.rotation.z=Math.cos(time*2.5)*.2;}else if(gesture==='hold')p.rotation.x=-1.3;}}life.update(time,{gesture:lying?'sleep':gesture,progress,moving,seated,height});syncBones();}};
}
