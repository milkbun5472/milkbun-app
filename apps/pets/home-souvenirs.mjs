import {HOME_DETAILS} from './room-layout.mjs?v=fg-eef50c4ec2251efc';
import {petWorkplace} from './workplaces.mjs?v=fg-eef50c4ec2251efc';
import {furnishingFacts} from './furnishings.mjs?v=fg-eef50c4ec2251efc';
// One inventory projection for the room and the conversation. No second furniture save.
export function homeSouvenirs(career,care){
 const inventory=career?.inventory||{},task=care?.task;
 return {furnishings:furnishingFacts(career),flowerVase:{flowers:career?.vase?.flowers||0,unplaced:inventory.flower||0,petals:inventory.petals||0,day:career?.vase?.day||null,by:career?.vase?.by||'',place:'窗边桌上的小花瓶'},breadBasket:{count:inventory.bread||0,place:'饭盆旁的面包篮',portion:task?.kind==='treat'&&task.food==='bread'?{phase:task.phase,food:'小面包'}:null},ownBox:{owned:inventory.box===1,resting:task?.kind==='sleep'&&task.place==='box',place:'自己的敞口小纸箱'},ownBall:{owned:inventory.toy===1||inventory.bellBall===1,name:career.furnishings?.toy==='bellBall'?'铃铛小球':career?.shopping?.toyStyle==='wonky'?'歪眼小怪球':'自己的小球',place:'玩具角或它上次放下的地方',position:care?.toyPlaces?.ball?{...care.toyPlaces.ball}:null,playing:(inventory.toy===1||inventory.bellBall===1)&&task?.kind==='play'&&task.toy==='ball'},firstTrial:career?.firstTrial?structuredClone(career.firstTrial):null};
}
export function createHomeSouvenirs(T,{model,career,care,ballObject,boxObject}){
 const root=new T.Group();root.name='pet-earned-souvenirs';model.add(root);
 const material=color=>new T.MeshStandardMaterial({color,roughness:.88});
 const wood=material('#c8a787'),bread=material('#c99662'),cut=material('#f5dfbb'),cloth=material('#efe0d5');
 const objects={};
 function mesh(group,geometry,mat,x,y,z){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
 function group(id,x,y,z){const g=new T.Group();g.userData.souvenir=id;g.position.set(x,y,z);root.add(g);objects[id]=g;return g;}
 const basket=group('bread',HOME_DETAILS.bread.x,.14,HOME_DETAILS.bread.z);
 mesh(basket,new T.BoxGeometry(.62,.08,.47),cloth,0,.015,0);
 for(const x of[-.31,.31])mesh(basket,new T.BoxGeometry(.055,.18,.5),wood,x,.09,0);
 for(const z of[-.23,.23])mesh(basket,new T.BoxGeometry(.65,.18,.045),wood,0,.09,z);
 for(let i=0;i<4;i++)for(const z of[-.26,.26])mesh(basket,new T.BoxGeometry(.62,.014,.015),cut,0,.025+i*.047,z);
 const loaves=[];for(let i=0;i<3;i++){const loaf=new T.Group();loaf.position.set((i-1)*.17,.19,i===1?-.06:.02);const body=mesh(loaf,new T.SphereGeometry(.14,16,10),bread,0,0,0);body.scale.set(.65,.65,1.28);for(const z of[-.065,0,.065]){const slash=mesh(loaf,new T.BoxGeometry(.09,.018,.023),cut,0,.084,z);slash.rotation.z=-.12;}basket.add(loaf);loaves.push(loaf);}
 const ball=ballObject;objects.ball=ball;const box=boxObject;objects.box=box;

 const vase=group('flowers',HOME_DETAILS.flowers.x,.83,HOME_DETAILS.flowers.z),pink=material('#d7aaa9'),stem=material('#a2a589');
 mesh(vase,new T.CylinderGeometry(.065,.085,.18,16),cloth,0,.09,0);
 const flowers=[];for(let i=0;i<3;i++){const flower=new T.Group();flower.position.set((i-1)*.045,.17,(i===1?-.025:.025));const height=.17+i*.025;mesh(flower,new T.CylinderGeometry(.006,.006,height,6),stem,0,height/2,0);for(let p=0;p<5;p++){const angle=p*Math.PI*2/5;const petal=mesh(flower,new T.SphereGeometry(.031,8,6),pink,Math.cos(angle)*.028,height,Math.sin(angle)*.028);petal.scale.y=.4;}mesh(flower,new T.SphereGeometry(.019,8,6),cut,0,height+.006,0);vase.add(flower);flowers.push(flower);}
 const memory=group('memory',HOME_DETAILS.memory.x,1.98,HOME_DETAILS.memory.z);memory.rotation.y=Math.PI/2;
 mesh(memory,new T.BoxGeometry(.62,.75,.045),wood,0,0,0);
 const canvas=document.createElement('canvas');canvas.width=384;canvas.height=480;const ctx=canvas.getContext('2d');
 function paint(){const saved=career.firstTrial;ctx.fillStyle='#fff7e8';ctx.fillRect(0,0,384,480);ctx.fillStyle='#bd9271';ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText('第一份工作',192,56);
 // A printed paw keepsake, not a fabricated photograph of a past event.
 ctx.fillStyle='#c79b85';ctx.beginPath();ctx.ellipse(192,206,61,45,0,0,Math.PI*2);ctx.fill();for(const [x,y,r]of[[124,154,22],[168,126,24],[218,128,24],[259,159,21]]){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#806b60';ctx.font='26px sans-serif';ctx.fillText((saved?.name||'试工纪念').slice(0,12),192,317);ctx.font='20px sans-serif';ctx.fillText('小镇第 '+(saved?.day||1)+' 天 · '+petWorkplace(saved?.profession).title,192,359);ctx.font='18px sans-serif';ctx.fillText('点开，看那天的小主意',192,416);}
 paint();
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const print=mesh(memory,new T.PlaneGeometry(.55,.68),new T.MeshStandardMaterial({map:texture,roughness:1}),0,0,.026);print.castShadow=false;
 let printId=career.firstTrial?.id;
 function sync(){if(printId!==career.firstTrial?.id){printId=career.firstTrial?.id;paint();texture.needsUpdate=true;}const facts=homeSouvenirs(career,care);vase.visible=facts.flowerVase.flowers>0||facts.flowerVase.unplaced>0;flowers.forEach((o,i)=>o.visible=i<facts.flowerVase.flowers);basket.visible=facts.breadBasket.count>0;loaves.forEach((o,i)=>o.visible=i<facts.breadBasket.count);if(facts.ownBall.owned)ball.userData.souvenir='ball';else delete ball.userData.souvenir;memory.visible=!!facts.firstTrial;return facts;}
 function pick(ray){root.updateMatrixWorld(true);for(const hit of ray.intersectObjects([root,...(career.inventory.toy===1?[ball]:[]),...(career.inventory.box===1?[box]:[])],true)){let o=hit.object,visible=true,id;while(o&&o!==model){if(!o.visible)visible=false;if(o.userData.souvenir)id=o.userData.souvenir;o=o.parent;}if(visible&&id)return id;}return null;}
 function markers(camera,width,height){root.updateMatrixWorld(true);return Object.entries(objects).filter(([id,o])=>o&&o.visible&&(id!=='ball'||career.inventory.toy===1)&&(id!=='box'||career.inventory.box===1)).map(([id,o])=>{const p=o.getWorldPosition(new T.Vector3());p.y+=id==='memory'?.42:.35;p.project(camera);return {id,x:(p.x+1)*width/2,y:(1-p.y)*height/2,visible:p.z>=-1&&p.z<=1&&Math.abs(p.x)<.95&&Math.abs(p.y)<.95};});}
 function dispose(){delete ball.userData.souvenir;model.remove(root);const geometries=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials){m.map?.dispose();m.dispose();}}
 sync();return {sync,pick,markers,dispose};
}
