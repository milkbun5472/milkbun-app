import * as T from 'three';
import {makeIngredient,makeTabletopPlate} from './ingredient-visual.mjs?v=fg-90b53e2779ab7a1c';
export function createTabletopView(parent,job){
 const K=globalThis.CharDayKitchen,Z=K.TABLE_ZONES,root=new T.Group();root.name='KitchenTabletop';parent.add(root);let itemRoot=new T.Group(),plateRoot=null,key='',targets=[],baseTargets=[],preview=null;
 root.add(itemRoot);
 const mesh=(geo,color,x,y,z,name,tag)=>{const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.84}));m.position.set(x,y,z);m.name=name;m.castShadow=m.receiveShadow=true;if(tag)m.userData.tabletop=tag;root.add(m);return m;};
 mesh(new T.BoxGeometry(Z.basket.w,.09,Z.basket.d),'#c6b58b',Z.basket.x,Z.basket.y-.045,Z.basket.z,'IngredientBasket',{type:'basket',zone:'basket'});
 for(const [x,z,w,d]of [[Z.basket.x-Z.basket.w/2,Z.basket.z,.035,Z.basket.d],[Z.basket.x+Z.basket.w/2,Z.basket.z,.035,Z.basket.d],[Z.basket.x,Z.basket.z-Z.basket.d/2,Z.basket.w,.035],[Z.basket.x,Z.basket.z+Z.basket.d/2,Z.basket.w,.035]])mesh(new T.BoxGeometry(w,.10,d),'#baa37e',x,Z.basket.y,z,'BasketEdge');
 mesh(new T.BoxGeometry(Z.tray.w,.018,Z.tray.d),'#a3b298',Z.tray.x,Z.tray.y-.01,Z.tray.z,'ServingTray',{type:'tray',zone:'tray'});
 const knife=mesh(new T.BoxGeometry(.035,.015,.23),'#c7c9bd',Z.board.x-.28,Z.board.y+.035,Z.board.z-.09,'CookingKnife',{type:'knife',zone:'board'});const knifeHandle=mesh(new T.BoxGeometry(.04,.03,.095),'#927653',knife.position.x,knife.position.y,knife.position.z+.16,'KnifeHandle',{type:'knife',zone:'board'});
 const pan=mesh(new T.CylinderGeometry(.25,.23,job.recipeId&&globalThis.CharDayKitchen.recipe(job.recipeId)?.method==='mix'?.10:.035,28),'#68766a',Z.pan.x,Z.pan.y-.035,Z.pan.z,'InteractivePan',{type:'pan',zone:'pan'});const handle=mesh(new T.BoxGeometry(.055,.03,.26),'#a38963',Z.pan.x,Z.pan.y-.02,Z.pan.z+.25,'InteractivePanHandle',{type:'flip',zone:'pan'});
 const spoon=mesh(new T.SphereGeometry(1,12,8),'#a48c64',Z.pan.x+.48,Z.pan.y+.025,Z.pan.z-.24,'MixingSpoon',{type:'stir',zone:'pan'});spoon.scale.set(.045,.018,.06);const spoonHandle=mesh(new T.BoxGeometry(.025,.025,.18),'#a48c64',spoon.position.x,spoon.position.y,spoon.position.z+.12,'SpoonHandle',{type:'stir',zone:'pan'});
 const knob=mesh(new T.CylinderGeometry(.065,.065,.035,18),'#dfcca3',Z.pan.x+.34,Z.pan.y-.07,Z.pan.z+.10,'InteractiveHeatKnob',{type:'heat',zone:'pan'});const mark=new T.Mesh(new T.BoxGeometry(.008,.008,.045),new T.MeshStandardMaterial({color:'#667759'}));mark.position.set(0,.022,.022);knob.add(mark);
 const sauce=mesh(new T.CylinderGeometry(.045,.06,.16,16),'#b2926b',Z.sauce.x,Z.sauce.y+.08,Z.sauce.z,'SauceBottle',{type:'sauce',zone:'plate'});const sauceCap=mesh(new T.CylinderGeometry(.023,.023,.035,12),'#ece0bb',Z.sauce.x,Z.sauce.y+.18,Z.sauce.z,'SauceCap',{type:'sauce',zone:'plate'});
 const plate=mesh(new T.CylinderGeometry(.285,.26,.025,32),'#f1e5cf',Z.plate.x,Z.plate.y,Z.plate.z,'ArrangementPlate',{type:'plate',zone:'plate'});
 const steam=new T.Group();root.add(steam);for(let i=0;i<5;i++){const m=new T.Mesh(new T.SphereGeometry(.025,7,5),new T.MeshBasicMaterial({color:'#f4ead7',transparent:true,opacity:.27,depthWrite:false}));steam.add(m);}
 baseTargets=root.children.filter(o=>o.userData.tabletop);function dispose(g){g?.removeFromParent();g?.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
 function update(stage,time,drag){
  const table=stage.progress.table;if(!table)return;const next=JSON.stringify([table.items.map(p=>[p.id,p.ingredient,p.cut,p.w,p.d,p.h,p.ingredient==='egg'&&['pan','plate'].includes(p.zone)]),table.sauce]);if(next!==key){key=next;dispose(itemRoot);dispose(plateRoot);plateRoot=null;itemRoot=new T.Group();root.add(itemRoot);
   for(const p of table.items){const o=makeIngredient(p,stage.method,{live:true});o.position.set(p.x,Z[p.zone].y+.015,p.z);o.userData.tabletop={type:'ingredient',id:p.id,zone:p.zone};itemRoot.add(o);}targets=baseTargets.concat(itemRoot.children);
   if(table.sauce.length>1||job.cooking.variation.garnish||job.cooking.variation.spice!=='none'){plateRoot=makeTabletopPlate({...table,items:[]},stage.method,job.cooking.variation);plateRoot.children[0].visible=false;plateRoot.position.set(Z.plate.x,Z.plate.y,Z.plate.z);root.add(plateRoot);}
  }
  const shown=drag?.tag?.type==='stir'||drag?.tag?.type==='pan'?K.tableEvent(table,{kind:'stir',path:drag.path},stage.method,stage.progress.elapsed):table;
  for(const o of itemRoot.children){const p=shown.items.find(p=>p.id===o.userData.id);if(!p)continue;o.visible=drag?.hideId!==p.id;o.userData.tabletop.zone=p.zone;o.position.set(p.x,Z[p.zone].y+.015,p.z);o.traverse(m=>{if(m.material?.userData.tableBase)m.material.color.copy(m.material.userData.tableBase).lerp(new T.Color('#b99362'),stage.method==='mix'?0:(p.top+p.bottom)/2*.43);});if(p.zone==='pan'&&p.toss&&stage.progress.elapsed-p.toss<.65){const v=Math.max(0,stage.progress.elapsed-p.toss)/.65;o.position.y+=Math.sin(v*Math.PI)*.22;o.rotation.x=v*Math.PI*2;}else o.rotation.x=0;
   if(drag?.tag?.id===p.id&&drag.point)o.position.set(drag.point.x,(Z[drag.zone||p.zone]?.y||1.08)+.11,drag.point.z);
  }
  const ready=table.items.length&&table.items.every(p=>p.zone==='plate');plate.userData.tabletop.type=ready?'plate':'plate-base';
  knob.visible=stage.method!=='mix';knob.rotation.y=stage.progress.heat*Math.PI/3;pan.material.color.set(stage.method==='mix'?'#a5b99b':'#68766a');handle.visible=['stir','fry'].includes(stage.method);
  if(drag?.tag?.type==='knife'&&drag.point){knife.position.set(drag.point.x,Z.board.y+.14,drag.point.z);knife.rotation.z=-.3;}else{knife.position.set(Z.board.x-.28,Z.board.y+.035,Z.board.z-.09);knife.rotation.z=0;}knifeHandle.position.copy(knife.position);knifeHandle.position.z+=.16;knifeHandle.rotation.copy(knife.rotation);
  sauce.position.set(drag?.tag?.type==='sauce'&&drag.point?drag.point.x:Z.sauce.x,Z.sauce.y+.08,drag?.tag?.type==='sauce'&&drag.point?drag.point.z:Z.sauce.z);
  spoon.position.set(drag?.tag?.type==='stir'&&drag.point?drag.point.x:Z.pan.x+.48,Z.pan.y+.025,drag?.tag?.type==='stir'&&drag.point?drag.point.z:Z.pan.z-.24);spoonHandle.position.copy(spoon.position);spoonHandle.position.z+=.12;
  sauceCap.position.copy(sauce.position);sauceCap.position.y+=.10;
  if(drag?.tag?.type==='plate'&&drag.point){const dx=drag.point.x-Z.plate.x,dz=drag.point.z-Z.plate.z;plate.position.set(drag.point.x,Z.plate.y+.12,drag.point.z);const shown=drag?.tag?.type==='stir'||drag?.tag?.type==='pan'?K.tableEvent(table,{kind:'stir',path:drag.path},stage.method,stage.progress.elapsed):table;
  for(const o of itemRoot.children){const p=shown.items.find(p=>p.id===o.userData.id);if(p?.zone==='plate')o.position.set(p.x+dx,Z.plate.y+.15,p.z+dz);}if(plateRoot)plateRoot.position.set(drag.point.x,Z.plate.y+.12,drag.point.z);}else{plate.position.set(Z.plate.x,Z.plate.y,Z.plate.z);if(plateRoot)plateRoot.position.set(Z.plate.x,Z.plate.y,Z.plate.z);}
  steam.visible=stage.method!=='mix'&&stage.progress.heat>0&&table.items.some(p=>p.zone==='pan');steam.children.forEach((o,i)=>{o.position.set(Z.pan.x+(i%2-.5)*.09,Z.pan.y+.12+(time*.1+i*.07)%.35,Z.pan.z);o.scale.setScalar(.6+i*.12);});root.userData={pieces:table.items.length,zones:table.items.map(p=>({id:p.id,zone:p.zone})),order:table.order,sauce:table.sauce.length,sealed:table.sealed};
 }
 return {root,update,targets:()=>targets.filter(o=>o.visible),toLocal:point=>parent.worldToLocal(point.clone()),worldPoint:q=>parent.localToWorld(new T.Vector3(q.x,q.y??Z[q.zone||'board'].y+.08,q.z)),clear:()=>dispose(root),inspect:()=>({...root.userData})};
}
