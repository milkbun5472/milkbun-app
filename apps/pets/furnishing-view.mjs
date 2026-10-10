import {furniturePoint,homeGood} from './furnishings.mjs?v=fg-83edfa27f119ba5e';
export function createFurnishingView(T,{parent,pet,getState,index=0,ground=()=>.047}){
 const root=new T.Group();root.name='pet-owned-furniture';parent.add(root);const pads=new Map();
 const mat=color=>new T.MeshStandardMaterial({color,roughness:.96});
 for(const id of ['cloudBed','roundMat']){const g=new T.Group();g.userData.furnishing=id;const m=new T.Mesh(new T.CylinderGeometry(.53,.53,.036,48),mat(id==='cloudBed'?'#f5e8df':'#ceb58f'));m.scale.z=.80;m.position.y=.018;m.receiveShadow=true;g.add(m);if(id==='cloudBed')for(let i=0;i<12;i++){const a=i*Math.PI/6,b=new T.Mesh(new T.SphereGeometry(.125,12,8),mat('#dfc7bd'));b.scale.set(1,.5,1);b.position.set(Math.sin(a)*.48,.04,Math.cos(a)*.38);g.add(b);}else {const edge=new T.Mesh(new T.TorusGeometry(.48,.012,6,48),mat('#ae916f'));edge.rotation.x=Math.PI/2;edge.scale.y=.8;edge.position.y=.035;g.add(edge);}root.add(g);pads.set(id,g);}
 function sync(){const s=getState();for(const[id,g]of pads){g.visible=s.inventory[id]>0&&s.furnishings.sleep===id;const q=furniturePoint(s,index,id);g.position.set(q.x,ground(q.x,q.z),q.z);g.scale.setScalar(pet.root.scale.x);g.rotation.y=q.yaw;}}
 function pick(ray){root.updateMatrixWorld(true);for(const hit of ray.intersectObject(root,true)){let o=hit.object;while(o&&!o.userData.furnishing)o=o.parent;if(o?.visible)return o.userData.furnishing;}return null;}
 function snapshot(){return [...pads].filter(([,g])=>g.visible).map(([id,g])=>({id,name:homeGood(id).name,position:g.position.toArray(),size:g.scale.x}));}
 return {sync,pick,snapshot};
}
