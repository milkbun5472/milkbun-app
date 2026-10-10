const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
function setup(){const env={window:null,Date,JSON,Math};env.window=env;vm.createContext(env);vm.runInContext(read('js/char-day-life.js'),env);vm.runInContext(read('js/char-day.js'),env);let stored={version:3,styles:{other:'dusk'},future:{keep:1},kitchens:{other:{ingredients:{egg:8}}}},writes=0,fail=false;env.loadJSON=()=>stored;env.commitJSONDurable=async(k,v)=>{assert.equal(k,'x_charDayHomes');if(fail)return {durable:false,live:false};stored=JSON.parse(JSON.stringify(v));writes++;return {durable:true,live:true};};return {L:env.CharDayLife,K:env.CharDayKit,get:()=>stored,writes:()=>writes,fail:v=>fail=v};}
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
test('共用相机适配真正投影、刘海卡片与横屏，平移不改视角',async()=>{
 const {orthographicFrame}=await import('../apps/fairy-garden/view-controls.mjs');
 for(const [width,height]of [[320,400],[390,680],[844,245]]){const fit=orthographicFrame({minX:-1,maxX:1,minY:-1,maxY:1,zoom:1.6,halfWidth:7*width/height,halfHeight:7,width,height,rightX:.848,rightZ:-.53,upX:-.267,upZ:-.427,insets:{top:130,bottom:30,left:18,right:18},maxZoom:2});assert.ok(fit.zoom>0&&fit.zoom<=2);assert.ok(Number.isFinite(fit.x)&&Number.isFinite(fit.z));assert.ok(2*fit.zoom/1.6<=2*(height-130-30)/height+.00001);}
});
test('菜单保留现场、进度来自两人到位；拍照共用离屏readback且不新开模型或聊天writer',()=>{
 const page=read('js/char-day.js'),scene=read('apps/fairy-garden/day/scene.mjs');assert.match(scene,/shared\.phase==='active'/);assert.match(scene,/job\.kind==='cook'\?12:6/);assert.match(scene,/renderPhoto\(T,renderer,scene,view/);assert.match(scene,/setCameraMode\('both'\)/);assert.match(page,/saveHomeChange\(char\.id,'kitchens',raw=>L\.kitchenChange/);assert.doesNotMatch(page+read('js/char-day-life.js'),/callAI\(|runProbe\(|localStorage\./);assert.match(read('apps/pets/photo-render.mjs'),/export \{renderPhoto,visibleBounds\} from/);assert.ok(read('index.html').indexOf('js/char-day-life.js')<read('index.html').indexOf('js/char-day.js'));
});
