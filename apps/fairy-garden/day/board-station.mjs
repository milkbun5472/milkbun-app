import * as T from 'three';
import {makeIngredient} from './ingredient-visual.mjs?v=fg-90b53e2779ab7a1c';
import {disposeFood} from './recipe-food.mjs?v=fg-90b53e2779ab7a1c';
// One close operation view for the same kitchen meshes and saved food coordinates.
export function createKitchenStation(){
 const scene=new T.Scene();scene.background=new T.Color('#bf976c');
 const camera=new T.OrthographicCamera(-1,1,1,-1,.01,20);camera.up.set(0,0,-1);
 scene.add(new T.HemisphereLight('#fff6dc','#aa8460',2.1));const lamp=new T.DirectionalLight('#fff3da',2.4);lamp.position.set(-2,6,3);scene.add(lamp);
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.88}),board=new T.Mesh(new T.BoxGeometry(1,.035,1),mat('#c6a074'));board.position.y=-.02;scene.add(board);
 const grain=new T.Group();scene.add(grain);for(let i=0;i<17;i++){const line=new T.Mesh(new T.BoxGeometry(.002,.001,1),mat(i%3?'#bd966a':'#d1ad82'));line.position.set((i/16-.5),.001,0);grain.add(line);}
 const items=new Map(),trail=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#fff8da',transparent:true,opacity:.9}));scene.add(trail);let key='',method='fry',width=1,height=1,tool='board',layout={},clones=new Map(),currentJob=null,framed=false;const inverse=new T.Matrix4();
 function update(job,progress,w,h,drag,which='board',visuals=null){
  tool=which;currentJob=job;width=w;height=h;if(tool!=='board'){updateObjects(job,progress,w,h,drag,visuals);return;}clearClones();board.position.y=-.02;grain.position.y=0;
  const table=progress.table,Z=globalThis.CharDayKitchen.TABLE_ZONES.board;method=globalThis.CharDayKitchen.recipe(job.recipeId).method;width=w;height=h;
  const pieces=table.items.filter(p=>p.zone==='board'),next=JSON.stringify(pieces.map(p=>[p.id,p.ingredient,p.cut,p.w,p.d,p.h]));
  if(next!==key){key=next;for(const o of items.values())disposeFood(o);items.clear();for(const p of pieces){const o=makeIngredient(p,method,{live:true});scene.add(o);items.set(p.id,o);}}
  for(const p of pieces){const o=items.get(p.id);o.position.set(p.x-Z.x,.02,p.z-Z.z);}
  const xs=pieces.flatMap(p=>[p.x-Z.x-p.w/2,p.x-Z.x+p.w/2]),zs=pieces.flatMap(p=>[p.z-Z.z-p.d/2,p.z-Z.z+p.d/2]);
  const cx=xs.length?(Math.min(...xs)+Math.max(...xs))/2:0,cz=zs.length?(Math.min(...zs)+Math.max(...zs))/2:0;
  const span=Math.max(.44,xs.length?Math.max(...xs)-Math.min(...xs)+.10:0,(zs.length?Math.max(...zs)-Math.min(...zs)+.10:0)*w/h),vertical=span*h/w;
  if(!drag||!framed){camera.left=-span/2;camera.right=span/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.position.set(cx,8,cz);camera.lookAt(cx,0,cz);camera.updateProjectionMatrix();camera.updateMatrixWorld();
   board.position.set(cx,-.02,cz);board.scale.set(span*1.02,1,vertical*1.02);grain.position.set(cx,0,cz);grain.scale.set(span,1,vertical);framed=true;}
  const path=drag?.path||[];trail.geometry.dispose();trail.geometry=new T.BufferGeometry().setFromPoints(path.map(p=>new T.Vector3(p.x-Z.x,.23,p.z-Z.z)));trail.visible=path.length>1;
  scene.updateMatrixWorld(true);
 }
 function clearClones(){for(const {clone,marker}of clones.values()){clone.removeFromParent();if(marker){marker.geometry.dispose();marker.material.dispose();}}clones.clear();}
 function configure(job,progress,id){const K=globalThis.CharDayKitchen,Z=K.TABLE_ZONES,table=!!progress.table;
  if(table){if(id==='pan')return {pan:{x:0,z:0,scale:1},plate:{x:.56,z:.02,scale:.58}};
   if(id==='basket')return {basket:{x:0,z:0,scale:1},board:{x:.61,z:0,scale:.68}};
   if(id==='heat')return {pan:{x:0,z:0,scale:4}};
   return {plate:{x:0,z:0,scale:1},tray:{x:.62,z:0,scale:.62},sauce:{x:.30,z:.34,scale:1.35}};
  }
  return id==='prep'?{prep:{x:0,z:0,scale:1},pan:{x:0,z:0,scale:1}}:id==='plate'?{pan:{x:0,z:0,scale:1},legacyTray:{x:.60,z:0,scale:.7}}:{pan:{x:0,z:0,scale:id==='heat'?4:1}};
 }
 function origin(zone){const K=globalThis.CharDayKitchen;if(zone==='prep')return {x:K.KITCHEN_ANCHORS.prep.x,z:K.KITCHEN_ANCHORS.prep.contactZ,y:K.KITCHEN_ANCHORS.prep.contactY};if(zone==='legacyTray')return {...K.TABLE_ZONES.pan,x:K.TABLE_ZONES.pan.x+.65};return K.TABLE_ZONES[zone]||K.TABLE_ZONES.pan;}
 function display(q,zone){const base=origin(zone),at=layout[zone]||{x:0,z:0,scale:1};return {x:at.x+(q.x-base.x)*at.scale,z:at.z+(q.z-base.z)*at.scale};}
 function updateObjects(job,progress,w,h,drag,visuals){
  for(const o of items.values())disposeFood(o);items.clear();key='';layout=configure(job,progress,tool);const keep=new Set();if(visuals?.root){visuals.root.updateWorldMatrix(true,true);inverse.copy(visuals.root.matrixWorld).invert();
   for(const record of visuals.objects){const {object,zone,tag}=record;if(!layout[zone])continue;keep.add(object.uuid);let entry=clones.get(object.uuid);if(!entry){const clone=object.clone(true);clone.userData.stationTag=tag;scene.add(clone);entry={clone,source:object,zone};clones.set(object.uuid,entry);}
    const {clone}=entry;syncTree(object,clone);const matrix=new T.Matrix4().multiplyMatrices(inverse,object.matrixWorld);matrix.decompose(clone.position,clone.quaternion,clone.scale);const q=display({x:clone.position.x,z:clone.position.z},zone),at=layout[zone];clone.position.x=q.x;clone.position.z=q.z;clone.position.y-=origin(zone).y;clone.scale.multiplyScalar(at.scale);
    if(tool==='heat'){clone.position.set(0,.03,0);clone.rotation.x=0;if(!clone.children.length&&!entry.marker){const marker=new T.Mesh(new T.BoxGeometry(.01,.012,.04),mat('#667759'));marker.position.set(0,.025,.025);clone.add(marker);entry.marker=marker;}clone.visible=true;}
    if(drag?.point&&(drag.tag?.id&&drag.tag.id===tag?.id||['plate','legacy-plate'].includes(drag.tag?.type)&&tag?.type===drag.tag.type)){const d=display(drag.point,drag.zone||zone);clone.position.x=d.x;clone.position.z=d.z;if(drag.tag.type==='legacy-plate')clone.position.y+=.11;}
    if(drag?.point&&object.name==='RecipeRollingPin'){const d=display(drag.point,'prep');clone.position.x=d.x;clone.position.z=d.z;}entry.zone=zone;entry.tag=tag;
   }
  }
  for(const [id,e]of clones)if(!keep.has(id)){e.clone.removeFromParent();e.marker?.geometry.dispose();e.marker?.material.dispose();clones.delete(id);}
  scene.updateMatrixWorld(true);if(drag&&framed){trail.visible=false;return;}const box=new T.Box3();for(const {clone}of clones.values())if(clone.visible)box.union(new T.Box3().setFromObject(clone));
  const size=box.isEmpty()?new T.Vector3(.5,.2,.5):box.getSize(new T.Vector3()),center=box.isEmpty()?new T.Vector3():box.getCenter(new T.Vector3()),span=Math.max(.55,size.x+.13,(size.z+size.y*.35+.16)*w/h),vertical=span*h/w;
  camera.left=-span/2;camera.right=span/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.position.set(center.x,8,center.z+2.6);camera.lookAt(center.x,0,center.z);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  board.position.set(center.x,-.32,center.z);board.scale.set(span*1.05,1,vertical*1.12);grain.position.set(center.x,-.299,center.z);grain.scale.set(span,1,vertical);trail.visible=false;framed=true;scene.updateMatrixWorld(true);
 }
 function syncTree(source,copy){copy.visible=source.visible;copy.position.copy(source.position);copy.quaternion.copy(source.quaternion);copy.scale.copy(source.scale);for(let i=0;i<source.children.length;i++)if(copy.children[i])syncTree(source.children[i],copy.children[i]);}
 function screenPoint(x,y){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/width*2-1,1-y/height*2),camera);return ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());}
 function point(x,y,fixedZone){const p=screenPoint(x,y);if(!p)return null;if(tool==='board'){const Z=globalThis.CharDayKitchen.TABLE_ZONES.board;return {x:p.x+Z.x,z:p.z+Z.z,zone:'board'};}
  const zone=fixedZone||Object.keys(layout).sort((a,b)=>Math.hypot(p.x-layout[a].x,p.z-layout[a].z)-Math.hypot(p.x-layout[b].x,p.z-layout[b].z))[0],at=layout[zone],base=origin(zone);return {x:base.x+(p.x-at.x)/at.scale,z:base.z+(p.z-at.z)/at.scale,zone};
 }
 function project(q){let v;if(tool==='board'){const Z=globalThis.CharDayKitchen.TABLE_ZONES.board;v=new T.Vector3(q.x-Z.x,0,q.z-Z.z);}else{const K=globalThis.CharDayKitchen,zone=q.zone||Object.keys(layout).find(z=>K.TABLE_ZONES[z]&&K.inTableZone(q,z))||Object.keys(layout)[0],p=display(q,zone);v=new T.Vector3(p.x,0,p.z);}v.project(camera);return {x:(v.x+1)*width/2,y:(1-v.y)*height/2};}
 function targets(){return [...clones.values()].filter(e=>e.clone.visible&&e.tag).map(e=>{const v=new T.Box3().setFromObject(e.clone).getCenter(new T.Vector3()).project(camera);return {...e.tag,x:(v.x+1)*width/2,y:(1-v.y)*height/2};});}
 function hit(x,y){if(tool==='board')return {type:'knife',zone:'board'};if(tool==='sauce')return {type:'sauce',zone:'plate'};if(tool==='heat')return {type:'heat',zone:'pan'};const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/width*2-1,1-y/height*2),camera);const roots=[...clones.values()].filter(e=>e.clone.visible&&e.tag).map(e=>e.clone);for(const h of ray.intersectObjects(roots,true)){let n=h.object;while(n&&!n.userData.stationTag)n=n.parent;if(n?.userData.stationTag)return {...n.userData.stationTag};}if(!currentJob.cooking.progress.table)return null;if(tool==='pan')return {type:'pan',zone:'pan'};return null;}
 function clear(){for(const o of items.values())disposeFood(o);items.clear();key='';framed=false;clearClones();}
 return {scene,camera,update,point,project,hit,targets,clear,dispose(){clear();scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});},inspect:()=>({tool,pieces:items.size,objects:clones.size,span:camera.right-camera.left})};
}
// Existing callers use the same implementation.
export const createBoardStation=createKitchenStation;
