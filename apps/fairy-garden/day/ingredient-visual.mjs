import * as T from 'three';
import './kitchen.js?v=fg-bf2a8f69e3079bf5';
// Raw, cut, cooked and plated pieces use one geometry source.
export function makeIngredient(p,method='stir',{live=false}={}){
 const K=globalThis.CharDayKitchen,g=new T.Group();g.name='Ingredient:'+p.id;g.userData={ingredient:p.ingredient,id:p.id};
 const base=new T.Color(method==='mix'&&p.ingredient==='chicken'?'#d6b887':K.FOOD_COLORS[p.ingredient]);
 const color=base.clone().lerp(new T.Color('#b99362'),live||method==='mix'?0:((p.top||0)+(p.bottom||0))/2*.43),cream='#eee0bd',green='#718b61';
 const mesh=(geo,c,x=0,y=0,z=0)=>{const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:c,roughness:.86}));m.material.userData.tableBase=m.material.color.clone();m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;g.add(m);return m;};
 const ball=(c,x=0,y=.07,z=0,w=.11,h=.07,d=.09)=>{const m=mesh(new T.SphereGeometry(1,14,10),c,x,y,z);m.scale.set(w,h,d);return m;},box=(c,w=.22,h=.1,d=.18,y=h/2)=>mesh(new T.BoxGeometry(w,h,d),c,0,y,0);
 if(p.cut){if(['tomato','apple','lemon','pumpkin','potato','berry'].includes(p.ingredient)){const m=mesh(new T.CylinderGeometry(1,1,p.h*.72,16,1,false,-Math.PI/2,Math.PI),color,0,p.h*.36,0);m.scale.set(p.w/2,1,p.d);m.position.z=-p.d/2;}else if(['carrot','corn'].includes(p.ingredient)){const m=mesh(new T.CylinderGeometry(1,1,p.h*.65,14),color,0,p.h*.325,0);m.scale.set(p.w/2,1,p.d/2);}else if(p.ingredient==='greens'){for(let i=0;i<3;i++)ball(color,(i%2-.5)*p.w*.4,.02+i*.007,(i-1)*p.d*.22,p.w*.32,.012,p.d*.3);return g;}else box(color,p.w,p.h*.72,p.d);const top=box(base.clone().lerp(new T.Color(cream),.25),p.w*.82,.004,p.d*.82,p.h*.72+.002);top.name='CutSurface';return g;}
 if(['tomato','apple','potato','lemon','pumpkin','berry'].includes(p.ingredient)){
  ball(color,0,.075,0,.105,.085,p.ingredient==='lemon'?.07:.09);if(p.ingredient!=='potato')mesh(new T.CylinderGeometry(.009,.014,.045,7),'#877251',0,.16,0);
  if(['tomato','pumpkin','berry'].includes(p.ingredient))for(let i=0;i<4;i++){const leaf=ball(green,Math.sin(i*1.57)*.027,.15,Math.cos(i*1.57)*.027,.035,.006,.014);leaf.rotation.y=-i*1.57;}
 }else if(p.ingredient==='carrot'){const m=mesh(new T.ConeGeometry(.055,.23,12),color,0,.05,0);m.rotation.z=-Math.PI/2;for(let i=0;i<3;i++)ball(green,-.12,.065,(i-1)*.023,.034,.013,.009);}
 else if(p.ingredient==='mushroom'){mesh(new T.CylinderGeometry(.024,.034,.09,10),cream,0,.05,0);ball(color,0,.105,0,.105,.045,.09);}
 else if(p.ingredient==='egg'){if(['pan','plate'].includes(p.zone)){for(let i=0;i<4;i++)ball(i%2?'#edd29b':'#efc97e',(i%2-.5)*.075,.035,(Math.floor(i/2)-.5)*.06,.06,.035,.05);}else ball(color,0,.095,0,.07,.095,.07);}
 else if(p.ingredient==='shrimp'){const m=mesh(new T.TorusGeometry(.064,.024,7,16,Math.PI*1.5),color,0,.036,0);m.rotation.x=Math.PI/2;box(color,.045,.02,.07);}
 else if(p.ingredient==='greens'){for(let i=0;i<4;i++){const m=ball(color,(i%2-.5)*.07,.025+i*.008,(Math.floor(i/2)-.5)*.07,.075,.014,.042);m.rotation.y=i*.9;}}
 else if(p.ingredient==='rice'){for(let i=0;i<13;i++)ball(color,Math.sin(i*2.4)*.065,.02+(i%3)*.015,Math.cos(i*2.4)*.055,.024,.012,.014);}
 else if(p.ingredient==='noodle'){for(let i=0;i<4;i++){const m=mesh(new T.TorusGeometry(.06+i*.007,.01,5,16,Math.PI*1.7),color,0,.015+i*.01,0);m.rotation.set(Math.PI/2,0,i);}}
 else if(['milk','tea'].includes(p.ingredient)){mesh(new T.CylinderGeometry(.06,.07,.15,16),color,0,.075,0);mesh(new T.CylinderGeometry(.035,.035,.02,12),p.ingredient==='tea'?green:'#b8cbbf',0,.16,0);}
 else if(p.ingredient==='flour'){ball(color,0,.065,0,.095+(p.knead||0)*.035,.065-(p.knead||0)*.035,.085);}
 else if(p.ingredient==='corn'){const c=mesh(new T.CylinderGeometry(.045,.045,.22,12),color,0,.06,0);c.rotation.z=Math.PI/2;for(let i=0;i<5;i++)ball('#ebd69e',(i-2)*.04,.104,0,.012,.009,.018);}
 else if(p.ingredient==='bread'){box('#ba946b',.22,.08,.18);box(cream,.19,.006,.15,.083);}
 else if(p.ingredient==='cheese'){box(color,.2,.06,.16);for(let i=0;i<3;i++)ball('#bb9d63',(i-1)*.05,.063,(i%2-.5)*.06,.016,.002,.011);}
 else {box(color,.22,p.ingredient==='tofu'?.10:.065,.18);if(['chicken','beef','fish'].includes(p.ingredient))for(let i=0;i<3;i++){const line=box(base.clone().lerp(new T.Color(cream),.35),.012,.003,.14,.068);line.position.x=(i-1)*.055;line.rotation.y=.2;}}
 return g;
}
export function makeTabletopPlate(table,method='stir',variation={}){
 const K=globalThis.CharDayKitchen,t=K.tableState(table),g=new T.Group();if(!t)return g;
 const rim=new T.Mesh(new T.CylinderGeometry(.285,.26,.025,32),new T.MeshStandardMaterial({color:'#f0e4ce',roughness:.8}));g.add(rim);
 for(const p of t.items.filter(p=>p.zone==='plate')){const o=makeIngredient(p,method);o.position.set(p.x-K.TABLE_ZONES.plate.x,.02,p.z-K.TABLE_ZONES.plate.z);g.add(o);}
 if(variation.garnish){for(let i=0;i<4;i++){const leaf=new T.Mesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:'#718b61',roughness:.85}));leaf.scale.set(.025,.005,.012);leaf.position.set(Math.cos(i*2.4)*.19,.04,Math.sin(i*2.4)*.19);leaf.name='PlateGarnish';g.add(leaf);}}
 if(variation.spice&&variation.spice!=='none'){for(let i=0;i<(variation.spice==='hot'?6:3);i++){const chili=new T.Mesh(new T.BoxGeometry(.02,.006,.015),new T.MeshStandardMaterial({color:'#b56849',roughness:.85}));chili.position.set(Math.cos(i*2.4)*.14,.135,Math.sin(i*2.4)*.14);chili.name='PlateSpice';g.add(chili);}}
 if(t.sauce.length>1){const points=t.sauce.map(q=>new T.Vector3(q.x-K.TABLE_ZONES.plate.x,.14,q.z-K.TABLE_ZONES.plate.z));const curve=new T.CatmullRomCurve3(points);g.add(new T.Mesh(new T.TubeGeometry(curve,Math.min(80,points.length*2),.008,5,false),new T.MeshStandardMaterial({color:variation.spice==='hot'?'#a76c52':'#bd925f',roughness:.8})));}
 g.userData.tabletop={pieces:t.items.length,sauce:t.sauce.length,order:t.order};return g;
}
