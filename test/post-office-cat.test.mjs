import test from 'node:test';import assert from 'node:assert/strict';
import {createShopFlow,queuePoint} from '../apps/post-office/flow.mjs';
import {COUNTER_SURFACE,SHOP_FLOOR} from '../apps/post-office/furniture.mjs';
const cat={id:'x_cat',key:'2026-11-9|上午|x_cat',kind:'guest',rareId:'cat',look:{npcSpecies:'cat'},npcStyle:'rare_cat'},person={id:'regular',key:'2026-11-9|上午|regular',kind:'guest',look:{npcSpecies:'person'}};
const facts=()=>({date:'2026-11-9',phase:'open',closed:false,ambient:false,staff:[],decor:[],customers:[cat,person]});
test('三花猫不占人的队列，跳上实体柜台、低头放叶、只喵一次并离开；刷新不循环出场',()=>{
 const flow=createShopFlow();flow.reconcile(facts());assert.deepEqual(flow.units.get('guest:'+person.key).target,queuePoint(0));let leaf=false,meows=0,wasMeow=false,top=false;const phases=new Set();
 for(let i=0;i<1400;i++){flow.step(.025);const u=flow.units.get('guest:'+cat.key);if(u){phases.add(u.phase);if(u.phase==='cat-counter'){assert.ok(Math.abs(SHOP_FLOOR+u.catHeight-COUNTER_SURFACE)<1e-6);top=true;}leaf ||=!!u.catLeafDropped;const meow=u.bubble==='喵';if(meow&&!wasMeow)meows++;wasMeow=meow;assert.equal(u.seated,undefined);assert.equal(!!u.letter,false);}if(i%20===0)flow.reconcile(facts());}
 assert.ok(top&&leaf);assert.equal(meows,1);assert.ok(phases.has('cat-jump')&&phases.has('cat-down'));assert.equal(flow.units.has('guest:'+cat.key),false);
 const saved=flow.snapshot(),reloaded=createShopFlow();reloaded.reconcile(facts());reloaded.resume(saved);assert.equal(reloaded.units.has('guest:'+cat.key),false);
});
test('猫在柜台上的现场往返，恢复同一动作和叶子，不找穿过柜台的步行路线',()=>{
 const a=createShopFlow();a.reconcile(facts());for(let i=0;i<1000;i++){a.step(.025);if(a.units.get('guest:'+cat.key)?.catLeafDropped)break;}
 const saved=a.snapshot(),b=createShopFlow();b.reconcile(facts());b.resume(saved);assert.equal(b.units.get('guest:'+cat.key).phase,'cat-counter');for(let i=0;i<1000;i++)b.step(.025);assert.equal(b.units.has('guest:'+cat.key),false);
});
test('新娘小跑、拄杖客慢行；角色来访即使带着同名外貌字段也不会变成猫',()=>{
 function distance(overrides){const f=createShopFlow(),u={...person,...overrides};f.reconcile({...facts(),customers:[u]});for(let i=0;i<40;i++)f.step(.025);const p=f.units.get('guest:'+u.key).position;return Math.hypot(p.x-3.32,p.z-4.7);}
 assert.ok(distance({npcStyle:'rare_bride'})>distance({}));assert.ok(distance({look:{npcFeature:'cane'}})<distance({}));
 const f=createShopFlow(),visitor={...cat,visitor:true,npcStyle:null,actorId:'role'};f.reconcile({...facts(),customers:[visitor]});for(let i=0;i<800;i++)f.step(.025);assert.equal(f.units.get('guest:'+cat.key).phase,'queuing');
});
test('入口年龄沿既有现场快照续接，来回文字版不把一次出场雾雪重新起算',()=>{
 const a=createShopFlow(),guest={...person,npcStyle:'rare_ghost'};a.reconcile({...facts(),customers:[guest]});for(let i=0;i<120;i++)a.step(.025);const s=a.snapshot(),age=s.units.find(x=>x.id===guest.id).entryAge;assert.ok(age>2.8);
 const b=createShopFlow();b.reconcile({...facts(),customers:[guest]});b.resume(s);assert.ok(Math.abs(b.snapshot().units.find(x=>x.id===guest.id).entryAge-age)<1e-6);
});
