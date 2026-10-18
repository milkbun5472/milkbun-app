// 2026-10-18 起 char-day.js / fairy-garden.js 拆出 -core.js（开机那半）：读源码、跑沙盒都先带上 core
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import './kitchen.js';
const K=globalThis.CharDayKitchen,Z=K.TABLE_ZONES;
const job=(id='tomato-egg',lead='ta',mode='hands')=>({id:'dish',kind:'cook',recipeId:id,cooking:K.cookingSession(id,{lead,mode})});
const step=(j,p,event)=>K.stepCooking(j,p,event),drop=(j,p,id,zone,extra={})=>step(j,p,{kind:'drop',id,point:{x:Z[zone].x,z:Z[zone].z,...extra}});
test('真实食材被拿到案板，刀轨迹切开并守恒体积，空划和重复短划不充进度',()=>{
 const j=job(),p=j.cooking.progress,item=p.table.items.find(q=>q.ingredient==='tomato');assert.equal(p.table.items.length,2);
 const board=drop(j,p,item.id,'board'),cut=step(j,board,{kind:'slice',from:{x:Z.board.x-.3,z:Z.board.z},to:{x:Z.board.x+.3,z:Z.board.z}});assert.equal(cut.table.items.length,3);const pieces=cut.table.items.filter(q=>q.source===item.source);assert.equal(pieces.length,2);assert.ok(Math.abs(pieces.reduce((n,q)=>n+q.w*q.d*q.h,0)-item.w*item.d*item.h)<1e-10);assert.ok(pieces.every(q=>q.cut&&q.zone==='board'));assert.equal(p.table.items[0].zone,'basket');
 assert.deepEqual(step(j,board,{kind:'slice',from:{x:0,z:0},to:{x:.02,z:.02}}),board);assert.equal(step(j,board,{kind:'work',operation:'chop'}).table.items.length,2);
});
test('可以分批下料，锅中块的位置随拌动变化，翻面才让另一面受热，生食不冒充完成',()=>{
 const j=job('tomato-egg','me'),p=j.cooking.progress,id=p.table.items[0].id;let q=drop(j,p,id,'pan');assert.equal(q.table.order[0],'tomato');assert.equal(q.table.items[1].zone,'basket');
 for(let i=0;i<50;i++)q=step(j,q,{kind:'tick',dt:.1,active:false});const hot=q.table.items[0];assert.ok(hot.bottom>.65);assert.equal(hot.top,0);assert.equal(K.tableReady(hot,'fry'),false);assert.equal(drop(j,q,id,'plate').table.items[0].zone,'pan');
 q=step(j,q,{kind:'flip'});for(let i=0;i<60;i++)q=step(j,q,{kind:'tick',dt:.1,active:false});assert.ok(K.tableReady(q.table.items[0],'fry'));q=drop(j,q,id,'plate',{x:Z.plate.x+.08});assert.equal(q.table.items[0].zone,'plate');assert.notEqual(q.table.items[0].x,Z.plate.x);
});
test('冷拌依赖真实拖动路径；装盘位置、淋酱轨迹与端托盘都能保存',()=>{
 const j=job('fruit-salad','me');let p=j.cooking.progress;for(const q of p.table.items)p=drop(j,p,q.id,'pan');
 assert.equal(p.index,1);p=step(j,p,{kind:'stir',path:Array.from({length:30},(_,i)=>({x:Z.pan.x+Math.cos(i/29*Math.PI*2)*.18,z:Z.pan.z+Math.sin(i/29*Math.PI*2)*.18}))});assert.ok(p.table.items.every(q=>K.tableReady(q,'mix')));assert.equal(p.index,2);
 for(const [i,q]of p.table.items.entries())p=drop(j,p,q.id,'plate',{x:Z.plate.x+(i-1)*.08,z:Z.plate.z+.04});p=step(j,p,{kind:'sauce',path:[{x:Z.plate.x-.1,z:Z.plate.z},{x:Z.plate.x+.1,z:Z.plate.z}]});assert.equal(p.table.sauce.length,2);assert.equal(p.index,2);p=step(j,p,{kind:'serve-plate',point:Z.tray});assert.equal(p.index,3);assert.deepEqual(K.cookingProgress(JSON.parse(JSON.stringify(p))),p);
});
test('32菜的自动伙伴完成，炒煎沙拉共用食材事件，其他方法与替料保留',()=>{
 for(const r of K.RECIPES){const j=job(r.id,'me','auto');let p=j.cooking.progress;for(let i=0;i<1500&&p.index<3;i++)p=step(j,p,{kind:'tick',dt:.1});assert.equal(p.index,3,r.id);if(p.table){assert.ok(p.table.items.every(q=>q.zone==='plate'),r.id);assert.ok(p.table.order.length);}}
 const j={...job('mushroom-chicken'),cooking:K.cookingSession('mushroom-chicken',{swaps:{chicken:'shrimp'}})};assert.ok(j.cooking.progress.table.items.some(q=>q.ingredient==='shrimp'));assert.ok(!j.cooking.progress.table.items.some(q=>q.ingredient==='chicken'));
});
test('沿真实home writer保存切块和摆盘，失败重试、重进、收好一次、别角色与主档隔离',async()=>{
 const env={window:null,Date,JSON,Math};env.window=env;vm.createContext(env);for(const f of ['apps/fairy-garden/day/kitchen.js','js/char-day-life.js','js/char-day-core.js','js/char-day.js'])vm.runInContext(fs.readFileSync(f,'utf8'),env);
 let homes={version:3,kitchens:{other:{ingredients:{egg:8}}},future:{keep:1}},fail=false;env.loadJSON=()=>homes;env.commitJSONDurable=async(k,v)=>{assert.equal(k,'x_charDayHomes');if(fail)return {durable:false,live:false};homes=JSON.parse(JSON.stringify(v));return {durable:true,live:true};};const L=env.CharDayLife,write=a=>env.CharDayKit.saveHomeChange('a','kitchens',raw=>L.kitchenChange(raw,a));
 await write({kind:'shop',recipeId:'fruit-salad'});await write({kind:'begin',id:'dish',recipeId:'fruit-salad',choices:{mode:'auto',lead:'me'}});const j=homes.kitchens.a.pending;let p=j.cooking.progress;for(let i=0;i<1200&&p.index<3;i++)p=L.stepCooking(j,p,{kind:'tick',dt:.1});assert.equal(p.index,3);const before=JSON.stringify(homes);await assert.rejects(write({kind:'progress',id:j.id,progress:{index:3,rev:1}}));assert.equal(JSON.stringify(homes),before);await assert.rejects(write({kind:'ready',id:j.id}));fail=true;await assert.rejects(write({kind:'progress',id:j.id,progress:p}));assert.equal(JSON.stringify(homes),before);fail=false;
 await write({kind:'progress',id:j.id,progress:p});assert.deepEqual(homes.kitchens.a.pending.cooking.progress.table,JSON.parse(JSON.stringify(p.table)));await write({kind:'finish',id:j.id,at:123});assert.ok(homes.kitchens.a.dishes[0].tabletop.sealed);assert.equal(homes.kitchens.a.ingredients.apple,0);await assert.rejects(write({kind:'finish',id:j.id,at:124}));assert.equal(homes.kitchens.other.ingredients.egg,8);assert.equal(homes.future.keep,1);
});
test('从食材内部短划、斜切和往返划切会响应；空处和微小抖动不切，体积守恒',()=>{
 const j=job(),piece=j.cooking.progress.table.items[0],board=drop(j,j.cooking.progress,piece.id,'board'),center=Z.board;
 for(const path of [[center,{x:center.x+.09,z:center.z}], [{x:center.x-.10,z:center.z-.035},{x:center.x+.11,z:center.z+.035}], [center,{x:center.x+.09,z:center.z},center]]){
  const next=step(j,board,{kind:'slice',from:path[0],to:path.at(-1),path});assert.equal(next.table.items.filter(p=>p.zone==='board').length,2);assert.ok(Math.abs(next.table.items.reduce((n,p)=>n+p.w*p.d*p.h,0)-board.table.items.reduce((n,p)=>n+p.w*p.d*p.h,0))<1e-9);
 }
 for(const path of [[center,{x:center.x+.02,z:center.z}], [{x:center.x,z:center.z+.3},{x:center.x+.15,z:center.z+.3}]])assert.deepEqual(step(j,board,{kind:'slice',from:path[0],to:path.at(-1),path}),board);
});
test('下一步按实际食材所在位置给选项，已熟、火候过重与口味结果沿同一writer保留',()=>{
 const j=job();let p=j.cooking.progress;assert.equal(K.primaryStation(j,p),'basket');assert.ok(K.cookingGuide(j,p).text.includes('食材'));
 p=drop(j,p,p.table.items[0].id,'board');assert.equal(K.primaryStation(j,p),'board');assert.ok(K.cookingGuide(j,p,'board').choices.some(c=>c.event.kind==='board-pan'));
 const result=K.dishResult({...j,cooking:{...j.cooking,progress:p}});assert.equal(result.label,'还没做熟');
 for(const x of p.table.items){x.zone='plate';x.top=x.bottom=1;x.heatTime=27;}p.table.sealed=true;p.index=3;
 let s=K.kitchenChange({}, {kind:'shop',recipeId:j.recipeId});s=K.kitchenChange(s,{kind:'begin',id:j.id,recipeId:j.recipeId,choices:{lead:'ta'}});s=K.kitchenChange(s,{kind:'progress',id:j.id,progress:{...p,rev:100}});s=K.kitchenChange(s,{kind:'finish',id:j.id,at:123});const saved=JSON.parse(JSON.stringify(s));assert.equal(K.dishResult(saved.dishes[0]).label,'火候偏重');assert.ok(K.dishResult(saved.dishes[0]).texture.includes('偏干'));assert.equal(saved.dishes[0].tabletop.items[0].heatTime,27);
});
