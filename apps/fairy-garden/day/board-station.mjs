import * as T from 'three';
import {makeIngredient} from './ingredient-visual.mjs?v=fg-5404133be25619b2';
import {disposeFood} from './recipe-food.mjs?v=fg-5404133be25619b2';
// A close view of the SAME board pieces, in the SAME saved table coordinates.
export function createBoardStation(){
 const scene=new T.Scene();scene.background=new T.Color('#bf976c');
 const camera=new T.OrthographicCamera(-1,1,1,-1,.01,20);camera.up.set(0,0,-1);
 scene.add(new T.HemisphereLight('#fff6dc','#aa8460',2.1));const lamp=new T.DirectionalLight('#fff3da',2.4);lamp.position.set(-2,6,3);scene.add(lamp);
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.88}),board=new T.Mesh(new T.BoxGeometry(1,.035,1),mat('#c6a074'));board.position.y=-.02;scene.add(board);
 const grain=new T.Group();scene.add(grain);for(let i=0;i<17;i++){const line=new T.Mesh(new T.BoxGeometry(.002,.001,1),mat(i%3?'#bd966a':'#d1ad82'));line.position.set((i/16-.5),.001,0);grain.add(line);}
 const items=new Map(),trail=new T.Line(new T.BufferGeometry(),new T.LineBasicMaterial({color:'#fff8da',transparent:true,opacity:.9}));scene.add(trail);let key='',method='fry',width=1,height=1;
 function update(job,progress,w,h,drag){
  const table=progress.table,Z=globalThis.CharDayKitchen.TABLE_ZONES.board;method=globalThis.CharDayKitchen.recipe(job.recipeId).method;width=w;height=h;
  const pieces=table.items.filter(p=>p.zone==='board'),next=JSON.stringify(pieces.map(p=>[p.id,p.ingredient,p.cut,p.w,p.d,p.h]));
  if(next!==key){key=next;for(const o of items.values())disposeFood(o);items.clear();for(const p of pieces){const o=makeIngredient(p,method,{live:true});scene.add(o);items.set(p.id,o);}}
  for(const p of pieces){const o=items.get(p.id);o.position.set(p.x-Z.x,.02,p.z-Z.z);}
  const xs=pieces.flatMap(p=>[p.x-Z.x-p.w/2,p.x-Z.x+p.w/2]),zs=pieces.flatMap(p=>[p.z-Z.z-p.d/2,p.z-Z.z+p.d/2]);
  const cx=xs.length?(Math.min(...xs)+Math.max(...xs))/2:0,cz=zs.length?(Math.min(...zs)+Math.max(...zs))/2:0;
  const span=Math.max(.44,xs.length?Math.max(...xs)-Math.min(...xs)+.10:0,(zs.length?Math.max(...zs)-Math.min(...zs)+.10:0)*w/h),vertical=span*h/w;
  camera.left=-span/2;camera.right=span/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.position.set(cx,8,cz);camera.lookAt(cx,0,cz);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  board.position.set(cx,-.02,cz);board.scale.set(span*1.02,1,vertical*1.02);grain.position.set(cx,0,cz);grain.scale.set(span,1,vertical);
  const path=drag?.path||[];trail.geometry.dispose();trail.geometry=new T.BufferGeometry().setFromPoints(path.map(p=>new T.Vector3(p.x-Z.x,.23,p.z-Z.z)));trail.visible=path.length>1;
  scene.updateMatrixWorld(true);
 }
 function point(x,y){const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(x/width*2-1,1-y/height*2),camera);const p=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3()),Z=globalThis.CharDayKitchen.TABLE_ZONES.board;return p?{x:p.x+Z.x,z:p.z+Z.z}:null;}
 function project(q){const Z=globalThis.CharDayKitchen.TABLE_ZONES.board,v=new T.Vector3(q.x-Z.x,0,q.z-Z.z).project(camera);return {x:(v.x+1)*width/2,y:(1-v.y)*height/2};}
 return {scene,camera,update,point,project,clear(){for(const o of items.values())disposeFood(o);items.clear();key='';},dispose(){for(const o of items.values())disposeFood(o);items.clear();scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});},inspect:()=>({pieces:items.size,span:camera.right-camera.left})};
}
