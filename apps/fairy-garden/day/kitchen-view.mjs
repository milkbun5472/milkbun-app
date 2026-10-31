import * as T from 'three';
import {makeIngredient} from './ingredient-visual.mjs?v=fg-bf2a8f69e3079bf5';
import {createTabletopView} from './tabletop-view.mjs?v=fg-bf2a8f69e3079bf5';
import {HOME_COOK,HOME_PREP,furniturePoint} from './home-catalog.mjs?v=fg-bf2a8f69e3079bf5';
import {makeRecipeFood,disposeFood} from './recipe-food.mjs?v=fg-bf2a8f69e3079bf5';
export function createKitchenView({actors=()=>[]}={}){
 let carries=[],carryKey='';
 function carry(job,shared){const walking=job?.kind==='meal'&&shared?.kind==='meal'&&shared.phase!=='active',next=walking?job.id:'';if(next!==carryKey){carries.forEach(disposeFood);carries=[];carryKey=next;if(walking){for(const [i,actor]of actors().entries()){if(!actor?.root)continue;const d=(job.courses||[{recipeId:job.recipeId}])[i%(job.courses?.length||1)],g=makeRecipeFood(d.recipeId,{variation:d.variation,finish:d.finish,tabletop:d.tabletop});if(g){g.name='CarriedMealPlate';g.scale.setScalar(.7);g.position.set(0,.93,.34);actor.root.add(g);carries.push(g);}}}}if(walking)for(const actor of actors()){if(!actor?.root.visible)continue;actor.root.updateMatrixWorld(true);actor.contactPose({left:actor.root.localToWorld(new T.Vector3(-.17,1.02,.33)),right:actor.root.localToWorld(new T.Vector3(.17,1.02,.33))});}}
 let root=null,group=null,key='',hidden=[],cover=null,food=null,appliance=[],mixing=null,prep=null,knob=null,steam=null,targets=[],tabletop=null,interaction=null,serving=null,servingTray=null;
 function clearVisual(){tabletop?.clear();tabletop=null;for(const [o,visible]of hidden)o.visible=visible;hidden=[];disposeFood(group);group=null;key='';cover=food=mixing=prep=knob=steam=serving=servingTray=null;appliance=[];targets=[];}
 function update(view,map,job,shared,stage,time,drag=null){
  carry(job,shared);
  const active=!!job&&(map?.id||map?.renderer)==='dayHome'&&((shared?.kind===job.kind&&(shared.phase==='active'||shared.moment))||(job.kind==='cook'&&stage.passive)||(job.kind==='meal'&&shared?.kind==='feed'&&shared.tableMeal)),next=active?job.id+':'+job.kind+':'+JSON.stringify(job.cooking?.variation||{}):'';
  if(view!==root||key!==next){clearVisual();root=view;if(!active||!view)return;key=next;group=new T.Group();group.name='KitchenRecipeScene';group.userData={id:job.id,recipeId:job.recipeId,kind:job.kind,method:stage.method};view.add(group);
   const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.8}),mesh=(geo,c,x,y,z,name)=>{const o=new T.Mesh(geo,mat(c));o.name=name;o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);return o;};
   if(job.kind==='cook'){
    const spot=map.spots.find(s=>s.action==='cook'),piece=map.furniture.find(p=>p.id===spot?.piece);if(!piece){clearVisual();return;}
    group.position.set(piece.x,0,piece.z);group.rotation.y=piece.heading||0;
    const furniture=view.getObjectByName(piece.id);furniture?.traverse(o=>{if(/^(CookingPotBody|CookingPotLid|PreparationIngredients)$/.test(o.name)){hidden.push([o,o.visible]);o.visible=false;}});
    const {x,z,contactY:y}=HOME_COOK,method=stage.method;
    if(!stage.tabletop){
    if(['fry','stir'].includes(method)){mesh(new T.CylinderGeometry(.22,.2,.045,24),'#5c645d',x,y-.035,z,'RecipeFryingPan');mesh(new T.BoxGeometry(.055,.04,.28),'#947658',x,y-.025,z+.25,'PanHandle');}
    else if(method==='steam'){for(let i=0;i<2;i++)mesh(new T.CylinderGeometry(.2,.19,.065,24),'#c4a472',x,y-.10+i*.06,z,'RecipeSteamer');cover=mesh(new T.CylinderGeometry(.2,.2,.025,24),'#d4b886',x,y+.05,z,'SteamerLid');}
    else if(method==='bake'){mesh(new T.BoxGeometry(.57,.36,.43),'#e6dcc5',x,y-.08,z,'RecipeOven');mesh(new T.BoxGeometry(.46,.24,.018),'#6e776c',x,y-.08,z+.22,'OvenWindow');mesh(new T.BoxGeometry(.28,.02,.035),'#c1aa7b',x,y+.025,z+.25,'OvenHandle');}
    else if(method==='mix'){mesh(new T.CylinderGeometry(.23,.13,.09,24),'#b5c9ae',x,y-.035,z,'RecipeMixingBowl');}
    else if(method==='brew'){mesh(new T.SphereGeometry(.14,18,12),'#c9b694',x,y-.015,z,'RecipeTeaPot');mesh(new T.CylinderGeometry(.018,.03,.15,12),'#c9b694',x+.15,y+.04,z,'TeaSpout').rotation.z=-.7;cover=mesh(new T.CylinderGeometry(.09,.09,.02,18),'#eee2c7',x,y+.12,z,'TeaLid');}
    else {mesh(new T.CylinderGeometry(.2,.17,.15,24),'#8ca293',x,y-.072,z,'RecipeSoupPot');}
    if(['bake','brew'].includes(method)){appliance=group.children.slice();mixing=mesh(new T.CylinderGeometry(.20,.12,.10,24),'#b5c9ae',x,y-.043,z,'RecipeMixingBowl');}
    }
    if(stage.tabletop){tabletop=createTabletopView(group,job);}
    else{
    food=makeRecipeFood(job.recipeId,{vessel:false,variation:job.cooking?.variation});if(food){food.scale.setScalar(.65);food.position.set(x,y-.015,z);group.add(food);}
    prep=new T.Group();prep.name='RecipePreparation';prep.position.set(HOME_PREP.x,HOME_PREP.contactY,HOME_PREP.contactZ);group.add(prep);
    const rawIngredients=Object.entries(globalThis.CharDayKitchen.recipeInfo(job.recipeId,job.cooking?.variation).need);for(const [i,[ingredient]]of rawIngredients.entries()){const o=makeIngredient({ingredient,w:.22,d:.18,h:.14,zone:'basket'},method);o.position.set((i%3-1)*.17,0,(Math.floor(i/3)-.5)*.14);prep.add(o);}
    serving=makeRecipeFood(job.recipeId,{variation:job.cooking?.variation});serving.name='RecipeServingPlate';serving.scale.setScalar(.75);serving.position.set(x,y,z);group.add(serving);servingTray=mesh(new T.BoxGeometry(.55,.018,.32),'#a3b298',x+.65,y,z,'RecipeServingTray');
    if(['bake','steam'].includes(method)){const rolling=new T.Group();rolling.name='RecipeRollingPin';rolling.position.set(HOME_PREP.x,HOME_PREP.contactY+.09,HOME_PREP.contactZ+.22);for(const [radius,length,offset]of [[.038,.28,0],[.018,.09,-.18],[.018,.09,.18]]){const o=new T.Mesh(new T.CylinderGeometry(radius,radius,length,16),mat('#b3936d'));o.rotation.z=Math.PI/2;o.position.x=offset;rolling.add(o);}group.add(rolling);}
    
    const target=(id,tx,ty,tz)=>{const o=mesh(new T.BoxGeometry(.60,.06,.43),'#97b086',tx,ty,tz,'KitchenTarget:'+id);o.userData.kitchenTarget=id;o.castShadow=o.receiveShadow=false;o.material.transparent=true;o.material.opacity=.13;targets.push(o);return o;};
    target('prep',HOME_PREP.x,HOME_PREP.contactY+.01,HOME_PREP.contactZ);target('pan',x,y+.015,z);target('serve',x,y+.015,z);
    knob=mesh(new T.CylinderGeometry(.055,.055,.022,16),'#d9c69b',x+.30,y-.055,z+.18,'KitchenHeatKnob');knob.rotation.x=Math.PI/2;knob.userData.kitchenTarget='heat';targets.push(knob);
    steam=new T.Group();steam.name='KitchenSteam';for(let i=0;i<5;i++){const o=new T.Mesh(new T.SphereGeometry(.022,8,6),new T.MeshBasicMaterial({color:'#f8f3de',transparent:true,opacity:.22,depthWrite:false}));o.position.set(x+(i%2-.5)*.07,y+.15+i*.08,z);steam.add(o);}group.add(steam);
    }
   }else{
    // Use the table actually selected by the two occupied seats.
    const seats=shared.mealSeats||shared.seats||shared,center={x:(seats.a.x+seats.b.x)/2,z:(seats.a.z+seats.b.z)/2},table=map.furniture.filter(p=>p.kind==='table'&&p.dining&&!p.stored).sort((a,b)=>Math.hypot(a.x-center.x,a.z-center.z)-Math.hypot(b.x-center.x,b.z-center.z))[0];if(!table){clearVisual();return;}
    const furniture=view.getObjectByName(table.id);furniture?.traverse(o=>{if(/^(DiningTableware)$/.test(o.name)){hidden.push([o,o.visible]);o.visible=false;}});
    const courses=job.courses||[{recipeId:job.recipeId}];for(let i=0;i<courses.length;i++){const dish=makeRecipeFood(courses[i].recipeId,{variation:courses[i].variation,finish:courses[i].finish,tabletop:courses[i].tabletop});if(!dish)continue;const pos=furniturePoint(table,{x:(i-(courses.length-1)/2)*.47,z:0});dish.scale.setScalar(.72);dish.position.set(pos.x,.08+(table.top||.85)+.01,pos.z);dish.rotation.y=table.heading||0;group.add(dish);}
   }
  }
  if(group){tabletop?.update(stage,time,drag);group.userData.tabletop=tabletop?.inspect();group.userData.stage=stage.index;group.userData.label=stage.label;for(const o of appliance)o.visible=stage.index!==0;if(mixing)mixing.visible=stage.index===0;if(cover)cover.visible=stage.index===1;if(food)food.visible=stage.index===1&&(!['bake','steam','brew'].includes(stage.method)||stage.index!==1);if(prep){prep.visible=stage.index===0;prep.children.forEach(o=>{const n=stage.operation==='knead'&&o.userData.ingredient==='flour'?(stage.progress?.work||0):0;o.scale.set(1+n*.04,1-n*.055,1+n*.04);});}if(serving)serving.visible=stage.index>=2;if(servingTray)servingTray.visible=stage.index===2;const rolling=group.getObjectByName('RecipeRollingPin');if(rolling)rolling.visible=stage.index===0;
   for(const o of targets){const id=o.userData.kitchenTarget;o.visible=!!job.cooking&&!stage.ready&&(id===stage.target||id==='heat'&&stage.index===1&&stage.method!=='mix');if(id!=='heat')o.material.opacity=.10+Math.sin(time*3)*.045;}
   if(food&&stage.index===1&&!stage.passive){const n=(stage.progress?.work||0)/Math.max(1,stage.required||6);food.rotation.x=stage.operation==='flip'?n*Math.PI*2:0;food.rotation.y=stage.operation==='flip'?0:n*Math.PI*2;food.position.y=HOME_COOK.contactY-.015+(stage.operation==='flip'?Math.sin(n*Math.PI)*.12:0);}
   if(knob)knob.rotation.y=(stage.progress?.heat||0)*Math.PI/3;
   if(steam){steam.visible=stage.index===1;steam.children.forEach((o,i)=>{o.position.y=HOME_COOK.contactY+.14+((time*.12+i*.08)%.38);o.scale.setScalar(.8+i*.13);});}
}
 }
 function stationObjects(id,stage){
  if(!group)return {root:null,objects:[]};const out=[];
  const add=(object,zone,tag)=>{if(object)out.push({object,zone,tag});};
  if(tabletop){const g=tabletop.root;for(const o of g.children){const tag=o.userData.tabletop,name=o.name;let zone=tag?.zone;
    if(name==='IngredientBasket'||name==='BasketEdge'){zone='basket';if(id==='basket')add(o,zone,{type:'basket',zone});}
    else if(tag&&((id==='pan'&&['pan','plate'].includes(zone)&&tag.type!=='sauce')||(id==='plate'&&['plate','tray'].includes(zone)&&tag.type!=='sauce')||(id==='sauce'&&['plate','tray'].includes(zone))||(id==='heat'&&tag.type==='heat')||(id==='basket'&&zone==='tray'))){add(o,zone,tag);}
    else if(o.userData.id){if(['pan','plate','sauce'].includes(id)&&(['pan','plate'].includes(o.userData.tabletop?.zone)))add(o,o.userData.tabletop.zone,o.userData.tabletop);}
    else if(!name&&o.isGroup){for(const q of o.children){const t=q.userData.tabletop;if(t&&((id==='basket'&&['basket','board'].includes(t.zone))||(id==='pan'&&['pan','plate'].includes(t.zone))||(['plate','sauce'].includes(id)&&t.zone==='plate')))add(q,t.zone,t);}}
    if(name==='SauceBottle'||name==='SauceCap'){if(id==='sauce')add(o,'sauce',tag||{type:'sauce',zone:'plate'});}if(name==='InteractiveHeatKnob'&&id==='pan'){} // Included with the pan tag above.
   }
   if(id==='basket')add(g.getObjectByName('CookingKnife'),'board',{type:'knife',zone:'board'});
   // Saved garnish and sauce are the actual existing plate layer.
   for(const o of g.children)if(o.userData.tabletop&&o.userData.tabletop.pieces!=null&&['plate','sauce','pan'].includes(id))add(o,'plate',null);
   return {root:group,objects:out,tabletop:true};
  }
  if(id==='prep'){for(const [i,o]of (prep?.children||[]).entries())add(o,'prep',{type:'legacy',target:'prep',id:'prep-'+i});add(group.getObjectByName('RecipeRollingPin'),'prep',{type:'legacy',target:'prep'});if(mixing)add(mixing,'pan',{type:'legacy',target:'prep'});}
  if(id==='pan'){for(const o of group.children)if(/^(RecipeFryingPan|PanHandle|RecipeSteamer|SteamerLid|RecipeOven|OvenWindow|OvenHandle|RecipeTeaPot|TeaSpout|TeaLid|RecipeSoupPot|RecipeMixingBowl)$/.test(o.name))add(o,'pan',{type:'legacy',target:'pan'});add(food,'pan',null);}
  if(id==='heat')add(knob,'pan',{type:'heat',zone:'pan'});
  if(id==='plate'){add(serving,'pan',{type:'legacy-plate',target:'serve'});add(servingTray,'legacyTray',{type:'legacy-tray'});}
  return {root:group,objects:out,tabletop:false};
 }
 function clear(){clearVisual();carries.forEach(disposeFood);carries=[];carryKey='';}
 return {update,clear,stationObjects,targets:()=>tabletop?tabletop.targets():targets.filter(o=>o.visible),tabletop:()=>tabletop,inspect:()=>group?{...group.userData,visible:group.visible,foods:group.children.filter(o=>o.name==='RecipeFood').map(o=>({...o.userData,position:o.position.toArray()})),objects:group.children.map(o=>o.name)}:null};
}
