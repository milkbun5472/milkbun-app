const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function setup(){const env={window:null,Date,JSON,Math};env.window=env;vm.createContext(env);vm.runInContext(read('apps/fairy-garden/day/kitchen.js'),env);vm.runInContext(read('js/char-day-life.js'),env);vm.runInContext(read('js/char-day.js'),env);let stored={version:3,styles:{other:'dusk'},future:{keep:1},kitchens:{other:{ingredients:{egg:8}}}},writes=0,fail=false;env.loadJSON=()=>stored;env.commitJSONDurable=async(k,v)=>{assert.equal(k,'x_charDayHomes');if(fail)return {durable:false,live:false};stored=JSON.parse(JSON.stringify(v));writes++;return {durable:true,live:true};};return {L:env.CharDayLife,K:env.CharDayKit,get:()=>stored,writes:()=>writes,fail:v=>fail=v};}
function cooked(L,job){const auto={...job,cooking:{...job.cooking,mode:'auto'}};let p=job.cooking.progress;for(let i=0;i<1600&&p.index<3;i++)p=L.stepCooking(auto,p,{kind:'tick',dt:.1});assert.equal(p.index,3);return p;}
test('料理通过真实home writer补材料、预备、中止，完成只扣一次并留下两人份',async()=>{
 const {L,K,get}=setup(),write=a=>K.saveHomeChange('a','kitchens',raw=>L.kitchenChange(raw,a));
 for(const ingredient of ['tomato','egg','rice'])await write({kind:'stock',ingredient});
 await write({kind:'begin',id:'cook-1',recipeId:'tomato-rice'});assert.equal(get().kitchens.a.ingredients.egg,3);
 await assert.rejects(write({kind:'finish',id:'cook-1',at:123}));await write({kind:'cancel'});assert.equal(get().kitchens.a.ingredients.egg,3);
 await write({kind:'begin',id:'cook-2',recipeId:'tomato-rice'});await assert.rejects(write({kind:'ready',id:'cook-1'}));
 await write({kind:'ready',id:'cook-2'});await write({kind:'finish',id:'cook-2',at:123});assert.equal(get().kitchens.a.ingredients.egg,2);assert.equal(get().kitchens.a.dishes[0].id,'cook-2');assert.equal(get().kitchens.a.dishes[0].servings,2);
 await assert.rejects(write({kind:'finish',id:'cook-2',at:124}));assert.equal(get().kitchens.a.ingredients.egg,2);
 await write({kind:'serve',id:'meal-1',dishId:'cook-2'});await assert.rejects(write({kind:'finish',id:'meal-1',at:125}));await write({kind:'cancel'});assert.equal(get().kitchens.a.dishes.length,1);
 await write({kind:'serve',id:'meal-2',dishId:'cook-2'});await write({kind:'ready',id:'meal-2'});await write({kind:'finish',id:'meal-2',at:126});assert.equal(get().kitchens.a.dishes.length,0);assert.equal(get().kitchens.a.eaten,1);assert.equal(get().kitchens.other.ingredients.egg,8);assert.equal(get().future.keep,1);
});
test('durable失败保留材料、成品和待办，后续并发动作都从最新存档计算',async()=>{
 const f=setup(),write=a=>f.K.saveHomeChange('a','kitchens',raw=>f.L.kitchenChange(raw,a));
 await Promise.all([write({kind:'stock',ingredient:'egg'}),write({kind:'stock',ingredient:'egg'}),f.K.saveHomeChange('a','styles','rose')]);assert.equal(f.get().kitchens.a.ingredients.egg,6);assert.equal(f.get().styles.a,'rose');
 const before=JSON.stringify(f.get());f.fail(true);await assert.rejects(write({kind:'stock',ingredient:'egg'}));assert.equal(JSON.stringify(f.get()),before);f.fail(false);await write({kind:'stock',ingredient:'egg'});assert.equal(f.get().kitchens.a.ingredients.egg,9);
});
test('缺料、旧存档、未知配方与满餐盒不会扣材料或编完成',()=>{
 const {L}=setup();assert.equal(L.kitchen().ingredients.egg,0);assert.throws(()=>L.kitchenChange({}, {kind:'begin',id:'a',recipeId:'egg-noodle'}),/还缺/);assert.throws(()=>L.kitchenChange({}, {kind:'begin',id:'a',recipeId:'other'}));assert.throws(()=>L.kitchenChange({}, {kind:'serve',id:'a',dishId:'gone'}));assert.equal(L.kitchen({future:1}).future,1);
});
test('相册从真实home writer生成，角色隔离、便签修改、删除不串另一个角色',async()=>{
 const {L,K,get}=setup(),photo={id:'p1',charId:'a',src:'data:image/jpeg;base64,YQ==',at:123,day:'2026-10-10',time:'09:00',activity:'一起看书'};
 await K.saveHomeChange('a','albums',raw=>L.albumChange(raw,'a',{kind:'add',photo}));assert.equal(get().albums.a[0].activity,'一起看书');assert.equal(L.album(get().albums.a,'other').length,0);
 await K.saveHomeChange('other','albums',raw=>L.albumChange(raw,'other',{kind:'add',photo:{...photo,id:'p2',charId:'other'}}));await K.saveHomeChange('a','albums',raw=>L.albumChange(raw,'a',{kind:'note',id:'p1',note:'留住今天'}));assert.equal(get().albums.a[0].note,'留住今天');assert.equal(get().albums.other[0].id,'p2');await K.saveHomeChange('a','albums',raw=>L.albumChange(raw,'a',{kind:'delete',id:'p1'}));assert.equal(get().albums.a.length,0);assert.equal(get().albums.other.length,1);
 assert.throws(()=>L.albumChange([],'a',{kind:'add',photo:{...photo,charId:'other'}}));
});
test('装修推荐只读明确喜好，手动想法优先，财富/身份/讨厌的东西不猜风格',()=>{
 const {L}=setup();assert.equal(L.recommendation('穷学生，住出租屋，性格沉稳。'),null);assert.equal(L.recommendation('讨厌粉色装修。喜欢深木和旧书。').id,'dusk');assert.equal(L.recommendation('喜欢深木和旧书。','喜欢淡粉和柔软').id,'rose');assert.equal(L.recommendation('不喜欢工业风。'),null);
 const raw={$room:{wall:'stripe',wallColor:'#123456',floor:'auto',uses:{read:'my-sofa'}},sofa:{x:4,z:3,color:'#765432',material:'metal'}};
 const next=L.recommendLayout(raw,L.recommendation('喜欢深木和旧书。'));assert.equal(next.$room.wallColor,'#123456');assert.equal(next.$room.wall,'stripe');assert.equal(next.$room.floor,'dark');assert.equal(next.$room.uses.read,'my-sofa');assert.equal(next.sofa,raw.sofa);
});
test('取景照片保存失败仍可用同一张重试，重复提交只收一张且不丢其他记录',async()=>{
 const f=setup(),photo={id:'preview-1',charId:'a',src:'data:image/jpeg;base64,YQ==',at:123,day:'2026-10-10',time:'09:00',taName:'甲',meName:'我',activity:'靠肩',place:'小家',map:'dayHome',note:''};
 const write=()=>f.K.saveHomeChange('a','albums',raw=>f.L.albumChange(raw,'a',{kind:'add',photo})),before=JSON.stringify(f.get());
 f.fail(true);await assert.rejects(write(),/save/);assert.equal(JSON.stringify(f.get()),before);
 f.fail(false);await write();await write();assert.equal(f.get().albums.a.length,1);assert.deepEqual(f.get().albums.a[0],photo);assert.equal(f.get().kitchens.other.ingredients.egg,8);assert.equal(f.get().future.keep,1);
});
test('共用相机适配真正投影、刘海卡片与横屏，平移不改视角',async()=>{
 const {orthographicFrame}=await import('../apps/fairy-garden/view-controls.mjs');
 for(const [width,height]of [[320,400],[390,680],[844,245]]){const fit=orthographicFrame({minX:-1,maxX:1,minY:-1,maxY:1,zoom:1.6,halfWidth:7*width/height,halfHeight:7,width,height,rightX:.848,rightZ:-.53,upX:-.267,upZ:-.427,insets:{top:130,bottom:30,left:18,right:18},maxZoom:2});assert.ok(fit.zoom>0&&fit.zoom<=2);assert.ok(Number.isFinite(fit.x)&&Number.isFinite(fit.z));assert.ok(2*fit.zoom/1.6<=2*(height-130-30)/height+.00001);}
});
test('菜单保留现场、进度来自两人到位；拍照共用离屏readback且不新开模型或聊天writer',()=>{
 const page=read('js/char-day.js'),scene=read('apps/fairy-garden/day/scene.mjs');assert.match(scene,/shared\.phase==='active'/);assert.match(scene,/CharDayKitchen\.cookingStage/);assert.match(scene,/renderPhoto\(T,renderer,scene,view/);assert.match(scene,/setCameraMode\(solo\?'me':'both'\)/);assert.match(page,/saveHomeChange\(char\.id,'kitchens',raw=>L\.kitchenChange/);assert.doesNotMatch(page+read('js/char-day-life.js'),/callAI\(|runProbe\(|localStorage\./);assert.match(read('apps/pets/photo-render.mjs'),/export \{renderPhoto,visibleBounds\} from/);assert.ok(read('index.html').indexOf('js/char-day-life.js')<read('index.html').indexOf('js/char-day.js'));
});
test('32道菜六类七种做法都经实际home writer做成；收藏菜单与三道上桌持久且只扣一次',async()=>{
 const f=setup(),{L,K}=f,write=a=>K.saveHomeChange('a','kitchens',raw=>L.kitchenChange(raw,a));
 assert.equal(L.RECIPES.length,32);assert.equal(new Set(L.RECIPES.map(r=>r.category)).size,6);assert.equal(new Set(L.RECIPES.map(r=>r.method)).size,7);
 for(const r of L.RECIPES){for(const id of Object.keys(r.need))assert.ok(L.INGREDIENTS[id]);await write({kind:'shop',recipeId:r.id});const before={...f.get().kitchens.a.ingredients};await write({kind:'begin',id:r.id,recipeId:r.id});assert.deepEqual(f.get().kitchens.a.ingredients,before);await write({kind:'ready',id:r.id});await write({kind:'finish',id:r.id,at:123});for(const [id,n]of Object.entries(r.need))assert.equal(f.get().kitchens.a.ingredients[id],before[id]-n);assert.equal(f.get().kitchens.a.made[r.id],1);await assert.rejects(write({kind:'finish',id:r.id,at:124}));}
 for(const id of ['tomato-rice','berry-cake','lemon-tea']){await write({kind:'menu',recipeId:id});await write({kind:'favorite',recipeId:id});}
 await assert.rejects(write({kind:'menu',recipeId:'apple-pie'}),/三道/);await write({kind:'shop'});assert.equal(f.get().kitchens.a.menu.length,3);assert.equal(f.get().kitchens.a.favorites.length,3);
 const dishIds=['tomato-rice','berry-cake','lemon-tea'];await write({kind:'serve',id:'table',dishIds});assert.equal(f.get().kitchens.a.pending.courses.length,3);assert.equal(f.get().kitchens.a.dishes.length,32);await write({kind:'cancel'});assert.equal(f.get().kitchens.a.dishes.length,32);
 await write({kind:'serve',id:'table-2',dishIds});await write({kind:'ready',id:'table-2'});f.fail(true);const before=JSON.stringify(f.get());await assert.rejects(write({kind:'finish',id:'table-2',at:125}));assert.equal(JSON.stringify(f.get()),before);f.fail(false);await write({kind:'finish',id:'table-2',at:125});assert.equal(f.get().kitchens.a.dishes.length,29);assert.equal(f.get().kitchens.a.eaten,3);assert.equal(f.get().kitchens.a.tables,1);await assert.rejects(write({kind:'finish',id:'table-2',at:126}));assert.equal(f.get().kitchens.other.ingredients.egg,8);
});
test('备料按一桌合计补缺，重复补料不多添；旧餐盒与旧待办还能吃',()=>{
 const {L}=setup();let s={ingredients:{egg:1},menu:['tomato-rice','tomato-egg','egg-toast']};s=L.kitchenChange(s,{kind:'shop'});assert.equal(s.ingredients.egg,3);assert.equal(s.ingredients.tomato,2);const next=L.kitchenChange(s,{kind:'shop'});assert.deepEqual(next.ingredients,s.ingredients);assert.throws(()=>L.kitchenChange(s,{kind:'menu',recipeId:'no-such-recipe'}));assert.throws(()=>L.kitchenChange(s,{kind:'serve',id:'bad',dishIds:['gone']}));
 const old={ingredients:{egg:2},dishes:[{id:'old',recipeId:'egg-noodle',at:1,servings:2}],pending:{id:'meal-old',kind:'meal',dishId:'old',recipeId:'egg-noodle',ready:true},future:42};const done=L.kitchenChange(old,{kind:'finish',id:'meal-old',at:2});assert.equal(done.dishes.length,0);assert.equal(done.ingredients.egg,2);assert.equal(done.future,42);
});
test('做法阶段与时间由电话和现场共用，三道菜一桌有足够时间轮流尝',()=>{
 const f=setup(),env={globalThis:null};env.globalThis=env;vm.createContext(env);vm.runInContext(read('apps/fairy-garden/day/kitchen.js'),env);const K=env.CharDayKitchen;
 for(const r of f.L.RECIPES){const job={kind:'cook',recipeId:r.id};const start=K.cookingStage(job,0),middle=K.cookingStage(job,start.duration*.5),last=K.cookingStage(job,start.duration*.9);assert.equal(start.index,0);assert.equal(middle.index,1);assert.equal(last.index,2);assert.equal(middle.method,r.method);assert.equal(middle.label,r.steps[1]);assert.ok(start.duration>=10);}
 assert.equal(K.cookingStage({kind:'meal',dishIds:['a','b','c']}).duration,10);assert.equal(K.cookingStage({kind:'meal'}).duration,6);
});
test('手动选择无条件覆盖自动参考，明确忌口、未知口味和坏旧值有可靠默认',()=>{
 const {L}=setup(),persona='喜欢辣，不能吃辣，喜欢甜点，清淡。不会做饭。';
 const auto=L.resolvePreferences({lead:'auto'},persona);assert.equal(auto.spice,'none');assert.equal(auto.salt,'light');assert.equal(auto.sweet,'rich');assert.equal(auto.lead,'me');
 const manual=L.resolvePreferences({lead:'ta',spice:'hot',salt:'rich',sweet:'light'},persona);assert.equal(manual.spice,'hot');assert.equal(manual.salt,'rich');assert.equal(manual.sweet,'light');assert.equal(manual.lead,'ta');
 assert.equal(L.preference(null).lead,'auto');assert.equal(L.cookingProgress(null).heat,1);assert.equal(L.variation('tomato-rice',null).spice,'none');assert.equal(L.mealFeedback({recipeId:'tomato-rice'}, {}, '研究员').known,false);
});
test('蒸煮烘焙泡茶仍可手动等待；旧版七方法的检查点继续接受原操作',()=>{
 const {L}=setup();for(const method of Object.keys(L.METHODS)){const r=L.RECIPES.find(r=>r.method===method),session=L.cookingSession(r.id,{mode:'hands',lead:'ta'}),job={recipeId:r.id,cooking:{...session,version:1,progress:L.cookingProgress()}};let p=job.cooking.progress;
  for(let i=0;i<50;i++)p=L.stepCooking(job,p,{kind:'tick',dt:.1});assert.equal(p.index,0,method+'不能替我备菜');p=L.stepCooking(job,p,{kind:'work',operation:'wrong'});assert.equal(p.work,0);for(let i=0;i<6;i++)p=L.stepCooking(job,p,{kind:'work',operation:L.cookingSpec(job,p).operation});assert.equal(p.index,1);for(let i=0;i<300&&p.index<3;i++)p=L.stepCooking(job,p,{kind:'tick',dt:.1});assert.equal(p.index,3,method);
 }
 for(const id of ['pumpkin-soup','vegetable-dumpling','berry-cake','lemon-tea']){const job={recipeId:id,cooking:L.cookingSession(id,{mode:'auto'})};assert.equal(job.cooking.progress.table,undefined);assert.equal(cooked(L,job).index,3);}
});
test('替料、检查点、直接端桌与便当都经真实home writer，失败或重发不重复扣材料',async()=>{
 const f=setup(),{L,K}=f,write=a=>K.saveHomeChange('a','kitchens',raw=>L.kitchenChange(raw,a)),choices={mode:'hands',lead:'me',spice:'hot',salt:'light',swaps:{chicken:'shrimp'},garnish:false},v=L.variation('mushroom-chicken',choices);
 await write({kind:'shop',recipeId:'mushroom-chicken',variation:v});assert.equal(f.get().kitchens.a.ingredients.chicken,0);assert.equal(f.get().kitchens.a.ingredients.shrimp,1);
 await write({kind:'begin',id:'new-cook',recipeId:'mushroom-chicken',choices,persona:'不喜欢辣，不会做饭'});assert.equal(f.get().kitchens.a.pending.cooking.variation.spice,'hot');assert.equal(f.get().kitchens.a.pending.cooking.lead,'me');
 const progress={...cooked(L,f.get().kitchens.a.pending),heat:2,exposure:30};await write({kind:'progress',id:'new-cook',progress,mode:'hands',lead:'me'});await write({kind:'progress',id:'new-cook',progress:{index:0,rev:2}});assert.equal(f.get().kitchens.a.pending.cooking.progress.index,3);
 const before=JSON.stringify(f.get());f.fail(true);await assert.rejects(write({kind:'plate',id:'new-cook',mealId:'new-meal',at:123}));assert.equal(JSON.stringify(f.get()),before);f.fail(false);
 await write({kind:'plate',id:'new-cook',mealId:'new-meal',at:123});let state=f.get().kitchens.a;assert.equal(state.ingredients.shrimp,0);assert.equal(state.pending.kind,'meal');assert.equal(state.pending.courses[0].variation.swaps.chicken,'shrimp');assert.equal(state.pending.courses[0].finish,'煎得更香');await assert.rejects(write({kind:'plate',id:'new-cook',mealId:'duplicate',at:124}));assert.equal(f.get().kitchens.a.ingredients.shrimp,0);
 await write({kind:'cancel'});await write({kind:'remember',id:'ours',dishId:'new-cook',name:'我们的虾仁做法'});await write({kind:'pack',dishId:'new-cook'});assert.equal(f.get().kitchens.a.customRecipes[0].variation.swaps.chicken,'shrimp');assert.equal(f.get().kitchens.a.dishes[0].packed,true);await assert.rejects(write({kind:'serve',id:'table',dishId:'new-cook'}));await write({kind:'unpack',dishId:'new-cook'});await write({kind:'serve',id:'last-table',dishId:'new-cook'});await write({kind:'ready',id:'last-table'});await write({kind:'finish',id:'last-table',at:125});assert.equal(f.get().kitchens.a.history[0].courses[0].variation.spice,'hot');assert.equal(f.get().kitchens.other.ingredients.egg,8);assert.equal(f.get().future.keep,1);
});

test('选中这一桌只取本人真实writer的菜品口味分工，偏好改变与另一角色都不串进来',async()=>{
 const f=setup(),{L,K}=f,write=a=>K.saveHomeChange('a','kitchens',raw=>L.kitchenChange(raw,a));
 const choices={lead:'me',spice:'hot',salt:'light',sweet:'light',swaps:{chicken:'shrimp'}};
 await write({kind:'shop',recipeId:'mushroom-chicken',variation:L.variation('mushroom-chicken',choices)});
 await write({kind:'begin',id:'dish',recipeId:'mushroom-chicken',choices,persona:'不吃辣'});
 await write({kind:'progress',id:'dish',progress:cooked(L,f.get().kitchens.a.pending)});await write({kind:'plate',id:'dish',mealId:'table',at:123});
 const before=JSON.stringify(f.get()),m=L.kitchenMealFor(f.get(),'a','table'),hint=L.kitchenMealHint(m);
 assert.equal(m.charId,'a');assert.equal(m.courses[0].lead,'me');assert.equal(m.courses[0].variation.spice,'hot');assert.match(hint,/菌菇滑鸡（鸡肉换虾仁）/);assert.match(hint,/香辣 · 清淡 · 少甜/);assert.match(hint,/用户掌勺，TA备菜/);assert.equal(JSON.stringify(f.get()),before);
 assert.equal(L.kitchenMealFor(f.get(),'other','table'),null);assert.equal(L.kitchenMealFor(f.get(),'a','other-table'),null);
 await write({kind:'preferences',patch:{lead:'ta',spice:'none'}});assert.equal(L.kitchenMealHint(L.kitchenMealFor(f.get(),'a','table')),hint);
 await write({kind:'ready',id:'table'});await write({kind:'finish',id:'table',at:124});assert.equal(L.kitchenMealHint(L.kitchenMealFor(f.get(),'a','table')),hint);
 const dirty=JSON.parse(JSON.stringify(f.get()));dirty.kitchens.a.persona='PRIVATE';dirty.kitchens.a.history[0].secret='PRIVATE';dirty.kitchens.a.history[0].courses[0].secret='PRIVATE';assert.ok(!JSON.stringify(L.kitchenMealFor(dirty,'a','table')).includes('PRIVATE'));
});
test('旧桌的未知口味与分工不猜；收起、坏菜谱或没有这一桌都不分享',()=>{
 const {L}=setup(),homes={kitchens:{a:{dishes:[{id:'old',recipeId:'egg-noodle',at:1}],pending:{id:'meal',kind:'meal',dishId:'old',recipeId:'egg-noodle'}}}};
 const hint=L.kitchenMealHint(L.kitchenMealFor(homes,'a','meal'));assert.match(hint,/番茄鸡蛋面/);assert.match(hint,/口味：未记录；分工：未记录/);
 assert.equal(L.kitchenMealFor({...homes,kitchens:{a:{pending:{id:'meal',kind:'cook',recipeId:'egg-noodle'}}}},'a','meal'),null);
 assert.match(L.kitchenMealHint({courses:[{recipeId:'egg-noodle',variation:{},lead:''}]}),/口味：未记录/);assert.match(L.kitchenMealHint({courses:[{recipeId:'egg-noodle',variation:{spice:'hot'},lead:''}]}),/口味：香辣；分工：未记录/);assert.equal(L.kitchenMealHint(null),'');assert.equal(L.kitchenMealFor(null,'a','meal'),null);assert.equal(L.kitchenMealFor(homes,'a',null),null);
});
test('主App分享入口重读真实记录、使用当前角色与同一等待器，失效或陌生角色不入队',async()=>{
 const f=setup(),{L,K}=f,write=a=>K.saveHomeChange('a','kitchens',raw=>L.kitchenChange(raw,a));
 await write({kind:'shop',recipeId:'lemon-tea'});await write({kind:'begin',id:'dish',recipeId:'lemon-tea'});await write({kind:'ready',id:'dish'});await write({kind:'plate',id:'dish',mealId:'table',at:123});
 const src=read('js/app.js'),a=src.indexOf('const shareKitchenMeal = ('),b=src.indexOf('const dateWhenText =',a);assert.ok(a>0&&b>a);
 const calls=[],current={id:'a',name:'当前角色'},make=new Function('liveChars','window','loadJSON','waitForHer','setActiveChar','setActiveRoomId','setHalfWin','clearUnread',src.slice(a,b)+'return shareKitchenMeal;');
 const share=make([current],{CharDayLife:L},key=>{assert.equal(key,'x_charDayHomes');return f.get();},(...args)=>calls.push(['queue',...args]),v=>calls.push(['active',v]),v=>calls.push(['room',v]),v=>calls.push(['half',v]),v=>calls.push(['read',v]));
 assert.equal(share({id:'a',name:'过期名',persona:'PRIVATE'},'table'),true);assert.equal(calls[0][1],'a');assert.equal(calls[0][2].kitchenMeal.charId,'a');assert.deepEqual(calls[1],['active',current]);assert.deepEqual(calls[2],['room','main']);assert.ok(!JSON.stringify(calls).includes('PRIVATE'));
 calls.length=0;assert.equal(share({id:'stranger'},'table'),false);assert.equal(share(current,'gone'),false);assert.equal(calls.length,0);
 await write({kind:'cancel'});assert.equal(share(current,'table'),false);assert.equal(calls.length,0);
});
