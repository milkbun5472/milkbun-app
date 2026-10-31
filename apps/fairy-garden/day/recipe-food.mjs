import * as T from 'three';
import {makeIngredient,makeTabletopPlate} from './ingredient-visual.mjs?v=fg-90b53e2779ab7a1c';
import './kitchen.js?v=fg-90b53e2779ab7a1c';
// The same geometry makes plated food, food in cookware and the held serving.
export function disposeFood(group){group?.removeFromParent();group?.traverse(o=>{o.geometry?.dispose();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});}
export function makeRecipeFood(recipeId,{vessel=true,variation=null,finish='',tabletop=null}={}){
 const r=globalThis.CharDayKitchen.recipeInfo(recipeId,variation);if(!r)return null;
 const g=new T.Group();g.name='RecipeFood';g.userData={recipeId:r.id,shape:r.food,variation:r.variation};
 if(tabletop&&vessel){const plate=makeTabletopPlate(tabletop,r.method,r.variation);g.add(plate);g.userData.tabletop=plate.userData.tabletop;g.userData.biteColor=globalThis.CharDayKitchen.FOOD_COLORS[r.topping]||'#bc9b71';return g;}
 const colors={tofu:'#ebdfc7',carrot:'#dba270',tomato:'#d87955',mushroom:'#9e8065',shrimp:'#e6a48a',beef:'#93654b',chicken:'#d6b887',corn:'#e8c774',greens:'#7d9e65',lemon:'#e8d586',egg:'#e9bd60',pumpkin:'#dfa16a',berry:'#cd6b76',apple:'#c4a872',butter:'#dbc594'};
 const color=colors[r.topping]||'#ab9876',cream='#f5e5c5',green='#799469';g.userData.biteColor=color;
 function mesh(shape,c,x=0,y=0,z=0,name='Food'){const o=new T.Mesh(shape,new T.MeshStandardMaterial({color:c,roughness:.85}));o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o;}
 const ball=(c,x,y,z,a=.07,b=a,d=a)=>{const o=mesh(new T.SphereGeometry(1,12,8),c,x,y,z);o.scale.set(a,b,d);return o;},disc=(c,x,y,z,rad=.2,h=.02)=>mesh(new T.CylinderGeometry(rad,rad*.92,h,24),c,x,y,z),cube=(c,x,y,z,w=.1,h=.06,d=.09)=>mesh(new T.BoxGeometry(w,h,d),c,x,y,z);
 const noodles=(y=.07)=>{for(let i=0;i<6;i++){const o=mesh(new T.TorusGeometry(.095+i*.01,.012,5,18,Math.PI*1.5),cream,(i%2-.5)*.05,y+i*.005,0);o.rotation.set(Math.PI/2,0,i*.7);}};
 for(const [ingredient,n]of Object.entries(r.variation.addins)){for(let i=0;i<n;i++){const o=makeIngredient({id:'extra-'+ingredient+i,ingredient,w:.075,d:.06,h:.045,cut:true,top:1,bottom:1},r.method);o.position.set(Math.cos(i*2.4+Object.keys(r.variation.addins).indexOf(ingredient)*2)*.11,.11,Math.sin(i*2.4+Object.keys(r.variation.addins).indexOf(ingredient)*2)*.11);g.add(o);}}
 if(vessel){if(r.food==='drink'){const cup=mesh(new T.CylinderGeometry(.12,.09,.24,24),cream,0,.12,0,'ServingCup');const handle=mesh(new T.TorusGeometry(.065,.012,8,18),cream,.145,.12,0,'CupHandle');disc(r.topping==='berry'?'#e6b4b7':'#b89862',0,.243,0,.102,.006);if(r.topping!=='berry'){const o=disc(color,.025,.25,0,.052,.01);o.rotation.z=.15;}else ball(color,.03,.25,.02,.022);return g;}
  if(['soup','hotpot','porridge','noodle'].includes(r.food)){mesh(new T.CylinderGeometry(.235,.17,.11,24),cream,0,.035,0,'ServingBowl');disc(r.food==='porridge'?'#e6d8ae':r.topping==='pumpkin'?color:'#c8a87b',0,.092,0,.21,.005);}
  else disc(cream,0,.01,0,.27,.022);
 }
 if(r.food==='drink'&&!vessel){for(let i=0;i<4;i++){if(r.topping==='lemon'||r.topping==='apple')disc(color,(i%2-.5)*.12,.02,(Math.floor(i/2)-.5)*.12,.045,.014);else ball(color,(i%2-.5)*.12,.03,(Math.floor(i/2)-.5)*.12,.035,.035,.035);}for(let i=0;i<3;i++)ball(green,-.09+i*.07,.017,.11,.023,.005,.01);return g;}
 const y=vessel&&['soup','hotpot','porridge','noodle'].includes(r.food)?.095:.035;
 if(r.food==='rice'){ball(cream,-.07,y+.055,0,.145,.065,.16);for(let i=0;i<9;i++)cube(color,.02+(i%3)*.053,y+.055+(i%2)*.018,-.09+Math.floor(i/3)*.06,.06,.04,.055);}
 if(r.food==='noodle')noodles(y);
 if(['stirfry','soup','hotpot','porridge','salad','noodle'].includes(r.food)){for(let i=0;i<9;i++){const a=i*2.4,x=Math.cos(a)*(.09+i*.009),z=Math.sin(a)*(.09+i*.009);if(r.food==='salad')ball(green,x,y+.03,z,.075,.025,.048);cube(i%3===0?'#ede0b7':color,x,y+.035,z,.07,.05,.06);}}
 if(r.food==='tofu'){for(let i=0;i<4;i++){cube('#d9be8b',(i%2-.5)*.17,y+.035,(Math.floor(i/2)-.5)*.16,.145,.07,.13);cube(green,(i%2-.5)*.17,y+.073,(Math.floor(i/2)-.5)*.16,.08,.004,.02);}}
 if(r.food==='fish'){ball('#dda68a',0,y+.04,0,.19,.05,.09);for(let i=0;i<4;i++){const o=cube('#f3d4b3',-.1+i*.065,y+.081,0,.012,.004,.15);o.rotation.y=.32;}disc('#e8d586',.14,y+.06,.11,.07,.014);}
 if(r.food==='gratin'){cube('#dfb767',0,y+.04,0,.36,.07,.27);for(let i=0;i<9;i++)ball(i%2?color:'#b1844d',-.12+(i%3)*.12,y+.08,-.08+Math.floor(i/3)*.08,.03,.005,.028);}
 if(r.food==='dumpling'){for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const o=ball(cream,Math.cos(a)*.14,y+.05,Math.sin(a)*.14,.09,.05,.048);o.rotation.y=-a;for(let j=0;j<3;j++)cube('#dcc9a2',Math.cos(a)*.14+j*.014-.014,y+.1,Math.sin(a)*.14,.007,.008,.028);}}
 if(r.food==='bun'){for(let i=0;i<4;i++){const x=(i%2-.5)*.18,z=(Math.floor(i/2)-.5)*.17;ball(color,x,y+.055,z,.085,.064,.08);ball('#efcf9c',x,y+.12,z,.02,.009,.02);}}
 if(['toast','sandwich'].includes(r.food)){cube('#bf9363',0,y+.03,0,.35,.07,.28);cube('#efddb5',0,y+.07,0,.31,.009,.24);if(r.food==='toast'){ball('#faf0d8',0,y+.082,0,.115,.015,.092);ball('#ebbe57',.02,y+.1,0,.045,.018,.045);}else{cube(green,0,y+.09,0,.33,.018,.26);cube('#d87555',0,y+.11,0,.29,.018,.23);cube('#e8c479',0,y+.13,0,.32,.018,.24);cube('#efddb5',0,y+.17,0,.34,.055,.27);}}
 if(r.food==='pancake'){for(let i=0;i<3;i++)disc(i%2?'#cfaa74':'#e6c68e',0,y+.024+i*.034,0,.18-i*.012,.03);disc(cream,0,y+.115,0,.045,.015);for(let i=0;i<3;i++)ball(color,.09-i*.06,y+.14,.07,.035,.038,.035);}
 if(r.food==='cake'){disc('#d5ae7b',0,y+.075,0,.18,.14);disc('#f6e6ce',0,y+.15,0,.183,.025);for(let i=0;i<5;i++){const a=i*6.28/5;ball(color,Math.cos(a)*.12,y+.185,Math.sin(a)*.12,.035,.045,.035);}}
 if(r.food==='pie'){disc('#bf925f',0,y+.035,0,.21,.05);disc('#d5b084',0,y+.066,0,.18,.015);for(let i=0;i<5;i++){cube('#e8c996',-.14+i*.07,y+.08,0,.024,.015,.28);cube('#e8c996',0,y+.09,-.14+i*.07,.28,.015,.024);}}
 if(r.food==='cookie'){for(let i=0;i<5;i++){const a=i*6.28/5,x=Math.cos(a)*.14,z=Math.sin(a)*.14;disc('#d9b57f',x,y+.012,z,.073,.025);for(let j=0;j<3;j++)ball('#8c6650',x+(j-1)*.027,y+.029,z+(j%2)*.018,.009,.004,.009);}}
 if(r.food==='pudding'){mesh(new T.CylinderGeometry(.11,.15,.13,24),cream,0,y+.065,0);disc('#cf8b71',0,y+.135,0,.11,.012);ball(color,0,y+.17,0,.035,.04,.035);}
 if(!['drink','cake','pie','cookie','pudding','bun','pancake','toast','sandwich'].includes(r.food))for(let i=0;i<3;i++)ball(green,-.12+i*.1,y+.09,.12,.023,.008,.012);
 if(variation){
  if(r.variation.spice!=='none')for(let i=0;i<(r.variation.spice==='hot'?7:3);i++)cube('#b85d43',Math.cos(i*2.4)*.15,y+.10,Math.sin(i*2.4)*.15,.028,.007,.018);
  if(r.variation.garnish)for(let i=0;i<4;i++)ball(green,-.11+i*.075,y+.11,.06,.024,.006,.012);
  if(['煎得更香','烤色更深'].includes(finish))g.traverse(o=>{if(o.material?.color&&o.name==='Food')o.material.color.multiplyScalar(.9);});
 }
 return g;
}
