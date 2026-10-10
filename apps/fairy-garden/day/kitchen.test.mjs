import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,next){return s==='three'?{url:new URL('../vendor/three.module.js',import.meta.url).href,shortCircuit:true}:next(s,c);}});
const T=await import('three'),{makeRecipeFood,disposeFood}=await import('./recipe-food.mjs'),{createKitchenView}=await import('./kitchen-view.mjs'),{createSpaceView}=await import('./space-view.mjs'),{buildSpace}=await import('./spaces.mjs'),{HOME_COOK,furniturePoint}=await import('./home-catalog.mjs'),K=globalThis.CharDayKitchen;
test('32道成品有20种食物形状，实际几何有体积且可独立销毁',()=>{
 const shapes=new Set();for(const r of K.RECIPES){const food=makeRecipeFood(r.id);assert.equal(food.userData.recipeId,r.id);shapes.add(food.userData.shape);const bounds=new T.Box3().setFromObject(food);const size=bounds.getSize(new T.Vector3());assert.ok(size.x>.15&&size.x<.65&&size.y>.025&&size.y<.4&&size.z>.15&&size.z<.65,r.id);let disposed=0;food.traverse(o=>o.geometry?.addEventListener('dispose',()=>disposed++));disposeFood(food);assert.ok(disposed>0);}
 for(const r of K.RECIPES){const raw=makeRecipeFood(r.id,{vessel:false});const bounds=new T.Box3().setFromObject(raw);assert.ok(!bounds.isEmpty(),r.id+'必须有锅里和案板上的食材');disposeFood(raw);}
 assert.equal(shapes.size,20);assert.equal(makeRecipeFood('missing'),null);
});
test('七种锅具随实际旋转厨房定位，等待放盖、退出还原原厨具且不销毁地图',()=>{
 const placements={kitchen:{x:4,z:-3,heading:Math.PI/2}},map=buildSpace('dayHome',placements),view=createSpaceView('dayHome','warm',map,{furnitureOnly:true}),controller=createKitchenView(),piece=map.furniture.find(p=>p.id===map.spots.find(s=>s.action==='cook').piece),pos=furniturePoint(piece,HOME_COOK);
 const root=view.root||view;let destroyed=0;root.traverse(o=>o.geometry?.addEventListener('dispose',()=>destroyed++));
 const expected={stir:'RecipeFryingPan',fry:'RecipeFryingPan',boil:'RecipeSoupPot',steam:'RecipeSteamer',bake:'RecipeOven',mix:'RecipeMixingBowl',brew:'RecipeTeaPot'};
 for(const method of Object.keys(expected)){const r=K.RECIPES.find(r=>r.method===method),job={id:method,kind:'cook',recipeId:r.id};assert.equal(controller.inspect(),null);controller.update(root,map,job,{kind:'cook',phase:'walking-ta'},K.cookingStage(job,0));assert.equal(controller.inspect(),null);
  controller.update(root,map,job,{kind:'cook',phase:'active'},K.cookingStage(job,7));const appliance=root.getObjectByName(expected[method]);assert.ok(appliance);root.updateMatrixWorld(true);const world=appliance.getWorldPosition(new T.Vector3());assert.ok(Math.abs(world.x-pos.x)<1e-6&&Math.abs(world.z-pos.z)<1e-6,method);assert.equal(root.getObjectByName('CookingPotBody').visible,false);controller.clear();assert.equal(root.getObjectByName('CookingPotBody').visible,true);assert.equal(destroyed,0);}
});
test('一桌三道沿两人实际餐椅挑餐桌，菜盘落在桌面上并保留原桌具',()=>{
 const map=buildSpace('dayHome'),view=createSpaceView('dayHome','warm',map,{furnitureOnly:true}),root=view.root||view,controller=createKitchenView(),table=map.furniture.find(p=>p.kind==='table'&&p.dining),job={id:'meal',kind:'meal',recipeId:'lemon-fish',dishIds:['a','b','c'],courses:[{recipeId:'lemon-fish'},{recipeId:'berry-cake'},{recipeId:'lemon-tea'}]};
 controller.update(root,map,job,{kind:'meal',phase:'active',a:{x:table.x-.5,z:table.z+1},b:{x:table.x+.5,z:table.z+1}},K.cookingStage(job,0));const shown=controller.inspect();assert.equal(shown.foods.length,3);assert.deepEqual(shown.foods.map(f=>f.shape),['fish','cake','drink']);for(const f of shown.foods)assert.equal(f.position[1],.08+(table.top||.85)+.01);controller.clear();assert.equal(root.getObjectByName('KitchenRecipeScene'),undefined);
});
