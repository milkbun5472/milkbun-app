import {makeDollLife} from './doll-life.mjs?v=fg-015385b919571757';
import {mergeLook,outfitId,outfitColors,DEFAULT_LOOK,COMPANION_LOOK} from './wardrobe.mjs?v=fg-015385b919571757';
import * as T from 'three';
// 两位旅人共用同一个模型、同一套枢轴与动画规则。
// 模型是 doll.glb：一个身体 ＋ 十二款头发（hair_<style> 各自成网格），每个人只显示一款。
// ⚠️名字里不能带点：GLTFLoader 会把节点名里的点洗掉，hair.korean 到网页里就认不出来了。
// ⚠️不要改回 traveler.glb——那一份是 art/fairy-garden 那套脚本自己的输入（doll_hair.SRC 读它）。
export const HAIR_STYLES=['korean','wolf','mullet','curtains','comma','pixie','bob','hush','airbang','wavy','bun','ponytail'];
// 体型：六个参数以 1 为中性。形变规则只写在 doll_hair.deform 里，导出成形态键；
// 这儿只把「值 - 1」送进 morphTargetInfluences，和 Blender 那边同一个算法。
// ⚠️不要在这儿再实现一遍形变——那就是同一层活在两处。
const DIMS=['height','shoulder','waist','flare','build','head'];
const DEFAULT=DEFAULT_LOOK,COMPANION=COMPANION_LOOK;
export function createTraveler(source,companion=false,look={}){
 const want=Object.assign({},companion?COMPANION:DEFAULT,look||{});
 const style=HAIR_STYLES.includes(want.hair)?want.hair:(companion?COMPANION.hair:DEFAULT.hair);
 const root=new T.Group(),model=source.clone(true),rig=[];model.name='TravelerVisual';root.add(model);
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
  if(o.userData.colorSlot||o.userData.skin){o.material=o.material.clone();o.material.map=null;o.material.needsUpdate=true;} // Colored source textures would multiply the chosen dye (brown shoes stayed black).
  // 头发的纹理材质进不了 GLB（GLTF 只收基础 PBR），颜色一律在这儿给
  if(isHair(o)){o.material.color.set(want.hairColor);o.material.roughness=.85;}
  else if(/Tunic|sleeve/i.test(o.name))o.material.color.set(want.cloth);
 });
 const dress=look=>{const id=outfitId(look),colors=outfitColors(look);model.userData.outfit=id;model.traverse(o=>{if(!o.isMesh)return;if(o.userData.skin)o.material.color.set(look.skin);if(o.userData.outfit)o.visible=o.userData.outfit===id;if(o.userData.colorSlot)o.material.color.set(colors[o.userData.colorSlot]);});};
 dress(want);
 const applyDims=dims=>{if(!dims)return;model.traverse(o=>{if(!o.isMesh||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
   for(const key of DIMS){const i=o.morphTargetDictionary[key];if(i==null)continue;const v=Number(dims[key]);o.morphTargetInfluences[i]=isFinite(v)?v-1:0;}});};
 applyDims(want.dims);
 model.updateMatrixWorld(true);
 // 枢轴按新身体量过：art/fairy-garden/export_traveler.py 的 PIVOTS 里，
 // 袖子 z .636~.989、腿 z .009~.593。旧的 .86/.48 是抬高 .075 之前的数。
 function part(label,match,pivot){const p=new T.Group();p.name=label;p.position.copy(pivot);model.add(p);model.updateMatrixWorld(true);const picked=[];model.traverse(o=>{if(o.isMesh&&(match.test(o.name)||o.userData.rigPart===label))picked.push(o);});picked.forEach(o=>p.attach(o));rig.push({p,label});}
 part('leftArm',/Left.sleeve|Left.hand/i,new T.Vector3(-.19,.935,0));part('rightArm',/Right.sleeve|Right.hand|Held.herb/i,new T.Vector3(.19,.935,0));
 // Exported doll parts have baked vertices and identical object origins (0,0,0).
 // Classify the actual mesh centre in model space, not the object's translation.
 const legs=[];model.traverse(o=>{if(o.isMesh&&/Linen.leggings|Rounded.boots/i.test(o.name)){
  const centre=new T.Box3().setFromObject(o,true).getCenter(new T.Vector3());
  legs.push({mesh:o,side:Math.sign(model.worldToLocal(centre).x)});
 }});
 for(const side of [-1,1]){const p=new T.Group(),label=side<0?'leftLeg':'rightLeg';p.name=label;p.position.set(side*.115,.555,0);model.add(p);model.updateMatrixWorld(true);
  for(const item of legs)if(item.side===side)p.attach(item.mesh);
  rig.push({p,label});}
 // Skate blades are shared by both avatars, attached to the same leg rig as their boots.
 const skateParts=[],bladeGeo=new T.BoxGeometry(.032,.055,.34),bladeMat=new T.MeshStandardMaterial({color:'#b9d3df',metalness:.65,roughness:.25});
 for(const {p,label}of rig)if(label.includes('Leg')){const blade=new T.Mesh(bladeGeo,bladeMat);blade.name='IceBlade';blade.position.set(0,-.54,.025);p.add(blade);skateParts.push(blade);}
 const prop=new T.Group();root.add(prop);prop.visible=false;
 const pages=new T.Mesh(new T.BoxGeometry(.30,.045,.21),new T.MeshStandardMaterial({color:'#ede4c5',roughness:1}));prop.add(pages);const cover=new T.Mesh(new T.BoxGeometry(.32,.025,.23),new T.MeshStandardMaterial({color:'#6f877d',roughness:1}));cover.position.y=-.027;prop.add(cover);prop.position.set(0,.845,.22);prop.rotation.x=.35;
 const life=makeDollLife(root,model,rig,prop);
 let sitBlend=0,lastPoseTime=0;
 return {root,handPoint:life.handPoint,setLook(next){const n=mergeLook(want,next||{});if(HAIR_STYLES.includes(n.hair)){model.traverse(o=>{if(o.isMesh&&isHair(o))o.visible=o.name==='hair_'+n.hair;});}
   model.traverse(o=>{if(!o.isMesh)return;if(isHair(o))o.material.color.set(n.hairColor);else if(/Tunic|sleeve/i.test(o.name))o.material.color.set(n.cloth);});
   dress(n);applyDims(n.dims);
   Object.assign(want,n);},
  animate(time,{moving=false,skating=false,gesture='rest',height=.08,sleepPose=null,seated=false,progress=0}={}){const lying=!!sleepPose;skating=skating&&!lying&&gesture!=='sit';skateParts.forEach(b=>b.visible=skating);root.userData.posture=lying?'sleep':skating?'skate':gesture;model.rotation.x=lying?-Math.PI/2:skating&&moving?.07:0;model.rotation.z=skating&&moving?Math.sin(time*3.2)*.035:0;model.position.set(lying?sleepPose.x-root.position.x:0,0,lying?sleepPose.z-root.position.z:0);if(lying){root.rotation.y=0;height=sleepPose.y;gesture='sleep';moving=false;}seated=!moving&&!lying&&(seated||gesture==='sit');const dt=Math.min(.1,Math.max(0,time-lastPoseTime));lastPoseTime=time;sitBlend+=(Number(seated)-sitBlend)*Math.min(1,dt*9);model.traverse(o=>{const i=o.morphTargetDictionary?.seated;if(i!=null)o.morphTargetInfluences[i]=sitBlend;});root.position.y=height-sitBlend*.34+(skating?.035:moving?Math.abs(Math.sin(time*10))*.025:Math.sin(time*2)*.004);prop.visible=!moving&&gesture==='read';for(const {p,label}of rig){const side=label.startsWith('left')?1:-1;p.rotation.z=skating?(label.includes('Arm')?side*.3:Math.sin(time*3.2)*.085*side):0;p.rotation.y=skating&&moving&&label.includes('Leg')?Math.sin(time*3.2)*.16*side:0;const standing=lying?0:skating?(label.includes('Leg')?(moving?Math.sin(time*3.2)*.17*side:0):-.15):moving?Math.sin(time*10)*.45*side*(label.includes('Leg')?-1:1):gesture==='read'&&label.includes('Arm')?-.75:gesture!=='rest'&&label==='rightArm'?-.65+Math.sin(time*7)*.12:Math.sin(time*2)*.015;p.rotation.x=standing*(1-sitBlend)+(label.includes('Leg')?-Math.PI/2:-.28)*sitBlend;if(!moving&&!lying&&label==='rightArm'){if(gesture==='stir'){p.rotation.x=-1.05+Math.sin(time*2.5)*.12;p.rotation.z=Math.cos(time*2.5)*.2;}else if(gesture==='hold')p.rotation.x=-1.3;}}life.update(time,{gesture:lying?'sleep':gesture,progress,moving,seated,height});}};
}
