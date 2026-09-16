import * as T from 'three';
// Both travelers share the same model, limb pivots and animation rules.
export function createTraveler(source,companion=false){
 const root=new T.Group(),model=source.clone(true),rig=[];root.add(model);
 const cloth=new T.MeshStandardMaterial({color:'#729786',roughness:1}),hair=new T.MeshStandardMaterial({color:'#c2ac7d',roughness:1});
 model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(companion){if(/Tunic|sleeve/i.test(o.name))o.material=cloth;else if(/hair|fringe/i.test(o.name))o.material=hair;}}});
 model.updateMatrixWorld(true);
 function part(label,match,pivot){const p=new T.Group();p.name=label;p.position.copy(pivot);model.add(p);model.updateMatrixWorld(true);const picked=[];model.traverse(o=>{if(o.isMesh&&match.test(o.name))picked.push(o);});picked.forEach(o=>p.attach(o));rig.push({p,label});}
 part('leftArm',/Left.sleeve|Left.hand/i,new T.Vector3(-.19,.86,0));part('rightArm',/Right.sleeve|Right.hand|Held.herb/i,new T.Vector3(.19,.86,0));
 const legs=[];model.traverse(o=>{if(o.isMesh&&/Linen.leggings|Rounded.boots/i.test(o.name))legs.push(o);});for(const side of [-1,1]){const p=new T.Group();p.position.set(side*.115,.48,0);model.add(p);model.updateMatrixWorld(true);for(const o of legs){const v=new T.Vector3();o.getWorldPosition(v);if(Math.sign(v.x)===side)p.attach(o);}rig.push({p,label:side<0?'leftLeg':'rightLeg'});}
 const prop=new T.Group();root.add(prop);prop.visible=false;
 const pages=new T.Mesh(new T.BoxGeometry(.30,.045,.21),new T.MeshStandardMaterial({color:'#ede4c5',roughness:1}));prop.add(pages);const cover=new T.Mesh(new T.BoxGeometry(.32,.025,.23),new T.MeshStandardMaterial({color:'#6f877d',roughness:1}));cover.position.y=-.027;prop.add(cover);prop.position.set(0,.77,.22);prop.rotation.x=.35;
 return {root,animate(time,{moving=false,gesture='rest',height=.08}={}){root.position.y=height+(moving?Math.abs(Math.sin(time*10))*.025:Math.sin(time*2)*.004);prop.visible=!moving&&gesture==='read';for(const {p,label}of rig){const side=label.startsWith('left')?1:-1;p.rotation.x=moving?Math.sin(time*10)*.45*side*(label.includes('Leg')?-1:1):gesture==='read'&&label.includes('Arm')?-.75:gesture!=='rest'&&label==='rightArm'?-.65+Math.sin(time*7)*.12:Math.sin(time*2)*.015;}}};
}
