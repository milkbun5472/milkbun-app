export function createDomesticView(T,{scene,getTask,getPlace,getHand,getBatches}){
 const root=new T.Group();root.name='home-living-tray';scene.add(root);const material=color=>new T.MeshStandardMaterial({color,roughness:.9});
 const plate=new T.Mesh(new T.CylinderGeometry(.32,.3,.035,28),material('#dfc5b3'));root.add(plate);
 const bowl=new T.Mesh(new T.SphereGeometry(.16,20,12,0,Math.PI*2,0,Math.PI/2),material('#f4e8d9'));bowl.rotation.x=Math.PI;root.add(bowl);
 const food=new T.Group();for(let i=0;i<8;i++){const m=new T.Mesh(new T.SphereGeometry(.04,10,8),material('#b7936c'));m.position.set(Math.sin(i*2.4)*.16,.035,Math.cos(i*2.4)*.16);food.add(m);}root.add(food);
 const spoon=new T.Mesh(new T.CylinderGeometry(.018,.018,.22,10),material('#b88e68'));scene.add(spoon);
 const gift=new T.Mesh(new T.BoxGeometry(.2,.11,.2),material('#c5a3ae'));root.add(gift);
 let point={x:-.28,z:.55};
 function sync(){const t=getTask(),b=getBatches();if(t?.point)point=t.point;root.visible=getPlace()==='home'&&(!!t||b.length>0);root.position.set(point.x,.1,point.z);plate.visible=root.visible;bowl.visible=t?.kind==='cook'&&t.phase==='mix';food.visible=!!b.length||t?.kind==='cook'&&t.phase==='portion';gift.visible=t?.kind==='celebrate'&&!!t.gift;gift.position.set(.15,.075,.05);spoon.visible=root.visible&&t?.kind==='cook'&&['mix','portion'].includes(t.phase);if(spoon.visible){const hand=getHand(t);if(hand){spoon.position.copy(hand);spoon.rotation.set(.6,0,Math.sin(t.time*3)*.45);}else{spoon.position.set(point.x+Math.sin(t.time*3)*.12,.23,point.z+Math.cos(t.time*3)*.12);spoon.rotation.z=.4;}}}
 return {sync,snapshot:()=>({visible:root.visible,spoon:spoon.visible,point:{...point},gift:gift.visible})};
}
