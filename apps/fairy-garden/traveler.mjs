import * as T from 'three';
// 两位旅人共用同一个模型、同一套枢轴与动画规则。
// 模型是 doll.glb：一个身体 ＋ 十二款头发（hair_<style> 各自成网格），每个人只显示一款。
// ⚠️名字里不能带点：GLTFLoader 会把节点名里的点洗掉，hair.korean 到网页里就认不出来了。
// ⚠️不要改回 traveler.glb——那一份是 art/fairy-garden 那套脚本自己的输入（doll_hair.SRC 读它）。
export const HAIR_STYLES=['korean','wolf','mullet','curtains','comma','pixie','bob','hush','airbang','wavy','bun','ponytail'];
const DEFAULT={hair:'korean',hairColor:'#6b4a33',cloth:'#8d5f66'};
const COMPANION={hair:'wavy',hairColor:'#5b4436',cloth:'#729786'};
export function createTraveler(source,companion=false,look={}){
 const want=Object.assign({},companion?COMPANION:DEFAULT,look||{});
 const style=HAIR_STYLES.includes(want.hair)?want.hair:(companion?COMPANION.hair:DEFAULT.hair);
 const root=new T.Group(),model=source.clone(true),rig=[];root.add(model);
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
  // 头发的纹理材质进不了 GLB（GLTF 只收基础 PBR），颜色一律在这儿给
  if(isHair(o)){o.material.color.set(want.hairColor);o.material.roughness=.85;}
  else if(/Tunic|sleeve/i.test(o.name))o.material.color.set(want.cloth);
 });
 model.updateMatrixWorld(true);
 // 枢轴按新身体量过：art/fairy-garden/export_traveler.py 的 PIVOTS 里，
 // 袖子 z .636~.989、腿 z .009~.593。旧的 .86/.48 是抬高 .075 之前的数。
 function part(label,match,pivot){const p=new T.Group();p.name=label;p.position.copy(pivot);model.add(p);model.updateMatrixWorld(true);const picked=[];model.traverse(o=>{if(o.isMesh&&match.test(o.name))picked.push(o);});picked.forEach(o=>p.attach(o));rig.push({p,label});}
 part('leftArm',/Left.sleeve|Left.hand/i,new T.Vector3(-.19,.935,0));part('rightArm',/Right.sleeve|Right.hand|Held.herb/i,new T.Vector3(.19,.935,0));
 const legs=[];model.traverse(o=>{if(o.isMesh&&/Linen.leggings|Rounded.boots/i.test(o.name))legs.push(o);});for(const side of [-1,1]){const p=new T.Group();p.position.set(side*.115,.555,0);model.add(p);model.updateMatrixWorld(true);for(const o of legs){const v=new T.Vector3();o.getWorldPosition(v);if(Math.sign(v.x)===side)p.attach(o);}rig.push({p,label:side<0?'leftLeg':'rightLeg'});}
 const prop=new T.Group();root.add(prop);prop.visible=false;
 const pages=new T.Mesh(new T.BoxGeometry(.30,.045,.21),new T.MeshStandardMaterial({color:'#ede4c5',roughness:1}));prop.add(pages);const cover=new T.Mesh(new T.BoxGeometry(.32,.025,.23),new T.MeshStandardMaterial({color:'#6f877d',roughness:1}));cover.position.y=-.027;prop.add(cover);prop.position.set(0,.845,.22);prop.rotation.x=.35;
 return {root,setLook(next){const n=Object.assign({},want,next||{});if(HAIR_STYLES.includes(n.hair)){model.traverse(o=>{if(o.isMesh&&isHair(o))o.visible=o.name==='hair_'+n.hair;});}
   model.traverse(o=>{if(!o.isMesh)return;if(isHair(o))o.material.color.set(n.hairColor);else if(/Tunic|sleeve/i.test(o.name))o.material.color.set(n.cloth);});
   Object.assign(want,n);},
  animate(time,{moving=false,gesture='rest',height=.08}={}){root.position.y=height+(moving?Math.abs(Math.sin(time*10))*.025:Math.sin(time*2)*.004);prop.visible=!moving&&gesture==='read';for(const {p,label}of rig){const side=label.startsWith('left')?1:-1;p.rotation.x=moving?Math.sin(time*10)*.45*side*(label.includes('Leg')?-1:1):gesture==='read'&&label.includes('Arm')?-.75:gesture!=='rest'&&label==='rightArm'?-.65+Math.sin(time*7)*.12:Math.sin(time*2)*.015;}}};
}
