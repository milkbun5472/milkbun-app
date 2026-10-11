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
 const TASTE={spice:{none:'不辣',mild:'微辣',hot:'香辣'},salt:{light:'清淡',regular:'适中',rich:'浓味'},sweet:{light:'少甜',regular:'适中',rich:'甜一些'}};
 const LEADS={auto:'自动参考厨艺',ta:'TA掌勺，我备菜',me:'我掌勺，TA备菜'};
 const SWAPS=[['chicken','beef','shrimp','tofu'],['greens','mushroom','carrot','corn']];
 const preference=(raw={})=>{raw=raw&&typeof raw==='object'?raw:{};return ({mode:raw.mode==='auto'?'auto':'hands',lead:Object.hasOwn(LEADS,raw.lead)?raw.lead:'auto',...Object.fromEntries(Object.keys(TASTE).map(k=>[k,Object.hasOwn(TASTE[k],raw[k])?raw[k]:'auto']))});};
 function inferredTaste(persona=''){
  const p=String(persona),out={spice:'none',salt:'regular',sweet:'regular',lead:'ta'};
  if(/(?:不吃|不喜欢|不能吃|忌|讨厌).{0,4}辣/.test(p))out.spice='none';else if(/(?:喜欢|爱吃|嗜|偏好).{0,5}辣/.test(p))out.spice='hot';
  if(/(?:清淡|少盐|低盐)/.test(p))out.salt='light';else if(/(?:喜欢|偏好|爱吃).{0,4}(?:浓味|重口)/.test(p))out.salt='rich';
  if(/(?:少糖|低糖|不爱甜|不喜欢甜|不吃甜)/.test(p))out.sweet='light';else if(/(?:喜欢|爱吃|嗜).{0,4}(?:甜食|甜点|甜口)/.test(p))out.sweet='rich';
  if(/(?:不会做饭|厨艺差|厨房小白|不擅长.{0,3}(?:做饭|烹饪))/.test(p))out.lead='me';return out;
 }
 function resolvePreferences(raw,persona=''){const q=preference(raw),a=inferredTaste(persona);return {...q,...Object.fromEntries(['lead',...Object.keys(TASTE)].map(k=>[k,q[k]==='auto'?a[k]:q[k]]))};}
 function alternatives(id){const r=recipe(id);return r?Object.keys(r.need).map(key=>({id:key,values:(SWAPS.find(g=>g.includes(key))||[key]).filter(v=>v===key||!Object.hasOwn(r.need,v))})).filter(x=>x.values.length>1):[];}
 function variation(id,raw={}){
  raw=raw&&typeof raw==='object'?raw:{};const r=recipe(id),swaps={};if(!r)return {swaps:{},spice:'none',salt:'regular',sweet:'regular',garnish:true};
  for(const row of alternatives(id)){const v=raw.swaps?.[row.id];if(row.values.includes(v)&&v!==row.id)swaps[row.id]=v;}
  return {swaps,...Object.fromEntries(Object.keys(TASTE).map(k=>[k,Object.hasOwn(TASTE[k],raw[k])?raw[k]:(k==='spice'?'none':'regular')])),garnish:raw.garnish!==false};
 }
 function recipeInfo(id,raw){const r=recipe(id);if(!r)return null;const v=variation(id,raw),need={};for(const [k,n]of Object.entries(r.need)){const key=v.swaps[k]||k;need[key]=(need[key]||0)+n;}return {...r,need,topping:v.swaps[r.topping]||r.topping,variation:v};}
 function tasteDescription(raw){const v=variation('tomato-rice',raw);return [TASTE.spice[v.spice],TASTE.salt[v.salt],TASTE.sweet[v.sweet]].join(' · ');}
 function dishName(d){const r=recipe(d?.recipeId);if(!r)return '';const v=variation(r.id,d.variation),changed=Object.entries(v.swaps).map(([a,b])=>INGREDIENTS[a]+'换'+INGREDIENTS[b]);return r.name+(changed.length?'（'+changed.join('、')+'）':'');}
 function cookingProgress(raw={}){raw=raw&&typeof raw==='object'?raw:{};return {index:Math.max(0,Math.min(3,Math.floor(Number(raw.index)||0))),work:Math.max(0,Math.min(12,Number(raw.work)||0)),wait:Math.max(0,Math.min(120,Number(raw.wait)||0)),elapsed:Math.max(0,Math.min(600,Number(raw.elapsed)||0)),heat:Math.max(0,Math.min(2,Math.round(Number(raw.heat??1)))),exposure:Math.max(0,Math.min(200,Number(raw.exposure)||0)),rev:Math.max(0,Math.floor(Number(raw.rev)||0))};}
 function cookingSession(id,choices={},persona=''){
  const q=resolvePreferences(choices,persona);return {version:1,mode:q.mode,lead:q.lead,variation:variation(id,{...choices,...q,swaps:choices.swaps}),progress:cookingProgress()};
 }
 function cookingSpec(job,raw=job?.cooking?.progress){
  const p=cookingProgress(raw),r=recipe(job?.recipeId),method=r?.method||'stir',passive=['bake','steam','boil','brew'].includes(method);
  const prep=['bake','steam'].includes(method)?'knead':method==='brew'?'add':'chop';
  const operation=p.index===0?prep:p.index===1?(passive?'wait':method==='fry'?'flip':method==='mix'?'mix':'stir'):p.index===2?'plate':'done';
  const names={chop:'切好配菜',knead:'揉匀面团',add:'放入茶与水果',wait:METHODS[method]?.steps[1],flip:'翻面煎香',mix:'拌匀食材',stir:'翻炒拌匀',plate:'盛出两人份',done:'做好了'};
  const lead=job?.cooking?.lead||'ta',who=p.index===0?(lead==='ta'?'me':'ta'):lead;
  return {index:p.index,method,passive:p.index===1&&passive,operation,label:names[operation],target:p.index===0?'prep':p.index===2?'serve':'pan',required:p.index===0?6:p.index===1?(passive?0:6):p.index===2?1:0,seconds:p.index===1?(passive?method==='bake'?14:method==='steam'?12:method==='boil'?10:7:4):0,who,ready:p.index===3,progress:p};
 }
 function stepCooking(job,raw,event={}){
  const before=cookingProgress(raw),p={...before},spec=cookingSpec(job,p);if(spec.ready)return p;
  if(event.kind==='heat'){p.heat=Math.max(0,Math.min(2,Math.round(Number(event.value)||0)));p.rev++;return p;}
  if(event.kind==='work'&&event.operation===spec.operation){p.work=Math.min(spec.required,p.work+Math.max(0,Math.min(1,Number(event.amount)||1)));p.rev++;}
  if(event.kind==='tick'){
   const dt=Math.max(0,Math.min(.1,Number(event.dt)||0));p.elapsed+=dt;
   if(job.cooking?.mode==='auto'||spec.who==='ta')p.work=Math.min(spec.required,p.work+dt*2.1);
   if(spec.index===1){const rate=spec.method==='mix'?1:[.65,1,1.35][p.heat];p.wait+=dt*rate;if(spec.method!=='mix')p.exposure+=dt*p.heat;}
   if(Math.floor(p.elapsed/2)>Math.floor(before.elapsed/2))p.rev++;
  }
  if(p.work>=spec.required&&p.wait>=spec.seconds){p.index++;p.work=p.wait=0;p.rev++;}
  return p;
 }
 function mealFeedback(dish,prefs,persona=''){
  const actual=variation(dish.recipeId,dish.variation),q=resolvePreferences(prefs,persona),axes=Object.keys(TASTE).filter(k=>preference(prefs)[k]!=='auto'||(k==='spice'?/辣/:k==='salt'?/清淡|盐|重口|浓味/:/甜|糖/).test(String(persona)));
  const matching=axes.filter(k=>actual[k]===q[k]);return {taste:tasteDescription(actual),matching,known:axes.length>0,text:axes.length?(matching.length===axes.length?'这份口味符合厨房里记住的偏好。':'这份和厨房里记住的口味偏好有些不同。'):'TA的口味还没有明确记录，可以一起尝尝，再记住喜欢的做法。'};
 }

 const count=n=>Math.max(0,Math.min(99,Math.floor(Number(n)||0)));
 function kitchen(raw={}){raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};return {...raw,version:3,preferences:preference(raw.preferences),customRecipes:(Array.isArray(raw.customRecipes)?raw.customRecipes:[]).filter(x=>x&&typeof x.id==='string'&&recipe(x.recipeId)).slice(-60),history:(Array.isArray(raw.history)?raw.history:[]).filter(x=>x&&Array.isArray(x.courses)).map(x=>({...x,courses:x.courses.filter(d=>d&&recipe(d.recipeId))})).slice(-30),
  ingredients:Object.fromEntries(Object.keys(INGREDIENTS).map(id=>[id,count(raw.ingredients?.[id])])),
  dishes:(Array.isArray(raw.dishes)?raw.dishes:[]).filter(d=>d&&typeof d.id==='string'&&recipe(d.recipeId)&&Number.isFinite(d.at)).map(d=>({...d,servings:Math.max(1,Math.min(2,Math.floor(d.servings)||2))})),
  menu:validIds(raw.menu).slice(0,3),favorites:validIds(raw.favorites),made:Object.fromEntries(RECIPES.map(r=>[r.id,count(raw.made?.[r.id])])),
  pending:raw.pending&&typeof raw.pending.id==='string'&&['cook','meal'].includes(raw.pending.kind)?{...raw.pending}:null};}
 function shopping(raw,ids,variants={}){const s=kitchen(raw),need={};for(const id of validIds(ids??s.menu))for(const [key,n]of Object.entries(recipeInfo(id,variants[id]).need))need[key]=(need[key]||0)+n;return Object.entries(need).map(([id,n])=>({id,need:n,have:s.ingredients[id],missing:Math.max(0,n-s.ingredients[id])}));}
 function kitchenChange(raw,action){const s=kitchen(raw),p=s.pending;
  if(action.kind==='preferences')return {...s,preferences:preference({...s.preferences,...action.patch})};
  if(action.kind==='remember'){const dish=s.dishes.find(d=>d.id===action.dishId)||p?.kind==='cook'&&p.ready&&{recipeId:p.recipeId,variation:p.cooking?.variation};if(!dish)throw Error('先做好这一份，再记下做法。');if(typeof action.id!=='string'||!action.id)throw Error('给做法重新生成编号。');const entry={id:action.id,recipeId:dish.recipeId,name:String(action.name||dishName(dish)).trim().slice(0,40),variation:variation(dish.recipeId,dish.variation)};return {...s,customRecipes:[...s.customRecipes.filter(x=>x.id!==entry.id),entry].slice(-60)};}
  if(action.kind==='pack'||action.kind==='unpack'){const dish=s.dishes.find(d=>d.id===action.dishId);if(!dish)throw Error('这份已经吃完了。');if(p?.kind==='meal'&&(p.dishIds||[p.dishId]).includes(dish.id))throw Error('这份已经上桌，先吃完这一桌。');return {...s,dishes:s.dishes.map(d=>d.id===dish.id?{...d,packed:action.kind==='pack',owner:action.kind==='pack'?'ta':undefined}:d)};}
  if(action.kind==='progress'){if(!p||p.id!==action.id||!p.cooking)throw Error('这一份已经收起了。');const progress=cookingProgress(action.progress);if(progress.rev<=cookingProgress(p.cooking.progress).rev)return s;return {...s,pending:{...p,ready:progress.index===3,cooking:{...p.cooking,mode:action.mode==='auto'?'auto':action.mode==='hands'?'hands':p.cooking.mode,lead:action.lead==='me'?'me':action.lead==='ta'?'ta':p.cooking.lead,progress}}};}
  if(action.kind==='plate'){if(typeof action.mealId!=='string'||!action.mealId)throw Error('这一桌需要重新编号。');const done=kitchenChange(s,{kind:'finish',id:action.id,at:action.at});return kitchenChange(done,{kind:'serve',id:action.mealId,dishId:action.id});}

  if(action.kind==='stock'){if(!Object.hasOwn(INGREDIENTS,action.ingredient))throw Error('先选一种食材。');if(s.ingredients[action.ingredient]>=99)throw Error('这一样已经放满了。');return {...s,ingredients:{...s.ingredients,[action.ingredient]:Math.min(99,s.ingredients[action.ingredient]+3)}};}
  if(action.kind==='shop'){const ids=action.recipeId?[action.recipeId]:s.menu;if(!ids.length||ids.some(id=>!recipe(id)))throw Error('先选今天想做的菜。');const ingredients={...s.ingredients};for(const row of shopping(s,ids,action.variants||(action.variation&&action.recipeId?{[action.recipeId]:action.variation}:{})))ingredients[row.id]+=row.missing;return {...s,ingredients};}
  if(action.kind==='favorite'){if(!recipe(action.recipeId))throw Error('没有找到这道菜。');return {...s,favorites:s.favorites.includes(action.recipeId)?s.favorites.filter(id=>id!==action.recipeId):[...s.favorites,action.recipeId]};}
  if(action.kind==='menu'){if(!recipe(action.recipeId))throw Error('没有找到这道菜。');if(s.menu.includes(action.recipeId))return {...s,menu:s.menu.filter(id=>id!==action.recipeId)};if(s.menu.length===3)throw Error('一桌先搭配三道菜，移掉一道再换。');return {...s,menu:[...s.menu,action.recipeId]};}
  if(action.kind==='cancel')return {...s,pending:null};
  if(action.kind==='begin'){if(p)throw Error('先做完或收起手头这一份。');if(s.dishes.length>=60)throw Error('餐盒已经放满了，先吃一些再做。');const r=recipe(action.recipeId);if(!r)throw Error('先选一个做法。');const session=action.choices?cookingSession(r.id,{...s.preferences,...action.choices},action.persona):null;const missing=shopping(s,[r.id],session?{[r.id]:session.variation}:{}).filter(row=>row.missing).map(row=>INGREDIENTS[row.id]+' ×'+row.missing);if(missing.length)throw Error('还缺：'+missing.join('、'));if(typeof action.id!=='string'||!action.id||s.dishes.some(d=>d.id===action.id))throw Error('这一份的编号需要重新生成。');return {...s,pending:{id:action.id,kind:'cook',recipeId:r.id,ready:false,...(session?{cooking:session}:{})}};}
  if(action.kind==='serve'){if(p)throw Error('先做完或收起手头这一份。');const ids=[...new Set(action.dishIds||[action.dishId])];if(!ids.length||ids.length>3)throw Error('一桌可以端上一到三道菜。');const courses=ids.map(id=>s.dishes.find(d=>d.id===id));if(courses.some(d=>!d||d.packed))throw Error('这份已经吃完了。');if(typeof action.id!=='string'||!action.id)throw Error('这一桌的编号需要重新生成。');return {...s,pending:{id:action.id,kind:'meal',dishId:ids[0],dishIds:ids,courses:courses.map(d=>({...d})),recipeId:courses[0].recipeId,ready:false}};}
  if(!p||p.id!==action.id)throw Error('这一份已经收起了。');if(action.kind==='ready')return {...s,pending:{...p,ready:true}};
  if(action.kind!=='finish'||!p.ready)throw Error('先在现场完成，再收好这一份。');
  if(p.kind==='meal'){const ids=p.dishIds||[p.dishId];if(ids.some(id=>!s.dishes.some(d=>d.id===id)))throw Error('这份已经吃完了。');return {...s,pending:null,dishes:s.dishes.filter(d=>!ids.includes(d.id)),eaten:(Number(s.eaten)||0)+ids.length,tables:(Number(s.tables)||0)+1,history:[...s.history,{id:p.id,at:action.at,courses:(p.courses||[]).map(d=>({...d}))}].slice(-30)};}
  const r=recipeInfo(p.recipeId,p.cooking?.variation);if(!r)throw Error('做法没有找到，食材还在。');if(Object.entries(r.need).some(([id,n])=>s.ingredients[id]<n))throw Error('食材不够，先补齐这一份。');if(!Number.isFinite(action.at))throw Error('先重新收好这一份。');
  return {...s,pending:null,ingredients:Object.fromEntries(Object.entries(s.ingredients).map(([id,n])=>[id,n-(r.need[id]||0)])),dishes:[...s.dishes,{id:p.id,recipeId:r.id,at:action.at,servings:2,...(p.cooking?{variation:p.cooking.variation,lead:p.cooking.lead,finish:r.method==='mix'?'拌匀两人份':r.method==='bake'?(p.cooking.progress?.exposure>14?'烤色更深':'松软出炉'):['fry','stir'].includes(r.method)?(p.cooking.progress?.exposure>14?'煎得更香':'保留嫩口'):'慢火完成'}:{})}],made:{...s.made,[r.id]:Math.min(99,s.made[r.id]+1)}};
 }
 function cookingStage(job,elapsed=0){if(job?.kind==='cook'&&job.cooking){const spec=cookingSpec(job,typeof elapsed==='object'?elapsed:job.cooking.progress);return {...spec,duration:spec.seconds,phase:spec.ready?'ready':['preparing','stirring','serving'][spec.index]};}const r=recipe(job?.recipeId),m=METHODS[r?.method]||METHODS.stir,duration=job?.kind==='meal'?6+Math.max(0,(job.dishIds?.length||1)-1)*2:m.seconds;
  const index=elapsed<duration*.28?0:elapsed<duration*.78?1:2,phase=job?.kind==='meal'?'eating':['preparing','stirring','serving'][index];return {duration,index,phase,label:job?.kind==='meal'?'一起尝这桌菜':m.steps[index],method:r?.method||'stir'};}
 root.CharDayKitchen={TASTE,LEADS,preference,inferredTaste,resolvePreferences,alternatives,variation,recipeInfo,tasteDescription,dishName,cookingProgress,cookingSession,cookingSpec,stepCooking,mealFeedback,INGREDIENTS,CATEGORIES,METHODS,RECIPES,recipe,kitchen,kitchenChange,shopping,cookingStage};
})(globalThis);
