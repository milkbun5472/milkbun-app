import * as T from 'three';
import {HOME_COOK,HOME_PREP,furniturePoint} from './home-catalog.mjs?v=fg-d74ba995b6579beb';
import {makeRecipeFood,disposeFood} from './recipe-food.mjs?v=fg-d74ba995b6579beb';
export function createKitchenView(){
 let root=null,group=null,key='',hidden=[],cover=null,food=null,appliance=[],mixing=null;
 function clear(){for(const [o,visible]of hidden)o.visible=visible;hidden=[];disposeFood(group);group=null;key='';cover=food=mixing=null;appliance=[];}
 function update(view,map,job,shared,stage,time){
  const active=!!job&&(map?.id||map?.renderer)==='dayHome'&&shared?.kind===job.kind&&shared.phase==='active',next=active?job.id+':'+job.kind:'';
  if(view!==root||key!==next){clear();root=view;if(!active||!view)return;key=next;group=new T.Group();group.name='KitchenRecipeScene';group.userData={id:job.id,recipeId:job.recipeId,kind:job.kind,method:stage.method};view.add(group);
   const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.8}),mesh=(geo,c,x,y,z,name)=>{const o=new T.Mesh(geo,mat(c));o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
   if(job.kind==='cook'){
    const spot=map.spots.find(s=>s.action==='cook'),piece=map.furniture.find(p=>p.id===spot?.piece);if(!piece){clear();return;}
    group.position.set(piece.x,0,piece.z);group.rotation.y=piece.heading||0;
    const furniture=view.getObjectByName(piece.id);furniture?.traverse(o=>{if(/^(CookingPotBody|CookingPotLid|PreparationIngredients)$/.test(o.name)){hidden.push([o,o.visible]);o.visible=false;}});
    const {x,z,contactY:y}=HOME_COOK,method=stage.method;
    if(['fry','stir'].includes(method)){mesh(new T.CylinderGeometry(.22,.2,.045,24),'#5c645d',x,y-.035,z,'RecipeFryingPan');mesh(new T.BoxGeometry(.055,.04,.28),'#947658',x,y-.025,z+.25,'PanHandle');}
    else if(method==='steam'){for(let i=0;i<2;i++)mesh(new T.CylinderGeometry(.2,.19,.065,24),'#c4a472',x,y-.10+i*.06,z,'RecipeSteamer');cover=mesh(new T.CylinderGeometry(.2,.2,.025,24),'#d4b886',x,y+.05,z,'SteamerLid');}
    else if(method==='bake'){mesh(new T.BoxGeometry(.57,.36,.43),'#e6dcc5',x,y-.08,z,'RecipeOven');mesh(new T.BoxGeometry(.46,.24,.018),'#6e776c',x,y-.08,z+.22,'OvenWindow');mesh(new T.BoxGeometry(.28,.02,.035),'#c1aa7b',x,y+.025,z+.25,'OvenHandle');}
    else if(method==='mix'){mesh(new T.CylinderGeometry(.23,.13,.09,24),'#b5c9ae',x,y-.035,z,'RecipeMixingBowl');}
    else if(method==='brew'){mesh(new T.SphereGeometry(.14,18,12),'#c9b694',x,y-.015,z,'RecipeTeaPot');mesh(new T.CylinderGeometry(.018,.03,.15,12),'#c9b694',x+.15,y+.04,z,'TeaSpout').rotation.z=-.7;cover=mesh(new T.CylinderGeometry(.09,.09,.02,18),'#eee2c7',x,y+.12,z,'TeaLid');}
    else {mesh(new T.CylinderGeometry(.2,.17,.15,24),'#8ca293',x,y-.072,z,'RecipeSoupPot');}
    if(['bake','brew'].includes(method)){appliance=group.children.slice();mixing=mesh(new T.CylinderGeometry(.20,.12,.10,24),'#b5c9ae',x,y-.043,z,'RecipeMixingBowl');}
    food=makeRecipeFood(job.recipeId,{vessel:false});if(food){food.scale.setScalar(.65);food.position.set(x,y-.015,z);group.add(food);}
    const prep=makeRecipeFood(job.recipeId,{vessel:false});if(prep){prep.scale.setScalar(.6);prep.position.set(HOME_PREP.x,HOME_PREP.contactY-.025,HOME_PREP.contactZ);group.add(prep);prep.name='RecipePreparation';}
   }else{
    // Use the table actually selected by the two occupied seats.
    const center={x:(shared.a.x+shared.b.x)/2,z:(shared.a.z+shared.b.z)/2},table=map.furniture.filter(p=>p.kind==='table'&&p.dining&&!p.stored).sort((a,b)=>Math.hypot(a.x-center.x,a.z-center.z)-Math.hypot(b.x-center.x,b.z-center.z))[0];if(!table){clear();return;}
    const furniture=view.getObjectByName(table.id);furniture?.traverse(o=>{if(/^(DiningTableware)$/.test(o.name)){hidden.push([o,o.visible]);o.visible=false;}});
    const courses=job.courses||[{recipeId:job.recipeId}];for(let i=0;i<courses.length;i++){const dish=makeRecipeFood(courses[i].recipeId);if(!dish)continue;const pos=furniturePoint(table,{x:(i-(courses.length-1)/2)*.47,z:0});dish.scale.setScalar(.72);dish.position.set(pos.x,.08+(table.top||.85)+.01,pos.z);dish.rotation.y=table.heading||0;group.add(dish);}
   }
  }
  if(group){group.userData.stage=stage.index;group.userData.label=stage.label;for(const o of appliance)o.visible=stage.index!==0;if(mixing)mixing.visible=stage.index===0;if(cover)cover.visible=stage.index===1;if(food)food.visible=!['bake','steam','brew'].includes(stage.method)||stage.index!==1;}
 }
 return {update,clear,inspect:()=>group?{...group.userData,visible:group.visible,foods:group.children.filter(o=>o.name==='RecipeFood').map(o=>({...o.userData,position:o.position.toArray()})),objects:group.children.map(o=>o.name)}:null};
}
