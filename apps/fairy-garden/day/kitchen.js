// One kitchen catalog and transaction authority, consumed by both phone and scene.
(function(root){
 'use strict';
 const INGREDIENTS={tomato:'番茄',egg:'鸡蛋',noodle:'面条',mushroom:'蘑菇',rice:'米饭',potato:'土豆',carrot:'胡萝卜',greens:'青菜',tofu:'豆腐',chicken:'鸡肉',beef:'牛肉',shrimp:'虾仁',fish:'鱼肉',flour:'面粉',milk:'牛奶',butter:'黄油',cheese:'芝士',bread:'吐司',corn:'玉米',pumpkin:'南瓜',berry:'草莓',apple:'苹果',lemon:'柠檬',tea:'茶叶'};
 const CATEGORIES={staple:'饭面主食',home:'家常小炒',soup:'汤锅',breakfast:'早餐',bakery:'烘焙甜点',fresh:'轻食饮品'};
 const METHODS={stir:{label:'拌炒',seconds:12,steps:['洗切配菜','一起拌炒','分装两人份']},fry:{label:'煎炒',seconds:14,steps:['切好食材','翻炒收汁','摆盘上桌']},boil:{label:'煮汤',seconds:14,steps:['备好汤料','小火煮开','盛出热汤']},steam:{label:'蒸煮',seconds:14,steps:['揉面备馅','盖上蒸笼','装盘出笼']},bake:{label:'烘焙',seconds:18,steps:['和面拌料','放进小烤箱','出炉装盘']},mix:{label:'冷拌',seconds:10,steps:['洗切食材','拌好酱汁','装好两份']},brew:{label:'冲调',seconds:10,steps:['准备茶与水果','温热冲调','倒入两只杯子']}};
 const rows=[
 ['tomato-rice','番茄蛋饭','staple','stir',{tomato:1,egg:1,rice:1},'rice','tomato'],
 ['mushroom-noodle','菌菇汤面','staple','boil',{mushroom:1,noodle:1},'noodle','mushroom'],
 ['egg-noodle','番茄鸡蛋面','staple','boil',{tomato:1,egg:1,noodle:1},'noodle','tomato'],
 ['shrimp-rice','虾仁蛋炒饭','staple','stir',{shrimp:1,egg:1,rice:1,carrot:1},'rice','shrimp'],
 ['beef-rice','土豆牛肉盖饭','staple','fry',{beef:1,potato:1,rice:1},'rice','beef'],
 ['chicken-pasta','奶油鸡肉意面','staple','boil',{chicken:1,milk:1,mushroom:1,noodle:1},'noodle','chicken'],
 ['cheese-rice','芝士焗饭','staple','bake',{rice:1,cheese:1,corn:1,tomato:1},'gratin','corn'],
 ['vegetable-dumpling','蔬菜小饺子','staple','steam',{flour:1,greens:1,mushroom:1},'dumpling','greens'],
 ['tomato-egg','番茄炒蛋','home','fry',{tomato:1,egg:1},'stirfry','tomato'],
 ['mushroom-chicken','菌菇滑鸡','home','fry',{mushroom:1,chicken:1},'stirfry','chicken'],
 ['pepper-beef','彩蔬牛肉','home','fry',{beef:1,carrot:1,greens:1},'stirfry','beef'],
 ['crispy-tofu','香煎豆腐','home','fry',{tofu:1,greens:1},'tofu','greens'],
 ['lemon-fish','柠檬煎鱼','home','fry',{fish:1,lemon:1,butter:1},'fish','lemon'],
 ['butter-corn','黄油玉米土豆','home','fry',{corn:1,potato:1,butter:1},'stirfry','corn'],
 ['tomato-soup','番茄豆腐汤','soup','boil',{tomato:1,tofu:1},'soup','tomato'],
 ['pumpkin-soup','奶油南瓜汤','soup','boil',{pumpkin:1,milk:1},'soup','pumpkin'],
 ['chicken-soup','玉米鸡汤','soup','boil',{chicken:1,corn:1,carrot:1},'soup','corn'],
 ['mushroom-hotpot','菌菇双人小火锅','soup','boil',{mushroom:1,tofu:1,greens:1,beef:1},'hotpot','mushroom'],
 ['egg-toast','太阳蛋吐司','breakfast','fry',{egg:1,bread:1,butter:1},'toast','egg'],
 ['cheese-sandwich','芝士蔬菜三明治','breakfast','mix',{bread:1,cheese:1,tomato:1,greens:1},'sandwich','greens'],
 ['berry-pancake','草莓松饼','breakfast','fry',{flour:1,egg:1,milk:1,berry:1},'pancake','berry'],
 ['pumpkin-bun','南瓜小馒头','breakfast','steam',{pumpkin:1,flour:1,milk:1},'bun','pumpkin'],
 ['corn-porridge','玉米蔬菜粥','breakfast','boil',{rice:1,corn:1,greens:1},'porridge','corn'],
 ['berry-cake','草莓小蛋糕','bakery','bake',{flour:1,egg:1,milk:1,berry:1},'cake','berry'],
 ['apple-pie','苹果酥派','bakery','bake',{flour:1,butter:1,apple:1},'pie','apple'],
 ['butter-cookie','黄油曲奇','bakery','bake',{flour:1,butter:1,egg:1},'cookie','butter'],
 ['milk-pudding','草莓奶布丁','bakery','steam',{milk:1,egg:1,berry:1},'pudding','berry'],
 ['fruit-salad','缤纷水果碗','fresh','mix',{berry:1,apple:1,lemon:1},'salad','berry'],
 ['chicken-salad','鸡肉田园沙拉','fresh','mix',{chicken:1,greens:1,tomato:1,corn:1},'salad','greens'],
 ['lemon-tea','双杯柠檬茶','fresh','brew',{lemon:1,tea:1},'drink','lemon'],
 ['berry-milk','草莓牛奶','fresh','brew',{berry:1,milk:1},'drink','berry'],
 ['apple-tea','暖苹果茶','fresh','brew',{apple:1,tea:1},'drink','apple']
 ];
 const RECIPES=rows.map(([id,name,category,method,need,food,topping])=>({id,name,category,method,need,food,topping,steps:METHODS[method].steps,note:METHODS[method].steps.join('，')+'。'}));
 const recipe=id=>RECIPES.find(r=>r.id===id),validIds=ids=>[...new Set((Array.isArray(ids)?ids:[]).filter(id=>recipe(id)))];
 const count=n=>Math.max(0,Math.min(99,Math.floor(Number(n)||0)));
 function kitchen(raw={}){raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return {...raw,version:2,
  ingredients:Object.fromEntries(Object.keys(INGREDIENTS).map(id=>[id,count(raw.ingredients?.[id])])),
  dishes:(Array.isArray(raw.dishes)?raw.dishes:[]).filter(d=>d&&typeof d.id==='string'&&recipe(d.recipeId)&&Number.isFinite(d.at)).map(d=>({...d,servings:Math.max(1,Math.min(2,Math.floor(d.servings)||2))})),
  menu:validIds(raw.menu).slice(0,3),favorites:validIds(raw.favorites),made:Object.fromEntries(RECIPES.map(r=>[r.id,count(raw.made?.[r.id])])),
  pending:raw.pending&&typeof raw.pending.id==='string'&&['cook','meal'].includes(raw.pending.kind)?{...raw.pending}:null};}
 function shopping(raw,ids){const s=kitchen(raw),need={};for(const id of validIds(ids??s.menu))for(const [key,n]of Object.entries(recipe(id).need))need[key]=(need[key]||0)+n;return Object.entries(need).map(([id,n])=>({id,need:n,have:s.ingredients[id],missing:Math.max(0,n-s.ingredients[id])}));}
 function kitchenChange(raw,action){const s=kitchen(raw),p=s.pending;
  if(action.kind==='stock'){if(!Object.hasOwn(INGREDIENTS,action.ingredient))throw Error('先选一种食材。');if(s.ingredients[action.ingredient]>=99)throw Error('这一样已经放满了。');return {...s,ingredients:{...s.ingredients,[action.ingredient]:Math.min(99,s.ingredients[action.ingredient]+3)}};}
  if(action.kind==='shop'){const ids=action.recipeId?[action.recipeId]:s.menu;if(!ids.length||ids.some(id=>!recipe(id)))throw Error('先选今天想做的菜。');const ingredients={...s.ingredients};for(const row of shopping(s,ids))ingredients[row.id]+=row.missing;return {...s,ingredients};}
  if(action.kind==='favorite'){if(!recipe(action.recipeId))throw Error('没有找到这道菜。');return {...s,favorites:s.favorites.includes(action.recipeId)?s.favorites.filter(id=>id!==action.recipeId):[...s.favorites,action.recipeId]};}
  if(action.kind==='menu'){if(!recipe(action.recipeId))throw Error('没有找到这道菜。');if(s.menu.includes(action.recipeId))return {...s,menu:s.menu.filter(id=>id!==action.recipeId)};if(s.menu.length===3)throw Error('一桌先搭配三道菜，移掉一道再换。');return {...s,menu:[...s.menu,action.recipeId]};}
  if(action.kind==='cancel')return {...s,pending:null};
  if(action.kind==='begin'){if(p)throw Error('先做完或收起手头这一份。');if(s.dishes.length>=60)throw Error('餐盒已经放满了，先吃一些再做。');const r=recipe(action.recipeId);if(!r)throw Error('先选一个做法。');const missing=shopping(s,[r.id]).filter(row=>row.missing).map(row=>INGREDIENTS[row.id]+' ×'+row.missing);if(missing.length)throw Error('还缺：'+missing.join('、'));if(typeof action.id!=='string'||!action.id||s.dishes.some(d=>d.id===action.id))throw Error('这一份的编号需要重新生成。');return {...s,pending:{id:action.id,kind:'cook',recipeId:r.id,ready:false}};}
  if(action.kind==='serve'){if(p)throw Error('先做完或收起手头这一份。');const ids=[...new Set(action.dishIds||[action.dishId])];if(!ids.length||ids.length>3)throw Error('一桌可以端上一到三道菜。');const courses=ids.map(id=>s.dishes.find(d=>d.id===id));if(courses.some(d=>!d))throw Error('这份已经吃完了。');if(typeof action.id!=='string'||!action.id)throw Error('这一桌的编号需要重新生成。');return {...s,pending:{id:action.id,kind:'meal',dishId:ids[0],dishIds:ids,courses:courses.map(d=>({...d})),recipeId:courses[0].recipeId,ready:false}};}
  if(!p||p.id!==action.id)throw Error('这一份已经收起了。');if(action.kind==='ready')return {...s,pending:{...p,ready:true}};
  if(action.kind!=='finish'||!p.ready)throw Error('先在现场完成，再收好这一份。');
  if(p.kind==='meal'){const ids=p.dishIds||[p.dishId];if(ids.some(id=>!s.dishes.some(d=>d.id===id)))throw Error('这份已经吃完了。');return {...s,pending:null,dishes:s.dishes.filter(d=>!ids.includes(d.id)),eaten:(Number(s.eaten)||0)+ids.length,tables:(Number(s.tables)||0)+1};}
  const r=recipe(p.recipeId);if(!r)throw Error('做法没有找到，食材还在。');if(Object.entries(r.need).some(([id,n])=>s.ingredients[id]<n))throw Error('食材不够，先补齐这一份。');if(!Number.isFinite(action.at))throw Error('先重新收好这一份。');
  return {...s,pending:null,ingredients:Object.fromEntries(Object.entries(s.ingredients).map(([id,n])=>[id,n-(r.need[id]||0)])),dishes:[...s.dishes,{id:p.id,recipeId:r.id,at:action.at,servings:2}],made:{...s.made,[r.id]:Math.min(99,s.made[r.id]+1)}};
 }
 function cookingStage(job,elapsed=0){const r=recipe(job?.recipeId),m=METHODS[r?.method]||METHODS.stir,duration=job?.kind==='meal'?6+Math.max(0,(job.dishIds?.length||1)-1)*2:m.seconds;
  const index=elapsed<duration*.28?0:elapsed<duration*.78?1:2,phase=job?.kind==='meal'?'eating':['preparing','stirring','serving'][index];return {duration,index,phase,label:job?.kind==='meal'?'一起尝这桌菜':m.steps[index],method:r?.method||'stir'};}
 root.CharDayKitchen={INGREDIENTS,CATEGORIES,METHODS,RECIPES,recipe,kitchen,kitchenChange,shopping,cookingStage};
})(globalThis);
